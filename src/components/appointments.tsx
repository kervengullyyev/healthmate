"use client";
import { useState } from "react";
import {
  ArrowRight,
  Video,
  MapPin,
  CalendarDays,
  Check,
  ShieldCheck,
} from "lucide-react";
import { appointmentDate, clinicians } from "@/lib/demo";
import type { Booking } from "@/lib/domain";
export function Appointments({
  booking,
  onConfirm,
  onBrief,
}: {
  booking: Booking | null;
  onConfirm: (booking: Booking) => void;
  onBrief: () => void;
}) {
  const [selection, setSelection] = useState<string | null>(null);
  const [offset, setOffset] = useState(1);
  const chosen = clinicians.find((c) => c.id === selection);
  const booked = clinicians.find((c) => c.id === booking?.clinicianId);
  return (
    <div className="content-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">THE NEXT STEP, TOGETHER</span>
          <h1>A little closer to care.</h1>
          <p>Explore how ontuc could connect you with a professional.</p>
        </div>
        <span className="step-pill">Step 03 of 04</span>
      </div>
      <div className="demo-disclosure">
        <ShieldCheck size={18} />
        <div>
          <strong>Appointment requests</strong>
          <p>
            These clinicians and slots are fictional. Confirming saves a sample
            record in this browser; it does not contact a clinic.
          </p>
        </div>
      </div>
      {booking && booked ? (
        <section className="booking-confirmed">
          <span className="confirmed-icon">
            <Check size={28} />
          </span>
          <span className="eyebrow">ONE MORE STEP, TAKEN</span>
          <h2>Your appointment is saved.</h2>
          <p>
            Your appointment request is saved in this browser. Clinic confirmation is required.
          </p>
          <div className="booking-detail">
            <span className={`doctor-initials ${booked.color}`}>
              {booked.initials}
            </span>
            <div>
              <strong>{booked.name}</strong>
              <span>
                {booking.slot} · {booked.format}
              </span>
            </div>
          </div>
          <button className="button primary" onClick={onBrief}>
            Prepare my doctor brief <ArrowRight size={16} />
          </button>
        </section>
      ) : (
        <>
          <div className="appointment-toolbar">
            <span>
              <CalendarDays size={16} /> Sample availability
            </span>
            <div className="date-options">
              {[1, 2, 3].map((day) => (
                <button
                  key={day}
                  className={offset === day ? "selected" : ""}
                  aria-pressed={offset === day}
                  onClick={() => setOffset(day)}
                >
                  {appointmentDate(day)}
                </button>
              ))}
            </div>
          </div>
          <div className="clinician-grid">
            {clinicians.map((clinician) => (
              <article
                className={`clinician-card ${selection === clinician.id ? "selected-clinician" : ""}`}
                key={clinician.id}
              >
                <span className={`doctor-initials ${clinician.color}`}>
                  {clinician.initials}
                </span>
                <h3>{clinician.name}</h3>
                <span className="clinician-role">{clinician.role}</span>
                <p>{clinician.detail}</p>
                <span className="consultation-format">
                  {clinician.format.startsWith("Video") ? (
                    <Video size={15} />
                  ) : (
                    <MapPin size={15} />
                  )}
                  {clinician.format}
                </span>
                <span className="sample-slot">
                  {appointmentDate(offset)} <strong>{clinician.slot}</strong>
                </span>
                <button
                  className={`button ${selection === clinician.id ? "primary" : "secondary"}`}
                  aria-label={`Select ${clinician.name}`}
                  aria-pressed={selection === clinician.id}
                  onClick={() => setSelection(clinician.id)}
                >
                  {selection === clinician.id ? "Selected" : "Choose this time"}
                  {selection === clinician.id ? (
                    <Check size={15} />
                  ) : (
                    <ArrowRight size={15} />
                  )}
                </button>
              </article>
            ))}
          </div>
          <div className="appointment-confirm-bar">
            <div>
              <strong>
                {chosen
                  ? `${chosen.name} · ${appointmentDate(offset)}, ${chosen.slot}`
                  : "Choose a sample appointment to continue."}
              </strong>
              <p>Your doctor brief will be ready to take along.</p>
            </div>
            <button
              className="button primary"
              disabled={!chosen}
              onClick={() => {
                if (chosen)
                  onConfirm({
                    id: crypto.randomUUID(),
                    clinicianId: chosen.id,
                    slot: `${appointmentDate(offset)}, ${chosen.slot}`,
                    demo: true,
                  });
              }}
            >
              Confirm appointment <ArrowRight size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
