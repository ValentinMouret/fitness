import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { err, ok } from "neverthrow";
import type { Pool } from "pg";
import { authInvitations, authUsers } from "~/db/schema";

export async function bootstrapAuthOwner(input: {
  readonly pool: Pool;
  readonly id: string;
  readonly email: string;
  readonly now: Date;
}) {
  return drizzle(input.pool).transaction(async (tx) => {
    await tx
      .insert(authUsers)
      .values({ id: input.id, email: input.email, name: input.email })
      .onConflictDoNothing();
    const [user] = await tx
      .select()
      .from(authUsers)
      .where(and(eq(authUsers.id, input.id), eq(authUsers.email, input.email)));
    if (!user) return err("owner_identity_conflict" as const);
    await tx
      .insert(authInvitations)
      .values({
        userId: user.id,
        invitedBy: user.id,
        expiresAt: input.now,
        acceptedAt: input.now,
      })
      .onConflictDoNothing({ target: authInvitations.userId });
    return ok(user);
  });
}
