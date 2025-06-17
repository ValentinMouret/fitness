import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  layout("layouts/AppLayout.tsx", [
    index("routes/home.tsx"),
    route("dashboard", "routes/dashboard/index.tsx"),
    route("nutrition", "routes/nutrition/index.tsx"),
    route("workouts", "routes/workouts/index.tsx"),
    route("habits", "routes/habits/index.tsx"),
    route("habits/new", "routes/habits/new.tsx"),
  ]),
] satisfies RouteConfig;
