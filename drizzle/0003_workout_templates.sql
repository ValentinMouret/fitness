create table workout_templates (
  id             uuid        primary key default gen_random_uuid(),
  name           text        not null,
  source_workout_id uuid,
  created_at     timestamp   not null default now(),
  updated_at     timestamp,
  deleted_at     timestamp
);
--> statement-breakpoint

create table workout_template_exercises (
  template_id    uuid        not null references workout_templates(id),
  exercise_id    uuid        not null references exercises(id),
  order_index    integer     not null,
  notes          text,
  created_at     timestamp   not null default now(),
  updated_at     timestamp,
  deleted_at     timestamp,
  constraint workout_template_exercises_pk primary key (template_id, exercise_id),
  constraint template_order_index_positive check (order_index >= 0)
);
--> statement-breakpoint

create table workout_template_sets (
  template_id    uuid        not null references workout_templates(id),
  exercise_id    uuid        not null references exercises(id),
  set            integer     not null,
  target_reps    integer,
  weight         double precision,
  is_warmup      boolean     not null default false,
  created_at     timestamp   not null default now(),
  updated_at     timestamp,
  deleted_at     timestamp,
  constraint workout_template_sets_pk primary key (template_id, exercise_id, set),
  constraint template_set_is_positive check (set > 0)
);
--> statement-breakpoint

alter table workouts add column template_id uuid references workout_templates(id);
