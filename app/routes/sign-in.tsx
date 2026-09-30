import { Button, Flex, Text } from "@radix-ui/themes";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { env } from "~/env.server";
import { invitedEmailSchema } from "~/modules/auth/domain/invitation";
import { getAuthFoundation } from "~/modules/auth/infra/auth-foundation.server";
import { requireSameOrigin } from "~/modules/auth/infra/session.server";
import { AuthPage } from "~/modules/auth/presentation/components/AuthPage/AuthPage";
import { EmailField } from "~/modules/auth/presentation/components/EmailField/EmailField";
import type { Route } from "./+types/sign-in";

export async function loader({ request }: Route.LoaderArgs) {
  const runtime = getAuthFoundation();
  if (!runtime) throw new Response("Not found", { status: 404 });
  const session = await runtime.getAdmittedSession(request.headers);
  return {
    email: session?.user.email ?? null,
    isOwner: session?.user.id === env.AUTH_FOUNDATION_OWNER_USER_ID,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const runtime = getAuthFoundation();
  if (!runtime) throw new Response("Not found", { status: 404 });
  requireSameOrigin(request);
  const form = await request.formData();
  if (form.get("intent") === "sign-out") {
    const response = await runtime.auth.api.signOut({
      headers: request.headers,
      asResponse: true,
    });
    return redirect("/sign-in", { headers: response.headers });
  }
  const email = invitedEmailSchema.safeParse(form.get("email"));
  if (form.get("intent") !== "request-link" || !email.success)
    return data(
      { sent: false, error: "Enter a valid email address." },
      { status: 400 },
    );
  try {
    await runtime.auth.api.signInMagicLink({
      headers: request.headers,
      body: { email: email.data, callbackURL: "/sign-in" },
    });
    return { sent: true, error: null };
  } catch {
    return data(
      { sent: false, error: "Could not send a sign-in email. Try again." },
      { status: 500 },
    );
  }
}

export default function SignIn({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const pending = useNavigation().state !== "idle";
  return (
    <AuthPage title="Sign in">
      {loaderData.email ? (
        <Flex direction="column" gap="3">
          <Text as="p" className="auth-invitation-email">
            Signed in as {loaderData.email}
          </Text>
          {loaderData.isOwner && (
            <Button asChild>
              <Link to="/account/invitations">Manage invitations</Link>
            </Button>
          )}
          <Form method="post">
            <Button
              name="intent"
              value="sign-out"
              type="submit"
              disabled={pending}
            >
              Sign out
            </Button>
          </Form>
        </Flex>
      ) : (
        <Form method="post">
          <Flex direction="column" gap="3" mt="3">
            <EmailField />
            <Button
              name="intent"
              value="request-link"
              type="submit"
              disabled={pending}
              loading={pending}
            >
              Email me a sign-in link
            </Button>
            {actionData?.sent && (
              <Text as="p" role="status">
                If this email is invited, you’ll receive a sign-in link.
              </Text>
            )}
            {actionData?.error && (
              <Text as="p" role="alert" color="red">
                {actionData.error}
              </Text>
            )}
          </Flex>
        </Form>
      )}
    </AuthPage>
  );
}
