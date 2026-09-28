# Telekocsi — Supabase backend (verziókövetve)

Ez a mappa a Telekocsi éles Supabase projektjének (`yctezzkwrzncgsvzhbjk`)
**teljes, exportált** backend-definícióját tartalmazza: minden eddig
lefuttatott adatbázis-migrációt (`migrations/`) és mindkét Edge Function
forráskódját (`functions/`) pontosan olyan formában, ahogy jelenleg
élesben futnak. 2026-09-28 előtt ez a mappa nem létezett — a backend
kizárólag magában a Supabase projektben létezett, a GitHub repóban nem;
ez a commit ezt a hiányt pótolja.

## Mit tartalmaz, mit nem

- `migrations/*.sql` — a 27 db, időrendi sorrendben lefuttatott migráció,
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

⚠️ **Ez az állítás egyszer, ténylegesen sérült — lásd a "Biztonsági
incidens" szakaszt lent.** Két korai (2026-09-18-i) migráció szó szerint,
nyílt szövegben tartalmazta a `booking_webhook_secret` akkori értékét; ezt
a GitHub beépített titok-keresője (GitGuardian) 2026-09-28-án jelezte,
mire a titkot azonnal rotáltuk és a fájlokat itt szerkesztve eltávolítottuk
belőlük az értéket.

## ⚠️ Biztonsági incidens (2026-09-28) — nyílt titok a git történetben

A `20260918133624_kan15_16_v5_booking_notification_webhook.sql` és a
`20260918133716_kan15_16_v5_harden_booking_webhook.sql` migráció EREDETI,
Supabase-ből exportált szövege szó szerint tartalmazta a `booking_webhook_secret`
akkor érvényes, valódi értékét (`L__PxaLiEnn32btmbVvC5e_28Wn88BilkZS5bH5oyx0`)
— ezt a 2026-09-28-i exportáláskor (l. lejjebb) én (Claude) nem szűrtem ki,
és tévesen azt állítottam, hogy semmilyen titok nem került a repóba. A
GitHub beépített titok-keresője (GitGuardian) ezt még aznap észlelte és
e-mailben jelezte.

**Megtett lépések:**
1. A `vault.decrypted_secrets`-ben tárolt `booking_webhook_secret` értékét
   azonnal lecseréltük egy új, véletlenszerűen generált értékre
   (`vault.update_secret(...)`) — az adatbázis oldali fele a rotálásnak
   megtörtént.
2. A fenti két migrációs fájlban a nyílt szöveges értéket
   `[REDACTED-ROTATED-2026-09-28]` jelölésre cseréltük.

**Amit NEKED (a repó tulajdonosának) még el kell végezned — enélkül a
foglalás-értesítő e-mailek NÉMÁN leállnak:**
1. Nyisd meg a Supabase Dashboardot → a projekt → Edge Functions →
   Secrets (vagy CLI-vel: `supabase secrets set BOOKING_WEBHOOK_SECRET=<új érték> --project-ref yctezzkwrzncgsvzhbjk`).
2. Állítsd be a `BOOKING_WEBHOOK_SECRET` új értékét — az adatbázis oldalon
   már ez az érvényes érték, ezt a chatben adtam meg neked.
3. (Opcionális, csak nyilvántartás célból) A GitGuardian/GitHub felületén
   jelöld megoldottnak/rotáltnak a talált incidenst.

**Miért nem írtuk át emiatt is a teljes git történetet:** a régi, immár
rotált (érvénytelen) érték továbbra is ott marad a korábbi commit(ok)
tartalmában — ez már önmagában nem biztonsági kockázat (a titok
haszontalanná vált), csak "kozmetikai" nyom. Egy újabb `filter-branch`
alapú történet-átírás pontosan ugyanazokat a szinkronizációs
bonyodalmakat okozná a kolléganőd helyi repójával, mint a korábbi
contributor-átírás — ezért ezt nem végeztük el automatikusan. Szólj, ha
mégis szeretnéd, hogy elvégezzük.

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

## Biztonsági javítások (2026-09-28, Security Advisor)

A Supabase Security Advisor 7 ERROR-szintű találatot jelzett a `my_bookings`,
`my_passengers`, `my_listings`, `my_vehicles`, `ride_details` view-kre
(`auth_users_exposed` + `security_definer_view`). Ezeket a
`20260928103526_fix_security_advisor_findings_email_and_view_invoker.sql`
migráció javítja:

