import { requireUser } from "@/lib/server/authentication";
import { errorResponse } from "@/lib/server/requests";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await requireUser();
    return Response.json(
      { liveConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) { return errorResponse(error); }
}
