create view fitness_data.habits with (security_barrier = true) as
select id
     , name
     , description
     , identity_phrase
     , time_of_day
     , location
     , is_keystone
     , minimal_version
     , frequency_type
     , frequency_config
     , target_count
     , start_date
     , end_date
  from public.habits
 where is_active
   and deleted_at is null;
--> statement-breakpoint
create view fitness_data.habit_completions with (security_barrier = true) as
select c.habit_id
     , c.completion_date
     , c.completed
     , c.notes
  from public.habit_completions c
  join fitness_data.habits h on h.id = c.habit_id
 where c.deleted_at is null;
