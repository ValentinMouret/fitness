import { getQuickActionsData } from "~/modules/dashboard/application/quick-actions.service.server";

export async function loader() {
  return getQuickActionsData();
}
