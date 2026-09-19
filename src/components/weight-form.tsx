"use client";

import { useRef } from "react";
import { addEntry } from "@/app/dashboard/actions";
import type { Unit } from "@/lib/units";

export function WeightForm({ defaultUnit }: { defaultUnit: Unit }) {
  const formRef = useRef<HTMLFormElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await addEntry(formData);
        formRef.current?.reset();
      }}
      className="flex flex-col gap-3 rounded-lg border p-4"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <h2 className="text-sm font-medium">Log a weight</h2>
      <div className="flex gap-2">
        <input
          name="weight"
          type="number"
          step="0.1"
          min="0"
          required
          placeholder="Weight"
          className="w-full rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)" }}
        />
        <select
          name="unit"
          defaultValue={defaultUnit}
          className="rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)" }}
        >
          <option value="lbs">lbs</option>
          <option value="kg">kg</option>
        </select>
      </div>
      <input
        name="recordedAt"
        type="date"
        defaultValue={today}
        required
        className="rounded-md border px-3 py-2 text-sm"
        style={{ borderColor: "var(--border)" }}
      />
      <textarea
        name="note"
        placeholder="Note (optional)"
        rows={2}
        maxLength={500}
        className="rounded-md border px-3 py-2 text-sm"
        style={{ borderColor: "var(--border)" }}
      />
      <button
        type="submit"
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        Save entry
      </button>
    </form>
  );
}
