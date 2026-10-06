import { eq } from "drizzle-orm";
import { db } from "~/db";
import { accountSettings } from "~/db/schema";
import { dateInTimeZone } from "~/time";
import type { UserId } from "../domain/user";

export async function getAccountTimeZone(
  userId: UserId,
  database: typeof db = db,
): Promise<string | null> {
  const [settings] = await database
    .select({ timeZone: accountSettings.timeZone })
    .from(accountSettings)
    .where(eq(accountSettings.userId, userId));
  return settings?.timeZone ?? null;
}

export async function saveAccountTimeZone(
  userId: UserId,
  timeZone: string,
  database: typeof db = db,
): Promise<void> {
  await database
    .insert(accountSettings)
    .values({ userId, timeZone })
    .onConflictDoUpdate({
      target: accountSettings.userId,
      set: { timeZone, updatedAt: new Date() },
    });
}

export async function getAccountToday(
  userId: UserId,
  now: Date = new Date(),
  database: typeof db = db,
): Promise<Date> {
  return dateInTimeZone(
    now,
    (await getAccountTimeZone(userId, database)) ?? "UTC",
  );
}

export async function requireAccountToday(
  userId: UserId,
  now: Date = new Date(),
  database: typeof db = db,
): Promise<Date> {
  const timeZone = await getAccountTimeZone(userId, database);
  if (!timeZone)
    throw new Response("Use your device timezone before logging today", {
      status: 409,
    });
  return dateInTimeZone(now, timeZone);
}
