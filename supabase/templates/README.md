# Supabase Auth e-mail-sablonok (BUG-17)

A regisztráció-megerősítő és a többi Supabase Auth levél eddig a Supabase angol
alapsablonjával és „Supabase Auth” feladóval ment ki (spec 4.15: minden
rendszerlevél magyar és Telekocsi-azonosítású).

## 1. Sablonok beállítása (Supabase Dashboard)

Authentication → **Emails** → *Templates* fül. Minden sablonnál a **Subject**
mezőbe a lenti tárgyat, a **Message body** (Source) mezőbe a fájl teljes
tartalmát másold be, majd **Save**.

| Sablon | Tárgy (Subject) | Fájl |
|---|---|---|
| Confirm signup | Telekocsi – erősítsd meg az e-mail címedet | `confirmation.html` |
| Reset password | Telekocsi – új jelszó beállítása | `recovery.html` |
| Change email address | Telekocsi – erősítsd meg az új e-mail címedet | `email_change.html` |
| Magic link | Telekocsi – bejelentkezési link | `magic_link.html` |

## 2. Feladó és levélkorlát — egyéni SMTP (erősen ajánlott)

Authentication → **Emails** → *SMTP Settings* → **Enable custom SMTP**.
A meglévő Mailgun-fiók SMTP-adataival:

- Sender email: `postmaster@<MAILGUN_DOMAIN>` (vagy saját domainen `noreply@…`)
- Sender name: `Telekocsi`
- Host: `smtp.mailgun.org`, Port: `587`
- Username / Password: a Mailgun domain SMTP-hitelesítő adatai

Egyéni SMTP nélkül a feladó továbbra is „Supabase Auth <noreply@mail.app.supabase.io>”
marad, és a beépített küldő óránként csak néhány levelet enged (a 2026-09-30-i
tesztfutás során ez blokkolta a regisztrációt). Mailgun sandbox-domainnél csak a
jóváhagyott címzettek kapnak levelet — éleshez saját, ellenőrzött domain kell.

Egyéni SMTP után érdemes az Authentication → *Rate Limits* alatt az
„emails per hour” értéket a forgalomhoz igazítani.
