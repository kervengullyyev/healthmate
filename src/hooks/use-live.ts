"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createLiveConnection, type LiveStatus } from "@/lib/live/connection";
import type { Message } from "@/lib/domain";
export function useLive(onTranscript: (messages: Message[]) => void) {
  const [status, setStatus] = useState<LiveStatus>("idle"),
    [error, setError] = useState(""),
    [speaking, setSpeaking] = useState(false),
    [muted, setMuted] = useState(false),
    [playbackBlocked, setPlaybackBlocked] = useState(false);
  const connection = useRef<ReturnType<typeof createLiveConnection> | null>(
    null,
  );
  const transcriptHandler = useRef(onTranscript);
  useEffect(() => {
    transcriptHandler.current = onTranscript;
  }, [onTranscript]);
  useEffect(
    () => () => {
      connection.current?.dispose();
    },
    [],
  );
  const start = useCallback(async () => {
    connection.current?.dispose();
    setError("");
    setMuted(false);
    const next = createLiveConnection({
      onStatus: setStatus,
      onError: setError,
      onSpeaking: setSpeaking,
      onTranscript: (messages) => transcriptHandler.current(messages),
      onPlaybackBlocked: setPlaybackBlocked,
    });
    connection.current = next;
    await next.start();
  }, []);
  const end = useCallback(async () => {
    await connection.current?.end();
    setMuted(false);
  }, []);
  const toggleMute = useCallback(() => {
    const value = !muted;
    connection.current?.mute(value);
    setMuted(value);
  }, [muted]);
  return {
    status,
    error,
    speaking,
    muted,
    playbackBlocked,
    start,
    end,
    toggleMute,
    playAudio: () => connection.current?.playAudio(),
  };
}
