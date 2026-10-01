CREATE TABLE "exercise_preferences" (
	"user_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"description" text,
	"mmc_instructions" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	CONSTRAINT "exercise_preferences_user_id_exercise_id_pk" PRIMARY KEY("user_id","exercise_id")
);
--> statement-breakpoint
ALTER TABLE "exercise_preferences" ADD CONSTRAINT "exercise_preferences_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_preferences" ADD CONSTRAINT "exercise_preferences_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
do $$
declare
  owner_id uuid;
  owner_count integer;
begin
  if exists (select 1 from exercises where description is not null or mmc_instructions is not null) then
    select count(*), (array_agg(user_id))[1] into owner_count, owner_id
      from auth_invitations
     where user_id = invited_by and accepted_at is not null and revoked_at is null;
    if owner_count <> 1 then
      raise exception 'Private exercise content requires exactly one explicitly bootstrapped owner before migration';
    end if;
    insert into exercise_preferences (user_id, exercise_id, description, mmc_instructions, created_at, updated_at)
      select owner_id, id, description, mmc_instructions, created_at, updated_at
        from exercises
       where description is not null or mmc_instructions is not null;
    update exercises set description = null, mmc_instructions = null;
  end if;
end $$;
--> statement-breakpoint
create or replace view fitness_data.exercises with (security_barrier = true) as
select e.id
     , e.name
     , e.type::text as type
     , e.movement_pattern::text as movement_pattern
     , p.description
     , p.mmc_instructions
  from public.exercises e
  left join public.exercise_preferences p
    on p.exercise_id = e.id
   and p.user_id = nullif(current_setting('fitness.user_id', true), '')::uuid
   and p.deleted_at is null
 where e.deleted_at is null;
