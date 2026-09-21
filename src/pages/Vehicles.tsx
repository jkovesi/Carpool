import { useEffect, useState } from "react";
import { Page } from "../types";
import { Vehicle, addVehicle, listMyVehicles, removeVehicle, updateVehicle } from "../lib/api";

interface VehiclesProps {
  navigate: (page: Page) => void;
  goBack: () => void;
  backLabel?: string;
}

interface VehicleFormState {
  type: string;
  seats: string;
  plate: string;
  color: string;
}

const emptyForm: VehicleFormState = { type: "", seats: "", plate: "", color: "" };

export default function Vehicles({ goBack, backLabel }: VehiclesProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<VehicleFormState>(emptyForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<VehicleFormState>(emptyForm);
  const [editError, setEditError] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const refresh = () => {
    setLoading(true);
    listMyVehicles()
      .then(setVehicles)
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await addVehicle({ type: form.type, plate: form.plate, seats: parseInt(form.seats, 10), color: form.color });
      setForm(emptyForm);
      setShowForm(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba történt a jármű hozzáadása során.");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    await removeVehicle(id);
    refresh();
  };

  const startEdit = (v: Vehicle) => {
    setShowForm(false);
    setEditError("");
    setEditingId(v.id);
    setEditForm({ type: v.type, seats: String(v.seats), plate: v.plate, color: v.color ?? "" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError("");
  };

  const setEdit = (k: string, v: string) => setEditForm((f) => ({ ...f, [k]: v }));

  const submitEdit = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    setEditError("");
    setEditSubmitting(true);
    try {
      await updateVehicle({
        id,
        type: editForm.type,
        plate: editForm.plate,
        seats: parseInt(editForm.seats, 10),
        color: editForm.color,
      });
      setEditingId(null);
      refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Hiba történt a jármű mentése során.");
    } finally {
      setEditSubmitting(false);
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
          {backLabel ?? "Vissza"}
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-[#222222]">Járműveim</h1>
            <p className="text-sm text-[#717171] mt-1">{vehicles.length} regisztrált jármű</p>
          </div>
          <button
            onClick={() => {
              setEditingId(null);
              setShowForm(true);
            }}
            className="bg-[#FF385C] hover:bg-[#E31C5F] text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors"
          >
            + Jármű hozzáadása
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-[#DDDDDD] p-6 mb-5">
            <h2 className="text-base font-bold text-[#222222] mb-4">Új jármű adatai</h2>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#222222] mb-1.5">Jármű típusa</label>
                <input
                  value={form.type}
                  onChange={(e) => set("type", e.target.value)}
                  placeholder="pl. Toyota Corolla"
                  required
                  className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#222222] transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#222222] mb-1.5">Max. férőhely (utas)</label>
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
                  <p className="text-xs text-[#717171] mt-1">Sofőr nélkül</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#222222] mb-1.5">Rendszám</label>
                  <input
                    value={form.plate}
                    onChange={(e) => set("plate", e.target.value)}
                    placeholder="ABC-123"
                    required
                    className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#222222] transition-colors uppercase"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#222222] mb-1.5">
                  Szín <span className="text-[#717171] font-normal">(nem kötelező)</span>
                </label>
                <input
                  value={form.color}
                  onChange={(e) => set("color", e.target.value)}
                  placeholder="pl. Szürke"
                  className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#222222] transition-colors"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <span className="text-sm text-red-700 font-medium">{error}</span>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 border border-[#DDDDDD] text-[#222222] font-semibold py-3 rounded-xl hover:bg-[#F7F7F7] transition-colors text-sm"
                >
                  Mégsem
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-[#FF385C] hover:bg-[#E31C5F] disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors text-sm"
                >
                  {submitting ? "Hozzáadás…" : "Hozzáadás"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Vehicle list */}
        {loading ? (
          <div className="text-center text-sm text-[#717171] py-10">Betöltés…</div>
        ) : (
          <div className="space-y-3">
            {vehicles.map((v) =>
              editingId === v.id ? (
                <div key={v.id} className="bg-white rounded-2xl border border-[#DDDDDD] p-6">
                  <h2 className="text-base font-bold text-[#222222] mb-4">Jármű szerkesztése</h2>
                  <form onSubmit={(e) => submitEdit(e, v.id)} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-[#222222] mb-1.5">Jármű típusa</label>
                      <input
                        value={editForm.type}
                        onChange={(e) => setEdit("type", e.target.value)}
                        required
                        className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#222222] transition-colors"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-[#222222] mb-1.5">Max. férőhely (utas)</label>
                        <input
                          type="number"
                          value={editForm.seats}
                          onChange={(e) => setEdit("seats", e.target.value)}
                          min="1"
                          max="8"
                          required
                          className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#222222] transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#222222] mb-1.5">Rendszám</label>
                        <input
                          value={editForm.plate}
                          onChange={(e) => setEdit("plate", e.target.value)}
                          required
                          className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#222222] transition-colors uppercase"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#222222] mb-1.5">
                        Szín <span className="text-[#717171] font-normal">(nem kötelező)</span>
                      </label>
                      <input
                        value={editForm.color}
                        onChange={(e) => setEdit("color", e.target.value)}
                        className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#222222] transition-colors"
                      />
                    </div>

                    {editError && (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                        <span className="text-sm text-red-700 font-medium">{editError}</span>
                      </div>
                    )}

                    <div className="flex gap-3 pt-1">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="flex-1 border border-[#DDDDDD] text-[#222222] font-semibold py-3 rounded-xl hover:bg-[#F7F7F7] transition-colors text-sm"
                      >
                        Mégsem
                      </button>
                      <button
                        type="submit"
                        disabled={editSubmitting}
                        className="flex-1 bg-[#FF385C] hover:bg-[#E31C5F] disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors text-sm"
                      >
                        {editSubmitting ? "Mentés…" : "Mentés"}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div key={v.id} className="bg-white rounded-2xl border border-[#DDDDDD] p-5 flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#F7F7F7] rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#717171" strokeWidth="1.5">
                      <path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v9a2 2 0 01-2 2h-2"/>
                      <circle cx="7.5" cy="17.5" r="2.5"/>
                      <circle cx="17.5" cy="17.5" r="2.5"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-[#222222]">{v.type}{v.color ? ` · ${v.color}` : ""}</div>
                    <div className="text-sm text-[#717171] mt-0.5">{v.seats} férőhely · Rendszám: {v.plate}</div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => startEdit(v)}
                      className="text-sm font-semibold border border-[#DDDDDD] text-[#222222] px-3 py-2 rounded-xl hover:bg-[#F7F7F7] transition-colors whitespace-nowrap"
                    >
                      Szerkesztés
                    </button>
                    <button
                      onClick={() => remove(v.id)}
                      className="text-sm font-semibold border border-red-200 text-red-500 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors whitespace-nowrap"
                    >
                      Törlés
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        )}

        {!loading && vehicles.length === 0 && (
          <div className="bg-white rounded-2xl border border-[#DDDDDD] p-10 text-center">
            <div className="text-4xl mb-3">🚗</div>
            <div className="font-semibold text-[#222222]">Még nincs járműved</div>
            <div className="text-sm text-[#717171] mt-1">Adj hozzá egy járművet, hogy hirdetést tudj feladni</div>
          </div>
        )}
      </div>
    </div>
  );
}
