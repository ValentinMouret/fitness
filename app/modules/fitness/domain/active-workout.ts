import { z } from "zod";
import { reportedRirValues } from "./workout";
import { patchSetSchema, workoutIdSchema } from "./workout-commands";

export const activeWorkoutReadSchema = workoutIdSchema;
const guardedWorkoutSchema = workoutIdSchema.extend({
  expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
});
export const activeWorkoutPatchSchema = guardedWorkoutSchema.extend({
  exerciseId: z.uuid(),
  set: z.number().int().positive().max(2147483647),
  updates: patchSetSchema.shape.updates
    .pick({ reps: true, weight: true, reportedRir: true, isCompleted: true })
    .refine(
      (updates) => Object.values(updates).some((value) => value !== undefined),
      "Provide a set update",
    ),
});
export const activeWorkoutFinishSchema = guardedWorkoutSchema;
export const activeWorkoutSnapshotSchema = z.object({
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  workout: z.object({
    id: z.uuid(),
    name: z.string(),
    start: z.iso.datetime(),
    stop: z.iso.datetime().nullable(),
    notes: z.string().nullable(),
  }),
  exerciseGroups: z.array(
    z.object({
      exercise: z.object({
        id: z.uuid(),
        name: z.string(),
        type: z.string(),
        description: z.string().nullable(),
        mmcInstructions: z.string().nullable(),
      }),
      orderIndex: z.number().int(),
      notes: z.string().nullable(),
      sets: z.array(
        z.object({
          set: z.number().int(),
          targetReps: z.number().nullable(),
          reps: z.number().nullable(),
          weight: z.number().nullable(),
          reportedRir: z.enum(reportedRirValues).nullable(),
          isCompleted: z.boolean(),
          isWarmup: z.boolean(),
          isFailure: z.boolean(),
          note: z.string().nullable(),
          rpe: z.number().nullable(),
        }),
      ),
    }),
  ),
});
export type ActiveWorkoutSnapshot = Readonly<
  z.infer<typeof activeWorkoutSnapshotSchema>
>;
export type ActiveWorkoutPatch = Readonly<
  z.infer<typeof activeWorkoutPatchSchema>
>;
export type ActiveWorkoutFinish = Readonly<
  z.infer<typeof activeWorkoutFinishSchema>
>;
