-- v10: Célállomás-fotó AI-alapú kiválasztása és cache-elése (4.26, 2.5).
-- CURATED_BY_DESTINATION / FALLBACK_POOL / RideIllustration NEM ennek a
-- funkciónak a része — az AI-keresés melletti fallback kizárólag a
-- statikus src/assets/ride-placeholder.jpg (kliens oldalon kezelve).

create table public.destination_photo_cache (
  destination text primary key,
  image_url text,
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.destination_photo_cache is
  'Célállomásonkénti (nem hirdetésenkénti) AI-kereséssel talált fotó cache (KAN-39, spec 2.5/4.26). Csak to_city-re vonatkozik.';

alter table public.destination_photo_cache enable row level security;

create policy "destination_photo_cache publikusan olvasható"
  on public.destination_photo_cache
  for select
  using (true);

-- Normalizálás: kisbetűs, szóköz-trimmelt célállomás-név mint kulcs.
create or replace function public.normalize_destination(p_destination text)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select lower(trim(p_destination));
$$;

-- Webhook titok a search-destination-photo Edge Function védelméhez,
-- ugyanaz a minta, mint a notify-booking / booking_webhook_secret esetén.
select vault.create_secret(
  encode(sha256((gen_random_uuid()::text || clock_timestamp()::text || random()::text)::bytea), 'hex'),
  'destination_photo_webhook_secret'
);

-- Új célállomású hirdetés mentésekor a mentést nem lassítva, a háttérben
-- elindítja az AI-keresést — de csak ha a célállomáshoz MÉG NINCS cache-sor
-- (ha már van, akár Kész, akár Hibás, akár Folyamatban, nem indul újra).
create or replace function public.trigger_search_destination_photo()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_destination text;
  v_secret text;
  v_inserted text;
begin
  v_destination := public.normalize_destination(NEW.to_city);

  insert into public.destination_photo_cache (destination, status, source)
  values (v_destination, 'pending', 'ai-search')
  on conflict (destination) do nothing
  returning destination into v_inserted;

  if v_inserted is not null then
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'destination_photo_webhook_secret';
    perform net.http_post(
      url := 'https://yctezzkwrzncgsvzhbjk.supabase.co/functions/v1/search-destination-photo',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', v_secret
      ),
      body := jsonb_build_object('destination', v_destination),
      timeout_milliseconds := 8000
    );
  end if;

  return NEW;
end;
$function$;

drop trigger if exists trg_search_destination_photo on public.listings;
create trigger trg_search_destination_photo
  after insert on public.listings
  for each row
  execute function public.trigger_search_destination_photo();

-- Önjavítás: a kliens ezt hívja, ha egy már cache-elt kép linkje törötten
-- töltődik be. Állapottól függetlenül újraindítja a keresést (force).
create or replace function public.request_destination_photo_reheal(p_destination text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_destination text;
  v_secret text;
begin
  v_destination := public.normalize_destination(p_destination);

  insert into public.destination_photo_cache (destination, status, source)
  values (v_destination, 'pending', 'ai-search')
  on conflict (destination) do update set status = 'pending', updated_at = now();

  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'destination_photo_webhook_secret';
  perform net.http_post(
    url := 'https://yctezzkwrzncgsvzhbjk.supabase.co/functions/v1/search-destination-photo',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', v_secret
    ),
    body := jsonb_build_object('destination', v_destination, 'force', true),
    timeout_milliseconds := 8000
  );
end;
$function$;

grant execute on function public.request_destination_photo_reheal(text) to authenticated;

-- ride_details bővítése: a cache-elt kép URL-je és állapota, mindig a to_city
-- alapján, a Postgres CREATE OR REPLACE VIEW szabálya miatt a végén hozzáfűzve.
create or replace view public.ride_details as
select
  l.id,
  l.driver_id,
  dp.username as driver_username,
  case
    when auth.uid() = l.driver_id or (exists (
      select 1 from bookings b
      where b.listing_id = l.id and b.passenger_id = auth.uid() and b.status = 'active'
    )) then dp.full_name
    else null
  end as driver_full_name,
  l.from_city,
  l.to_city,
  l.ride_date,
  l.ride_time,
  l.price_huf,
  l.seats_total,
  l.car_type,
  l.car_color,
  case
    when auth.uid() = l.driver_id or (exists (
      select 1 from bookings b
      where b.listing_id = l.id and b.passenger_id = auth.uid() and b.status = 'active'
    )) then l.car_plate
    else null
  end as car_plate,
  l.status,
  coalesce((select sum(b2.seats_booked) from bookings b2 where b2.listing_id = l.id and b2.status = 'active'), 0) as seats_booked,
  l.seats_total - coalesce((select sum(b2.seats_booked) from bookings b2 where b2.listing_id = l.id and b2.status = 'active'), 0) as seats_available,
  l.created_at,
  (l.ride_date + l.ride_time) at time zone 'Europe/Budapest' as departs_at,
  l.cancelled_seats_snapshot,
  dpc.image_url as destination_photo_url,
  dpc.status as destination_photo_status
from listings l
join profiles dp on dp.id = l.driver_id
left join public.destination_photo_cache dpc on dpc.destination = public.normalize_destination(l.to_city);
