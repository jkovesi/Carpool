-- ============================================================
-- 1) Jogosultságok szűkítése: a create()-kor kapott alapértelmezett
--    PUBLIC EXECUTE grant-ot vissza kell vonni, és csak a ténylegesen
--    szükséges szerepköröknek engedélyezni.
-- ============================================================

-- handle_new_user: kizárólag a trigger hívja, közvetlen RPC-ként senki se érhesse el.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Mutáló RPC-k: csak bejelentkezett felhasználó hívhatja (anon-nak nincs auth.uid()-je,
-- de zárjuk is ki explicit módon, ahogy az advisor javasolja).
revoke execute on function public.book_ride(uuid, int) from public, anon;
revoke execute on function public.cancel_booking(uuid) from public, anon;
revoke execute on function public.cancel_listing(uuid) from public, anon;
revoke execute on function public.create_listing(uuid, text, text, date, time, int, int) from public, anon;
revoke execute on function public.update_listing(uuid, int, int, date, time) from public, anon;

-- email_for_username: ez marad anon számára is elérhető, hiszen bejelentkezés ELŐTT
-- kell tudni felhasználónévből e-mailt feloldani — de a PUBLIC grant-ot itt is
-- szűkítjük a két konkrét szerepkörre.
revoke execute on function public.email_for_username(text) from public;
grant execute on function public.email_for_username(text) to anon, authenticated;

-- ============================================================
-- 2) Hiányzó index a listings.vehicle_id idegenkulcson.
-- ============================================================
create index listings_vehicle_id_idx on public.listings (vehicle_id);

-- ============================================================
-- 3) RLS policy-k: auth.uid() -> (select auth.uid()), hogy ne soronként
--    értékelődjön ki (Postgres így egyszer, initplan-ben számolja ki).
-- ============================================================

drop policy "profiles: saját sor olvasása" on public.profiles;
create policy "profiles: saját sor olvasása" on public.profiles
  for select using ((select auth.uid()) = id);

drop policy "profiles: saját sor módosítása" on public.profiles;
create policy "profiles: saját sor módosítása" on public.profiles
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy "vehicles: saját járművek olvasása" on public.vehicles;
create policy "vehicles: saját járművek olvasása" on public.vehicles
  for select using ((select auth.uid()) = owner_id);

drop policy "vehicles: saját jármű felvétele" on public.vehicles;
create policy "vehicles: saját jármű felvétele" on public.vehicles
  for insert with check ((select auth.uid()) = owner_id);

drop policy "vehicles: saját jármű törlése" on public.vehicles;
create policy "vehicles: saját jármű törlése" on public.vehicles
  for delete using ((select auth.uid()) = owner_id);

drop policy "listings: saját hirdetések teljes elérése" on public.listings;
create policy "listings: saját hirdetések teljes elérése" on public.listings
  for select using ((select auth.uid()) = driver_id);

-- ============================================================
-- 4) bookings: a két külön SELECT policy-t egybe vonjuk (multiple_permissive_policies).
-- ============================================================

drop policy "bookings: saját foglalások olvasása" on public.bookings;
drop policy "bookings: sofőr látja a rá vonatkozó foglalásokat" on public.bookings;

create policy "bookings: utas vagy a hirdetés sofőrje olvashatja" on public.bookings
  for select using (
    (select auth.uid()) = passenger_id
    or (select auth.uid()) = (select driver_id from public.listings l where l.id = listing_id)
  );
