const REDACTED = '[REDACTED]';
const CIRCULAR = '[Circular]';
const BINARY = 'binary';

const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|secret|password|credential|api[-_]?key|access[-_]?key|idempotency[-_]?key|bearer|token)/i;

const MAX_STRING_LENGTH = 1000;
const MAX_ARRAY_ITEMS = 50;
const MAX_OBJECT_KEYS = 80;
const MAX_DEPTH = 4;

export function isBinaryValue(value: unknown): value is Uint8Array {
  return (
    value instanceof Uint8Array ||
    value instanceof ArrayBuffer ||
    (typeof Buffer !== 'undefined' && Buffer.isBuffer(value))
  );
}

function sanitizeString(value: string): string {
  return value.length > MAX_STRING_LENGTH
    ? `${value.slice(0, MAX_STRING_LENGTH)}...[truncated:${value.length}]`
    : value;
}

function sanitizeError(error: Error): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: error.name,
    message: sanitizeString(error.message),
  };
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string') {
    payload.code = code;
  }
  return payload;
}

export function sanitizeLogValue(
  value: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'function' || typeof value === 'symbol') {
    return typeof value;
  }

  if (isBinaryValue(value)) {
    return `<${BINARY}:${value.byteLength ?? 0} bytes>`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return sanitizeError(value);
  }

  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) {
      return `[Array(${value.length})]`;
    }
    const items = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeLogValue(item, depth + 1, seen));
    if (value.length > MAX_ARRAY_ITEMS) {
      items.push(`[+${value.length - MAX_ARRAY_ITEMS} more]`);
    }
    return items;
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return CIRCULAR;
    }
    if (depth >= MAX_DEPTH) {
      return '[Object]';
    }
    seen.add(value);
    const result: Record<string, unknown> = {};
    const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_OBJECT_KEYS);
    for (const [key, entryValue] of entries) {
      result[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? REDACTED
        : sanitizeLogValue(entryValue, depth + 1, seen);
    }
    return result;
  }

  return String(value);
}

export function sanitizeLogPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return sanitizeLogValue(payload, 0, new WeakSet()) as Record<string, unknown>;
}

export function safeStringify(payload: Record<string, unknown>): string {
  try {
    return JSON.stringify(payload);
  } catch {
    return JSON.stringify({ level: 'error', msg: 'log_serialization_failed' });
  }
}
