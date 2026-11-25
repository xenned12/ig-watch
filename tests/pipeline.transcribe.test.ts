import { describe, expect, it, vi } from "vitest";
import { transcribePost } from "@/lib/pipeline/transcribe";
import type { NewPost } from "@/lib/store/types";
import { fakeDeps, type FakeDeps } from "./fakes";

const mkPost = (
  n: number,
  videoUrl: string | null = "https://v/" + n,
): NewPost => ({
  handle: "alpha",
  isClient: false,
  igUrl: "https://ig/" + n,
  postedAt: "2026-11-01T00:00:00Z",
  views: 100,
  likes: 10,
  comments: 1,
  durationS: 20,
  rankMetric: "views",
  rank: n,
  videoUrl,
  caption: "caption " + n,
});

async function setup(
  count = 1,
  overrides: Partial<FakeDeps> = {},
  videoUrl: string | null = "https://v/x",
) {
  const d = fakeDeps(overrides);
  const run = await d.store.createRun({
    niche: "AI",
    clientHandle: "me",
    competitorHandles: ["alpha"],
  });
  const posts = await d.store.replacePosts(
    run.id,
    Array.from({ length: count }, (_, i) => mkPost(i + 1, videoUrl)),
  );
  await d.store.updateRun(run.id, {
    status: "transcribing",
    remaining: posts.length,
  });
  return { d, runId: run.id, ids: posts.map((p) => p.id), posts };
}

const transcriptOf = async (d: FakeDeps, runId: string, id: string) =>
  (await d.store.listTranscripts(runId)).find((t) => t.postId === id);

const whisperOk = () =>
  vi
    .fn()
    .mockResolvedValue({ text: "hi", segments: [{ start: 0, text: "hi" }] });

describe("transcribePost", () => {
  it("saves a whisper transcript with segments", async () => {
    const transcribe = whisperOk();
    const { d, runId, ids } = await setup(1, {
      ai: {
        transcribe,
        json: async () => {
          throw new Error("x");
        },
      },
    });
    await transcribePost(d, ids[0]);
    expect(await transcriptOf(d, runId, ids[0])).toEqual({
      postId: ids[0],
      text: "hi",
      segments: [{ startS: 0, text: "hi" }],
      source: "whisper",
    });
    expect(transcribe).toHaveBeenCalledWith("https://ig/1");
  });

  it("falls back to caption after one retry when transcription fails", async () => {
    const transcribe = vi.fn().mockRejectedValue(new Error("403"));
    const { d, runId, ids, posts } = await setup(1, {
      ai: {
        transcribe,
        json: async () => {
          throw new Error("x");
        },
      },
    });
    await transcribePost(d, ids[0]);
    expect(transcribe).toHaveBeenCalledTimes(2);
    expect(await transcriptOf(d, runId, ids[0])).toEqual({
      postId: ids[0],
      text: posts[0].caption,
      segments: [],
      source: "caption",
    });
  });

  it("uses the caption when whisper returns empty text", async () => {
    const transcribe = vi.fn().mockResolvedValue({ text: "  ", segments: [] });
    const { d, runId, ids } = await setup(1, {
      ai: {
        transcribe,
        json: async () => {
          throw new Error("x");
        },
      },
    });
    await transcribePost(d, ids[0]);
    expect(transcribe).toHaveBeenCalledTimes(1);
    expect((await transcriptOf(d, runId, ids[0]))?.source).toBe("caption");
  });

  it("uses the caption without transcribing when there is no video url", async () => {
    const transcribe = vi.fn();
    const { d, runId, ids } = await setup(1, { ai: { transcribe, json: async () => { throw new Error("x"); } } }, null);
    await transcribePost(d, ids[0]);
    expect(transcribe).not.toHaveBeenCalled();
    expect((await transcriptOf(d, runId, ids[0]))?.source).toBe("caption");
  });

  it("retries once and succeeds when whisper throws the first time", async () => {
    const transcribe = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue({ text: "ok", segments: [] });
    const { d, runId, ids } = await setup(1, {
      ai: {
        transcribe,
        json: async () => {
          throw new Error("x");
        },
      },
    });
    await transcribePost(d, ids[0]);
    expect(transcribe).toHaveBeenCalledTimes(2);
    expect((await transcriptOf(d, runId, ids[0]))?.source).toBe("whisper");
  });

  it("a duplicate job does not decrement twice", async () => {
    const { d, runId, ids } = await setup(3);
    const before = (await d.store.getRun(runId))!.remaining;
    await transcribePost(d, ids[0]);
    await transcribePost(d, ids[0]);
    expect((await d.store.getRun(runId))!.remaining).toBe(before - 1);
  });

  it("ignores jobs when the run is not transcribing", async () => {
    const { d, runId, ids } = await setup(1);
    await d.store.updateRun(runId, { status: "failed" });
    await transcribePost(d, ids[0]);
    expect(await d.store.listTranscripts(runId)).toHaveLength(0);
  });

  it("the last post moves the run to analyzing and sends exactly one analyze job", async () => {
    const { d, runId, ids } = await setup(5);
    await Promise.all(ids.map((id) => transcribePost(d, id)));
    expect(d.sent.filter((j) => j.path === "/api/jobs/analyze")).toEqual([
      { path: "/api/jobs/analyze", body: { runId } },
    ]);
    const run = (await d.store.getRun(runId))!;
    expect(run.status).toBe("analyzing");
    expect(run.remaining).toBe(0);
  });

  it("a duplicate delivery of the last post still sends one analyze job", async () => {
    const { d, runId, ids } = await setup(2);
    await Promise.all([...ids, ...ids].map((id) => transcribePost(d, id)));
    expect(d.sent.filter((j) => j.path === "/api/jobs/analyze")).toHaveLength(
      1,
    );
    expect((await d.store.getRun(runId))!.remaining).toBe(0);
  });

  it("fails the run when the analyze job cannot be sent", async () => {
    const sendJob = vi.fn().mockRejectedValue(new Error("down"));
    const { d, runId, ids } = await setup(1, { sendJob });
    await transcribePost(d, ids[0]);
    const msg = "Could not start the analysis. Retry the failed step.";
    expect(await d.store.getRun(runId)).toMatchObject({
      status: "failed",
      failedStep: "analyze",
      error: msg,
    });
    expect(d.events).toContainEqual({ step: "failed", message: msg });
  });

  it("emits transcribed/total progress", async () => {
    const { d, ids } = await setup(19);
    await transcribePost(d, ids[0]);
    expect(d.events).toContainEqual({
      step: "transcribe",
      transcribed: 1,
      total: 19,
      message: "Transcribed 1/19",
    });
  });
});
