import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { expect as browserExpect, chromium } from "@playwright/test";
import type { Pool } from "pg";
import { build } from "vite";
import { expect } from "vitest";
import { z } from "zod";
import { activeWorkoutSnapshotSchema } from "../../../app/modules/fitness/domain/active-workout";

const resultSnapshot = (result: unknown) =>
  z
    .object({
      structuredContent: z.object({ snapshot: activeWorkoutSnapshotSchema }),
    })
    .parse(result).structuredContent.snapshot;

export async function exerciseWorkoutWidget(
  client: Client,
  pool: Pool,
  owner: string,
  foreignWorkout: string,
) {
  const workoutId = randomUUID();
  const exerciseId = randomUUID();
  const nextExerciseId = randomUUID();
  await pool.query(
    "insert into workouts (user_id,id,name,start) values ($1,$2,'Widget acceptance workout',timezone('UTC',now())-interval '5 minutes')",
    [owner, workoutId],
  );
  for (const [order, id] of [exerciseId, nextExerciseId].entries()) {
    await pool.query(
      "insert into exercises(id,name,type,movement_pattern) values ($1,$2,'dumbbells','push')",
      [id, order === 0 ? "Acceptance press" : "Acceptance row"],
    );
    await pool.query(
      "insert into workout_exercises(workout_id,exercise_id,order_index) values ($1,$2,$3)",
      [workoutId, id, order],
    );
    await pool.query(
      'insert into workout_sets(workout,exercise,set,"targetReps") values ($1,$2,1,8),($1,$2,2,10)',
      [workoutId, id],
    );
  }
  const initial = await client.callTool({
    name: "show_workout",
    arguments: { workoutId },
  });
  const snapshot = resultSnapshot(initial);
  expect(snapshot.exerciseGroups[0].sets[0]).toMatchObject({
    targetReps: 8,
    reps: null,
    weight: null,
    reportedRir: null,
    isCompleted: false,
  });
  const foreign = await client.callTool({
    name: "show_workout",
    arguments: { workoutId: foreignWorkout },
  });
  expect(foreign.isError).toBe(true);
  expect(JSON.stringify(foreign)).not.toContain("Other private workout");
  for (const name of ["update_workout_widget_set", "finish_workout_widget"]) {
    const denied = await client.callTool({
      name,
      arguments: {
        workoutId: foreignWorkout,
        expectedRevision: snapshot.revision,
        ...(name === "update_workout_widget_set"
          ? { exerciseId, set: 1, updates: { reps: 2 } }
          : {}),
      },
    });
    expect(denied.isError).toBe(true);
  }
  expect(
    (
      await pool.query("select stop from workouts where id=$1", [
        foreignWorkout,
      ])
    ).rows[0].stop,
  ).toBeNull();
  const saved = resultSnapshot(
    await client.callTool({
      name: "update_workout_widget_set",
      arguments: {
        workoutId,
        expectedRevision: snapshot.revision,
        exerciseId,
        set: 1,
        updates: { reps: 7, isCompleted: true },
      },
    }),
  );
  expect(saved.exerciseGroups[0].sets[0]).toMatchObject({
    targetReps: 8,
    reps: 7,
    weight: null,
    reportedRir: null,
    isCompleted: true,
  });
  const stale = await client.callTool({
    name: "update_workout_widget_set",
    arguments: {
      workoutId,
      expectedRevision: snapshot.revision,
      exerciseId,
      set: 1,
      updates: { reps: 99 },
    },
  });
  expect(stale.isError).toBe(true);
  const reloaded = resultSnapshot(
    await client.callTool({
      name: "get_workout_widget",
      arguments: { workoutId },
    }),
  );
  expect(reloaded.exerciseGroups[0].sets[0].reps).toBe(7);
  expect(reloaded.revision).toBe(saved.revision);
  const foreignSet = await client.callTool({
    name: "update_workout_widget_set",
    arguments: {
      workoutId,
      expectedRevision: saved.revision,
      exerciseId: randomUUID(),
      set: 1,
      updates: { reps: 5 },
    },
  });
  expect(foreignSet.isError).toBe(true);
  const second = resultSnapshot(
    await client.callTool({
      name: "update_workout_widget_set",
      arguments: {
        workoutId,
        expectedRevision: saved.revision,
        exerciseId,
        set: 2,
        updates: { reps: 9, weight: 22.5, reportedRir: "2", isCompleted: true },
      },
    }),
  );
  expect(second.exerciseGroups[0].sets[1]).toMatchObject({
    reps: 9,
    weight: 22.5,
    reportedRir: "2",
    targetReps: 10,
  });
  await exerciseBrowser(client, workoutId, pool, owner);
  const finished = resultSnapshot(
    await client.callTool({
      name: "get_workout_widget",
      arguments: { workoutId },
    }),
  );
  expect(finished.workout.stop).not.toBeNull();
  expect(finished.exerciseGroups[1].sets[1]).toMatchObject({
    targetReps: 10,
    reps: null,
    reportedRir: null,
    isCompleted: false,
  });
  const late = await client.callTool({
    name: "update_workout_widget_set",
    arguments: {
      workoutId,
      expectedRevision: finished.revision,
      exerciseId,
      set: 1,
      updates: { reps: 20 },
    },
  });
  expect(late.isError).toBe(true);
}

