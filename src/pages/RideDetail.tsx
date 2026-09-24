import { useEffect, useState } from "react";
import { Page } from "../types";
import { RideDetails, bookRide, getRideDetails } from "../lib/api";
import RidePhoto from "../components/RidePhoto";

interface RideDetailProps {
  navigate: (page: Page) => void;
  goBack: () => void;
  isLoggedIn: boolean;
  rideId: string | null;
  currentUserId: string | null;
}

export default function RideDetail({ navigate, goBack, isLoggedIn, rideId, currentUserId }: RideDetailProps) {
  const [ride, setRide] = useState<RideDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [seats, setSeats] = useState(1);
  const [booked, setBooked] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!rideId) {
      setLoading(false);
      return;
    }
    getRideDetails(rideId).then((r) => {
      setRide(r);
      setLoading(false);
    });
  }, [rideId]);

  const handleBook = async () => {
    if (!isLoggedIn) {
      navigate("login");
      return;
    }
    if (!ride) return;
    setError("");
    setSubmitting(true);
    try {
      await bookRide(ride.id, seats);
      setBooked(true);
      const refreshed = await getRideDetails(ride.id);
      if (refreshed) setRide(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba történt a foglalás során.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#F7F7F7] py-20 text-center text-sm text-[#717171]">Betöltés…</div>;
  }

  if (!ride) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] py-20 text-center">
        <div className="text-sm text-[#717171] mb-4">Ez a hirdetés nem található, vagy már nem aktív.</div>
        <button onClick={() => navigate("home")} className="text-sm font-semibold text-[#FF385C] hover:underline">
          Vissza a kezdőlapra
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6">
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-sm text-[#717171] hover:text-[#222222] mb-5 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
          Vissza
        </button>

        <div className="mb-4">
          <div className="text-2xl font-extrabold text-[#222222]">{ride.from_city} → {ride.to_city}</div>
          <div className="text-sm text-[#717171] mt-1">{ride.ride_date} · {ride.ride_time?.slice(0, 5)}</div>
        </div>

        {/* Header image */}
        <div className="h-56 bg-gray-200 rounded-2xl overflow-hidden">
          <RidePhoto
            destination={ride.to_city}
            photoUrl={ride.destination_photo_url}
            photoStatus={ride.destination_photo_status}
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-5">
          {/* Route */}
          <div className="bg-white rounded-2xl p-5 border border-[#DDDDDD]">
            <h2 className="text-lg font-bold text-[#222222] mb-4">Az út részletei</h2>
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center gap-1 mt-1">
                <div className="w-3 h-3 rounded-full bg-[#FF385C] border-2 border-[#FF385C]"/>
                <div className="w-0.5 h-12 bg-[#DDDDDD]"/>
                <div className="w-3 h-3 rounded-full bg-[#222222] border-2 border-[#222222]"/>
              </div>
              <div className="flex-1">
                <div className="mb-4">
                  <div className="font-bold text-[#222222]">{ride.from_city}</div>
                  <div className="text-sm text-[#717171]">{ride.ride_time?.slice(0, 5)}</div>
                </div>
                <div>
                  <div className="font-bold text-[#222222]">{ride.to_city}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Car info */}
          <div className="bg-white rounded-2xl p-5 border border-[#DDDDDD]">
            <h2 className="text-lg font-bold text-[#222222] mb-4">Jármű</h2>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-[#FFF0F2] rounded-2xl flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF385C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 11l1.3-3.9A2 2 0 0 1 8.2 5.7h7.6a2 2 0 0 1 1.9 1.4L19 11"/>
                  <path d="M3 11h18v4.5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1V15H6v.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V11z"/>
                  <circle cx="7.3" cy="15.7" r="1.5"/>
                  <circle cx="16.7" cy="15.7" r="1.5"/>
                </svg>
              </div>
              <div>
                <div className="font-bold text-[#222222]">{ride.car_type}</div>
                <div className="text-sm text-[#717171]">{ride.car_color}</div>
                {ride.car_plate ? (
                  <div className="mt-1 text-sm font-semibold text-[#FF385C]">Rendszám: {ride.car_plate}</div>
                ) : (
                  <div className="mt-1 text-xs text-[#717171]">🔒 Rendszám foglalás után látható</div>
                )}
              </div>
            </div>
          </div>

          {/* Driver */}
          <div className="bg-white rounded-2xl p-5 border border-[#DDDDDD]">
            <h2 className="text-lg font-bold text-[#222222] mb-4">Sofőr</h2>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-[#FF385C] rounded-full flex items-center justify-center text-white font-bold text-xl">
                {ride.driver_username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="font-bold text-[#222222]">{ride.driver_full_name ?? ride.driver_username}</div>
                {ride.driver_full_name ? (
                  <div className="mt-1 text-xs text-[#717171]">@{ride.driver_username}</div>
                ) : (
                  <div className="mt-1 text-xs text-[#717171]">🔒 Teljes név és telefonszám foglalás után látható</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Booking card */}
        {currentUserId && ride.driver_id === currentUserId ? (
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-5 border border-[#DDDDDD] sticky top-24">
              <div className="text-center py-4">
                <div className="text-sm text-[#717171]">
                  Ez a saját hirdetésed, foglalást nem tudsz rá leadni. Itt csak megtekintheted.
                </div>
              </div>
            </div>
          </div>
        ) : (
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl p-5 border border-[#DDDDDD] sticky top-24">
            {booked ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20,6 9,17 4,12"/></svg>
                </div>
                <div className="font-bold text-[#222222] text-lg">Foglalás sikeres!</div>
                <div className="text-sm text-[#717171] mt-1 mb-4">A sofőr elérhetőségét fent, ezen az oldalon is látod.</div>
                <button onClick={() => navigate("my-bookings")} className="w-full bg-[#FF385C] hover:bg-[#E31C5F] text-white font-bold py-3 rounded-xl text-sm transition-colors">
                  Foglalásaim megtekintése
                </button>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold text-[#222222] mb-1">
                  {(ride.price_huf * seats).toLocaleString()} Ft
                </div>
                <div className="text-sm text-[#717171] mb-4">{ride.price_huf.toLocaleString()} Ft / fő</div>

                <div className="border border-[#DDDDDD] rounded-xl p-3 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#222222]">Helyek száma</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSeats(Math.max(1, seats - 1))}
                        className="w-8 h-8 border border-[#DDDDDD] rounded-full flex items-center justify-center text-[#222222] hover:border-[#222222] transition-colors font-bold"
                      >−</button>
                      <span className="font-bold text-[#222222] w-4 text-center">{seats}</span>
                      <button
                        onClick={() => setSeats(Math.min(ride.seats_available, seats + 1))}
                        className="w-8 h-8 border border-[#DDDDDD] rounded-full flex items-center justify-center text-[#222222] hover:border-[#222222] transition-colors font-bold"
                      >+</button>
                    </div>
                  </div>
                  <div className="text-xs text-[#717171] mt-2">{ride.seats_available} szabad hely</div>
                </div>

                {error && (
                  <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <span className="text-sm text-red-700 font-medium">{error}</span>
                  </div>
                )}

                <button
                  onClick={handleBook}
                  disabled={submitting || ride.seats_available < 1}
                  className="w-full bg-[#FF385C] hover:bg-[#E31C5F] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-colors text-sm"
                >
                  {submitting ? "Foglalás…" : isLoggedIn ? "Hely foglalása" : "Bejelentkezés a foglaláshoz"}
                </button>

                <div className="mt-3 text-xs text-[#717171] text-center">
                  Azonnal megerősítjük — nincs várakozás
                </div>
              </>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
