import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PlatformSession } from "@/components/platform-session";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return <PlatformSession session={session}>{children}</PlatformSession>;
}
