"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
export function Avatar({
  state = "idle",
  compact = false,
}: {
  state?: "idle" | "connecting" | "listening" | "speaking";
  compact?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    let cancelled = false;
    if (state === "speaking") {
      void element.play().catch(() => {
        if (!cancelled) setVideoPlaying(false);
      });
    }
    // Keep the animation continuous across small gaps between spoken words.
    const pause =
      state !== "speaking"
        ? setTimeout(() => {
            element.pause();
            element.currentTime = 0;
          }, 250)
        : undefined;
    return () => {
      cancelled = true;
      clearTimeout(pause);
    };
  }, [state]);
  useEffect(() => {
    const element = video.current;
    return () => {
      element?.pause();
    };
  }, []);
  return (
    <div
      className={`avatar avatar-${state} ${compact ? "avatar-compact" : ""} ${videoPlaying ? "avatar-video-active" : ""}`}
    >
      <div className="avatar-orbit" />
      <Image
        src="/images/healthmate-avatar.png"
        width={1254}
        height={1254}
        alt="Milo, your friendly mint-green HealthMate companion"
        priority
        className="mascot mascot-image"
      />
      <video
        ref={video}
        className="mascot mascot-video"
        src="/videos/milo.mp4"
        loop
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-hidden="true"
        onPlaying={() => setVideoPlaying(true)}
        onPause={() => setVideoPlaying(false)}
        onError={() => setVideoPlaying(false)}
      />
    </div>
  );
}
