import { z } from 'zod';
import { carePlanSchema, type CarePlan, type Message } from '../domain';
import { healthInstructions, liveInstructions, planInstructions } from './prompts';
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function callOpenAI(path: '/live/sessions' | '/responses', body: unknown, options: { fetchImpl?: typeof fetch } = {}): Promise<unknown> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new ApiError(503, 'Live AI is not configured yet. Set OPENAI_API_KEY on the server, or choose Try a demo.');
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await (options.fetchImpl ?? fetch)('https://api.openai.com/v1' + path, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal, cache: 'no-store' });
    if (!response.ok) {
      if (response.status === 429) throw new ApiError(429, 'OpenAI usage limit reached. Please wait and try again.');
      if ([401, 403, 404].includes(response.status)) throw new ApiError(503, 'OpenAI access is unavailable. Check the server API key and model access.');
      throw new ApiError(502, 'OpenAI could not complete the request. Please try again.');
    }
    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) throw new ApiError(504, 'The AI request timed out. Please try again.');
    throw new ApiError(502, 'Unable to reach OpenAI. Check your connection and try again.');
  } finally { clearTimeout(timer); }
}
export function getLiveConfig() { return { model: 'gpt-live-1', instructions: liveInstructions, audio: { output: { voice: process.env.OPENAI_LIVE_VOICE || 'marin' } }, delegation: { type: 'responses', responses: { model: process.env.OPENAI_BACKEND_MODEL || 'gpt-6-luna', instructions: healthInstructions } } }; }
const responsesSchema = z.object({ status: z.literal('completed'), output: z.array(z.object({ type: z.string(), content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional() })) });
function responseText(value: unknown) {
  const result = responsesSchema.safeParse(value);
  if (!result.success) throw new ApiError(502, 'The AI response was incomplete. Please try again.');
  const text = result.data.output.flatMap(item => item.content ?? []).filter(item => item.type === 'output_text').map(item => item.text ?? '').join('').trim();
  if (!text) throw new ApiError(502, 'The AI could not provide a response. Try again or consult a clinician.');
  return text;
}
function input(messages: Message[]) { return messages.map(message => ({ role: message.role, content: message.content })); }
export async function getAssistantReply(messages: Message[]): Promise<string> {
  return responseText(await callOpenAI('/responses', { model: process.env.OPENAI_BACKEND_MODEL || 'gpt-6-luna', instructions: healthInstructions, input: input(messages), max_output_tokens: 800, store: false }));
}
export async function getCarePlan(messages: Message[]): Promise<CarePlan> {
  const jsonSchema = z.toJSONSchema(carePlanSchema, { target: 'draft-7' }); delete jsonSchema.$schema;
  const text = responseText(await callOpenAI('/responses', { model: process.env.OPENAI_BACKEND_MODEL || 'gpt-6-luna', instructions: planInstructions, input: input(messages), max_output_tokens: 3000, store: false, text: { format: { type: 'json_schema', name: 'care_plan', strict: true, schema: jsonSchema } } }));
  try { return carePlanSchema.parse(JSON.parse(text)); } catch { throw new ApiError(502, 'The care plan was incomplete or invalid. Your existing notes are preserved. Please try again.'); }
}
