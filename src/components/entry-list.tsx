"use client";

import { format } from "date-fns";
import { deleteEntry } from "@/app/dashboard/actions";
import { toUnit, type Unit } from "@/lib/units";

export type Entry = {
  id: string;
  recordedAt: string;
  weight: number;
  unit: Unit;
  note: string | null;
};

export function EntryList({
  entries,
  displayUnit,
}: {
  entries: Entry[];
  displayUnit: Unit;
}) {
  const sorted = [...entries].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );

  if (sorted.length === 0) return null;

  return (
    <div
      className="overflow-x-auto rounded-lg border"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr
            className="text-left"
            style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--gridline)" }}
          >
            <th className="px-4 py-2 font-medium">Date</th>
            <th className="px-4 py-2 font-medium">Weight</th>
            <th className="px-4 py-2 font-medium">Note</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry) => (
            <tr key={entry.id} style={{ borderTop: "1px solid var(--gridline)" }}>
              <td className="px-4 py-2 whitespace-nowrap">
                {format(new Date(entry.recordedAt), "MMM d, yyyy")}
              </td>
              <td className="px-4 py-2 font-medium tabular-nums">
                {toUnit(entry.weight, entry.unit, displayUnit).toFixed(1)} {displayUnit}
              </td>
              <td
                className="px-4 py-2 max-w-xs truncate"
                style={{ color: "var(--text-secondary)" }}
              >
                {entry.note}
              </td>
              <td className="px-4 py-2 text-right">
                <form action={deleteEntry.bind(null, entry.id)}>
                  <button
                    type="submit"
                    className="text-xs"
                    style={{ color: "var(--status-critical)" }}
                  >
                    Delete
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
