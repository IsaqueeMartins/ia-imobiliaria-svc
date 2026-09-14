import { PropertyDescriptionPromptBuilder } from '../../../../src/modules/ai/application/prompt/property-description.prompt';
import { PropertyExtractionPromptBuilder } from '../../../../src/modules/ai/application/prompt/property-extraction.prompt';

describe('extraction prompt', () => {
  const prompt = new PropertyExtractionPromptBuilder().build({ pageCount: 12 });

  it('instructs the model to never invent data', () => {
    expect(prompt.system).toContain('Nunca invente informação');
    expect(prompt.system).toContain('Nunca infira preço');
    expect(prompt.system).toContain('Nunca utilize conhecimento externo');
    expect(prompt.system).toContain('retorne null');
  });

  it('warns that one page is not one property', () => {
    expect(prompt.system).toContain('Nunca assuma que uma página equivale a um imóvel');
    expect(prompt.system).toContain('Um imóvel pode ocupar várias páginas');
  });

  it('instructs the model to ignore institutional content and watermarks', () => {
    expect(prompt.system).toContain('marcas d\u2019água'.replace('\u2019', "'"));
    expect(prompt.system).toContain('CRECI');
    expect(prompt.system).toContain('Nunca inclua dados institucionais');
  });

  it('requests conflict reporting, confidence and source pages', () => {
    expect(prompt.system).toContain('CONFLICTING_VALUE');
    expect(prompt.system).toContain('sourcePages');
    expect(prompt.system).toContain('confidence');
  });

  it('includes the document size in the user message', () => {
    expect(prompt.user).toContain('12 página');
    expect(new PropertyExtractionPromptBuilder().build({ pageCount: null }).user).not.toContain(
      'página(s)',
    );
  });
});

describe('description prompt', () => {
  const builder = new PropertyDescriptionPromptBuilder();

  it('forbids invention and external knowledge', () => {
    const prompt = builder.build({
      property: { city: 'Santos', neighborhood: 'Gonzaga' },
      style: 'professional',
    });

    expect(prompt.system).toContain('Utilize somente as informações presentes');
    expect(prompt.system).toContain('Nunca utilize conhecimento externo');
    expect(prompt.system).toContain(
      'Não mencione que o texto foi gerado por inteligência artificial',
    );
    expect(prompt.system).toContain('Não utilize emojis, hashtags');
  });

  it('injects the requested style and the property payload', () => {
    const prompt = builder.build({ property: { area: 120 }, style: 'direct' });

    expect(prompt.system).toContain('Tom direto e conciso');
    expect(prompt.user).toContain('{"area":120}');
  });
});
