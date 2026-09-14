const NUMBER_TOKEN = /(?<![\p{L}\p{N}])(-?\d[\d.,]*)/u;

export function parseDecimalNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const match = NUMBER_TOKEN.exec(value.trim());
  if (!match) {
    return null;
  }

  const token = match[1];
  const lastComma = token.lastIndexOf(',');
  const lastDot = token.lastIndexOf('.');
  let normalized: string;

  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    normalized = token.split(thousandsSeparator).join('').replace(decimalSeparator, '.');
  } else if (lastComma !== -1) {
    const parts = token.split(',');
    normalized = parts.length > 2 ? parts.join('') : `${parts[0]}.${parts[1]}`;
  } else if (lastDot !== -1) {
    const parts = token.split('.');
    normalized = parts.length === 2 && parts[1].length === 3 ? parts.join('') : token;
  } else {
    normalized = token;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseInteger(value: unknown): number | null {
  const parsed = parseDecimalNumber(value);
  if (parsed === null) {
    return null;
  }
  const rounded = Math.round(parsed);
  return Math.abs(parsed - rounded) < 0.001 ? rounded : null;
}
