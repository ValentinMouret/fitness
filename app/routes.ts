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
      route("nutrition/meal-builder", "routes/nutrition/meal-builder.tsx"),
      route("nutrition/meals", "routes/nutrition/meals.tsx"),
      route("workouts", "routes/workouts/index.tsx"),
      route("workouts/create", "routes/workouts/create.tsx"),
      route("workouts/generate", "routes/workouts/generate.tsx"),
      route("workouts/:id", "routes/workouts/:id.tsx"),
      route(
        "workouts/:id/substitute/:exerciseId",
        "routes/workouts/substitute.tsx",
      ),
      route("workouts/exercises", "routes/workouts/exercises/index.tsx"),
      route(
        "workouts/exercises/create",
        "routes/workouts/exercises/create.tsx",
      ),
      route(
        "workouts/exercises/:exercise-id/edit",
        "routes/workouts/exercises/:exercise-id/edit.tsx",
      ),
      route("habits", "routes/habits/index.tsx"),
      route("habits/new", "routes/habits/new.tsx"),
      route("habits/:id/edit", "routes/habits/edit.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
