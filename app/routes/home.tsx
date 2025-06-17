import { redirect } from "react-router";

export function meta() {
  return [{ title: "Fitness" }, { name: "description", content: "get fit ⚡" }];
}

export async function loader() {
  return redirect("/dashboard");
}