- **`auth_users_exposed` (my_bookings, my_passengers) — teljesen javítva.**
  A két view eddig közvetlenül JOIN-olta az `auth.users` táblát a
  másik fél (sofőr/utas) e-mail címének megjelenítéséhez. Mostantól az
  e-mail címet a `public.profiles` táblában tartjuk karban (egy új,
  `auth.users`-t figyelő trigger szinkronizálja), a view-k pedig már csak
  a `profiles` táblát kérdezik le — `auth.users`-t egyáltalán nem érintik.
- **`security_definer_view` (my_listings, my_vehicles) — teljesen javítva.**
  Mindkét view saját WHERE-feltétellel amúgy is a saját sorra (`auth.uid()`)
  szűkíti a találatot, ugyanúgy, ahogy az alattuk lévő táblák RLS-szabálya
  is tenné — a `security_invoker = true` bekapcsolása tisztán szigorítás,
  viselkedésbeli változás nélkül.
- **`security_definer_view` (ride_details, my_bookings, my_passengers) —
  SZÁNDÉKOSAN változatlan marad.** Ez a három view csak SECURITY DEFINER
  módban tud működni a jelenlegi tervezés mellett:
  - `ride_details` az egész nyilvános kereséshez/útrészletekhez kell, hogy
    MINDENKI hirdetését megmutassa (nem csak a sajátunkat), miközben a
    `listings` tábla RLS-szabálya kifejezetten csak a saját hirdetésre ad
    hozzáférést — plusz a view sor szintjén (nem csak táblaszinten) rejti
    el a `driver_full_name`/`car_plate` mezőket, amit RLS önmagában nem
    tud megoldani (RLS csak sor-, nem oszlopszintű). A definer-mód
    levétele vagy a keresés törne el (mindenki csak a saját hirdetését
    látná), vagy a `listings` táblát kellene RLS-szinten teljesen
    nyilvánossá tenni — de az utóbbi megkerülné a gondosan implementált
    adatvédelmi rejtést (bárki közvetlenül, a `/rest/v1/listings`
    végponton át is látná a sofőr teljes nevét és rendszámát, foglalás
    nélkül is).
  - `my_bookings`/`my_passengers` a MÁSIK fél (sofőr, illetve utas)
    `profiles` sorát is le kell, hogy kérdezze (telefon, e-mail a
    kapcsolatfelvételhez) — ez csak úgy lehetséges invoker-módban, ha a
    `profiles` táblán egy új, "van-e köztünk aktív foglalási kapcsolat"
    logikájú RLS-szabályt vezetünk be. Ez megvalósítható, de önmagában is
    egy nagyobb, alaposan átgondolandó/tesztelendő változás (rosszul
    megírt szabály könnyen vagy túl szűkre, vagy — rosszabb esetben — túl
    tágra nyithatná a profil-hozzáférést), ezért ezt szándékosan nem
    végeztük el ebben a körben.

**Külön, ennél komolyabb, egyelőre NYITVA hagyott találat:**
`public.email_for_username(p_username)` — ezt a `signInWithIdentifier`
(felhasználónévvel történő bejelentkezés, `src/lib/api.ts`) hívja, ezért
muszáj `anon` (be nem jelentkezett) szerepkörből is hívhatónak lennie. A
függvény viszont a megadott felhasználónévhez tartozó **valódi e-mail
címet adja vissza bárkinek, jelszó/bejelentkezés nélkül** — ez egy
felhasználónév → e-mail cím "oráklum", amivel névsorolással (username
enumeration) tömegesen gyűjthetők ki valós e-mail címek. Ennek rendes
javítása architekturális változás: a bejelentkezés username-feloldó
lépését egy szerver oldali (Edge Function) folyamatba kellene költöztetni,
ami a feloldott e-mail címet sosem küldi vissza a böngészőnek, csak a
kész munkamenetet (session token-t). Ezt nem végeztük el automatikusan,
mert a kliens oldali bejelentkezési folyamat átírását igényli — szólj, ha
szeretnéd, hogy ezt is megcsináljuk.

**Egyéb, WARN-szintű, változatlanul hagyott találatok** (megtekinthetők a
Supabase Dashboard → Advisors alatt): a `book_ride`, `cancel_booking`,
`cancel_listing`, `create_listing`, `remove_vehicle`,
`request_destination_photo_reheal`, `update_booking`, `update_listing`,
`update_vehicle`, `count_new_passengers`, `mark_passengers_viewed`
függvények mind szándékosan SECURITY DEFINER + `authenticated`-hívhatók —
ezek az app RPC-alapú írási API-ja, ez a tervezett működésük. A `pg_net`
extension `public` sémában futása és az Auth "leaked password protection"
kikapcsolt állapota alacsony prioritású, opcionális Dashboard-beállítások,
ezeket sem érintettük.
