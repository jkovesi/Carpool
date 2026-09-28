// Supabase Edge Function: search-destination-photo
//
// A v10-es "Célállomás-fotó AI-alapú kiválasztása és cache-elése" funkció
// (KAN-39, spec 4.26/2.5) háttérmunkása. Kizárólag a Postgres oldalról
// hívódik:
//  - trigger_search_destination_photo() (AFTER INSERT ON listings): új
//    célállomásnál, illetve amíg nincs "ready" (Kész) találat, a mentést
//    nem lassítva, a háttérben.
//  - request_destination_photo_reheal(p_destination) RPC: ha a kliens egy
//    már cache-elt kép betöltésekor törött linket észlel (self-heal),
//    force=true-val, állapottól függetlenül újrakeresést kényszerítve.
//
// A hívást egy megosztott titok (X-Webhook-Secret fejléc) védi, ugyanúgy,
// mint a notify-booking funkciónál — ez a funkció sem JWT-alapú
// felhasználói hívásra van szánva.
//
// FONTOS ELHATÁROLÁS: ez a funkció NEM a korábbi (kivezetett)
// CURATED_BY_DESTINATION / FALLBACK_POOL / RideIllustration mechanizmust
// folytatja — azokat a fejlesztésből teljesen kihagytuk. Az AI-keresés
// melletti egyetlen tartalékmegoldás a kliens oldali statikus
// src/assets/ride-placeholder.jpg, amit ez a funkció nem is érint.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const UNSPLASH_SEARCH_URL = "https://api.unsplash.com/search/photos";

// Cél: a felület mindkét megjelenési helyén (hirdetés-kártya, útrészletező
// fejléc) panorámaszerűen széles dobozba illeszkedő fotó — lásd 4.26.
const PREFERRED_MIN_RATIO = 1.8;
const PREFERRED_MAX_RATIO = 3.0;
// Megkötés lazítva: kevésbé szélsőségesen fekvő, de még mindig nem álló kép.
const RELAXED_MIN_RATIO = 1.3;

// A célállomás-fotón nem jelenhet meg felismerhetően ember — lásd 4.26.
// Az Unsplash keresés-API nem ad emberfelismerést/tartalom-kategóriát
// önmagában, ezért a fotóhoz tartozó (angol nyelvű, gépi és/vagy emberi
// úton generált) alt_description/description szöveget vizsgáljuk kulcsszó
// szinten — ez nem tökéletes (kép alapú) személydetektálás, csak egy
// legjobb-erőfeszítés szűrő a leírásból kiolvasható emberi jelenlétre.
const PERSON_KEYWORDS = [
  "person",
  "people",
  "man",
  "men",
  "woman",
  "women",
  "boy",
  "boys",
  "girl",
  "girls",
  "child",
  "children",
  "kid",
  "kids",
  "human",
  "humans",
  "face",
  "faces",
  "portrait",
  "crowd",
  "tourist",
  "tourists",
  "pedestrian",
  "pedestrians",
  "couple",
  "couples",
  "family",
  "families",
  "selfie",
  "model",
  "models",
  "guy",
  "guys",
  "lady",
  "ladies",
  "friend",
  "friends",
  "baby",
  "babies",
  "toddler",
  "toddlers",
];

type UnsplashPhoto = {
  id: string;
  width: number;
  height: number;
  urls: { raw: string };
  alt_description?: string | null;
  description?: string | null;
};

function mentionsPeople(photo: UnsplashPhoto): boolean {
  const text = `${photo.alt_description ?? ""} ${photo.description ?? ""}`.toLowerCase();
  if (!text.trim()) return false;
  return PERSON_KEYWORDS.some((word) => new RegExp(`\\b${word}\\b`).test(text));
}

function pickBestCandidate(photos: UnsplashPhoto[]): UnsplashPhoto | null {
  // Elsőként kiszűrjük azokat a találatokat, amelyek leírása felismerhető
  // emberi jelenlétre utal — csak az így megmaradt jelöltek közül
  // választunk tájolás/arány szerint.
  const withoutPeople = photos.filter((p) => !mentionsPeople(p));

  const withRatio = withoutPeople
    .filter((p) => p.width > 0 && p.height > 0)
    .map((p) => ({ photo: p, ratio: p.width / p.height }));

  // FONTOS: az Unsplash a keresési találatokat alapértelmezetten relevancia
  // szerint rendezve adja vissza, és ezt a sorrendet itt szándékosan
  // megőrizzük (a .filter() nem változtat a sorrenden) — a tájolás/arány
  // csak egy elfogadhatósági szűrő (sávba esik-e), NEM egy újrarendezési
  // szempont. Korábban a sávon belüli találatokat a preferált arányhoz
  // (2,4:1) való közelség szerint rendeztük újra, ami felülírhatta az
  // Unsplash relevancia-sorrendjét, és egy kevésbé releváns, de "ideálisabb"
  // arányú fotót részesített előnyben egy jobban releváns, de kicsit
  // szélesebb/keskenyebb aránnyal rendelkező fotóval szemben. A helyes
  // viselkedés: a sávon belüli, legrelevánsabb (legelső) találatot választjuk.
  const preferred = withRatio.filter(
    (p) => p.ratio >= PREFERRED_MIN_RATIO && p.ratio <= PREFERRED_MAX_RATIO,
  );
  if (preferred.length > 0) {
    return preferred[0].photo;
  }

  const relaxed = withRatio.filter((p) => p.ratio >= RELAXED_MIN_RATIO);
  if (relaxed.length > 0) {
    return relaxed[0].photo;
  }

  return null;
}

