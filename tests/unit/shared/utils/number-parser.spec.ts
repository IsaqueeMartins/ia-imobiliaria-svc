import { parseDecimalNumber, parseInteger } from '../../../../src/shared/utils/number-parser';

describe('parseDecimalNumber', () => {
  it('parses Brazilian currency and measurement formats', () => {
    expect(parseDecimalNumber('R$ 750.000,00')).toBe(750000);
    expect(parseDecimalNumber('1.250,50')).toBe(1250.5);
    expect(parseDecimalNumber('120 m²')).toBe(120);
    expect(parseDecimalNumber('m2: 120,5')).toBe(120.5);
    expect(parseDecimalNumber(' 350000 ')).toBe(350000);
    expect(parseDecimalNumber('1,250,000')).toBe(1250000);
  });

  it('parses plain numbers and ignores invalid input', () => {
    expect(parseDecimalNumber(750000)).toBe(750000);
    expect(parseDecimalNumber('0')).toBe(0);
    expect(parseDecimalNumber('sob consulta')).toBeNull();
    expect(parseDecimalNumber('')).toBeNull();
    expect(parseDecimalNumber(null)).toBeNull();
    expect(parseDecimalNumber(Number.NaN)).toBeNull();
  });
});

describe('parseInteger', () => {
  it('accepts integer values in numeric and text form', () => {
    expect(parseInteger('3')).toBe(3);
    expect(parseInteger('3 quartos')).toBe(3);
    expect(parseInteger(4)).toBe(4);
  });

  it('rejects non integer values', () => {
    expect(parseInteger('2,5')).toBeNull();
    expect(parseInteger('sem vaga')).toBeNull();
  });
});
