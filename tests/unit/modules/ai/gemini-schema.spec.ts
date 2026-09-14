import { aiExtractionResponseSchema } from '../../../../src/shared/types/property-contracts';
import { toGeminiResponseSchema } from '../../../../src/modules/ai/infrastructure/gemini/gemini-schema';

interface GeminiSchemaNode {
  type?: string | string[];
  nullable?: boolean;
  enum?: unknown[];
  properties?: Record<string, GeminiSchemaNode>;
  items?: GeminiSchemaNode;
  additionalProperties?: unknown;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  format?: string;
  anyOf?: unknown[];
  $schema?: unknown;
}

describe('toGeminiResponseSchema', () => {
  const schema = toGeminiResponseSchema(aiExtractionResponseSchema) as GeminiSchemaNode;

  it('removes keywords that the Gemini schema subset does not support', () => {
    const serialized = JSON.stringify(schema);

    expect(serialized).not.toContain('$schema');
    expect(serialized).not.toContain('additionalProperties');
    expect(serialized).not.toContain('"default"');
    expect(serialized).not.toContain('minLength');
    expect(serialized).not.toContain('maxLength');
    expect(serialized).not.toContain('propertyNames');
    expect(serialized).not.toContain('$ref');
  });

  it('converts nullable unions into nullable types', () => {
    const properties = schema.properties?.properties as GeminiSchemaNode;
    const item = properties.items as GeminiSchemaNode;
    const price = item.properties?.price as GeminiSchemaNode;

    expect(price.type).toBe('number');
    expect(price.nullable).toBe(true);
  });

  it('keeps enums on nullable enum fields', () => {
    const properties = schema.properties?.properties as GeminiSchemaNode;
    const item = properties.items as GeminiSchemaNode;
    const type = item.properties?.type as GeminiSchemaNode;

    expect(type.type).toBe('string');
    expect(type.nullable).toBe(true);
    expect(type.enum).toEqual(expect.arrayContaining(['apartment', 'house']));
    expect(type.anyOf).toBeUndefined();
  });

  it('keeps array item bounds that come from the application schema', () => {
    const properties = schema.properties?.properties as GeminiSchemaNode;
    const item = properties.items as GeminiSchemaNode;
    const pages = item.properties?.sourcePages as GeminiSchemaNode;

    expect(pages.type).toBe('array');
    expect(pages.items?.type).toBe('integer');
    expect(pages.items?.minimum).toBe(1);
    expect(pages.items?.maximum).toBe(1000);
    expect(JSON.stringify(schema)).not.toContain('9007199254740991');
  });

  it('keeps real numeric bounds that the model must respect', () => {
    const properties = schema.properties?.properties as GeminiSchemaNode;
    const item = properties.items as GeminiSchemaNode;
    const confidence = item.properties?.confidence as GeminiSchemaNode;

    expect(confidence.minimum).toBe(0);
    expect(confidence.maximum).toBe(1);
  });
});
