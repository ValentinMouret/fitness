import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errAsync, okAsync } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { registerFitnessTools } from "./tools.server";

vi.mock("~/modules/fitness/infra/workout.repository.server", () => ({
  workoutCommands: {},
}));
vi.mock("./query.server", () => ({
  queryInputSchema: z.object({ sql: z.string() }),
  runQuery: vi.fn(),
}));

describe("MCP tool registration", () => {
  it("advertises all 11 tools and returns structured success and domain errors through the SDK", async () => {
    const server = new McpServer({ name: "Fitness test", version: "1" });
    const saved = {
      workout: {
        id: "3a12b433-0e67-4c6a-a7c3-38a4b32b955d",
        name: "Test",
        start: new Date("2025-01-01T10:00:00Z"),
      },
      exerciseGroups: [],
    };
    const success = vi.fn(() => okAsync(saved));
    const failure = vi.fn(() =>
      errAsync({
        code: "not_found" as const,
        message: "Workout does not exist",
      }),
    );
    registerFitnessTools(
      server,
      {
        createWorkout: success,
        createExercise: vi.fn(() =>
          okAsync({
            exercise: {
              id: "id",
              name: "Press",
              type: "dumbbells" as const,
              movementPattern: "push" as const,
            },
            muscleGroupSplits: [],
          }),
        ),
        deleteWorkout: vi.fn(() => okAsync({ workoutId: "id" })),
        finishWorkout: failure,
        addExercise: success,
        removeExercise: success,
        replaceExercise: success,
        saveSets: success,
        deleteSets: success,
        updateSet: success,
      },
      () =>
        okAsync({ rows: [{ name: "Press" }], rowCount: 1, truncated: false }),
    );
    const client = new Client({ name: "Integration client", version: "1" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const listed = await client.listTools();
      expect(listed.tools.map((tool) => tool.name)).toEqual([
        "describe_schema",
        "query",
        "create_exercise",
        "create_workout",
        "delete_workout",
        "finish_workout",
        "add_exercise_to_workout",
        "remove_exercise_from_workout",
        "replace_exercise_in_workout",
        "save_workout_sets",
        "delete_workout_sets",
      ]);
      expect(
        (await client.callTool({ name: "describe_schema", arguments: {} }))
          .isError,
      ).toBe(false);
      expect(
        (
          await client.callTool({
            name: "query",
            arguments: { sql: "select name from exercises" },
          })
        ).structuredContent,
      ).toMatchObject({ rows: [{ name: "Press" }] });
      const result = await client.callTool({
        name: "create_workout",
        arguments: { name: "Test" },
      });
      expect(result.structuredContent).toMatchObject({
        workout: { start: "2025-01-01T10:00:00.000Z" },
      });
      expect(success).toHaveBeenCalledWith({ name: "Test", exercises: [] });
      expect(
        (
          await client.callTool({
            name: "finish_workout",
            arguments: { workoutId: saved.workout.id },
          })
        ).isError,
      ).toBe(true);
      expect(
        (
          await client.callTool({
            name: "create_workout",
            arguments: { name: "" },
          })
        ).isError,
      ).toBe(true);
      for (const sets of [
        [{ set: 1.5 }],
        [{ set: 1 }, { set: 1 }],
        [{ set: 1, reps: "10" }],
        [{ set: 1, rpe: 11 }],
      ]) {
        expect(
          (
            await client.callTool({
              name: "save_workout_sets",
              arguments: {
                workoutId: saved.workout.id,
                exerciseId: saved.workout.id,
                sets,
              },
            })
          ).isError,
        ).toBe(true);
      }
      expect(success).toHaveBeenCalledTimes(1);
      await client.callTool({
        name: "save_workout_sets",
        arguments: {
          workoutId: saved.workout.id,
          exerciseId: saved.workout.id,
          sets: [{ set: 1 }],
        },
      });
      expect(success).toHaveBeenLastCalledWith({
        workoutId: saved.workout.id,
        exerciseId: saved.workout.id,
        sets: [
          { set: 1, isCompleted: false, isWarmup: false, isFailure: false },
        ],
      });
    } finally {
      await client.close();
      await server.close();
    }
  });
});
