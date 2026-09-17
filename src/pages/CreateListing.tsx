import { useEffect, useState } from "react";
import { Page } from "../types";
import { Vehicle, createListing, listMyVehicles } from "../lib/api";

interface CreateListingProps {
  navigate: (page: Page) => void;
  goBack: () => void;
}

export default function CreateListing({ navigate, goBack }: CreateListingProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [form, setForm] = useState({
    vehicle: "",
    from: "",
    to: "",
    date: "",
    time: "",
    price: "",
    seats: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listMyVehicles().then(setVehicles);
  }, []);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await createListing({
        vehicleId: form.vehicle,
        from: form.from,
        to: form.to,
        date: form.date,
        time: form.time,
        price: parseInt(form.price, 10),
        seats: parseInt(form.seats, 10),
      });
      navigate("my-listings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba történt a hirdetés létrehozása során.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-sm text-[#717171] hover:text-[#222222] mb-6 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15,18 9,12 15,6"/></svg>
          Vissza
        </button>

        <div className="bg-white rounded-2xl border border-[#DDDDDD] overflow-hidden">
          <div className="px-6 py-5 border-b border-[#DDDDDD]">
            <h1 className="text-2xl font-extrabold text-[#222222]">Új hirdetés feladása</h1>
            <p className="text-sm text-[#717171] mt-1">Oszd meg az utad másokkal és spórolj az üzemanyagon</p>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
            {/* Vehicle */}
            <div>
              <label className="block text-sm font-semibold text-[#222222] mb-1.5">Jármű kiválasztása</label>
              {vehicles.length === 0 ? (
                <div className="text-sm text-[#717171] border border-dashed border-[#DDDDDD] rounded-xl px-4 py-3">
                  Még nincs rögzített járműved.
                </div>
              ) : (
                <select
                  value={form.vehicle}
                  onChange={(e) => set("vehicle", e.target.value)}
                  required
                  className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#222222] transition-colors bg-white text-[#222222]"
                >
                  <option value="">Válassz járművet…</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.type}{v.color ? ` · ${v.color}` : ""} · {v.plate} · {v.seats} férőhely
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => navigate("vehicles")}
                className="text-xs text-[#FF385C] font-semibold mt-1.5 hover:underline"
              >
                + Új jármű hozzáadása
              </button>
            </div>

            {/* From / To */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[#222222] mb-1.5">Induló állomás</label>
                <input
                  type="text"
                  value={form.from}
                  onChange={(e) => set("from", e.target.value)}
                  placeholder="pl. Budapest, Keleti"
                  required
                  className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#222222] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#222222] mb-1.5">Célállomás</label>
                <input
                  type="text"
                  value={form.to}
                  onChange={(e) => set("to", e.target.value)}
                  placeholder="pl. Debrecen, Nagyállomás"
                  required
                  className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#222222] transition-colors"
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
                  required
                  className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#222222] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#222222] mb-1.5">Indulási idő</label>
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => set("time", e.target.value)}
                  required
                  className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#222222] transition-colors"
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
                    placeholder="2800"
                    min="100"
                    required
                    className="no-spinner w-full border border-[#DDDDDD] rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:border-[#222222] transition-colors"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#717171] text-sm font-medium">Ft</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#222222] mb-1.5">Szabad helyek</label>
                <input
                  type="number"
                  value={form.seats}
                  onChange={(e) => set("seats", e.target.value)}
                  placeholder="4"
                  min="1"
                  max="8"
                  required
                  className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#222222] transition-colors"
                />
                <p className="text-xs text-[#717171] mt-1">Max. a jármű férőhelyéig (sofőr nélkül)</p>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <span className="text-sm text-red-700 font-medium">{error}</span>
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
                disabled={submitting || vehicles.length === 0}
                className="flex-1 bg-[#FF385C] hover:bg-[#E31C5F] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-colors text-sm"
              >
                {submitting ? "Feladás…" : "Hirdetés feladása"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
