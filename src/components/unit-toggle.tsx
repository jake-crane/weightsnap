"use client";

import { setPreferredUnit } from "@/app/dashboard/actions";
import type { Unit } from "@/lib/units";

export function UnitToggle({ unit }: { unit: Unit }) {
  return (
    <div
      className="inline-flex overflow-hidden rounded-md border text-xs"
      style={{ borderColor: "var(--border)" }}
    >
      {(["lbs", "kg"] as const).map((u) => (
        <form key={u} action={setPreferredUnit.bind(null, u)}>
          <button
            type="submit"
            className="px-2 py-1"
            style={
              u === unit
                ? { background: "var(--series-1)", color: "white" }
                : { color: "var(--text-secondary)" }
            }
          >
            {u}
          </button>
        </form>
      ))}
    </div>
  );
}
