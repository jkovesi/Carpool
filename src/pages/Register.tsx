import { useState } from "react";
import { Page } from "../types";
import { signUp } from "../lib/api";

interface RegisterProps {
  navigate: (page: Page) => void;
  goBack: () => void;
  onRegistered: (email: string) => void;
}

function friendlySignupError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("username") && (m.includes("duplicate") || m.includes("unique"))) {
    return "Ez a felhasználónév már foglalt.";
  }
  if (m.includes("already registered") || (m.includes("email") && m.includes("exists"))) {
    return "Ezzel az e-mail címmel már létezik fiók.";
  }
  return message;
}

export default function Register({ navigate, onRegistered }: RegisterProps) {
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    consent: false,
  });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (key: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signUp({
        email: form.email,
        password: form.password,
        username: form.username,
        fullName: form.name,
        phone: form.phone,
      });
      onRegistered(form.email);
      navigate("email-confirm");
    } catch (err) {
      setError(friendlySignupError(err instanceof Error ? err.message : "Hiba történt a regisztráció során."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#FFF0F2] rounded-full mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#FF385C">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-[#222222]">Fiók létrehozása</h1>
          <p className="text-[#717171] text-sm mt-1">Csatlakozz a Telekocsi közösséghez</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#222222] mb-1.5">Teljes név</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Kovács Péter"
              required
              className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#222222] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#222222] mb-1.5">Felhasználónév</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => set("username", e.target.value)}
              placeholder="kovacs.peter"
              required
              className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#222222] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#222222] mb-1.5">E-mail cím</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="peter@email.hu"
              required
              className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#222222] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#222222] mb-1.5">Telefonszám</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+36 30 123 4567"
              required
              className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#222222] transition-colors"
            />
            <p className="text-xs text-[#717171] mt-1">Csak foglalás után kerül megosztásra a másik féllel</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#222222] mb-1.5">Jelszó</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="Legalább 8 karakter"
                required
                minLength={8}
                className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:border-[#222222] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#717171] hover:text-[#222222] transition-colors"
              >
                {showPass ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={form.consent}
              onChange={(e) => set("consent", e.target.checked)}
              required
              className="mt-0.5 w-5 h-5 accent-[#FF385C] rounded"
            />
            <span className="text-sm text-[#222222] leading-relaxed">
              Elfogadom az{" "}
              <span className="font-semibold underline">Adatkezelési tájékoztatót</span>, és hozzájárulok, hogy foglalás esetén a kapcsolati adataim (telefonszám, e-mail) automatikusan átadásra kerüljenek a másik félnek.
            </span>
          </label>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" className="flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span className="text-sm text-red-700 font-medium">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FF385C] hover:bg-[#E31C5F] disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-colors text-sm mt-2"
          >
            {loading ? "Regisztráció…" : "Regisztráció"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <span className="text-sm text-[#717171]">Már van fiókod? </span>
          <button
            onClick={() => navigate("login")}
            className="text-sm font-semibold text-[#FF385C] hover:underline"
          >
            Bejelentkezés
          </button>
        </div>
      </div>
    </div>
  );
}
