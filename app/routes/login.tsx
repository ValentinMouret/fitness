import { Form, useSearchParams } from "react-router";
import type { Route } from "./+types/login";
import { loginWithCredentials } from "~/modules/auth/application/auth.service.server";
import { syncSessionFromCookie } from "~/modules/auth/application/session-sync";
import {
  Container,
  Card,
  Heading,
  Text,
  TextField,
  Button,
  Callout,
} from "@radix-ui/themes";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const username = formData.get("username");
  const password = formData.get("password");
  const redirectTo = formData.get("redirectTo");

  return loginWithCredentials({
    username: typeof username === "string" ? username : "",
    password: typeof password === "string" ? password : "",
    redirectTo: typeof redirectTo === "string" ? redirectTo : null,
  });
}

export async function clientLoader() {
  return syncSessionFromCookie();
}

export default function Login({ actionData }: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";

  return (
    <Container
      size="1"
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
      }}
    >
      <Card size="4" style={{ width: "100%", maxWidth: "400px" }}>
        <Heading as="h1" size="6" align="center" mb="6">
          Login
        </Heading>
        <Form method="post">
          <input type="hidden" name="redirectTo" value={redirectTo} />

          <Text
            as="label"
            size="2"
            weight="medium"
            mb="2"
            style={{ display: "block" }}
          >
            Username
          </Text>
          <TextField.Root
            name="username"
            required
            mb="4"
            placeholder="Enter your username"
          />

          <Text
            as="label"
            size="2"
            weight="medium"
            mb="2"
            style={{ display: "block" }}
          >
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

          <Button type="submit" size="3" style={{ width: "100%" }}>
            Login
          </Button>
        </Form>
      </Card>
    </Container>
  );
}
