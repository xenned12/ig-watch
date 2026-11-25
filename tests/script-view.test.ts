import { describe, expect, it } from 'vitest';
import { beatParts, scriptCopyText, scriptVoiceover, wordCount } from '@/lib/script-view';
import type { Script } from '@/lib/types';

const full: Script = {
  name: 'The prompt fix',
  lengthS: 20,
  patterns: ['Bold claim hook'],
  hook: "You're prompting ChatGPT wrong.",
  beats: [
    { at: '0–3s', voiceover: "You're prompting ChatGPT wrong.", onScreen: 'STOP DOING THIS', direction: 'Close-up, point at camera.' },
    { at: '3–20s', voiceover: 'Give it a role, an example and a format. Save this.', onScreen: '', direction: 'Screen recording.' },
  ],
  cta: 'Save this.',
};

const legacy: Script = { ...full, beats: [{ at: '0–3s', text: 'Hook to camera.' }] };

describe('script view helpers', () => {
  it('beatParts passes full beats through', () =>
    expect(beatParts(full.beats[0])).toEqual({ at: '0–3s', voiceover: "You're prompting ChatGPT wrong.", onScreen: 'STOP DOING THIS', direction: 'Close-up, point at camera.', legacy: false }));
  it('beatParts maps a legacy beat to voiceover only', () =>
    expect(beatParts(legacy.beats[0])).toEqual({ at: '0–3s', voiceover: 'Hook to camera.', onScreen: '', direction: '', legacy: true }));
  it('wordCount counts words across the voiceover', () => {
    expect(wordCount('a b  c\nd')).toBe(4);
    expect(wordCount(scriptVoiceover(full))).toBe(15);
  });
  it('scriptVoiceover joins the spoken lines only', () =>
    expect(scriptVoiceover(full)).toBe("You're prompting ChatGPT wrong.\n\nGive it a role, an example and a format. Save this."));
  it('scriptCopyText includes timings, on-screen text and directions, skipping empty overlays', () =>
    expect(scriptCopyText(full)).toBe(
      "The prompt fix (20s)\n\n" +
        "[0–3s]\nVO: You're prompting ChatGPT wrong.\nON SCREEN: STOP DOING THIS\nSHOT: Close-up, point at camera.\n\n" +
        '[3–20s]\nVO: Give it a role, an example and a format. Save this.\nSHOT: Screen recording.',
    ));
});
