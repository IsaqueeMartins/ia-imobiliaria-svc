import { Inject, Injectable } from '@nestjs/common';
import { FileState, GoogleGenAI, Part } from '@google/genai';
import { AppConfigService } from '../../../../shared/config/app-config.service';
import { StructuredLoggerService } from '../../../../shared/logging/structured-logger.service';
import { AiDocumentInput } from '../../domain/ai-provider.port';
import {
  geminiUploadFailedError,
  geminiUploadTimeoutError,
  mapGeminiError,
} from './gemini-error.mapper';
import { GEMINI_CLIENT } from './gemini-client.factory';

export interface GeminiDocumentPart {
  readonly part: Part;
  dispose(): Promise<void>;
}

const UPLOAD_POLL_INTERVAL_MS = 1000;
const UPLOAD_MAX_WAIT_MS = 120000;
const UPLOAD_TIMEOUT_MULTIPLIER = 4;

@Injectable()
export class GeminiDocumentPartFactory {
  constructor(
    @Inject(GEMINI_CLIENT) private readonly client: GoogleGenAI,
    private readonly config: AppConfigService,
    private readonly logger: StructuredLoggerService,
  ) {}

  async create(document: AiDocumentInput): Promise<GeminiDocumentPart> {
    if (document.data.byteLength <= this.config.ai.inlineMaxBytes) {
      return this.createInlinePart(document);
    }
    return this.createUploadedPart(document);
  }

  private createInlinePart(document: AiDocumentInput): GeminiDocumentPart {
    return {
      part: {
        inlineData: {
          mimeType: document.mimeType,
          data: Buffer.from(document.data).toString('base64'),
        },
      },
      dispose: () => Promise.resolve(),
    };
  }

  private async createUploadedPart(document: AiDocumentInput): Promise<GeminiDocumentPart> {
    const uploaded = await this.upload(document);
    if (!uploaded.name || !uploaded.uri) {
      throw geminiUploadFailedError(document.filename ?? 'document');
    }

    if (uploaded.state !== FileState.ACTIVE) {
      await this.waitUntilActive(uploaded.name);
    }

    const fileName = uploaded.name;
    return {
      part: {
        fileData: {
          fileUri: uploaded.uri,
          mimeType: document.mimeType,
        },
      },
      dispose: async () => {
        try {
          await this.client.files.delete({ name: fileName });
        } catch (error) {
          this.logger.warn(
            {
              event: 'ai.provider.file_delete_failed',
              fileName,
              error: mapGeminiError(error, 'files'),
            },
            'GeminiDocumentPartFactory',
          );
        }
      },
    };
  }

  private async upload(document: AiDocumentInput) {
    const blob = new Blob([new Uint8Array(document.data)], { type: document.mimeType });
    try {
      return await this.client.files.upload({
        file: blob,
        config: {
          mimeType: document.mimeType,
          displayName: document.filename ?? undefined,
          httpOptions: {
            timeout: this.config.ai.requestTimeoutMs * UPLOAD_TIMEOUT_MULTIPLIER,
            retryOptions: { attempts: 1 },
          },
        },
      });
    } catch (error) {
      throw mapGeminiError(error, 'files.upload');
    }
  }

  private async waitUntilActive(fileName: string): Promise<void> {
    const deadline = Date.now() + UPLOAD_MAX_WAIT_MS;

    for (;;) {
      const file = await this.client.files.get({ name: fileName });
      if (file.state === FileState.ACTIVE) {
        return;
      }
      if (file.state === FileState.FAILED) {
        throw geminiUploadFailedError(fileName);
      }
      if (Date.now() >= deadline) {
        throw geminiUploadTimeoutError(fileName);
      }
      await new Promise((resolve) => {
        setTimeout(resolve, UPLOAD_POLL_INTERVAL_MS);
      });
    }
  }
}
