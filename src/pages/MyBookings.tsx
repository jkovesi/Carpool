import { useEffect, useState } from "react";
import { Page } from "../types";
import { MyBooking, cancelBooking, listMyBookings, updateBooking } from "../lib/api";
import ConfirmDialog from "../components/ConfirmDialog";

interface MyBookingsProps {
  navigate: (page: Page) => void;
  goBack: () => void;
  backLabel?: string;
}

const STATUS_LABEL: Record<"cancelled" | "expired", string> = {
  cancelled: "Lemondva",
  expired: "Lejárt",
};

type ConfirmState =
  | { type: "cancel"; booking: MyBooking }
  | { type: "update"; booking: MyBooking; seats: number }
  | null;

export default function MyBookings({ navigate, goBack, backLabel }: MyBookingsProps) {
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSeats, setEditSeats] = useState(1);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [working, setWorking] = useState(false);

  const refresh = () => {
    setLoading(true);
    listMyBookings()
      .then(setBookings)
      .catch((err) => setError(err instanceof Error ? err.message : "Hiba történt a foglalások betöltése során."))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const startEdit = (b: MyBooking) => {
    setError("");
    setEditingId(b.booking_id);
    setEditSeats(b.seats_booked);
  };

  const cancelEdit = () => setEditingId(null);

  const maxSeatsFor = (b: MyBooking) => b.seats_available + b.seats_booked;

  const requestSave = (b: MyBooking) => {
    if (editSeats === b.seats_booked) {
      setEditingId(null);
      return;
    }
    if (editSeats <= 0) {
      setConfirmState({ type: "cancel", booking: b });
    } else {
      setConfirmState({ type: "update", booking: b, seats: editSeats });
    }
  };

  const requestCancel = (b: MyBooking) => {
    setError("");
    setConfirmState({ type: "cancel", booking: b });
  };

  const runConfirm = async () => {
    if (!confirmState) return;
    setWorking(true);
    setError("");
    try {
      if (confirmState.type === "cancel") {
        await cancelBooking(confirmState.booking.booking_id);
      } else {
        await updateBooking(confirmState.booking.booking_id, confirmState.seats);
      }
      setConfirmState(null);
      setEditingId(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba történt a foglalás módosítása során.");
      setConfirmState(null);
    } finally {
      setWorking(false);
    }
  };

  const active = bookings.filter((b) => b.display_status === "active");
  const closedOrCancelled = bookings.filter((b) => b.display_status !== "active");

  return (
    <div className="min-h-screen bg-[#F7F7F7] py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-sm text-[#717171] hover:text-[#222222] mb-6 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15,18 9,12 15,6"/></svg>
          {backLabel ?? "Vissza"}
        </button>

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
                  {active.map((b) => {
                    const isEditing = editingId === b.booking_id;
                    const maxSeats = maxSeatsFor(b);
                    return (
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
                              {b.driver_phone && (
                                <div>
                                  <div className="text-xs font-bold text-[#FF385C] mb-1 uppercase tracking-wide">Telefon</div>
                                  <div className="text-sm font-bold text-[#222222]">{b.driver_phone}</div>
                                </div>
                              )}
                              {b.driver_email && (
                                <div>
                                  <div className="text-xs font-bold text-[#FF385C] mb-1 uppercase tracking-wide">E-mail</div>
                                  <div className="text-sm font-bold text-[#222222] break-all">{b.driver_email}</div>
                                </div>
                              )}
                            </div>
                          </div>

                          {isEditing && (
                            <div className="mt-4 bg-[#F7F7F7] rounded-xl p-4 border border-[#DDDDDD]">
                              <div className="text-xs font-bold text-[#222222] mb-2 uppercase tracking-wide">Foglalt helyek módosítása</div>
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => setEditSeats((s) => Math.max(0, s - 1))}
                                  className="w-9 h-9 rounded-full border border-[#DDDDDD] text-[#222222] font-bold hover:bg-white transition-colors"
                                >
                                  −
                                </button>
                                <span className="text-lg font-extrabold text-[#222222] w-8 text-center">{editSeats}</span>
                                <button
                                  type="button"
                                  onClick={() => setEditSeats((s) => Math.min(maxSeats, s + 1))}
                                  className="w-9 h-9 rounded-full border border-[#DDDDDD] text-[#222222] font-bold hover:bg-white transition-colors"
                                >
                                  +
                                </button>
                                <span className="text-xs text-[#717171]">max. {maxSeats} hely</span>
                              </div>
                              {editSeats === 0 && (
                                <p className="text-xs text-red-500 mt-2">0 helyre csökkentve a foglalás lemondásra kerül.</p>
                              )}
                              <div className="flex gap-3 mt-4">
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  className="flex-1 border border-[#DDDDDD] text-[#222222] font-semibold py-2 rounded-xl hover:bg-white transition-colors text-sm"
                                >
                                  Mégsem
                                </button>
                                <button
                                  type="button"
                                  onClick={() => requestSave(b)}
                                  className="flex-1 bg-[#FF385C] hover:bg-[#E31C5F] text-white font-bold py-2 rounded-xl transition-colors text-sm"
                                >
                                  Mentés
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {!isEditing && (
                          <div className="px-5 pb-5 flex flex-col gap-2">
                            <button
                              onClick={() => startEdit(b)}
                              className="w-full border border-[#DDDDDD] text-[#222222] font-semibold py-2.5 rounded-xl hover:bg-[#F7F7F7] transition-colors text-sm"
                            >
                              Szerkesztés
                            </button>
                            <button
                              onClick={() => requestCancel(b)}
                              className="w-full border border-red-200 text-red-500 font-semibold py-2.5 rounded-xl hover:bg-red-50 transition-colors text-sm"
                            >
                              Lemondás
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
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

            {/* Past: lemondott vagy lejárt */}
            {closedOrCancelled.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-[#717171] uppercase tracking-wider mb-3">Lemondott / lejárt</h2>
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
                          {STATUS_LABEL[b.display_status as "cancelled" | "expired"]}
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

      <ConfirmDialog
        open={confirmState !== null}
        title={confirmState?.type === "cancel" ? "Foglalás lemondása" : "Módosítás megerősítése"}
        message={
          confirmState?.type === "cancel"
            ? "Törölni akarod a foglalásodat?"
            : `Módosítod a foglalást ${confirmState?.seats ?? 0} főre?`
        }
        confirmLabel={confirmState?.type === "cancel" ? "Lemondás" : "Módosítás"}
        danger={confirmState?.type === "cancel"}
        onConfirm={runConfirm}
        onCancel={() => !working && setConfirmState(null)}
      />
    </div>
  );
}
