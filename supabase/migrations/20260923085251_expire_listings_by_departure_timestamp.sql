-- A "Lejárt" állapot korábban csak a dátumot vizsgálta (ride_date < CURRENT_DATE),
-- így egy ma induló, de már elmúlt időpontú hirdetés/foglalás egészen éjfélig
-- "Aktív"-ként jelent meg. Mostantól a teljes indulási időpontot (dátum + idő)
-- hasonlítjuk a jelenlegi időhöz, Europe/Budapest időzónában értelmezve (ez
-- automatikusan kezeli a CET/CEST nyári időszámítás-váltást is).

create or replace view public.my_listings as
select
  r.id,
  r.driver_id,
  r.driver_username,
  r.driver_full_name,
  r.from_city,
  r.to_city,
  r.ride_date,
  r.ride_time,
  r.price_huf,
  r.seats_total,
  r.car_type,
  r.car_color,
  r.car_plate,
  r.status,
  r.seats_booked,
  r.seats_available,
  r.created_at,
  l.vehicle_id,
  case
    when r.status = 'cancelled' then 'cancelled'
    when (r.ride_date + r.ride_time) at time zone 'Europe/Budapest' < now() then 'expired'
    else 'active'
  end as display_status
from ride_details r
join listings l on l.id = r.id
where r.driver_id = auth.uid();

create or replace view public.my_bookings as
select
  b.id as booking_id,
  b.seats_booked,
  b.status as booking_status,
  case
    when b.status = 'listing_cancelled' then 'removed'
    when b.status = 'cancelled' then 'cancelled'
    when (r.ride_date + r.ride_time) at time zone 'Europe/Budapest' < now() then 'expired'
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
    when (l.ride_date + l.ride_time) at time zone 'Europe/Budapest' < now() then 'expired'
    else 'active'
  end as display_status
from bookings b
join listings l on l.id = b.listing_id
join profiles pp on pp.id = b.passenger_id
join profiles dp on dp.id = l.driver_id
join auth.users au on au.id = pp.id
where l.driver_id = auth.uid()
order by b.created_at desc;
