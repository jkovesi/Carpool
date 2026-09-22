import { useEffect, useState } from "react";
import { Page } from "../types";
import { Passenger, listMyPassengers, markPassengersViewed } from "../lib/api";
import { compareByRideThenCreatedDesc } from "../lib/sort";

interface MyPassengersProps {
  navigate: (page: Page) => void;
  goBack: () => void;
  backLabel?: string;
  listingId: string | null;
}

const STATUS_LABEL: Record<"active" | "cancelled" | "expired" | "removed", string> = {
  active: "Aktív",
  cancelled: "Lemondva",
  expired: "Lejárt",
  removed: "Törölt",
};

const compareActive = compareByRideThenCreatedDesc<Passenger>("asc");
const comparePast = compareByRideThenCreatedDesc<Passenger>("desc");

export default function MyPassengers({ goBack, backLabel, listingId }: MyPassengersProps) {
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    listMyPassengers(listingId ?? undefined)
      .then(setPassengers)
      .catch((err) => setError(err instanceof Error ? err.message : "Hiba történt az utasok betöltése során."))
      .finally(() => setLoading(false));
    // Megnyitáskor jelöljük megtekintettnek — a "friss" jelölés eltűnik, a navbar
    // jelvény pedig a következő navigáláskor frissül.
    markPassengersViewed().catch(() => {});
  }, [listingId]);

  const active = passengers.filter((p) => p.display_status === "active").sort(compareActive);
  // Lemondva + Lejárt + Törölt (a sofőr által) — egy összevont blokk, az
  // utazás időpontja szerint csökkenő sorrendben, azon belül (ugyanazon a
  // hirdetésen belül) a foglalás/módosítás időpontja szerint szintén
  // csökkenő sorrendben — ugyanaz a másodlagos rendezés, mint az aktívnál.
  const past = passengers
    .filter((p) => p.display_status !== "active")
    .sort(comparePast);

  // Csak akkor jelenjen meg a vissza gomb, ha egy konkrét hirdetés utasait
  // nézzük (a hirdetéseim listából érkeztünk). A globális "Utasaim" nézetnél
  // (pl. főoldali navigációból) nincs vissza gomb.
  const showBackButton = Boolean(listingId);

  return (
    <div className="min-h-screen bg-[#F7F7F7] py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {showBackButton && (
          <button
            onClick={goBack}
            className="flex items-center gap-2 text-sm text-[#717171] hover:text-[#222222] mb-6 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15,18 9,12 15,6"/></svg>
            {backLabel ?? "Vissza"}
          </button>
        )}

        <h1 className="text-2xl font-extrabold text-[#222222] mb-2">Utasaim</h1>
        <p className="text-sm text-[#717171] mb-8">
          {loading
            ? "Betöltés…"
            : listingId
              ? `${active.length} aktív foglalás ezen a hirdetésen`
              : `${active.length} aktív foglalás az összes hirdetéseden`}
        </p>

        {error && (
          <div className="mb-6 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <span className="text-sm text-red-700 font-medium">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="text-center text-sm text-[#717171] py-10">Betöltés…</div>
        ) : passengers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#DDDDDD] p-10 text-center">
            <div className="text-4xl mb-3">🧑‍🤝‍🧑</div>
            <div className="font-semibold text-[#222222]">Még nincs utasod</div>
            <div className="text-sm text-[#717171] mt-1">Amint valaki lefoglal egy helyet a hirdetéseden, itt fog megjelenni</div>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-bold text-[#222222] uppercase tracking-wider mb-3">Aktív</h2>
                <div className="space-y-3">
                  {active.map((p) => (
                    <div key={p.booking_id} className="bg-white rounded-2xl border border-[#DDDDDD] p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-9 h-9 bg-[#FF385C] rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {p.passenger_username.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-bold text-[#222222]">{p.passenger_full_name ?? p.passenger_username}</div>
                              {p.is_new && (
                                <span className="bg-[#FF385C] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                                  Új
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[#717171]">@{p.passenger_username}{p.passenger_phone ? ` · ${p.passenger_phone}` : ""}</div>
                            {p.passenger_email && (
                              <div className="text-xs text-[#717171]">{p.passenger_email}</div>
                            )}
                            {!listingId && (
                              <div className="text-sm text-[#717171] mt-1">{p.from_city} → {p.to_city} · {p.ride_date} · {p.ride_time?.slice(0, 5)}</div>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold text-[#222222]">{p.seats_booked} hely</div>
                          <span className="inline-block mt-1 bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                            {STATUS_LABEL[p.display_status]}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Korábbi: Lemondva + Lejárt + Törölt (a sofőr által)
                összevontan, az utazás időpontja szerint csökkenő, azon belül
                a foglalás/módosítás időpontja szerint szintén csökkenő
                sorrendben — soronként saját címkével. */}
            {past.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-[#717171] uppercase tracking-wider mb-3">Korábbi</h2>
                <div className="space-y-3">
                  {past.map((p) => (
                    <div key={p.booking_id} className="bg-white rounded-2xl border border-[#DDDDDD] p-5 opacity-60">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-[#222222]">{p.passenger_full_name ?? p.passenger_username}</div>
                          <div className="text-sm text-[#717171] mt-1">
                            {p.seats_booked} hely{!listingId ? ` · ${p.from_city} → ${p.to_city}` : ""}
                          </div>
                          {p.passenger_email && <div className="text-xs text-[#717171] mt-0.5">{p.passenger_email}</div>}
                        </div>
                        <span className="text-xs font-semibold bg-[#F0F0F0] text-[#717171] px-3 py-1 rounded-full whitespace-nowrap">
                          {STATUS_LABEL[p.display_status]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
