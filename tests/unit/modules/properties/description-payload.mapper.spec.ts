import { buildDescriptionPayload } from '../../../../src/modules/properties/application/description-payload.mapper';

describe('buildDescriptionPayload', () => {
  it('keeps only meaningful values', () => {
    const payload = buildDescriptionPayload({
      title: '  Apartamento no Gonzaga  ',
      type: 'apartment',
      transaction: 'sale',
      price: 750000,
      area: null,
      city: 'Santos',
      neighborhood: '   ',
      zipCode: '11065000',
      state: 'São Paulo',
    });

    expect(payload).toEqual({
      title: 'Apartamento no Gonzaga',
      type: 'apartment',
      transaction: 'sale',
      price: 750000,
      city: 'Santos',
      zipCode: '11065-000',
      state: 'SP',
    });
  });

  it('merges nested location fields without overwriting flat ones', () => {
    const payload = buildDescriptionPayload({
      city: 'Santos',
      location: { city: 'Praia Grande', neighborhood: 'Gonzaga', address: 'Rua A' },
    });

    expect(payload.city).toBe('Santos');
    expect(payload.neighborhood).toBe('Gonzaga');
    expect(payload.address).toBe('Rua A');
    expect(payload.location).toBeUndefined();
  });

  it('sanitizes features and removes duplicates', () => {
    const payload = buildDescriptionPayload({
      features: ['Varanda', 'varanda', 'www.imobiliaria.com.br', 'piscina'],
    });

    expect(payload.features).toEqual(['varanda', 'piscina']);
  });

  it('returns an empty payload for empty input', () => {
    expect(buildDescriptionPayload({})).toEqual({});
  });
});
