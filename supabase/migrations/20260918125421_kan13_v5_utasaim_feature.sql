-- KAN-13 v5: "Utasaim" funkció — összesített utaslista minden hirdetésemhez tartozó
-- foglalással (aktív + lemondott/lezárt), "friss" jelölés az utolsó listamegtekintés óta
-- érkezett foglalásokhoz (4.16).

ALTER TABLE public.profiles
  ADD COLUMN utasaim_last_viewed_at timestamptz NOT NULL DEFAULT now();

CREATE VIEW public.my_passengers AS
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
  (b.created_at > dp.utasaim_last_viewed_at) AS is_new
FROM public.bookings b
JOIN public.listings l ON l.id = b.listing_id
JOIN public.profiles pp ON pp.id = b.passenger_id
JOIN public.profiles dp ON dp.id = l.driver_id
WHERE l.driver_id = auth.uid()
ORDER BY l.ride_date ASC, l.ride_time ASC, b.created_at ASC;

GRANT SELECT ON public.my_passengers TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_passengers_viewed()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.profiles set utasaim_last_viewed_at = now() where id = auth.uid();
$function$;

GRANT EXECUTE ON FUNCTION public.mark_passengers_viewed() TO authenticated;

CREATE OR REPLACE FUNCTION public.count_new_passengers()
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::int from public.my_passengers where is_new;
$function$;

GRANT EXECUTE ON FUNCTION public.count_new_passengers() TO authenticated;
