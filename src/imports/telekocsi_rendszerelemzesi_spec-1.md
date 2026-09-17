# Telekocsi szolgáltatás — rendszerelemzési specifikáció

*Az eredeti specifikáció áttekintése és kiegészítése egy strukturált interjú alapján. Dátum: 2026-09-14. (v4 — végleges, minden nyitott kérdés lezárva.)*

## 1. Áttekintés

A rendszer célja, hogy sofőrök és utasok egymásra találjanak konkrét utakon. Regisztrált felhasználók járművet adhatnak hozzá a fiókjukhoz; akinek van regisztrált járműve, hirdetést hozhat létre egy útra, amire más felhasználók helyet foglalhatnak. A fizetés a rendszeren kívül, készpénzben történik — a rendszer csak megjeleníti az árat.

## 2. Adatmodell

### 2.1 Felhasználó

| Mező | Megjegyzés |
|---|---|
| Felhasználó azonosító (PK) | |
| Név | |
| Felhasználónév | Egyedi, kötelező; bejelentkezéshez is használható |
| E-mail cím | Egyedi; bejelentkezéshez is használható; megerősítő linkkel igazolandó regisztrációkor |
| Jelszó | Titkosítva (hash-elve) tárolandó — lásd 5. pont |
| Regisztráció időpontja | |
| Telefonszám | Csak foglalás után válik láthatóvá a másik fél számára |
| E-mail megerősítve | Igen/nem |
| Adatkezelési hozzájárulás | Igen/nem + elfogadás időpontja — kötelező jelölőnégyzet regisztrációkor (lásd 4.6) |

*Bejelentkezéskor mind a felhasználónév, mind az e-mail cím elfogadott azonosító — mindkettő egyedi a rendszerben.*

### 2.2 Jármű

| Mező | Megjegyzés |
|---|---|
| Jármű azonosító (PK) | Új mező — az eredeti specifikációból hiányzott |
| Felhasználó azonosító (FK) | Tulajdonos |
| Jármű típus | |
| Max férőhely | Az utasok maximális száma — a sofőr helye **nem** számít bele |
| Rendszám | Csak azok az utasok láthatják, akik ténylegesen foglaltak az adott útra |

Egy felhasználóhoz több jármű is tartozhat.

### 2.3 Hirdetés

| Mező | Megjegyzés |
|---|---|
| Hirdetés azonosító (PK) | |
| Felhasználó azonosító (FK) | Sofőr |
| Jármű azonosító (FK) | A hirdetéshez tartozó, a hirdetőhöz tartozó jármű |
| Induló állomás | |
| Célállomás | |
| Dátum és időpont | |
| Ár | Egy főre (egy lefoglalt helyre) vonatkozik |
| Szabad helyek száma | Létrehozáskor alapértelmezetten a jármű max férőhelyét veszi fel; a sofőr csökkentheti, de nem lépheti fölé. Utólag is módosítható — lásd 4.11 |
| Állapot | Aktív / törölve |

### 2.4 Foglalás

| Mező | Megjegyzés |
|---|---|
| Foglalás azonosító (PK) | |
| Hirdetés azonosító (FK) | |
| Felhasználó azonosító (FK) | Utas |
| Foglalt helyek száma | Egy felhasználó több helyre is jelentkezhet egyszerre |
| Állapot | Aktív / lemondva |
| Foglalás időpontja | |

## 3. Fő folyamat

1. Felhasználó regisztrál (név, felhasználónév, e-mail, jelszó, telefonszám) → e-mail megerősítés → adatkezelési hozzájárulás elfogadása.
2. Felhasználó jármű(veke)t ad hozzá a fiókjához.
3. Regisztrált járművel rendelkező felhasználó hirdetést hoz létre egy útra, jármű kiválasztásával; a szabad helyek száma alapból a jármű max férőhelye, amit csökkenthet.
4. Más felhasználók keresnek/böngésznek a hirdetések listájában, és helyet foglalnak.
5. Foglalás automatikusan, jóváhagyás nélkül létrejön, amíg van szabad hely.
6. Foglalás után mindkét fél megkapja a másik kontaktadatait (telefonszám) e-mailben; az utas ekkor látja a rendszámot is.
7. A sofőr utólag módosíthatja a hirdetés adatait (pl. árat) — minden módosításról e-mail értesítést kapnak azok az utasok, akiknek aktív foglalása van az adott hirdetésen. A szabad helyek számát csak a már lefoglalt helyek számáig csökkentheti.
8. Indulás előtt bármelyik fél lemondhatja a részvételét, vagy a sofőr törölheti a teljes hirdetést — mindkét esetben automatikus e-mail értesítést kap az érintett másik fél (utasi lemondásnál a sofőr, hirdetés-törlésnél az összes foglalt utas), és a lefoglalt helyek felszabadulnak.

