-- ============================================================================
-- Item 11 (2. kör): ha egy utasnak MÁR VAN aktív foglalása ugyanezen a
-- hirdetésen, egy újabb "foglalás" mostantól MÓDOSÍTÁSKÉNT kezelendő (a
-- meglévő foglalás helyszáma nő, capacity-korlátozva), nem új sor
-- beszúrásaként. A created_at frissül a módosítás idejére (ez hajtja az
-- Utasaim másodlagos rendezését), így a trg_notify_booking_updated trigger
-- természetesen elsül majd (OLD.seats_booked != NEW.seats_booked, mindkét
-- oldalon status='active'), és a meglévő "módosítás" e-mail sablon megy ki —
-- nem kell új trigger vagy sablon. Csak a jövőbeni foglalásokra vonatkozik,
-- a korábbi (esetlegesen duplikált) sorokat nem érinti/migrálja.
-- ============================================================================
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
  v_booked_others int;
  v_booking_id uuid;
  v_existing_id uuid;
  v_existing_seats int;
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