async function exerciseBrowser(
  client: Client,
  workoutId: string,
  pool: Pool,
  owner: string,
) {
  const resource = await client.readResource({
    uri: "ui://fitness/active-workout-v1.html",
  });
  const html = z
    .object({
      contents: z.array(
        z.object({
          mimeType: z.literal("text/html;profile=mcp-app"),
          text: z.string(),
        }),
      ),
    })
    .parse(resource).contents[0].text;
  expect(html).not.toMatch(/<script[^>]+src=/);
  expect(html).toContain("SIL OPEN FONT LICENSE");
  expect(html).toContain("Copyright 2018 The Crimson Pro Project Authors");
  expect(html).toContain("Copyright 2014 The DM Sans Project Authors");
  const bundle = await build({
    configFile: false,
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    build: {
      write: false,
      lib: {
        entry: fileURLToPath(
          new URL("../../browser/mcp-workout-host.fixture.ts", import.meta.url),
        ),
        name: "WorkoutHost",
        formats: ["iife"],
      },
    },
  });
  const script = (Array.isArray(bundle) ? bundle : [bundle])
    .flatMap((output) => ("output" in output ? output.output : []))
    .flatMap((part) => (part.type === "chunk" ? [part.code] : []))
    .join("\n");
  const browser = await chromium.launch();
  try {
    for (const width of [320, 390]) {
      const page = await browser.newPage({
        viewport: { width, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      if (width === 390) {
        const refreshed = resultSnapshot(
          await client.callTool({
            name: "get_workout_widget",
            arguments: { workoutId },
          }),
        );
        const reset = resultSnapshot(
          await client.callTool({
            name: "update_workout_widget_set",
            arguments: {
              workoutId,
              expectedRevision: refreshed.revision,
              exerciseId: refreshed.exerciseGroups[1].exercise.id,
              set: 1,
              updates: { isCompleted: false, reportedRir: null },
            },
          }),
        );
        expect(reset.exerciseGroups[1].sets[0].isCompleted).toBe(false);
      }
      const shown = CallToolResultSchema.parse(
        await client.callTool({
          name: "show_workout",
          arguments: { workoutId },
        }),
      );
      let loseNextWriteResponse = false;
      let writes = 0;
      let corruptNextWriteAck = false;
      let corruptNextFinishAck = false;
      const browserErrors: string[] = [];
      page.on("pageerror", (error) => browserErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error")
          console.error("Widget host error:", message.text());
      });
      await page.exposeFunction("workoutTool", async (params: unknown) => {
        const parsed = z
          .object({
            name: z.string(),
            arguments: z.record(z.string(), z.unknown()).optional(),
          })
          .parse(params);
        if (parsed.name === "update_workout_widget_set") writes++;
        const result = CallToolResultSchema.parse(
          await client.callTool(parsed),
        );
        if (
          loseNextWriteResponse &&
          parsed.name === "update_workout_widget_set"
        ) {
          loseNextWriteResponse = false;
          throw new Error(
            "Acceptance simulated connection loss after server committed; refresh to reconcile.",
          );
        }
        if (
          corruptNextWriteAck &&
          parsed.name === "update_workout_widget_set"
        ) {
          corruptNextWriteAck = false;
          const snapshot = resultSnapshot(result);
          const exerciseId = parsed.arguments?.exerciseId;
          const set = parsed.arguments?.set;
          return {
            ...result,
            structuredContent: {
              ...result.structuredContent,
              snapshot: {
                ...snapshot,
                exerciseGroups: snapshot.exerciseGroups.map((group) => ({
                  ...group,
                  sets: group.sets.map((row) =>
                    group.exercise.id === exerciseId && row.set === set
                      ? { ...row, reps: (row.reps ?? 0) + 1 }
                      : row,
                  ),
                })),
              },
            },
          };
        }
        if (corruptNextFinishAck && parsed.name === "finish_workout_widget") {
          corruptNextFinishAck = false;
          const snapshot = resultSnapshot(result);
          return {
            ...result,
            structuredContent: {
              ...result.structuredContent,
              snapshot: {
                ...snapshot,
                workout: { ...snapshot.workout, stop: null },
              },
            },
          };
        }
        return result;
      });
      await page.setContent(
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
      );
      await page.addScriptTag({ content: script });
      await page.evaluate(
        async ({ html, shown, workoutId }) => {
          await window.mountWorkoutHost(html, shown, workoutId);
        },
        { html, shown, workoutId },
      );
      const app = page.frameLocator('iframe[title="Fitness workout app"]');
      try {
        await browserExpect(
          app.getByText("Acceptance press", { exact: true }),
        ).toBeVisible();
      } catch (error) {
        await writeFile(
          "/tmp/fitness-mcp-workout-browser-failure.json",
          JSON.stringify({
            errors: browserErrors,
            body: await app.locator("body").innerText(),
          }),
        );
        throw error;
      }
      await browserExpect(
        app.getByText("Target 8", { exact: true }),
      ).toBeVisible();
      await browserExpect(
        app.getByLabel("Set 1 actual reps"),
      ).toHaveAccessibleDescription("Target 8");
      await browserExpect(
        app.getByLabel("Set 1 actual reps").first(),
      ).toHaveValue(width === 320 ? "7" : "6");
      expect(
        await page
          .frames()[1]
          .evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      await page.locator("iframe").screenshot({
        path: `/tmp/fitness-mcp-workout-${width}-active.png`,
      });
      for (const [column, label] of [
        [1, "Set 1 actual reps"],
        [2, "Set 1 actual weight in kg"],
      ] as const) {
        const header = await app
          .locator(".mcp-columns > span")
          .nth(column)
          .boundingBox();
        const input = await app.getByLabel(label).boundingBox();
        if (!header || !input)
          throw new Error("Missing workout column geometry");
        expect(
          Math.abs(header.x + header.width / 2 - input.x - input.width / 2),
        ).toBeLessThanOrEqual(1);
      }
      for (const name of ["Save changes to set 1", "Compact", "Refresh"]) {
        const box = await app
          .getByRole("button", { name, exact: true })
          .boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }
      if (width === 320) {
        await app.getByLabel("Set 1 actual reps").fill("6");
        await app.getByLabel("Set 1 actual weight in kg").fill("20");
        await app
          .getByRole("button", { name: "Set 1 RIR, unreported", exact: true })
          .tap();
        await page.locator("iframe").screenshot({
          path: `/tmp/fitness-mcp-workout-${width}-rir.png`,
        });
        await app.getByLabel("Set 1 RIR", { exact: true }).selectOption("1");
        await app
          .getByRole("button", { name: "Save changes to set 1", exact: true })
          .tap();
        await browserExpect(
          app.getByRole("button", { name: "Refresh", exact: true }),
        ).toBeEnabled();
        const saved = resultSnapshot(
          await client.callTool({
            name: "get_workout_widget",
            arguments: { workoutId },
          }),
        );
        expect(saved.exerciseGroups[0].sets[0]).toMatchObject({
          reps: 6,
          weight: 20,
          reportedRir: "1",
          targetReps: 8,
        });
        await app.getByRole("button", { name: /Next →/ }).tap();
        await browserExpect(
          app.getByText("Acceptance row", { exact: true }),
        ).toBeVisible();
        await browserExpect(app.getByLabel("Set 1 actual reps")).toHaveValue(
          "",
        );
        await app.getByLabel("Set 1 actual reps").fill("5");
        await app.getByRole("button", { name: "Log set 1", exact: true }).tap();
        await browserExpect(
          app.getByRole("button", {
            name: "Save changes to set 1",
            exact: true,
          }),
        ).toBeVisible();
        await browserExpect(
          app.getByText("Acceptance row", { exact: true }),
        ).toBeVisible();
        await browserExpect(
          app.getByRole("button", { name: "Log set 2", exact: true }),
        ).toBeVisible();
        await browserExpect(app.getByRole("timer")).toBeVisible();
        await page.locator("iframe").screenshot({
          path: `/tmp/fitness-mcp-workout-${width}-rest.png`,
        });
        await app.getByLabel("Set 1 actual reps").fill("6");
        loseNextWriteResponse = true;
        await app
          .getByRole("button", { name: "Save changes to set 1", exact: true })
          .tap();
        await browserExpect(app.getByRole("alert")).toBeVisible();
        await browserExpect(app.getByLabel("Set 1 actual reps")).toHaveValue(
          "6",
        );
        const committedWrites = writes;
        await app
          .getByRole("button", { name: "Save changes to set 1", exact: true })
          .tap();
        await browserExpect(app.getByRole("alert")).toContainText("Refresh");
        expect(writes).toBe(committedWrites);
        await app.getByRole("button", { name: "Refresh", exact: true }).tap();
        await browserExpect(
          app.getByRole("button", {
            name: "Save changes to set 1",
            exact: true,
          }),
        ).toBeVisible();
        await browserExpect(app.getByLabel("Set 1 actual reps")).toHaveValue(
          "6",
        );
        await app
          .getByRole("region", {
            name: "Set 1 changed saved values",
            exact: true,
          })
          .getByRole("button", { name: "Keep my edits", exact: true })
          .tap();

        await app.getByLabel("Set 1 actual reps").fill("9");
        corruptNextWriteAck = true;
        await app
          .getByRole("button", { name: "Save changes to set 1", exact: true })
          .tap();
        await browserExpect(app.getByRole("alert")).toContainText(
          "differs from your inputs",
        );
        await browserExpect(
          app.getByRole("button", {
            name: "Save changes to set 1",
            exact: true,
          }),
        ).toBeDisabled();
        await browserExpect(app.getByLabel("Set 1 actual reps")).toHaveValue(
          "9",
        );
        await app.getByRole("button", { name: "Refresh", exact: true }).tap();
        await app
          .getByRole("region", {
            name: "Set 1 changed saved values",
            exact: true,
          })
          .getByRole("button", { name: "Keep my edits", exact: true })
          .tap();
        await browserExpect(app.getByRole("timer")).toHaveText(/1:[0-5][0-9]/);
        await app.getByRole("button", { name: "Compact", exact: true }).tap();
        await browserExpect(app.getByText(/^Rest 1:/)).toBeVisible();
        await page.locator("iframe").screenshot({
          path: `/tmp/fitness-mcp-workout-${width}-compact.png`,
        });
        await app.getByRole("button", { name: "Open", exact: true }).tap();
        await browserExpect(app.getByRole("timer")).toBeVisible();
        await app
          .getByRole("button", { name: "Add 15 seconds rest", exact: true })
          .tap();
        await browserExpect(app.getByRole("timer")).toHaveText(/1:[34][0-9]/);
        await app.getByRole("button", { name: "Skip", exact: true }).tap();
        await browserExpect(app.getByRole("timer")).toHaveCount(0);
        // Another coach updates while this widget retains a draft. The stale write must preserve it.
        await app.getByLabel("Set 2 actual reps").fill("4");
        await app.getByLabel("Set 1 actual reps").fill("7");
        const concurrent = resultSnapshot(
          await client.callTool({
            name: "get_workout_widget",
            arguments: { workoutId },
          }),
        );
        await client.callTool({
          name: "update_workout_widget_set",
          arguments: {
            workoutId,
            expectedRevision: concurrent.revision,
            exerciseId: concurrent.exerciseGroups[1].exercise.id,
            set: 1,
            updates: { reps: 8, weight: 30, reportedRir: "3" },
          },
        });
        await app.getByRole("button", { name: "Log set 2", exact: true }).tap();
        await browserExpect(app.getByRole("alert")).toBeVisible();
        await browserExpect(app.getByLabel("Set 2 actual reps")).toHaveValue(
          "4",
        );
        const authoritative = resultSnapshot(
          await client.callTool({
            name: "get_workout_widget",
            arguments: { workoutId },
          }),
        );
        expect(authoritative.exerciseGroups[1].sets[1]).toMatchObject({
          reps: null,
          reportedRir: null,
          isCompleted: false,
        });
        await browserExpect(
          app.getByText("Acceptance row", { exact: true }),
        ).toBeVisible();
        await app.getByRole("button", { name: "Refresh", exact: true }).tap();
        await browserExpect(app.getByLabel("Set 1 actual reps")).toHaveValue(
          "7",
        );
        await browserExpect(
          app.getByLabel("Set 1 actual weight in kg"),
        ).toHaveValue("30");
        await app
          .getByRole("button", { name: "Set 1 RIR, 3", exact: true })
          .tap();
        await browserExpect(
          app.getByLabel("Set 1 RIR", { exact: true }),
        ).toHaveValue("3");
        const comparison = app.getByRole("region", {
          name: "Set 1 changed saved values",
          exact: true,
        });
        await browserExpect(comparison).toContainText("Current saved: 8 reps");
        await comparison
          .getByRole("button", { name: "Keep my edits", exact: true })
          .tap();
        await browserExpect(comparison).toHaveCount(0);
        await app
          .locator(".mcp-set")
          .nth(0)
          .getByRole("button", { name: "Reset inputs", exact: true })
          .tap();
        await app
          .locator(".mcp-set")
          .nth(1)
          .getByRole("button", { name: "Reset inputs", exact: true })
          .tap();
        await browserExpect(app.getByLabel("Set 1 actual reps")).toHaveValue(
          "8",
        );
        await browserExpect(app.getByLabel("Set 2 actual reps")).toHaveValue(
          "",
        );
      }
      await page.locator("iframe").screenshot({
        path: `/tmp/fitness-mcp-workout-${width}.png`,
      });
      if (width === 390) {
        await app.getByRole("button", { name: /Next →/ }).tap();
        await app.getByRole("button", { name: "Log set 1", exact: true }).tap();
        await browserExpect(app.getByRole("timer")).toBeVisible();
        await page.locator("iframe").screenshot({
          path: `/tmp/fitness-mcp-workout-${width}-rest.png`,
        });
        await app.getByRole("button", { name: "Compact", exact: true }).tap();
        await browserExpect(app.getByText(/^Rest 1:/)).toBeVisible();
        await page.locator("iframe").screenshot({
          path: `/tmp/fitness-mcp-workout-${width}-compact.png`,
        });
        await app.getByRole("button", { name: "Open", exact: true }).tap();
        await app.getByRole("button", { name: "Skip", exact: true }).tap();
        await app.getByLabel("Set 2 actual reps").fill("8");
        const finishButton = app.getByRole("button", {
          name: "Finish workout",
          exact: true,
        });
        await finishButton.focus();
        await finishButton.press("Enter");
        await browserExpect(
          app.getByRole("dialog", { name: "Finish workout?", exact: true }),
        ).toContainText("1 set is not logged");
        await page.locator("iframe").screenshot({
          path: `/tmp/fitness-mcp-workout-${width}-finish-dialog.png`,
        });
        await browserExpect(
          app.getByRole("button", { name: "Keep working", exact: true }),
        ).toBeFocused();
        await page.keyboard.press("Escape");
        await browserExpect(
          app.getByRole("dialog", { name: "Finish workout?", exact: true }),
        ).toBeHidden();
        await browserExpect(
          app.getByRole("button", { name: "Finish workout", exact: true }),
        ).toBeFocused();
        await app
          .getByRole("button", { name: "Finish workout", exact: true })
          .tap();
        await app
          .getByRole("button", { name: "Keep working", exact: true })
          .tap();
        await browserExpect(app.getByLabel("Set 2 actual reps")).toHaveValue(
          "8",
        );
        await app
          .getByRole("button", { name: "Finish workout", exact: true })
          .tap();
        corruptNextFinishAck = true;
        await app
          .getByRole("button", { name: "Confirm finish", exact: true })
          .tap();
        const finishDialog = app.getByRole("dialog", {
          name: "Finish workout?",
          exact: true,
        });
        await browserExpect(finishDialog.getByRole("alert")).toContainText(
          "not confirmed",
        );
        await browserExpect(
          finishDialog.getByRole("button", {
            name: "Confirm finish",
            exact: true,
          }),
        ).toBeDisabled();
        await finishDialog
          .getByRole("button", { name: "Refresh", exact: true })
          .tap();
        await browserExpect(
          app.getByRole("heading", { name: "Workout complete", exact: true }),
        ).toBeVisible();
        await browserExpect(
          app.locator(".mcp-done-stats > div").nth(1),
        ).toContainText("3 / 4");
        await page.locator("iframe").screenshot({
          path: `/tmp/fitness-mcp-workout-${width}-complete.png`,
        });
        await page.setViewportSize({ width: 320, height: 844 });
        await page.locator("iframe").screenshot({
          path: "/tmp/fitness-mcp-workout-320-complete.png",
        });
      }
      await page.close();
    }
    const warmupId = randomUUID();
    const completed = resultSnapshot(
      await client.callTool({
        name: "get_workout_widget",
        arguments: { workoutId },
      }),
    );
    const exerciseId = completed.exerciseGroups[0].exercise.id;
    await pool.query(
      "insert into workouts(user_id,id,name,start) values($1,$2,'Warmup acceptance workout',timezone('UTC',now())-interval '5 minutes')",
      [owner, warmupId],
    );
    await pool.query(
      "insert into workout_exercises(workout_id,exercise_id,order_index) values($1,$2,0)",
      [warmupId, exerciseId],
    );
    await pool.query(
      'insert into workout_sets(workout,exercise,set,"targetReps","isWarmup") values($1,$2,1,12,true),($1,$2,2,8,false)',
      [warmupId, exerciseId],
    );
    for (const width of [320, 390]) {
      const page = await browser.newPage({
        viewport: { width, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      await page.exposeFunction("workoutTool", async (params: unknown) => {
        const parsed = z
          .object({
            name: z.string(),
            arguments: z.record(z.string(), z.unknown()).optional(),
          })
          .parse(params);
        return CallToolResultSchema.parse(await client.callTool(parsed));
      });
      const shown = CallToolResultSchema.parse(
        await client.callTool({
          name: "show_workout",
          arguments: { workoutId: warmupId },
        }),
      );
      await page.setContent(
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
      );
      await page.addScriptTag({ content: script });
      await page.evaluate(
        async ({ html, shown, workoutId }) => {
          await window.mountWorkoutHost(html, shown, workoutId);
        },
        { html, shown, workoutId: warmupId },
      );
      const app = page.frameLocator('iframe[title="Fitness workout app"]');
      await browserExpect(
        app.getByText("Warmup acceptance workout", { exact: true }),
      ).toBeVisible();
      await browserExpect(
        app.getByRole("button", { name: /^Set 1 RIR/ }),
      ).toHaveCount(0);
      await browserExpect(app.getByLabel("Set 1 actual reps")).toHaveValue("");
      await page.locator("iframe").screenshot({
        path: `/tmp/fitness-mcp-workout-${width}-warmup.png`,
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}
