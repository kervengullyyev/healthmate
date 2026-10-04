"use client";
import Link from "next/link";
import { useState } from "react";
import { clinicians } from "@/lib/demo";
import {
  appointmentDay,
  appointmentTimes,
  bookDemoAppointment,
  formatAppointmentDate,
  type DemoAppointment,
} from "@/lib/demo-appointments";

export default function AppointmentPage() {
  const [booking, setBooking] = useState<DemoAppointment | null>(null);
  const [error, setError] = useState("");
  return (
    <main className="appointment-form-page">
      <section className="appointment-form-card">
        <h1>{booking ? "Demo appointment booked" : "Demo appointment"}</h1>
        <p className="account-note">No real clinic is contacted.</p>
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
            <Link className="button primary" href="/">
              Back to Milo
            </Link>
          </>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setError("");
              const fields = new FormData(event.currentTarget);
              try {
                setBooking(
                  bookDemoAppointment({
                    clinicianId: fields.get("doctor"),
                    date: fields.get("date"),
                    time: fields.get("time"),
                  }),
                );
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "The appointment could not be saved.",
                );
              }
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
            {error && (
              <p className="appointment-form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary" type="submit">
              Book demo appointment
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