async function searchUnsplash(accessKey: string, query: string, orientation: "landscape" | null): Promise<UnsplashPhoto[]> {
  const url = new URL(UNSPLASH_SEARCH_URL);
  url.searchParams.set("query", query);
  // A korábbi 10 helyett 20 találatot kérünk le, hogy az ember-tartalmú
  // fotók kiszűrése után is maradjon elég jelölt a tájolás/arány szerinti
  // válogatáshoz.
  url.searchParams.set("per_page", "20");
  url.searchParams.set("content_filter", "high");
  if (orientation) url.searchParams.set("orientation", orientation);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Client-ID ${accessKey}`,
      "Accept-Version": "v1",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Unsplash hiba (${res.status}): ${text}`);
  }

  const json = await res.json();
  return Array.isArray(json.results) ? json.results : [];
}

function buildImageUrl(photo: UnsplashPhoto): string {
  // Az Unsplash dinamikus kép-API-ja szerver oldalon vágja (soha nem
  // nyújtja) a képet a megadott dobozra — a kliens oldali CSS object-cover
  // ezt tovább finomítja a konkrét doboz méretéhez (Home kártya vs.
  // RideDetail fejléc), ugyanúgy, mint a korábbi kurált megoldásnál.
  return `${photo.urls.raw}&w=1600&h=700&fit=crop&crop=entropy&auto=format&q=80`;
}

Deno.serve(async (req: Request) => {
  try {
    const expectedSecret = Deno.env.get("DESTINATION_PHOTO_WEBHOOK_SECRET");
    const gotSecret = req.headers.get("x-webhook-secret");
    if (!expectedSecret || gotSecret !== expectedSecret) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const destination: string | undefined = typeof body.destination === "string" ? body.destination.trim().toLowerCase() : undefined;
    const force = body.force === true;

    if (!destination) {
      return new Response("Missing destination", { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (!force) {
      const { data: existing } = await supabase
        .from("destination_photo_cache")
        .select("status, image_url")
        .eq("destination", destination)
        .maybeSingle();
      if (existing?.status === "ready" && existing.image_url) {
        // Már van kész találat, és nem önjavítás — nem indítunk újabb keresést.
        return new Response(JSON.stringify({ ok: true, destination, status: "ready", skipped: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const accessKey = Deno.env.get("UNSPLASH_ACCESS_KEY");
    if (!accessKey) {
      // Nincs beállítva a kulcs — a sort szándékosan "pending" állapotban
      // hagyjuk (nem "failed"-re állítjuk), hogy a kulcs pótlása után egy
      // önjavítás-kérés vagy egy backfill-lekérdezés simán újra megpróbálja,
      // anélkül hogy külön reset kellene.
      console.error("search-destination-photo: hiányzó UNSPLASH_ACCESS_KEY Edge Function secret.");
      return new Response(JSON.stringify({ ok: false, destination, reason: "missing_unsplash_key" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    let candidate: UnsplashPhoto | null = null;
    try {
      const landscapeResults = await searchUnsplash(accessKey, destination, "landscape");
      candidate = pickBestCandidate(landscapeResults);

      if (!candidate) {
        // Megkötés lazítása: szélesebb keresés, tájolási szűrő nélkül.
        // Az ember nélküli szűrés (pickBestCandidate) itt is érvényes.
        const broadResults = await searchUnsplash(accessKey, destination, null);
        candidate = pickBestCandidate(broadResults);
      }
    } catch (searchErr) {
      console.error("search-destination-photo: Unsplash keresési hiba:", searchErr);
      candidate = null;
    }

    if (!candidate) {
      await supabase
        .from("destination_photo_cache")
        .update({ status: "failed", image_url: null, source: "ai-search (unsplash)", updated_at: new Date().toISOString() })
        .eq("destination", destination);
      return new Response(JSON.stringify({ ok: true, destination, status: "failed" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const imageUrl = buildImageUrl(candidate);
    await supabase
      .from("destination_photo_cache")
      .update({ status: "ready", image_url: imageUrl, source: "ai-search (unsplash)", updated_at: new Date().toISOString() })
      .eq("destination", destination);

    return new Response(JSON.stringify({ ok: true, destination, status: "ready", image_url: imageUrl }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("search-destination-photo error:", err);
    // Sosem dobjunk 5xx-et a hívónak (pg_net trigger vagy a reheal RPC) —
    // ez fire-and-forget, egy hibás keresés soha nem hiúsíthatja meg magát
    // a hirdetés mentését.
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
