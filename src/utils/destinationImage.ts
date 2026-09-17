/**
 * Célállomáshoz köthető háttérkép kiválasztása.
 *
 * Ez a modul egyetlen belépési pontot ad (`getDestinationImageUrl`) a hirdetés-kártyák
 * és az útrészletező oldal háttérképeihez. Jelenleg egy kurált település -> fotó
 * hozzárendelést használ, ismeretlen célállomásra pedig egy determinisztikus (a
 * célállomás nevéből számolt) tartalék-választást, hogy ugyanaz a célállomás mindig
 * ugyanazt a képet kapja.
 *
 * "AI funkcióval megtámogatva": ha később egy kép-kereső / kép-generáló API-t (pl. egy
 * Supabase Edge Function mögött) szeretnénk bekötni, elég ezt a függvényt lecserélni —
 * a hívó oldalak (Home, RideDetail) nem tudnak róla, hogy a kép honnan származik.
 */

const CURATED_BY_DESTINATION: Record<string, string> = {
  debrecen: "photo-1590247813693-5541d1c609fd",
  pécs: "photo-1592906209472-a36b1f3782ef",
  győr: "photo-1523712999610-f77fbcfc3843",
  miskolc: "photo-1486325212027-8081e485255e",
  budapest: "photo-1541849546-216549ae216d",
  szeged: "photo-1477959858617-67f85cf4f1df",
  székesfehérvár: "photo-1449824913935-59a10b8d2000",
  sopron: "photo-1500534623283-312aade485b7",
};

// Tartalék fotó-készlet ismeretlen célállomásokhoz — ugyanaz a szöveg mindig ugyanazt
// a képet kapja (egyszerű string-hash alapján), így a kártya nem "ugrál" újrarenderkor.
const FALLBACK_POOL = [
  "photo-1516571748831-5d81767b788d",
  "photo-1508444845599-5c89863b1c44",
  "photo-1519501025264-65ba15a82390",
  "photo-1502786129293-79981df4e689",
  "photo-1520175480921-4edfa2983e0f",
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getDestinationPhotoId(destination: string): string {
  const key = destination.trim().toLowerCase();
  if (CURATED_BY_DESTINATION[key]) return CURATED_BY_DESTINATION[key];
  return FALLBACK_POOL[hashString(key) % FALLBACK_POOL.length];
}

export function getDestinationImageUrl(
  destination: string,
  opts: { w?: number; h?: number } = {},
): string {
  const { w = 600, h = 350 } = opts;
  const photoId = getDestinationPhotoId(destination);
  return `https://images.unsplash.com/${photoId}?w=${w}&h=${h}&fit=crop&auto=format`;
}
