const INSTITUTIONAL_PATTERNS: readonly RegExp[] = [
  /https?:\/\//i,
  /www\./i,
  /[a-z0-9._%+-]+@[a-z0-9.-]+/i,
  /\bcreci\b/i,
  /\bcr[eé]ci\b/i,
  /\bwhatsapp\b/i,
  /\(\d{2}\)\s?\d{4,5}[-\s]?\d{4}/,
  /\b\d{4,5}[-\s]\d{4}\b/,
  /\b(imobili[aá]ria|imobili[aá]rias|corretor|corretora|incorporadora)\b/i,
];

const EMOJI_PATTERN =
  /(?:[\u{1F000}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}]|\uFE0F)/gu;

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function emptyToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = normalizeWhitespace(value);
  return normalized.length > 0 ? normalized : null;
}

export function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength).trimEnd() : value;
}

export function stripEmojis(value: string): string {
  return value.replace(EMOJI_PATTERN, '');
}

export function stripHashtags(value: string): string {
  return value.replace(/#[\p{L}\p{N}_]+/gu, '');
}

export function isInstitutionalText(value: string): boolean {
  return INSTITUTIONAL_PATTERNS.some((pattern) => pattern.test(value));
}

const FEATURE_MAX_LENGTH = 80;

export function sanitizeFeatureLabel(value: string): string | null {
  const normalized = normalizeWhitespace(value.replace(/^[\s\-•*·–—]+/, ''));
  if (normalized.length === 0 || normalized.length > FEATURE_MAX_LENGTH) {
    return null;
  }
  if (isInstitutionalText(normalized)) {
    return null;
  }
  return normalized.toLowerCase();
}

export function dedupePreservingOrder(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }
  return result;
}
