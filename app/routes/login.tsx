import {
  Button,
  Callout,
  Card,
  Flex,
  Heading,
  Text,
  TextField,
} from "@radix-ui/themes";
import { Form, useSearchParams } from "react-router";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { loginWithCredentials } from "~/modules/auth/application/auth.service.server";
import { syncSessionFromCookie } from "~/modules/auth/application/session-sync";
import { formOptionalText, formText } from "~/utils/form-data";
import type { Route } from "./+types/login";
import "./login.css";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const schema = zfd.formData({
    email: formText(z.email()),
    password: formText(z.string().min(1)),
    redirectTo: formOptionalText(),
  });

  const result = schema.safeParse(formData);
  if (!result.success) {
    return { error: "Email and password are required" };
  }

  return loginWithCredentials({
    email: result.data.email,
    password: result.data.password,
    request,
    redirectTo: result.data.redirectTo ?? null,
  });
}

export async function clientLoader() {
  return syncSessionFromCookie();
}

export default function Login({ actionData }: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/habits";

  return (
    <Flex align="center" justify="center" className="login-page">
      <Card size="4" className="login-card">
        <Heading as="h1" size="6" align="center" mb="6">
          Login
        </Heading>
        <Form method="post">
          <input type="hidden" name="redirectTo" value={redirectTo} />

          <Text as="div" size="2" weight="medium" mb="2">
            Email
          </Text>
          <TextField.Root
            name="email"
            required
            mb="4"
            placeholder="Enter your email"
          />

          <Text as="div" size="2" weight="medium" mb="2">
            Password
          </Text>
          <TextField.Root
            name="password"
            type="password"
            required
            mb="4"
            placeholder="Enter your password"
          />

          {actionData?.error && (
            <Callout.Root color="red" mb="4">
              <Callout.Text>{actionData.error}</Callout.Text>
            </Callout.Root>
          )}

          <Button type="submit" size="3" className="login-submit">
            Login
          </Button>
        </Form>
      </Card>
    </Flex>
  );
}
