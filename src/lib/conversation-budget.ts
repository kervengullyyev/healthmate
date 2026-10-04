import type { Message } from "./domain";
// Leave capacity for a concern correction and six brief correction chunks.
// Reserve body bytes as well, since non-English text may use several bytes.
const interviewMessages = 30;
const interviewBytes = 24576;
export function withinInterviewBudget(messages: Message[]) {
  return (
    messages.length <= interviewMessages &&
    new TextEncoder().encode(JSON.stringify({ messages })).length <=
      interviewBytes
  );
}
export function canAddExchange(messages: Message[], text = "") {
  return withinInterviewBudget([
    ...messages,
    { id: "next-patient-message", role: "user", content: text },
    // Reserve a maximum-length reply, including worst-case JSON escaping.
    {
      id: "next-assistant-message",
      role: "assistant",
      content: "\u0000".repeat(2000),
    },
  ]);
}
export function shouldFinishVoice(messages: Message[]) {
  // Close before the hard interview budget to allow final caption fragments.
  return messages.length >= 28 || !withinInterviewBudget(messages);
}
