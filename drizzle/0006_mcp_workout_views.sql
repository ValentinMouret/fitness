create schema fitness_data;
--> statement-breakpoint
revoke all on schema fitness_data from public;
--> statement-breakpoint
create view fitness_data.workouts with (security_barrier = true) as
select id
     , name
     , start at time zone 'UTC' as start
     , stop at time zone 'UTC' as stop
     , notes
  from public.workouts
 where deleted_at is null;
--> statement-breakpoint
create view fitness_data.exercises with (security_barrier = true) as
select id
     , name
     , type::text as type
     , movement_pattern::text as movement_pattern
     , description
     , mmc_instructions
  from public.exercises
 where deleted_at is null;
--> statement-breakpoint
create view fitness_data.workout_exercises with (security_barrier = true) as
select we.workout_id
     , we.exercise_id
     , we.order_index
     , we.notes
  from public.workout_exercises we
  join fitness_data.workouts w on w.id = we.workout_id
  join fitness_data.exercises e on e.id = we.exercise_id
 where we.deleted_at is null;
--> statement-breakpoint
create view fitness_data.sets with (security_barrier = true) as
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
  from public.workout_sets s
  join fitness_data.workout_exercises we on we.workout_id = s.workout and we.exercise_id = s.exercise
 where s.deleted_at is null;
--> statement-breakpoint
create view fitness_data.exercise_muscles with (security_barrier = true) as
select m.exercise as exercise_id
     , m.muscle_group::text as muscle_group
     , m.split as contribution_percent
  from public.exercise_muscle_groups m
  join fitness_data.exercises e on e.id = m.exercise
 where m.deleted_at is null;
--> statement-breakpoint
create view fitness_data.muscle_volume with (security_barrier = true) as
select s.workout_id
     , s.exercise_id
     , s.set_number
     , w.start
     , m.muscle_group
     , m.contribution_percent / 100.0 as weighted_sets
     , s.volume_kg * m.contribution_percent / 100.0 as volume_kg
  from fitness_data.sets s
  join fitness_data.workouts w on w.id = s.workout_id
  join fitness_data.exercise_muscles m on m.exercise_id = s.exercise_id
 where s.is_working_set;
