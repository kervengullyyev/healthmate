"use client";
import { useEffect } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import type { Session } from "next-auth";

function AccountBoundary({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  useEffect(() => {
    if (status === "unauthenticated") window.location.replace("/login");
  }, [status]);
  if (!session?.user?.id) return null;
  return <div key={session.user.id}>{children}</div>;
}

export function PlatformSession({ session, children }: { session: Session; children: React.ReactNode }) {
  return <SessionProvider session={session} refetchInterval={300}><AccountBoundary>{children}</AccountBoundary></SessionProvider>;
}

export function useCurrentUser() {
  const { data } = useSession();
  if (!data?.user?.id) throw new Error("Sign in with Google to continue.");
  return { ...data.user, id: data.user.id };
}
