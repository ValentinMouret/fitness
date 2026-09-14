import { Button, Flex } from "@radix-ui/themes";
import { Form, useNavigation } from "react-router";
import {
  consentAction,
  consentLoader,
} from "~/modules/auth/infra/consent.server";
import { Consent } from "~/modules/auth/presentation/components/Consent";
import type { Route } from "./+types/authorize";
import "../login.css";

export const loader = ({ request }: Route.LoaderArgs) => consentLoader(request);
export const action = ({ request }: Route.ActionArgs) => consentAction(request);
export const headers = () => ({
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
});

export default function Authorize({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  return (
    <Consent
      clientName={loaderData.clientName}
      error={
        actionData
          ? "This connection could not be approved. Start again from your app."
          : undefined
      }
    >
      <Form method="post">
        <input type="hidden" name="consent" value={loaderData.consent} />
        <Flex gap="3">
          <Button
            className="auth-submit"
            name="decision"
            value="allow"
            type="submit"
            disabled={navigation.state !== "idle"}
          >
            Allow access
          </Button>
          <Button
            className="auth-submit"
            name="decision"
            value="deny"
            type="submit"
            variant="soft"
            color="gray"
            disabled={navigation.state !== "idle"}
          >
            Deny
          </Button>
        </Flex>
      </Form>
    </Consent>
  );
}
