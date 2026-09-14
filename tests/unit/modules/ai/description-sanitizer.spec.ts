import { sanitizeGeneratedDescription } from '../../../../src/modules/ai/application/description-sanitizer';

describe('sanitizeGeneratedDescription', () => {
  it('keeps a well formed description untouched', () => {
    const description =
      'Apartamento de três dormitórios no Gonzaga, com varanda e piscina.\n\nO imóvel possui 120 m² e duas vagas de garagem.';

    expect(sanitizeGeneratedDescription(description)).toBe(description);
  });

  it('removes emojis and hashtags', () => {
    const description = sanitizeGeneratedDescription('Ótimo imóvel 🏠 #imperdível\nCom piscina ✨');

    expect(description).toBe('Ótimo imóvel\nCom piscina');
  });

  it('removes titles, headings and markdown emphasis', () => {
    const description = sanitizeGeneratedDescription(
      '**Descrição do imóvel:**\n## Sobre o imóvel\nApartamento bem localizado.',
    );

    expect(description).toBe('Apartamento bem localizado.');
  });

  it('removes sentences that mention artificial intelligence', () => {
    const description = sanitizeGeneratedDescription(
      'Apartamento amplo e iluminado. Este texto foi gerado por inteligência artificial. Pronto para morar.',
    );

    expect(description).toBe('Apartamento amplo e iluminado. Pronto para morar.');
  });

  it('strips bullet markers and collapses blank lines', () => {
    const description = sanitizeGeneratedDescription(
      '- Apartamento amplo\n- Piscina aquecida\n\n\n\n- Portaria 24 horas',
    );

    expect(description).toBe('Apartamento amplo\nPiscina aquecida\n\nPortaria 24 horas');
  });

  it('removes surrounding quotes and empty input', () => {
    expect(sanitizeGeneratedDescription('"Apartamento pronto para morar."')).toBe(
      'Apartamento pronto para morar.',
    );
    expect(sanitizeGeneratedDescription('   ')).toBe('');
  });
});
