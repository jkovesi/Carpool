-- ============================================================
-- ride_details — a fő olvasási nézet a keresőhöz / útrészletekhez
-- Bizalmas mezők (rendszám, sofőr teljes neve) csak akkor látszanak,
-- ha a lekérdező a sofőr, vagy aktív foglalása van erre az útra (KAN-1 4.6/4.7).
-- A nézet a migrációt futtató (RLS-t megkerülő) szerepkör tulajdonában jön létre,
-- így tud profiles/bookings sorokat összefésülni más felhasználók között is —
-- de minden érzékeny oszlopot explicit auth.uid() feltétellel maszkol.
-- ============================================================

create view public.ride_details
with (security_invoker = false)
as
select
  l.id,
  l.driver_id,
  dp.username as driver_username,
  case
    when auth.uid() = l.driver_id
      or exists (
        select 1 from public.bookings b
        where b.listing_id = l.id and b.passenger_id = auth.uid() and b.status = 'active'
      )
    then dp.full_name
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
    when auth.uid() = l.driver_id
      or exists (
        select 1 from public.bookings b
        where b.listing_id = l.id and b.passenger_id = auth.uid() and b.status = 'active'
      )
    then l.car_plate
    else null
  end as car_plate,
  l.status,
  coalesce((
    select sum(b2.seats_booked) from public.bookings b2
    where b2.listing_id = l.id and b2.status = 'active'
  ), 0) as seats_booked,
  l.seats_total - coalesce((
    select sum(b2.seats_booked) from public.bookings b2
    where b2.listing_id = l.id and b2.status = 'active'
  ), 0) as seats_available,
  l.created_at
from public.listings l
join public.profiles dp on dp.id = l.driver_id;

comment on view public.ride_details is 'Publikus útrészlet-nézet. driver_full_name és car_plate csak a sofőrnek vagy az adott útra aktív foglalással rendelkező utasnak látszik.';

grant select on public.ride_details to anon, authenticated;

-- ============================================================
-- my_bookings — a bejelentkezett utas saját foglalásai, számított állapottal
-- ============================================================

create view public.my_bookings
with (security_invoker = false)
as
select
  b.id as booking_id,
  b.seats_booked,
  b.status as booking_status,
  case
    when b.status = 'cancelled' then 'cancelled'
    when r.ride_date < current_date then 'closed'
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
  b.created_at
from public.bookings b
join public.ride_details r on r.id = b.listing_id
where b.passenger_id = auth.uid();

comment on view public.my_bookings is 'A bejelentkezett felhasználó saját foglalásai (KAN-7/8). display_status: active / cancelled / closed (lezárt = lejárt dátumú, nem lemondott foglalás).';

grant select on public.my_bookings to authenticated;

-- ============================================================
-- my_listings — a bejelentkezett sofőr saját hirdetései, foglaltsággal
-- ============================================================

create view public.my_listings
with (security_invoker = false)
as
select r.*
from public.ride_details r
where r.driver_id = auth.uid();

comment on view public.my_listings is 'A bejelentkezett sofőr saját hirdetései (KAN-4), foglalt/szabad hely számítással a kitöltöttség-sávhoz.';

grant select on public.my_listings to authenticated;
