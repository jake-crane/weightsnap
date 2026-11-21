"use client";

import { format } from "date-fns";
import { useOfflineState } from "@/components/offline-provider";

export function OfflineBanner() {
  const { online, renderedAt, pending } = useOfflineState();
  const unsynced = pending.filter((e) => e.status === "pending").length;

  if (online && unsynced === 0) return null;

  const waiting =
    unsynced === 1 ? "1 entry is waiting to sync." : `${unsynced} entries are waiting to sync.`;

  return (
    <div
      role="status"
      className="rounded-lg border px-4 py-3 text-sm lg:col-span-2"
      style={{
        borderColor: "var(--border)",
        background: "var(--surface)",
        color: "var(--text-secondary)",
      }}
    >
      {online ? (
        <>Syncing… {waiting}</>
      ) : (
        <>
          <span className="font-medium" style={{ color: "var(--foreground)" }}>
            You&apos;re offline.
          </span>{" "}
          Showing data from {format(new Date(renderedAt), "MMM d, h:mm a")}. New entries are
          saved on this device and sync when you reconnect.
          {unsynced > 0 && <> {waiting}</>}
        </>
      )}
    </div>
  );
}
