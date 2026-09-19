"use client";

import { deleteGoal, setGoal } from "@/app/dashboard/actions";
import { toUnit, type Unit } from "@/lib/units";

export function GoalCard({
  goal,
  displayUnit,
}: {
  goal: { targetWeight: number; unit: Unit } | null;
  displayUnit: Unit;
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-lg border p-4"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <h2 className="text-sm font-medium">Goal weight</h2>
      {goal ? (
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold">
            {toUnit(goal.targetWeight, goal.unit, displayUnit).toFixed(1)} {displayUnit}
          </p>
          <form action={deleteGoal}>
            <button
              type="submit"
              className="text-sm"
              style={{ color: "var(--status-critical)" }}
            >
              Remove
            </button>
          </form>
        </div>
      ) : (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No goal set yet.
        </p>
      )}
      <form action={setGoal} className="flex gap-2">
        <input
          name="targetWeight"
          type="number"
          step="0.1"
          min="0"
          required
          placeholder="Target weight"
          className="w-full rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)" }}
        />
        <select
          name="unit"
          defaultValue={displayUnit}
          className="rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)" }}
        >
          <option value="lbs">lbs</option>
          <option value="kg">kg</option>
        </select>
        <button
          type="submit"
          className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
          style={{ borderColor: "var(--border)" }}
        >
          {goal ? "Update" : "Set"}
        </button>
      </form>
    </div>
  );
}
