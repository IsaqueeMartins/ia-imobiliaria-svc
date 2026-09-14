import type { SchemaObject } from '@nestjs/swagger';
import { ZodType, z } from 'zod';

export function toOpenApiSchema(schema: ZodType, io: 'input' | 'output' = 'input'): SchemaObject {
  const jsonSchema = z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io,
    reused: 'inline',
  }) as Record<string, unknown>;

  delete jsonSchema.$schema;

  return jsonSchema as SchemaObject;
}
