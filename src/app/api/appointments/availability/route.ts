import { requireUser } from "@/lib/server/authentication";
import { getAppointmentStore } from "@/lib/server/appointments";
import { errorResponse } from "@/lib/server/requests";
export const runtime = "nodejs";
export async function GET() {
  try {
    await requireUser();
    return Response.json({ occupied: getAppointmentStore().occupied() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
