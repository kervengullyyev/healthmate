import { auth } from "@/auth";
import { ApiError } from "./openai";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new ApiError(401, "Sign in with Google to continue.");
  return { ...session.user, id: session.user.id };
}
