"use client";

import { useState } from "react";
import { deleteGoal, setGoal } from "@/app/dashboard/actions";
import { toUnit, type Unit } from "@/lib/units";

export function GoalCard({
  goal,
  displayUnit,
}: {
  goal: { targetWeight: number; unit: Unit } | null;
  displayUnit: Unit;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div
        className="flex items-center gap-2 text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        {goal ? (
          <span>
            Goal: {toUnit(goal.targetWeight, goal.unit, displayUnit).toFixed(1)}{" "}
            {displayUnit}
          </span>
        ) : (
          <span>No goal set</span>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="underline underline-offset-2 hover:text-inherit"
        >
          {goal ? "Edit" : "Set a goal"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
      <div className="flex items-center gap-2">
        <span className="font-medium" style={{ color: "var(--text-secondary)" }}>
          Goal weight
        </span>
        <button type="button" onClick={() => setEditing(false)} className="underline underline-offset-2">
          Done
        </button>
      </div>
      <form
        action={async (formData) => {
          await setGoal(formData);
          setEditing(false);
        }}
        className="flex gap-2"
      >
        <input
          name="targetWeight"
          type="number"
          step="0.1"
          min="0"
          required
          placeholder="Target weight"
          defaultValue={goal ? toUnit(goal.targetWeight, goal.unit, displayUnit).toFixed(1) : undefined}
          className="w-28 rounded-md border px-2 py-1 text-sm"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        />
        <select
          name="unit"
          defaultValue={displayUnit}
          className="rounded-md border px-2 py-1 text-sm"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <option value="lbs">lbs</option>
          <option value="kg">kg</option>
        </select>
        <button
          type="submit"
          className="rounded-md border px-2 py-1 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          {goal ? "Update" : "Set"}
        </button>
        {goal && (
          <button
            type="button"
            onClick={async () => {
              await deleteGoal();
              setEditing(false);
            }}
            style={{ color: "var(--status-critical)" }}
          >
            Remove
          </button>
        )}
      </form>
    </div>
  );
}
