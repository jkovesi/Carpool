import { useEffect, useState } from "react";
import { Page } from "../types";
import { RideDetails, cancelListing, listMyListings } from "../lib/api";
import placeholderImg from "../assets/ride-placeholder.jpg";

interface MyListingsProps {
  navigate: (page: Page) => void;
  goBack: () => void;
  selectListingToEdit: (id: string) => void;
  selectListingToPassengers: (id: string) => void;
}

export default function MyListings({ navigate, selectListingToEdit, selectListingToPassengers }: MyListingsProps) {
  const [listings, setListings] = useState<RideDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = () => {
    setLoading(true);
    listMyListings()
      .then(setListings)
      .catch((err) => setError(err instanceof Error ? err.message : "Hiba történt a hirdetések betöltése során."))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const cancel = async (id: string) => {
    setError("");
    try {
      await cancelListing(id);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba történt a hirdetés törlése során.");
    }
  };

  const active = listings.filter((l) => l.status === "active");
  const past = listings.filter((l) => l.status === "cancelled");

  return (
    <div className="min-h-screen bg-[#F7F7F7] py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-[#222222]">Hirdetéseim</h1>
            <p className="text-sm text-[#717171] mt-1">{loading ? "Betöltés…" : `${active.length} aktív hirdetés`}</p>
          </div>
          <button
            onClick={() => navigate("create-listing")}
            className="bg-[#FF385C] hover:bg-[#E31C5F] text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors"
          >
            + Új hirdetés
          </button>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <span className="text-sm text-red-700 font-medium">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="text-center text-sm text-[#717171] py-10">Betöltés…</div>
        ) : (
          <>
            {/* Active */}
            {active.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-bold text-[#222222] uppercase tracking-wider mb-3">Aktív</h2>
                <div className="space-y-3">
                  {active.map((l) => (
                    <div key={l.id} className="bg-white rounded-2xl border border-[#DDDDDD] p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-3 flex-1">
                          <img
                            src={placeholderImg}
                            alt=""
                            className="w-14 h-14 rounded-xl object-cover flex-shrink-0 bg-[#F7F7F7]"
                          />
                          <div className="flex-1">
                            <div className="font-bold text-[#222222] text-base">{l.from_city} → {l.to_city}</div>
                            <div className="text-sm text-[#717171] mt-1">{l.ride_date} · {l.ride_time?.slice(0, 5)}</div>
                            <div className="flex items-center gap-4 mt-3">
                              <div className="text-sm">
                                <span className="font-bold text-[#222222]">{l.price_huf.toLocaleString()} Ft</span>
                                <span className="text-[#717171]"> / fő</span>
                              </div>
                              <div className="text-sm">
                                <span className="font-bold text-[#222222]">{l.seats_booked}/{l.seats_total}</span>
                                <span className="text-[#717171]"> hely foglalt</span>
                              </div>
                            </div>
                            {/* Occupancy bar */}
                            <div className="mt-3 h-1.5 bg-[#F0F0F0] rounded-full overflow-hidden w-48">
                              <div
                                className="h-full bg-[#FF385C] rounded-full transition-all"
                                style={{ width: `${(l.seats_booked / l.seats_total) * 100}%` }}
                              />
                            </div>
                            {l.seats_booked > 0 && (
                              <button
                                onClick={() => selectListingToPassengers(l.id)}
                                className="text-xs font-semibold text-[#FF385C] mt-3 hover:underline"
                              >
                                Utasaim megtekintése →
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => selectListingToEdit(l.id)}
                            className="text-sm font-semibold border border-[#DDDDDD] text-[#222222] px-3 py-2 rounded-xl hover:bg-[#F7F7F7] transition-colors whitespace-nowrap"
                          >
                            Szerkesztés
                          </button>
                          <button
                            onClick={() => cancel(l.id)}
                            className="text-sm font-semibold border border-red-200 text-red-500 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors whitespace-nowrap"
                          >
                            Törlés
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {active.length === 0 && (
              <div className="bg-white rounded-2xl border border-[#DDDDDD] p-10 text-center mb-8">
                <div className="text-4xl mb-3">📋</div>
                <div className="font-semibold text-[#222222]">Nincs aktív hirdetésed</div>
                <div className="text-sm text-[#717171] mt-1 mb-4">Hirdess meg egy utat és találj utasokat</div>
                <button
                  onClick={() => navigate("create-listing")}
                  className="bg-[#FF385C] hover:bg-[#E31C5F] text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
                >
                  + Új hirdetés feladása
                </button>
              </div>
            )}

            {/* Past */}
            {past.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-[#717171] uppercase tracking-wider mb-3">Törölt / lezárt</h2>
                <div className="space-y-3">
                  {past.map((l) => (
                    <div key={l.id} className="bg-white rounded-2xl border border-[#DDDDDD] p-5 opacity-60">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-[#222222]">{l.from_city} → {l.to_city}</div>
                          <div className="text-sm text-[#717171] mt-1">{l.ride_date} · {l.ride_time?.slice(0, 5)}</div>
                          <div className="text-sm text-[#717171] mt-1">{l.price_huf.toLocaleString()} Ft / fő · {l.seats_booked} foglalás volt</div>
                        </div>
                        <span className="text-xs font-semibold bg-[#F0F0F0] text-[#717171] px-3 py-1 rounded-full">Törölve</span>
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
