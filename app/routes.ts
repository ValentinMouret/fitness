import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  layout("layouts/ProtectedLayout.tsx", [
    layout("layouts/AppLayout.tsx", [
      index("routes/home.tsx"),
      route("dashboard", "routes/dashboard/index.tsx"),
      route("nutrition", "routes/nutrition/index.tsx"),
      route(
        "nutrition/calculate-targets",
        "routes/nutrition/calculate-targets/index.tsx",
      ),
      route("workouts", "routes/workouts/index.tsx"),
      route("habits", "routes/habits/index.tsx"),
      route("habits/new", "routes/habits/new.tsx"),
      route("habits/:id/edit", "routes/habits/edit.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
