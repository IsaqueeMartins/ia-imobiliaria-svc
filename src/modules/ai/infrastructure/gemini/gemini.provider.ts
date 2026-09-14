import {
  GenerateContentResponse,
  GenerateContentResponseUsageMetadata,
  GoogleGenAI,
  Part,
} from '@google/genai';
import { z } from 'zod';
import {
  aiDescriptionResponseSchema,
  aiExtractionResponseSchema,
} from '../../../../shared/types/property-contracts';
import { AiPrompt } from '../../application/prompt/ai-prompt';
import { PropertyDescriptionPromptBuilder } from '../../application/prompt/property-description.prompt';
import { PropertyExtractionPromptBuilder } from '../../application/prompt/property-extraction.prompt';
import {
  AiOperation,
  AiProvider,
  AiTokenUsage,
  EMPTY_TOKEN_USAGE,
  ExtractPropertiesInput,
  ExtractPropertiesResult,
  GeneratePropertyDescriptionInput,
  GeneratePropertyDescriptionResult,
} from '../../domain/ai-provider.port';
import { AiUsageRecorder } from '../../domain/ai-usage.port';
import { GeminiDocumentPartFactory } from './gemini-document-part.factory';
import {
  geminiEmptyResponseError,
  mapGeminiError,
  mapGeminiJsonError,
  mapGeminiSchemaError,
} from './gemini-error.mapper';
import { toGeminiResponseSchema } from './gemini-schema';

export interface GeminiProviderOptions {
  readonly model: string;
  readonly extractionTemperature: number;
  readonly descriptionTemperature: number;
}

export interface GeminiProviderDependencies {
  readonly client: GoogleGenAI;
  readonly options: GeminiProviderOptions;
  readonly extractionPrompt: PropertyExtractionPromptBuilder;
  readonly descriptionPrompt: PropertyDescriptionPromptBuilder;
  readonly documentParts: GeminiDocumentPartFactory;
  readonly usageRecorder: AiUsageRecorder;
}

interface StructuredGeneration<T> {
  readonly value: T;
  readonly usage: AiTokenUsage;
  readonly durationMs: number;
}

const CODE_FENCE_PATTERN = /^```(?:json)?\s*|\s*```$/gi;

export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  readonly model: string;

  constructor(private readonly dependencies: GeminiProviderDependencies) {
    this.model = dependencies.options.model;
  }

  async extractProperties(input: ExtractPropertiesInput): Promise<ExtractPropertiesResult> {
    const document = await this.dependencies.documentParts.create(input.document);
    try {
      const prompt = this.dependencies.extractionPrompt.build({
        pageCount: input.document.pageCount,
      });
      const generation = await this.generateStructured({
        operation: 'extract_properties',
        prompt,
        parts: [document.part],
        schema: aiExtractionResponseSchema,
        temperature: this.dependencies.options.extractionTemperature,
      });

      return {
        provider: this.name,
        model: this.model,
        durationMs: generation.durationMs,
        usage: generation.usage,
        properties: generation.value.properties,
        warnings: generation.value.warnings,
      };
    } finally {
      await document.dispose();
    }
  }

  async generatePropertyDescription(
    input: GeneratePropertyDescriptionInput,
  ): Promise<GeneratePropertyDescriptionResult> {
    const prompt = this.dependencies.descriptionPrompt.build({
      property: input.property,
      style: input.style,
    });
    const generation = await this.generateStructured({
      operation: 'generate_property_description',
      prompt,
      parts: [],
      schema: aiDescriptionResponseSchema,
      temperature: this.dependencies.options.descriptionTemperature,
    });

    return {
      provider: this.name,
      model: this.model,
      durationMs: generation.durationMs,
      usage: generation.usage,
      description: generation.value.description,
    };
  }

  private async generateStructured<T>(params: {
    operation: AiOperation;
    prompt: AiPrompt;
    parts: readonly Part[];
    schema: z.ZodType<T>;
    temperature: number;
  }): Promise<StructuredGeneration<T>> {
    const startedAt = Date.now();
    let usage: AiTokenUsage = EMPTY_TOKEN_USAGE;

    try {
      const response = await this.dependencies.client.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [...params.parts, { text: params.prompt.user }] }],
        config: {
          systemInstruction: params.prompt.system,
          temperature: params.temperature,
          responseMimeType: 'application/json',
          responseSchema: toGeminiResponseSchema(params.schema),
        },
      });

      usage = mapTokenUsage(response.usageMetadata);

      const text = typeof response.text === 'string' ? response.text : '';
      if (text.trim().length === 0) {
        throw geminiEmptyResponseError(this.model, describeFinishReason(response));
      }

      const value = this.parseResponse(text, params.schema);
      const durationMs = Date.now() - startedAt;

      this.recordUsage(params.operation, usage, durationMs, 'success', null);

      return { value, usage, durationMs };
    } catch (error) {
      const mapped = mapGeminiError(error, this.model);
      this.recordUsage(params.operation, usage, Date.now() - startedAt, 'error', mapped.code);
      throw mapped;
    }
  }

  private parseResponse<T>(text: string, schema: z.ZodType<T>): T {
    let payload: unknown;
    try {
      payload = JSON.parse(text.replace(CODE_FENCE_PATTERN, '').trim());
    } catch (error) {
      throw mapGeminiJsonError(this.model, error);
    }

    const result = schema.safeParse(payload);
    if (!result.success) {
      throw mapGeminiSchemaError(this.model, result.error);
    }

    return result.data;
  }

  private recordUsage(
    operation: AiOperation,
    usage: AiTokenUsage,
    durationMs: number,
    status: 'success' | 'error',
    errorCode: string | null,
  ): void {
    this.dependencies.usageRecorder.record({
      provider: this.name,
      model: this.model,
      operation,
      requestId: null,
      tenantId: null,
      consumerId: null,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      durationMs,
      status,
      errorCode,
      estimatedCostUsd: null,
    });
  }
}

function mapTokenUsage(usage: GenerateContentResponseUsageMetadata | undefined): AiTokenUsage {
  if (!usage) {
    return EMPTY_TOKEN_USAGE;
  }
  return {
    inputTokens: usage.promptTokenCount ?? null,
    outputTokens: usage.candidatesTokenCount ?? null,
    totalTokens: usage.totalTokenCount ?? null,
  };
}

function describeFinishReason(response: GenerateContentResponse): string | null {
  const blockReason = response.promptFeedback?.blockReason;
  if (blockReason) {
    return `blocked:${blockReason}`;
  }
  const finishReason = response.candidates?.[0]?.finishReason;
  return finishReason ? `finishReason:${finishReason}` : null;
}
