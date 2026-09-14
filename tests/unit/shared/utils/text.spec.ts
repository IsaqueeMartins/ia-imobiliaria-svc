import {
  dedupePreservingOrder,
  emptyToNull,
  isInstitutionalText,
  sanitizeFeatureLabel,
  stripEmojis,
  stripHashtags,
  truncate,
} from '../../../../src/shared/utils/text';
import {
  normalizePropertyTypeLabel,
  normalizeStateCode,
  normalizeTransactionLabel,
  normalizeZipCode,
} from '../../../../src/shared/types/property-vocabulary';

describe('text helpers', () => {
  it('normalizes empty values to null', () => {
    expect(emptyToNull('   ')).toBeNull();
    expect(emptyToNull('  varanda  ')).toBe('varanda');
    expect(emptyToNull(null)).toBeNull();
  });

  it('truncates long values', () => {
    expect(truncate('abcdef', 3)).toBe('abc');
    expect(truncate('abc', 10)).toBe('abc');
  });

  it('removes emojis and hashtags', () => {
    expect(stripEmojis('Apartamento incrível 🏠✨')).toBe('Apartamento incrível ');
    expect(stripHashtags('Imperdível #imovel #santos')).toBe('Imperdível  ');
  });

  it('detects institutional content', () => {
    expect(isInstitutionalText('www.imobiliaria.com.br')).toBe(true);
    expect(isInstitutionalText('contato@imobiliaria.com')).toBe(true);
    expect(isInstitutionalText('CRECI 12345-J')).toBe(true);
    expect(isInstitutionalText('(13) 99999-8888')).toBe(true);
    expect(isInstitutionalText('varanda gourmet')).toBe(false);
  });

  it('sanitizes feature labels', () => {
    expect(sanitizeFeatureLabel('  VARANDA   Gourmet ')).toBe('varanda gourmet');
    expect(sanitizeFeatureLabel('- Piscina')).toBe('piscina');
    expect(sanitizeFeatureLabel('www.imobiliaria.com.br')).toBeNull();
    expect(sanitizeFeatureLabel('a'.repeat(120))).toBeNull();
    expect(sanitizeFeatureLabel('  ')).toBeNull();
  });

  it('dedupes values ignoring case', () => {
    expect(dedupePreservingOrder(['Piscina', 'piscina', 'Varanda'])).toEqual([
      'Piscina',
      'Varanda',
    ]);
  });
});

describe('property vocabulary', () => {
  it('maps property type synonyms', () => {
    expect(normalizePropertyTypeLabel('Apartamento')).toBe('apartment');
    expect(normalizePropertyTypeLabel('cobertura duplex')).toBe('penthouse');
    expect(normalizePropertyTypeLabel('CASA EM CONDOMÍNIO')).toBe('house');
    expect(normalizePropertyTypeLabel('lote')).toBe('land');
    expect(normalizePropertyTypeLabel('galpão')).toBe('commercial');
    expect(normalizePropertyTypeLabel('chácara')).toBe('rural');
    expect(normalizePropertyTypeLabel('castelo')).toBeNull();
  });

  it('maps transaction synonyms', () => {
    expect(normalizeTransactionLabel('Venda')).toBe('sale');
    expect(normalizeTransactionLabel('LOCAÇÃO')).toBe('rent');
    expect(normalizeTransactionLabel('permuta')).toBeNull();
  });

  it('normalizes state and zip code', () => {
    expect(normalizeStateCode('São Paulo')).toBe('SP');
    expect(normalizeStateCode('sp')).toBe('SP');
    expect(normalizeStateCode('Roraima')).toBe('RR');
    expect(normalizeStateCode('Narnia')).toBeNull();
    expect(normalizeZipCode('11065-000')).toBe('11065-000');
    expect(normalizeZipCode('11065000')).toBe('11065-000');
    expect(normalizeZipCode('123')).toBeNull();
  });
});
