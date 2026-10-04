"use client";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function SignOutButton({ beforeSignOut, menu = false }: { beforeSignOut: () => Promise<void>; menu?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <>
    <button role={menu ? "menuitem" : undefined} tabIndex={menu ? -1 : undefined} className={menu ? undefined : "reset-button"} disabled={pending} onClick={async () => {
      setPending(true);
      setError("");
      try { await beforeSignOut(); await signOut({ redirectTo: "/login" }); }
      catch { setPending(false); setError("Sign-out failed. Please try again."); }
    }}><LogOut size={18} aria-hidden="true" />{pending ? "Signing out…" : "Sign out"}</button>
    {error && <p role="alert" className="milo-error">{error}</p>}
  </>;
}
