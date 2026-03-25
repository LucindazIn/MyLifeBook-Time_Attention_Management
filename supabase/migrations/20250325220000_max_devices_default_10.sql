-- Align with product default: 10 active devices per account (subscriptions.max_devices).
-- Bumps existing rows that are still 1 or 8 from older migrations.

alter table public.subscriptions
  alter column max_devices set default 10;

update public.subscriptions
set max_devices = 10
where max_devices < 10;

create or replace function public.register_device(device_id text, device_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  max_devices int;
  active_count int;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.subscriptions(user_id) values (uid)
  on conflict (user_id) do nothing;

  select s.max_devices into max_devices from public.subscriptions s where s.user_id = uid;
  if max_devices is null or max_devices < 1 then
    max_devices := 10;
  end if;

  if exists (
    select 1 from public.devices d
    where d.user_id = uid and d.device_id = register_device.device_id and d.revoked_at is null
  ) then
    update public.devices d
      set last_seen_at = now(), device_name = register_device.device_name
      where d.user_id = uid and d.device_id = register_device.device_id;
    return;
  end if;

  select count(*) into active_count
  from public.devices d
  where d.user_id = uid and d.revoked_at is null;

  if exists (
    select 1 from public.devices d
    where d.user_id = uid and d.device_id = register_device.device_id and d.revoked_at is not null
  ) then
    if active_count >= max_devices then
      update public.devices d
        set revoked_at = now()
        where d.id = (
          select d2.id from public.devices d2
          where d2.user_id = uid
            and d2.revoked_at is null
            and d2.device_id <> register_device.device_id
          order by d2.last_seen_at asc nulls first
          limit 1
        );
    end if;
    update public.devices d
      set last_seen_at = now(), revoked_at = null, device_name = register_device.device_name
      where d.user_id = uid and d.device_id = register_device.device_id;
    return;
  end if;

  if active_count >= max_devices then
    update public.devices d
      set revoked_at = now()
      where d.id = (
        select d2.id from public.devices d2
        where d2.user_id = uid and d2.revoked_at is null
        order by d2.last_seen_at asc nulls first
        limit 1
      );
  end if;

  insert into public.devices(user_id, device_id, device_name)
  values (uid, register_device.device_id, register_device.device_name)
  on conflict (user_id, device_id) do update
    set last_seen_at = now(), revoked_at = null, device_name = register_device.device_name;
end;
$$;

revoke all on function public.register_device(text, text) from public;
grant execute on function public.register_device(text, text) to authenticated;
