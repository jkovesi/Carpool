create or replace function public.update_listing(p_listing_id uuid, p_price_huf integer, p_seats_total integer, p_ride_date date, p_ride_time time without time zone)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_driver_id uuid; v_vehicle_id uuid; v_vehicle_seats int; v_booked int;
  v_old_price int; v_old_date date; v_old_time time; v_old_seats_total int;
begin
  select driver_id, vehicle_id, price_huf, ride_date, ride_time, seats_total
    into v_driver_id, v_vehicle_id, v_old_price, v_old_date, v_old_time, v_old_seats_total
  from public.listings where id = p_listing_id for update;
  if not found then raise exception 'A hirdetés nem található.'; end if;
  if v_driver_id != auth.uid() then raise exception 'Nincs jogosultságod ehhez a hirdetéshez.'; end if;
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
