import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "~/db";
import { authInvitations } from "~/db/schema";
import { env } from "~/env.server";
import type { UserId } from "~/modules/auth/domain/user";

export function canManageCatalogue(userId: UserId): boolean {
  return env.AUTH_FOUNDATION_OWNER_USER_ID === userId;
}

export async function requireCatalogueOwner(
  userId: UserId,
  database: Pick<typeof db, "select"> = db,
): Promise<void> {
  if (!canManageCatalogue(userId))
    throw new Response("Catalogue correction requires the original owner", {
      status: 403,
    });
  const [invitation] = await database
    .select({ userId: authInvitations.userId })
    .from(authInvitations)
    .where(
      and(
        eq(authInvitations.userId, userId),
        eq(authInvitations.invitedBy, userId),
        isNotNull(authInvitations.acceptedAt),
        isNull(authInvitations.revokedAt),
      ),
    )
    .for("share");
  if (!invitation)
    throw new Response("Catalogue owner is not admitted", { status: 403 });
}
