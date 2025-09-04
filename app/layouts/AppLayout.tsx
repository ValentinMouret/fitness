import type React from "react";
import { useState, useEffect } from "react";
import { NavLink, Outlet, Form } from "react-router";
import {
  Flex,
  Container,
  Box,
  Button,
  IconButton,
  Text,
  Heading,
} from "@radix-ui/themes";
import {
  HamburgerMenuIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DashboardIcon,
  CheckboxIcon,
  CounterClockwiseClockIcon,
  ReaderIcon,
  RulerSquareIcon,
  ExitIcon,
} from "@radix-ui/react-icons";

const AppLayout: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileOpen) {
        setIsMobileOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isMobileOpen]);

  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: <DashboardIcon /> },
    { path: "/habits", label: "Habits", icon: <CheckboxIcon /> },
    { path: "/nutrition", label: "Nutrition", icon: <ReaderIcon /> },
    {
      path: "/workouts",
      label: "Workouts",
      icon: <CounterClockwiseClockIcon />,
    },
    { path: "/measurements", label: "Measurements", icon: <RulerSquareIcon /> },
  ];

  return (
    <Flex direction="row" style={{ minHeight: "100vh" }}>
      <IconButton
        variant="ghost"
        size="3"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        style={{
          position: "fixed",
          top: "1rem",
          left: "1rem",
          zIndex: 50,
          display: isMobile ? "block" : "none",
        }}
      >
        <HamburgerMenuIcon />
      </IconButton>

      <Box
        style={{
          width: isCollapsed ? "60px" : "240px",
          borderRight: "1px solid var(--gray-6)",
          background: "var(--color-surface)",
          transition: "width 0.2s ease, transform 0.2s ease",
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          zIndex: 40,
          transform:
            isMobile && !isMobileOpen ? "translateX(-100%)" : "translateX(0)",
        }}
      >
        <Flex direction="column" height="100%" p="3">
          <Flex align="center" justify="between" mb="4">
            <Flex align="center" gap="2">
              <Text size="5">{String.fromCodePoint(0x1f49a)}</Text>
              {!isCollapsed && <Heading size="4">fitness</Heading>}
            </Flex>

            {!isMobile && (
              <IconButton
                variant="ghost"
                size="1"
                onClick={() => setIsCollapsed(!isCollapsed)}
              >
                {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
              </IconButton>
            )}
          </Flex>

          <Flex
            direction="column"
            gap="0.5"
            flexGrow="1"
            style={{ overflow: "hidden" }}
          >
            {navItems.map(({ path, label, icon }) => (
              <Box key={path} px="1">
                <NavLink
                  to={path}
                  onClick={() => setIsMobileOpen(false)}
                  style={{ textDecoration: "none" }}
                >
                  {({ isActive }) => (
                    <Button
                      variant="soft"
                      color={isActive ? "green" : undefined}
                      size="3"
                      style={{
                        width: "100%",
                        justifyContent: "flex-start",
                        backgroundColor: isActive ? undefined : "transparent",
                      }}
                    >
                      <Flex
                        align="center"
                        gap={isCollapsed ? "0" : "3"}
                        justify={isCollapsed ? "center" : "start"}
                        style={{ width: "100%" }}
                      >
                        {icon}
                        {!isCollapsed && (
                          <Text
                            size="2"
                            weight={isActive ? "medium" : "regular"}
                          >
                            {label}
                          </Text>
                        )}
                      </Flex>
                    </Button>
                  )}
                </NavLink>
              </Box>
            ))}
          </Flex>

          <Box mt="4" px="1">
            <Form method="post" action="/logout">
              <Button
                type="submit"
                variant="soft"
                size="3"
                color="red"
                style={{
                  width: "100%",
                  justifyContent: "center",
                  padding: "8px 12px",
                  margin: "0",
                  borderRadius: "6px",
                }}
              >
                <Flex
                  align="center"
                  gap={isCollapsed ? "0" : "2"}
                  justify="center"
                  style={{ width: "100%" }}
                >
                  <ExitIcon />
                  {!isCollapsed && (
                    <Text size="2" weight="medium">
                      Logout
                    </Text>
                  )}
                </Flex>
              </Button>
            </Form>
          </Box>
        </Flex>
      </Box>

      {isMobile && isMobileOpen && (
        <Box
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            zIndex: 30,
          }}
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <Box
        flexGrow="1"
        style={{
          overflow: "auto",
          marginLeft: isMobile ? "0" : isCollapsed ? "60px" : "240px",
          transition: "margin-left 0.2s ease",
        }}
      >
        <Container size="4" p="4">
          <Outlet />
        </Container>
      </Box>
    </Flex>
  );
};

export default AppLayout;
