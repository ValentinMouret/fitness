import type React from "react";
import { Flex, Heading, Button, IconButton, Box } from "@radix-ui/themes";
import { ArrowLeftIcon } from "@radix-ui/react-icons";
import { Link } from "react-router";

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  backTo?: string;
  primaryAction?: {
    label: string;
    to?: string;
    onClick?: () => void;
    icon?: React.ReactNode;
    loading?: boolean;
    disabled?: boolean;
    type?: "button" | "submit" | "link";
  };
  customRight?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  backTo,
  primaryAction,
  customRight,
}) => {
  return (
    <Box mb="6">
      <Flex justify="between" align="center">
        <Flex align="center" gap="3">
          {backTo && (
            <IconButton asChild variant="ghost" size="2">
              <Link to={backTo}>
                <ArrowLeftIcon />
              </Link>
            </IconButton>
          )}
          {typeof title === "string" ? (
            <Heading size="7">{title}</Heading>
          ) : (
            title
          )}
        </Flex>

        <Flex align="center" gap="3">
          {customRight}
          {primaryAction && (
            <Button
              asChild={primaryAction.type === "link" || !!primaryAction.to}
              variant="soft"
              size="3"
              onClick={primaryAction.onClick}
              loading={primaryAction.loading}
              disabled={primaryAction.disabled}
              type={primaryAction.type === "submit" ? "submit" : "button"}
            >
              {primaryAction.to ? (
                <Link to={primaryAction.to}>
                  {primaryAction.icon}
                  {primaryAction.label}
                </Link>
              ) : (
                <>
                  {primaryAction.icon}
                  {primaryAction.label}
                </>
              )}
            </Button>
          )}
        </Flex>
      </Flex>
      {subtitle && <Box mt="1">{subtitle}</Box>}
    </Box>
  );
};
