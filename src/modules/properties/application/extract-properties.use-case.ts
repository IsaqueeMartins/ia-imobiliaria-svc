import { Inject, Injectable } from '@nestjs/common';
import { StructuredLoggerService } from '../../../shared/logging/structured-logger.service';
import { fingerprintOf } from '../../../shared/utils/fingerprint';
import { aiExtractionFailedError } from '../../ai/domain/ai-errors';
import { AI_PROVIDER, AiProvider } from '../../ai/domain/ai-provider.port';
import { DocumentResolver } from '../../documents/application/document-resolver.service';
import { DocumentSourceRequest, ResolvedDocument } from '../../documents/domain/document.types';
import { IdempotencyService } from '../../idempotency/application/idempotency.service';
import {
  ExtractPropertiesResponse,
  ExtractionWarning,
  NormalizedProperty,
} from '../domain/property-response.schema';
import { mapModelWarnings } from './property-extraction-warnings';
import {
  PROPERTY_NORMALIZATION_FAILED_CODE,
  PropertyNormalizer,
} from './property-normalizer.service';

export const EXTRACT_PROPERTIES_SCOPE = 'properties.extract';

export interface ExtractPropertiesCommand {
  readonly source: DocumentSourceRequest;
  readonly requestId: string;
  readonly tenantId: string | null;
}

export interface ExtractPropertiesOutcome {
  readonly response: ExtractPropertiesResponse;
  readonly replayed: boolean;
}

@Injectable()
export class ExtractPropertiesUseCase {
  constructor(
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
    private readonly documentResolver: DocumentResolver,
    private readonly normalizer: PropertyNormalizer,
    private readonly idempotency: IdempotencyService,
    private readonly logger: StructuredLoggerService,
  ) {}

  async execute(command: ExtractPropertiesCommand): Promise<ExtractPropertiesOutcome> {
    const document = await this.documentResolver.resolve(command.source);
    const fingerprint = fingerprintOf(
      EXTRACT_PROPERTIES_SCOPE,
      command.tenantId,
      document.reference.objectKey,
      document.data,
    );

    const execution = await this.idempotency.execute(
      { scope: EXTRACT_PROPERTIES_SCOPE, fingerprint },
      () => this.run(document, command),
    );

    return { response: execution.value, replayed: execution.replayed };
  }

  private async run(
    document: ResolvedDocument,
    command: ExtractPropertiesCommand,
  ): Promise<ExtractPropertiesResponse> {
    const pageCount = document.pageCount;
    const extraction = await this.aiProvider.extractProperties({
      document: {
        data: document.data,
        mimeType: document.mimeType,
        filename: document.filename,
        pageCount,
      },
    });

    const documentWarnings = mapModelWarnings(extraction.warnings, pageCount, null);
    const properties: NormalizedProperty[] = [];
    const errors: ExtractionWarning[] = [];

    extraction.properties.forEach((property, index) => {
      try {
        properties.push(this.normalizer.normalize({ property, index, pageCount }));
      } catch (error) {
        this.logger.warn(
          {
            event: 'properties.extraction.normalization_failed',
            propertyIndex: index,
            documentId: document.id,
            reason: error instanceof Error ? error.message : String(error),
          },
          'ExtractPropertiesUseCase',
        );
        errors.push({
          code: PROPERTY_NORMALIZATION_FAILED_CODE,
          message: 'The extracted property could not be normalized.',
          field: null,
          pages: [],
          propertyIndex: index,
        });
      }
    });

    if (properties.length === 0) {
      throw aiExtractionFailedError({
        documentId: document.id,
        pages: pageCount,
        warnings: documentWarnings,
        errors,
      });
    }

    return {
      requestId: command.requestId,
      document: {
        id: document.id,
        pages: pageCount,
        sizeBytes: document.sizeBytes,
        source: document.source,
        filename: document.filename,
        tenantId: command.tenantId,
        documentId: document.reference.documentId,
        objectKey: document.reference.objectKey,
      },
      properties,
      warnings: documentWarnings,
      errors,
      usage: {
        provider: extraction.provider,
        model: extraction.model,
        inputTokens: extraction.usage.inputTokens,
        outputTokens: extraction.usage.outputTokens,
        totalTokens: extraction.usage.totalTokens,
        durationMs: extraction.durationMs,
      },
    };
  }
}
