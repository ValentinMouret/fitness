import type React from "react";
import { useState, useRef, useCallback } from "react";
import { NavLink, Outlet, Form, useLocation, useMatches } from "react-router";
import { z } from "zod";
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
import { QuickActionFAB } from "~/components/QuickActionFAB";
import { QuickActionSheet } from "~/components/QuickActionSheet";
import { PageHeader, type PageHeaderProps } from "~/components/PageHeader";

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

const HeaderHandleSchema = z.object({
  header: z.function(z.tuple([z.unknown()]), z.custom<PageHeaderProps>()),
});

const AppLayout: React.FC = () => {
  const location = useLocation();
  const matches = useMatches();

  const headerConfig = matches
    .map((match) => {
      const result = HeaderHandleSchema.safeParse(match.handle);
      if (result.success) {
        return result.data.header(match.data);
      }
      return undefined;
    })
    .filter((config): config is PageHeaderProps => config !== undefined)
    .at(-1);

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar-collapsed") === "true";
    }
    return false;
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [quickSheetOpen, setQuickSheetOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  const isActiveWorkout =
    location.pathname.startsWith("/workouts/") &&
    !location.pathname.includes("/exercises") &&
    !location.pathname.includes("/import") &&
    !location.pathname.includes("/generate") &&
    location.pathname !== "/workouts/create";

  const toggleCollapsed = useCallback(() => {
    const newValue = !isCollapsed;
    setIsCollapsed(newValue);
    localStorage.setItem("sidebar-collapsed", String(newValue));
  }, [isCollapsed]);

  const closeMobileSidebar = useCallback(() => {
    setIsMobileOpen(false);
    hamburgerRef.current?.focus();
    document.body.style.overflow = "";
  }, []);

  const openMobileSidebar = useCallback(() => {
    setIsMobileOpen(true);
    document.body.style.overflow = "hidden";
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && isMobileOpen) {
        closeMobileSidebar();
      }
    },
    [isMobileOpen, closeMobileSidebar],
  );

  return (
    <Flex direction="row" style={{ height: "100vh" }} onKeyDown={handleKeyDown}>
      <IconButton
        ref={hamburgerRef}
        className="hamburger-mobile"
        variant="ghost"
        size="3"
        onClick={openMobileSidebar}
        aria-label="Open navigation menu"
        aria-expanded={isMobileOpen}
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
          paddingLeft: "env(safe-area-inset-left)",
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
              onClick={toggleCollapsed}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
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
                  onClick={closeMobileSidebar}
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

          <Box
            mt="4"
            px="1"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
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
        onClick={closeMobileSidebar}
        onKeyDown={handleKeyDown}
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
            {headerConfig && <PageHeader {...headerConfig} />}
            <Outlet />
          </PageTransition>
        </Container>
      </Box>

      <BottomTabBar />

      {!isActiveWorkout && (
        <>
          <QuickActionFAB onClick={() => setQuickSheetOpen(true)} />
          <QuickActionSheet
            open={quickSheetOpen}
            onOpenChange={setQuickSheetOpen}
          />
        </>
      )}
    </Flex>
  );
};

export default AppLayout;
