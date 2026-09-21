import { useState } from "react";
import { Page } from "../types";
import { signInWithIdentifier } from "../lib/api";

interface LoginProps {
  navigate: (page: Page) => void;
  goBack: () => void;
  notice?: { type: "success" | "error"; message: string } | null;
  clearNotice?: () => void;
}

export default function Login({ navigate, notice, clearNotice }: LoginProps) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithIdentifier(identifier, password);
      clearNotice?.();
      navigate("home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba történt a bejelentkezés során.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#FFF0F2] rounded-full mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#FF385C">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-[#222222]">Üdv vissza!</h1>
          <p className="text-[#717171] text-sm mt-1">Jelentkezz be a fiókodba</p>
        </div>

        {notice && (
          <div
            className={`mb-5 flex items-center gap-2 rounded-xl px-4 py-3 border ${
              notice.type === "success" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
            }`}
          >
            {notice.type === "success" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" className="flex-shrink-0"><polyline points="20,6 9,17 4,12"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" className="flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            )}
            <span className={`text-sm font-medium ${notice.type === "success" ? "text-green-700" : "text-red-700"}`}>
              {notice.message}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#222222] mb-1.5">
              Felhasználónév vagy e-mail
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="kovacs.peter vagy peter@email.hu"
              required
              className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 text-[#222222] text-sm focus:outline-none focus:border-[#222222] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#222222] mb-1.5">
              Jelszó
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full border border-[#DDDDDD] rounded-xl px-4 py-3 pr-12 text-[#222222] text-sm focus:outline-none focus:border-[#222222] transition-colors"
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
            {loading ? "Bejelentkezés…" : "Bejelentkezés"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <span className="text-sm text-[#717171]">Még nincs fiókod? </span>
          <button
            onClick={() => navigate("register")}
            className="text-sm font-semibold text-[#FF385C] hover:underline"
          >
            Regisztrálj ingyen
          </button>
        </div>
      </div>
    </div>
  );
}
