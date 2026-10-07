import { Button, Flex, Text, TextField } from "@radix-ui/themes";
import { useId } from "react";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { z } from "zod";
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
  const intent = z
    .enum(["request-code", "verify-code", "change-email"])
    .safeParse(form.get("intent"));
  if (!intent.success)
    return data(
      { email: null, error: "Invalid sign-in request." },
      { status: 400 },
    );
  if (intent.data === "change-email") return { email: null, error: null };
  const email = invitedEmailSchema.safeParse(form.get("email"));
  if (!email.success)
    return data(
      { email: null, error: "Enter a valid email address." },
      { status: 400 },
    );
  const code = z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/)
    .safeParse(form.get("code"));
  if (intent.data === "verify-code" && !code.success)
    return data(
      { email: email.data, error: "Enter the six-digit code." },
      { status: 400 },
    );
  try {
    const response =
      intent.data === "request-code"
        ? await runtime.requestSignInCode({
            headers: request.headers,
            email: email.data,
          })
        : await runtime.verifySignInCode({
            headers: request.headers,
            email: email.data,
            code: code.success ? code.data : "",
          });
    if (response.status === 429)
      return data(
        { email: email.data, error: "Too many attempts. Try again later." },
        { status: 429 },
      );
    if (!response.ok)
      return data(
        {
          email: email.data,
          error:
            intent.data === "verify-code"
              ? "That code is invalid or expired. Try again or request a new code."
              : "Could not request a code. Try again.",
        },
        { status: 400 },
      );
    if (intent.data === "verify-code")
      return redirect("/dashboard", { headers: response.headers });
    return { email: email.data, error: null };
  } catch {
    return data(
      { email: email.data, error: "Could not sign in. Try again." },
      { status: 500 },
    );
  }
}

export default function SignIn({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const pending = useNavigation().state !== "idle";
  const codeId = useId();
  const codeEmail = actionData?.email;
  return (
    <AuthPage title="Sign in">
      {loaderData.email ? (
        <Flex direction="column" gap="3">
          <Text as="p" className="auth-invitation-email">
            Signed in as {loaderData.email}
          </Text>
          <Button asChild>
            <Link to="/dashboard">Open Fitness</Link>
          </Button>
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
      ) : codeEmail ? (
        <Form method="post">
          <Flex direction="column" gap="3" mt="3">
            <Text as="p" role="status">
              If you have an account, you’ll receive a sign-in code.
            </Text>
            <Text as="p" className="auth-invitation-email">
              Enter the code sent to {codeEmail} in this app. It expires in five
              minutes.
            </Text>
            <input type="hidden" name="email" value={codeEmail} />
            <label htmlFor={codeId}>
              Six-digit code
              <TextField.Root
                id={codeId}
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                className="auth-email-field"
              />
            </label>
            <Button
              name="intent"
              value="verify-code"
              type="submit"
              disabled={pending}
              loading={pending}
            >
              Sign in
            </Button>
            <Flex gap="3" wrap="wrap">
              <Button
                name="intent"
                value="request-code"
                type="submit"
                formNoValidate
                variant="soft"
                disabled={pending}
              >
                Resend code
              </Button>
              <Button
                name="intent"
                value="change-email"
                type="submit"
                formNoValidate
                variant="ghost"
                disabled={pending}
              >
                Change email
              </Button>
            </Flex>
            {actionData?.error && (
              <Text as="p" role="alert" color="red">
                {actionData.error}
              </Text>
            )}
          </Flex>
        </Form>
      ) : (
        <Form method="post">
          <Flex direction="column" gap="3" mt="3">
            <EmailField />
            <Button
              name="intent"
              value="request-code"
              type="submit"
              disabled={pending}
              loading={pending}
            >
              Email me a sign-in code
            </Button>
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
