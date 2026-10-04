"use client";
import { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Send,
  PhoneOff,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Volume2,
} from "lucide-react";
import { Avatar } from "./avatar";
import { demoAnswers } from "@/lib/demo";
import type { SessionState } from "@/lib/session";
import type { useLive } from "@/hooks/use-live";
import { canAddExchange } from "@/lib/conversation-budget";
type Props = {
  session: SessionState;
  live: ReturnType<typeof useLive>;
  pending: boolean;
  error: string;
  onSend: (text: string) => Promise<void>;
  onSample: () => void;
  onPlan: () => void;
  onStartVoice: () => void;
};
export function Conversation({
  session,
  live,
  pending,
  error,
  onSend,
  onSample,
  onPlan,
  onStartVoice,
}: Props) {
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const active = ["connecting", "listening", "ending"].includes(live.status);
  const demo = session.mode === "demo";
  const atLimit = !demo && !canAddExchange(session.messages);
  const messageFits = canAddExchange(session.messages, text.trim());
  const canPlan =
    !pending &&
    !active &&
    (demo
      ? session.demoStep >= 5
      : session.messages.some((m) => m.role === "user"));
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [session.messages]);
  return (
    <div className="content-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">FIRST, A CONVERSATION</span>
          <h1>Let’s talk it through.</h1>
          <p>
            {demo
              ? "A guided journey with a synthetic sample patient."
              : "Your words. Your pace. I’m here to listen."}
          </p>
        </div>
        <span className="step-pill">Step 01 of 04</span>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <div className="conversation-grid">
        <section className="chat-card">
          <div className="chat-heading">
            <span className="chat-brand">
              <span className="tiny-avatar">✦</span>
              <span>
                <strong>Milo</strong>
                <small>Your HealthMate companion</small>
              </span>
            </span>
            <span className="status-pill">
              <span className="status-dot" />
              {demo
                ? "Guided demo"
                : active
                  ? live.status === "connecting"
                    ? "Connecting"
                    : live.status === "ending"
                      ? "Finishing"
                      : "Live voice"
                  : "Text conversation"}
            </span>
          </div>
          <div
            className="messages"
            role="log"
            aria-label="Conversation transcript"
            aria-live="polite"
          >
            {session.messages.map((message) => (
              <div className={`message-row ${message.role}`} key={message.id}>
                {message.role === "assistant" && (
                  <span className="message-avatar">✦</span>
                )}
                <div className="message-bubble">
                  <span className="message-speaker">
                    {message.role === "user"
                      ? demo
                        ? "Sample patient"
                        : "You"
                      : "Milo"}
                  </span>
                  <p>{message.content}</p>
                </div>
              </div>
            ))}
            {pending && (
              <div className="thinking" role="status">
                <i />
                <i />
                <i />
                <span>Putting your next step into words…</span>
              </div>
            )}
            <div ref={bottom} />
          </div>
          <div className="chat-input-area">
            {atLimit && (
              <p role="status" className="panel-note">
                Interview limit reached. Your full history is preserved. Create
                your care plan, review corrections there, or start fresh.
              </p>
            )}
            {demo ? (
              session.demoStep < 5 ? (
                <div className="sample-response">
                  <span className="eyebrow">
                    SAMPLE PATIENT RESPONSE · {session.demoStep + 1} / 5
                  </span>
                  <p>{demoAnswers[session.demoStep]}</p>
                  <button className="button secondary" onClick={onSample}>
                    Use sample answer <ArrowRight size={15} />
                  </button>
                </div>
              ) : (
                <div className="conversation-complete">
                  <ShieldCheck size={20} />
                  <div>
                    <strong>Your sample conversation is complete.</strong>
                    <p>Let’s turn it into a clear next step.</p>
                  </div>
                </div>
              )
            ) : (
              <form
                className="message-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const value = text.trim();
                  if (!value || pending || active || !messageFits) return;
                  setText("");
                  await onSend(value);
                }}
              >
                <label className="sr-only" htmlFor="message">
                  Your message
                </label>
                <textarea
                  id="message"
                  placeholder={
                    active
                      ? "End voice to type or prepare your care plan…"
                      : "Tell me what’s been on your mind…"
                  }
                  value={text}
                  maxLength={2000}
                  rows={2}
                  disabled={pending || active || atLimit}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
                <button
                  className="send-button"
                  type="submit"
                  aria-label="Send message"
                  disabled={!text.trim() || pending || active || !messageFits}
                >
                  <Send size={18} />
                </button>
              </form>
            )}
            {!demo && !atLimit && text.trim() && !messageFits && (
              <p role="status" className="panel-note">
                This message exceeds the remaining interview space. Shorten it
                or prepare your care plan; your existing history is preserved.
              </p>
            )}
            <span className="input-note">
              HealthMate offers guidance, not a diagnosis. For immediate danger,
              seek emergency help.
            </span>
          </div>
        </section>
        <aside className="companion-panel">
          <div className="companion-visual">
            <Avatar
              compact
              state={
                live.speaking
                  ? "speaking"
                  : live.status === "connecting"
                    ? "connecting"
                    : active
                      ? "listening"
                      : "idle"
              }
            />
            <span className="companion-hello">
              A friendly ear, just for you.
            </span>
          </div>
          <h3>
            You don’t have to find
            <br />
            the right words.
          </h3>
          <p>
            Start with what you know. I’ll help you organise the rest, one
            question at a time.
          </p>
          {!demo && (
            <div className="voice-controls">
              {active ? (
                <>
                  <button
                    className="round-button"
                    onClick={live.toggleMute}
                    disabled={live.status !== "listening"}
                    aria-label={
                      live.muted ? "Unmute microphone" : "Mute microphone"
                    }
                  >
                    {live.muted ? <MicOff size={19} /> : <Mic size={19} />}
                  </button>
                  <button
                    className="button end-call"
                    onClick={() => void live.end()}
                    disabled={live.status === "ending"}
                  >
                    <PhoneOff size={16} />{" "}
                    {live.status === "ending" ? "Finishing…" : "End voice"}
                  </button>
                </>
              ) : (
                <button
                  className="button secondary"
                  onClick={onStartVoice}
                  disabled={pending}
                >
                  <Mic size={16} /> Start a new voice conversation
                </button>
              )}
            </div>
          )}
          {live.playbackBlocked && (
            <button
              className="button secondary"
              onClick={() => void live.playAudio()}
            >
              <Volume2 size={16} /> Play assistant audio
            </button>
          )}
          <div className="plan-ready">
            <span className="icon-tile mint">
              <Sparkles size={20} />
            </span>
            <strong>From conversation to clarity.</strong>
            <p>
              {demo && session.demoStep < 5
                ? "Complete the sample interview to prepare your care plan."
                : active
                  ? "End your voice conversation when you’re ready to prepare your care plan."
                  : "Your next steps, organised into a simple plan you can review."}
            </p>
            <button
              className="button primary"
              onClick={onPlan}
              disabled={!canPlan}
            >
              Create my care plan <ArrowRight size={15} />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
