"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";

export function GoogleSignIn({ configured, returnTo }: { configured: boolean; returnTo: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <>
    <button className="google-sign-in" disabled={!configured || pending} onClick={async () => {
      setPending(true);
      setError("");
      try { await signIn("google", { redirectTo: returnTo }); }
      catch { setPending(false); setError("Google sign-in couldn't start. Please try again."); }
    }}>
      <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#4285F4" d="M43.6 24.5c0-1.5-.1-2.9-.4-4.3H24v8.2h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.8-3.5 6.1-8.7 6.1-15.2Z" />
        <path fill="#34A853" d="M24 44c5.4 0 10-1.8 13.4-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.8 2-5.2 0-9.6-3.5-11.2-8.2H6v5.3A20 20 0 0 0 24 44Z" />
        <path fill="#FBBC05" d="M12.8 27.8a12 12 0 0 1 0-7.6v-5.3H6a20 20 0 0 0 0 18.2l6.8-5.3Z" />
        <path fill="#EA4335" d="M24 12c2.9 0 5.5 1 7.5 2.9l5.6-5.6A19.2 19.2 0 0 0 24 4 20 20 0 0 0 6 14.9l6.8 5.3C14.4 15.5 18.8 12 24 12Z" />
      </svg>
      {pending ? "Connecting to Google…" : "Continue with Google"}
    </button>
    {error && <p className="milo-error" role="alert">{error}</p>}
  </>;
}
