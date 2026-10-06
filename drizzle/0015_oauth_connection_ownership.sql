alter table oauth_connections add column user_id uuid;
--> statement-breakpoint
do $$
declare
  owner_id uuid;
  owner_count integer;
begin
  if exists (select 1 from oauth_connections) then
    select count(*), (array_agg(user_id))[1]
      into owner_count, owner_id
      from auth_invitations
     where user_id = invited_by
       and accepted_at is not null
       and revoked_at is null;
    if owner_count <> 1 then
      raise exception 'OAuth ownership requires exactly one explicitly bootstrapped owner before migration';
    end if;
    update oauth_connections set user_id = owner_id;
  end if;
end $$;
--> statement-breakpoint
alter table oauth_connections alter column user_id set not null;
--> statement-breakpoint
alter table oauth_connections add constraint oauth_connections_user_id_auth_users_id_fk
  foreign key (user_id) references public.auth_users(id);
