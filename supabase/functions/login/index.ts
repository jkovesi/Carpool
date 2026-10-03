// Supabase Edge Function: login
//
// Bejelentkezés FELHASZNÁLÓNÉVVEL (BUG-01, BUG-15 — 2026-10-03).
//
// Korábban a kliens az email_for_username RPC-vel oldotta fel a
// felhasználónevet e-mail címre, amit bárki (bejelentkezés nélkül is)
// meghívhatott — így bármely felhasználó e-mail címe lekérdezhető volt, és a
// "nincs ilyen felhasználó" üzenet elárulta, mely nevek léteznek.
//
// Most a feloldás itt, szerveroldalon történik:
//  - az e-mail cím SOHA nem kerül vissza a klienshez;
//  - minden sikertelen kísérlet ugyanazt az üzenetet és ugyanazt a
//    HTTP-státuszt adja, és közel azonos ideig tart (nem létező névnél is);
//  - sikeres belépéskor a Supabase Auth munkamenet-tokenjeit adjuk vissza,
//    a kliens ezekkel állítja be a munkamenetet (supabase.auth.setSession).
// A felhasználónév kis/nagybetűtől függetlenül egyezik (BUG-13).
//
// E-mail címmel a kliens továbbra is közvetlenül a Supabase Auth-tal
// jelentkezik be; ez a funkció azt is elfogadja (egységes viselkedés).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GENERIC_ERROR = "Hibás felhasználónév/e-mail vagy jelszó.";
const NOT_CONFIRMED = "Az e-mail címed még nincs megerősítve. Kattints a regisztrációkor kapott levélben lévő linkre.";
const RATE_LIMITED = "Túl sok próbálkozás. Várj néhány percet, majd próbáld újra.";
const MIN_RESPONSE_MS = 700;
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,30}$/;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function serviceKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keys) {
    const parsed = JSON.parse(keys) as Record<string, string>;
    const first = parsed.default ?? Object.values(parsed)[0];
    if (first) return first;
  }
  throw new Error("Hiányzó szerverkulcs.");
}

async function resolveEmail(identifier: string): Promise<string | null> {
  if (identifier.includes("@")) return identifier.toLowerCase();
  if (!USERNAME_PATTERN.test(identifier)) return null;

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", escapeLike(identifier))
    .maybeSingle();
  if (error || !profile) return null;

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);
  if (userError || !userData?.user?.email) return null;
  return userData.user.email;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Nem támogatott kérés." }, 405);

  const started = Date.now();
  const respond = async (body: unknown, status: number) => {
    const wait = MIN_RESPONSE_MS - (Date.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    return json(body, status);
  };

  let identifier = "";
  let password = "";
  try {
    const body = await req.json();
    identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return respond({ error: GENERIC_ERROR }, 400);
  }
  if (!identifier || !password || identifier.length > 254 || password.length > 200) {
    return respond({ error: GENERIC_ERROR }, 400);
  }

  try {
    const email = await resolveEmail(identifier);
    if (!email) return respond({ error: GENERIC_ERROR }, 400);

    const forwardedFor = req.headers.get("x-forwarded-for") ?? "";
    const authClient = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
      global: forwardedFor ? { headers: { "X-Forwarded-For": forwardedFor } } : undefined,
    });
    const { data, error } = await authClient.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      const code = (error as { code?: string } | null)?.code ?? "";
      const msg = (error?.message ?? "").toLowerCase();
      if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
        return respond({ error: NOT_CONFIRMED }, 400);
      }
      if (code === "over_request_rate_limit" || msg.includes("rate limit")) {
        return respond({ error: RATE_LIMITED }, 429);
      }
      return respond({ error: GENERIC_ERROR }, 400);
    }

    return respond(
      {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        token_type: data.session.token_type,
      },
      200,
    );
  } catch (e) {
    console.error("login hiba:", e instanceof Error ? e.message : e);
    return respond({ error: GENERIC_ERROR }, 400);
  }
});
