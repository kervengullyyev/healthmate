import {
  ArrowRight,
  Check,
  CircleHelp,
  ClipboardList,
  RefreshCw,
  AlertTriangle,
  FileText,
} from "lucide-react";
import type { CarePlan, Mode } from "@/lib/domain";
export function CarePlanView({
  plan,
  mode,
  pending,
  onConcern,
  onUpdate,
  onAppointments,
  onBrief,
}: {
  plan: CarePlan;
  mode: Mode;
  pending: boolean;
  onConcern: (text: string) => void;
  onUpdate: () => void;
  onAppointments: () => void;
  onBrief: () => void;
}) {
  const urgent = plan.urgency === "urgent";
  return (
    <div className="content-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">A PLAN YOU CAN UNDERSTAND</span>
          <h1>Your next step, made clearer.</h1>
          <p>
            {mode === "demo"
              ? "An illustrative care plan for the sample patient."
              : "Based on what you shared. Review and correct anything that needs it."}
          </p>
        </div>
        <span className="step-pill">Step 02 of 04</span>
      </div>
      <section className={`care-summary ${urgent ? "urgent-summary" : ""}`}>
        <span className={`summary-icon ${urgent ? "danger" : "mint"}`}>
          {urgent ? <AlertTriangle size={25} /> : <ClipboardList size={25} />}
        </span>
        <div>
          <span className="eyebrow">SUGGESTED LEVEL OF CARE</span>
          <h2>
            {urgent
              ? "Please seek urgent medical help."
              : plan.urgency === "consultation"
                ? "A conversation with a clinician."
                : "Practical steps, with room to monitor."}
          </h2>
          <p>{plan.reason}</p>
          {urgent && (
            <strong className="urgent-guidance">
              For immediate danger, contact local emergency services. Don’t wait
              for a routine appointment.
            </strong>
          )}
        </div>
        <span className={`urgency-pill ${urgent ? "danger" : ""}`}>
          {urgent
            ? "Urgent evaluation"
            : plan.urgency === "consultation"
              ? "Consultation recommended"
              : "Self-care guidance"}
        </span>
      </section>
      <div className="care-grid">
        <section className="panel">
          <div className="panel-heading">
            <h3>Your next steps</h3>
            <span className="icon-tile mint">
              <Check size={19} />
            </span>
          </div>
          <ul className="next-steps">
            {plan.nextSteps.map((step, i) => (
              <li key={i}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <p>{step}</p>
              </li>
            ))}
          </ul>
          <div className="panel-note">
            A suggested plan, not a clinical assessment. If symptoms worsen or
            you’re worried, seek professional help.
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h3>A little more context</h3>
            <span className="icon-tile lavender">
              <CircleHelp size={19} />
            </span>
          </div>
          <label className="field-label" htmlFor="concern">
            Your concern · editable
          </label>
          <textarea
            id="concern"
            className="concern-input"
            value={plan.concern}
            maxLength={1000}
            onChange={(e) => onConcern(e.target.value)}
            rows={3}
          />
          <span className="field-label">Information still to discuss</span>
          <ul className="missing-list">
            {plan.missingInformation.length ? (
              plan.missingInformation.map((item, i) => <li key={i}>{item}</li>)
            ) : (
              <li>A clinician may still ask for more details.</li>
            )}
          </ul>
        </section>
      </div>
      <div className="care-actions">
        <button className="text-button" onClick={onUpdate} disabled={pending}>
          <RefreshCw size={15} /> {pending ? "Updating…" : "Update care plan"}
        </button>
        <div>
          {!urgent && (
            <button className="button primary" onClick={onAppointments}>
              Explore appointments <ArrowRight size={16} />
            </button>
          )}
          <button className="button secondary" onClick={onBrief}>
            <FileText size={16} /> Review my doctor brief
          </button>
        </div>
      </div>
    </div>
  );
}
