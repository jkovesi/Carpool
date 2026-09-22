// Közös rendezési segédfüggvények a Foglalásaim / Hirdetéseim / Utasaim
// listákhoz (2. kör, 8-10. pont). Minden lista ugyanazt a mintát követi:
// egy "Aktív" blokk felül (az utazás időpontja szerint növekvő sorrendben),
// alatta egy összevont "korábbi" blokk (Lemondva / Lejárt / Törölt vegyesen,
// az utazás időpontja szerint csökkenő sorrendben) — soronként saját
// státusz-címkével, vizuális csoport-fejlécek nélkül.

function rideKey(rideDate: string, rideTime: string): string {
  return `${rideDate}T${(rideTime ?? "").slice(0, 8)}`;
}

// Aktív blokk: utazás időpontja szerint növekvő.
export function compareRideAsc(a: { ride_date: string; ride_time: string }, b: { ride_date: string; ride_time: string }): number {
  return rideKey(a.ride_date, a.ride_time).localeCompare(rideKey(b.ride_date, b.ride_time));
}

// Korábbi (összevont) blokk: utazás időpontja szerint csökkenő.
export function compareRideDesc(a: { ride_date: string; ride_time: string }, b: { ride_date: string; ride_time: string }): number {
  return rideKey(b.ride_date, b.ride_time).localeCompare(rideKey(a.ride_date, a.ride_time));
}

// Utasaim: elsődlegesen az utazás időpontja szerint (irány a hívótól függ),
// másodlagosan — ugyanazon a hirdetésen belül — a foglalás/módosítás
// időpontja (created_at) szerint CSÖKKENŐ sorrendben, mind az aktív, mind az
// összevont korábbi blokkban.
export function compareByRideThenCreatedDesc<
  T extends { listing_id: string; ride_date: string; ride_time: string; created_at: string },
>(direction: "asc" | "desc") {
  return (a: T, b: T): number => {
    const rideCmp = direction === "asc" ? compareRideAsc(a, b) : compareRideDesc(a, b);
    if (rideCmp !== 0) return rideCmp;
    if (a.listing_id === b.listing_id) {
      return b.created_at.localeCompare(a.created_at);
    }
    return 0;
  };
}
