// Picks the chat model provider for the analysis. Gemini's free tier when GEMINI_API_KEY
// is set, otherwise Apify's OpenRouter proxy (billed to Apify). Both speak the OpenAI API.

export type AiProvider = { name: 'gemini' | 'apify'; apiKey: string; baseURL: string; model: string };

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
export const APIFY_AI_BASE_URL = 'https://openrouter.apify.actor/api/v1';

export function aiProvider(env: { APIFY_TOKEN: string; GEMINI_API_KEY?: string; AI_MODEL?: string }): AiProvider {
  if (env.GEMINI_API_KEY) {
    return { name: 'gemini', apiKey: env.GEMINI_API_KEY, baseURL: GEMINI_BASE_URL, model: env.AI_MODEL ?? 'gemini-flash-latest' };
  }
  return { name: 'apify', apiKey: env.APIFY_TOKEN, baseURL: APIFY_AI_BASE_URL, model: env.AI_MODEL ?? 'openai/gpt-4.1-mini' };
}
