"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { toUnit, type Unit } from "@/lib/units";

export type ChartPoint = {
  recordedAt: string;
  weight: number;
  unit: Unit;
  note: string | null;
};

function ChartTooltip({
  active,
  payload,
  displayUnit,
}: {
  active?: boolean;
  payload?: { payload: ChartPoint & { displayWeight: number } }[];
  displayUnit: Unit;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div
      className="rounded-md border px-3 py-2 text-sm shadow-sm"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        color: "var(--foreground)",
      }}
    >
      <div className="font-medium">
        {point.displayWeight.toFixed(1)} {displayUnit}
      </div>
      <div style={{ color: "var(--text-muted)" }}>
        {format(new Date(point.recordedAt), "MMM d, yyyy")}
      </div>
      {point.note && (
        <div className="mt-1" style={{ color: "var(--text-secondary)" }}>
          {point.note}
        </div>
      )}
    </div>
  );
}

export function WeightChart({
  points,
  displayUnit,
  goal,
}: {
  points: ChartPoint[];
  displayUnit: Unit;
  goal?: { targetWeight: number; unit: Unit } | null;
}) {
  const data = points
    .map((p) => ({
      ...p,
      displayWeight: toUnit(p.weight, p.unit, displayUnit),
    }))
    .sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
    );

  const goalDisplay = goal ? toUnit(goal.targetWeight, goal.unit, displayUnit) : null;

  if (data.length === 0) {
    return (
      <div
        className="flex h-72 items-center justify-center rounded-lg border text-sm"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        No entries yet — log your first weight to see the graph.
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid
            stroke="var(--gridline)"
            strokeDasharray="0"
            vertical={false}
          />
          <XAxis
            dataKey="recordedAt"
            tickFormatter={(v) => format(new Date(v), "MMM d")}
            stroke="var(--baseline)"
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "var(--baseline)" }}
            minTickGap={32}
          />
          <YAxis
            stroke="var(--baseline)"
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={44}
            domain={["dataMin - 2", "dataMax + 2"]}
            tickFormatter={(v: number) => v.toFixed(0)}
          />
          <Tooltip content={<ChartTooltip displayUnit={displayUnit} />} />
          {goalDisplay != null && (
            <ReferenceLine
              y={goalDisplay}
              stroke="var(--text-muted)"
              strokeDasharray="4 4"
              label={{
                value: `Goal: ${goalDisplay.toFixed(1)} ${displayUnit}`,
                position: "insideTopRight",
                fill: "var(--text-secondary)",
                fontSize: 12,
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="displayWeight"
            stroke="var(--series-1)"
            strokeWidth={2}
            dot={{ r: 4, fill: "var(--series-1)", stroke: "var(--surface)", strokeWidth: 2 }}
            activeDot={{ r: 5, fill: "var(--series-1)", stroke: "var(--surface)", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
