import type { Message } from "../domain";
export type LiveEvent = {
  type: string;
  event_id?: string;
  delta?: string;
  start_ms?: number;
  end_ms?: number;
  session?: { id: string };
  delegation_id?: string;
  event?: {
    type?: string;
    response?: { id?: string };
    item?: {
      type?: string;
      call_id?: string;
      name?: string;
      arguments?: string;
    };
  };
};
type Fragment = {
  role: "user" | "assistant";
  text: string;
  start: number;
  end: number;
};
export type TranscriptState = {
  seen: Set<string>;
  fragments: Fragment[];
  messages: Message[];
};
export function emptyTranscript(): TranscriptState {
  return { seen: new Set(), fragments: [], messages: [] };
}
export function parseLiveEvent(raw: string): LiveEvent | null {
  try {
    const value = JSON.parse(raw);
    return value && typeof value.type === "string" ? value : null;
  } catch {
    return null;
  }
}
export function applyTranscript(
  current: TranscriptState,
  event: LiveEvent,
): TranscriptState {
  if (
    ![
      "session.input_transcript.delta",
      "session.output_transcript.delta",
    ].includes(event.type) ||
    typeof event.delta !== "string" ||
    !Number.isFinite(event.start_ms) ||
    !Number.isFinite(event.end_ms)
  )
    return current;
  if (event.event_id && current.seen.has(event.event_id)) return current;
  const seen = new Set(current.seen);
  if (event.event_id) seen.add(event.event_id);
  const fragment: Fragment = {
    role:
      event.type === "session.input_transcript.delta" ? "user" : "assistant",
    text: event.delta,
    start: event.start_ms!,
    end: event.end_ms!,
  };
  const fragments = [...current.fragments, fragment].sort(
    (a, b) => a.start - b.start,
  );
  const groups: {
    role: "user" | "assistant";
    start: number;
    end: number;
    content: string;
  }[] = [];
  for (const part of fragments) {
    const previous = groups.findLast((g) => g.role === part.role);
    if (
      previous &&
      part.start - previous.end < 1400 &&
      previous.content.length + part.text.length <= 2000
    ) {
      previous.content += part.text;
      previous.end = Math.max(previous.end, part.end);
    } else
      groups.push({
        role: part.role,
        start: part.start,
        end: part.end,
        content: part.text,
      });
  }
  return {
    seen,
    fragments,
    messages: groups
      .sort((a, b) => a.start - b.start)
      .filter((g) => g.content.trim())
      .map((g) => ({
        id: `voice-${g.role}-${g.start}`,
        role: g.role,
        content: g.content,
      })),
  };
}
