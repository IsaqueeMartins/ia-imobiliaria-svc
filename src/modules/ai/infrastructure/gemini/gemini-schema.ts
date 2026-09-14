import { z } from 'zod';

type JsonSchemaNode = Record<string, unknown>;

const UNSUPPORTED_KEYS = new Set([
  '$schema',
  '$id',
  '$defs',
  '$ref',
  'default',
  'examples',
  'propertyNames',
  'additionalProperties',
  'uniqueItems',
  'minProperties',
  'maxProperties',
  'minLength',
  'maxLength',
  'pattern',
]);

const SUPPORTED_FORMATS = new Set(['date', 'date-time', 'time']);

const SENTINEL_MAXIMUM = 9007199254740991;

function sanitizeNode(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map((entry) => sanitizeNode(entry));
  }

  if (node === null || typeof node !== 'object') {
    return node;
  }

  const source = node as JsonSchemaNode;
  const result: JsonSchemaNode = {};

  for (const [key, value] of Object.entries(source)) {
    if (UNSUPPORTED_KEYS.has(key)) {
      continue;
    }

    if (key === 'format') {
      if (typeof value === 'string' && SUPPORTED_FORMATS.has(value)) {
        result.format = value;
      }
      continue;
    }

    if (key === 'const') {
      result.enum = [value];
      continue;
    }

    if (key === 'minimum' || key === 'maximum') {
      const numeric = typeof value === 'number' ? value : null;
      if (numeric !== null && Math.abs(numeric) < SENTINEL_MAXIMUM) {
        result[key] = numeric;
      }
      continue;
    }

    if (key === 'type' && Array.isArray(value)) {
      const types = value.filter((entry): entry is string => typeof entry === 'string');
      if (types.includes('null')) {
        result.nullable = true;
      }
      const nonNull = types.filter((entry) => entry !== 'null');
      result.type = nonNull.length === 1 ? nonNull[0] : nonNull;
      continue;
    }

    if (key === 'properties' && value !== null && typeof value === 'object') {
      const properties: JsonSchemaNode = {};
      for (const [propertyName, propertySchema] of Object.entries(value as JsonSchemaNode)) {
        properties[propertyName] = sanitizeNode(propertySchema);
      }
      result.properties = properties;
      continue;
    }

    result[key] = sanitizeNode(value);
  }

  if (Array.isArray(source.anyOf)) {
    const branches = (source.anyOf as unknown[]).map(
      (branch) => sanitizeNode(branch) as JsonSchemaNode,
    );
    const nonNullBranches = branches.filter((branch) => branch.type !== 'null');
    const hasNullBranch = branches.some((branch) => branch.type === 'null');

    if (nonNullBranches.length === 1 && hasNullBranch) {
      const merged = { ...nonNullBranches[0], nullable: true };
      delete result.anyOf;
      return { ...result, ...merged };
    }

    if (nonNullBranches.length === 1 && !hasNullBranch) {
      delete result.anyOf;
      return { ...result, ...nonNullBranches[0] };
    }

    result.anyOf = nonNullBranches;
  }

  return result;
}

export function toGeminiResponseSchema(schema: z.ZodType): unknown {
  const jsonSchema = z.toJSONSchema(schema, {
    target: 'draft-7',
    io: 'output',
    reused: 'inline',
  }) as JsonSchemaNode;

  const sanitized = sanitizeNode(jsonSchema) as JsonSchemaNode;

  if (containsRef(sanitized)) {
    throw new Error('Gemini response schema must not contain $ref nodes.');
  }

  return sanitized;
}

function containsRef(node: unknown): boolean {
  if (Array.isArray(node)) {
    return node.some((entry) => containsRef(entry));
  }
  if (node === null || typeof node !== 'object') {
    return false;
  }
  const record = node as JsonSchemaNode;
  if ('$ref' in record) {
    return true;
  }
  return Object.values(record).some((value) => containsRef(value));
}
