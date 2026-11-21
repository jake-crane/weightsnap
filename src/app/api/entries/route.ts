import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { weightEntries } from "@/db/schema";

// Entries are created here rather than through a Server Action so the
// offline queue can sync them with a plain fetch to a stable URL, even from a
// page that was loaded from the service worker cache of an older build.
const entrySchema = z.object({
  id: z.uuid(),
  weight: z.number().positive().max(2000),
  unit: z.enum(["lbs", "kg"]),
  recordedAt: z.coerce.date(),
  note: z.string().max(500).nullish(),
});

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = entrySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid entry" }, { status: 400 });
  }
  const entry = parsed.data;

  // The client picks the id, so retrying an upload whose response was lost
  // doesn't create a duplicate.
  await db
    .insert(weightEntries)
    .values({
      id: entry.id,
      userId,
      weight: entry.weight.toString(),
      unit: entry.unit,
      recordedAt: entry.recordedAt,
      note: entry.note || null,
    })
    .onConflictDoNothing({ target: weightEntries.id });

  return Response.json({ ok: true });
}
