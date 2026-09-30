import { Card, Flex, Heading } from "@radix-ui/themes";
import type { ReactNode } from "react";
import "./AuthPage.css";

export function AuthPage({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <Flex align="center" justify="center" className="auth-page">
      <Card size="4" className="auth-page-card">
        <Heading as="h1" align="center" mb="5">
          {title}
        </Heading>
        {children}
      </Card>
    </Flex>
  );
}
