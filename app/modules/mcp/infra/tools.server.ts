import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ResultAsync } from "neverthrow";
import { z } from "zod";
import {
  addExerciseSchema,
  createExerciseSchema,
  createWorkoutSchema,
  deleteSetsSchema,
  finishWorkoutSchema,
  replaceExerciseSchema,
  saveSetsSchema,
  type WorkoutError,
  workoutExerciseSchema,
  workoutIdSchema,
} from "~/modules/fitness/domain/workout-commands";
import { workoutCommands } from "~/modules/fitness/infra/workout.repository.server";
import { queryInputSchema, runQuery } from "./query.server";
import { schemaDescription } from "./schema-description";

function result(value: unknown, isError = false): CallToolResult {
  const text = JSON.stringify(value);
  const structuredContent = z
    .record(z.string(), z.unknown())
    .parse(JSON.parse(text));
  return { content: [{ type: "text", text }], structuredContent, isError };
}

export function registerFitnessTools(
  server: McpServer,
  commands = workoutCommands,
  query = runQuery,
) {
  server.registerTool(
    "describe_schema",
    {
      description:
        "Discover all queryable Fitness data, identifiers, units, domain metrics, limits, and SQL examples.",
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => result(schemaDescription),
  );
  server.registerTool(
    "query",
    {
      description:
        "Run one read-only PostgreSQL SELECT over the exposed Fitness views. Discover them with describe_schema. Supports joins, CTEs, aggregates and time series; results are bounded and report truncation.",
      inputSchema: queryInputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (input) => {
      const response = await query(input);
      return response.isErr()
        ? result(
            { error: { code: "query_error", message: response.error } },
            true,
          )
        : result(response.value);
    },
  );
  function write<S extends z.ZodObject>(
    name: string,
    description: string,
    schema: S,
    run: (input: z.output<S>) => ResultAsync<unknown, WorkoutError>,
    destructiveHint = false,
    idempotentHint = false,
  ) {
    const inputSchema: z.ZodObject = schema;
    server.registerTool(
      name,
      {
        description,
        inputSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint,
          idempotentHint,
          openWorldHint: false,
        },
      },
      async (input) => {
        const parsed = schema.safeParse(input);
        if (!parsed.success)
          return result(
            { error: { code: "invalid_input", message: parsed.error.message } },
            true,
          );
        const response = await run(parsed.data);
        return response.isErr()
          ? result({ error: response.error }, true)
          : result(response.value);
      },
    );
  }
  write(
    "create_exercise",
    "Create an exercise catalogue entry; returns its ID and properties. Query existing exercises first. Muscle contributions must be unique positive integer percentages totalling 100.",
    createExerciseSchema,
    commands.createExercise,
  );
  write(
    "create_workout",
    "Atomically create an empty, partial, or completed workout. Exercises reference existing catalogue IDs and are ordered as supplied. Set completion is explicit; stop only finishes the session. Supply historical timestamps when logging a past workout.",
    createWorkoutSchema,
    commands.createWorkout,
  );
  write(
    "delete_workout",
    "Soft-delete a workout and its exercises and sets.",
    workoutIdSchema,
    commands.deleteWorkout,
    true,
  );
  write(
    "finish_workout",
    "Finish a workout at the supplied stop time or now. Does not complete pending sets. Already finished workouts retain their original stop time.",
    finishWorkoutSchema,
    commands.finishWorkout,
    false,
    true,
  );
  write(
    "add_exercise_to_workout",
    "Append an existing catalogue exercise to a workout, optionally with sets and session notes. Does not create a catalogue entry or implicit default sets. An exercise already in the workout is a conflict.",
    addExerciseSchema,
    commands.addExercise,
  );
  write(
    "remove_exercise_from_workout",
    "Remove an exercise from a workout, including all its recorded and pending sets. Does not delete its catalogue entry.",
    workoutExerciseSchema,
    commands.removeExercise,
    true,
  );
  write(
    "replace_exercise_in_workout",
    "Replace pending work with another catalogue exercise. Completed sets stay with the original exercise. Pending sets move to the replacement in order, retaining targets, warm-up flags and notes but clearing reps, weight, RPE and failure. Replacement already present is a conflict. If all sets are completed, add the new exercise instead.",
    replaceExerciseSchema,
    commands.replaceExercise,
    true,
  );
  write(
    "save_workout_sets",
    "Create or replace explicitly numbered sets in a workout exercise. Each supplied set is the complete desired record: omitted optional values clear to null, omitted flags become false. Other sets are untouched. Use the same numbers when correcting or retrying; query existing sets first if needed. Weights are kilograms.",
    saveSetsSchema,
    commands.saveSets,
    true,
    true,
  );
  write(
    "delete_workout_sets",
    "Delete the explicitly numbered sets from a workout exercise. All specified sets must exist; otherwise nothing is deleted.",
    deleteSetsSchema,
    commands.deleteSets,
    true,
  );
}
