import {
  AiExtractedProperty,
  PropertyDescriptionPayload,
} from '../../src/shared/types/property-contracts';
import {
  AiProvider,
  ExtractPropertiesInput,
  ExtractPropertiesResult,
  GeneratePropertyDescriptionInput,
  GeneratePropertyDescriptionResult,
} from '../../src/modules/ai/domain/ai-provider.port';

export function createExtractedProperty(
  overrides: Partial<AiExtractedProperty> = {},
): AiExtractedProperty {
  return {
    title: 'Apartamento no Gonzaga',
    type: 'apartment',
    transaction: 'sale',
    price: 750000,
    rentalPrice: null,
    condominiumFee: null,
    iptu: null,
    area: 120,
    privateArea: null,
    builtArea: null,
    totalArea: null,
    bedrooms: 3,
    suites: null,
    bathrooms: 2,
    parkingSpaces: 2,
    location: {
      address: null,
      number: null,
      complement: null,
      neighborhood: 'Gonzaga',
      city: 'Santos',
      state: 'São Paulo',
      zipCode: '11065000',
    },
    features: ['varanda', 'piscina', 'whatsapp (13) 99999-9999', 'varanda'],
    description: null,
    sourcePages: [1, 2],
    confidence: 0.95,
    warnings: [],
    ...overrides,
  };
}

export function createExtractionResult(
  overrides: Partial<ExtractPropertiesResult> = {},
): ExtractPropertiesResult {
  return {
    provider: 'gemini',
    model: 'gemini-3.1-flash-lite',
    durationMs: 1234,
    usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    properties: [createExtractedProperty()],
    warnings: [],
    ...overrides,
  };
}

export function createDescriptionPayload(
  overrides: Partial<PropertyDescriptionPayload> = {},
): PropertyDescriptionPayload {
  return {
    type: 'apartment',
    transaction: 'sale',
    price: 750000,
    area: 120,
    bedrooms: 3,
    bathrooms: 2,
    parkingSpaces: 2,
    city: 'Santos',
    neighborhood: 'Gonzaga',
    features: ['varanda', 'piscina'],
    ...overrides,
  };
}

export interface MockAiProvider extends AiProvider {
  extractProperties: jest.Mock<Promise<ExtractPropertiesResult>, [ExtractPropertiesInput]>;
  generatePropertyDescription: jest.Mock<
    Promise<GeneratePropertyDescriptionResult>,
    [GeneratePropertyDescriptionInput]
  >;
}

export function createMockAiProvider(overrides: Partial<AiProvider> = {}): MockAiProvider {
  return {
    name: 'mock',
    model: 'mock-model',
    extractProperties: jest.fn(async () => createExtractionResult()),
    generatePropertyDescription: jest.fn(async () => ({
      provider: 'mock',
      model: 'mock-model',
      durationMs: 10,
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      description: 'Apartamento com tres dormitórios no bairro Gonzaga.',
    })),
    ...overrides,
  } as MockAiProvider;
}
