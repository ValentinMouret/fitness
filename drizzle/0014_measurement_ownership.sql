alter table measurements add column user_id uuid;
--> statement-breakpoint
alter table measures add column user_id uuid;
--> statement-breakpoint
alter table targets add column user_id uuid;
--> statement-breakpoint
alter table daily_note add column user_id uuid;
--> statement-breakpoint
do $$
declare
  owner_id uuid;
  owner_count integer;
begin
  if exists (select 1 from measurements)
     or exists (select 1 from measures)
     or exists (select 1 from targets)
     or exists (select 1 from daily_note) then
    select count(*), (array_agg(user_id))[1]
      into owner_count, owner_id
      from auth_invitations
     where user_id = invited_by
       and accepted_at is not null
       and revoked_at is null;
    if owner_count <> 1 then
      raise exception 'Measurement ownership requires exactly one explicitly bootstrapped owner before migration';
    end if;
    update measurements set user_id = owner_id;
    update measures set user_id = owner_id;
    update targets set user_id = owner_id;
    update daily_note set user_id = owner_id;
  end if;
end $$;
--> statement-breakpoint
alter table measures drop constraint measures_measurement_name_measurements_name_fk;
--> statement-breakpoint
alter table targets drop constraint targets_measurement_name_measurements_name_fk;
--> statement-breakpoint
drop index idx_targets_measurement_active;
--> statement-breakpoint
alter table measures drop constraint measures_measurement_name_t_pk;
--> statement-breakpoint
alter table measurements drop constraint measurements_pkey;
--> statement-breakpoint
alter table daily_note drop constraint daily_note_pkey;
--> statement-breakpoint
alter table measurements alter column user_id set not null;
--> statement-breakpoint
alter table measures alter column user_id set not null;
--> statement-breakpoint
alter table targets alter column user_id set not null;
--> statement-breakpoint
alter table daily_note alter column user_id set not null;
--> statement-breakpoint
alter table measurements add constraint measurements_user_id_name_pk primary key(user_id, name);
--> statement-breakpoint
alter table measures add constraint measures_user_id_measurement_name_t_pk primary key(user_id, measurement_name, t);
--> statement-breakpoint
alter table daily_note add constraint daily_note_user_id_id_pk primary key(user_id, id);
--> statement-breakpoint
alter table measurements add constraint measurements_user_id_auth_users_id_fk
  foreign key(user_id) references public.auth_users(id);
--> statement-breakpoint
alter table daily_note add constraint daily_note_user_id_auth_users_id_fk
  foreign key(user_id) references public.auth_users(id);
--> statement-breakpoint
alter table measures add constraint measures_user_id_measurement_name_measurements_user_id_name_fk
  foreign key(user_id, measurement_name) references public.measurements(user_id, name);
--> statement-breakpoint
alter table targets add constraint targets_user_id_measurement_name_measurements_user_id_name_fk
  foreign key(user_id, measurement_name) references public.measurements(user_id, name);
--> statement-breakpoint
create unique index idx_targets_measurement_active on targets(user_id, measurement_name)
  where deleted_at is null;
--> statement-breakpoint
create or replace view fitness_data.body_weight_history with (security_barrier = true) as
select measurement_name
     , t at time zone 'UTC' as recorded_at
     , value as weight_kg
     , 'kg'::text as unit
  from public.measures
 where measurement_name = 'weight'
   and user_id::text = nullif(current_setting('fitness.user_id', true), '');
--> statement-breakpoint
create or replace view fitness_data.active_calorie_target with (security_barrier = true) as
select id
     , measurement_name
     , value as calories_kcal_per_day
     , 'kcal'::text as unit
     , 'persisted_target'::text as source
  from public.targets
 where measurement_name = 'daily_calorie_intake'
   and deleted_at is null
   and user_id::text = nullif(current_setting('fitness.user_id', true), '');
