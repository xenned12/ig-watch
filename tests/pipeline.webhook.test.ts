import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { handleApifyDone } from "@/lib/pipeline/webhook";
import { fakeDeps } from "./fakes";

const items: unknown[] = JSON.parse(
  readFileSync(new URL("./fixtures/apify-items.json", import.meta.url), "utf8"),
);
const p = (runId: string, eventType = "ACTOR.RUN.SUCCEEDED") => ({
  runId,
  eventType,
  apifyRunId: "apify-1",
});

async function setup(client: string, competitors: string[]) {
  const d = fakeDeps({
    apify: {
      async start() {
        return "apify-1";
      },
      async items() {
        return items;
      },
    },
  });
  const run = await d.store.createRun({
    niche: "AI",
    clientHandle: client,
    competitorHandles: competitors,
  });
  return { d, runId: run.id };
}

describe("handleApifyDone", () => {
  it("stores ranked posts, sets remaining, sends one transcribe job per post", async () => {
    const { d, runId } = await setup("me", ["alpha", "beta", "delta"]);
    await handleApifyDone(d, p(runId));
    expect(await d.store.getRun(runId)).toMatchObject({
      status: "transcribing",
      remaining: 19,
      videosFound: { alpha: 12, beta: 4, delta: 3, me: 2 },
    });
    const jobs = d.sent.filter((j) => j.path === "/api/jobs/transcribe");
    expect(jobs).toHaveLength(19);
    const ids = new Set((await d.store.listPosts(runId)).map((x) => x.id));
    expect(
      new Set(jobs.map((j) => (j.body as { postId: string }).postId)),
    ).toEqual(ids);
    expect(d.events.map((e) => e.step)).toEqual(["fetch", "rank"]);
  });

  it("is idempotent when apify delivers twice", async () => {
    const { d, runId } = await setup("me", ["alpha", "beta", "delta"]);
    await handleApifyDone(d, p(runId));
    await handleApifyDone(d, p(runId));
    expect(d.sent).toHaveLength(19);
    expect(await d.store.listPosts(runId)).toHaveLength(19);
  });

  it("fails at fetch when fewer than 3 competitors are usable", async () => {
    const { d, runId } = await setup("me", ["alpha", "gamma", "zeta"]);
    await handleApifyDone(d, p(runId));
    expect(await d.store.getRun(runId)).toMatchObject({
      status: "failed",
      failedStep: "fetch",
      error:
        "Not enough usable accounts. Skipped: @gamma (Account not found or private), @zeta (No video posts in the last 90 days). Add other competitors and try again.",
    });
    expect(d.sent).toHaveLength(0);
    expect(d.events.at(-1)?.step).toBe("failed");
  });

  it("fails at fetch when the client has no videos", async () => {
    const { d, runId } = await setup("zeta", ["alpha", "beta", "delta"]);
    await handleApifyDone(d, p(runId));
    expect(await d.store.getRun(runId)).toMatchObject({
      status: "failed",
      failedStep: "fetch",
      error: "Your client @zeta has no video posts in the last 90 days.",
    });
    expect(d.sent).toHaveLength(0);
  });

  it("fails at fetch on ACTOR.RUN.FAILED", async () => {
    const { d, runId } = await setup("me", ["alpha", "beta", "delta"]);
    await handleApifyDone(d, p(runId, "ACTOR.RUN.FAILED"));
    expect(await d.store.getRun(runId)).toMatchObject({
      status: "failed",
      failedStep: "fetch",
      error: "Fetching posts from Instagram failed. Retry the failed step.",
    });
    expect(d.sent).toHaveLength(0);
  });

  it("fails at fetch when reading items throws", async () => {
    const { d, runId } = await setup("me", ["alpha", "beta", "delta"]);
    d.apify.items = async () => {
      throw new Error("boom");
    };
    await handleApifyDone(d, p(runId));
    expect(await d.store.getRun(runId)).toMatchObject({
      status: "failed",
      failedStep: "fetch",
      error: "Fetching posts from Instagram failed. Retry the failed step.",
    });
  });

  it("does not fail the run when some jobs cannot be sent", async () => {
    const { d, runId } = await setup("me", ["alpha", "beta", "delta"]);
    let n = 0;
    d.sendJob = async () => {
      if (n++ === 0) throw new Error("down");
    };
    await handleApifyDone(d, p(runId));
    expect(await d.store.getRun(runId)).toMatchObject({
      status: "transcribing",
      remaining: 19,
    });
    expect(d.events.at(-1)).toEqual({
      step: "transcribe",
      message:
        "Some transcription jobs could not be started. Use retry if the run stalls.",
    });
  });

  it("ignores an invalid payload and an unknown run without throwing", async () => {
    const { d, runId } = await setup("me", ["alpha", "beta", "delta"]);
    await expect(handleApifyDone(d, {})).resolves.toBeUndefined();
    await expect(
      handleApifyDone(d, p("00000000-0000-4000-8000-000000000000")),
    ).resolves.toBeUndefined();
    expect(await d.store.getRun(runId)).toMatchObject({ status: "fetching" });
    expect(d.sent).toHaveLength(0);
    expect(d.events).toHaveLength(0);
  });
});
