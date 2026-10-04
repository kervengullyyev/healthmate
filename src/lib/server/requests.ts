import { z } from "zod";
import { messageSchema } from "../domain";
import { ApiError } from "./openai";
const windows = new Map<string, { count: number; until: number }>();
export const chatBody = z
  .object({ messages: z.array(messageSchema).min(1).max(40) })
  .strict();
export const sessionBody = z
  .object({ sdp: z.string().min(5).max(64000).startsWith("v=0") })
  .strict();
export async function readBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  accountId: string,
): Promise<T> {
  const url = new URL(request.url);
  // Use the actual Host, never a forwarded host supplied by a caller.
  const actualHost = request.headers.get("host") || url.host;
  const expectedOrigin = `${url.protocol}//${actualHost}`;
  const hostname = new URL(expectedOrigin).hostname;
  const origin = request.headers.get("origin");
  const localAllowed = ["localhost", "127.0.0.1", "[::1]"].includes(hostname) && origin === expectedOrigin;
  let publicAllowed = false;
  try {
    const configured = process.env.APP_ORIGIN?.trim();
    const publicUrl = new URL(configured ?? "");
    publicAllowed = publicUrl.protocol === "https:" && publicUrl.origin === configured &&
      publicUrl.host === actualHost && origin === publicUrl.origin;
  } catch { /* Missing or invalid public configuration stays closed. */ }
  if (!localAllowed && !publicAllowed)
    throw new ApiError(
      403,
      "Unexpected request origin. Open ontuc directly and try again.",
    );
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ApiError(400, "A JSON request is required.");
  const now = Date.now();
  for (const [key, window] of windows)
    if (window.until < now) windows.delete(key);
  // Use verified identity; proxy headers can contain caller-controlled values.
  const key = accountId;
  const window = windows.get(key) ?? { count: 0, until: now + 60000 };
  if (++window.count > 30 || windows.size > 1000)
    throw new ApiError(429, "Too many requests. Wait a minute and try again.");
  windows.set(key, window);
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "Request body is missing.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 65536) {
        await reader.cancel();
        throw new ApiError(
          400,
          "Request is too large. Start a shorter conversation.",
        );
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const result = schema.safeParse(
      JSON.parse(new TextDecoder().decode(bytes)),
    );
    if (!result.success)
      throw new ApiError(
        400,
        "Invalid request. Check the conversation and try again.",
      );
    return result.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "The request could not be read. Please try again.");
  }
}
export function errorResponse(error: unknown) {
  const known = error instanceof ApiError;
  return Response.json(
    {
      error: known ? error.message : "Something went wrong. Please try again.",
    },
    {
      status: known ? error.status : 500,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
