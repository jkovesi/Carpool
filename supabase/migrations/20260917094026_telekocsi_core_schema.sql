-- ============================================================
-- Telekocsi — alap adatmodell (KAN-2 .. KAN-8)
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text not null,
  phone text not null,
  consent_accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Regisztrált felhasználók publikus/fél-publikus profiladatai (KAN-2). Az e-mail és a jelszó az auth.users-ben marad, a Supabase Auth kezeli.';

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  plate text not null,
  seats int not null check (seats between 1 and 8),
  color text,
  created_at timestamptz not null default now()
);

comment on table public.vehicles is 'A felhasználó saját járművei (KAN-3). Szín opcionális, típus/rendszám/férőhely kötelező.';

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  from_city text not null,
  to_city text not null,
  ride_date date not null,
  ride_time time not null,
  price_huf int not null check (price_huf > 0),
  seats_total int not null check (seats_total >= 1),
  car_type text not null,
  car_color text,
  car_plate text not null,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.listings is 'Hirdetések (KAN-4). A jármű adatai (típus/szín/rendszám) a létrehozáskor pillanatképként kerülnek ide, hogy a rendszám-elrejtési szabály (KAN-1 4.7) egyszerűen, hirdetés-szinten legyen kikényszeríthető.';

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  passenger_id uuid not null references public.profiles(id) on delete cascade,
  seats_booked int not null check (seats_booked >= 1),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now()
);

comment on table public.bookings is 'Foglalások (KAN-6/7/8). Mutációk kizárólag a book_ride / cancel_booking RPC-ken keresztül, hogy a kapacitás-ellenőrzés atomi maradjon.';

create index listings_driver_id_idx on public.listings (driver_id);
create index listings_status_date_idx on public.listings (status, ride_date);
create index vehicles_owner_id_idx on public.vehicles (owner_id);
create index bookings_listing_id_idx on public.bookings (listing_id);
create index bookings_passenger_id_idx on public.bookings (passenger_id);

-- ============================================================
-- auth.users -> profiles automatikus szinkron regisztrációkor
-- ============================================================

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.listings enable row level security;
alter table public.bookings enable row level security;

create policy "profiles: saját sor olvasása" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles: saját sor módosítása" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "vehicles: saját járművek olvasása" on public.vehicles
  for select using (auth.uid() = owner_id);

create policy "vehicles: saját jármű felvétele" on public.vehicles
  for insert with check (auth.uid() = owner_id);

create policy "vehicles: saját jármű törlése" on public.vehicles
  for delete using (auth.uid() = owner_id);

create policy "listings: saját hirdetések teljes elérése" on public.listings
  for select using (auth.uid() = driver_id);

create policy "bookings: saját foglalások olvasása" on public.bookings
  for select using (auth.uid() = passenger_id);

create policy "bookings: sofőr látja a rá vonatkozó foglalásokat" on public.bookings
  for select using (
    auth.uid() = (select driver_id from public.listings l where l.id = listing_id)
  );

-- Megjegyzés: listings/bookings INSERT/UPDATE nincs közvetlen policy-val engedélyezve —
-- minden mutáció a lenti SECURITY DEFINER RPC-ken (create_listing, update_listing,
-- book_ride, cancel_booking, cancel_listing) megy át, hogy az üzleti szabályok
-- (kapacitás, saját hirdetésre nem foglalhat stb.) egy tranzakcióban, kikerülhetetlenül
-- érvényesüljenek.
