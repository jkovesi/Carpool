-- BUG-13 (spec 4.1): a felhasználónév kis/nagybetűtől függetlenül egyedi.
-- BUG-14 (spec 4.1): a regisztrációs és profiladatok szerveroldali
--   normalizálása (trim) és ellenőrzése — üres / csak szóközös név,
--   felhasználónév és telefonszám, illetve hibás formátum tiltása.
--   A profiles.email mezőt a felhasználó nem módosíthatja közvetlenül
--   (azt csak az auth.users-ből szinkronizáló trigger írhatja).

create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

create or replace function public.profile_validation_error(p_username text, p_full_name text, p_phone text)
returns text
language plpgsql
immutable
set search_path to 'public'
as $function$
declare
  v_digits int;
begin
  if p_username is null or p_username !~ '^[A-Za-z0-9._-]{3,30}$' then
    return 'A felhasználónév 3–30 karakter lehet, és csak betűt (ékezet nélkül), számot, pontot, kötőjelet vagy aláhúzást tartalmazhat.';
  end if;
  if p_full_name is null or length(p_full_name) < 2 or length(p_full_name) > 100 then
    return 'Add meg a teljes nevedet (2–100 karakter).';
  end if;
  if p_phone is null or p_phone !~ '^\+?[0-9 ()-]+$' then
    return 'A telefonszám csak számjegyeket, szóközt, kötőjelet, zárójelet és kezdő +-t tartalmazhat.';
  end if;
  v_digits := length(regexp_replace(p_phone, '\D', '', 'g'));
  if v_digits < 9 or v_digits > 15 then
    return 'A telefonszám 9–15 számjegyből álljon.';
  end if;
  return null;
end;
$function$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_username text := trim(new.raw_user_meta_data ->> 'username');
  v_full_name text := regexp_replace(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '\s+', ' ', 'g');
  v_phone text := regexp_replace(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '\s+', ' ', 'g');
  v_error text;
begin
  v_error := public.profile_validation_error(v_username, v_full_name, v_phone);
  if v_error is not null then
    raise exception '%', v_error;
  end if;
  insert into public.profiles (id, username, full_name, phone, email)
  values (new.id, v_username, v_full_name, v_phone, new.email);
  return new;
end;
$function$;

create or replace function public.profiles_normalize_and_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_error text;
begin
  new.username := trim(new.username);
  new.full_name := regexp_replace(trim(coalesce(new.full_name, '')), '\s+', ' ', 'g');
  new.phone := regexp_replace(trim(coalesce(new.phone, '')), '\s+', ' ', 'g');

  if tg_op = 'UPDATE' then
    -- Az e-mail címet csak a rendszer (auth.users trigger) szinkronizálhatja.
    if new.email is distinct from old.email and current_user in ('authenticated', 'anon') then
      raise exception 'Az e-mail cím itt nem módosítható.';
    end if;
    -- Ha a felhasználó csak más mezőt módosít (pl. utasaim_last_viewed_at),
    -- a régi, esetleg még nem szabályos adatok miatt ne bukjon el.
    if new.username is not distinct from old.username
       and new.full_name is not distinct from old.full_name
       and new.phone is not distinct from old.phone then
      return new;
    end if;
  end if;

  v_error := public.profile_validation_error(new.username, new.full_name, new.phone);
  if v_error is not null then
    raise exception '%', v_error;
  end if;
  return new;
end;
$function$;

create or replace trigger trg_profiles_normalize_and_guard
  before insert or update on public.profiles
  for each row execute function public.profiles_normalize_and_guard();

-- Regisztráció előtti ellenőrzés a felületnek. A felhasználónevek amúgy is
-- nyilvánosak (a hirdetéseken látszanak), így ez nem szivárogtat új adatot.
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select not exists (select 1 from public.profiles where lower(username) = lower(trim(p_username)));
$function$;
revoke execute on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated, service_role;

-- BUG-08 (SQ-7, spec 4.6): a sofőr telefonszáma és e-mail címe csak aktív
-- (nem lemondott, nem törölt) foglalásnál kerül vissza a volt utasnak.
create or replace view public.my_bookings as
 select b.id as booking_id,
    b.seats_booked,
    b.status as booking_status,
        case
            when (b.status = 'listing_cancelled'::text) then 'removed'::text
            when (b.status = 'cancelled'::text) then 'cancelled'::text
            when (((r.ride_date + r.ride_time) at time zone 'Europe/Budapest'::text) < now()) then 'expired'::text
            else 'active'::text
        end as display_status,
    r.id as listing_id,
    r.from_city,
    r.to_city,
    r.ride_date,
    r.ride_time,
    r.price_huf,
    r.car_type,
    r.car_color,
    r.car_plate,
    r.driver_id,
    r.driver_username,
    r.driver_full_name,
    b.created_at,
    (case when b.status = 'active' then dp.phone end)::text as driver_phone,
    (case when b.status = 'active' then dp.email end)::character varying(255) as driver_email,
    r.seats_total,
    r.seats_available
   from ((bookings b
     join ride_details r on ((r.id = b.listing_id)))
     join profiles dp on ((dp.id = r.driver_id)))
  where (b.passenger_id = auth.uid());
