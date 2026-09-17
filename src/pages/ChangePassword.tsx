import { useState } from "react";
import { Page } from "../types";
import { changePassword } from "../lib/api";

interface ChangePasswordProps {
  navigate: (page: Page) => void;
  goBack: () => void;
}

export default function ChangePassword({ goBack }: ChangePasswordProps) {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.next.length < 8) {
      setError("Az új jelszónak legalább 8 karakter hosszúnak kell lennie.");
      return;
    }
    if (form.next !== form.confirm) {
      setError("A két új jelszó nem egyezik.");
      return;
    }
    if (form.next === form.current) {
      setError("Az új jelszó nem egyezhet a jelenlegivel.");
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(form.current, form.next);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba történt a jelszó módosítása során.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-5">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20,6 9,17 4,12"/></svg>
          </div>
          <h1 className="text-2xl font-extrabold text-[#222222] mb-2">Jelszavad megváltozott</h1>
          <p className="text-[#717171] text-sm leading-relaxed mb-8">
            A következő bejelentkezéskor már az új jelszavadat használd.
          </p>
          <button
            onClick={goBack}
            className="w-full bg-[#FF385C] hover:bg-[#E31C5F] text-white font-bold py-3.5 rounded-xl transition-colors text-sm"
          >
            Vissza a profilomhoz
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-sm text-[#717171] hover:text-[#222222] mb-6 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15,18 9,12 15,6"/></svg>
          Vissza
        </button>

        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-[#222222]">Jelszó módosítása</h1>
          <p className="text-[#717171] text-sm mt-1">Add meg a jelenlegi jelszavadat, majd válassz egy újat</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#222222] mb-1.5">Jelenlegi jelszó</label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={form.current}
                onChange={(e) => set("current", e.target.value)}
                required
                placeholder="••••••••"
                className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:border-[#222222] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#717171] hover:text-[#222222] transition-colors"
              >
                {showCurrent ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#222222] mb-1.5">Új jelszó</label>
            <div className="relative">
              <input
                type={showNext ? "text" : "password"}
                value={form.next}
                onChange={(e) => set("next", e.target.value)}
                required
                minLength={8}
                placeholder="Legalább 8 karakter"
                className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:border-[#222222] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowNext(!showNext)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#717171] hover:text-[#222222] transition-colors"
              >
                {showNext ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#222222] mb-1.5">Új jelszó megerősítése</label>
            <input
              type={showNext ? "text" : "password"}
              value={form.confirm}
              onChange={(e) => set("confirm", e.target.value)}
              required
              minLength={8}
              placeholder="Írd be még egyszer"
              className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#222222] transition-colors"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" className="flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span className="text-sm text-red-700 font-medium">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#FF385C] hover:bg-[#E31C5F] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-colors text-sm mt-2"
          >
            {submitting ? "Módosítás…" : "Jelszó módosítása"}
          </button>
        </form>
      </div>
    </div>
  );
}
