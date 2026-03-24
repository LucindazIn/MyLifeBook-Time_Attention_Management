-- Fix: column reference "device_id" is ambiguous in register_device
-- Keep parameter names, use table alias "d" in UPDATE to qualify column references

create or replace function public.register_device(device_id text, device_name text)
returns void
language plpgsql
security definer
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
  if max_devices is null then
    max_devices := 1;
  end if;

  select count(*) into active_count
  from public.devices d
  where d.user_id = uid and d.revoked_at is null;

  if exists (select 1 from public.devices d where d.user_id = uid and d.device_id = register_device.device_id and d.revoked_at is null) then
    update public.devices d
      set last_seen_at = now(), device_name = register_device.device_name
      where d.user_id = uid and d.device_id = register_device.device_id;
    return;
  end if;

  if active_count >= max_devices then
    raise exception 'device_limit_reached';
  end if;

  insert into public.devices(user_id, device_id, device_name)
  values (uid, register_device.device_id, register_device.device_name)
  on conflict (user_id, device_id) do update
    set last_seen_at = now(), revoked_at = null, device_name = register_device.device_name;
end;
$$;
