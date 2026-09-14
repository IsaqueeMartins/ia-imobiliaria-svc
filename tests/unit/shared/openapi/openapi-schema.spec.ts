import { z } from 'zod';
import { toOpenApiSchema } from '../../../../src/shared/openapi/openapi-schema';
import { errorResponseSchema } from '../../../../src/shared/errors/error-response.schema';
import { extractPropertiesResponseSchema } from '../../../../src/modules/properties/domain/property-response.schema';
import { propertyDescriptionRequestSchema } from '../../../../src/shared/types/property-contracts';

describe('toOpenApiSchema', () => {
  it('converts a request schema to an OpenAPI schema', () => {
    const schema = toOpenApiSchema(propertyDescriptionRequestSchema, 'input');

    expect(schema.type).toBe('object');
    expect((schema as Record<string, unknown>).$schema).toBeUndefined();
    expect(Object.keys(schema.properties ?? {})).toContain('property');
  });

  it('converts response schemas with nullable fields', () => {
    const schema = toOpenApiSchema(extractPropertiesResponseSchema, 'output');
    const properties = schema.properties as Record<string, { type?: string }>;

    expect(properties.document).toBeDefined();
    expect(
      (
        properties.properties as unknown as {
          items: { properties: Record<string, { nullable?: boolean }> };
        }
      ).items.properties.price.nullable,
    ).toBe(true);
  });

  it('exposes the error contract schema used by the API documentation', () => {
    const schema = toOpenApiSchema(errorResponseSchema, 'output');

    expect(Object.keys(schema.properties ?? {}).sort()).toEqual(
      ['code', 'details', 'message', 'requestId', 'statusCode'].sort(),
    );
  });

  it('throws for schemas that cannot be represented', () => {
    expect(() =>
      toOpenApiSchema(z.object({ value: z.string().transform(() => 1) }), 'output'),
    ).toThrow(/Transforms cannot be represented/);
  });
});
