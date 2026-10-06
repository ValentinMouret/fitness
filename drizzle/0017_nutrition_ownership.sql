ALTER TABLE "ingredients" ADD COLUMN "user_id" uuid;
--> statement-breakpoint
ALTER TABLE "meal_log_ingredients" ADD COLUMN "user_id" uuid;
--> statement-breakpoint
ALTER TABLE "meal_logs" ADD COLUMN "user_id" uuid;
--> statement-breakpoint
ALTER TABLE "meal_template_ingredients" ADD COLUMN "user_id" uuid;
--> statement-breakpoint
ALTER TABLE "meal_templates" ADD COLUMN "user_id" uuid;
--> statement-breakpoint
do $$
declare
  owner_id uuid;
  owner_count integer;
begin
  if exists (select 1 from ingredients) or exists (select 1 from meal_templates)
     or exists (select 1 from meal_logs) or exists (select 1 from meal_template_ingredients)
     or exists (select 1 from meal_log_ingredients) then
    select count(*), (array_agg(user_id))[1] into owner_count, owner_id
      from auth_invitations
     where user_id = invited_by and accepted_at is not null and revoked_at is null;
    if owner_count <> 1 then
      raise exception 'Nutrition ownership requires exactly one explicitly bootstrapped owner before migration';
    end if;
    update ingredients set user_id = owner_id;
    update meal_templates set user_id = owner_id;
    update meal_logs set user_id = owner_id;
    update meal_template_ingredients set user_id = owner_id;
    update meal_log_ingredients set user_id = owner_id;
  end if;
end $$;
--> statement-breakpoint
DROP INDEX "ingredients_name_unique_idx";
--> statement-breakpoint
DROP INDEX "ingredients_name_simple_unique_idx";
--> statement-breakpoint
DROP INDEX "meal_logs_category_date_unique_idx";
--> statement-breakpoint
alter table ingredients alter column user_id set not null;
--> statement-breakpoint
alter table meal_templates alter column user_id set not null;
--> statement-breakpoint
alter table meal_logs alter column user_id set not null;
--> statement-breakpoint
alter table meal_template_ingredients alter column user_id set not null;
--> statement-breakpoint
alter table meal_log_ingredients alter column user_id set not null;
--> statement-breakpoint
CREATE UNIQUE INDEX "ingredients_user_id_id_unique_idx" ON "ingredients" USING btree ("user_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "meal_logs_user_id_id_unique_idx" ON "meal_logs" USING btree ("user_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "meal_templates_user_id_id_unique_idx" ON "meal_templates" USING btree ("user_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "ingredients_name_unique_idx" ON "ingredients" USING btree ("user_id","name") WHERE "ingredients"."deleted_at" is null;
--> statement-breakpoint
CREATE UNIQUE INDEX "ingredients_name_simple_unique_idx" ON "ingredients" USING btree ("user_id","name");
--> statement-breakpoint
CREATE UNIQUE INDEX "meal_logs_category_date_unique_idx" ON "meal_logs" USING btree ("user_id","meal_category","logged_date") WHERE "meal_logs"."deleted_at" is null;
--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "meal_log_ingredients" ADD CONSTRAINT "meal_log_ingredients_owner_parent_fk" FOREIGN KEY ("user_id","meal_log_id") REFERENCES "public"."meal_logs"("user_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "meal_log_ingredients" ADD CONSTRAINT "meal_log_ingredients_owner_ingredient_fk" FOREIGN KEY ("user_id","ingredient_id") REFERENCES "public"."ingredients"("user_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_owner_template_fk" FOREIGN KEY ("user_id","meal_template_id") REFERENCES "public"."meal_templates"("user_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "meal_template_ingredients" ADD CONSTRAINT "meal_template_ingredients_owner_parent_fk" FOREIGN KEY ("user_id","meal_template_id") REFERENCES "public"."meal_templates"("user_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "meal_template_ingredients" ADD CONSTRAINT "meal_template_ingredients_owner_ingredient_fk" FOREIGN KEY ("user_id","ingredient_id") REFERENCES "public"."ingredients"("user_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "meal_templates" ADD CONSTRAINT "meal_templates_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
create or replace view fitness_data.ingredients with (security_barrier = true) as
select id
     , name
     , category::text as category
     , calories
     , protein
     , carbs
     , fat
     , fiber
     , water_percentage
     , energy_density
     , texture::text as texture
     , is_vegetarian
     , is_vegan
     , slider_min
     , slider_max
  from public.ingredients
 where deleted_at is null
   and user_id::text = nullif(current_setting('fitness.user_id', true), '');

--> statement-breakpoint
create or replace view fitness_data.meal_templates with (security_barrier = true) as
select id
     , name
     , categories[1]::text as category
     , notes
     , total_calories
     , total_protein
     , total_carbs
     , total_fat
     , total_fiber
     , satiety_score
     , usage_count
     , categories::text[] as categories
  from public.meal_templates
 where deleted_at is null
   and user_id::text = nullif(current_setting('fitness.user_id', true), '');

--> statement-breakpoint
create or replace view fitness_data.meal_logs with (security_barrier = true) as
select m.id
     , m.meal_category::text as meal_category
     , m.logged_date
     , m.is_completed
     , m.notes
     , t.id as meal_template_id
  from public.meal_logs m
  left join fitness_data.meal_templates t on t.id = m.meal_template_id
 where m.deleted_at is null
   and m.user_id::text = nullif(current_setting('fitness.user_id', true), '');
