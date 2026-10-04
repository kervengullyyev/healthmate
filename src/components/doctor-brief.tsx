import { Download, Printer, FileText, RefreshCw, Check } from "lucide-react";
import type { Booking, CarePlan, Mode } from "@/lib/domain";
import { clinicians } from "@/lib/demo";
export function DoctorBrief({
  brief,
  plan,
  booking,
  mode,
  onEdit,
  onReplace,
}: {
  brief: string;
  plan: CarePlan;
  booking: Booking | null;
  mode: Mode;
  onEdit: (text: string) => void;
  onReplace: () => void;
}) {
  const doctor = clinicians.find((c) => c.id === booking?.clinicianId);
  const appointment =
    booking && doctor
      ? `SAMPLE APPOINTMENT — NO REAL BOOKING\n${doctor.name}\n${booking.slot}`
      : "APPOINTMENT\nNo appointment booked.";
  const fullBrief = `HEALTHMATE — DOCTOR BRIEF\n${mode === "demo" ? "SYNTHETIC DEMONSTRATION\n" : ""}\nPATIENT-REVIEWED CONCERN\n${plan.concern}\n\n${brief}\n\n${appointment}\n\nPrepared with AI assistance. Patient statements and AI suggestions require clinician review.`;
  function download() {
    const url = URL.createObjectURL(
      new Blob([fullBrief], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "healthmate-doctor-brief.txt";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="content-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">FEEL A LITTLE MORE PREPARED</span>
          <h1>Your story, ready to share.</h1>
          <p>Your symptoms, context and questions — in one place.</p>
        </div>
        <span className="step-pill">Step 04 of 04</span>
      </div>
      <div className="brief-grid">
        <section className="panel brief-editor">
          <div className="panel-heading">
            <span className="chat-brand">
              <span className="icon-tile mint">
                <FileText size={21} />
              </span>
              <span>
                <h3>Appointment brief</h3>
                <small>
                  {mode === "demo"
                    ? "Synthetic sample · editable"
                    : "AI-assisted draft · review before sharing"}
                </small>
              </span>
            </span>
            <span className="status-pill">Your words matter</span>
          </div>
          <label htmlFor="doctor-brief" className="field-label">
            Doctor brief
          </label>
          <textarea
            id="doctor-brief"
            value={brief}
            onChange={(e) => onEdit(e.target.value)}
            maxLength={10000}
            spellCheck
            rows={20}
          />
          <div className="brief-editor-footer">
            <span>
              <Check size={14} /> Edits stay in this session
            </span>
            <button
              className="text-button"
              onClick={() => {
                if (
                  window.confirm(
                    "Replace your edits with the latest generated draft?",
                  )
                )
                  onReplace();
              }}
            >
              <RefreshCw size={13} /> Restore generated draft
            </button>
          </div>
        </section>
        <aside className="brief-aside">
          <section className="panel">
            <span className="eyebrow">
              BRING YOURSELF. WE’LL HELP WITH THE REST.
            </span>
            <h3>
              A clearer conversation
              <br />
              with your clinician.
            </h3>
            <p>
              Check the details, add anything we missed, and take your brief to
              your appointment.
            </p>
            <div className="brief-checks">
              <span>
                <Check size={15} /> Symptoms in your own words
              </span>
              <span>
                <Check size={15} /> Important context and unknowns
              </span>
              <span>
                <Check size={15} /> Questions worth asking
              </span>
            </div>
            <button className="button primary" onClick={() => window.print()}>
              <Printer size={16} /> Print / save PDF
            </button>
            <button className="button secondary" onClick={download}>
              <Download size={16} /> Download text
            </button>
          </section>
          <section className="brief-appointment">
            <span className="field-label">
              {booking ? "SAMPLE APPOINTMENT" : "YOUR APPOINTMENT"}
            </span>
            <strong>{doctor?.name ?? "No appointment booked"}</strong>
            {booking && <span>{booking.slot}</span>}
            <p>
              {booking
                ? "Demo only. No clinic has been contacted."
                : "Take this brief to a clinician of your choice."}
            </p>
          </section>
          <p className="brief-privacy">
            Your live conversation and edits stay in memory in this browser
            session. Download only when you’re ready to keep a copy.
          </p>
        </aside>
      </div>
      <article className="print-brief">
        <h1>HealthMate · Doctor brief</h1>
        <pre>{fullBrief}</pre>
      </article>
    </div>
  );
}
