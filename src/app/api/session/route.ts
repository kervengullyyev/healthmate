import { z } from "zod";
import { ApiError, callOpenAI, getLiveConfig } from "@/lib/server/openai";
import { errorResponse, readBody, sessionBody } from "@/lib/server/requests";
export const runtime = "nodejs";
const handshake = z.object({
  session: z.object({ id: z.string().min(1) }),
  transport: z.object({ type: z.literal("webrtc"), sdp: z.string().min(1) }),
});
export async function POST(request: Request) {
  try {
    const { sdp } = await readBody(request, sessionBody);
    const result = handshake.safeParse(
      await callOpenAI("/live/sessions", {
        session: getLiveConfig(),
        transport: { type: "webrtc", sdp },
      }),
    );
    if (!result.success)
      throw new ApiError(502, "Invalid voice handshake. Please try again.");
    return Response.json(result.data, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
