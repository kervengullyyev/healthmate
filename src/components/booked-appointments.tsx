"use client";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { clinicians } from "@/lib/demo";
import {
  formatAppointmentDate,
  type DemoAppointment,
} from "@/lib/demo-appointments";

export function BookedAppointments({
  appointments,
}: {
  appointments: DemoAppointment[];
}) {
  return (
    <div className="booked-appointments">
      <p className="account-note">Demo bookings. No clinic is contacted.</p>
      {appointments.length ? (
        <ol>
          {[...appointments]
            .sort((a, b) =>
              `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
            )
            .map((appointment) => {
              const doctor = clinicians.find(
                (clinician) => clinician.id === appointment.clinicianId,
              )!;
              return (
                <li key={appointment.id}>
                  <CalendarDays size={22} aria-hidden="true" />
                  <div>
                    <strong>{doctor.name}</strong>
                    <p>
                      {formatAppointmentDate(appointment.date)} ·{" "}
                      {appointment.time}
                    </p>
                    <span>{doctor.format} · Booked</span>
                    {appointment.description && (
                      <p className="appointment-description">
                        {appointment.description}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
        </ol>
      ) : (
        <p className="appointments-empty">No booked appointments yet.</p>
      )}
      <Link className="button primary" href="/appointments/new">
        Book demo appointment
      </Link>
    </div>
  );
}
