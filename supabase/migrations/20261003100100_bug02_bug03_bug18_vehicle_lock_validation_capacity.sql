-- BUG-02 (KAN-28, spec 4.13): a jármű-zárolás csak a még el nem indult, aktív
--   hirdetéseket veszi figyelembe (a lejárt hirdetés status='active' marad).
-- BUG-03 (spec 4.2): üres / csak szóközből álló típus és rendszám tiltása
--   adatbázis-szinten is (a direkt INSERT-et is lefedve); a mezők trimmelése.
-- BUG-18 (spec 4.2/4.13): a jármű férőhelye nem csökkenhet egy még el nem
--   indult, aktív hirdetés helyszáma alá (adatbázis-szintű védelem). A régi,
--   már törölt hirdetés történeti adatát szándékosan nem írjuk át.

create or replace function public.vehicle_has_upcoming_active_listing(p_vehicle_id uuid)
returns boolean
language sql
stable
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.listings l
    where l.vehicle_id = p_vehicle_id
      and l.status = 'active'
      and (l.ride_date + l.ride_time) at time zone 'Europe/Budapest' > now()
  );
$function$;
revoke execute on function public.vehicle_has_upcoming_active_listing(uuid) from public, anon;
grant execute on function public.vehicle_has_upcoming_active_listing(uuid) to authenticated, service_role;

create or replace view public.my_vehicles with (security_invoker = true) as
select v.id,
       v.owner_id,
       v.type,
       v.plate,
       v.seats,
       v.color,
       v.created_at,
       public.vehicle_has_upcoming_active_listing(v.id) as has_active_listing
from public.vehicles v
where v.owner_id = auth.uid();

create or replace function public.update_vehicle(p_vehicle_id uuid, p_type text, p_plate text, p_seats integer, p_color text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_owner_id uuid;
begin
  select owner_id into v_owner_id from public.vehicles where id = p_vehicle_id for update;

  if not found or v_owner_id != auth.uid() then
    raise exception 'A jármű nem található, vagy nem a tiéd.';
  end if;

  if public.vehicle_has_upcoming_active_listing(p_vehicle_id) then
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
  set type = trim(p_type), plate = trim(p_plate), seats = p_seats, color = nullif(trim(coalesce(p_color, '')), '')
  where id = p_vehicle_id;
end;
$function$;

-- A remove_vehicle() módosítása külön fájlban: 20261003100150_bug02_remove_vehicle_upcoming_only.sql

-- Normalizálás + validálás minden írásnál (direkt INSERT a táblába is).
create or replace function public.vehicles_normalize_and_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_max_listed int;
begin
  new.type := trim(coalesce(new.type, ''));
  new.plate := trim(coalesce(new.plate, ''));
  new.color := nullif(trim(coalesce(new.color, '')), '');
  if length(new.type) = 0 then
    raise exception 'A jármű típusa nem lehet üres.';
  end if;
  if length(new.plate) = 0 then
    raise exception 'A rendszám nem lehet üres.';
  end if;
  if tg_op = 'UPDATE' and new.seats < old.seats then
    select max(l.seats_total) into v_max_listed
    from public.listings l
    where l.vehicle_id = new.id
      and l.status = 'active'
      and (l.ride_date + l.ride_time) at time zone 'Europe/Budapest' > now();
    if v_max_listed is not null and new.seats < v_max_listed then
      raise exception 'A férőhely nem csökkenthető % alá, mert egy aktív hirdetés ennyi helyet hirdet.', v_max_listed;
    end if;
  end if;
  return new;
end;
$function$;

create or replace trigger trg_vehicles_normalize_and_guard
  before insert or update on public.vehicles
  for each row execute function public.vehicles_normalize_and_guard();

alter table public.vehicles
  add constraint vehicles_type_not_blank check (length(trim(type)) > 0),
  add constraint vehicles_plate_not_blank check (length(trim(plate)) > 0);

-- Hirdetésnél is: az aktív hirdetés helyszáma nem lépheti túl a jármű férőhelyét.
create or replace function public.listings_capacity_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_vehicle_seats int;
begin
  if new.status = 'active' and new.vehicle_id is not null then
    select seats into v_vehicle_seats from public.vehicles where id = new.vehicle_id;
    if v_vehicle_seats is not null and new.seats_total > v_vehicle_seats then
      raise exception 'A hirdetett helyek száma (%) nem lehet több, mint a jármű férőhelye (%).', new.seats_total, v_vehicle_seats;
    end if;
  end if;
  return new;
end;
$function$;

create or replace trigger trg_listings_capacity_guard
  before insert or update of seats_total, vehicle_id, status on public.listings
  for each row execute function public.listings_capacity_guard();
