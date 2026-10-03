create extension if not exists pg_cron;
create or replace function public.purge_expired_demo_rows()
returns void language sql security definer set search_path = public as $$
  delete from public.trips where expires_at < now();
$$;
revoke all on function public.purge_expired_demo_rows() from public, anon, authenticated;
select cron.schedule('purge-expired-demo-rows', '17 3 * * *', 'select public.purge_expired_demo_rows()');