import "dotenv/config";
import type { InferInsertModel } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { measurements } from "./schema";

export const db = drizzle({
  connection: {
    connectionString: process.env.DATABASE_URL ?? "",
  },
});

let connectionClosed = false;

export async function closeConnections() {
  if (connectionClosed) return;
  connectionClosed = true;
  await db.$client.end();
}

async function main() {
  await db.transaction(async (tx) => {
    const weight: InferInsertModel<typeof measurements> = {
      name: "weight",
      unit: "kg",
      description: "One of the most important measures for overall fitness",
    };
    const dailyCalorieIntake: InferInsertModel<typeof measurements> = {
      name: "daily_calorie_intake",
      unit: "Cal",
      description: "Amount of calories to consume",
    };
    await tx
      .insert(measurements)
      .values([weight, dailyCalorieIntake])
      .onConflictDoNothing();
  });
  await closeConnections();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
