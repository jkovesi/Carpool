import { useState } from "react";
import { Page } from "../types";
import { resendConfirmationEmail } from "../lib/api";

interface EmailConfirmProps {
  navigate: (page: Page) => void;
  email: string;
}

export default function EmailConfirm({ navigate, email }: EmailConfirmProps) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const resend = async () => {
    if (!email) return;
    setSending(true);
    try {
      await resendConfirmationEmail(email);
      setSent(true);
    } catch {
      // csendben elnyeljük — a felhasználó úgyis megpróbálhatja újra
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-[#FFF0F2] rounded-full mb-6">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF385C" strokeWidth="1.5">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>

        <h1 className="text-2xl font-extrabold text-[#222222] mb-3">Erősítsd meg az e-mail címed!</h1>
        <p className="text-[#717171] text-sm leading-relaxed mb-2">
          Elküldtük a megerősítő linket{email ? <> a(z) <strong className="text-[#222222]">{email}</strong> címre</> : " a megadott e-mail címre"}.
        </p>
        <p className="text-[#717171] text-sm leading-relaxed mb-8">
          Kattints a levélben lévő linkre a regisztráció befejezéséhez — a fiókod csak ezután lesz aktív.
        </p>

        <div className="bg-[#F7F7F7] rounded-2xl p-5 mb-8 text-left">
          <h3 className="text-sm font-bold text-[#222222] mb-3">Nem kaptad meg a levelet?</h3>
          <ul className="space-y-2 text-sm text-[#717171]">
            <li className="flex items-start gap-2">
              <span className="text-[#FF385C] font-bold mt-0.5">1.</span>
              Ellenőrizd a Spam / Levélszemét mappát
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FF385C] font-bold mt-0.5">2.</span>
              Győződj meg, hogy jó e-mail címet adtál meg
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FF385C] font-bold mt-0.5">3.</span>
              Néhány perc késés előfordulhat
            </li>
          </ul>
        </div>

        <button
          onClick={resend}
          disabled={sending || !email}
          className="w-full border border-[#DDDDDD] text-[#222222] font-semibold py-3 rounded-xl hover:bg-[#F7F7F7] disabled:opacity-60 transition-colors text-sm mb-3"
        >
          {sending ? "Küldés…" : sent ? "Elküldve ✓" : "Megerősítő e-mail újraküldése"}
        </button>

        <button
          onClick={() => navigate("login")}
          className="text-sm text-[#717171] hover:text-[#222222] transition-colors"
        >
          ← Vissza a bejelentkezéshez
        </button>
      </div>
    </div>
  );
}
