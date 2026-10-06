import "dotenv/config";
import { and, eq, type InferInsertModel, isNotNull, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "~/env.server";
import { authInvitations, authUsers, measurements } from "./schema";

export const db = drizzle({
  connection: {
    connectionString: env.DATABASE_URL,
  },
});

let connectionClosed = false;

export async function closeConnections() {
  if (connectionClosed) return;
  connectionClosed = true;
  await db.$client.end();
}

async function main() {
  try {
    const ownerId = env.AUTH_FOUNDATION_OWNER_USER_ID;
    if (!ownerId)
      throw new Error(
        "Configure and explicitly bootstrap the owner before seeding measurements",
      );
    const [owner] = await db
      .select({ id: authUsers.id })
      .from(authUsers)
      .innerJoin(authInvitations, eq(authInvitations.userId, authUsers.id))
      .where(
        and(
          eq(authUsers.id, ownerId),
          eq(authInvitations.invitedBy, authUsers.id),
          isNotNull(authInvitations.acceptedAt),
          isNull(authInvitations.revokedAt),
        ),
      );
    if (!owner) throw new Error("Owner identity is not bootstrapped");
    await db.transaction(async (tx) => {
      const weight: InferInsertModel<typeof measurements> = {
        userId: owner.id,
        name: "weight",
        unit: "kg",
        description: "One of the most important measures for overall fitness",
      };
      const dailyCalorieIntake: InferInsertModel<typeof measurements> = {
        userId: owner.id,
        name: "daily_calorie_intake",
        unit: "Cal",
        description: "Amount of calories to consume",
      };
      await tx
        .insert(measurements)
        .values([weight, dailyCalorieIntake])
        .onConflictDoNothing();
    });
  } finally {
    await closeConnections();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
