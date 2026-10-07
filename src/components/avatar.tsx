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
  const [ready, setReady] = useState(false);
  useEffect(() => {
    currentState.current = state;
    if (runtime.current?.viewModelInstance) animate(runtime.current, state);
  }, [state]);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let cancelled = false;
    let instance: Rive | undefined;
    const resize = () => instance?.resizeDrawingSurfaceToCanvas();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
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
          if (cancelled || !instance) return;
          animate(instance, currentState.current);
          resize();
          setReady(true);
        },
      });
      runtime.current = instance;
    }).catch(() => { /* The supplied character's still image remains visible. */ });
    return () => {
      cancelled = true;
      observer.disconnect();
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
