import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { goals, users, weightEntries } from "@/db/schema";
import { WeightChart } from "@/components/weight-chart";
import { WeightForm } from "@/components/weight-form";
import { GoalCard } from "@/components/goal-card";
import { EntryList } from "@/components/entry-list";
import { UnitToggle } from "@/components/unit-toggle";
import { SignOutButton } from "@/components/sign-out-button";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }
  const userId = session.user.id;

  const [user, entries, goal] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId) }),
    db.query.weightEntries.findMany({ where: eq(weightEntries.userId, userId) }),
    db.query.goals.findFirst({ where: eq(goals.userId, userId) }),
  ]);

  const displayUnit = user?.preferredUnit ?? "lbs";

  const points = entries.map((e) => ({
    recordedAt: e.recordedAt.toISOString(),
    weight: Number(e.weight),
    unit: e.unit,
    note: e.note,
  }));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start">
      <header className="flex items-center justify-between lg:col-span-2">
        <div>
          <h1 className="text-xl font-semibold">WeightSnap</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {session.user.email}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <UnitToggle unit={displayUnit} />
          <SignOutButton />
        </div>
      </header>

      <div className="order-2 flex flex-col gap-6 lg:order-1">
        <WeightChart
          points={points}
          displayUnit={displayUnit}
          goal={goal ? { targetWeight: Number(goal.targetWeight), unit: goal.unit } : null}
        />

        <EntryList
          entries={entries.map((e) => ({
            id: e.id,
            recordedAt: e.recordedAt.toISOString(),
            weight: Number(e.weight),
            unit: e.unit,
            note: e.note,
          }))}
          displayUnit={displayUnit}
        />
      </div>

      <div className="order-1 flex flex-col gap-4 lg:order-2 lg:sticky lg:top-8">
        <WeightForm defaultUnit={displayUnit} />
        <GoalCard
          goal={goal ? { targetWeight: Number(goal.targetWeight), unit: goal.unit } : null}
          displayUnit={displayUnit}
        />
      </div>
    </div>
  );
}
