"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  addPending,
  getPending,
  getServerPending,
  removePending,
  subscribePending,
  updatePending,
  type PendingEntry,
  type PendingStatus,
} from "@/lib/pending-entries";
import { dayToRecordedAt } from "@/lib/dates";
import type { Unit } from "@/lib/units";

export type Entry = {
  id: string;
  /** ISO timestamp. */
  recordedAt: string;
  weight: number;
  unit: Unit;
  note: string | null;
  /** Set for entries that only exist on this device so far. */
  pendingStatus?: PendingStatus;
  error?: string;
};

type OfflineContextValue = {
  online: boolean;
  /** When the server rendered the data on screen (ISO timestamp). */
  renderedAt: string;
  /** True while a saved copy is on screen and fresh data is on its way. */
  updating: boolean;
  /** Entries on this device that aren't in the server's list yet. */
  pending: PendingEntry[];
  queueEntry: (entry: Omit<PendingEntry, "id" | "status">) => void;
  discardPending: (id: string) => void;
};

const OfflineContext = createContext<OfflineContextValue | null>(null);

// A synced entry normally disappears from the queue once the next server
// render includes it. If that never happens (say it was deleted from another
// device first), drop it after this long anyway.
const SYNCED_TTL_MS = 60 * 60 * 1000;
const RETRY_INTERVAL_MS = 30 * 1000;
const RECONNECT_CHECK_MS = 15 * 1000;

// The service worker opens the dashboard from its saved copy so the app is
// usable straight away, even while a cold server wakes up. Data rendered more
// than this long ago is treated as a saved copy and refreshed once the server
// answers.
const STALE_AFTER_MS = 30 * 1000;
// If a refresh fails, Next.js falls back to reloading the page, which opens
// the saved copy again. Never auto-refresh more often than this, so a server
// that keeps failing can't cause a reload loop.
const AUTO_REFRESH_MIN_GAP_MS = 60 * 1000;
const AUTO_REFRESH_KEY = "weightsnap:auto-refresh-at";
let lastAutoRefreshInMemory = 0;
// Set while waiting out that gap with saved data still on screen.
let staleRetryTimer: ReturnType<typeof setTimeout> | undefined;

function isStale(renderedAt: string) {
  return Date.now() - Date.parse(renderedAt) > STALE_AFTER_MS;
}

/** Records an automatic refresh, or returns false if one ran too recently. */
function claimAutoRefresh(): boolean {
  const now = Date.now();
  let last = lastAutoRefreshInMemory;
  try {
    last = Math.max(last, Number(sessionStorage.getItem(AUTO_REFRESH_KEY)) || 0);
  } catch {
    // sessionStorage unavailable: the in-memory value still limits this page.
  }
  if (now - last < AUTO_REFRESH_MIN_GAP_MS) return false;

  // Only record refreshes that actually run, so refused attempts (say, the
  // checks made every few seconds while offline) don't keep pushing the
  // window forward.
  lastAutoRefreshInMemory = now;
  try {
    sessionStorage.setItem(AUTO_REFRESH_KEY, String(now));
  } catch {
    // As above.
  }
  return true;
}

function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

// Whether the last request to the server got through.
let serverReachable = true;
const reachabilityListeners = new Set<() => void>();

function setServerReachable(value: boolean) {
  if (value === serverReachable) return;
  serverReachable = value;
  reachabilityListeners.forEach((listener) => listener());
}

function subscribeReachability(listener: () => void) {
  reachabilityListeners.add(listener);
  return () => {
    reachabilityListeners.delete(listener);
  };
}

type SyncResult = { synced: number; reachable: boolean };

// One sync at a time across the page, however many triggers fire.
let syncInFlight: Promise<SyncResult> | null = null;

function syncPending(userId: string): Promise<SyncResult> {
  syncInFlight ??= uploadPending(userId).finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

/** Can the server be reached at all? */
async function checkServer(): Promise<boolean> {
  try {
    await fetch("/api/health", { cache: "no-store" });
    return true;
  } catch {
    return false;
  }
}

/** Uploads unsynced entries in order and reports how many the server took. */
async function uploadPending(userId: string): Promise<SyncResult> {
  const unsynced = getPending(userId).filter((e) => e.status !== "synced");
  if (unsynced.length === 0) return { synced: 0, reachable: await checkServer() };

  let synced = 0;
  for (const entry of unsynced) {
    let res: Response;
    try {
      res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: entry.id,
          weight: entry.weight,
          unit: entry.unit,
          recordedAt: entry.recordedAt,
          note: entry.note,
        }),
      });
    } catch {
      // No connection (or the server is unreachable). Try again later.
      return { synced, reachable: false };
    }

    if (res.ok) {
      updatePending(userId, entry.id, {
        status: "synced",
        error: undefined,
        syncedAt: Date.now(),
      });
      synced++;
    } else if (res.status === 401) {
      updatePending(userId, entry.id, {
        status: "error",
        error: "Sign in again to sync",
      });
      break;
    } else if (res.status >= 500) {
      break;
    } else {
      // Rejected as invalid. Keep it visible so it can be deleted by hand
      // rather than dropping data silently.
      updatePending(userId, entry.id, {
        status: "error",
        error: "Couldn't save this entry",
      });
    }
  }
  return { synced, reachable: true };
}

/** Asks the service worker to save a fresh copy of the page for offline use. */
function refreshOfflineCopy() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready
    .then((registration) =>
      registration.active?.postMessage({ type: "cache-page", path: location.pathname }),
    )
    .catch(() => {});
}

