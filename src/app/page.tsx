"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, PhoneOff, Volume2, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { useLive } from "@/hooks/use-live";
import { AccountMenu } from "@/components/account-menu";
import type { Message } from "@/lib/domain";

export default function Page() {
  const [messages, setMessages] = useState<Message[]>([]);
  const live = useLive(setMessages);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState("");
  const preflight = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      preflight.current?.abort();
    },
    [],
  );

  async function talk() {
    if (preflight.current) {
      preflight.current.abort();
      preflight.current = null;
      setChecking(false);
      return;
    }
    if (live.status === "connecting" || live.status === "listening") {
      if (live.playbackBlocked) await live.playAudio();
      else await live.end();
      return;
    }
    if (live.status === "ending") return;
    setNotice("");
    setChecking(true);
    const controller = new AbortController();
    preflight.current = controller;
    try {
      const response = await fetch("/api/status", {
        signal: controller.signal,
      });
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok)
        throw new Error("Milo couldn’t connect. Please try again.");
      if (!data.liveConfigured) {
        setNotice("Milo’s voice isn’t configured yet.");
        return;
      }
      preflight.current = null;
      setChecking(false);
      setMessages([]);
      await live.start();
    } catch {
      if (!controller.signal.aborted)
        setNotice("Milo couldn’t connect. Please try again.");
    } finally {
      if (preflight.current === controller) {
        preflight.current = null;
        setChecking(false);
      }
    }
  }

  const connecting = checking || live.status === "connecting";
  const listening = live.status === "listening";
  const ending = live.status === "ending";
  const playback = listening && live.playbackBlocked;
  const label = connecting
    ? "Cancel connection"
    : ending
      ? "Finishing…"
      : playback
        ? "Play Milo’s voice"
        : listening
          ? "End conversation"
          : "Talk to Milo";
  const Icon = connecting
    ? X
    : playback
      ? Volume2
      : listening || ending
        ? PhoneOff
        : Mic;
  const error = notice || live.error;

  return (
    <main className="milo-screen" aria-label="Talk to Milo">
      <AccountMenu
        messages={messages}
        beforeOpen={async () => {
          preflight.current?.abort();
          preflight.current = null;
          setChecking(false);
          await live.end();
        }}
      />
      <Avatar
        state={
          live.speaking
            ? "speaking"
            : connecting
              ? "connecting"
              : listening
                ? "listening"
                : "idle"
        }
      />
      <button
        className="milo-talk"
        onClick={() => void talk()}
        disabled={ending}
      >
        <Icon size={19} aria-hidden="true" /> {label}
      </button>
      {error && (
        <p className="milo-error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
