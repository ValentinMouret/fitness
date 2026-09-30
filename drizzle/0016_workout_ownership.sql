alter table workout_templates add column user_id uuid;
--> statement-breakpoint
alter table workouts add column user_id uuid;
--> statement-breakpoint
do $$
declare
  owner_id uuid;
  owner_count integer;
begin
  if exists (select 1 from workouts) or exists (select 1 from workout_templates) then
    select count(*), (array_agg(user_id))[1]
      into owner_count, owner_id
      from auth_invitations
     where user_id = invited_by
       and accepted_at is not null
       and revoked_at is null;
    if owner_count <> 1 then
      raise exception 'Workout ownership requires exactly one explicitly bootstrapped owner before migration';
    end if;
    update workouts set user_id = owner_id;
    update workout_templates set user_id = owner_id;
  end if;
end $$;
--> statement-breakpoint
do $$
declare
  constraint_name text;
  constraint_count integer;
begin
  select count(*), min(c.conname::text) into constraint_count, constraint_name
    from pg_constraint c
   where c.conrelid = 'public.workouts'::regclass
     and c.confrelid = 'public.workout_templates'::regclass
     and c.contype = 'f'
     and c.conname in ('workouts_template_id_workout_templates_id_fk', 'workouts_template_id_fkey')
     and c.conkey = array[(select attnum from pg_attribute where attrelid = 'public.workouts'::regclass and attname = 'template_id')]
     and c.confkey = array[(select attnum from pg_attribute where attrelid = 'public.workout_templates'::regclass and attname = 'id')];
  if constraint_count <> 1 then
    raise exception 'Workout ownership requires exactly one recognized workouts.template_id foreign key to workout_templates.id';
  end if;
  execute format('alter table public.workouts drop constraint %I', constraint_name);
end $$;
--> statement-breakpoint
alter table workouts alter column user_id set not null;
--> statement-breakpoint
alter table workout_templates alter column user_id set not null;
--> statement-breakpoint
CREATE UNIQUE INDEX "workout_templates_user_id_id_idx" ON "workout_templates" USING btree ("user_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "workouts_user_id_id_idx" ON "workouts" USING btree ("user_id","id");
--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_workout_exercise_workout_exercises_workout_id_exercise_id_fk" FOREIGN KEY ("workout","exercise") REFERENCES "public"."workout_exercises"("workout_id","exercise_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workout_template_sets" ADD CONSTRAINT "workout_template_sets_template_id_exercise_id_workout_template_exercises_template_id_exercise_id_fk" FOREIGN KEY ("template_id","exercise_id") REFERENCES "public"."workout_template_exercises"("template_id","exercise_id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workout_templates" ADD CONSTRAINT "workout_templates_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workout_templates" ADD CONSTRAINT "workout_templates_user_id_source_workout_id_workouts_user_id_id_fk" FOREIGN KEY ("user_id","source_workout_id") REFERENCES "public"."workouts"("user_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_template_id_workout_templates_user_id_id_fk" FOREIGN KEY ("user_id","template_id") REFERENCES "public"."workout_templates"("user_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
create or replace view fitness_data.workouts with (security_barrier = true) as
select id
     , name
     , start at time zone 'UTC' as start
     , stop at time zone 'UTC' as stop
     , notes
  from public.workouts
 where deleted_at is null
   and user_id::text = nullif(current_setting('fitness.user_id', true), '');
