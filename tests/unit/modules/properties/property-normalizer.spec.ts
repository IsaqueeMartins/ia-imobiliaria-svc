import { PropertyNormalizer } from '../../../../src/modules/properties/application/property-normalizer.service';
import { createExtractedProperty } from '../../../fixtures/property.fixture';

const normalizer = new PropertyNormalizer();

function normalize(overrides: Record<string, unknown> = {}, pageCount = 3) {
  return normalizer.normalize({
    property: createExtractedProperty(overrides),
    index: 0,
    pageCount,
  });
}

describe('PropertyNormalizer', () => {
  it('keeps extracted values, normalizes location and cleans features', () => {
    const property = normalize();

    expect(property.title).toBe('Apartamento no Gonzaga');
    expect(property.type).toBe('apartment');
    expect(property.transaction).toBe('sale');
    expect(property.price).toBe(750000);
    expect(property.location.state).toBe('SP');
    expect(property.location.zipCode).toBe('11065-000');
    expect(property.location.city).toBe('Santos');
    expect(property.features).toEqual(['varanda', 'piscina']);
    expect(property.source.pages).toEqual([1, 2]);
    expect(property.confidence.overall).toBe(0.95);
    expect(property.confidence.fields.price).toBe(0.95);
    expect(property.warnings).toEqual([]);
  });

  it('keeps missing information as null instead of inventing values', () => {
    const property = normalize({
      title: null,
      type: null,
      transaction: null,
      price: null,
      suites: null,
      bedrooms: null,
      bathrooms: null,
      parkingSpaces: null,
      privateArea: null,
      builtArea: null,
      totalArea: null,
      rentalPrice: null,
      condominiumFee: null,
      iptu: null,
      description: null,
      location: null,
      features: [],
      sourcePages: [],
      confidence: null,
      area: null,
    });

    expect(property.title).toBeNull();
    expect(property.area).toBeNull();
    expect(property.suites).toBeNull();
    expect(property.location).toEqual({
      address: null,
      number: null,
      complement: null,
      neighborhood: null,
      city: null,
      state: null,
      zipCode: null,
    });
    expect(property.features).toEqual([]);
    expect(property.source.pages).toEqual([]);
    expect(property.confidence).toEqual({ overall: null, fields: {} });
    expect(property.warnings).toEqual([]);
  });

  it('maps synonyms returned by the model', () => {
    expect(normalize({ type: 'Apartamento' }).type).toBe('apartment');
    expect(normalize({ type: 'galpão' }).type).toBe('commercial');
    expect(normalize({ transaction: 'locação' }).transaction).toBe('rent');
  });

  it('flags unmapped enumeration values', () => {
    const property = normalize({ type: 'castelo', transaction: 'permuta' });

    expect(property.type).toBeNull();
    expect(property.transaction).toBeNull();
    expect(property.warnings.map((warning) => warning.code)).toEqual([
      'UNMAPPED_VALUE',
      'UNMAPPED_VALUE',
    ]);
  });

  it('reports conflicting values returned by the model and lowers the field confidence', () => {
    const property = normalize(
      {
        confidence: 0.9,
        warnings: [
          {
            code: 'CONFLICTING_VALUE',
            message: 'Different area values were found in the document.',
            field: 'area',
            pages: [2, 5],
          },
        ],
      },
      5,
    );

    expect(property.warnings[0]).toEqual({
      code: 'CONFLICTING_AREA',
      message: 'Different area values were found in the document.',
      field: 'area',
      pages: [2, 5],
      propertyIndex: 0,
    });
    expect(property.confidence.fields.area).toBe(0.5);
    expect(property.confidence.fields.price).toBe(0.9);
  });

  it('warns when the model does not report any confidence', () => {
    const property = normalize({ confidence: null });

    expect(property.confidence.overall).toBeNull();
    expect(property.confidence.fields.price).toBe(0.8);
    expect(property.warnings).toEqual([
      expect.objectContaining({ code: 'MISSING_FIELD_CONFIDENCE', propertyIndex: 0 }),
    ]);
  });

  it('drops invalid numbers and invalid counts', () => {
    const property = normalize({ price: -10, bedrooms: -1, bathrooms: 2.4, suites: Number.NaN });

    expect(property.price).toBeNull();
    expect(property.bedrooms).toBeNull();
    expect(property.suites).toBeNull();
    expect(property.bathrooms).toBe(2);
    expect(property.warnings.map((warning) => warning.field)).toEqual([
      'price',
      'bedrooms',
      'suites',
      'bathrooms',
    ]);
    expect(property.warnings.at(-1)?.message).toContain('rounded');
  });

  it('clamps page references outside the document range', () => {
    const property = normalize({ sourcePages: [0, 1, 4, 9] }, 3);

    expect(property.source.pages).toEqual([1]);
    expect(property.warnings).toEqual([
      expect.objectContaining({ code: 'OUT_OF_RANGE_PAGE', pages: [4, 9] }),
    ]);
  });

  it('truncates long descriptions', () => {
    const property = normalize({ description: 'a'.repeat(5000) });

    expect(property.description).toHaveLength(4000);
  });
});
