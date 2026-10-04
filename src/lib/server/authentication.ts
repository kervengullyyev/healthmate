import { auth } from "@/auth";
import { ApiError } from "./openai";
import { getAppointmentStore } from "./appointments";

export async function readAuthenticatedSession() {
  const session = await auth();
  // A still-valid older session must not replace a newer Google sign-in profile.
  if (session?.user?.id) getAppointmentStore().upsertUser({ ...session.user, id: session.user.id }, { refreshProfile: false });
  return session;
}

export async function requireUser() {
  const session = await readAuthenticatedSession();
  if (!session?.user?.id) throw new ApiError(401, "Sign in with Google to continue.");
  return { ...session.user, id: session.user.id };
}
