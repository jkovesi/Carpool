import { useEffect, useState } from "react";
import { Page } from "../types";
import { getMyProfile, updateMyProfile } from "../lib/api";
import { supabase } from "../lib/supabase";

interface ProfileProps {
  navigate: (page: Page) => void;
  goBack: () => void;
}

export default function Profile({ navigate }: ProfileProps) {
  const [form, setForm] = useState({ name: "", username: "", email: "", phone: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [emailConfirmed, setEmailConfirmed] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: userData }, profile] = await Promise.all([
        supabase.auth.getUser(),
        getMyProfile(),
      ]);
      setEmailConfirmed(!!userData.user?.email_confirmed_at);
      if (profile) {
        setForm({
          name: profile.full_name,
          username: profile.username,
          email: userData.user?.email ?? "",
          phone: profile.phone,
        });
      }
      setLoading(false);
    })();
  }, []);

  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await updateMyProfile({ full_name: form.name, username: form.username, phone: form.phone });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba történt a mentés során.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#F7F7F7] py-10 px-4 text-center text-sm text-[#717171]">Betöltés…</div>;
  }

  return (
    <div className="min-h-screen bg-[#F7F7F7] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-extrabold text-[#222222] mb-2">Profilom</h1>
        <p className="text-sm text-[#717171] mb-8">Személyes adataid és fiókbeállítások</p>

        {/* Avatar */}
        <div className="bg-white rounded-2xl border border-[#DDDDDD] p-6 mb-5">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-20 h-20 bg-[#FF385C] rounded-full flex items-center justify-center text-white font-bold text-3xl">
                {form.name.charAt(0).toUpperCase() || "?"}
              </div>
            </div>
            <div>
              <div className="font-bold text-[#222222] text-lg">{form.name}</div>
              <div className="text-sm text-[#717171]">@{form.username}</div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <div className={`w-2 h-2 rounded-full ${emailConfirmed ? "bg-green-500" : "bg-amber-400"}`}/>
                <span className="text-xs text-[#717171]">{emailConfirmed ? "E-mail megerősítve" : "E-mail megerősítésre vár"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl border border-[#DDDDDD] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#DDDDDD]">
            <h2 className="text-base font-bold text-[#222222]">Személyes adatok</h2>
          </div>
          <form onSubmit={handleSave} className="px-6 py-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[#222222] mb-1.5">Teljes név</label>
                <input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#222222] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#222222] mb-1.5">Felhasználónév</label>
                <input
                  value={form.username}
                  onChange={(e) => set("username", e.target.value)}
                  className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#222222] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#222222] mb-1.5">E-mail cím</label>
              <input
                type="email"
                value={form.email}
                disabled
                className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm bg-[#F7F7F7] text-[#717171] cursor-not-allowed"
              />
              <p className="text-xs text-[#717171] mt-1">Az e-mail cím módosítása jelenleg nem elérhető ezen a felületen.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#222222] mb-1.5">Telefonszám</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#222222] transition-colors"
              />
              <p className="text-xs text-[#717171] mt-1">Csak foglalás után osztjuk meg</p>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <span className="text-sm text-red-700 font-medium">{error}</span>
              </div>
            )}

            {saved && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20,6 9,17 4,12"/></svg>
                <span className="text-sm text-green-700 font-medium">Adatok sikeresen mentve</span>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-[#FF385C] hover:bg-[#E31C5F] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-colors text-sm"
            >
              {saving ? "Mentés…" : "Változások mentése"}
            </button>

            <button
              type="button"
              onClick={() => navigate("change-password")}
              className="w-full flex items-center justify-between px-1 pt-1 text-left group"
            >
              <span className="text-sm font-semibold text-[#FF385C] group-hover:underline">Jelszó módosítása</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF385C" strokeWidth="2"><polyline points="9,18 15,12 9,6"/></svg>
            </button>
          </form>
        </div>

        {/* Quick links */}
        <div className="bg-white rounded-2xl border border-[#DDDDDD] mt-5 overflow-hidden">
          <div className="px-6 py-4 border-b border-[#DDDDDD]">
            <h2 className="text-base font-bold text-[#222222]">Gyorslinkek</h2>
          </div>
          <div className="divide-y divide-[#F0F0F0]">
            {[
              { label: "Járműveim", sub: "Regisztrált járművek kezelése", page: "vehicles" as Page },
              { label: "Hirdetéseim", sub: "Aktív és korábbi hirdetések", page: "my-listings" as Page },
              { label: "Foglalásaim", sub: "Aktív és korábbi foglalások", page: "my-bookings" as Page },
            ].map((item) => (
              <button
                key={item.page}
                onClick={() => navigate(item.page)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#F7F7F7] transition-colors text-left"
              >
                <div>
                  <div className="text-sm font-semibold text-[#222222]">{item.label}</div>
                  <div className="text-xs text-[#717171] mt-0.5">{item.sub}</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#717171" strokeWidth="2"><polyline points="9,18 15,12 9,6"/></svg>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
