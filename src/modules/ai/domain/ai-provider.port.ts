import type {
  AiExtractedProperty,
  AiWarning,
  PropertyDescriptionPayload,
} from '../../../shared/types/property-contracts';
import type { DescriptionStyle } from '../../../shared/types/property-vocabulary';

export const AI_PROVIDER = Symbol('AI_PROVIDER');

export interface AiDocumentInput {
  readonly data: Uint8Array;
  readonly mimeType: string;
  readonly filename: string | null;
  readonly pageCount: number | null;
}

export interface AiTokenUsage {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly totalTokens: number | null;
}

export const EMPTY_TOKEN_USAGE: AiTokenUsage = {
  inputTokens: null,
  outputTokens: null,
  totalTokens: null,
};

export interface AiExecutionInfo {
  readonly provider: string;
  readonly model: string;
  readonly durationMs: number;
  readonly usage: AiTokenUsage;
}

export interface ExtractPropertiesInput {
  readonly document: AiDocumentInput;
}

export interface ExtractPropertiesResult extends AiExecutionInfo {
  readonly properties: readonly AiExtractedProperty[];
  readonly warnings: readonly AiWarning[];
}

export interface GeneratePropertyDescriptionInput {
  readonly property: PropertyDescriptionPayload;
  readonly style: DescriptionStyle;
}

export interface GeneratePropertyDescriptionResult extends AiExecutionInfo {
  readonly description: string;
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  extractProperties(input: ExtractPropertiesInput): Promise<ExtractPropertiesResult>;
  generatePropertyDescription(
    input: GeneratePropertyDescriptionInput,
  ): Promise<GeneratePropertyDescriptionResult>;
}

export type AiOperation = 'extract_properties' | 'generate_property_description';
