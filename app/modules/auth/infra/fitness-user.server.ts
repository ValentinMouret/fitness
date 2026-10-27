import { env } from "~/env.server";
import type { AuthenticatedUser } from "../domain/user";
import { requireLegacyOwnerIdentity } from "./legacy-owner.server";
import { requireAuth } from "./session.server";
import { requirePersonalUser } from "./user-context.server";

export async function requireFitnessUser(
  request: Request,
  responseHeaders?: Headers,
): Promise<AuthenticatedUser> {
  if (env.AUTH_FOUNDATION_ENABLED) {
    await requireLegacyOwnerIdentity();
    return requirePersonalUser(request, responseHeaders);
  }
  await requireAuth(request);
  return requireLegacyOwnerIdentity();
}
