import { data } from "react-router";
import { z } from "zod";
import { saveAccountTimeZone } from "~/modules/auth/infra/account-settings.server";
import { requireSameOrigin } from "~/modules/auth/infra/session.server";
import { authenticatedUserContext } from "~/modules/auth/infra/user-context.server";
import { timeZoneSchema } from "~/time";
import type { Route } from "./+types/timezone";

export async function action({ request, context }: Route.ActionArgs) {
  requireSameOrigin(request);
  const parsed = z
    .object({ timeZone: timeZoneSchema })
    .strict()
    .safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success)
    return data({ error: "Invalid timezone" }, { status: 400 });
  await saveAccountTimeZone(
    context.get(authenticatedUserContext).id,
    parsed.data.timeZone,
  );
  return { saved: true };
}
