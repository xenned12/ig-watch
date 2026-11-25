import type { Deps } from "@/lib/pipeline/deps";
import type { Post, Transcript } from "@/lib/types";

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_ATTEMPTS = 2;
const ANALYZE_START_FAILED =
  "Could not start the analysis. Retry the failed step.";

function captionTranscript(post: Post): Transcript {
  return {
    postId: post.id,
    text: post.caption,
    segments: [],
    source: "caption",
  };
}

async function whisperTranscript(
  deps: Deps,
  post: Post,
  videoUrl: string,
): Promise<Transcript> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const blob = await deps.fetchVideo(videoUrl);
      if (blob.size > MAX_BYTES) return captionTranscript(post);
      const res = await deps.openai.transcribe(blob, `${post.id}.mp4`);
      if (res.text.trim() === "") return captionTranscript(post);
      return {
        postId: post.id,
        text: res.text,
        segments: res.segments.map((s) => ({ startS: s.start, text: s.text })),
        source: "whisper",
      };
    } catch {
      // retry once, then fall back to the caption
    }
  }
  return captionTranscript(post);
}

async function decide(deps: Deps, post: Post): Promise<Transcript> {
  if (post.videoUrl === null) return captionTranscript(post);
  try {
    return await whisperTranscript(deps, post, post.videoUrl);
  } catch {
    return captionTranscript(post);
  }
}

async function startAnalysis(deps: Deps, runId: string): Promise<void> {
  const moved = await deps.store.transitionRun(runId, "transcribing", {
    status: "analyzing",
  });
  if (!moved) return;
  try {
    await deps.progress.emit(runId, {
      step: "analyze",
      message: "Comparing transcripts",
    });
    await deps.sendJob("/api/jobs/analyze", { runId });
  } catch {
    await deps.store.updateRun(runId, {
      status: "failed",
      failedStep: "analyze",
      error: ANALYZE_START_FAILED,
    });
    await deps.progress.emit(runId, {
      step: "failed",
      message: ANALYZE_START_FAILED,
    });
  }
}

export async function transcribePost(
  deps: Deps,
  postId: string,
): Promise<void> {
  const { store, progress } = deps;
  const post = await store.getPost(postId);
  if (!post) return;
  const run = await store.getRun(post.runId);
  if (!run || run.status !== "transcribing") return;

  const transcript = await decide(deps, post);
  const isNew = await store.saveTranscriptOnce(transcript);
  if (!isNew) return;

  const remaining = await store.decrementRemaining(post.runId);
  const total = (await store.listPosts(post.runId)).length;
  const transcribed = total - remaining;
  await progress.emit(post.runId, {
    step: "transcribe",
    message: `Transcribed ${transcribed}/${total}`,
    transcribed,
    total,
  });
  if (remaining === 0) await startAnalysis(deps, post.runId);
}
