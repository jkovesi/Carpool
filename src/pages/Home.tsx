import { useEffect, useState } from "react";
import { Page } from "../types";
import { RideDetails, listAvailableRides } from "../lib/api";
import RidePhoto from "../components/RidePhoto";

interface HomeProps {
  navigate: (page: Page) => void;
  selectRide: (id: string) => void;
  isLoggedIn: boolean;
  currentUserId: string | null;
}

export default function Home({ navigate, selectRide, isLoggedIn, currentUserId }: HomeProps) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [seats, setSeats] = useState("");
  const [rides, setRides] = useState<RideDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const search = () => {
    setLoading(true);
    setError("");
    listAvailableRides({
      from: from || undefined,
      to: to || undefined,
      date: date || undefined,
      minSeats: seats ? parseInt(seats, 10) : undefined,
    })
      .then(setRides)
      .catch((err) => setError(err instanceof Error ? err.message : "Hiba történt a keresés során."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-[#FF385C] to-[#E31C5F] text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 leading-tight">
            Utazz együtt,<br />spórolj együtt
          </h1>
          <p className="text-lg text-white/80 font-medium">
            Csatlakozz sofőrökhöz, akik épp oda tartanak, ahova te is
          </p>
        </div>

        {/* Search card */}
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#717171] mb-1 uppercase tracking-wide">Honnan</label>
              <input
                type="text"
                placeholder="pl. Budapest"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full border border-[#DDDDDD] rounded-xl px-3 py-2.5 text-[#222222] text-sm font-medium focus:outline-none focus:border-[#222222] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#717171] mb-1 uppercase tracking-wide">Hova</label>
              <input
                type="text"
                placeholder="pl. Debrecen"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full border border-[#DDDDDD] rounded-xl px-3 py-2.5 text-[#222222] text-sm font-medium focus:outline-none focus:border-[#222222] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#717171] mb-1 uppercase tracking-wide">Mikor</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-[#DDDDDD] rounded-xl px-3 py-2.5 text-[#222222] text-sm font-medium focus:outline-none focus:border-[#222222] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#717171] mb-1 uppercase tracking-wide">Helyek</label>
              <select
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                className="w-full border border-[#DDDDDD] rounded-xl px-3 py-2.5 text-[#222222] text-sm font-medium focus:outline-none focus:border-[#222222] transition-colors bg-white"
              >
                <option value="">Bármennyi</option>
                <option value="1">1+</option>
                <option value="2">2+</option>
                <option value="3">3+</option>
                <option value="4">4+</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={search}
              className="bg-[#FF385C] hover:bg-[#E31C5F] text-white font-bold px-8 py-3 rounded-xl transition-colors text-sm"
            >
              Keresés
            </button>
          </div>
        </div>
      </div>

      {/* Listings */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[#222222]">
            {loading ? "Keresés…" : `${rides.length} elérhető út`}
          </h2>
          {isLoggedIn && (
            <button
              onClick={() => navigate("create-listing")}
              className="text-sm font-semibold text-[#FF385C] border border-[#FF385C] px-4 py-2 rounded-full hover:bg-[#FFF0F2] transition-colors"
            >
              + Hirdetés feladása
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <span className="text-sm text-red-700 font-medium">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {rides.map((ride) => (
            <button
              key={ride.id}
              onClick={() => selectRide(ride.id)}
              className="text-left group bg-white rounded-2xl overflow-hidden border border-[#DDDDDD] hover:shadow-lg transition-all duration-200"
            >
              <div className="relative h-44 bg-gray-100 overflow-hidden">
                <RidePhoto
                  destination={ride.to_city}
                  photoUrl={ride.destination_photo_url}
                  photoStatus={ride.destination_photo_status}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"/>
                {currentUserId && ride.driver_id === currentUserId && (
                  <div className="absolute top-3 right-3 bg-white text-[#222222] text-xs font-bold px-2.5 py-1 rounded-full shadow">
                    Saját hirdetés
                  </div>
                )}
                <div className="absolute bottom-3 left-3 text-white font-bold text-lg">
                  {ride.from_city} → {ride.to_city}
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-medium text-[#222222]">{ride.ride_date} · {ride.ride_time?.slice(0, 5)}</div>
                    <div className="text-xs text-[#717171] mt-0.5">{ride.seats_available} szabad hely</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-[#222222]">{ride.price_huf.toLocaleString()} Ft</div>
                    <div className="text-xs text-[#717171]">/ fő</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-3 border-t border-[#F0F0F0]">
                  <div className="w-7 h-7 bg-[#FF385C] rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {ride.driver_username.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-[#222222] font-medium">{ride.driver_username}</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {!loading && rides.length === 0 && (
          <div className="text-center py-20 text-[#717171]">
            <div className="text-5xl mb-4">🚗</div>
            <div className="text-lg font-semibold">Nincs találat</div>
            <div className="text-sm mt-1">Próbálj más szűrőfeltételeket</div>
          </div>
        )}
      </div>
    </div>
  );
}
