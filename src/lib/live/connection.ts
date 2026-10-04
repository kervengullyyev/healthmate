import { applyTranscript, emptyTranscript, parseLiveEvent } from "./events";
import type { Message } from "../domain";
export type LiveStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "ending"
  | "ended"
  | "error";
type Callbacks = {
  onStatus: (status: LiveStatus) => void;
  onError: (message: string) => void;
  onTranscript: (messages: Message[]) => void;
  onSpeaking: (value: boolean) => void;
  onPlaybackBlocked?: (value: boolean) => void;
};
export function createLiveConnection(callbacks: Callbacks) {
  let peer: RTCPeerConnection | null = null,
    channel: RTCDataChannel | null = null,
    microphone: MediaStream | null = null,
    audio: HTMLAudioElement | null = null;
  let context: AudioContext | null = null,
    frame = 0,
    generation = 0,
    active = false,
    ready = false,
    finalised = false;
  let startupTimer: ReturnType<typeof setTimeout> | undefined,
    closeTimer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | null = null,
    resolveStarted: (() => void) | null = null,
    resolveClosed: (() => void) | null = null;
  let closePromise: Promise<void> | null = null,
    transcript = emptyTranscript();
  function cleanup() {
    active = false;
    ready = false;
    generation++;
    clearTimeout(startupTimer);
    clearTimeout(closeTimer);
    controller?.abort();
    microphone?.getTracks().forEach((track) => track.stop());
    microphone = null;
    channel?.close();
    channel = null;
    peer?.close();
    peer = null;
    if (audio) {
      audio.pause();
      audio.srcObject = null;
    }
    audio = null;
    if (frame && typeof cancelAnimationFrame !== "undefined")
      cancelAnimationFrame(frame);
    void context?.close();
    context = null;
    callbacks.onSpeaking(false);
    callbacks.onPlaybackBlocked?.(false);
    resolveStarted?.();
    resolveStarted = null;
    resolveClosed?.();
    resolveClosed = null;
  }
  function fail(message: string) {
    callbacks.onError(message);
    cleanup();
    callbacks.onStatus("error");
  }
  function monitor(stream: MediaStream) {
    if (typeof AudioContext === "undefined") return;
    try {
      context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const measure = () => {
        if (!active || !context) return;
        analyser.getByteTimeDomainData(data);
        callbacks.onSpeaking(
          Math.sqrt(
            data.reduce((sum, v) => sum + ((v - 128) / 128) ** 2, 0) /
              data.length,
          ) > 0.015,
        );
        frame = requestAnimationFrame(measure);
      };
      measure();
    } catch {
      /* Audio playback still works when analysis is unavailable. */
    }
  }
  async function playAudio() {
    try {
      await audio?.play();
      await context?.resume();
      callbacks.onPlaybackBlocked?.(false);
    } catch {
      callbacks.onPlaybackBlocked?.(true);
    }
  }
  async function start() {
    if (active) return;
    active = true;
    ready = false;
    finalised = false;
    closePromise = null;
    transcript = emptyTranscript();
    const token = ++generation;
    callbacks.onStatus("connecting");
    startupTimer = setTimeout(
      () => fail("Voice connection timed out. End the call and try again."),
      45000,
    );
    try {
      if (
        typeof RTCPeerConnection === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      )
        throw new Error(
          "Voice needs a supported browser on HTTPS or localhost. You can type instead.",
        );
      const connection = new RTCPeerConnection();
      peer = connection;
      audio = new Audio();
      audio.autoplay = true;
      connection.addEventListener("track", (event) => {
        if (!active) return;
        const remote = new MediaStream([event.track]);
        if (audio) audio.srcObject = remote;
        monitor(remote);
        void playAudio();
      });
      connection.addEventListener("connectionstatechange", () => {
        if (
          active &&
          ["failed", "disconnected"].includes(connection.connectionState)
        )
          fail(
            "Voice disconnected. Your transcript is preserved. Start a new call to continue.",
          );
      });
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (token !== generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      microphone = stream;
      for (const track of stream.getAudioTracks())
        connection.addTrack(track, stream);
      const events = connection.createDataChannel("oai-events");
      channel = events;
      events.addEventListener("message", ({ data }) => {
        if (!active) return;
        const event = parseLiveEvent(data);
        if (!event) return;
        if (event.type === "session.started") {
          ready = true;
          clearTimeout(startupTimer);
          callbacks.onStatus("listening");
          resolveStarted?.();
          resolveStarted = null;
        } else if (event.type === "session.closed") {
          finalised = true;
          cleanup();
          callbacks.onStatus("ended");
        } else if (event.type === "error") {
          fail(
            "The voice service could not complete that operation. Please end the call and try again.",
          );
        } else {
          transcript = applyTranscript(transcript, event);
          callbacks.onTranscript(transcript.messages);
        }
      });
      events.addEventListener("close", () => {
        if (active && !finalised)
          fail(
            "Voice disconnected before finalisation. Your transcript is preserved.",
          );
      });
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      if (connection.iceGatheringState !== "complete")
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            connection.removeEventListener("icegatheringstatechange", changed);
            reject(new Error("Connection setup timed out. Please try again."));
          }, 10000);
          const changed = () => {
            if (connection.iceGatheringState === "complete") {
              clearTimeout(timeout);
              connection.removeEventListener(
                "icegatheringstatechange",
                changed,
              );
              resolve();
            }
          };
          connection.addEventListener("icegatheringstatechange", changed);
          changed();
        });
      if (token !== generation) return;
      controller = new AbortController();
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdp: connection.localDescription?.sdp }),
        signal: controller.signal,
      });
      if (token !== generation) return;
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error || "Voice could not connect. Please try again.",
        );
      if (typeof result.transport?.sdp !== "string")
        throw new Error("The voice connection returned an invalid answer.");
      const started = new Promise<void>((resolve) => {
        resolveStarted = resolve;
      });
      await connection.setRemoteDescription({
        type: "answer",
        sdp: result.transport.sdp,
      });
      await started;
    } catch (error) {
      if (token !== generation) return;
      const permission =
        error instanceof DOMException && error.name === "NotAllowedError";
      fail(
        permission
          ? "Microphone access was denied. Allow microphone access in your browser, or type instead."
          : error instanceof Error
            ? error.message
            : "Voice could not connect. Please try again.",
      );
    }
  }
  function mute(value: boolean) {
    microphone?.getAudioTracks().forEach((track) => {
      track.enabled = !value;
    });
  }
  async function end(): Promise<void> {
    if (closePromise) return closePromise;
    if (!ready || !channel || channel.readyState !== "open") {
      cleanup();
      callbacks.onStatus("ended");
      return;
    }
    mute(true);
    callbacks.onStatus("ending");
    closePromise = new Promise<void>((resolve) => {
      resolveClosed = resolve;
    });
    closeTimer = setTimeout(
      () =>
        fail(
          "Voice ended without a final session acknowledgment. The microphone has been released.",
        ),
      15000,
    );
    channel.send(
      JSON.stringify({ type: "session.close", event_id: crypto.randomUUID() }),
    );
    return closePromise;
  }
  function dispose() {
    if (ready) {
      microphone?.getTracks().forEach((track) => track.stop());
      void end();
    } else cleanup();
  }
  return { start, mute, end, dispose, playAudio };
}
