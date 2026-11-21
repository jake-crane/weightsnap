import type { Unit } from "./units";

// Weight entries logged on this device that the server may not have yet.
// Every new entry goes through this queue, online or not, so there is one
// code path. Entries are kept in localStorage, keyed by user, so they survive
// the app being closed while offline.

export type PendingStatus = "pending" | "synced" | "error";

export type PendingEntry = {
  id: string;
  weight: number;
  unit: Unit;
  /** The date picked in the form, as YYYY-MM-DD. */
  recordedAt: string;
  note: string | null;
  status: PendingStatus;
  error?: string;
  /** When the server accepted it, in ms since the epoch. */
  syncedAt?: number;
};

const EMPTY: PendingEntry[] = [];
const listeners = new Set<() => void>();
// Keeps the last value per user so snapshots stay referentially stable for
// useSyncExternalStore, and so the queue still works if storage is blocked.
const memory = new Map<string, PendingEntry[]>();

function storageKey(userId: string) {
  return `weightsnap:pending:${userId}`;
}

function load(userId: string): PendingEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as PendingEntry[]) : [];
  } catch {
    return [];
  }
}

export function getPending(userId: string): PendingEntry[] {
  let value = memory.get(userId);
  if (!value) {
    value = load(userId);
    memory.set(userId, value);
  }
  return value;
}

export function getServerPending(): PendingEntry[] {
  return EMPTY;
}

function save(userId: string, entries: PendingEntry[]) {
  memory.set(userId, entries);
  try {
    if (entries.length) {
      localStorage.setItem(storageKey(userId), JSON.stringify(entries));
    } else {
      localStorage.removeItem(storageKey(userId));
    }
  } catch {
    // Storage unavailable: the entry lives in memory until the page closes.
  }
  listeners.forEach((listener) => listener());
}

export function subscribePending(listener: () => void) {
  // Another tab changed the queue: drop the cached copy and re-read.
  const onStorage = (event: StorageEvent) => {
    if (event.key?.startsWith("weightsnap:pending:")) {
      memory.clear();
      listener();
    }
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function addPending(userId: string, entry: PendingEntry) {
  save(userId, [...getPending(userId), entry]);
}

export function updatePending(
  userId: string,
  id: string,
  patch: Partial<PendingEntry>,
) {
  save(
    userId,
    getPending(userId).map((e) => (e.id === id ? { ...e, ...patch } : e)),
  );
}

export function removePending(userId: string, ids: string[]) {
  const drop = new Set(ids);
  const current = getPending(userId);
  const next = current.filter((e) => !drop.has(e.id));
  if (next.length !== current.length) save(userId, next);
}
