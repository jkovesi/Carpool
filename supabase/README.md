# Telekocsi — Supabase backend (verziókövetve)

Ez a mappa a Telekocsi éles Supabase projektjének (`yctezzkwrzncgsvzhbjk`)
**teljes, exportált** backend-definícióját tartalmazza: minden eddig
lefuttatott adatbázis-migrációt (`migrations/`) és mindkét Edge Function
forráskódját (`functions/`) pontosan olyan formában, ahogy jelenleg
élesben futnak. 2026-09-28 előtt ez a mappa nem létezett — a backend
kizárólag magában a Supabase projektben létezett, a GitHub repóban nem;
ez a commit ezt a hiányt pótolja.

## Mit tartalmaz, mit nem

- `migrations/*.sql` — a 24 db, időrendi sorrendben lefuttatott migráció,
  szó szerint úgy, ahogy a Supabase eltárolta (`supabase_migrations.schema_migrations`
  tábla `statements` oszlopa). Együtt ezek adják a teljes séma (táblák,
  RLS-szabályok, view-k, RPC-függvények, trigger-ek) jelenlegi állapotát.
- `functions/*/index.ts` — a két aktív Edge Function (`notify-booking`,
  `search-destination-photo`) teljes, éles forráskódja.
- `config.toml` — a projekt ID-ja és a két függvény `verify_jwt = false`
  beállítása (mindkettő megosztott titkos fejléccel, nem JWT-vel védett).

**Nem** tartalmazza (és nem is tartalmazhatja verziókövetve): a titkokat
(`UNSPLASH_ACCESS_KEY`, `DESTINATION_PHOTO_WEBHOOK_SECRET`, `BOOKING_WEBHOOK_SECRET`,
`MAILGUN_API_KEY`, `MAILGUN_DOMAIN`), az Auth-beállításokat (Site URL,
redirect URL-ek, e-mail sablonok), és a tényleges adatokat (5 db tábla:
`profiles`, `vehicles`, `listings`, `bookings`, `destination_photo_cache`).

## Hogyan tudod ebből visszaépíteni/reprodukálni a backendet?

### A) Egy MÁSIK (üres) Supabase projektbe

1. Telepítsd a Supabase CLI-t, majd `supabase login`.
2. `supabase link --project-ref <az-új-projekt-ref-je>` a repó gyökerén.
3. `supabase db push` — lefuttatja a `migrations/` mappa összes SQL-jét
   sorrendben az új projekt adatbázisán. Ezután a séma (táblák, RLS,
   view-k, függvények, triggerek) pontosan olyan lesz, mint élesben.
4. `supabase functions deploy notify-booking` és
   `supabase functions deploy search-destination-photo` — feltölti a két
   Edge Function-t.
5. Állítsd be a titkokat az új projektben (`supabase secrets set ...` vagy a
   Dashboard → Edge Functions → Secrets): `UNSPLASH_ACCESS_KEY`,
   `DESTINATION_PHOTO_WEBHOOK_SECRET`, `BOOKING_WEBHOOK_SECRET`,
   `MAILGUN_API_KEY`, `MAILGUN_DOMAIN` — ezek értékét én (Claude) nem
   láthatom és nem is tárolhatom, ezeket neked kell újra megadnod/legenerálnod.
6. Állítsd be az Auth → URL Configuration alatt a Site URL-t és a redirect
   URL-eket az új projekt/domain szerint.
7. A frontendben (`src/lib/supabase.ts` + build-időben átadott env változók)
   cseréld az új projekt URL-jét és publikus (anon) kulcsát.

### B) Ugyanennek a projektnek a jövőbeli állapotváltozásai

Innentől minden új Supabase-módosítást (új migráció, Edge Function-verzió)
érdemes ebbe a mappába is bekerülnie — így a GitHub repó a jövőben is
naprakész marad a valódi élesben futó backenddel, nem csak ez az egyszeri
export.

### C) "Csak nézni akarom, mi van benne" — nem kell semmit futtatni

A `migrations/*.sql` fájlok egyszerű, olvasható SQL — végigolvasva pontosan
látod a teljes adatmodellt és üzleti logikát futtatás nélkül is.

## Miért nem volt ez korábban itt?

A backend-módosításokat a fejlesztés során közvetlenül a Supabase projekten
végeztük el (SQL-migrációk és Edge Function-deploy-ok közvetlenül a
Supabase API-n keresztül), anélkül hogy ezeket helyi fájlokként is
elmentettük és a GitHub repóba commitoltuk volna. Ez a mappa ezt az utólagos
exportot/szinkronizálást pótolja egy pillanatképpel (2026-09-28-i állapot).
