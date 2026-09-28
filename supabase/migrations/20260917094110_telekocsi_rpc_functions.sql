-- ============================================================
-- email_for_username — felhasználónévvel történő bejelentkezés támogatása.
-- Csak az e-mail címet adja vissza, mást nem; anon is hívhatja (még belépés előtt).
-- ============================================================

create function public.email_for_username(p_username text)
returns text
language sql
security definer
set search_path = public, auth
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.username = p_username
  limit 1;
$$;

grant execute on function public.email_for_username(text) to anon, authenticated;

-- ============================================================
-- create_listing (KAN-4)
-- ============================================================

create function public.create_listing(
  p_vehicle_id uuid,
  p_from_city text,
  p_to_city text,
  p_ride_date date,
  p_ride_time time,
  p_price_huf int,
  p_seats_total int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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
$$;

grant execute on function public.create_listing(uuid, text, text, date, time, int, int) to authenticated;

-- ============================================================
-- update_listing (KAN-4 szerkesztés) — a szabad helyek nem csökkenthetők
-- a már lefoglalt helyek száma alá.
-- ============================================================

create function public.update_listing(
  p_listing_id uuid,
  p_price_huf int,
  p_seats_total int,
  p_ride_date date,
  p_ride_time time
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid;
  v_booked int;
begin
  select driver_id into v_driver_id from public.listings where id = p_listing_id for update;

  if not found then
    raise exception 'A hirdetés nem található.';
  end if;

  if v_driver_id != auth.uid() then
    raise exception 'Nincs jogosultságod ehhez a hirdetéshez.';
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
$$;

grant execute on function public.update_listing(uuid, int, int, date, time) to authenticated;

-- ============================================================
-- book_ride (KAN-6) — atomi kapacitás-ellenőrzés, megerősítés nélküli foglalás.
-- ============================================================

create function public.book_ride(p_listing_id uuid, p_seats int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid;
  v_status text;
  v_seats_total int;
  v_booked int;
  v_booking_id uuid;
begin
  select driver_id, status, seats_total into v_driver_id, v_status, v_seats_total
  from public.listings where id = p_listing_id for update;

  if not found then
    raise exception 'A hirdetés nem található.';
  end if;

  if v_status != 'active' then
    raise exception 'Ez a hirdetés már nem aktív.';
  end if;

  if v_driver_id = auth.uid() then
    raise exception 'Saját hirdetésedre nem foglalhatsz helyet.';
  end if;

  if p_seats < 1 then
    raise exception 'Legalább 1 helyet kell foglalnod.';
  end if;

  select coalesce(sum(seats_booked), 0) into v_booked
  from public.bookings where listing_id = p_listing_id and status = 'active';

  if (v_seats_total - v_booked) < p_seats then
    raise exception 'Nincs elég szabad hely (% szabad).', (v_seats_total - v_booked);
  end if;

  insert into public.bookings (listing_id, passenger_id, seats_booked, status)
  values (p_listing_id, auth.uid(), p_seats, 'active')
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;

grant execute on function public.book_ride(uuid, int) to authenticated;

-- ============================================================
-- cancel_booking (KAN-8)
-- ============================================================

create function public.cancel_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_passenger_id uuid;
  v_status text;
begin
  select passenger_id, status into v_passenger_id, v_status
  from public.bookings where id = p_booking_id for update;

  if not found or v_passenger_id != auth.uid() then
    raise exception 'Nincs jogosultságod ehhez a foglaláshoz.';
  end if;

  if v_status = 'cancelled' then
    raise exception 'Ez a foglalás már le van mondva.';
  end if;

  update public.bookings set status = 'cancelled' where id = p_booking_id;
end;
$$;

grant execute on function public.cancel_booking(uuid) to authenticated;

-- ============================================================
-- cancel_listing (KAN-8) — a hirdetés törlése az aktív foglalásokat is lemondja.
-- ============================================================

create function public.cancel_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_id uuid;
begin
  select driver_id into v_driver_id from public.listings where id = p_listing_id for update;

  if not found then
    raise exception 'A hirdetés nem található.';
  end if;

  if v_driver_id != auth.uid() then
    raise exception 'Nincs jogosultságod ehhez a hirdetéshez.';
  end if;

  update public.listings set status = 'cancelled', updated_at = now() where id = p_listing_id;
  update public.bookings set status = 'cancelled' where listing_id = p_listing_id and status = 'active';
end;
$$;

grant execute on function public.cancel_listing(uuid) to authenticated;
