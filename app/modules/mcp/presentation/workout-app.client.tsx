import { App } from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createRoot } from "react-dom/client";
import { z } from "zod";
import {
  type ActiveWorkoutSnapshot,
  activeWorkoutSnapshotSchema,
} from "~/modules/fitness/domain/active-workout";
import { ActiveWorkout } from "./components/ActiveWorkout/ActiveWorkout";
import "./workout-app.css";

const responseSchema = z.object({
  snapshot: activeWorkoutSnapshotSchema,
  openUrl: z.url(),
});
const errorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
const app = new App(
  { name: "Fitness active workout", version: "1.0.0" },
  {},
  { autoResize: true },
);
const element = document.getElementById("root");
if (!element) throw new Error("Workout root missing");
const root = createRoot(element);
let current: ActiveWorkoutSnapshot | undefined;
let openUrl: string | undefined;
let connected = false;
let needsRefresh = false;
let initialWorkoutId: string | undefined;

function showStatus(message: string) {
  root.render(
    <main className="workout-app-status">
      <h1>Fitness workout</h1>
      <output>{message}</output>
    </main>,
  );
}

function applyResult(value: unknown) {
  const parsed = responseSchema.safeParse(value);
  if (!parsed.success)
    throw new Error("Could not read the workout. Refresh to try again.");
  if (current && parsed.data.snapshot.workout.id !== current.workout.id)
    throw new Error(
      "This card belongs to a different workout. Open a new card.",
    );
  const url = new URL(parsed.data.openUrl);
  if (!["https:", "http:"].includes(url.protocol))
    throw new Error("Invalid Fitness link");
  current = parsed.data.snapshot;
  openUrl = url.href;
  render();
  return current;
}

async function call(name: string, args: Record<string, unknown>) {
  if (!connected)
    throw new Error("The workout is not connected. Reopen the card.");
  if (needsRefresh && name !== "get_workout_widget")
    throw new Error(
      "Refresh and review the saved values before retrying. Your draft is kept.",
    );
  let response: CallToolResult;
  try {
    response = await app.callServerTool({ name, arguments: args });
  } catch {
    needsRefresh = true;
    throw new Error(
      "Save status is unknown. Refresh and check the saved values before retrying.",
    );
  }
  if (response.isError) {
    needsRefresh = true;
    const parsed = errorSchema.safeParse(response.structuredContent);
    throw new Error(
      parsed.success && parsed.data.error.code === "conflict"
        ? "The workout changed in Fitness. Refresh to review the latest values; your draft is kept."
        : "Could not save this change. Your draft is kept. Refresh and try again.",
    );
  }
  let snapshot: ActiveWorkoutSnapshot;
  try {
    snapshot = applyResult(response.structuredContent);
  } catch {
    needsRefresh = true;
    throw new Error(
      "The save acknowledgement could not be verified. Refresh before retrying; your draft is kept.",
    );
  }
  if (name === "get_workout_widget") needsRefresh = false;
  return snapshot;
}

function render() {
  if (!current || !connected) return;
  const workoutId = current.workout.id;
  root.render(
    <ActiveWorkout
      snapshot={current}
      onRefresh={() => call("get_workout_widget", { workoutId })}
      onPatch={(input, expectedRevision) =>
        call("update_workout_widget_set", {
          workoutId,
          expectedRevision,
          ...input,
        })
      }
      onFinish={(expectedRevision) =>
        call("finish_workout_widget", { workoutId, expectedRevision })
      }
      onOpenFitness={() => {
        if (openUrl) void app.openLink({ url: openUrl });
      }}
    />,
  );
}

app.ontoolresult = (result) => {
  try {
    const parsed = responseSchema.parse(result.structuredContent);
    initialWorkoutId = parsed.snapshot.workout.id;
    if (!current && connected) void loadInitial();
  } catch {
    if (!current)
      showStatus(
        "Could not load this workout. Ask the coach to show it again.",
      );
  }
};
app.onhostcontextchanged = () => {
  document.documentElement.dataset.theme =
    app.getHostContext()?.theme ?? "light";
};
async function loadInitial() {
  if (!initialWorkoutId) return;
  try {
    await call("get_workout_widget", { workoutId: initialWorkoutId });
  } catch {
    showStatus(
      "Could not refresh the workout. Ask the coach to show it again; editing is unavailable.",
    );
  }
}
showStatus("Connecting to Fitness…");
void app
  .connect()
  .then(() => {
    connected = true;
    document.documentElement.dataset.theme =
      app.getHostContext()?.theme ?? "light";
    if (initialWorkoutId) void loadInitial();
    else if (current) render();
    else showStatus("Ask the coach to show your workout.");
  })
  .catch(() =>
    showStatus(
      "This client could not connect the interactive card. Open the workout in Fitness using the tool's link.",
    ),
  );
