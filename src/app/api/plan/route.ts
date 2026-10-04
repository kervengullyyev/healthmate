import { requireUser } from "@/lib/server/authentication";
import { getCarePlan } from "@/lib/server/openai";
import { chatBody, errorResponse, readBody } from "@/lib/server/requests";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    await requireUser();
    const { messages } = await readBody(request, chatBody);
    return Response.json(
      { plan: await getCarePlan(messages) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
