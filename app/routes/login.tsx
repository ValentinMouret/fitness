import { Form, redirect, useActionData, useSearchParams } from "react-router";
import type { Route } from "./+types/login";
import { authenticate } from "~/auth";
import "./login.css";

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
    <div className="login-page">
      <div className="login-container">
        <h1>Login</h1>
        <Form method="post" className="login-form">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          
          <div className="form-group">
            <label htmlFor="username" className="form-label">
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              className="form-input"
              required
            />
          </div>

          {actionData?.error && (
            <div className="error-message">{actionData.error}</div>
          )}

          <button type="submit" className="button button-primary">
            Login
          </button>
        </Form>
      </div>
    </div>
  );
}