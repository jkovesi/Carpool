-- Supabase Security Advisor talalatok javitasa (2026-09-28):
--  1) auth_users_exposed (my_bookings, my_passengers): a ket view eddig
--     kozvetlenul JOIN-olta az auth.users tablat, hogy a masik fel
--     (sofor/utas) e-mail cimet meg tudja jeleniteni kapcsolatfelvetelhez.
--     Az auth.users kozvetlen, PostgREST-en keresztul is elerheto view-bol
--     torteno elereset a linter mindig hibanak jelzi, mert az a tabla
--     tobb erzekeny mezot is tartalmaz a puszta e-mailen tul. Megoldas:
--     az e-mail cimet mostantol a public.profiles tablaban tartjuk
--     karban (auth.users-bol szinkronizalva trigger-rel), a view-k pedig
--     mar csak a profiles tablat kerdezik le, auth.users-t egyaltalan nem
--     erintik tobbe.
--  2) security_definer_view (my_listings, my_vehicles): mindket view sajat
--     WHERE-feltetellel mar amugy is a sajat sorra (auth.uid()) szukiti a
--     talalatot, pontosan ugyanugy, ahogy az alattuk levo tablak (listings,
--     vehicles) RLS-szabalya is tenne -- igy a security_invoker = true
--     bekapcsolasa tisztan szigoritas, viselkedesbeli valtozas nelkul.
--
-- SZANDEKOSAN NEM VALTOZIK: a ride_details, valamint (egyelore) a
-- my_bookings/my_passengers SECURITY DEFINER jellege.

-- ============================================================
-- 1) profiles.email oszlop (auth.users.email-lel azonos tipus) + szinkron
-- ============================================================
alter table public.profiles add column if not exists email character varying(255);

update public.profiles p
set email = au.email
from auth.users au
where au.id = p.id
  and p.email is distinct from au.email;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, username, full_name, phone, email)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    new.email
  );
  return new;
end;
$function$;

create or replace function public.handle_user_email_updated()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$function$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  execute function public.handle_user_email_updated();

-- ============================================================
-- 2) my_bookings / my_passengers ujradefinialasa auth.users nelkul
-- ============================================================
create or replace view public.my_bookings as
select
  b.id as booking_id,
  b.seats_booked,
  b.status as booking_status,
  case
    when b.status = 'listing_cancelled' then 'removed'
    when b.status = 'cancelled' then 'cancelled'
    when ((r.ride_date + r.ride_time) at time zone 'Europe/Budapest') < now() then 'expired'
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
  dp.email as driver_email,
  r.seats_total,
  r.seats_available
from bookings b
  join ride_details r on r.id = b.listing_id
  join profiles dp on dp.id = r.driver_id
where b.passenger_id = auth.uid();

comment on view public.my_bookings is 'A bejelentkezett felhasznalo sajat foglalasai (KAN-7/8). display_status: active / cancelled / closed. SECURITY DEFINER: a sofor profiljat (telefon/email) a lekerdezo utastol elteru sorkent kell elernie, ezert szuksegszeru a definer-futas -- lasd supabase/README.md.';

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
  b.created_at > dp.utasaim_last_viewed_at as is_new,
  pp.email as passenger_email,
  case
    when b.status = 'listing_cancelled' then 'removed'
    when b.status = 'cancelled' then 'cancelled'
    when ((l.ride_date + l.ride_time) at time zone 'Europe/Budapest') < now() then 'expired'
    else 'active'
  end as display_status
from bookings b
  join listings l on l.id = b.listing_id
  join profiles pp on pp.id = b.passenger_id
  join profiles dp on dp.id = l.driver_id
where l.driver_id = auth.uid()
order by b.created_at desc;

comment on view public.my_passengers is 'A bejelentkezett sofor sajat hirdeteseire foglalt utasok (KAN-13). SECURITY DEFINER: az utas profiljat (telefon/email) a lekerdezo sofortol elteru sorkent kell elernie, ezert szuksegszeru a definer-futas -- lasd supabase/README.md.';

-- ============================================================
-- 3) my_listings / my_vehicles: security_invoker bekapcsolasa
-- ============================================================
alter view public.my_listings set (security_invoker = true);
alter view public.my_vehicles set (security_invoker = true);
