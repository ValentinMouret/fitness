import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { db } from "~/db";
import {
  exercises,
  workoutTemplateExercises,
  workoutTemplateSets,
  workoutTemplates,
  workouts,
} from "~/db/schema";
import { logger } from "~/logger.server";
import type { ErrRepository } from "~/repository";
import { executeQuery } from "~/repository.server";
import type { Exercise } from "../domain/workout";
import type {
  WorkoutTemplate,
  WorkoutTemplateWithDetails,
} from "../domain/workout-template";

export const WorkoutTemplateRepository = {
  save(
    template: Omit<WorkoutTemplate, "id">,
  ): ResultAsync<WorkoutTemplate, ErrRepository> {
    return ResultAsync.fromPromise(
      db.transaction(async (tx) => {
        const [record] = await tx
          .insert(workoutTemplates)
          .values({
            name: template.name,
            source_workout_id: template.sourceWorkoutId ?? null,
          })
          .returning();

        for (const exercise of template.exercises) {
          await tx.insert(workoutTemplateExercises).values({
            template_id: record.id,
            exercise_id: exercise.exerciseId,
            order_index: exercise.orderIndex,
            notes: exercise.notes ?? null,
          });
        }

        for (const set of template.sets) {
          await tx.insert(workoutTemplateSets).values({
            template_id: record.id,
            exercise_id: set.exerciseId,
            set: set.set,
            target_reps: set.targetReps ?? null,
            weight: set.weight ?? null,
            is_warmup: set.isWarmup,
          });
        }

        return {
          id: record.id,
          name: record.name,
          sourceWorkoutId: record.source_workout_id ?? undefined,
          exercises: template.exercises,
          sets: template.sets,
        } satisfies WorkoutTemplate;
      }),
      (error) => {
        logger.error({ err: error }, "Error saving workout template");
        return "database_error" as const;
      },
    );
  },

  findAllWithDetails(): ResultAsync<
    ReadonlyArray<WorkoutTemplateWithDetails>,
    ErrRepository
  > {
    const query = db
      .select({
        id: workoutTemplates.id,
        name: workoutTemplates.name,
        source_workout_id: workoutTemplates.source_workout_id,
        created_at: workoutTemplates.created_at,
        exercise_id: workoutTemplateExercises.exercise_id,
        order_index: workoutTemplateExercises.order_index,
        exercise_notes: workoutTemplateExercises.notes,
        exercise_name: exercises.name,
        exercise_type: exercises.type,
        exercise_movement_pattern: exercises.movement_pattern,
        exercise_description: exercises.description,
        exercise_mmc: exercises.mmc_instructions,
        set_number: workoutTemplateSets.set,
        target_reps: workoutTemplateSets.target_reps,
        weight: workoutTemplateSets.weight,
        is_warmup: workoutTemplateSets.is_warmup,
      })
      .from(workoutTemplates)
      .leftJoin(
        workoutTemplateExercises,
        and(
          eq(workoutTemplates.id, workoutTemplateExercises.template_id),
          isNull(workoutTemplateExercises.deleted_at),
        ),
      )
      .leftJoin(
        exercises,
        eq(workoutTemplateExercises.exercise_id, exercises.id),
      )
      .leftJoin(
        workoutTemplateSets,
        and(
          eq(workoutTemplates.id, workoutTemplateSets.template_id),
          eq(
            workoutTemplateExercises.exercise_id,
            workoutTemplateSets.exercise_id,
          ),
          isNull(workoutTemplateSets.deleted_at),
        ),
      )
      .where(isNull(workoutTemplates.deleted_at))
      .orderBy(
        desc(workoutTemplates.created_at),
        workoutTemplateExercises.order_index,
        workoutTemplateSets.set,
      );

    const usageQuery = db
      .select({
        template_id: workouts.template_id,
        usage_count: sql<number>`count(*)`.as("usage_count"),
        last_used_at: sql<Date>`max(${workouts.start})`.as("last_used_at"),
      })
      .from(workouts)
      .where(
        and(
          isNull(workouts.deleted_at),
          sql`${workouts.template_id} is not null`,
        ),
      )
      .groupBy(workouts.template_id);

    return ResultAsync.combine([
      executeQuery(query, "findAllTemplatesWithDetails"),
      executeQuery(usageQuery, "countTemplateUsage"),
    ]).map(([records, usageRecords]) => {
      const usageMap = new Map(
        usageRecords.map((r) => [
          r.template_id,
          {
            usageCount: Number(r.usage_count),
            lastUsedAt: r.last_used_at ? new Date(r.last_used_at) : undefined,
          },
        ]),
      );

      const templateMap = new Map<string, WorkoutTemplateWithDetails>();

      for (const r of records) {
        if (!templateMap.has(r.id)) {
          const usage = usageMap.get(r.id);
          templateMap.set(r.id, {
            id: r.id,
            name: r.name,
            sourceWorkoutId: r.source_workout_id ?? undefined,
            exercises: [],
            sets: [],
            exerciseDetails: [],
            usageCount: usage?.usageCount ?? 0,
            lastUsedAt: usage?.lastUsedAt,
            createdAt: r.created_at,
          });
        }

        const template = templateMap.get(r.id);
        if (!template) continue;

        if (
          r.exercise_id &&
          r.exercise_name &&
          r.exercise_type &&
          r.exercise_movement_pattern
        ) {
          const exerciseExists = template.exercises.some(
            (e) => e.exerciseId === r.exercise_id,
          );
          if (!exerciseExists) {
            (template.exercises as WorkoutTemplate["exercises"][number][]).push(
              {
                exerciseId: r.exercise_id,
                orderIndex: r.order_index ?? 0,
                notes: r.exercise_notes ?? undefined,
              },
            );
            (template.exerciseDetails as Exercise[]).push({
              id: r.exercise_id,
              name: r.exercise_name,
              type: r.exercise_type,
              movementPattern: r.exercise_movement_pattern,
              description: r.exercise_description ?? undefined,
              mmcInstructions: r.exercise_mmc ?? undefined,
            });
          }

          if (r.set_number != null) {
            const setExists = template.sets.some(
              (s) => s.exerciseId === r.exercise_id && s.set === r.set_number,
            );
            if (!setExists) {
              (template.sets as WorkoutTemplate["sets"][number][]).push({
                exerciseId: r.exercise_id,
                set: r.set_number,
                targetReps: r.target_reps ?? undefined,
                weight: r.weight ?? undefined,
                isWarmup: r.is_warmup ?? false,
              });
            }
          }
        }
      }

      return Array.from(templateMap.values());
    });
  },

  findById(
    id: string,
  ): ResultAsync<WorkoutTemplateWithDetails | null, ErrRepository> {
    return this.findAllWithDetails().map(
      (templates) => templates.find((t) => t.id === id) ?? null,
    );
  },

  delete(id: string): ResultAsync<void, ErrRepository> {
    return ResultAsync.fromPromise(
      db.transaction(async (tx) => {
        await tx
          .update(workoutTemplateSets)
          .set({ deleted_at: new Date() })
          .where(eq(workoutTemplateSets.template_id, id));

        await tx
          .update(workoutTemplateExercises)
          .set({ deleted_at: new Date() })
          .where(eq(workoutTemplateExercises.template_id, id));

        await tx
          .update(workoutTemplates)
          .set({ deleted_at: new Date() })
          .where(eq(workoutTemplates.id, id));
      }),
      (error) => {
        logger.error({ err: error }, "Error deleting workout template");
        return "database_error" as const;
      },
    );
  },
};
