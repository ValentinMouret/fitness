import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { env } from "./app/env.server";

export default defineConfig({
  out: "./drizzle",
  schema: "./app/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});
