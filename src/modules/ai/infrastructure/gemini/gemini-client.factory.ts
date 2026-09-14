import { GoogleGenAI } from '@google/genai';
import { AiSettings } from '../../../../shared/config/app-config.service';

export const GEMINI_CLIENT = Symbol('GEMINI_CLIENT');

export function createGeminiClient(settings: AiSettings): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: settings.googleApiKey,
    httpOptions: {
      timeout: settings.requestTimeoutMs,
      retryOptions: { attempts: 1 },
    },
  });
}
