import { readFile } from "node:fs/promises";
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ResultAsync } from "neverthrow";
import type { z } from "zod";
import {
  type ActiveWorkoutSnapshot,
  activeWorkoutFinishSchema,
  activeWorkoutPatchSchema,
  activeWorkoutReadSchema,
} from "~/modules/fitness/domain/active-workout";
import type { WorkoutError } from "~/modules/fitness/domain/workout-commands";
import type { createActiveWorkoutCommands } from "~/modules/fitness/infra/workout.repository.server";

export const workoutResourceUri = "ui://fitness/active-workout-v1.html";

export function registerFitnessWorkoutApp(
  server: McpServer,
  commands: ReturnType<typeof createActiveWorkoutCommands>,
  origin: string,
) {
  const ui = {
    prefersBorder: false,
    csp: { connectDomains: [], resourceDomains: [] },
  };
  registerAppResource(
    server,
    "Fitness active workout",
    workoutResourceUri,
    { _meta: { ui } },
    async () => ({
      contents: [
        {
          uri: workoutResourceUri,
          mimeType: RESOURCE_MIME_TYPE,
          text: await readFile("build/mcp-workout.html", "utf8"),
          _meta: { ui },
        },
      ],
    }),
  );
  function register<S extends z.ZodObject>(
    name: string,
    description: string,
    schema: S,
    run: (
      input: z.output<S>,
    ) => ResultAsync<ActiveWorkoutSnapshot, WorkoutError>,
    readOnly: boolean,
    render = false,
  ) {
    const inputSchema: z.ZodObject = schema;
    registerAppTool(
      server,
      name,
      {
        description,
        inputSchema,
        annotations: {
          readOnlyHint: readOnly,
          destructiveHint: !readOnly,
          idempotentHint: readOnly,
          openWorldHint: false,
        },
        _meta: {
          ui: {
            resourceUri: workoutResourceUri,
            visibility: render ? ["model", "app"] : ["app"],
          },
        },
      },
      async (input) => {
        const parsed = schema.parse(input);
        const saved = await run(parsed);
        if (saved.isErr()) {
          return {
            isError: true,
            content: [{ type: "text", text: saved.error.message }],
            structuredContent: { error: saved.error },
          };
        }
        const snapshot = saved.value;
        const openUrl = new URL(`/workouts/${snapshot.workout.id}`, origin)
          .href;
        return {
          content: [
            {
              type: "text",
              text: `${snapshot.workout.name}: ${snapshot.workout.stop ? "finished" : "in progress"}. Open in Fitness: ${openUrl}`,
            },
          ],
          structuredContent: { snapshot, openUrl },
        };
      },
    );
  }
  register(
    "show_workout",
    "Show an existing workout using current Fitness data. Does not create or start a new session. Supports inline logging in MCP Apps clients; other clients receive an Open in Fitness link.",
    activeWorkoutReadSchema,
    commands.read,
    true,
    true,
  );
  register(
    "get_workout_widget",
    "Refresh the authoritative workout snapshot before editing.",
    activeWorkoutReadSchema,
    commands.read,
    true,
  );
  register(
    "update_workout_widget_set",
    "Save explicit changes to an existing set only if the observed workout revision still matches. Targets are never copied to actual reps or RIR.",
    activeWorkoutPatchSchema,
    commands.updateSet,
    false,
  );
  register(
    "finish_workout_widget",
    "Finish the existing workout only if its observed revision still matches. Pending sets remain pending.",
    activeWorkoutFinishSchema,
    commands.finishWorkout,
    false,
  );
}
