export const dynamic = 'force-dynamic';
export async function GET() { return Response.json({ liveConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()) }, { headers: { 'Cache-Control': 'no-store' } }); }
