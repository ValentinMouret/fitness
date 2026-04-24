import {
  CheckboxIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CounterClockwiseClockIcon,
  DashboardIcon,
  ExitIcon,
  HamburgerMenuIcon,
  ReaderIcon,
  RulerSquareIcon,
} from "@radix-ui/react-icons";
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  IconButton,
  Text,
} from "@radix-ui/themes";
import type React from "react";
import "./AppLayout.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { Form, NavLink, Outlet, useLocation, useMatches } from "react-router";
import { z } from "zod";
import { PageHeader, type PageHeaderProps } from "~/components/PageHeader";
import { PageTransition } from "~/components/PageTransition";
import { QuickActionFAB } from "~/components/QuickActionFAB";
import { QuickActionSheet } from "~/components/QuickActionSheet";

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
  header: z.function({
    input: [z.unknown()],
    output: z.custom<PageHeaderProps>(),
  }),
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

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === "q" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        const target = e.target as HTMLElement;
        const isInput =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable;

        if (!isInput) {
          setQuickSheetOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

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
    <Flex
      direction="row"
      className="app-layout"
      style={
        {
          "--sidebar-width": isCollapsed ? "60px" : "240px",
        } as React.CSSProperties
      }
      onKeyDown={handleKeyDown}
    >
      <IconButton
        ref={hamburgerRef}
        className="hamburger-mobile app-layout__hamburger"
        variant="ghost"
        size="3"
        onClick={openMobileSidebar}
        aria-label="Open navigation menu"
        aria-expanded={isMobileOpen}
      >
        <HamburgerMenuIcon />
      </IconButton>

      <Box className="sidebar-desktop app-layout__sidebar">
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
            className="app-layout__nav"
          >
            {navItems.map(({ path, label, icon }) => (
              <Box key={path} px="1">
                <NavLink
                  to={path}
                  onClick={closeMobileSidebar}
                  className="app-layout__nav-link"
                >
                  {({ isActive }) => (
                    <Button
                      variant="soft"
                      color={isActive ? "tomato" : undefined}
                      size="3"
                      className={
                        isActive
                          ? "app-layout__nav-button"
                          : "app-layout__nav-button app-layout__nav-button--inactive"
                      }
                    >
                      <Flex
                        align="center"
                        gap={isCollapsed ? "0" : "3"}
                        justify={isCollapsed ? "center" : "start"}
                        className="app-layout__nav-button-inner"
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

          <Box mt="4" px="1" className="app-layout__logout">
            <Form method="post" action="/logout">
              <Button
                type="submit"
                variant="soft"
                size="3"
                color="red"
                className="app-layout__logout-button"
              >
                <Flex
                  align="center"
                  gap={isCollapsed ? "0" : "2"}
                  justify="center"
                  className="app-layout__nav-button-inner"
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

      <Box className="main-content app-layout__main" flexGrow="1">
        <Container size="4" p={{ initial: "2", md: "4" }}>
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
