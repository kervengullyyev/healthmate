"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type AvatarState = "idle" | "connecting" | "listening" | "speaking";

function AnimatedEinstein({ clip }: { clip: "idle" | "wave" | "speaking" }) {
  const [ready, setReady] = useState(false);
  return <Image
    src={`/animations/einstein.svg#${clip}`}
    width={1080} height={1080} alt="" aria-hidden="true"
    unoptimized loading="eager"
    onLoad={() => setReady(true)} onError={() => setReady(false)}
    className={`mascot mascot-svg ${ready ? "mascot-svg-ready" : ""}`}
  />;
}

export function Avatar({ state = "idle", compact = false }: { state?: AvatarState; compact?: boolean }) {
  const element = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    let inViewport = false;
    const update = () => setVisible(inViewport && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      inViewport = entry.isIntersecting;
      update();
    });
    observer.observe(node);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const clip = state === "connecting" ? "wave" : state === "speaking" ? "speaking" : "idle";
  return <div
    ref={element} role="img" aria-label="Milo, your Einstein-style ontuc companion"
    className={`avatar avatar-einstein avatar-${state} ${compact ? "avatar-compact" : ""}`}
  >
    <Image src="/images/einstein-idle.png" width={1080} height={1080}
      alt="" aria-hidden="true" priority className="mascot mascot-image" />
    {/* Unmount animated image documents completely while hidden/offscreen. */}
    {visible && <AnimatedEinstein key={clip} clip={clip} />}
  </div>;
}
