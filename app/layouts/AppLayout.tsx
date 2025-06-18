import type React from "react";
import { useState, useEffect } from "react";
import "./AppLayout.css";
import { NavLink, Outlet, Form } from "react-router";

// SVG Icons as inline components
const DashboardIcon = () => (
  <svg
    className="nav-icon"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    aria-hidden="true"
  >
    <rect x="1" y="1" width="5" height="5" rx="0.5" />
    <rect x="9" y="1" width="5" height="5" rx="0.5" />
    <rect x="1" y="9" width="5" height="5" rx="0.5" />
    <rect x="9" y="9" width="5" height="5" rx="0.5" />
  </svg>
);

const HabitsIcon = () => (
  <svg
    className="nav-icon"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    aria-hidden="true"
  >
    <path d="M2 4.5L5.5 8L14 2" />
    <path d="M2 11.5L5.5 15L14 9" opacity="0.5" />
  </svg>
);

const NutritionIcon = () => (
  <svg
    className="nav-icon"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    aria-hidden="true"
  >
    <path d="M8 2C8 2 4 5 4 9C4 11.2091 5.79086 13 8 13C10.2091 13 12 11.2091 12 9C12 5 8 2 8 2Z" />
    <line x1="8" y1="2" x2="8" y2="0.5" />
  </svg>
);

const WorkoutsIcon = () => (
  <svg
    className="nav-icon"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    aria-hidden="true"
  >
    <line x1="2" y1="8" x2="14" y2="8" />
    <circle cx="5" cy="8" r="2.5" />
    <circle cx="11" cy="8" r="2.5" />
  </svg>
);

const ChevronIcon = ({ isCollapsed }: { isCollapsed: boolean }) => (
  <svg
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <path d={isCollapsed ? "M4 2L8 6L4 10" : "M8 2L4 6L8 10"} />
  </svg>
);

const MenuIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const LogoutIcon = () => (
  <svg
    className="nav-icon"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    aria-hidden="true"
  >
    <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    <path d="M11 7l3 3-3 3" />
    <path d="M14 10H6" />
  </svg>
);

const AppLayout: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Handle escape key to close mobile menu
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileOpen) {
        setIsMobileOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isMobileOpen]);

  // Prevent body scroll when mobile menu is open
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
    { path: "/habits", label: "Habits", icon: <HabitsIcon /> },
    { path: "/nutrition", label: "Nutrition", icon: <NutritionIcon /> },
    { path: "/workouts", label: "Workouts", icon: <WorkoutsIcon /> },
  ];

  return (
    <div className="app-layout">
      <button
        type="button"
        className="mobile-menu-toggle"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label="Toggle mobile menu"
      >
        <MenuIcon />
      </button>

      <nav
        className={`navbar ${isCollapsed ? "collapsed" : ""} ${isMobileOpen ? "mobile-open" : ""}`}
      >
        <h1>
          <span className="logo-emoji">{String.fromCodePoint(0x1f49a)}</span>
          <span className="logo-text">fitness</span>
        </h1>

        <button
          type="button"
          className="collapse-toggle"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronIcon isCollapsed={isCollapsed} />
        </button>

        <ul>
          {navItems.map(({ path, label, icon }) => (
            <li key={path}>
              <NavLink
                to={path}
                data-tooltip={label}
                onClick={() => setIsMobileOpen(false)}
              >
                {icon}
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        <Form method="post" action="/logout" className="logout-form">
          <button type="submit" className="button" data-tooltip="Logout">
            <LogoutIcon />
            <span>Logout</span>
          </button>
        </Form>
      </nav>

      {isMobileOpen && (
        <div
          className="mobile-backdrop visible"
          onClick={() => setIsMobileOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setIsMobileOpen(false);
            }
          }}
          aria-hidden="true"
          role="button"
          tabIndex={-1}
        />
      )}

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
