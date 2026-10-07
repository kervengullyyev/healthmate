"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Rive } from "@rive-app/webgl2";

type AvatarState = "idle" | "connecting" | "listening" | "speaking";
// Values verified against the supplied SOBO-Motion-V02 state machine.
const animationStates: Record<AvatarState, number> = {
  idle: 0, connecting: 1, listening: 2, speaking: 4,
};
function animate(instance: Rive, state: AvatarState) {
  const model = instance.viewModelInstance;
  const selection = model?.number("numState");
  const mouth = model?.number("mouthOpen");
  if (selection) selection.value = animationStates[state];
  if (mouth) mouth.value = state === "speaking" ? 1 : 0;
}
export function Avatar({
  state = "idle",
  compact = false,
}: {
  state?: AvatarState;
  compact?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<Rive | null>(null);
  const currentState = useRef(state);
  const updateRendering = useRef<((drawNow?: boolean) => void) | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    currentState.current = state;
    if (runtime.current?.viewModelInstance) animate(runtime.current, state);
    updateRendering.current?.(true);
  }, [state]);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let cancelled = false;
    let instance: Rive | undefined;
    let loaded = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inViewport = true;
    let settleUntil = 0;
    const visible = () => !cancelled && !document.hidden && inViewport;
    const stop = () => {
      clearTimeout(timer);
      timer = undefined;
      instance?.stopRendering();
    };
    const suspend = () => {
      stop();
      if (instance && loaded && !instance.isPaused) {
        instance.pause();
        // A paused frame resets Rive's elapsed-time reference. The next
        // animation must not jump ahead by the entire idle/hidden interval.
        instance.drawFrame();
        instance.stopRendering();
      }
    };
    // Draw explicitly instead of running Rive's unlimited refresh-rate loop.
    // Actual elapsed time still drives animation, so speech never slows down.
    const frame = () => {
      if (!instance || !loaded || !visible()) return;
      if (instance.isPaused) instance.play();
      else instance.drawFrame();
      instance.stopRendering();
      if (currentState.current !== "idle" || performance.now() < settleUntil) {
        timer = setTimeout(frame, 1000 / (currentState.current === "speaking" ? 30 : 15));
      } else suspend();
    };
    const render = (drawNow = false) => {
      stop();
      if (!instance || !loaded || !visible()) return;
      // Let the supplied transition finish before freezing the resting pose.
      if (drawNow && currentState.current === "idle") settleUntil = performance.now() + 500;
      if (drawNow) frame();
      else if (currentState.current !== "idle" || performance.now() < settleUntil) {
        timer = setTimeout(frame, 1000 / (currentState.current === "speaking" ? 30 : 15));
      }
    };
    updateRendering.current = render;
    const resize = () => {
      if (!instance || !loaded || !visible()) return;
      const bounds = element.getBoundingClientRect();
      // Retina resolution scales pixel work quadratically; keep the brush
      // shading while bounding the drawing surface on high-density displays.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5, 960 / Math.max(bounds.width, bounds.height, 1));
      instance.resizeDrawingSurfaceToCanvas(dpr);
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    const intersection = new IntersectionObserver(([entry]) => {
      inViewport = entry.isIntersecting;
      if (inViewport) { resize(); render(true); }
      else suspend();
    });
    intersection.observe(element);
    const onVisibility = () => {
      if (document.hidden) suspend();
      else { resize(); render(true); }
    };
    document.addEventListener("visibilitychange", onVisibility);
    void import("@rive-app/webgl2").then(({ Rive, RuntimeLoader, Layout, Fit, Alignment }) => {
      if (cancelled) return;
      RuntimeLoader.setWasmUrl("/rive/webgl2/rive.wasm");
      RuntimeLoader.setWasmFallbackUrl("/rive/webgl2/rive_fallback.wasm");
      instance = new Rive({
        canvas: element,
        src: "/animations/milo.riv",
        artboard: "SOBO-Motion-V02",
        stateMachine: "State Machine",
        autoBind: true,
        autoplay: true,
        // The Rive renderer preserves the file's vector feathering; sharing its
        // GPU surface also retains a readable canvas for snapshots/fallbacks.
        useOffscreenRenderer: true,
        enableRiveAssetCDN: false,
        shouldDisableRiveListeners: true,
        layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
        onLoad: () => {
          // Rive queues its initial frame after onLoad; take ownership after it.
          queueMicrotask(() => {
            if (cancelled || !instance) return;
            loaded = true;
            animate(instance, currentState.current);
            resize();
            stop();
            render(true);
            setReady(true);
          });
        },
      });
      runtime.current = instance;
    }).catch(() => { /* The supplied character's still image remains visible. */ });
    return () => {
      cancelled = true;
      stop();
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      updateRendering.current = null;
      runtime.current = null;
      instance?.cleanup();
    };
  }, []);
  return (
    <div
      role="img"
      aria-label="Milo, your friendly green ontuc companion"
      className={`avatar avatar-${state} ${compact ? "avatar-compact" : ""} ${ready ? "avatar-rive-ready" : ""}`}
    >
      <Image
        src="/images/milo-rive-fallback.png"
        width={600}
        height={600}
        alt=""
        aria-hidden="true"
        priority
        className="mascot mascot-image"
      />
      <canvas ref={canvas} className="mascot mascot-rive" aria-hidden="true" />
    </div>
  );
}
