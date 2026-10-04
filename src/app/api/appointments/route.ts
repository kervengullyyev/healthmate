import { requireUser } from "@/lib/server/authentication";
import { getAppointmentStore } from "@/lib/server/appointments";
import { appointmentInputSchema } from "@/lib/demo-appointments";
import { errorResponse, readBody } from "@/lib/server/requests";
import { z } from "zod";
import { ApiError } from "@/lib/server/openai";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
const inputSchema = appointmentInputSchema.extend({ expectedAccountId: z.string().min(1).max(256) });
export async function GET() {
  try {
    const user = await requireUser();
    return Response.json({ appointments: getAppointmentStore().list(user.id) }, { headers });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { expectedAccountId, ...input } = await readBody(request, inputSchema, user.id);
    if (expectedAccountId !== user.id) throw new ApiError(403, "Your signed-in account changed. Refresh and try again.");
    return Response.json({ appointment: getAppointmentStore().book(user.id, input) }, { status: 201, headers });
  } catch (error) { return errorResponse(error); }
}
