"use client";
import { useCurrentUser } from "@/components/platform-session";
import Link from "next/link";
import { useState } from "react";
import { clinicians } from "@/lib/demo";
import {
  appointmentDay,
  appointmentTimes,
  formatAppointmentDate,
  type Appointment,
} from "@/lib/demo-appointments";
import { bookAppointment, importBrowserAppointments } from "@/lib/appointments-client";

export default function AppointmentPage() {
  const user = useCurrentUser();
  const [booking, setBooking] = useState<Appointment | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="appointment-form-page">
      <section className="appointment-form-card">
        <h1>{booking ? "Appointment booked" : "Appointment"}</h1>
        {booking ? (
          <>
            <p className="appointment-form-summary">
              <strong>
                {
                  clinicians.find(
                    (doctor) => doctor.id === booking.clinicianId,
                  )!.name
                }
              </strong>
              <br />
              {formatAppointmentDate(booking.date)} · {booking.time}
            </p>
            {booking.description && (
              <p className="appointment-description">{booking.description}</p>
            )}
            <Link className="button primary" href="/">
              Back to Milo
            </Link>
          </>
        ) : (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (saving) return;
              setError("");
              setSaving(true);
              const fields = new FormData(event.currentTarget);
              try {
                try { await importBrowserAppointments(user.id); }
                catch { /* A conflicting legacy record must not prevent a new booking. Appointments reports the import issue. */ }
                setBooking(await bookAppointment({
                  clinicianId: fields.get("doctor") as "anna" | "piotr" | "maya",
                  date: String(fields.get("date")),
                  time: fields.get("time") as "15:30" | "16:00" | "17:15",
                  description: String(fields.get("description") ?? ""),
                }, undefined, user.id));
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "The appointment could not be saved.",
                );
              } finally { setSaving(false); }
            }}
          >
            <label htmlFor="appointment-doctor">Doctor</label>
            <select name="doctor" id="appointment-doctor" defaultValue="anna">
              {clinicians.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name}
                </option>
              ))}
            </select>
            <label htmlFor="appointment-date">Date</label>
            <input
              name="date"
              id="appointment-date"
              type="date"
              required
              min={appointmentDay(1)}
              max={appointmentDay(30)}
            />
            <label htmlFor="appointment-time">Time</label>
            <select name="time" id="appointment-time" defaultValue="15:30">
              {appointmentTimes.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
            <label htmlFor="appointment-description">Description</label>
            <textarea
              name="description"
              id="appointment-description"
              rows={4}
              maxLength={1500}
              placeholder="Reason for the appointment or Milo’s summary"
            />
            {error && (
              <p className="appointment-form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary" type="submit" disabled={saving}>
              {saving ? "Booking…" : "Book appointment"}
            </button>
            <Link className="appointment-back" href="/">
              Back to Milo
            </Link>
          </form>
        )}
      </section>
    </main>
  );
}
