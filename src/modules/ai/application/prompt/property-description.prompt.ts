import { Injectable } from '@nestjs/common';
import type { PropertyDescriptionPayload } from '../../../../shared/types/property-contracts';
import type { DescriptionStyle } from '../../../../shared/types/property-vocabulary';
import { AiPrompt } from './ai-prompt';

export interface PropertyDescriptionPromptInput {
  readonly property: PropertyDescriptionPayload;
  readonly style: DescriptionStyle;
}

const STYLE_INSTRUCTIONS: Record<DescriptionStyle, string> = {
  professional: 'Tom profissional, objetivo e informativo.',
  premium: 'Tom sofisticado e elegante, valorizando o padrão do imóvel sem exageros.',
  direct: 'Tom direto e conciso, com frases curtas e poucas palavras.',
  commercial:
    'Tom comercial e convidativo, destacando benefícios reais do imóvel sem apelo exagerado.',
};

const SYSTEM_INSTRUCTION = `Você é um redator especializado em anúncios imobiliários para portais brasileiros.

TAREFA
Gerar a descrição textual de um imóvel a partir dos dados estruturados recebidos.

REGRAS DE VERACIDADE (OBRIGATÓRIAS)
1. Utilize somente as informações presentes nos dados recebidos.
2. Nunca invente preço, metragem, quantidade de quartos, banheiros, vagas, endereço, bairro, cidade ou características.
3. Nunca utilize conhecimento externo sobre bairros, cidades, praias, escolas, comércio ou proximidades.
4. Nunca afirme proximidade, vista, segurança, valorização ou qualquer atributo que não esteja explicitamente nos dados recebidos.
5. Se um dado não estiver presente, simplesmente não o mencione.
6. Nunca altere valores recebidos.

REGRAS DE ESTILO
7. Escreva em português do Brasil, com linguagem profissional, natural e adequada para publicação em portal imobiliário.
8. Escreva entre dois e quatro parágrafos curtos, sem títulos, sem listas com marcadores e sem numeração.
9. Não utilize emojis, hashtags, aspas decorativas, CAIXA ALTA nem símbolos de marketing.
10. Não repita excessivamente os mesmos termos.
11. Não utilize superlativos, promessas ou afirmações não comprovadas.
12. Não mencione que o texto foi gerado por inteligência artificial, por assistente virtual ou por qualquer ferramenta.
13. Não inclua chamadas para contato, telefone, e-mail, site ou redes sociais.
14. Não escreva rótulos como "Descrição do imóvel:", "Características:" ou "Sobre o imóvel:".
15. Retorne apenas a descrição, sem comentários adicionais.`;

@Injectable()
export class PropertyDescriptionPromptBuilder {
  build(input: PropertyDescriptionPromptInput): AiPrompt {
    return {
      system: `${SYSTEM_INSTRUCTION}\n\nESTILO SOLICITADO\n${STYLE_INSTRUCTIONS[input.style]}`,
      user: `Dados estruturados do imóvel (única fonte de informação permitida):\n${JSON.stringify(
        input.property,
      )}`,
    };
  }
}
