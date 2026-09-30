create view fitness_data.body_weight_history with (security_barrier = true) as
select measurement_name
     , t at time zone 'UTC' as recorded_at
     , value as weight_kg
     , 'kg'::text as unit
  from public.measures
 where measurement_name = 'weight';
--> statement-breakpoint
create view fitness_data.active_calorie_target with (security_barrier = true) as
select id
     , measurement_name
     , value as calories_kcal_per_day
     , 'kcal'::text as unit
     , 'persisted_target'::text as source
  from public.targets
 where measurement_name = 'daily_calorie_intake'
   and deleted_at is null;
