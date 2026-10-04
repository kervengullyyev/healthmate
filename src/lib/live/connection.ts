import {
  applyTranscript,
  emptyTranscript,
  parseLiveEvent,
  type LiveEvent,
} from "./events";
import { createAppointmentTools } from "./appointment-tools";
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
  type FunctionCall = { callId: string; name: string; arguments: string };
  const batches = new Map<
    string,
    { responseId: string; calls: FunctionCall[] }
  >();
  const results = new Map<
    string,
    { call: FunctionCall; output: Record<string, unknown> }
  >();
  let appointmentTools = createAppointmentTools();
  // GPT-Live forwards Responses events in an envelope. Calls are collected
  // from output_item.done; completed.output is intentionally empty.
  // https://developers.openai.com/api/docs/guides/live-delegation
  function handleTools(envelope: LiveEvent) {
    if (envelope.type !== "response.event") return false;
    if (!ready || closePromise || !channel || channel.readyState !== "open")
      return true;
    const key = envelope.delegation_id,
      event = envelope.event;
    if (typeof key !== "string" || !event) return true;
    if (
      event.type === "response.created" &&
      typeof event.response?.id === "string"
    ) {
      batches.set(key, { responseId: event.response.id, calls: [] });
    } else if (event.type === "response.output_item.done") {
      const batch = batches.get(key),
        item = event.item;
      if (
        batch &&
        item?.type === "function_call" &&
        typeof item.call_id === "string" &&
        typeof item.name === "string" &&
        typeof item.arguments === "string" &&
        !batch.calls.some((call) => call.callId === item.call_id)
      ) {
        batch.calls.push({
          callId: item.call_id,
          name: item.name,
          arguments: item.arguments,
        });
      }
    } else if (event.type === "response.completed") {
      const batch = batches.get(key);
      if (!batch || batch.responseId !== event.response?.id) return true;
      batches.delete(key);
      for (const call of batch.calls) {
        const previous = results.get(call.callId);
        const output = previous
          ? previous.call.name === call.name &&
            previous.call.arguments === call.arguments
            ? previous.output
            : {
                status: "error",
                message: "A repeated function call changed its arguments.",
              }
          : appointmentTools.run(call.name, call.arguments, transcript);
        if (!previous) results.set(call.callId, { call, output });
        channel.send(
          JSON.stringify({
            type: "response.item.create",
            event_id: crypto.randomUUID(),
            item: {
              type: "function_call_output",
              call_id: call.callId,
              output: JSON.stringify(output),
            },
          }),
        );
      }
      if (batch.calls.length)
        channel.send(
          JSON.stringify({
            type: "response.create",
            event_id: crypto.randomUUID(),
          }),
        );
    } else if (
      event.type === "response.failed" ||
      event.type === "response.cancelled"
    )
      batches.delete(key);
    return true;
  }
  function cleanup() {
    active = false;
    ready = false;
    generation++;
    batches.clear();
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
    appointmentTools = createAppointmentTools();
    results.clear();
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
        if (handleTools(event)) return;
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
          appointmentTools.observe(transcript);
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
