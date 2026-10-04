"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, FileText, UserRound, X } from "lucide-react";
import { Appointments } from "@/components/appointments";
import { clinicians } from "@/lib/demo";
import type { Booking, Message } from "@/lib/domain";

const sections = [
  { name: "Profile", Icon: UserRound },
  { name: "Appointments", Icon: CalendarDays },
  { name: "Records", Icon: FileText },
] as const;
type Section = (typeof sections)[number]["name"];
const bookingKey = "healthmate-demo-booking";

function savedBooking(): Booking | null {
  try {
    const saved = JSON.parse(localStorage.getItem(bookingKey) ?? "null");
    if (
      saved?.demo === true &&
      typeof saved.id === "string" &&
      saved.id.length > 0 &&
      saved.id.length <= 120 &&
      typeof saved.slot === "string" &&
      saved.slot.length > 0 &&
      saved.slot.length <= 200 &&
      clinicians.some((clinician) => clinician.id === saved.clinicianId)
    )
      return saved;
  } catch {
    /* A demo booking is optional when browser storage is unavailable. */
  }
  return null;
}

export function AccountMenu({
  messages,
  beforeOpen,
}: {
  messages: Message[];
  beforeOpen: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Section | null>(null);
  const [opening, setOpening] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [draftName, setDraftName] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [storageNotice, setStorageNotice] = useState("");
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  useEffect(() => {
    if (panel && !dialog.current?.open) dialog.current?.showModal();
  }, [panel]);

  async function select(section: Section) {
    setOpen(false);
    setOpening(true);
    try {
      await beforeOpen();
      if (section === "Profile") setDraftName(profileName);
      if (section === "Appointments")
        setBooking((current) => savedBooking() ?? current);
      setPanel(section);
    } finally {
      setOpening(false);
    }
  }

  return (
    <>
      <div className="account-menu" ref={wrapper}>
        <button
          ref={trigger}
          className="account-icon"
          aria-label="Open account menu"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls="account-options"
          disabled={opening}
          onClick={() => setOpen(!open)}
        >
          <UserRound size={21} aria-hidden="true" />
        </button>
        {open && (
          <div
            ref={menu}
            id="account-options"
            role="menu"
            aria-label="Your account"
            className="account-options"
            onKeyDown={(event) => {
              const items = Array.from(
                menu.current?.querySelectorAll<HTMLButtonElement>("button") ??
                  [],
              );
              const index = items.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              if (event.key === "Escape" || event.key === "Tab") {
                setOpen(false);
                if (event.key === "Escape") {
                  event.preventDefault();
                  trigger.current?.focus();
                }
              } else if (
                ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
              ) {
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? items.length - 1
                      : (index +
                          (event.key === "ArrowDown" ? 1 : -1) +
                          items.length) %
                        items.length;
                items[next]?.focus();
              }
            }}
          >
            {sections.map(({ name, Icon }) => (
              <button
                key={name}
                role="menuitem"
                tabIndex={-1}
                onClick={() => void select(name)}
              >
                <Icon size={18} aria-hidden="true" />
                {name}
              </button>
            ))}
          </div>
        )}
      </div>
      <dialog
        ref={dialog}
        className={`account-panel ${panel === "Appointments" ? "account-panel-wide" : ""}`}
        aria-labelledby="account-title"
        onClose={() => {
          setPanel(null);
          trigger.current?.focus();
        }}
      >
        {panel && (
          <>
            <div className="account-panel-heading">
              <h2 id="account-title">{panel}</h2>
              <button
                className="account-icon"
                aria-label="Close panel"
                onClick={() => dialog.current?.close()}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            {panel === "Profile" && (
              <form
                className="account-profile"
                onSubmit={(event) => {
                  event.preventDefault();
                  setProfileName(draftName.trim());
                  dialog.current?.close();
                }}
              >
                <p>A little about you.</p>
                <label htmlFor="profile-name">Your name</label>
                <input
                  id="profile-name"
                  autoComplete="given-name"
                  maxLength={80}
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                />
                <p className="account-note">
                  Your profile stays in this page session. Refreshing clears it.
                </p>
                <button className="button primary" type="submit">
                  Save profile
                </button>
              </form>
            )}
            {panel === "Appointments" && (
              <>
                <Appointments
                  booking={booking}
                  briefLabel="View conversation records"
                  confirmNote="You can review your conversation with Milo in Records."
                  onBrief={() => setPanel("Records")}
                  onConfirm={(next) => {
                    setBooking(next);
                    try {
                      localStorage.setItem(bookingKey, JSON.stringify(next));
                      setStorageNotice("");
                    } catch {
                      setStorageNotice(
                        "This sample appointment is saved for this page session only.",
                      );
                    }
                  }}
                />
                {storageNotice && (
                  <p className="account-note" role="status">
                    {storageNotice}
                  </p>
                )}
              </>
            )}
            {panel === "Records" && (
              <div className="account-records">
                <p className="account-note">
                  Your current conversation with Milo stays in this page
                  session. Refreshing or starting a new conversation clears it.
                </p>
                {messages.length ? (
                  <ol>
                    {messages.map((message) => (
                      <li key={message.id}>
                        <strong>
                          {message.role === "user" ? "You" : "Milo"}
                        </strong>
                        <p>{message.content}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="account-empty">
                    <FileText size={30} aria-hidden="true" />
                    <h3>No conversation records yet.</h3>
                    <p>Talk to Milo to create a conversation record.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </dialog>
    </>
  );
}
