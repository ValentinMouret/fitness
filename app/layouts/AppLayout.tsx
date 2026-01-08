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
import { PageTransition } from "~/components/PageTransition";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: <DashboardIcon /> },
  { path: "/habits", label: "Habits", icon: <CheckboxIcon /> },
  { path: "/nutrition", label: "Nutrition", icon: <ReaderIcon /> },
  { path: "/workouts", label: "Workouts", icon: <CounterClockwiseClockIcon /> },
  { path: "/measurements", label: "Meas.", icon: <RulerSquareIcon /> },
];

const BottomTabBar: React.FC = () => (
  <nav className="bottom-tabs">
    {navItems.map(({ path, label, icon }) => (
      <NavLink
        key={path}
        to={path}
        className={({ isActive }) => (isActive ? "active" : "")}
      >
        {icon}
        <span>{label}</span>
      </NavLink>
    ))}
  </nav>
);

const AppLayout: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

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

  return (
    <Flex direction="row" style={{ minHeight: "100vh" }}>
      <IconButton
        className="hamburger-mobile"
        variant="ghost"
        size="3"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        style={{
          position: "fixed",
          top: "1rem",
          left: "1rem",
          zIndex: 50,
        }}
      >
        <HamburgerMenuIcon />
      </IconButton>

      <Box
        className="sidebar-desktop"
        style={{
          width: isCollapsed ? "60px" : "240px",
          borderRight: "1px solid var(--gray-4)",
          background: "var(--brand-surface, #fff8f0)",
          transition: "width 0.2s ease",
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          zIndex: 40,
          boxShadow: "2px 0 8px rgba(120, 80, 60, 0.04)",
        }}
      >
        <Flex direction="column" height="100%" p="3">
          <Flex align="center" justify="between" mb="4">
            <Flex align="center" gap="2">
              <Text size="5">🔥</Text>
              {!isCollapsed && <Heading size="4">fitness</Heading>}
            </Flex>

            <IconButton
              variant="ghost"
              size="1"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </IconButton>
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
                      color={isActive ? "tomato" : undefined}
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

      <button
        type="button"
        tabIndex={isMobileOpen ? 0 : -1}
        aria-label="Close sidebar"
        className={`sidebar-overlay ${isMobileOpen ? "open" : ""}`}
        onClick={() => setIsMobileOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setIsMobileOpen(false)}
      />

      <Box
        className="main-content"
        flexGrow="1"
        style={{
          overflow: "auto",
          marginLeft: isCollapsed ? "60px" : "240px",
          transition: "margin-left 0.2s ease",
        }}
      >
        <Container size="4" p="4">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </Container>
      </Box>

      <BottomTabBar />
    </Flex>
  );
};

export default AppLayout;
