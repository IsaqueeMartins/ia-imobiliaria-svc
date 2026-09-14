import { Injectable } from '@nestjs/common';
import { AiPrompt } from './ai-prompt';
import { EXTRACTION_SYSTEM_INSTRUCTION } from './property-extraction.rules';

export interface PropertyExtractionPromptInput {
  readonly pageCount: number | null;
}

@Injectable()
export class PropertyExtractionPromptBuilder {
  build(input: PropertyExtractionPromptInput): AiPrompt {
    const pageCount = input.pageCount;
    const pageContext =
      typeof pageCount === 'number' && pageCount > 0
        ? ` O documento possui ${pageCount} página(s) numeradas de 1 a ${pageCount}.`
        : '';

    return {
      system: EXTRACTION_SYSTEM_INSTRUCTION,
      user: `Analise o documento PDF em anexo e extraia todos os imóveis presentes no documento inteiro, não apenas na primeira página.${pageContext} Use somente as informações contidas no documento e retorne o resultado no formato definido.`,
    };
  }
}
