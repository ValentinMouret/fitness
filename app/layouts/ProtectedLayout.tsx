import { Button, Flex, Spinner, Text } from "@radix-ui/themes";
import { useEffect, useRef, useState } from "react";
import { Outlet, useFetcher } from "react-router";
import { getAccountTimeZone } from "~/modules/auth/infra/account-settings.server";
import { requireFitnessUser } from "~/modules/auth/infra/fitness-user.server";
import { authenticatedUserContext } from "~/modules/auth/infra/user-context.server";
import type { Route } from "./+types/ProtectedLayout";

export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    context.set(authenticatedUserContext, await requireFitnessUser(request));
    return next();
  },
];

export async function loader({ context }: Route.LoaderArgs) {
  const userId = context.get(authenticatedUserContext).id;
  return { userId, timeZone: await getAccountTimeZone(userId) };
}

export default function ProtectedLayout({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher<{
    readonly saved?: boolean;
    readonly error?: string;
  }>();
  const submitted = useRef<string | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [deviceUnavailable, setDeviceUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (ready) return;
    let timeZone: string;
    try {
      timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!timeZone) throw new Error("Device timezone unavailable");
    } catch {
      setDeviceUnavailable(true);
      return;
    }
    if (timeZone === loaderData.timeZone) {
      setReady(true);
      return;
    }
    const key = `${loaderData.userId}:${timeZone}:${attempt}`;
    if (submitted.current === key) return;
    submitted.current = key;
    fetcher.submit(
      { timeZone },
      { method: "post", action: "/account/timezone" },
    );
  }, [loaderData.userId, loaderData.timeZone, fetcher.submit, ready, attempt]);
  if (!ready) {
    const failed =
      deviceUnavailable || (fetcher.state === "idle" && fetcher.data?.error);
    return (
      <Flex direction="column" gap="3" align="center" p="5" role="status">
        {failed ? (
          <>
            <Text>Couldn't use your device timezone.</Text>
            <Button
              type="button"
              onClick={() => {
                submitted.current = undefined;
                setDeviceUnavailable(false);
                setAttempt((value) => value + 1);
              }}
            >
              Retry
            </Button>
          </>
        ) : (
          <>
            <Spinner />
            <Text>Loading…</Text>
          </>
        )}
      </Flex>
    );
  }
  return <Outlet />;
}
