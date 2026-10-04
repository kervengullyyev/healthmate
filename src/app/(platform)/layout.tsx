import { redirect } from "next/navigation";
import { readAuthenticatedSession } from "@/lib/server/authentication";
import { PlatformSession } from "@/components/platform-session";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await readAuthenticatedSession();
  if (!session?.user?.id) redirect("/login");
  return <PlatformSession session={session}>{children}</PlatformSession>;
}
