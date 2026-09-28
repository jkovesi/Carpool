-- KAN-3 v5: jármű szerkesztés (update_vehicle RPC) + kapacitás-korlát a jármű
-- max férőhelyének csökkentésekor. KAN-14: update_listing eddig nem ellenőrizte,
-- hogy a szabad helyek száma túllépi-e a jármű max férőhelyét szerkesztéskor.

-- 1) my_listings: vehicle_id felvétele, hogy a frontend szerkesztéskor le tudja
--    kérdezni a jármű aktuális kapacitását (saját jármű, RLS ezt engedi).
CREATE OR REPLACE VIEW public.my_listings AS
SELECT r.*, l.vehicle_id
FROM public.ride_details r
JOIN public.listings l ON l.id = r.id
WHERE r.driver_id = auth.uid();

GRANT SELECT ON public.my_listings TO authenticated;

-- 2) update_listing: a jármű max férőhelye is legyen felső korlát (eddig hiányzott -- KAN-14).
CREATE OR REPLACE FUNCTION public.update_listing(p_listing_id uuid, p_price_huf integer, p_seats_total integer, p_ride_date date, p_ride_time time without time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_driver_id uuid;
  v_vehicle_id uuid;
  v_vehicle_seats int;
  v_booked int;
begin
  select driver_id, vehicle_id into v_driver_id, v_vehicle_id from public.listings where id = p_listing_id for update;

  if not found then
    raise exception 'A hirdetés nem található.';
  end if;

  if v_driver_id != auth.uid() then
    raise exception 'Nincs jogosultságod ehhez a hirdetéshez.';
  end if;

  select seats into v_vehicle_seats from public.vehicles where id = v_vehicle_id;

  if p_seats_total > v_vehicle_seats then
    raise exception 'A szabad helyek száma (%) nem lehet több, mint a jármű férőhelye (%).', p_seats_total, v_vehicle_seats;
  end if;

  select coalesce(sum(seats_booked), 0) into v_booked
  from public.bookings where listing_id = p_listing_id and status = 'active';

  if p_seats_total < v_booked then
    raise exception 'A szabad helyek száma nem csökkenthető a már lefoglalt helyek (%) alá.', v_booked;
  end if;

  update public.listings
  set price_huf = p_price_huf,
      seats_total = p_seats_total,
      ride_date = p_ride_date,
      ride_time = p_ride_time,
      updated_at = now()
  where id = p_listing_id;
end;
$function$;

-- 3) update_vehicle RPC (KAN-3 v5): jármű adatainak szerkesztése; a max férőhely nem
--    csökkenthető az adott járműhöz tartozó, aktív hirdetésen már lefoglalt helyek száma alá.
CREATE OR REPLACE FUNCTION public.update_vehicle(p_vehicle_id uuid, p_type text, p_plate text, p_seats integer, p_color text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_owner_id uuid;
  v_min_seats int;
begin
  select owner_id into v_owner_id from public.vehicles where id = p_vehicle_id for update;

  if not found or v_owner_id != auth.uid() then
    raise exception 'A jármű nem található, vagy nem a tiéd.';
  end if;

  select coalesce(max(per_listing.booked), 0) into v_min_seats
  from (
    select coalesce(sum(b.seats_booked), 0) as booked
    from public.listings l
    join public.bookings b on b.listing_id = l.id and b.status = 'active'
    where l.vehicle_id = p_vehicle_id and l.status = 'active'
    group by l.id
  ) per_listing;

  if p_seats < v_min_seats then
    raise exception 'A max férőhely nem csökkenthető % alá, mert egy aktív hirdetésen ennyi hely már le van foglalva. Csökkentéshez előbb rendezd/töröld az érintett hirdetést.', v_min_seats;
  end if;

  if p_seats < 1 or p_seats > 8 then
    raise exception 'A max férőhely 1 és 8 közé kell essen.';
  end if;

  if p_type is null or length(trim(p_type)) = 0 then
    raise exception 'A jármű típusa nem lehet üres.';
  end if;

  if p_plate is null or length(trim(p_plate)) = 0 then
    raise exception 'A rendszám nem lehet üres.';
  end if;

  update public.vehicles
  set type = p_type, plate = p_plate, seats = p_seats, color = p_color
  where id = p_vehicle_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.update_vehicle(uuid, text, text, integer, text) TO authenticated;
