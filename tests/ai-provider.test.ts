import { describe, it, expect } from 'vitest';
import { aiProvider, APIFY_AI_BASE_URL, GEMINI_BASE_URL } from '@/lib/pipeline/ai-provider';

describe('aiProvider', () => {
  it('uses Apify when no Gemini key is set', () => {
    expect(aiProvider({ APIFY_TOKEN: 'apify' })).toEqual({
      name: 'apify', apiKey: 'apify', baseURL: APIFY_AI_BASE_URL, model: 'openai/gpt-4.1-mini',
    });
  });
  it('uses Gemini when GEMINI_API_KEY is set', () => {
    expect(aiProvider({ APIFY_TOKEN: 'apify', GEMINI_API_KEY: 'g' })).toEqual({
      name: 'gemini', apiKey: 'g', baseURL: GEMINI_BASE_URL, model: 'gemini-flash-latest',
    });
  });
  it('lets AI_MODEL override the default model', () => {
    expect(aiProvider({ APIFY_TOKEN: 'a', GEMINI_API_KEY: 'g', AI_MODEL: 'gemini-2.5-flash-lite' }).model).toBe('gemini-2.5-flash-lite');
  });
});
