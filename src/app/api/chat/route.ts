import { getAssistantReply } from "@/lib/server/openai";
import { chatBody, errorResponse, readBody } from "@/lib/server/requests";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { messages } = await readBody(request, chatBody);
    return Response.json(
      { reply: await getAssistantReply(messages) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
