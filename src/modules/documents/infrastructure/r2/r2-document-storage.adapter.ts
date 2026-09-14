import { GetObjectCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../../shared/config/app-config.service';
import { StructuredLoggerService } from '../../../../shared/logging/structured-logger.service';
import {
  documentNotFoundError,
  documentTooLargeError,
  storageError,
} from '../../domain/document.errors';
import { DocumentStorage, StorageObject } from '../../domain/document-storage.port';

const R2_REGION = 'auto';
const NOT_FOUND_ERROR_NAMES = new Set(['NoSuchKey', 'NotFound', 'NoSuchBucket']);

interface SdkErrorMetadata {
  readonly name?: string;
  readonly $metadata?: { readonly httpStatusCode?: number };
}

function isNotFoundError(error: unknown): boolean {
  const metadata = error as SdkErrorMetadata | null;
  if (metadata?.name && NOT_FOUND_ERROR_NAMES.has(metadata.name)) {
    return true;
  }
  return metadata?.$metadata?.httpStatusCode === 404;
}

@Injectable()
export class R2DocumentStorageAdapter implements DocumentStorage {
  readonly name = 'cloudflare-r2';

  private readonly client: S3Client | null;
  private readonly bucket: string | null;

  constructor(
    private readonly config: AppConfigService,
    private readonly logger: StructuredLoggerService,
  ) {
    const settings = this.config.storage;
    this.bucket = settings.bucket;
    this.client = this.isConfigured()
      ? new S3Client({
          region: R2_REGION,
          endpoint: settings.endpoint ?? `https://${settings.accountId}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: settings.accessKeyId as string,
            secretAccessKey: settings.secretAccessKey as string,
          },
        })
      : null;
  }

  isConfigured(): boolean {
    const settings = this.config.storage;
    return Boolean(
      settings.accountId && settings.accessKeyId && settings.secretAccessKey && settings.bucket,
    );
  }

  async getObject(objectKey: string): Promise<StorageObject> {
    const client = this.requireClient();
    const maxSizeBytes = this.config.documents.maxDocumentSizeBytes;

    try {
      const response = await client.send(
        new GetObjectCommand({ Bucket: this.bucket as string, Key: objectKey }),
      );

      const contentLength = response.ContentLength ?? null;
      if (contentLength !== null && contentLength > maxSizeBytes) {
        (response.Body as { destroy?: () => void } | undefined)?.destroy?.();
        throw documentTooLargeError('The referenced document exceeds the maximum allowed size.', {
          contentLength,
          maxDocumentSizeBytes: maxSizeBytes,
        });
      }

      const bytes = await response.Body?.transformToByteArray();
      if (!bytes) {
        throw storageError('The storage provider returned an empty document body.');
      }

      this.logger.debug(
        { event: 'storage.object.read', provider: this.name, sizeBytes: bytes.byteLength },
        'R2DocumentStorageAdapter',
      );

      return {
        data: Buffer.from(bytes),
        contentType: response.ContentType ?? null,
        contentLength,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AppError') {
        throw error;
      }
      if (isNotFoundError(error)) {
        throw documentNotFoundError(objectKey);
      }
      throw storageError(
        `Unable to read the document from storage: ${error instanceof Error ? error.message : String(error)}`,
        error,
      );
    }
  }

  async probe(): Promise<void> {
    await this.requireClient().send(new HeadBucketCommand({ Bucket: this.bucket as string }));
  }

  private requireClient(): S3Client {
    if (!this.client) {
      throw storageError('Document storage is not configured.');
    }
    return this.client;
  }
}
