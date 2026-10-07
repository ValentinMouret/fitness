import { Button, Card, Flex, Text } from "@radix-ui/themes";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";
import { env } from "~/env.server";
import {
  canManageInvitations,
  invitationAllowsSignIn,
  invitedEmailSchema,
} from "~/modules/auth/domain/invitation";
import { getAuthFoundation } from "~/modules/auth/infra/auth-foundation.server";
import { requireLegacyOwnerIdentity } from "~/modules/auth/infra/legacy-owner.server";
import { requireSameOrigin } from "~/modules/auth/infra/session.server";
import {
  authenticatedUserContext,
  requirePersonalUser,
} from "~/modules/auth/infra/user-context.server";
import { AuthPage } from "~/modules/auth/presentation/components/AuthPage/AuthPage";
import { EmailField } from "~/modules/auth/presentation/components/EmailField/EmailField";
import type { Route } from "./+types/invitations";

export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    const user = await requirePersonalUser(request);
    await requireLegacyOwnerIdentity();
    if (!canManageInvitations(user.id, env.AUTH_FOUNDATION_OWNER_USER_ID ?? ""))
      throw new Response("Forbidden", { status: 403 });
    context.set(authenticatedUserContext, user);
    return next();
  },
];

function ownerRuntime(context: Route.LoaderArgs["context"]) {
  const runtime = getAuthFoundation();
  if (!runtime) throw new Response("Not found", { status: 404 });
  return { runtime, actorUserId: context.get(authenticatedUserContext).id };
}

export async function loader({ context }: Route.LoaderArgs) {
  const { runtime, actorUserId } = ownerRuntime(context);
  const result = await runtime.invitations.list(actorUserId);
  if (result.isErr()) throw new Response("Forbidden", { status: 403 });
  return {
    invitations: result.value
      .map((invitation) => ({
        userId: invitation.userId,
        email: invitation.email,
        status: invitation.revokedAt
          ? "Revoked"
          : invitation.acceptedAt
            ? "Accepted"
            : invitation.expiresAt <= new Date()
              ? "Expired"
              : "Invited",
      }))
      .sort((a, b) => a.email.localeCompare(b.email)),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { runtime, actorUserId } = ownerRuntime(context);
  requireSameOrigin(request);
  const form = await request.formData();
  const parsed = z
    .discriminatedUnion("intent", [
      z.object({ intent: z.literal("invite"), email: invitedEmailSchema }),
      z.object({ intent: z.literal("revoke"), userId: z.uuid() }),
      z.object({ intent: z.literal("send"), userId: z.uuid() }),
    ])
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return data(
      { error: "Enter a valid email or invitation." },
      { status: 400 },
    );
  if (parsed.data.intent === "revoke") {
    const result = await runtime.invitations.revoke({
      actorUserId,
      userId: parsed.data.userId,
      now: new Date(),
    });
    if (result.isErr()) throw new Response("Forbidden", { status: 403 });
  } else if (parsed.data.intent === "send") {
    const invitation = await runtime.invitations.findByUserId(
      parsed.data.userId,
    );
    if (
      !invitation ||
      invitation.acceptedAt !== null ||
      !invitationAllowsSignIn(invitation, invitation.email, new Date())
    ) {
      return data(
        { error: "This invitation cannot receive another sign-in email." },
        { status: 400 },
      );
    }
    try {
      await runtime.sendInvitationEmail({
        email: invitation.email,
      });
    } catch {
      return data({
        error: "Could not send the email. Use Resend email to try again.",
      });
    }
  } else {
    const result = await runtime.invitations.invite({
      actorUserId,
      email: parsed.data.email,
      name: parsed.data.email,
      expiresAt: new Date(Date.now() + env.AUTH_INVITATION_TTL_SECONDS * 1000),
    });
    if (result.isErr())
      return data(
        {
          error:
            result.error === "already_invited"
              ? "This email already has an invitation."
              : "Could not create invitation.",
        },
        { status: 400 },
      );
    try {
      await runtime.sendInvitationEmail({
        email: parsed.data.email,
      });
    } catch {
      return data({
        error:
          "Invitation created, but the email could not be sent. Use Resend email to try again.",
      });
    }
  }
  return redirect("/account/invitations");
}

export default function Invitations({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const pending = useNavigation().state !== "idle";
  return (
    <AuthPage title="Invitations">
      <Flex direction="column" gap="4">
        <Button asChild variant="soft">
          <Link to="/dashboard">Back to Dashboard</Link>
        </Button>
        <Form method="post">
          <Flex direction="column" gap="3">
            <EmailField />
            <Button
              name="intent"
              value="invite"
              type="submit"
              disabled={pending}
              loading={pending}
            >
              Invite
            </Button>
            {actionData?.error && (
              <Text as="p" role="alert" color="red">
                {actionData.error}
              </Text>
            )}
          </Flex>
        </Form>
        {loaderData.invitations.length === 0 && (
          <Text as="p">No invitations yet.</Text>
        )}
        {loaderData.invitations.map((invitation) => (
          <Card key={invitation.userId}>
            <Flex direction="column" gap="2">
              <Text as="p" className="auth-invitation-email">
                {invitation.email}
              </Text>
              <Text as="p" color="gray">
                {invitation.status}
              </Text>
              {invitation.status === "Invited" && (
                <Form method="post">
                  <input
                    type="hidden"
                    name="userId"
                    value={invitation.userId}
                  />
                  <Button
                    name="intent"
                    value="send"
                    type="submit"
                    disabled={pending}
                    variant="soft"
                    aria-label={`Resend email to ${invitation.email}`}
                  >
                    Resend email
                  </Button>
                </Form>
              )}
              {invitation.status !== "Revoked" && (
                <Form method="post">
                  <input
                    type="hidden"
                    name="userId"
                    value={invitation.userId}
                  />
                  <Button
                    name="intent"
                    value="revoke"
                    type="submit"
                    disabled={pending}
                    variant="soft"
                    aria-label={`Revoke ${invitation.email}`}
                  >
                    Revoke
                  </Button>
                </Form>
              )}
            </Flex>
          </Card>
        ))}
      </Flex>
    </AuthPage>
  );
}
