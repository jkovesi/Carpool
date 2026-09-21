import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Hiányzó Supabase környezeti változó (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY). Nézd meg a .env fájlt.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Az e-mail megerősítő linkről visszatérve NE jelentkeztesse be automatikusan
    // a felhasználót (KAN-2, 4.14) — a linkben lévő tokent az App.tsx saját maga
    // olvassa ki, majd eldobja, a felhasználó ezután manuálisan jelentkezik be.
    detectSessionInUrl: false,
  },
});
