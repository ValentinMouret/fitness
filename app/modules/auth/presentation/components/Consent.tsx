import { Callout, Card, Flex, Heading, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";

export function Consent({
  clientName,
  children,
  error,
}: {
  readonly clientName: string;
  readonly children: ReactNode;
  readonly error?: string;
}) {
  return (
    <Flex align="center" justify="center" className="login-page">
      <Card size="4" className="login-card">
        <Heading as="h1" size="6" mb="4">
          Connect to Fitness
        </Heading>
        <Text as="p" weight="bold" mb="2">
          {clientName}
        </Text>
        <Text as="p" mb="5">
          Allow this app to read and update your fitness data?
        </Text>
        {error && (
          <Callout.Root color="red" role="alert" mb="4">
            <Callout.Text>{error}</Callout.Text>
          </Callout.Root>
        )}
        {children}
      </Card>
    </Flex>
  );
}
