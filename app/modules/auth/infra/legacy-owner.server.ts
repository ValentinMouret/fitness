import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "~/db";
import { authInvitations, authUsers } from "~/db/schema";
import { env } from "~/env.server";
import { type AuthenticatedUser, userIdSchema } from "../domain/user";

export async function findLegacyOwner(
  database: typeof db,
  ownerUserId: string,
): Promise<AuthenticatedUser | null> {
  const [user] = await database
    .select({ id: authUsers.id, email: authUsers.email })
    .from(authUsers)
    .innerJoin(authInvitations, eq(authInvitations.userId, authUsers.id))
    .where(
      and(
        eq(authUsers.id, ownerUserId),
        eq(authInvitations.invitedBy, authUsers.id),
        isNotNull(authInvitations.acceptedAt),
        isNull(authInvitations.revokedAt),
      ),
    );
  return user ? { id: userIdSchema.parse(user.id), email: user.email } : null;
}

export async function requireLegacyOwnerIdentity(): Promise<AuthenticatedUser> {
  const ownerUserId = env.AUTH_FOUNDATION_OWNER_USER_ID;
  const owner = ownerUserId ? await findLegacyOwner(db, ownerUserId) : null;
  if (!owner)
    throw new Response("Owner identity is not configured", { status: 503 });
  return owner;
}
