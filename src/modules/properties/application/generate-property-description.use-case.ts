import { Inject, Injectable } from '@nestjs/common';
import { PropertyDescriptionRequest } from '../../../shared/types/property-contracts';
import { fingerprintOf } from '../../../shared/utils/fingerprint';
import { aiDescriptionFailedError } from '../../ai/domain/ai-errors';
import { AI_PROVIDER, AiProvider } from '../../ai/domain/ai-provider.port';
import { sanitizeGeneratedDescription } from '../../ai/application/description-sanitizer';
import { IdempotencyService } from '../../idempotency/application/idempotency.service';
import { PropertyDescriptionResponse } from '../domain/property-response.schema';
import { buildDescriptionPayload } from './description-payload.mapper';

export const GENERATE_DESCRIPTION_SCOPE = 'properties.description';

export interface GenerateDescriptionOutcome {
  readonly response: PropertyDescriptionResponse;
  readonly replayed: boolean;
}

@Injectable()
export class GeneratePropertyDescriptionUseCase {
  constructor(
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
    private readonly idempotency: IdempotencyService,
  ) {}

  async execute(request: PropertyDescriptionRequest): Promise<GenerateDescriptionOutcome> {
    const property = buildDescriptionPayload(request.property);
    const fingerprint = fingerprintOf(
      GENERATE_DESCRIPTION_SCOPE,
      JSON.stringify(property),
      request.style,
    );

    const execution = await this.idempotency.execute(
      { scope: GENERATE_DESCRIPTION_SCOPE, fingerprint },
      async () => {
        const generation = await this.aiProvider.generatePropertyDescription({
          property,
          style: request.style,
        });
        const description = sanitizeGeneratedDescription(generation.description);

        if (description.length === 0) {
          throw aiDescriptionFailedError('The AI provider returned an empty description.');
        }

        return { description };
      },
    );

    return { response: execution.value, replayed: execution.replayed };
  }
}
