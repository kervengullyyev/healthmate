import { z } from "zod";
import { requireUser } from "@/lib/server/authentication";
import { getAppointmentStore } from "@/lib/server/appointments";
import { appointmentInputSchema } from "@/lib/demo-appointments";
import { errorResponse, readBody } from "@/lib/server/requests";
import { ApiError } from "@/lib/server/openai";
export const runtime = "nodejs";
const schema = z.object({ appointments: z.array(appointmentInputSchema).max(100), expectedAccountId: z.string().min(1).max(256) }).strict();
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = await readBody(request, schema, user.id);
    if (input.expectedAccountId !== user.id) throw new ApiError(403, "Your signed-in account changed. Refresh and try again.");
    const appointments = getAppointmentStore().import(user.id, input.appointments);
    return Response.json({ appointments }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
