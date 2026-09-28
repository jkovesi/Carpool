-- 1. Add snapshot column: how many seats were actively booked on a listing
-- at the moment it was cancelled by the driver. Needed because cancel_listing()
-- flips the affected bookings to 'listing_cancelled', after which the normal
-- active-bookings aggregate (ride_details.seats_booked) would show 0.
alter table public.listings add column if not exists cancelled_seats_snapshot integer;

-- 2. Recreate cancel_listing() to populate the snapshot BEFORE flipping the
-- bookings' status, so the sum still reflects the active bookings at that
-- moment.
create or replace function public.cancel_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_driver_id uuid;
  v_snapshot integer;
begin
  select driver_id into v_driver_id from public.listings where id = p_listing_id for update;
  if not found then
    raise exception 'A hirdetés nem található.';
  end if;
  if v_driver_id != auth.uid() then
    raise exception 'Nincs jogosultságod ehhez a hirdetéshez.';
  end if;

  select coalesce(sum(seats_booked), 0) into v_snapshot
  from public.bookings
  where listing_id = p_listing_id and status = 'active';

  update public.listings
  set status = 'cancelled', cancelled_seats_snapshot = v_snapshot, updated_at = now()
  where id = p_listing_id;

  update public.bookings set status = 'listing_cancelled' where listing_id = p_listing_id and status = 'active';
end;
$function$;

-- 3. Expose the new column through ride_details (appended at the end, since
-- CREATE OR REPLACE VIEW cannot reorder or rename existing columns).
create or replace view public.ride_details as
 SELECT l.id,
    l.driver_id,
    dp.username AS driver_username,
        CASE
            WHEN auth.uid() = l.driver_id OR (EXISTS ( SELECT 1
               FROM bookings b
              WHERE b.listing_id = l.id AND b.passenger_id = auth.uid() AND b.status = 'active'::text)) THEN dp.full_name
            ELSE NULL::text
        END AS driver_full_name,
    l.from_city,
    l.to_city,
    l.ride_date,
    l.ride_time,
    l.price_huf,
    l.seats_total,
    l.car_type,
    l.car_color,
        CASE
            WHEN auth.uid() = l.driver_id OR (EXISTS ( SELECT 1
               FROM bookings b
              WHERE b.listing_id = l.id AND b.passenger_id = auth.uid() AND b.status = 'active'::text)) THEN l.car_plate
            ELSE NULL::text
        END AS car_plate,
    l.status,
    COALESCE(( SELECT sum(b2.seats_booked) AS sum
           FROM bookings b2
          WHERE b2.listing_id = l.id AND b2.status = 'active'::text), 0::bigint) AS seats_booked,
    l.seats_total - COALESCE(( SELECT sum(b2.seats_booked) AS sum
           FROM bookings b2
          WHERE b2.listing_id = l.id AND b2.status = 'active'::text), 0::bigint) AS seats_available,
    l.created_at,
    ((l.ride_date + l.ride_time) AT TIME ZONE 'Europe/Budapest'::text) AS departs_at,
    l.cancelled_seats_snapshot
   FROM listings l
     JOIN profiles dp ON dp.id = l.driver_id;

-- 4. Expose the new column through my_listings — appended at the very end,
-- after display_status, so the existing column order/positions are kept.
create or replace view public.my_listings as
 SELECT r.id,
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
        CASE
            WHEN r.status = 'cancelled'::text THEN 'cancelled'::text
            WHEN ((r.ride_date + r.ride_time) AT TIME ZONE 'Europe/Budapest'::text) < now() THEN 'expired'::text
            ELSE 'active'::text
        END AS display_status,
    r.cancelled_seats_snapshot
   FROM ride_details r
     JOIN listings l ON l.id = r.id
  WHERE r.driver_id = auth.uid();
