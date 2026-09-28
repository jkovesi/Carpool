-- ============================================================
-- 1) update_booking: utas módosíthatja a foglalt helyek számát
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_booking(p_booking_id uuid, p_seats integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_passenger_id uuid;
  v_status text;
  v_listing_id uuid;
  v_old_seats int;
  v_listing_status text;
  v_ride_date date;
  v_seats_total int;
  v_booked_others int;
begin
  select passenger_id, status, listing_id, seats_booked
    into v_passenger_id, v_status, v_listing_id, v_old_seats
  from public.bookings where id = p_booking_id for update;

  if not found or v_passenger_id != auth.uid() then
    raise exception 'Nincs jogosultságod ehhez a foglaláshoz.';
  end if;

  if v_status != 'active' then
    raise exception 'Ez a foglalás már nem aktív.';
  end if;

  if p_seats < 1 then
    raise exception 'A foglalt helyek száma nem lehet nulla vagy negatív. A foglalás lemondásához használd a lemondás funkciót.';
  end if;

  select status, ride_date, seats_total into v_listing_status, v_ride_date, v_seats_total
  from public.listings where id = v_listing_id for update;

  if v_listing_status != 'active' then
    raise exception 'Ez az út már nem aktív, a foglalás nem módosítható.';
  end if;

  if v_ride_date < current_date then
    raise exception 'Ez az út már lezajlott, a foglalás nem módosítható.';
  end if;

  if p_seats = v_old_seats then
    return;
  end if;

  select coalesce(sum(seats_booked), 0) into v_booked_others
  from public.bookings where listing_id = v_listing_id and status = 'active' and id != p_booking_id;

  if (v_seats_total - v_booked_others) < p_seats then
    raise exception 'Nincs elég szabad hely (% szabad).', (v_seats_total - v_booked_others);
  end if;

  update public.bookings set seats_booked = p_seats where id = p_booking_id;
end;
$function$;

REVOKE ALL ON FUNCTION public.update_booking(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_booking(uuid, integer) TO authenticated;

-- ============================================================
-- 2) create_listing: dátum-tartomány validáció [ma, ma+365]
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_listing(p_vehicle_id uuid, p_from_city text, p_to_city text, p_ride_date date, p_ride_time time without time zone, p_price_huf integer, p_seats_total integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_type text;
  v_color text;
  v_plate text;
  v_seats int;
  v_id uuid;
begin
  select type, color, plate, seats into v_type, v_color, v_plate, v_seats
  from public.vehicles
  where id = p_vehicle_id and owner_id = auth.uid();

  if not found then
    raise exception 'A jármű nem található, vagy nem a tiéd.';
  end if;

  if p_seats_total > v_seats then
    raise exception 'A hirdetett helyek száma (%) nem lehet több, mint a jármű férőhelye (%).', p_seats_total, v_seats;
  end if;

  if p_seats_total < 1 then
    raise exception 'Legalább 1 szabad helyet meg kell hirdetni.';
  end if;

  if p_ride_date < current_date then
    raise exception 'A dátum nem lehet múltbeli.';
  end if;

  if p_ride_date > (current_date + 365) then
    raise exception 'A dátum legfeljebb 365 nappal lehet a mai naptól későbbre.';
  end if;

  insert into public.listings (
    driver_id, vehicle_id, from_city, to_city, ride_date, ride_time,
    price_huf, seats_total, car_type, car_color, car_plate, status
  ) values (
    auth.uid(), p_vehicle_id, p_from_city, p_to_city, p_ride_date, p_ride_time,
    p_price_huf, p_seats_total, v_type, v_color, v_plate, 'active'
  )
  returning id into v_id;

  return v_id;
end;
$function$;

-- ============================================================
-- 3) update_listing: zárolás foglalás esetén + dátum-tartomány
-- ============================================================
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
  v_old_price int;
  v_old_date date;
  v_old_time time;
  v_old_seats_total int;
begin
  select driver_id, vehicle_id, price_huf, ride_date, ride_time, seats_total
    into v_driver_id, v_vehicle_id, v_old_price, v_old_date, v_old_time, v_old_seats_total
  from public.listings where id = p_listing_id for update;

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

  if p_seats_total < 1 then
    raise exception 'Legalább 1 szabad helyet meg kell hirdetni.';
  end if;

  select coalesce(sum(seats_booked), 0) into v_booked
  from public.bookings where listing_id = p_listing_id and status = 'active';

  if p_seats_total < v_booked then
    raise exception 'A szabad helyek száma nem csökkenthető a már lefoglalt helyek (%) alá.', v_booked;
  end if;

  if v_booked > 0 then
    if p_price_huf != v_old_price or p_ride_date != v_old_date or p_ride_time != v_old_time then
      raise exception 'Ennek a hirdetésnek már van legalább 1 foglalása, ezért az ár és az indulás időpontja (dátum, idő) nem módosítható. Csak a szabad helyek száma növelhető.';
    end if;
    if p_seats_total < v_old_seats_total then
      raise exception 'Ennek a hirdetésnek már van legalább 1 foglalása, ezért a szabad helyek száma nem csökkenthető, csak növelhető.';
    end if;
  else
    if p_ride_date < current_date then
      raise exception 'A dátum nem lehet múltbeli.';
    end if;

    if p_ride_date > (current_date + 365) then
      raise exception 'A dátum legfeljebb 365 nappal lehet a mai naptól későbbre.';
    end if;
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

-- ============================================================
-- 4) booking_updated trigger + esemény
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_booking_updated()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_secret text;
begin
  if OLD.seats_booked is distinct from NEW.seats_booked
     and OLD.status = 'active' and NEW.status = 'active' then
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'booking_webhook_secret';
    perform net.http_post(
      url := 'https://yctezzkwrzncgsvzhbjk.supabase.co/functions/v1/notify-booking',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', v_secret
      ),
      body := jsonb_build_object('booking_id', NEW.id, 'event', 'booking_updated', 'old_seats', OLD.seats_booked),
      timeout_milliseconds := 8000
    );
  end if;
  return NEW;
end;
$function$;

REVOKE ALL ON FUNCTION public.notify_booking_updated() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_booking_updated() FROM authenticated;
REVOKE ALL ON FUNCTION public.notify_booking_updated() FROM anon;

DROP TRIGGER IF EXISTS trg_notify_booking_updated ON public.bookings;
CREATE TRIGGER trg_notify_booking_updated AFTER UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION notify_booking_updated();
