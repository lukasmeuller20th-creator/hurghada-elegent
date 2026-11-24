-- Hurghada Elegant — security update. Run once in Supabase SQL Editor.

-- 1) Guests can only write safe data
create or replace function public.guest_put(p_col text, p_id text, p_data jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare cur jsonb; d jsonb := p_data; recent int;
begin
  if p_col not in ('bookings','waitlist','members','gifts','outbox') then raise exception 'not allowed'; end if;
  if p_id !~ '^[A-Za-z0-9_-]{3,40}$' then raise exception 'not allowed'; end if;
  if jsonb_typeof(d) <> 'object' or length(d::text) > 8000 then raise exception 'not allowed'; end if;
  select count(*) into recent from public.docs where col = p_col and updated_at > now() - interval '10 minutes';
  if recent > 300 then raise exception 'too many requests'; end if;

  select data into cur from public.docs where col = p_col and id = p_id;
  if cur is null then
    if p_col = 'bookings' then
      d := d || jsonb_build_object('id', p_id, 'status', 'booked', 'collected', false, 'commPaid', false, 'checkedIn', false, 'driver', '', 'car', '');
    elsif p_col = 'gifts' then
      d := d || jsonb_build_object('code', upper(p_id), 'unpaid', true);
    elsif p_col = 'waitlist' then
      d := d || jsonb_build_object('id', p_id, 'status', 'waiting');
    elsif p_col = 'outbox' then
      d := d || jsonb_build_object('id', p_id, 'status', 'queued');
    elsif p_col = 'members' then
      d := d || jsonb_build_object('id', p_id);
    end if;
    insert into public.docs(col, id, data) values (p_col, case when p_col='gifts' then upper(p_id) else p_id end, d);
    return;
  end if;

  if p_col = 'bookings' then
    update public.docs set data = cur
      || case when d->>'status' = 'cancelled' and cur->>'status' in ('booked','confirmed') then jsonb_build_object('status','cancelled') else '{}'::jsonb end
      || case when d ? 'review' and cur->>'status' = 'done' then jsonb_build_object('review', jsonb_build_object(
             'stars', least(5, greatest(1, coalesce((d->'review'->>'stars')::int, 5))),
             'text', left(coalesce(d->'review'->>'text',''), 1000))) else '{}'::jsonb end
      || case when (d->>'photoPack')::boolean is true and coalesce((cur->>'photoPack')::boolean,false) = false
             then jsonb_build_object('photoPack', true, 'total', coalesce((cur->>'total')::numeric,0) + 15) else '{}'::jsonb end,
      updated_at = now()
    where col = p_col and id = p_id;
  elsif p_col = 'gifts' then
    -- only spending (balance can go down, never up), and only on paid cards
    if coalesce((cur->>'unpaid')::boolean,false) then return; end if;
    if (d->>'balance')::numeric >= 0 and (d->>'balance')::numeric < (cur->>'balance')::numeric then
      update public.docs set data = cur || jsonb_build_object('balance', (d->>'balance')::numeric), updated_at = now()
      where col = p_col and id = p_id;
    end if;
  elsif p_col = 'members' then
    -- a member can update their own profile only (same WhatsApp number)
    if right(regexp_replace(coalesce(cur->>'phone',''),'\D','','g'),8) = right(regexp_replace(coalesce(d->>'phone',''),'\D','','g'),8) then
      update public.docs set data = d || jsonb_build_object('id', p_id), updated_at = now() where col = p_col and id = p_id;
    end if;
  end if;
  -- waitlist / outbox: insert only
end $$;

-- 2) Opening a ticket needs the booking number AND last 4 digits of the WhatsApp number
drop function if exists public.get_booking(text);
create or replace function public.get_booking(p_id text, p_key text) returns jsonb
language sql stable security definer set search_path = public as $$
  select data from public.docs
  where col = 'bookings' and id = upper(p_id)
    and length(coalesce(p_key,'')) = 4
    and right(regexp_replace(coalesce(data->>'phone',''),'\D','','g'), 4) = p_key;
$$;

-- 3) Gift cards only work after the owner marks them paid
create or replace function public.get_gift(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select data from public.docs where col = 'gifts' and id = upper(p_code) and coalesce((data->>'unpaid')::boolean,false) = false;
$$;

revoke all on function public.guest_put(text,text,jsonb), public.get_booking(text,text), public.get_gift(text) from public;
grant execute on function public.guest_put(text,text,jsonb), public.get_booking(text,text), public.get_gift(text) to anon, authenticated;

-- 4) Guests never write to the table directly
revoke insert, update, delete on public.docs from anon;
revoke all on public.admins from anon;
