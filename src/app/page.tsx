"use client";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Home } from "@/components/home";
import { Conversation } from "@/components/conversation";
import { CarePlanView } from "@/components/care-plan";
import { Appointments } from "@/components/appointments";
import { DoctorBrief } from "@/components/doctor-brief";
import { createSession, sessionReducer } from "@/lib/session";
import {
  carePlanSchema,
  messageSchema,
  type Booking,
  type Message,
  type Mode,
  type Screen,
} from "@/lib/domain";
import { clinicians, demoAnswers, demoPlan, getDemoReply } from "@/lib/demo";
import { useLive } from "@/hooks/use-live";
const bookingKey = "healthmate-demo-booking";
export default function Page() {
  const [state, dispatch] = useReducer(sessionReducer, "live", createSession);
  const [configured, setConfigured] = useState<boolean | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const epoch = useRef(0),
    voiceOwner = useRef(-1),
    busy = useRef(false),
    request = useRef<AbortController | null>(null);
  const previousScreen = useRef(state.screen);
  const onTranscript = useCallback((messages: Message[]) => {
    if (voiceOwner.current === epoch.current)
      dispatch({ type: "transcript", messages });
  }, []);
  const live = useLive(onTranscript);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/status", { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setConfigured(data.liveConfigured))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (previousScreen.current !== state.screen) document.getElementById("main")?.focus();
    previousScreen.current = state.screen;
  }, [state.screen]);
  useEffect(
    () => () => {
      request.current?.abort();
    },
    [],
  );
  const active = ["connecting", "listening", "ending"].includes(live.status);
  function cancelRequests() {
    epoch.current++;
    voiceOwner.current = -1;
    request.current?.abort();
    busy.current = false;
    setPending(false);
    setError("");
  }
  async function start(mode: Mode, voice = false) {
    cancelRequests();
    const token = epoch.current;
    await live.end();
    if (token !== epoch.current) return;
    dispatch({ type: "reset", mode });
    dispatch({ type: "screen", screen: "conversation" });
    if (!voice)
      dispatch({
        type: "message",
        message: {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            mode === "demo"
              ? "Hi, I’m Milo. This guided demo follows a fictional patient with recurring headaches. Use the sample answers to see how a conversation becomes a care plan."
              : "Hi, I’m Milo, your AI health companion. I can help you organise what you’re feeling and prepare for care. What’s been bothering you?",
        },
      });
    if (mode === "demo") {
      try {
        const saved = JSON.parse(localStorage.getItem(bookingKey) ?? "null");
        if (
          saved?.demo === true &&
          typeof saved.id === "string" &&
          typeof saved.slot === "string" &&
          clinicians.some((c) => c.id === saved.clinicianId)
        )
          dispatch({ type: "booking", booking: saved });
      } catch {
        /* Unavailable storage doesn't block the demo. */
      }
    }
    if (voice) {
      voiceOwner.current = token;
      try {
        const response = await fetch("/api/status");
        const config = await response.json();
        if (token !== epoch.current) return;
        setConfigured(Boolean(config.liveConfigured));
        if (!config.liveConfigured) {
          setError(
            "Live AI is not configured yet. Set OPENAI_API_KEY in .env.local, or return to Overview and choose Try a demo. You can also type below once AI is configured.",
          );
          return;
        }
        await live.start();
      } catch {
        if (token === epoch.current)
          setError("Unable to check voice availability. Please try again.");
      }
    }
  }
  async function reset() {
    cancelRequests();
    const token = epoch.current;
    await live.end();
    if (token !== epoch.current) return;
    try {
      localStorage.removeItem(bookingKey);
    } catch {}
    dispatch({ type: "reset", mode: "live" });
  }
  async function send(text: string) {
    if (busy.current || active || state.mode === "demo") return;
    const message: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    const messages = [...state.messages, message];
    const token = epoch.current;
    dispatch({ type: "message", message });
    busy.current = true;
    setPending(true);
    setError("");
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (token !== epoch.current) return;
      if (!response.ok)
        throw new Error(data.error || "The message could not be sent.");
      const reply = messageSchema.parse({
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply,
      });
      dispatch({ type: "message", message: reply });
    } catch (failure) {
      if (token === epoch.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "The message could not be sent. Please try again.",
        );
    } finally {
      if (token === epoch.current) {
        busy.current = false;
        setPending(false);
      }
    }
  }
  function sample() {
    if (state.mode !== "demo" || state.demoStep >= 5) return;
    const step = state.demoStep;
    dispatch({
      type: "message",
      message: {
        id: crypto.randomUUID(),
        role: "user",
        content: demoAnswers[step],
      },
    });
    dispatch({
      type: "message",
      message: {
        id: crypto.randomUUID(),
        role: "assistant",
        content: getDemoReply(step).reply,
      },
    });
    dispatch({ type: "demo-step", step: step + 1 });
  }
  async function generatePlan() {
    if (busy.current || active) return;
    setError("");
    if (state.mode === "demo") {
      if (state.demoStep < 5) return;
      dispatch({ type: "plan", plan: demoPlan });
      dispatch({ type: "screen", screen: "care-plan" });
      return;
    }
    if (!state.messages.some((m) => m.role === "user")) return;
    busy.current = true;
    setPending(true);
    const token = epoch.current;
    const controller = new AbortController();
    request.current = controller;
    const messages = [...state.messages];
    if (state.plan)
      messages.push({
        id: crypto.randomUUID(),
        role: "user",
        content: `Patient-reviewed concern: ${state.plan.concern}`,
      });
    if (state.briefEdited)
      for (let i = 0; i < state.brief.length; i += 1800)
        messages.push({
          id: crypto.randomUUID(),
          role: "user",
          content: `Patient-reviewed brief correction: ${state.brief.slice(i, i + 1800)}`,
        });
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (token !== epoch.current) return;
      if (!response.ok)
        throw new Error(data.error || "The plan could not be generated.");
      const plan = carePlanSchema.parse(data.plan);
      dispatch({ type: "plan", plan });
      dispatch({ type: "screen", screen: "care-plan" });
    } catch (failure) {
      if (token === epoch.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Unable to generate a care plan. Your notes are preserved.",
        );
    } finally {
      if (token === epoch.current) {
        busy.current = false;
        setPending(false);
      }
    }
  }
  function navigate(screen: Screen) {
    if (screen === "appointments" && state.plan?.urgency === "urgent") return;
    dispatch({ type: "screen", screen });
  }
  function confirm(booking: Booking) {
    dispatch({ type: "booking", booking });
    if (state.mode === "demo")
      try {
        localStorage.setItem(bookingKey, JSON.stringify(booking));
      } catch {
        setError(
          "The sample booking is saved for this session, but browser storage is unavailable.",
        );
      }
  }
  const displayedError = error || (state.mode === "live" ? live.error : "");
  return (
    <AppShell
      screen={state.screen}
      mode={state.mode}
      hasPlan={Boolean(state.plan)}
      urgent={state.plan?.urgency === "urgent"}
      onNavigate={navigate}
      onReset={() => void reset()}
    >
      {displayedError && state.screen !== "home" && (
        <div className="global-error error-banner" role="alert">
          {displayedError}
        </div>
      )}
      {state.screen === "home" && (
        <Home
          onStartVoice={() => void start("live", true)}
          onStartText={() => void start("live")}
          onStartDemo={() => void start("demo")}
          liveConfigured={configured}
        />
      )}
      {state.screen === "conversation" && (
        <Conversation
          session={state}
          live={live}
          pending={pending}
          error=""
          onSend={send}
          onSample={sample}
          onPlan={() => void generatePlan()}
          onStartVoice={() => void start("live", true)}
        />
      )}
      {state.screen === "care-plan" && state.plan && (
        <CarePlanView
          plan={state.plan}
          mode={state.mode}
          pending={pending}
          onConcern={(text) => dispatch({ type: "concern", text })}
          onUpdate={() => void generatePlan()}
          onAppointments={() => navigate("appointments")}
          onBrief={() => navigate("doctor-brief")}
        />
      )}
      {state.screen === "appointments" && state.plan?.urgency !== "urgent" && (
        <Appointments
          booking={state.booking}
          onConfirm={confirm}
          onBrief={() => navigate("doctor-brief")}
        />
      )}
      {state.screen === "doctor-brief" && state.plan && (
        <DoctorBrief
          brief={state.brief}
          plan={state.plan}
          booking={state.booking}
          mode={state.mode}
          onEdit={(text) => dispatch({ type: "brief", text })}
          onReplace={() => dispatch({ type: "replace-brief" })}
        />
      )}
    </AppShell>
  );
}
