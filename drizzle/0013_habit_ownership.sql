alter table habits add column user_id uuid;
--> statement-breakpoint
do $$
declare
  owner_id uuid;
  owner_count integer;
begin
  if exists (select 1 from habits) then
    select count(*), (array_agg(user_id))[1]
      into owner_count, owner_id
      from auth_invitations
     where user_id = invited_by
       and accepted_at is not null
       and revoked_at is null;
    if owner_count <> 1 then
      raise exception 'Habit ownership requires exactly one explicitly bootstrapped owner before migration';
    end if;
    update habits set user_id = owner_id;
  end if;
end $$;
--> statement-breakpoint
alter table habits alter column user_id set not null;
--> statement-breakpoint
alter table habits add constraint habits_user_id_auth_users_id_fk
  foreign key (user_id) references public.auth_users(id);
--> statement-breakpoint
create index habits_user_id_idx on habits(user_id);
--> statement-breakpoint
create or replace view fitness_data.habits with (security_barrier = true) as
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
   and deleted_at is null
   and user_id::text = nullif(current_setting('fitness.user_id', true), '');
