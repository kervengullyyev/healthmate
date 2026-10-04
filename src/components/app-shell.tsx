"use client";
import {
  Heart,
  House,
  MessageCircle,
  ClipboardList,
  CalendarDays,
  FileText,
  ArrowUpRight,
  RotateCcw,
  ShieldCheck,
  Leaf,
} from "lucide-react";
import type { Mode, Screen } from "@/lib/domain";
import { useCurrentUser } from "@/components/platform-session";
import { SignOutButton } from "@/components/sign-out-button";
const navigation = [
  { id: "home", name: "Overview", icon: House },
  { id: "conversation", name: "My conversation", icon: MessageCircle },
  { id: "care-plan", name: "Care plan", icon: ClipboardList },
  { id: "appointments", name: "Appointments", icon: CalendarDays },
  { id: "doctor-brief", name: "Doctor brief", icon: FileText },
] as const;
export function AppShell({
  screen,
  mode,
  hasPlan,
  urgent = false,
  onNavigate,
  onReset,
  beforeSignOut,
  children,
}: {
  screen: Screen;
  mode: Mode;
  hasPlan: boolean;
  urgent?: boolean;
  onNavigate: (screen: Screen) => void;
  onReset: () => void;
  beforeSignOut: () => Promise<void>;
  children: React.ReactNode;
}) {
  const user = useCurrentUser();
  return (
    <div className="app-layout">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => onNavigate("home")}
          aria-label="ontuc home"
        >
          <span className="brand-icon">
            <Heart size={21} fill="currentColor" />
          </span>
          <span>
            ontuc
            <span className="brand-dot">.</span>
          </span>
        </button>
        <span className="sidebar-label">YOUR SPACE</span>
        <nav aria-label="Main navigation">
          {navigation.map(({ id, name, icon: Icon }) => (
            <button
              key={id}
              aria-label={name}
              className={`nav-item ${screen === id ? "active" : ""}`}
              onClick={() => onNavigate(id)}
              disabled={
                (!hasPlan &&
                  ["care-plan", "appointments", "doctor-brief"].includes(id)) ||
                (urgent && id === "appointments")
              }
              aria-current={screen === id ? "page" : undefined}
            >
              <Icon size={19} />
              <span>{name}</span>
              {screen === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Leaf size={20} />
            <strong>One step at a time.</strong>
            <p>You don’t have to figure it all out on your own.</p>
          </div>
          <button className="reset-button" onClick={onReset}>
            <RotateCcw size={16} /> Start fresh
          </button>
          <div className="profile">
            <span className="profile-icon">Y</span>
            <div>
              <strong>{user.name ?? "Your personal space"}</strong>
              <span>Signed in with Google</span>
            </div>
          </div>
          <SignOutButton beforeSignOut={beforeSignOut} />
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="breadcrumb">
            Your space <span>/</span>{" "}
            <strong>
              {navigation.find((item) => item.id === screen)?.name}
            </strong>
          </span>
          <div className="topbar-right">
            <span
              className={`status-pill ${mode === "demo" ? "demo-pill" : ""}`}
            >
              <span className="status-dot" />
              {mode === "demo" ? "Demo experience" : "AI health companion"}
            </span>
            <button
              className="mobile-reset"
              onClick={onReset}
              aria-label="Start fresh"
            >
              <RotateCcw size={15} />
            </button>
            <span className="topbar-avatar">Y</span>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <footer className="app-footer">
          <span>
            <ShieldCheck size={14} /> A companion for clarity. Always a
            clinician for care.
          </span>
          <a
            href="https://www.nhs.uk/symptoms/"
            target="_blank"
            rel="noreferrer"
          >
            Trusted health information <ArrowUpRight size={13} />
          </a>
        </footer>
      </div>
    </div>
  );
}
