"use client";

import { format } from "date-fns";
import { deleteEntry } from "@/app/dashboard/actions";
import {
  useMergedEntries,
  useOfflineState,
  type Entry,
} from "@/components/offline-provider";
import { toUnit, type Unit } from "@/lib/units";

export type { Entry };

function SyncStatus({ entry }: { entry: Entry }) {
  if (entry.pendingStatus === "pending") {
    return (
      <span className="ml-2 text-xs font-normal" style={{ color: "var(--text-muted)" }}>
        Not synced
      </span>
    );
  }
  if (entry.pendingStatus === "error") {
    return (
      <span
        className="ml-2 text-xs font-normal"
        style={{ color: "var(--status-critical)" }}
      >
        {entry.error}
      </span>
    );
  }
  return null;
}

function DeleteButton({ entry }: { entry: Entry }) {
  const { online, discardPending } = useOfflineState();
  const className = "cursor-pointer text-xs disabled:cursor-not-allowed disabled:opacity-40";
  const style = { color: "var(--status-critical)" };

  // Still only on this device: deleting just drops it from the queue.
  if (entry.pendingStatus === "pending" || entry.pendingStatus === "error") {
    return (
      <button
        type="button"
        onClick={() => discardPending(entry.id)}
        className={className}
        style={style}
      >
        Delete
      </button>
    );
  }

  // Uploaded but not in the server's list yet: nothing to delete here yet.
  if (entry.pendingStatus === "synced") return null;

  return (
    <form action={deleteEntry.bind(null, entry.id)}>
      <button
        type="submit"
        disabled={!online}
        title={online ? undefined : "Connect to the internet to delete"}
        className={className}
        style={style}
      >
        Delete
      </button>
    </form>
  );
}

export function EntryList({
  entries,
  displayUnit,
}: {
  entries: Entry[];
  displayUnit: Unit;
}) {
  const merged = useMergedEntries(entries);
  const sorted = [...merged].sort(
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
              <td className="px-4 py-2 font-medium whitespace-nowrap tabular-nums">
                {toUnit(entry.weight, entry.unit, displayUnit).toFixed(1)} {displayUnit}
                <SyncStatus entry={entry} />
              </td>
              <td
                className="px-4 py-2 max-w-xs truncate"
                style={{ color: "var(--text-secondary)" }}
              >
                {entry.note}
              </td>
              <td className="px-4 py-2 text-right">
                <DeleteButton entry={entry} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
