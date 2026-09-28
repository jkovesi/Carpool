-- Postgres CREATE OR REPLACE VIEW csak a végén enged új oszlopot hozzáadni,
-- a meglévő oszlopsorrend nem változtatható. A departs_at ezért az utolsó oszlop.

create or replace view public.ride_details as
select
  l.id,
  l.driver_id,
  dp.username as driver_username,
  case
    when auth.uid() = l.driver_id or (exists (
      select 1 from bookings b
      where b.listing_id = l.id and b.passenger_id = auth.uid() and b.status = 'active'
    )) then dp.full_name
    else null
  end as driver_full_name,
  l.from_city,
  l.to_city,
  l.ride_date,
  l.ride_time,
  l.price_huf,
  l.seats_total,
  l.car_type,
  l.car_color,
  case
    when auth.uid() = l.driver_id or (exists (
      select 1 from bookings b
      where b.listing_id = l.id and b.passenger_id = auth.uid() and b.status = 'active'
    )) then l.car_plate
    else null
  end as car_plate,
  l.status,
  coalesce((select sum(b2.seats_booked) from bookings b2 where b2.listing_id = l.id and b2.status = 'active'), 0) as seats_booked,
  l.seats_total - coalesce((select sum(b2.seats_booked) from bookings b2 where b2.listing_id = l.id and b2.status = 'active'), 0) as seats_available,
  l.created_at,
  (l.ride_date + l.ride_time) at time zone 'Europe/Budapest' as departs_at
from listings l
join profiles dp on dp.id = l.driver_id;
