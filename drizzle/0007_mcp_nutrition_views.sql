create view fitness_data.ingredients with (security_barrier = true) as
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
 where deleted_at is null;
--> statement-breakpoint
create view fitness_data.meal_templates with (security_barrier = true) as
select id
     , name
     , category::text as category
     , notes
     , total_calories
     , total_protein
     , total_carbs
     , total_fat
     , total_fiber
     , satiety_score
     , usage_count
  from public.meal_templates
 where deleted_at is null;
--> statement-breakpoint
create view fitness_data.meal_template_ingredients with (security_barrier = true) as
select mi.meal_template_id
     , mi.ingredient_id
     , mi.quantity_grams
  from public.meal_template_ingredients mi
  join fitness_data.meal_templates m on m.id = mi.meal_template_id
  join fitness_data.ingredients i on i.id = mi.ingredient_id
 where mi.deleted_at is null;
--> statement-breakpoint
create view fitness_data.meal_logs with (security_barrier = true) as
select m.id
     , m.meal_category::text as meal_category
     , m.logged_date
     , m.is_completed
     , m.notes
     , t.id as meal_template_id
  from public.meal_logs m
  left join fitness_data.meal_templates t on t.id = m.meal_template_id
 where m.deleted_at is null;
--> statement-breakpoint
create view fitness_data.meal_log_ingredients with (security_barrier = true) as
select mi.meal_log_id
     , mi.ingredient_id
     , mi.quantity_grams
  from public.meal_log_ingredients mi
  join fitness_data.meal_logs m on m.id = mi.meal_log_id
  join fitness_data.ingredients i on i.id = mi.ingredient_id
 where mi.deleted_at is null;
