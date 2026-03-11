import { getQuickActionsData } from "~/modules/dashboard/infra/quick-actions.service.server";

export async function loader() {
  return getQuickActionsData();
}
