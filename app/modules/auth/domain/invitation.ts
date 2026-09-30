import { z } from "zod";

export const invitedEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email());

export type Invitation = {
  readonly id: string;
  readonly email: string;
  readonly expiresAt: Date;
  readonly acceptedAt: Date | null;
  readonly revokedAt: Date | null;
};

export function invitationAllowsSignIn(
  invitation: Invitation | null,
  email: string,
  now: Date,
): boolean {
  return (
    invitation !== null &&
    invitation.email === email &&
    invitation.revokedAt === null &&
    (invitation.acceptedAt !== null || invitation.expiresAt > now)
  );
}

export function canManageInvitations(
  authenticatedUserId: string,
  ownerUserId: string,
): boolean {
  return authenticatedUserId.length > 0 && authenticatedUserId === ownerUserId;
}
