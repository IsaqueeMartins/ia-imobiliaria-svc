import {
  propertyDescriptionRequestSchema,
  hasMeaningfulPropertyData,
} from '../../../../src/shared/types/property-contracts';

describe('property description request schema', () => {
  it('accepts the documented payload with string numbers', () => {
    const parsed = propertyDescriptionRequestSchema.parse({
      property: {
        type: 'apartment',
        transaction: 'sale',
        price: 'R$ 750.000,00',
        area: '120 m²',
        bedrooms: '3',
        city: 'Santos',
        neighborhood: 'Gonzaga',
        features: ['varanda', 'piscina'],
      },
    });

    expect(parsed.property.price).toBe(750000);
    expect(parsed.property.area).toBe(120);
    expect(parsed.property.bedrooms).toBe(3);
    expect(parsed.style).toBe('professional');
  });

  it('rejects unknown fields', () => {
    const result = propertyDescriptionRequestSchema.safeParse({
      property: { city: 'Santos', invented: true },
    });

    expect(result.success).toBe(false);
  });

  it('requires at least one meaningful field', () => {
    expect(propertyDescriptionRequestSchema.safeParse({ property: {} }).success).toBe(false);
    expect(
      propertyDescriptionRequestSchema.safeParse({ property: { features: [], city: '   ' } })
        .success,
    ).toBe(false);
    expect(hasMeaningfulPropertyData({ city: 'Santos' })).toBe(true);
    expect(hasMeaningfulPropertyData({ features: ['piscina'] })).toBe(true);
    expect(hasMeaningfulPropertyData({ location: { city: null } })).toBe(false);
  });

  it('rejects invalid numeric values and unsupported enum values', () => {
    expect(
      propertyDescriptionRequestSchema.safeParse({ property: { price: 'sob consulta' } }).success,
    ).toBe(false);
    expect(propertyDescriptionRequestSchema.safeParse({ property: { price: -1 } }).success).toBe(
      false,
    );
    expect(
      propertyDescriptionRequestSchema.safeParse({ property: { type: 'castelo' } }).success,
    ).toBe(false);
    expect(
      propertyDescriptionRequestSchema.safeParse({ property: { style: 'fancy' } }).success,
    ).toBe(false);
  });

  it('accepts both flat and nested location fields', () => {
    const parsed = propertyDescriptionRequestSchema.parse({
      property: {
        location: { city: 'Santos', neighborhood: 'Gonzaga' },
      },
      style: 'premium',
    });

    expect(parsed.property.location?.city).toBe('Santos');
    expect(parsed.style).toBe('premium');
  });
});
