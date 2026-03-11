import { Button, Flex, Heading, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";
import { Link } from "react-router";
import "./EmptyState.css";

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
      className="empty-state animate-fade-slide-up"
    >
      <div className="empty-state__icon">{icon}</div>

      <Flex direction="column" align="center" gap="2">
        <Heading size="4" className="empty-state__title">
          {title}
        </Heading>
        <Text size="2" className="empty-state__description">
          {description}
        </Text>
      </Flex>

      {actionLabel && (actionTo || onAction) && (
        <div className="empty-state__action">
          {actionTo ? (
            <Button asChild size="3">
              <Link to={actionTo}>{actionLabel}</Link>
            </Button>
          ) : (
            <Button size="3" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </Flex>
  );
}
