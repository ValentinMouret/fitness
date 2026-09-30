import { describe, expect, it } from "vitest";
import {
  canManageInvitations,
  type Invitation,
  invitationAllowsSignIn,
  invitedEmailSchema,
} from "./invitation";

const now = new Date("2026-09-30T12:00:00Z");
const email = "invited@example.invalid";
const invitation: Invitation = {
  id: "invitation-id",
  email,
  expiresAt: new Date("2026-10-01T12:00:00Z"),
  acceptedAt: null,
  revokedAt: null,
};

describe("invitation-only email admission", () => {
  it("normalizes email at the input boundary and rejects invalid addresses", () => {
    expect(invitedEmailSchema.parse(" Invited@Example.Invalid ")).toBe(email);
    expect(invitedEmailSchema.safeParse("not-an-email").success).toBe(false);
  });

  it("allows an invited address before acceptance and rejects unknown addresses", () => {
    expect(invitationAllowsSignIn(invitation, email, now)).toBe(true);
    expect(invitationAllowsSignIn(null, email, now)).toBe(false);
    expect(
      invitationAllowsSignIn(invitation, "other@example.invalid", now),
    ).toBe(false);
  });

  it("rejects pending invitations at and after expiry", () => {
    expect(
      invitationAllowsSignIn(invitation, email, invitation.expiresAt),
    ).toBe(false);
    expect(
      invitationAllowsSignIn(
        { ...invitation, expiresAt: new Date(now.getTime() - 1) },
        email,
        now,
      ),
    ).toBe(false);
  });

  it("allows an accepted account to request a fresh sign-in email", () => {
    expect(
      invitationAllowsSignIn(
        {
          ...invitation,
          expiresAt: new Date(now.getTime() - 1),
          acceptedAt: now,
        },
        email,
        now,
      ),
    ).toBe(true);
  });

  it("revocation rejects both pending and accepted accounts", () => {
    expect(
      invitationAllowsSignIn({ ...invitation, revokedAt: now }, email, now),
    ).toBe(false);
    expect(
      invitationAllowsSignIn(
        { ...invitation, acceptedAt: now, revokedAt: now },
        email,
        now,
      ),
    ).toBe(false);
  });

  it("only the authenticated owner can manage invitations", () => {
    expect(canManageInvitations("owner", "owner")).toBe(true);
    expect(canManageInvitations("invited-user", "owner")).toBe(false);
    expect(canManageInvitations("", "")).toBe(false);
  });
});
