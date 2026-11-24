-- Hurghada Elegant — run once in Supabase: SQL Editor → New query → paste → Run
-- 1) CHANGE THIS EMAIL to the owner's email (the one you will log in with)
create table if not exists public.admins (email text primary key);
insert into public.admins(email) values ('OWNER@EMAIL.COM') on conflict do nothing;

create table if not exists public.docs (
  col text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (col, id)
);

alter table public.docs enable row level security;
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where lower(email) = lower(coalesce(auth.jwt()->>'email','')));
$$;

drop policy if exists "admin all" on public.docs;
create policy "admin all" on public.docs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read catalog" on public.docs;
create policy "public read catalog" on public.docs for select to anon, authenticated
  using (col in ('tripcfg','settings','campaigns','gallery'));

drop policy if exists "admins read self" on public.admins;
create policy "admins read self" on public.admins for select to authenticated using (public.is_admin());

-- Guests write through this function only (new bookings, waitlist, sign-ups, gift cards, messages).
-- Existing bookings: guests may only cancel, review, or buy the photo pack.
create or replace function public.guest_put(p_col text, p_id text, p_data jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare cur jsonb;
begin
  if p_col not in ('bookings','waitlist','members','gifts','outbox') then raise exception 'not allowed'; end if;
  select data into cur from public.docs where col = p_col and id = p_id;
  if cur is null then
    insert into public.docs(col, id, data) values (p_col, p_id, p_data);
  elsif p_col = 'bookings' then
    update public.docs set data = cur
      || case when p_data->>'status' = 'cancelled' then jsonb_build_object('status','cancelled') else '{}'::jsonb end
      || case when p_data ? 'review' then jsonb_build_object('review', p_data->'review') else '{}'::jsonb end
      || case when (p_data->>'photoPack')::boolean is true then jsonb_build_object('photoPack', true, 'total', p_data->'total') else '{}'::jsonb end,
      updated_at = now()
    where col = p_col and id = p_id;
  elsif p_col in ('members','gifts') then
    update public.docs set data = p_data, updated_at = now() where col = p_col and id = p_id;
  end if;
end $$;

-- Guests can open their own ticket on any phone with the booking number
create or replace function public.get_booking(p_id text) returns jsonb
language sql stable security definer set search_path = public as $$
  select data from public.docs where col = 'bookings' and id = upper(p_id);
$$;
-- Gift card check at checkout
create or replace function public.get_gift(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select data from public.docs where col = 'gifts' and id = upper(p_code);
$$;

grant execute on function public.guest_put(text,text,jsonb), public.get_booking(text), public.get_gift(text) to anon, authenticated;

-- Live updates for the owner dashboard
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when others then null; end $$;

-- Trip photos bucket (public read, owner upload)
insert into storage.buckets (id, name, public) values ('photos','photos', true) on conflict (id) do nothing;
drop policy if exists "owner upload photos" on storage.objects;
create policy "owner upload photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.is_admin());
drop policy if exists "owner delete photos" on storage.objects;
create policy "owner delete photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.is_admin());
