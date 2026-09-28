-- Ugyanaz a "csak dátum, idő nélkül" hiba a szerver oldali ellenőrzéseket is
-- érintette: (1) book_ride() nem tiltotta a foglalást egy már lejárt (ma
-- induló, de elmúlt időpontú) hirdetésre; (2) create_listing()/update_listing()
-- csak a dátumot nézte "múltbeli"-nek, egy ma-de-már-elmúlt-időpontú hirdetés
-- létrehozását/mentését engedte, ami rögtön "Lejárt"-ként jelent volna meg.

create or replace function public.book_ride(p_listing_id uuid, p_seats integer)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_driver_id uuid;
  v_status text;
  v_seats_total int;
  v_ride_date date;
  v_ride_time time;
  v_booked_others int;
  v_booking_id uuid;
  v_existing_id uuid;
  v_existing_seats int;
begin
  select driver_id, status, seats_total, ride_date, ride_time
    into v_driver_id, v_status, v_seats_total, v_ride_date, v_ride_time
  from public.listings where id = p_listing_id for update;

  if not found then
    raise exception 'A hirdetés nem található.';
  end if;

  if v_status != 'active' then
    raise exception 'Ez a hirdetés már nem aktív.';
  end if;

  if (v_ride_date + v_ride_time) at time zone 'Europe/Budapest' < now() then
    raise exception 'Ez a hirdetés már lejárt, nem lehet rá foglalni.';
  end if;

  if v_driver_id = auth.uid() then
    raise exception 'Saját hirdetésedre nem foglalhatsz helyet.';
  end if;

  if p_seats < 1 then
    raise exception 'Legalább 1 helyet kell foglalnod.';
  end if;

  -- Van-e már aktív foglalása ugyanezen a hirdetésen ennek az utasnak?
  select id, seats_booked into v_existing_id, v_existing_seats
  from public.bookings
  where listing_id = p_listing_id and passenger_id = auth.uid() and status = 'active'
  for update;

  select coalesce(sum(seats_booked), 0) into v_booked_others
  from public.bookings
  where listing_id = p_listing_id and status = 'active' and id is distinct from v_existing_id;

  if (v_seats_total - v_booked_others) < (coalesce(v_existing_seats, 0) + p_seats) then
    raise exception 'Nincs elég szabad hely (% szabad).', (v_seats_total - v_booked_others - coalesce(v_existing_seats, 0));
  end if;

  if v_existing_id is not null then
    update public.bookings
    set seats_booked = v_existing_seats + p_seats,
        created_at = now()
    where id = v_existing_id;
    v_booking_id := v_existing_id;
  else
    insert into public.bookings (listing_id, passenger_id, seats_booked, status)
    values (p_listing_id, auth.uid(), p_seats, 'active')
    returning id into v_booking_id;
  end if;

  return v_booking_id;
end;
$function$;

create or replace function public.create_listing(p_vehicle_id uuid, p_from_city text, p_to_city text, p_ride_date date, p_ride_time time without time zone, p_price_huf integer, p_seats_total integer)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  if (p_ride_date + p_ride_time) at time zone 'Europe/Budapest' < now() then
    raise exception 'A dátum és időpont nem lehet múltbeli.';
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

create or replace function public.update_listing(p_listing_id uuid, p_price_huf integer, p_seats_total integer, p_ride_date date, p_ride_time time without time zone)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    if (p_ride_date + p_ride_time) at time zone 'Europe/Budapest' < now() then
      raise exception 'A dátum és időpont nem lehet múltbeli.';
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
