import { and, eq, gt, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { err, ok } from "neverthrow";
import type { Pool } from "pg";
import { authInvitations, authSessions, authUsers } from "~/db/schema";
import { canManageInvitations, type Invitation } from "../domain/invitation";

export function createInvitationRepository(pool: Pool, ownerUserId: string) {
  const database = drizzle(pool);
  const selection = {
    id: authInvitations.id,
    email: authUsers.email,
    expiresAt: authInvitations.expiresAt,
    acceptedAt: authInvitations.acceptedAt,
    revokedAt: authInvitations.revokedAt,
  };
  async function findByEmail(email: string): Promise<Invitation | null> {
    const [invitation] = await database
      .select(selection)
      .from(authInvitations)
      .innerJoin(authUsers, eq(authUsers.id, authInvitations.userId))
      .where(eq(authUsers.email, email));
    return invitation ?? null;
  }
  async function findByUserId(userId: string): Promise<Invitation | null> {
    const [invitation] = await database
      .select(selection)
      .from(authInvitations)
      .innerJoin(authUsers, eq(authUsers.id, authInvitations.userId))
      .where(eq(authUsers.id, userId));
    return invitation ?? null;
  }
  async function list(actorUserId: string) {
    if (!canManageInvitations(actorUserId, ownerUserId))
      return err("forbidden" as const);
    const invitations = await database
      .select({ ...selection, userId: authUsers.id })
      .from(authInvitations)
      .innerJoin(authUsers, eq(authUsers.id, authInvitations.userId));
    return ok(
      invitations.filter((invitation) => invitation.userId !== ownerUserId),
    );
  }
  async function invite(input: {
    readonly actorUserId: string;
    readonly email: string;
    readonly name: string;
    readonly expiresAt: Date;
  }) {
    if (!canManageInvitations(input.actorUserId, ownerUserId))
      return err("forbidden" as const);
    return database.transaction(async (tx) => {
      const [user] = await tx
        .insert(authUsers)
        .values({ name: input.name, email: input.email })
        .onConflictDoNothing({ target: authUsers.email })
        .returning();
      if (!user) return err("already_invited" as const);
      const [invitation] = await tx
        .insert(authInvitations)
        .values({
          userId: user.id,
          invitedBy: ownerUserId,
          expiresAt: input.expiresAt,
        })
        .returning();
      return ok({ user, invitation });
    });
  }
  async function accept(userId: string, now: Date) {
    await database
      .update(authInvitations)
      .set({ acceptedAt: now })
      .where(
        and(
          eq(authInvitations.userId, userId),
          isNull(authInvitations.acceptedAt),
          isNull(authInvitations.revokedAt),
          gt(authInvitations.expiresAt, now),
        ),
      );
  }
  async function revoke(input: {
    readonly actorUserId: string;
    readonly userId: string;
    readonly now: Date;
  }) {
    if (
      !canManageInvitations(input.actorUserId, ownerUserId) ||
      input.userId === ownerUserId
    )
      return err("forbidden" as const);
    await database.transaction(async (tx) => {
      await tx
        .update(authInvitations)
        .set({ revokedAt: input.now })
        .where(eq(authInvitations.userId, input.userId));
      await tx
        .delete(authSessions)
        .where(eq(authSessions.userId, input.userId));
    });
    return ok(undefined);
  }
  return { findByEmail, findByUserId, list, invite, accept, revoke };
}
