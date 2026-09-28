-- ============================================================
-- my_passengers: + passenger_email, + display_status, legfrissebb elöl
-- ============================================================
CREATE OR REPLACE VIEW public.my_passengers AS
SELECT
  b.id AS booking_id,
  b.listing_id,
  b.seats_booked,
  b.status AS booking_status,
  b.created_at,
  l.from_city,
  l.to_city,
  l.ride_date,
  l.ride_time,
  pp.id AS passenger_id,
  pp.username AS passenger_username,
  pp.full_name AS passenger_full_name,
  pp.phone AS passenger_phone,
  (b.created_at > dp.utasaim_last_viewed_at) AS is_new,
  au.email AS passenger_email,
  CASE
    WHEN b.status = 'cancelled' THEN 'cancelled'
    WHEN l.ride_date < CURRENT_DATE THEN 'expired'
    ELSE 'active'
  END AS display_status
FROM bookings b
JOIN listings l ON l.id = b.listing_id
JOIN profiles pp ON pp.id = b.passenger_id
JOIN profiles dp ON dp.id = l.driver_id
JOIN auth.users au ON au.id = pp.id
WHERE l.driver_id = auth.uid()
ORDER BY b.created_at DESC;

-- ============================================================
-- my_bookings: + driver_phone, driver_email, seats_total, seats_available; closed -> expired
-- ============================================================
CREATE OR REPLACE VIEW public.my_bookings AS
SELECT
  b.id AS booking_id,
  b.seats_booked,
  b.status AS booking_status,
  CASE
    WHEN b.status = 'cancelled' THEN 'cancelled'
    WHEN r.ride_date < CURRENT_DATE THEN 'expired'
    ELSE 'active'
  END AS display_status,
  r.id AS listing_id,
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
  dp.phone AS driver_phone,
  au.email AS driver_email,
  r.seats_total,
  r.seats_available
FROM bookings b
JOIN ride_details r ON r.id = b.listing_id
JOIN profiles dp ON dp.id = r.driver_id
JOIN auth.users au ON au.id = r.driver_id
WHERE b.passenger_id = auth.uid();

-- ============================================================
-- my_listings: + display_status (active/cancelled/expired)
-- ============================================================
CREATE OR REPLACE VIEW public.my_listings AS
SELECT
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
  CASE
    WHEN r.status = 'cancelled' THEN 'cancelled'
    WHEN r.ride_date < CURRENT_DATE THEN 'expired'
    ELSE 'active'
  END AS display_status
FROM ride_details r
JOIN listings l ON l.id = r.id
WHERE r.driver_id = auth.uid();
