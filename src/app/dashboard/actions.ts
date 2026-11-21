"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth, signOut } from "@/auth";
import { db } from "@/db";
import { goals, users, weightEntries } from "@/db/schema";
import type { Unit } from "@/lib/units";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }
  return session.user.id;
}

export async function deleteEntry(entryId: string) {
  const userId = await requireUserId();
  await db
    .delete(weightEntries)
    .where(and(eq(weightEntries.id, entryId), eq(weightEntries.userId, userId)));

  revalidatePath("/dashboard");
}

const goalSchema = z.object({
  targetWeight: z.coerce.number().positive().max(2000),
  unit: z.enum(["lbs", "kg"]),
});

export async function setGoal(formData: FormData) {
  const userId = await requireUserId();
  const parsed = goalSchema.parse({
    targetWeight: formData.get("targetWeight"),
    unit: formData.get("unit"),
  });

  await db
    .insert(goals)
    .values({
      userId,
      targetWeight: parsed.targetWeight.toString(),
      unit: parsed.unit,
    })
    .onConflictDoUpdate({
      target: goals.userId,
      set: { targetWeight: parsed.targetWeight.toString(), unit: parsed.unit },
    });

  revalidatePath("/dashboard");
}

export async function deleteGoal() {
  const userId = await requireUserId();
  await db.delete(goals).where(eq(goals.userId, userId));
  revalidatePath("/dashboard");
}

export async function setPreferredUnit(unit: Unit) {
  const userId = await requireUserId();
  await db.update(users).set({ preferredUnit: unit }).where(eq(users.id, userId));
  revalidatePath("/dashboard");
}

export async function signOutUser() {
  await signOut({ redirectTo: "/" });
}
