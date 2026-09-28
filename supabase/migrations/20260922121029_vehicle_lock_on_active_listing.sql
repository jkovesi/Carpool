-- ============================================================================
-- Item 5 (2. kör módosítási csomag): ha egy járműhöz tartozik AKTÍV hirdetés,
-- a jármű sem nem szerkeszthető, sem nem törölhető, amíg az adott hirdetés
-- aktív marad. Ez lecseréli a korábbi, hirdetésenkénti foglalt-hely-kaszkád
-- logikát egy sokkal egyszerűbb szabályra.
-- ============================================================================

-- 1) my_vehicles nézet: a jármű saját sorai + has_active_listing flag, hogy a
--    frontend tudja zárolni a szerkesztés/törlés gombokat anélkül, hogy
--    minden járműhöz külön le kellene kérdeznie a hirdetéseket.
create or replace view public.my_vehicles as
select
  v.id,
  v.owner_id,
  v.type,
  v.plate,
  v.seats,
  v.color,
  v.created_at,
  exists (
    select 1 from public.listings l
    where l.vehicle_id = v.id and l.status = 'active'
  ) as has_active_listing
from public.vehicles v
where v.owner_id = auth.uid();

grant select on public.my_vehicles to authenticated;

-- 2) update_vehicle(): teljes zárolás aktív hirdetés esetén (nem csak a
--    férőhely-szám, semmi nem módosítható).
create or replace function public.update_vehicle(
  p_vehicle_id uuid, p_type text, p_plate text, p_seats integer, p_color text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_owner_id uuid;
  v_has_active boolean;
begin
  select owner_id into v_owner_id from public.vehicles where id = p_vehicle_id for update;

  if not found or v_owner_id != auth.uid() then
    raise exception 'A jármű nem található, vagy nem a tiéd.';
  end if;

  select exists (
    select 1 from public.listings l
    where l.vehicle_id = p_vehicle_id and l.status = 'active'
  ) into v_has_active;

  if v_has_active then
    raise exception 'A jármű nem szerkeszthető, mert van hozzá tartozó aktív hirdetés. Előbb töröld vagy zárd le az érintett hirdetést.';
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

revoke all on function public.update_vehicle(uuid, text, text, integer, text) from public;
revoke all on function public.update_vehicle(uuid, text, text, integer, text) from anon;
grant execute on function public.update_vehicle(uuid, text, text, integer, text) to authenticated;

-- 3) remove_vehicle(): új RPC a jármű törlésére, ugyanazzal a zárolással.
--    A korábbi közvetlen kliens-oldali `delete from vehicles` hívást váltja le.
create or replace function public.remove_vehicle(p_vehicle_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_owner_id uuid;
  v_has_active boolean;
begin
  select owner_id into v_owner_id from public.vehicles where id = p_vehicle_id for update;

  if not found or v_owner_id != auth.uid() then
    raise exception 'A jármű nem található, vagy nem a tiéd.';
  end if;

  select exists (
    select 1 from public.listings l
    where l.vehicle_id = p_vehicle_id and l.status = 'active'
  ) into v_has_active;

  if v_has_active then
    raise exception 'A jármű nem törölhető, mert van hozzá tartozó aktív hirdetés. Előbb töröld vagy zárd le az érintett hirdetést.';
  end if;

  delete from public.vehicles where id = p_vehicle_id;
end;
$function$;

revoke all on function public.remove_vehicle(uuid) from public;
revoke all on function public.remove_vehicle(uuid) from anon;
grant execute on function public.remove_vehicle(uuid) to authenticated;

-- 4) A közvetlen kliens-oldali törlést kikapcsoljuk — mostantól kizárólag a
--    remove_vehicle() RPC-n keresztül lehet járművet törölni.
drop policy if exists "vehicles: saját jármű törlése" on public.vehicles;

-- 5) A listings.vehicle_id -> vehicles FK-t lazítjuk: egy törölt jármű ne
--    akadályozza a törlést pusztán azért, mert egy RÉGI (nem aktív) hirdetés
--    még hivatkozik rá. A vehicle_id nullable lesz, törléskor NULL-ra áll.
alter table public.listings alter column vehicle_id drop not null;
alter table public.listings drop constraint listings_vehicle_id_fkey;
alter table public.listings
  add constraint listings_vehicle_id_fkey
  foreign key (vehicle_id) references public.vehicles(id) on delete set null;
