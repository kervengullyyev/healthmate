import Image from "next/image";
export function Avatar({
  state = "idle",
  compact = false,
}: {
  state?: "idle" | "connecting" | "listening" | "speaking";
  compact?: boolean;
}) {
  return (
    <div
      className={`avatar avatar-${state} ${compact ? "avatar-compact" : ""}`}
    >
      <div className="avatar-orbit" />
      <Image
        src="/images/healthmate-avatar.png"
        width={1254}
        height={1254}
        alt="Milo, your friendly mint-green HealthMate companion"
        priority
        className="mascot"
      />
    </div>
  );
}
