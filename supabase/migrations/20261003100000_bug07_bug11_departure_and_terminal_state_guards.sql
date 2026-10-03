-- BUG-07 (SQ-7/9, spec 4.5/4.11/4.12) és BUG-11 (spec 4.12/4.21/4.25)
-- Az indulás időpontja (ride_date + ride_time, Europe/Budapest) után a foglalás
-- és a hirdetés nem mondható le, nem törölhető és nem módosítható; a törölt
-- hirdetés / "Törölt" és "Lemondva" foglalás végállapot.

create or replace function public.cancel_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_passenger_id uuid;
  v_status text;
  v_listing_id uuid;
  v_departs timestamptz;
begin
  select passenger_id, status, listing_id into v_passenger_id, v_status, v_listing_id
  from public.bookings where id = p_booking_id for update;

  if not found or v_passenger_id != auth.uid() then
    raise exception 'Nincs jogosultságod ehhez a foglaláshoz.';
  end if;

  if v_status = 'cancelled' then
    raise exception 'Ez a foglalás már le van mondva.';
  end if;

  if v_status = 'listing_cancelled' then
    raise exception 'Ezt az utat a sofőr már törölte, a foglalás nem mondható le.';
  end if;

  select (ride_date + ride_time) at time zone 'Europe/Budapest' into v_departs
  from public.listings where id = v_listing_id;

  if v_departs <= now() then
    raise exception 'Ez az út már elindult, a foglalás nem mondható le.';
  end if;

  update public.bookings set status = 'cancelled' where id = p_booking_id;
end;
$function$;

create or replace function public.cancel_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_driver_id uuid;
  v_status text;
  v_departs timestamptz;
  v_snapshot integer;
begin
  select driver_id, status, (ride_date + ride_time) at time zone 'Europe/Budapest'
    into v_driver_id, v_status, v_departs
  from public.listings where id = p_listing_id for update;

  if not found then
    raise exception 'A hirdetés nem található.';
  end if;
  if v_driver_id != auth.uid() then
    raise exception 'Nincs jogosultságod ehhez a hirdetéshez.';
  end if;
  if v_status != 'active' then
    raise exception 'Ez a hirdetés már törölve van.';
  end if;
  if v_departs <= now() then
    raise exception 'Ez az út már elindult, a hirdetés nem törölhető.';
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

create or replace function public.update_listing(p_listing_id uuid, p_price_huf integer, p_seats_total integer, p_ride_date date, p_ride_time time without time zone)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_driver_id uuid; v_vehicle_id uuid; v_vehicle_seats int; v_booked int; v_status text;
  v_old_price int; v_old_date date; v_old_time time; v_old_seats_total int;
begin
  select driver_id, vehicle_id, price_huf, ride_date, ride_time, seats_total, status
    into v_driver_id, v_vehicle_id, v_old_price, v_old_date, v_old_time, v_old_seats_total, v_status
  from public.listings where id = p_listing_id for update;
  if not found then raise exception 'A hirdetés nem található.'; end if;
  if v_driver_id != auth.uid() then raise exception 'Nincs jogosultságod ehhez a hirdetéshez.'; end if;
  if v_status != 'active' then raise exception 'Törölt hirdetés nem módosítható.'; end if;
  if (v_old_date + v_old_time) at time zone 'Europe/Budapest' <= now() then
    raise exception 'Ez az út már elindult, a hirdetés nem módosítható.';
  end if;
  select seats into v_vehicle_seats from public.vehicles where id = v_vehicle_id;
  if p_seats_total > v_vehicle_seats then raise exception 'A szabad helyek száma (%) nem lehet több, mint a jármű férőhelye (%).', p_seats_total, v_vehicle_seats; end if;
  if p_seats_total < 1 then raise exception 'Legalább 1 szabad helyet meg kell hirdetni.'; end if;
  select coalesce(sum(seats_booked), 0) into v_booked from public.bookings where listing_id = p_listing_id and status = 'active';
  if p_seats_total < v_booked then raise exception 'A szabad helyek száma nem csökkenthető a már lefoglalt helyek (%) alá.', v_booked; end if;
  if v_booked > 0 then
    if p_price_huf != v_old_price or p_ride_date != v_old_date or p_ride_time != v_old_time then
      raise exception 'Ennek a hirdetésnek már van legalább 1 foglalása, ezért az ár és az indulás időpontja (dátum, idő) nem módosítható. Csak a szabad helyek száma módosítható.';
    end if;
  else
    if (p_ride_date + p_ride_time) at time zone 'Europe/Budapest' < now() then raise exception 'A dátum és időpont nem lehet múltbeli.'; end if;
    if p_ride_date > (current_date + 365) then raise exception 'A dátum legfeljebb 365 nappal lehet a mai naptól későbbre.'; end if;
  end if;
  update public.listings set price_huf = p_price_huf, seats_total = p_seats_total, ride_date = p_ride_date, ride_time = p_ride_time, updated_at = now() where id = p_listing_id;
end; $function$;

create or replace function public.update_booking(p_booking_id uuid, p_seats integer)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_passenger_id uuid;
  v_status text;
  v_listing_id uuid;
  v_old_seats int;
  v_listing_status text;
  v_departs timestamptz;
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

  select status, (ride_date + ride_time) at time zone 'Europe/Budapest', seats_total
    into v_listing_status, v_departs, v_seats_total
  from public.listings where id = v_listing_id for update;

  if v_listing_status != 'active' then
    raise exception 'Ez az út már nem aktív, a foglalás nem módosítható.';
  end if;

  -- BUG-07: nem csak a dátumot, hanem a pontos indulási időpontot nézzük.
  if v_departs <= now() then
    raise exception 'Ez az út már elindult, a foglalás nem módosítható.';
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
