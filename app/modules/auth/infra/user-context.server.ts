import { createContext, redirect } from "react-router";
import { type AuthenticatedUser, userIdSchema } from "../domain/user";
import { getAuthFoundation } from "./auth-foundation.server";
import { requireSameOrigin } from "./session.server";

export const authenticatedUserContext = createContext<AuthenticatedUser>();

export async function requirePersonalUser(
  request: Request,
): Promise<AuthenticatedUser> {
  const runtime = getAuthFoundation();
  if (!runtime) throw new Response("Not found", { status: 404 });
  const session = await runtime.getAdmittedSession(request.headers);
  if (!session) throw redirect("/sign-in");
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method))
    requireSameOrigin(request);
  return { id: userIdSchema.parse(session.user.id), email: session.user.email };
}
