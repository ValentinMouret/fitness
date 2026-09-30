alter table public.meal_templates add column categories public.meal_category[];
--> statement-breakpoint
update public.meal_templates set categories = array[category];
--> statement-breakpoint
alter table public.meal_templates alter column categories set not null;
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
 where deleted_at is null;
--> statement-breakpoint
alter table public.meal_templates drop column category;
--> statement-breakpoint
ALTER TABLE "meal_templates" ADD CONSTRAINT "meal_assignments_valid" CHECK (cardinality("meal_templates"."categories") between 1 and 4 and array_position("meal_templates"."categories", null) is null and cardinality("meal_templates"."categories") = (('breakfast' = any("meal_templates"."categories"))::int + ('lunch' = any("meal_templates"."categories"))::int + ('dinner' = any("meal_templates"."categories"))::int + ('snack' = any("meal_templates"."categories"))::int));