## 4. Üzleti szabályok

- **4.1 Kapacitás:** egy hirdetésre foglalt helyek összesített száma nem haladhatja meg a hirdetésen megadott szabad helyek számát, ami nem lépheti túl a jármű max férőhelyét (az utasok maximális számát, a sofőr nélkül).
- **4.2 Alapértelmezett szabad helyek száma:** hirdetés létrehozásakor a rendszer felajánlja a jármű max férőhelyét; a sofőr ezt csökkentheti, ha kevesebb helyet szeretne meghirdetni.
- **4.3 Automatikus foglalás:** nincs sofőri jóváhagyási lépés — a foglalás azonnal létrejön, amíg van hely.
- **4.4 Saját hirdetésre foglalás tiltása:** a sofőr nem foglalhat helyet a saját hirdetésére utasként.
- **4.5 Lemondás — utas:** az utas indulás előtt lemondhatja a foglalását; ekkor a lefoglalt hely automatikusan felszabadul, és a sofőr e-mail értesítést kap.
- **4.6 Adatkezelési hozzájárulás:** regisztrációkor kötelező jelölőnégyzettel el kell fogadni, hogy foglalás esetén a kontaktadatok (telefonszám, e-mail) automatikusan átadásra kerülnek a másik félnek.
- **4.7 Rendszám láthatósága:** a jármű rendszáma csak azok számára jelenik meg, akik ténylegesen foglaltak az adott útra.
- **4.8 Keresés/lista:** a hirdetéslista alapértelmezetten utazási időpont szerint növekvő sorrendben jelenik meg, a múltbeli utazások nélkül. Szűrhető: induló hely, célállomás, időszak (kezdő és végső nap), szabad helyek száma szerint.
- **4.9 Fizetés:** a rendszeren kívül, készpénzben történik — nincs online fizetési integráció.
- **4.10 Bejelentkezés:** felhasználónévvel vagy e-mail címmel egyaránt lehetséges; mindkettő egyedi azonosítóként szolgál a rendszerben.
- **4.11 Hirdetés szerkesztése:** a sofőr a létrehozás után is módosíthatja a hirdetés adatait (pl. ár, szabad helyek száma). A szabad helyek száma **nem csökkenthető** a már lefoglalt helyek száma alá — ha a sofőr ennél kevesebb helyet szeretne meghirdetni, törölnie kell a hirdetést, és újat kell létrehoznia. **Minden módosításról** automatikus e-mail értesítést kapnak azok az utasok, akiknek aktív foglalása van az adott hirdetésen.
- **4.12 Lemondás — sofőr (hirdetés törlése):** ha a sofőr törli a hirdetést, minden addig foglalt utasnak automatikusan felszabadul a helye, és e-mail értesítést kapnak — megerősített szabály, szimmetrikus a 4.5 ponttal.

## 5. Biztonsági és minőségi javaslatok (rendszerelemzői ajánlás, nem külön megkérdezett pont)

- A jelszavakat soha nem szabad nyílt szövegként tárolni — erős hash-algoritmus (pl. bcrypt vagy argon2) szükséges.
- Mivel a rendszer automatikusan oszt meg személyes adatot (telefonszám), érdemes sebességkorlátozást (rate limiting) és visszaélés-jelentési lehetőséget tervezni a spam/zaklatás elkerülésére — ez jelenleg nincs a specifikációban.

## 6. Későbbi fázisra tervezett funkciók (MVP-n kívül, tudatos döntés alapján)

- **Értékelési / megbízhatósági rendszer** (pl. csillagos értékelés út után) — később fejlesztendő.
- **Adminisztráció / moderáció** (visszaélésszerű hirdetések eltávolítása, felhasználók tiltása) — később fejlesztendő.

---
*Készült rendszerelemzési interjú alapján. Minden korábban nyitott kérdés lezárva — a specifikáció fejlesztésre kész.*
