import type React from "react";
import "./AppLayout.css";
import { NavLink, Outlet } from "react-router";

const AppLogo: React.FC = () => (
  <h1>{String.fromCodePoint(0x1f49a)} fitness</h1>
);

const AppLayout: React.FC = () => {
  return (
    <div className="app-layout">
      <nav className="navbar">
        <AppLogo />
        <ul>
          <li>
            <NavLink to="/dashboard">Dashboard</NavLink>
          </li>
          <li>
            <a href="/habits">Habits</a>
          </li>
          <li>
            <NavLink to="/nutrition">Nutrition</NavLink>
          </li>
          <li>
            <NavLink to="/workouts">Workouts</NavLink>
          </li>
        </ul>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
