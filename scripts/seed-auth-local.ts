import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { z } from "zod";
import { invitedEmailSchema } from "../app/modules/auth/domain/invitation";
import { createInvitationRepository } from "../app/modules/auth/infra/invitation.repository.server";
import { bootstrapAuthOwner } from "../app/modules/auth/infra/owner-bootstrap.server";

const config = z
  .object({
    AUTH_LOCAL_DATABASE_URL: z.url().refine((value) => {
      const url = new URL(value);
      return (
        (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
          /^\/[a-z0-9_]+_(test|dev)$/.test(url.pathname)) ||
        (process.env.CI === "true" &&
          url.hostname === "postgres" &&
          url.pathname === "/fitness")
      );
    }, "Use an explicitly named loopback test/dev database"),
    AUTH_FOUNDATION_OWNER_USER_ID: z.uuid(),
    AUTH_LOCAL_OWNER_EMAIL: invitedEmailSchema.default("owner@example.invalid"),
  })
  .parse(process.env);
const pool = new Pool({ connectionString: config.AUTH_LOCAL_DATABASE_URL });
try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  const now = new Date();
  const owner = await bootstrapAuthOwner({
    pool,
    id: config.AUTH_FOUNDATION_OWNER_USER_ID,
    email: config.AUTH_LOCAL_OWNER_EMAIL,
    now,
  });
  if (owner.isErr()) throw new Error(owner.error);
  const invitations = createInvitationRepository(pool, owner.value.id);
  for (const email of ["first@example.invalid", "second@example.invalid"]) {
    const existing = await invitations.findByEmail(email);
    if (!existing) {
      const invited = await invitations.invite({
        actorUserId: owner.value.id,
        email,
        name: email,
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      });
      if (invited.isErr()) throw new Error(invited.error);
    }
  }
  console.log(
    "Local owner and two invited accounts are ready. Request a magic link through /sign-in; no session bypass is seeded.",
  );
} finally {
  await pool.end();
}
