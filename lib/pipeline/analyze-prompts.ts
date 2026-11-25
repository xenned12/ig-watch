import { z } from 'zod';

export const PATTERNS_SYSTEM =
  'You analyze short-form video transcripts. Find 3–8 patterns shared by the top-performing competitor reels: hook style in the first 2 seconds, topic, structure, length, call to action, tone. For each pattern give competitorCount: on average, how many of each competitor\'s top 10 reels show it (0–10). List the post ids that show it. Use only post ids from the input.';

export const COMPARE_SYSTEM =
  'Compare the client\'s reels with these competitor patterns. Score each pattern 0–10 for the client using the same names. List 2–6 differences, each marked gap (to fix) or keep (a strength). Write 3–5 short recommendations; each must cite the id of the one competitor reel that best shows it. Write 3 scripts in the client\'s own voice (match their wording and story style), 15–60 seconds, each with a hook, a call to action and the pattern names it uses. Each script must be complete and word for word for its whole length, ready to read on camera: split it into 4–8 timed beats that run back to back from 0s to lengthS with no gaps (for example "0–3s", "3–9s"). For each beat give voiceover (the exact words spoken, about 2.5 words per second of the beat, never a summary), onScreen (the text overlay, or an empty string) and direction (one short filming note, such as the shot or what to show). The first beat\'s voiceover is the hook and the last beat\'s voiceover ends with the call to action.';

export const PatternsOut = z.object({
  patterns: z
    .array(
      z.object({
        name: z.string(),
        competitorCount: z.number().int().min(0).max(10),
        postIds: z.array(z.string()),
      }),
    )
    .min(3)
    .max(8),
});

export const ScriptZ = z.object({
  name: z.string(),
  lengthS: z.number().min(15).max(60),
  patterns: z.array(z.string()),
  hook: z.string(),
  beats: z
    .array(z.object({ at: z.string(), voiceover: z.string(), onScreen: z.string(), direction: z.string() }))
    .min(2)
    .max(10),
  cta: z.string(),
});

export const CompareOut = z.object({
  clientCounts: z.array(
    z.object({ name: z.string(), clientCount: z.number().int().min(0).max(10) }),
  ),
  gaps: z
    .array(z.object({ text: z.string(), kind: z.enum(['gap', 'keep']) }))
    .min(2)
    .max(6),
  recommendations: z
    .array(z.object({ text: z.string(), reason: z.string(), postId: z.string() }))
    .min(3)
    .max(5),
  scripts: z.array(ScriptZ).length(3),
});
