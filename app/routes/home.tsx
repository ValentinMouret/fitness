import { redirectToDashboard } from "~/modules/dashboard/application/home.service.server";

export function meta() {
  return [{ title: "Fitness" }, { name: "description", content: "get fit ⚡" }];
}

export async function loader() {
  return redirectToDashboard();
}
