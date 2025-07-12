import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { measurements } from "./schema";
import type { InferInsertModel } from "drizzle-orm";

export const db = drizzle({
  connection: {
    connectionString: process.env.DATABASE_URL ?? "",
  },
});

async function main() {
  await db.transaction(async (tx) => {
    const weight: InferInsertModel<typeof measurements> = {
      name: "weight",
      unit: "kg",
      description: "One of the most important measures for overall fitness",
    };
    await tx.insert(measurements).values([weight]).onConflictDoNothing();
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
