ALTER TABLE "equipment_instances" ADD COLUMN "user_id" uuid;
--> statement-breakpoint
ALTER TABLE "equipment_preferences" ADD COLUMN "user_id" uuid;
--> statement-breakpoint
ALTER TABLE "generation_conversations" ADD COLUMN "user_id" uuid;
--> statement-breakpoint
ALTER TABLE "gym_floors" ADD COLUMN "user_id" uuid;
--> statement-breakpoint
ALTER TABLE "training_preferences" ADD COLUMN "user_id" uuid;
--> statement-breakpoint
do $$
declare
  owner_id uuid;
  owner_count integer;
begin
  if exists (select 1 from gym_floors) or exists (select 1 from equipment_instances) or exists (select 1 from equipment_preferences) or exists (select 1 from training_preferences) or exists (select 1 from generation_conversations) then
    select count(*), (array_agg(user_id))[1] into owner_count, owner_id
      from auth_invitations
     where user_id = invited_by and accepted_at is not null and revoked_at is null;
    if owner_count <> 1 then
      raise exception 'Private gym and preference ownership requires exactly one explicitly bootstrapped owner before migration';
    end if;
    update gym_floors set user_id = owner_id;
    update equipment_instances set user_id = owner_id;
    update equipment_preferences set user_id = owner_id;
    update training_preferences set user_id = owner_id;
    update generation_conversations set user_id = owner_id;
  end if;
end $$;
--> statement-breakpoint
alter table gym_floors alter column user_id set not null;
--> statement-breakpoint
alter table equipment_instances alter column user_id set not null;
--> statement-breakpoint
alter table equipment_preferences alter column user_id set not null;
--> statement-breakpoint
alter table training_preferences alter column user_id set not null;
--> statement-breakpoint
alter table generation_conversations alter column user_id set not null;
--> statement-breakpoint
DROP INDEX "gym_floors_number_unique_idx";
--> statement-breakpoint
ALTER TABLE "equipment_preferences" DROP CONSTRAINT "equipment_preferences_muscle_group_exercise_type_pk";
--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_instances_user_id_id_idx" ON "equipment_instances" USING btree ("user_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "gym_floors_user_id_id_idx" ON "gym_floors" USING btree ("user_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "gym_floors_number_unique_idx" ON "gym_floors" USING btree ("user_id","floor_number") WHERE "gym_floors"."deleted_at" is null;
--> statement-breakpoint
ALTER TABLE "equipment_preferences" ADD CONSTRAINT "equipment_preferences_user_id_muscle_group_exercise_type_pk" PRIMARY KEY("user_id","muscle_group","exercise_type");
--> statement-breakpoint
ALTER TABLE "equipment_instances" ADD CONSTRAINT "equipment_instances_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "equipment_instances" ADD CONSTRAINT "equipment_instances_owner_floor_fk" FOREIGN KEY ("user_id","gym_floor_id") REFERENCES "public"."gym_floors"("user_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "equipment_preferences" ADD CONSTRAINT "equipment_preferences_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "generation_conversations" ADD CONSTRAINT "generation_conversations_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "generation_conversations" ADD CONSTRAINT "generation_conversations_owner_workout_fk" FOREIGN KEY ("user_id","workout_id") REFERENCES "public"."workouts"("user_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "gym_floors" ADD CONSTRAINT "gym_floors_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "training_preferences" ADD CONSTRAINT "training_preferences_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;
