import { ArrowLeftIcon } from "@radix-ui/react-icons";
import {
  Box,
  Button,
  Flex,
  Heading,
  IconButton,
  Kbd,
  Text,
  Tooltip,
} from "@radix-ui/themes";
import type React from "react";
import { Link } from "react-router";
import "./PageHeader.css";

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
    shortcut?: string;
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
    <Box mb={{ initial: "3", sm: "6" }} className="page-header">
      <Flex
        justify="between"
        align="start"
        gap="3"
        className="page-header__row"
      >
        <Flex align="center" gap="3" className="page-header__title-row">
          {backTo && (
            <Tooltip content="Back">
              <IconButton asChild variant="ghost" size="2" aria-label="Back">
                <Link to={backTo}>
                  <ArrowLeftIcon />
                </Link>
              </IconButton>
            </Tooltip>
          )}
          {typeof title === "string" ? (
            <Heading size="7" className="page-header__title">
              {title}
            </Heading>
          ) : (
            title
          )}
        </Flex>

        <Flex align="center" gap="3" className="page-header__actions">
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
              aria-keyshortcuts={primaryAction.shortcut}
            >
              {(() => {
                const content = (
                  <>
                    {primaryAction.icon}
                    {primaryAction.label}
                    {primaryAction.shortcut && (
                      <Box
                        ml="2"
                        display={{ initial: "none", md: "inline-block" }}
                      >
                        <Kbd size="1">
                          {primaryAction.shortcut.toUpperCase()}
                        </Kbd>
                      </Box>
                    )}
                  </>
                );

                if (primaryAction.to) {
                  return <Link to={primaryAction.to}>{content}</Link>;
                }
                return content;
              })()}
            </Button>
          )}
        </Flex>
      </Flex>
      {subtitle && (
        <Text as="div" mt="1" className="page-header__subtitle">
          {subtitle}
        </Text>
      )}
    </Box>
  );
};
