import { stripEmojis, stripHashtags } from '../../../shared/utils/text';

const AI_MENTION_PATTERN =
  /\b(intelig[êe]ncia artificial|ia generativa|gerado por ia|gerada por ia|assistente virtual|modelo de linguagem|chatbot|chat gpt|gpt-?\d?|gemini)\b/i;

const TITLE_PATTERN =
  /^(?:#{1,6}\s*)?(?:\*{1,2}|_{1,2})?\s*(descri[çc][ãa]o(?:\s+do\s+im[óo]vel)?|sobre\s+o\s+im[óo]vel|an[úu]ncio|im[óo]vel)\s*:?\s*(?:\*{1,2}|_{1,2})?$/i;

const TITLE_PREFIX_PATTERN =
  /^\s*(?:#{1,6}\s*)?(?:\*{1,2}|_{1,2})?\s*(?:descri[çc][ãa]o(?:\s+do\s+im[óo]vel)?|sobre\s+o\s+im[óo]vel|an[úu]ncio)\s*:\s*/i;

const HEADING_PATTERN = /^\s*#{1,6}\s*/;
const EMPHASIS_PATTERN = /(?:\*\*|__)(.+?)(?:\*\*|__)/g;
const BULLET_PATTERN = /^\s*(?:[-*•·–—]\s+|\d+[.)]\s+)/;
const SENTENCE_SPLIT = /(?<=[.!?])\s+/;

function cleanLine(line: string): string {
  const withoutHeading = line.replace(HEADING_PATTERN, '');
  const withoutEmphasis = withoutHeading.replace(EMPHASIS_PATTERN, '$1');
  const withoutBullet = withoutEmphasis.replace(BULLET_PATTERN, '');
  const withoutAiMentions = withoutBullet
    .split(SENTENCE_SPLIT)
    .filter((sentence) => !AI_MENTION_PATTERN.test(sentence))
    .join(' ');
  return withoutAiMentions.replace(/[ \t]+/g, ' ').trim();
}

export function sanitizeGeneratedDescription(raw: string): string {
  const withoutEmojis = stripEmojis(typeof raw === 'string' ? raw : '');
  const lines = stripHashtags(withoutEmojis).replace(/\r\n/g, '\n').split('\n');
  const cleaned = lines.map((line) => cleanLine(line));

  const firstContentIndex = cleaned.findIndex((line) => line.length > 0);
  if (firstContentIndex !== -1) {
    let index = firstContentIndex;
    while (
      index < cleaned.length &&
      (cleaned[index].length === 0 || TITLE_PATTERN.test(cleaned[index]))
    ) {
      if (TITLE_PATTERN.test(cleaned[index])) {
        cleaned.splice(index, 1);
        continue;
      }
      index += 1;
    }

    const contentIndex = cleaned.findIndex((line) => line.length > 0);
    if (contentIndex !== -1) {
      cleaned[contentIndex] = cleaned[contentIndex].replace(TITLE_PREFIX_PATTERN, '').trim();
    }
  }

  const text = cleaned
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (text.length > 1 && text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1).trim();
  }

  return text;
}
