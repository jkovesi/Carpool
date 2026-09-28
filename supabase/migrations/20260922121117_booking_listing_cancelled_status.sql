-- ============================================================================
-- Items 8-10 (2. kör): meg kell tudni különböztetni az utas saját maga általi
-- lemondását ("Lemondva", status='cancelled') a sofőr által törölt hirdetés
-- miatti lemondástól ("Törölt", új status='listing_cancelled'). Korábban mindkét
-- eset ugyanazt a 'cancelled' értéket kapta, és a foglalás eltűnt a listákból
-- vagy nem volt megkülönböztethető.
-- ============================================================================

-- 1) Engedjük az új status értéket.
alter table public.bookings drop constraint bookings_status_check;
alter table public.bookings
  add constraint bookings_status_check
  check (status = any (array['active','cancelled','listing_cancelled']));

-- 2) cancel_listing(): az érintett aktív foglalásokat mostantól
--    'listing_cancelled'-re állítjuk (nem 'cancelled'-re) — így a
--    trg_notify_booking_cancelled trigger (ami NEW.status='cancelled'-re
--    figyel) természetesen nem sül el rájuk, a suppress-flag trükk feleslegessé
--    válik, a notify_listing_cancelled trigger pedig továbbra is helyesen
--    kiküldi a "sofőr törölte az utat" e-mailt.
create or replace function public.cancel_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_driver_id uuid;
begin
  select driver_id into v_driver_id from public.listings where id = p_listing_id for update;

  if not found then
    raise exception 'A hirdetés nem található.';
  end if;

  if v_driver_id != auth.uid() then
    raise exception 'Nincs jogosultságod ehhez a hirdetéshez.';
  end if;

  update public.listings set status = 'cancelled', updated_at = now() where id = p_listing_id;

  update public.bookings set status = 'listing_cancelled' where listing_id = p_listing_id and status = 'active';
end;
$function$;

-- 3) Nézetek: display_status 4. értéke ("removed" -> "Törölt" a frontenden)
--    a bookings.status = 'listing_cancelled' esetre.
create or replace view public.my_bookings as
select
  b.id as booking_id,
  b.seats_booked,
  b.status as booking_status,
  case
    when b.status = 'listing_cancelled' then 'removed'
    when b.status = 'cancelled' then 'cancelled'
    when r.ride_date < current_date then 'expired'
    else 'active'
  end as display_status,
  r.id as listing_id,
  r.from_city,
  r.to_city,
  r.ride_date,
  r.ride_time,
  r.price_huf,
  r.car_type,
  r.car_color,
  r.car_plate,
  r.driver_id,
  r.driver_username,
  r.driver_full_name,
  b.created_at,
  dp.phone as driver_phone,
  au.email as driver_email,
  r.seats_total,
  r.seats_available
from bookings b
  join ride_details r on r.id = b.listing_id
  join profiles dp on dp.id = r.driver_id
  join auth.users au on au.id = r.driver_id
where b.passenger_id = auth.uid();

create or replace view public.my_passengers as
select
  b.id as booking_id,
  b.listing_id,
  b.seats_booked,
  b.status as booking_status,
  b.created_at,
  l.from_city,
  l.to_city,
  l.ride_date,
  l.ride_time,
  pp.id as passenger_id,
  pp.username as passenger_username,
  pp.full_name as passenger_full_name,
  pp.phone as passenger_phone,
  (b.created_at > dp.utasaim_last_viewed_at) as is_new,
  au.email as passenger_email,
  case
    when b.status = 'listing_cancelled' then 'removed'
    when b.status = 'cancelled' then 'cancelled'
    when l.ride_date < current_date then 'expired'
    else 'active'
  end as display_status
from bookings b
  join listings l on l.id = b.listing_id
  join profiles pp on pp.id = b.passenger_id
  join profiles dp on dp.id = l.driver_id
  join auth.users au on au.id = pp.id
where l.driver_id = auth.uid()
order by b.created_at desc;

grant select on public.my_bookings to authenticated;
grant select on public.my_passengers to authenticated;
