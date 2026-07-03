import { InfoCircledIcon } from "@radix-ui/react-icons";
import {
  Button,
  Callout,
  Card,
  Flex,
  Heading,
  Text,
  TextField,
} from "@radix-ui/themes";
import { useId } from "react";
import { Form, useNavigation, useSearchParams } from "react-router";
import { z } from "zod";
import { zfd } from "zod-form-data";
import RequiredStar from "~/components/RequiredStar";
import { loginWithCredentials } from "~/modules/auth/application/auth.service.server";
import { syncSessionFromCookie } from "~/modules/auth/application/session-sync";
import { formOptionalText, formText } from "~/utils/form-data";
import type { Route } from "./+types/login";
import "./login.css";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const schema = zfd.formData({
    username: formText(z.string().min(1)),
    password: formText(z.string().min(1)),
    redirectTo: formOptionalText(),
  });

  const result = schema.safeParse(formData);
  if (!result.success) {
    return { error: "Username and password are required" };
  }

  return loginWithCredentials({
    username: result.data.username,
    password: result.data.password,
    redirectTo: result.data.redirectTo ?? null,
  });
}

export async function clientLoader() {
  return syncSessionFromCookie();
}

export default function Login({ actionData }: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";
  const navigation = useNavigation();
  const isLoggingIn = navigation.state === "submitting";

  const usernameId = useId();
  const passwordId = useId();

  return (
    <Flex align="center" justify="center" className="login-page">
      <Card size="4" className="login-card">
        <Heading as="h1" size="6" align="center" mb="1">
          Login
        </Heading>
        <Text as="p" size="2" color="gray" align="center" mb="6">
          Welcome back! Please enter your details.
        </Text>

        <Form method="post">
          <input type="hidden" name="redirectTo" value={redirectTo} />

          <Text as="label" htmlFor={usernameId} size="2" weight="medium" mb="2">
            Username <RequiredStar />
          </Text>
          <TextField.Root
            id={usernameId}
            name="username"
            autoComplete="username"
            required
            mb="4"
            placeholder="Enter your username"
          />

          <Text as="label" htmlFor={passwordId} size="2" weight="medium" mb="2">
            Password <RequiredStar />
          </Text>
          <TextField.Root
            id={passwordId}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            mb="4"
            placeholder="Enter your password"
          />

          {actionData?.error && (
            <Callout.Root color="red" mb="4" variant="soft" size="1">
              <Callout.Icon>
                <InfoCircledIcon />
              </Callout.Icon>
              <Callout.Text>{actionData.error}</Callout.Text>
            </Callout.Root>
          )}

          <Button
            type="submit"
            size="3"
            className="login-submit"
            loading={isLoggingIn}
          >
            Login
          </Button>
        </Form>
      </Card>
    </Flex>
  );
}
