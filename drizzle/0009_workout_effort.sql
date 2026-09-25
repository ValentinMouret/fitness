alter table "workout_sets" add column "reported_rir" text;--> statement-breakpoint
alter table "workout_sets" add constraint "reported_rir_valid" check ("workout_sets"."reported_rir" is null or ("workout_sets"."reported_rir" in ('0', '1', '2', '3', '4+', 'unsure') and "workout_sets"."isCompleted" and not "workout_sets"."isWarmup"));--> statement-breakpoint
create or replace view fitness_data.sets with (security_barrier = true) as
select s.workout as workout_id
     , s.exercise as exercise_id
     , s.set as set_number
     , s."targetReps" as target_reps
     , s.reps
     , s.weight as weight_kg
     , s.note
     , s."isCompleted" as is_completed
     , s."isWarmup" as is_warmup
     , s."isFailure" as is_failure
     , s.rpe
     , s."isCompleted" and not s."isWarmup" as is_working_set
     , case when s."isCompleted" and not s."isWarmup" then coalesce(s.reps * s.weight, 0) else 0 end as volume_kg
     , s.reported_rir
  from public.workout_sets s
  join fitness_data.workout_exercises we on we.workout_id = s.workout and we.exercise_id = s.exercise
 where s.deleted_at is null;
