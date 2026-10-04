import type { CarePlan } from './domain';
export const demoAnswers = [
  "I've been getting headaches most evenings for about two weeks.",
  "About a 5 out of 10. They build gradually and last an hour or two.",
  "No sudden severe pain, weakness, confusion, fever, stiff neck or vision changes.",
  "I've been sleeping less and working at my laptop a lot. I haven't started any medication.",
  "Yes, they are still happening. I'd like to talk to a doctor.",
];
const replies = [
  'Thanks for telling me. How strong is the pain from 0 to 10, and does it start suddenly or build gradually?',
  'Have you noticed sudden extremely severe pain, weakness, confusion, fever with a stiff neck, or changes to your vision?',
  'What has changed recently — sleep, screen time, medication or your usual routine?',
  'Are the headaches still recurring? Is there anything else you want a clinician to know?',
  'I have enough information for this sample scenario. You can now create your care plan and prepare for a GP conversation.',
];
export function getDemoReply(step: number) { return { reply: replies[Math.min(Math.max(step, 0), 4)], readyForPlan: step >= 4 }; }
export const demoPlan: CarePlan = {
  concern: 'Recurring evening headaches for two weeks', urgency: 'consultation',
  reason: 'Recurring headaches deserve a conversation with a GP. This sample conversation cannot establish a cause or rule out serious illness.',
  nextSteps: ['Arrange a GP consultation to discuss the recurring headaches.', 'Keep a brief diary of timing, duration, severity and other symptoms.', 'Maintain regular meals, hydration and your usual sleep routine.'],
  missingInformation: ['Full medical history and allergies', 'Whether you have tried any treatment', 'Other health changes a clinician should know about'],
  doctorBrief: 'PATIENT-REPORTED CONCERN (SYNTHETIC DEMO)\nRecurring evening headaches for about two weeks.\n\nTIMELINE AND PATTERN\nGradual onset, usually in the evening; lasts one to two hours. Reported severity: 5/10.\n\nASSOCIATED SYMPTOMS\nIn this sample interview, the patient denied sudden extremely severe pain, weakness, confusion, fever with a stiff neck and vision changes. This does not rule out illness.\n\nRELEVANT CONTEXT\nLess sleep and increased laptop use. No newly started medication reported.\n\nUNKNOWN INFORMATION\nFull history, allergies, previous treatment and other health changes are not established.\n\nAI-SUGGESTED NEXT STEP\nDiscuss recurring symptoms with a GP. No diagnosis has been made.\n\nQUESTIONS FOR THE CLINICIAN\nWhat should I track? Could changes in sleep or routine be relevant? When should I seek urgent help?',
};
export const clinicians = [
  { id: 'anna', name: 'Dr. Anna Kowalska', role: 'General practitioner', initials: 'AK', color: 'peach', detail: 'Everyday health & preventive care', format: 'Video consultation', slot: '15:30' },
  { id: 'piotr', name: 'Dr. Piotr Nowak', role: 'General practitioner', initials: 'PN', color: 'lavender', detail: 'Adult health & ongoing symptoms', format: 'In-person consultation', slot: '16:00' },
  { id: 'maya', name: 'Dr. Maya Zielińska', role: 'General practitioner', initials: 'MZ', color: 'mint', detail: 'Patient-centred primary care', format: 'Video consultation', slot: '17:15' },
];
export function appointmentDate(offset: number) { const date = new Date(); date.setDate(date.getDate() + offset); return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', weekday: 'short' }); }
