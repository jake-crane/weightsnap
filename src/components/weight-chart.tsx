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
import { useMergedEntries, type Entry } from "@/components/offline-provider";
import { toUnit, type Unit } from "@/lib/units";

type ChartPoint = Entry;

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
      {point.pendingStatus && point.pendingStatus !== "synced" && (
        <div style={{ color: "var(--text-muted)" }}>Not synced yet</div>
      )}
      {point.note && (
        <div className="mt-1" style={{ color: "var(--text-secondary)" }}>
          {point.note}
        </div>
      )}
    </div>
  );
}

// Entries that are only on this device get a hollow dot.
function EntryDot({
  cx,
  cy,
  payload,
}: {
  cx?: number;
  cy?: number;
  payload?: ChartPoint;
}) {
  if (cx == null || cy == null) return null;
  const unsynced = payload?.pendingStatus && payload.pendingStatus !== "synced";
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={unsynced ? "var(--surface)" : "var(--series-1)"}
      stroke={unsynced ? "var(--series-1)" : "var(--surface)"}
      strokeWidth={2}
    />
  );
}

export function WeightChart({
  entries,
  displayUnit,
  goal,
}: {
  entries: Entry[];
  displayUnit: Unit;
  goal?: { targetWeight: number; unit: Unit } | null;
}) {
  const points = useMergedEntries(entries);
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
            dot={({ key, ...props }) => <EntryDot key={key} {...props} />}
            activeDot={{ r: 5, fill: "var(--series-1)", stroke: "var(--surface)", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
