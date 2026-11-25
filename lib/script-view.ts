import type { LegacyBeat, Script, ScriptBeat } from '@/lib/types';

export type BeatView = ScriptBeat & { legacy: boolean };

function isLegacy(b: ScriptBeat | LegacyBeat): b is LegacyBeat {
  return 'text' in b && !('voiceover' in b);
}

// Normalises a saved beat: older scripts only have a one-line `text` per beat.
export function beatParts(b: ScriptBeat | LegacyBeat): BeatView {
  if (isLegacy(b)) return { at: b.at, voiceover: b.text, onScreen: '', direction: '', legacy: true };
  return { at: b.at, voiceover: b.voiceover, onScreen: b.onScreen, direction: b.direction, legacy: false };
}

export const wordCount = (text: string): number => text.split(/\s+/).filter(Boolean).length;

// The spoken words only, one paragraph per beat.
export function scriptVoiceover(s: Script): string {
  return s.beats.map((b) => beatParts(b).voiceover.trim()).filter(Boolean).join('\n\n');
}

// Full shooting script: timings, voiceover, overlays and directions.
export function scriptCopyText(s: Script): string {
  const body = s.beats
    .map((raw) => {
      const b = beatParts(raw);
      const lines = [`[${b.at}]`, `VO: ${b.voiceover}`];
      if (b.onScreen.trim()) lines.push(`ON SCREEN: ${b.onScreen}`);
      if (b.direction.trim()) lines.push(`SHOT: ${b.direction}`);
      return lines.join('\n');
    })
    .join('\n\n');
  return `${s.name} (${s.lengthS}s)\n\n${body}`;
}
