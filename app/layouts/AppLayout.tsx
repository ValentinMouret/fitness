import React from "react";
import "./AppLayout.css";
import { Link, Outlet } from "react-router";

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
            <Link to="/dashboard">Dashboard</Link>
          </li>
          <li>
            <Link to="/nutrition">Nutrition</Link>
          </li>
          <li>
            <Link to="/workouts">Workouts</Link>
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
