import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { logger } from "~/logger.server";

async function runMigrations() {
  const db = drizzle({
    connection: {
      connectionString: process.env.DATABASE_URL,
    },
  });

  try {
    logger.info("Running migrations...");
    await migrate(db, { migrationsFolder: "./drizzle" });
    logger.info("Migrations completed successfully");
  } catch (error) {
    logger.error({ error }, "Migration failed");
    throw error;
  } finally {
    await db.$client.end();
  }
}

runMigrations().catch((error) => {
  console.error("Migration error:", error);
  process.exit(1);
});
