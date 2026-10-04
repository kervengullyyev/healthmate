import { z } from 'zod';
export const messageSchema = z.object({ id: z.string().min(1).max(120), role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(2000) });
export const carePlanSchema = z.object({
  concern: z.string().trim().min(1).max(1000), urgency: z.enum(['self-care', 'consultation', 'urgent']),
  reason: z.string().trim().min(1).max(2000), nextSteps: z.array(z.string().min(1).max(1000)).min(1).max(8),
  missingInformation: z.array(z.string().min(1).max(1000)).max(12), doctorBrief: z.string().trim().min(1).max(10000),
});
export type Message = z.infer<typeof messageSchema>;
export type CarePlan = z.infer<typeof carePlanSchema>;
export type Booking = { id: string; clinicianId: string; slot: string; demo: true };
export type Screen = 'home' | 'conversation' | 'care-plan' | 'appointments' | 'doctor-brief';
export type Mode = 'live' | 'demo';
