import { format } from "date-fns";

// An entry's recordedAt is a calendar day, not a moment: the form's
// YYYY-MM-DD is stored as midnight UTC on that day. Reading it back in local
// time would land on the previous evening anywhere west of UTC, so these
// helpers work with the YYYY-MM-DD part only.

/** The stored day as a local Date at midnight, for formatting. */
export function entryDay(recordedAt: string): Date {
  const [year, month, day] = recordedAt.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatEntryDate(recordedAt: string, pattern: string): string {
  return format(entryDay(recordedAt), pattern);
}

/** Today's date where the user is, as YYYY-MM-DD for a date input. */
export function localDateString(date: Date = new Date()): string {
  return format(date, "yyyy-MM-dd");
}

/** The ISO timestamp the server stores for a YYYY-MM-DD day. */
export function dayToRecordedAt(day: string): string {
  return `${day}T00:00:00.000Z`;
}
