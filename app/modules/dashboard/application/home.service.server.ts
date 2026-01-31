import { redirect } from "react-router";

export function redirectToDashboard(): Response {
  return redirect("/dashboard");
}
