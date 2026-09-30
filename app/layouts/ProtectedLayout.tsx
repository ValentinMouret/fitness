import { Outlet } from "react-router";
import { requireLegacyOwnerIdentity } from "~/modules/auth/infra/legacy-owner.server";
import { requireAuth } from "~/modules/auth/infra/session.server";
import { authenticatedUserContext } from "~/modules/auth/infra/user-context.server";
import type { Route } from "./+types/ProtectedLayout";

export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    await requireAuth(request);
    context.set(authenticatedUserContext, await requireLegacyOwnerIdentity());
    return next();
  },
];

export function loader() {
  return null;
}

export default function ProtectedLayout() {
  return <Outlet />;
}