export function OfflineProvider({
  userId,
  serverEntryIds,
  renderedAt,
  children,
}: {
  userId: string;
  serverEntryIds: string[];
  renderedAt: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  // renderedAt of the data on screen once it's known to be a saved copy that
  // still needs refreshing. Fresh data brings a new renderedAt, which ends it.
  const [savedCopyFrom, setSavedCopyFrom] = useState<string | null>(null);
  const renderedAtRef = useRef(renderedAt);
  useEffect(() => {
    renderedAtRef.current = renderedAt;
  }, [renderedAt]);

  // Opened from a saved copy: start loading fresh data straight away rather
  // than after the connection check, so a cold server wakes for both at once.
  // If this fails, the rate limit in claimAutoRefresh stops a reload loop.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (navigator.onLine && isStale(renderedAtRef.current) && claimAutoRefresh()) {
        setSavedCopyFrom(renderedAtRef.current);
        startRefresh(() => router.refresh());
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [router]);

  const browserOnline = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const reachable = useSyncExternalStore(
    subscribeReachability,
    () => serverReachable,
    () => true,
  );
  const online = browserOnline && reachable;
  const queue = useSyncExternalStore(
    subscribePending,
    () => getPending(userId),
    getServerPending,
  );

  const idsKey = serverEntryIds.join(",");
  const serverIds = useMemo(() => new Set(idsKey ? idsKey.split(",") : []), [idsKey]);

  // Forget synced entries once the server's list has them.
  useEffect(() => {
    const now = Date.now();
    const done = queue
      .filter(
        (e) =>
          e.status === "synced" &&
          (serverIds.has(e.id) || now - (e.syncedAt ?? 0) > SYNCED_TTL_MS),
      )
      .map((e) => e.id);
    if (done.length) removePending(userId, done);
  }, [queue, serverIds, userId]);

  // Also serves as the connection check: with nothing to upload it just pings
  // the server. Once the server answers, a saved copy still on screen (say,
  // one opened while offline) is replaced with fresh data.
  const syncRef = useRef<() => void>(() => {});
  const sync = useCallback(async () => {
    const { synced, reachable } = await syncPending(userId);
    setServerReachable(reachable);
    if (synced > 0) {
      startRefresh(() => router.refresh());
    } else if (reachable && isStale(renderedAtRef.current)) {
      setSavedCopyFrom(renderedAtRef.current);
      if (claimAutoRefresh()) {
        startRefresh(() => router.refresh());
      } else if (!staleRetryTimer) {
        // A refresh ran moments ago (and failed, or the data would be fresh).
        // Try again once the gap has passed rather than leaving saved data
        // up until the app is next brought to the foreground.
        staleRetryTimer = setTimeout(() => {
          staleRetryTimer = undefined;
          syncRef.current();
        }, AUTO_REFRESH_MIN_GAP_MS);
      }
    }
  }, [userId, router]);
  useEffect(() => {
    syncRef.current = sync;
  }, [sync]);

  // Sync on load, when the connection comes back, when the app returns to
  // the foreground, and every so often while something is still waiting.
  // iOS has no Background Sync, so this only runs while the app is open.
  const hasUnsynced = queue.some((e) => e.status === "pending");
  const retryEvery = !reachable
    ? RECONNECT_CHECK_MS
    : hasUnsynced
      ? RETRY_INTERVAL_MS
      : null;
  useEffect(() => {
    sync();
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", onVisible);
    const timer = retryEvery ? setInterval(sync, retryEvery) : undefined;
    return () => {
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [sync, retryEvery]);

  // Keep the offline copy of the page current. A full page load through the
  // service worker already saved one, so skip the first render unless the
  // service worker wasn't in control yet (the very first visit).
  const firstRender = useRef(true);
  useEffect(() => {
    const isFirst = firstRender.current;
    firstRender.current = false;
    if (isFirst && navigator.serviceWorker?.controller) return;
    refreshOfflineCopy();
  }, [renderedAt]);

  const queueEntry = useCallback(
    (entry: Omit<PendingEntry, "id" | "status">) => {
      addPending(userId, { ...entry, id: crypto.randomUUID(), status: "pending" });
      sync();
    },
    [userId, sync],
  );

  const discardPending = useCallback(
    (id: string) => removePending(userId, [id]),
    [userId],
  );

  const pending = useMemo(
    () => queue.filter((e) => !serverIds.has(e.id)),
    [queue, serverIds],
  );

  const updating = savedCopyFrom === renderedAt;

  const value = useMemo(
    () => ({ online, renderedAt, updating, pending, queueEntry, discardPending }),
    [online, renderedAt, updating, pending, queueEntry, discardPending],
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOfflineState() {
  const value = useContext(OfflineContext);
  if (!value) throw new Error("useOfflineState must be used inside OfflineProvider");
  return value;
}

/** Server entries plus the ones still on this device, without duplicates. */
export function useMergedEntries(entries: Entry[]): Entry[] {
  const { pending } = useOfflineState();
  return useMemo(
    () => [
      ...entries,
      ...pending.map((p) => ({
        id: p.id,
        recordedAt: dayToRecordedAt(p.recordedAt),
        weight: p.weight,
        unit: p.unit,
        note: p.note,
        pendingStatus: p.status,
        error: p.error,
      })),
    ],
    [entries, pending],
  );
}
