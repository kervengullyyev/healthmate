import { appointmentDay, type AppointmentInput } from "../demo-appointments";
import { clinicians } from "../demo";

function canonical(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
    .replace(/[.,!;]/g, " ").replace(/\s+/g, " ").trim();
}
const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const monthWords = months.flatMap(month => [month, month.slice(0, 3)]).concat("sept").join("|");
type Mention = { index: number; value: string };
function latest(mentions: Mention[]) { return mentions.sort((a, b) => a.index - b.index).at(-1)?.value; }
function spokenDate(text: string, expected: string) {
  const dates: Mention[] = [];
  const spans: [number, number][] = [];
  const add = (match: RegExpExecArray, value: string) => {
    dates.push({ index: match.index, value });
    spans.push([match.index, match.index + match[0].length]);
  };
  for (const match of text.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)) add(match, match[0]);
  const date = (day: string, month: string, year?: string) => `${year || expected.slice(0, 4)}-${String(months.findIndex(value => value.startsWith(month)) + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
  for (const match of text.matchAll(new RegExp(`\\b(${monthWords})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(\\d{4}))?\\b`, "g")))
    add(match, date(match[2], match[1], match[3]));
  for (const match of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?(?: of)?\\s+(${monthWords})(?:\\s+(\\d{4}))?\\b`, "g")))
    add(match, date(match[1], match[2], match[3]));
  for (const match of text.matchAll(/\b(today|tomorrow)\b/g))
    add(match, appointmentDay(match[1] === "tomorrow" ? 1 : 0));
  for (const match of text.matchAll(new RegExp(`\\b(?:${monthWords}|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\b`, "g"))) {
    if (match[0] === "may" && /^may\s+(?:i|we|you)\b/.test(text.slice(match.index))) continue;
    if (!spans.some(([start, end]) => match.index >= start && match.index < end)) dates.push({ index: match.index, value: "invalid" });
  }
  for (const match of text.matchAll(/\b\d{1,2}(?:st|nd|rd|th)\b/g)) {
    if (!spans.some(([start, end]) => match.index >= start && match.index < end)) dates.push({ index: match.index, value: "invalid" });
  }
  for (const match of text.matchAll(/\bon\s+/g)) {
    if (!spans.some(([start]) => start === match.index + match[0].length)) dates.push({ index: match.index, value: "invalid" });
  }
  return latest(dates);
}
function spokenTime(text: string) {
  const times: Mention[] = [];
  const spans: [number, number][] = [];
  for (const match of text.matchAll(/\b(?:(\d{1,2})(?::(\d{2}))?\s*(a\s*m|p\s*m)|(\d{1,2}):(\d{2}))\b/g)) {
    spans.push([match.index, match.index + match[0].length]);
    let hour = Number(match[1] ?? match[4]);
    const minute = Number(match[2] ?? match[5] ?? 0), meridiem = match[3]?.replace(/\s/g, "");
    if (minute > 59 || hour > 23 || (meridiem && (hour < 1 || hour > 12))) {
      times.push({ index: match.index, value: "invalid" }); continue;
    }
    if (meridiem) hour = hour % 12 + (meridiem === "pm" ? 12 : 0);
    times.push({ index: match.index, value: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` });
  }
  for (const match of text.matchAll(/\b(?:noon|midnight|a\s*m|p\s*m)\b/g)) {
    if (!spans.some(([start, end]) => match.index >= start && match.index < end)) times.push({ index: match.index, value: "invalid" });
  }
  for (const match of text.matchAll(/\bat\s+/g)) {
    if (!spans.some(([start]) => start === match.index + match[0].length)) times.push({ index: match.index, value: "invalid" });
  }
  return latest(times);
}

function spokenDoctor(text: string) {
  const doctors: Mention[] = [];
  for (const match of text.matchAll(/\b(?:with\s+(?:(?:dr|doctor)\s+)?|(?:dr|doctor)\s+)/g)) {
    const name = text.slice(match.index + match[0].length);
    const doctor = clinicians.find(value => {
      const fullName = canonical(value.name).replace(/^dr\s+/, "");
      if (!name.startsWith(fullName)) return false;
      // A longer, unknown name must not match a known clinician's prefix.
      return /^(?:$|\?|\s+(?:on|at|for|today|tomorrow|is|has|was|can|will|available|unavailable)\b)/.test(name.slice(fullName.length));
    });
    doctors.push({ index: match.index, value: doctor?.id ?? "unknown" });
  }
  return latest(doctors);
}

/** Verify the spoken scheduling values, rather than requiring ISO text in speech. */
export function askedAboutAppointment(text: string, input: AppointmentInput) {
  const spoken = canonical(text);
  const sentences = text.replace(/\bdr\./gi, "dr").replace(/\b([ap])\s*\.\s*m\s*\./gi, "$1m");
  const question = canonical(sentences.split(/[?.!;]/).filter(part => part.trim()).at(-1) || "");
  const permission = /\b(?:would|do) you (?:like|want)(?: me)? to (?:go ahead and )?(?:book|schedule|arrange|reserve)\b|\b(?:shall|should|may|can|could) (?:i|we) (?:go ahead and )?(?:book|schedule|arrange|reserve)\b/;
  const request = permission.exec(question);
  if (!request) return false;
  const intent = question;
  if (/\b(?:not|don['’]t|cancel|instead|or|different|another|rather|if|unless|but)\b/.test(intent)) return false;
  const doctor = spokenDoctor(intent) ?? spokenDoctor(spoken);
  const date = spokenDate(intent, input.date);
  const time = spokenTime(intent);
  // Only inherit the announced slot when the question does not override that
  // field. An unsupported new value must never silently approve an older one.
  if (!date && /\b(?:on|next|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(intent)) return false;
  if (!time && /\bat\b/.test(intent)) return false;
  return doctor === input.clinicianId && (date ?? spokenDate(spoken, input.date)) === input.date && (time ?? spokenTime(spoken)) === input.time;
}

export function appointmentQuestion(input: AppointmentInput) {
  const doctor = clinicians.find(value => value.id === input.clinicianId)!;
  const date = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(`${input.date}T12:00:00`));
  const [hour, minute] = input.time.split(":");
  const time = `${Number(hour) % 12 || 12}:${minute} ${Number(hour) >= 12 ? "PM" : "AM"}`;
  return `Would you like me to book an appointment with ${doctor.name} on ${date} at ${time}?`;
}
