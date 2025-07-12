import { Form, redirect, useSearchParams } from "react-router";
import type { Route } from "./+types/login";
import { authenticate } from "~/auth";
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
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  const redirectTo = formData.get("redirectTo") as string;

  if (!username || !password) {
    return { error: "Username and password are required" };
  }

  if (authenticate(username, password)) {
    // Set cookie in server response
    const user = { username };
    const sessionCookie = `fitness-rr-session=${encodeURIComponent(JSON.stringify(user))}; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Strict`;

    return redirect(redirectTo || "/dashboard", {
      headers: {
        "Set-Cookie": sessionCookie,
      },
    });
  }

  return { error: "Invalid username or password" };
}

export async function clientLoader() {
  // Sync cookie to sessionStorage on client-side
  if (typeof window !== "undefined") {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [key, value] = cookie.trim().split("=");
      if (key === "fitness-rr-session" && value) {
        try {
          const user = JSON.parse(decodeURIComponent(value));
          sessionStorage.setItem("fitness-rr-auth", JSON.stringify(user));
        } catch {
          // Invalid cookie data, ignore
        }
        break;
      }
    }
  }
  return null;
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
