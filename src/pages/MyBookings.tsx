import { useEffect, useState } from "react";
import { Page } from "../types";
import { MyBooking, cancelBooking, listMyBookings } from "../lib/api";

interface MyBookingsProps {
  navigate: (page: Page) => void;
  goBack: () => void;
}

const STATUS_LABEL: Record<"cancelled" | "closed", string> = {
  cancelled: "Lemondva",
  closed: "Lezárt",
};

export default function MyBookings({ navigate }: MyBookingsProps) {
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = () => {
    setLoading(true);
    listMyBookings()
      .then(setBookings)
      .catch((err) => setError(err instanceof Error ? err.message : "Hiba történt a foglalások betöltése során."))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const cancel = async (bookingId: string) => {
    setError("");
    try {
      await cancelBooking(bookingId);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba történt a foglalás lemondása során.");
    }
  };

  const active = bookings.filter((b) => b.display_status === "active");
  const closedOrCancelled = bookings.filter((b) => b.display_status !== "active");

  return (
    <div className="min-h-screen bg-[#F7F7F7] py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-extrabold text-[#222222] mb-2">Foglalásaim</h1>
        <p className="text-sm text-[#717171] mb-8">{loading ? "Betöltés…" : `${active.length} aktív foglalás`}</p>

        {error && (
          <div className="mb-6 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <span className="text-sm text-red-700 font-medium">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="text-center text-sm text-[#717171] py-10">Betöltés…</div>
        ) : (
          <>
            {/* Active bookings */}
            {active.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-bold text-[#222222] uppercase tracking-wider mb-3">Aktív</h2>
                <div className="space-y-4">
                  {active.map((b) => (
                    <div key={b.booking_id} className="bg-white rounded-2xl border border-[#DDDDDD] overflow-hidden">
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="font-bold text-[#222222] text-base">{b.from_city} → {b.to_city}</div>
                            <div className="text-sm text-[#717171] mt-1">{b.ride_date} · {b.ride_time?.slice(0, 5)}</div>
                            <div className="text-sm text-[#717171] mt-1">
                              {b.seats_booked} hely · {(b.price_huf * b.seats_booked).toLocaleString()} Ft összesen
                            </div>
                          </div>
                          <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                            Megerősítve
                          </span>
                        </div>

                        {/* Driver / vehicle info */}
                        <div className="mt-4 bg-[#FFF0F2] rounded-xl p-4 border border-[#FFD6DC]">
                          <div className="text-xs font-bold text-[#FF385C] mb-2 uppercase tracking-wide">Sofőr</div>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-[#FF385C] rounded-full flex items-center justify-center text-white font-bold text-sm">
                              {b.driver_username.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-bold text-[#222222]">{b.driver_full_name ?? b.driver_username}</div>
                              <div className="text-xs text-[#717171]">@{b.driver_username}</div>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-[#FFD6DC] grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-xs font-bold text-[#FF385C] mb-1 uppercase tracking-wide">Jármű</div>
                              <div className="text-sm font-bold text-[#222222]">{b.car_type}{b.car_color ? ` · ${b.car_color}` : ""}</div>
                            </div>
                            <div>
                              <div className="text-xs font-bold text-[#FF385C] mb-1 uppercase tracking-wide">Rendszám</div>
                              <div className="text-sm font-bold text-[#222222]">{b.car_plate ?? "—"}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="px-5 pb-5">
                        <button
                          onClick={() => cancel(b.booking_id)}
                          className="w-full border border-red-200 text-red-500 font-semibold py-2.5 rounded-xl hover:bg-red-50 transition-colors text-sm"
                        >
                          Foglalás lemondása
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {active.length === 0 && (
              <div className="bg-white rounded-2xl border border-[#DDDDDD] p-10 text-center mb-8">
                <div className="text-4xl mb-3">🗓️</div>
                <div className="font-semibold text-[#222222]">Nincs aktív foglalásod</div>
                <div className="text-sm text-[#717171] mt-1 mb-4">Böngészd az elérhető utakat és foglalj helyet</div>
                <button
                  onClick={() => navigate("home")}
                  className="bg-[#FF385C] hover:bg-[#E31C5F] text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
                >
                  Utak böngészése
                </button>
              </div>
            )}

            {/* Past: lemondott vagy lezárt */}
            {closedOrCancelled.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-[#717171] uppercase tracking-wider mb-3">Lemondott / lezárt</h2>
                <div className="space-y-3">
                  {closedOrCancelled.map((b) => (
                    <div key={b.booking_id} className="bg-white rounded-2xl border border-[#DDDDDD] p-5 opacity-60">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-[#222222]">{b.from_city} → {b.to_city}</div>
                          <div className="text-sm text-[#717171] mt-1">{b.ride_date} · {b.ride_time?.slice(0, 5)}</div>
                          <div className="text-sm text-[#717171] mt-1">{b.seats_booked} hely · {b.driver_username}</div>
                        </div>
                        <span className="text-xs font-semibold bg-[#F0F0F0] text-[#717171] px-3 py-1 rounded-full whitespace-nowrap">
                          {STATUS_LABEL[b.display_status as "cancelled" | "closed"]}
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
