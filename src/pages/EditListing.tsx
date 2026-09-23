import { useEffect, useState } from "react";
import { Page } from "../types";
import { RideDetails, getVehicleById, listMyListings, updateListing } from "../lib/api";

interface EditListingProps {
  navigate: (page: Page) => void;
  goBack: () => void;
  listingId: string | null;
  backLabel?: string;
}

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function EditListing({ goBack, listingId, backLabel }: EditListingProps) {
  const [listing, setListing] = useState<RideDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ date: "", time: "", price: "", seats: "" });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [vehicleSeats, setVehicleSeats] = useState<number | null>(null);

  useEffect(() => {
    if (!listingId) {
      setLoading(false);
      return;
    }
    listMyListings().then(async (all) => {
      const found = all.find((l) => l.id === listingId) ?? null;
      setListing(found);
      if (found) {
        setForm({
          date: found.ride_date,
          time: found.ride_time?.slice(0, 5) ?? "",
          price: String(found.price_huf),
          seats: String(found.seats_total),
        });
        if (found.vehicle_id) {
          const vehicle = await getVehicleById(found.vehicle_id);
          setVehicleSeats(vehicle?.seats ?? null);
        }
      }
      setLoading(false);
    });
  }, [listingId]);

  const maxSeats = vehicleSeats ?? 8;
  const locked = (listing?.seats_booked ?? 0) > 0;

  const today = new Date();
  const minDate = toDateInputValue(today);
  const maxDateObj = new Date(today);
  maxDateObj.setDate(maxDateObj.getDate() + 365);
  const maxDate = toDateInputValue(maxDateObj);

  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listing) return;
    setError("");
    setSaved(false);
    setSubmitting(true);
    try {
      await updateListing({
        listingId: listing.id,
        price: parseInt(form.price, 10),
        seats: parseInt(form.seats, 10),
        date: form.date,
        time: form.time,
      });
      setSaved(true);
      const refreshed = (await listMyListings()).find((l) => l.id === listing.id) ?? null;
      setListing(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba történt a hirdetés mentése során.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#F7F7F7] py-20 text-center text-sm text-[#717171]">Betöltés…</div>;
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] py-20 text-center">
        <div className="text-sm text-[#717171] mb-4">Ez a hirdetés nem található.</div>
        <button onClick={goBack} className="text-sm font-semibold text-[#FF385C] hover:underline">
          Vissza
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-sm text-[#717171] hover:text-[#222222] mb-6 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15,18 9,12 15,6"/></svg>
          {backLabel ?? "Vissza a hirdetéseimhez"}
        </button>

        <div className="bg-white rounded-2xl border border-[#DDDDDD] overflow-hidden">
          <div className="px-6 py-5 border-b border-[#DDDDDD]">
            <h1 className="text-2xl font-extrabold text-[#222222]">Hirdetés szerkesztése</h1>
            <p className="text-sm text-[#717171] mt-1">{listing.from_city} → {listing.to_city}</p>
          </div>

          {/* Info banner */}
          <div className="mx-6 mt-5 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" className="flex-shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-sm text-amber-800 leading-relaxed">
              {locked ? (
                <>
                  Ennek a hirdetésnek már van legalább 1 foglalása, ezért az <strong>ár és az indulás időpontja (dátum, idő) nem módosítható</strong>. A szabad helyek száma módosítható, legalább a már lefoglalt helyek ({listing.seats_booked} db) számáig csökkenthető, legfeljebb a jármű férőhelyéig ({maxSeats}) növelhető.
                </>
              ) : (
                <>
                  A szabad helyek száma <strong>nem csökkenthető</strong> a már lefoglalt helyek ({listing.seats_booked} db) száma alá. Az útvonal (honnan/hova) utólag nem módosítható. A dátum legfeljebb 365 nappal lehet a mai naptól későbbre.
                </>
              )}
            </p>
          </div>

          <form onSubmit={handleSave} className="px-6 py-6 space-y-5">
            {/* From / To (read-only) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[#222222] mb-1.5">Induló állomás</label>
                <input
                  value={listing.from_city}
                  disabled
                  className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm bg-[#F7F7F7] text-[#717171]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#222222] mb-1.5">Célállomás</label>
                <input
                  value={listing.to_city}
                  disabled
                  className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm bg-[#F7F7F7] text-[#717171]"
                />
              </div>
            </div>

            {/* Date / Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[#222222] mb-1.5">Dátum</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => set("date", e.target.value)}
                  min={minDate}
                  max={maxDate}
                  required
                  disabled={locked}
                  className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#222222] transition-colors disabled:bg-[#F7F7F7] disabled:text-[#717171]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#222222] mb-1.5">Indulási idő</label>
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => set("time", e.target.value)}
                  required
                  disabled={locked}
                  className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#222222] transition-colors disabled:bg-[#F7F7F7] disabled:text-[#717171]"
                />
              </div>
            </div>

            {/* Price / Seats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[#222222] mb-1.5">Ár (Ft / fő)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => set("price", e.target.value)}
                    min="100"
                    required
                    disabled={locked}
                    className="no-spinner w-full border border-[#DDDDDD] rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:border-[#222222] transition-colors disabled:bg-[#F7F7F7] disabled:text-[#717171]"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#717171] text-sm">Ft</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#222222] mb-1.5">Maximális szabad helyek</label>
                <input
                  type="number"
                  value={form.seats}
                  onChange={(e) => set("seats", e.target.value)}
                  min={listing.seats_booked || 1}
                  max={maxSeats}
                  required
                  className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#222222] transition-colors"
                />
                <p className="text-xs text-[#717171] mt-1">
                  {`Min. ${listing.seats_booked} (már foglalt) · Max. ${maxSeats} (a jármű férőhelye)`}
                </p>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <span className="text-sm text-red-700 font-medium">{error}</span>
              </div>
            )}

            {saved && !error && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20,6 9,17 4,12"/></svg>
                <span className="text-sm text-green-700 font-medium">Hirdetés sikeresen frissítve</span>
              </div>
            )}

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={goBack}
                className="flex-1 border border-[#DDDDDD] text-[#222222] font-semibold py-3.5 rounded-xl hover:bg-[#F7F7F7] transition-colors text-sm"
              >
                Mégsem
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-[#FF385C] hover:bg-[#E31C5F] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-colors text-sm"
              >
                {submitting ? "Mentés…" : "Mentés"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
