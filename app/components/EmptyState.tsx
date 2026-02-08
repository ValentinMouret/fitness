import { Button, Flex, Heading, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";
import { Link } from "react-router";

interface EmptyStateProps {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly actionLabel?: string;
  readonly actionTo?: string;
  readonly onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionTo,
  onAction,
}: EmptyStateProps) {
  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      gap="4"
      py="9"
      className="animate-fade-slide-up"
      style={{
        opacity: 0,
        background: "var(--brand-surface, #f3f1ed)",
        borderRadius: "16px",
        border: "1px dashed var(--gray-5)",
      }}
    >
      <div
        style={{
          fontSize: "3rem",
          opacity: 0.8,
        }}
      >
        {icon}
      </div>

      <Flex direction="column" align="center" gap="2">
        <Heading size="4" style={{ color: "var(--brand-text, #1c1917)" }}>
          {title}
        </Heading>
        <Text
          size="2"
          style={{
            color: "var(--brand-text-secondary, #79756d)",
            maxWidth: "280px",
            textAlign: "center",
          }}
        >
          {description}
        </Text>
      </Flex>

      {actionLabel && (actionTo || onAction) && (
        <div style={{ marginTop: "8px" }}>
          {actionTo ? (
            <Button asChild size="3" style={{ cursor: "pointer" }}>
              <Link to={actionTo}>{actionLabel}</Link>
            </Button>
          ) : (
            <Button size="3" onClick={onAction} style={{ cursor: "pointer" }}>
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </Flex>
  );
}
