// Supabase Edge Function: notify-booking
//
// Négy adatbázis-trigger hívja meg (pg_net.http_post), és branded e-maileket
// küld ki Mailgun-on keresztül a foglalás / hirdetés életciklusának
// eseményeire:
//  - "booking_created" (public.bookings INSERT, KAN-15/16): az utasnak
//    visszaigazolás, a sofőrnek értesítés az új utasról.
//  - "booking_cancelled" (public.bookings UPDATE, status -> 'cancelled',
//    az utas saját maga mondja le a cancel_booking() RPC-vel): az utasnak
//    visszaigazolás a lemondásról, a sofőrnek értesítés, hogy egy utasa
//    lemondta a foglalását. EZ AZ ESEMÉNY NEM SÜL EL, ha a lemondás egy
//    hirdetés-törlés kaszkádjának a része (lásd lentebb) — azt a
//    "listing_cancelled" esemény fedi le, hogy ne menjen ki két, egymásnak
//    ellentmondó e-mail ugyanarról a történésről.
//  - "booking_updated" (public.bookings UPDATE, seats_booked változik, az
//    utas saját maga módosítja az update_booking() RPC-vel): az utasnak
//    visszaigazolás az új helyszámról, a sofőrnek értesítés, hogy egy utasa
//    módosította a foglalását.
//  - "listing_cancelled" (public.listings UPDATE, status -> 'cancelled',
//    a sofőr törli a teljes hirdetést a cancel_listing() RPC-vel): a
//    sofőrnek visszaigazolás a törlésről, és MINDEN érintett (a törléskor
//    aktív foglalással rendelkező) utasnak értesítés, hogy a sofőr törölte
//    az utat — a szövegezés explicit jelzi, hogy a sofőr döntése volt.
//
// A hívást egy megosztott titok (X-Webhook-Secret fejléc) védi, mert a
// funkció nem JWT-alapú felhasználói hívásra van szánva, hanem kizárólag a
// saját adatbázis-triggereinkből érkezhet.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

const BRAND_COLOR = "#FF385C";
const BRAND_NAME = "Telekocsi";

type NotifyEvent = "booking_created" | "booking_cancelled" | "booking_updated" | "listing_cancelled";

type Profile = { id: string; username: string | null; full_name: string | null; phone: string | null };

function emailShell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="hu">
  <body style="margin:0;padding:0;background:#F7F7F7;font-family:'Plus Jakarta Sans',Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F7F7;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #DDDDDD;">
            <tr>
              <td style="background:${BRAND_COLOR};padding:20px 28px;">
                <span style="color:#ffffff;font-size:20px;font-weight:800;">${BRAND_NAME}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 16px;font-size:20px;color:#222222;">${title}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#F7F7F7;color:#717171;font-size:12px;">
                Ezt az e-mailt a ${BRAND_NAME} küldte automatikusan egy foglalás miatt.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendMailgun(to: string, subject: string, html: string) {
  const apiKey = Deno.env.get("MAILGUN_API_KEY");
  const domain = Deno.env.get("MAILGUN_DOMAIN");
  const baseUrl = Deno.env.get("MAILGUN_API_BASE_URL") ?? "https://api.mailgun.net/v3";
  if (!apiKey || !domain) {
    throw new Error("Hiányzó MAILGUN_API_KEY vagy MAILGUN_DOMAIN Edge Function secret.");
  }

  const form = new URLSearchParams();
  form.set("from", `${BRAND_NAME} <postmaster@${domain}>`);
  form.set("to", to);
  form.set("subject", subject);
  form.set("html", html);

  const res = await fetch(`${baseUrl}/${domain}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`api:${apiKey}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mailgun hiba (${res.status}): ${text}`);
  }
}

async function lookupEmail(supabase: SupabaseClient, userId: string): Promise<string | undefined> {
  const { data } = await supabase.auth.admin.getUserById(userId);
  return data?.user?.email ?? undefined;
}

async function lookupProfile(supabase: SupabaseClient, userId: string): Promise<Profile | undefined> {
  const { data } = await supabase.from("profiles").select("id, username, full_name, phone").eq("id", userId).single();
  return data ?? undefined;
}

function fmtDate(rideDate: string, rideTime: string): string {
  return `${rideDate} · ${String(rideTime).slice(0, 5)}`;
}

// Extra kapcsolat-sorok (telefon + e-mail) egy meglévő "SOFŐR" / "UTAS" infó
// táblázathoz — a felek egymás elérhetőségét is megkapják, hogy fel tudják
// venni a kapcsolatot az úttal kapcsolatban.
function contactRows(phone: string | null | undefined, email: string | undefined): string {
  const rows: string[] = [];
  if (phone) rows.push(`<tr><td style="font-size:13px;color:#717171;padding-top:4px;">📞 ${phone}</td></tr>`);
  if (email) rows.push(`<tr><td style="font-size:13px;color:#717171;padding-top:4px;">✉️ ${email}</td></tr>`);
  return rows.join("");
}

Deno.serve(async (req: Request) => {
  try {
    const expectedSecret = Deno.env.get("BOOKING_WEBHOOK_SECRET");
    const gotSecret = req.headers.get("x-webhook-secret");
    if (!expectedSecret || gotSecret !== expectedSecret) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const notifyEvent: NotifyEvent =
      body.event === "booking_cancelled" ? "booking_cancelled" :
      body.event === "booking_updated" ? "booking_updated" :
      body.event === "listing_cancelled" ? "listing_cancelled" :
      "booking_created";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ======================================================================
    // "listing_cancelled": a sofőr törölte a teljes hirdetést
    // ======================================================================
    if (notifyEvent === "listing_cancelled") {
      const listingId: string | undefined = body.listing_id;
      if (!listingId) return new Response("Missing listing_id", { status: 400 });
      const bookingIds: string[] = Array.isArray(body.booking_ids) ? body.booking_ids : [];

      const { data: listing, error: listingError } = await supabase
        .from("listings")
        .select("id, driver_id, from_city, to_city, ride_date, ride_time, price_huf, car_type, car_color, car_plate")
        .eq("id", listingId)
        .single();
      if (listingError || !listing) throw new Error(`Hirdetés nem található: ${listingError?.message}`);

      const dateStr = fmtDate(listing.ride_date, listing.ride_time);
      const results: { target: string; ok: boolean; error?: string }[] = [];

      // --- Sofőrnek szóló visszaigazolás ---
      const driverEmail = await lookupEmail(supabase, listing.driver_id);
      if (driverEmail) {
        try {
          const passengerCountText = bookingIds.length > 0
            ? `<p style="color:#717171;font-size:13px;">Erről ${bookingIds.length} utasodat is értesítettük, akiknek aktív foglalása volt erre az útra.</p>`
            : `<p style="color:#717171;font-size:13px;">Ezen az úton nem volt aktív foglalás.</p>`;
          await sendMailgun(
            driverEmail,
            `Hirdetésed törölve — ${listing.from_city} → ${listing.to_city}`,
            emailShell(
              "Hirdetésed törölve",
              `<p style="color:#222222;font-size:15px;line-height:1.5;">
                Sikeresen töröltétek az alábbi hirdetést:
              </p>
              <p style="font-size:16px;font-weight:700;color:#222222;margin:16px 0 4px;">${listing.from_city} → ${listing.to_city}</p>
              <p style="color:#717171;margin:0 0 16px;">${dateStr}</p>
              ${passengerCountText}`,
            ),
          );
          results.push({ target: "driver", ok: true });
        } catch (err) {
          results.push({ target: "driver", ok: false, error: String(err) });
        }
      } else {
        results.push({ target: "driver", ok: false, error: `no email found for driver_id ${listing.driver_id}` });
      }

      const driverProfile = await lookupProfile(supabase, listing.driver_id);

      // --- Minden érintett utasnak szóló értesítés ---
      for (const bookingId of bookingIds) {
        const { data: booking } = await supabase
          .from("bookings")
          .select("id, passenger_id, seats_booked")
          .eq("id", bookingId)
          .single();
        if (!booking) {
          results.push({ target: `passenger:${bookingId}`, ok: false, error: "booking not found" });
          continue;
        }

        const passengerEmail = await lookupEmail(supabase, booking.passenger_id);
        if (!passengerEmail) {
          results.push({ target: `passenger:${bookingId}`, ok: false, error: `no email found for passenger_id ${booking.passenger_id}` });
          continue;
        }

        try {
          await sendMailgun(
            passengerEmail,
            `A sofőr törölte az utat — ${listing.from_city} → ${listing.to_city}`,
            emailShell(
              "A sofőr törölte az utat",
              `<p style="color:#222222;font-size:15px;line-height:1.5;">
                A sofőr törölte az alábbi utat, amire <strong>${booking.seats_booked}</strong> helyes foglalásod volt:
              </p>
              <p style="font-size:16px;font-weight:700;color:#222222;margin:16px 0 4px;">${listing.from_city} → ${listing.to_city}</p>
              <p style="color:#717171;margin:0 0 16px;">${dateStr}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF0F2;border-radius:12px;padding:16px;margin-bottom:16px;">
                <tr><td style="font-size:13px;color:#FF385C;font-weight:700;padding-bottom:4px;">SOFŐR</td></tr>
                <tr><td style="font-size:14px;color:#222222;font-weight:700;">${driverProfile?.full_name ?? driverProfile?.username ?? "—"}</td></tr>
                <tr><td style="font-size:13px;color:#717171;">@${driverProfile?.username ?? "—"}</td></tr>
                ${contactRows(driverProfile?.phone, driverEmail)}
              </table>
              <p style="color:#717171;font-size:13px;">A foglalásod automatikusan lemondásra került. Nézz szét az aktuális hirdetések között, ha másik útra van szükséged.</p>`,
            ),
          );
          results.push({ target: `passenger:${bookingId}`, ok: true });
        } catch (err) {
          results.push({ target: `passenger:${bookingId}`, ok: false, error: String(err) });
        }
      }

      return new Response(JSON.stringify({ ok: true, event: notifyEvent, results }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ======================================================================
    // "booking_created" / "booking_cancelled" / "booking_updated":
    // egy adott foglalásra vonatkozó esemény
    // ======================================================================
    const bookingId: string | undefined = body.booking_id;
    if (!bookingId) {
      return new Response("Missing booking_id", { status: 400 });
    }

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, listing_id, passenger_id, seats_booked, status")
      .eq("id", bookingId)
      .single();
    if (bookingError || !booking) throw new Error(`Foglalás nem található: ${bookingError?.message}`);

    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("driver_id, from_city, to_city, ride_date, ride_time, price_huf, car_type, car_color, car_plate")
      .eq("id", booking.listing_id)
      .single();
    if (listingError || !listing) throw new Error(`Hirdetés nem található: ${listingError?.message}`);

    const passengerProfile = await lookupProfile(supabase, booking.passenger_id);
    const driverProfile = await lookupProfile(supabase, listing.driver_id);
    const [passengerEmail, driverEmail] = await Promise.all([
      lookupEmail(supabase, booking.passenger_id),
      lookupEmail(supabase, listing.driver_id),
    ]);

    const dateStr = fmtDate(listing.ride_date, listing.ride_time);
    const totalPrice = (listing.price_huf * booking.seats_booked).toLocaleString("hu-HU");
    const oldSeats: number | undefined = typeof body.old_seats === "number" ? body.old_seats : undefined;
    const seatsChangeText = oldSeats !== undefined && oldSeats !== booking.seats_booked
      ? ` (${oldSeats} helyről ${booking.seats_booked} helyre)`
      : "";

    const results: { target: string; ok: boolean; error?: string }[] = [];

    // ------------------------------------------------------------------
    // Utasnak szóló e-mail
    // ------------------------------------------------------------------
    const passengerContent = notifyEvent === "booking_cancelled"
      ? {
          subject: `Foglalásod lemondva — ${listing.from_city} → ${listing.to_city}`,
          title: "Foglalásod lemondva",
          body: `<p style="color:#222222;font-size:15px;line-height:1.5;">
              A(z) <strong>${booking.seats_booked}</strong> helyes foglalásod lemondásra került az alábbi útra:
            </p>
            <p style="font-size:16px;font-weight:700;color:#222222;margin:16px 0 4px;">${listing.from_city} → ${listing.to_city}</p>
            <p style="color:#717171;margin:0 0 16px;">${dateStr}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF0F2;border-radius:12px;padding:16px;margin-bottom:16px;">
              <tr><td style="font-size:13px;color:#FF385C;font-weight:700;padding-bottom:4px;">SOFŐR</td></tr>
              <tr><td style="font-size:14px;color:#222222;font-weight:700;">${driverProfile?.full_name ?? driverProfile?.username ?? "—"}</td></tr>
              <tr><td style="font-size:13px;color:#717171;">@${driverProfile?.username ?? "—"}</td></tr>
              ${contactRows(driverProfile?.phone, driverEmail)}
            </table>
            <p style="color:#717171;font-size:13px;">Ha tévedésből történt, vagy másik útra van szükséged, nézz szét az aktuális hirdetések között.</p>`,
        }
      : notifyEvent === "booking_updated"
      ? {
          subject: `Foglalásod módosítva — ${listing.from_city} → ${listing.to_city}`,
          title: "Foglalásod módosítva",
          body: `<p style="color:#222222;font-size:15px;line-height:1.5;">
              A foglalásod <strong>${booking.seats_booked}</strong> főre módosult${seatsChangeText} az alábbi útra:
            </p>
            <p style="font-size:16px;font-weight:700;color:#222222;margin:16px 0 4px;">${listing.from_city} → ${listing.to_city}</p>
            <p style="color:#717171;margin:0 0 16px;">${dateStr}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF0F2;border-radius:12px;padding:16px;margin-bottom:16px;">
              <tr><td style="font-size:13px;color:#FF385C;font-weight:700;padding-bottom:4px;">SOFŐR</td></tr>
              <tr><td style="font-size:14px;color:#222222;font-weight:700;">${driverProfile?.full_name ?? driverProfile?.username ?? "—"}</td></tr>
              <tr><td style="font-size:13px;color:#717171;">@${driverProfile?.username ?? "—"}</td></tr>
              ${contactRows(driverProfile?.phone, driverEmail)}
            </table>
            <p style="color:#222222;font-size:14px;"><strong>Összesen: ${totalPrice} Ft</strong></p>`,
        }
      : {
          subject: `Foglalásod megerősítve — ${listing.from_city} → ${listing.to_city}`,
          title: "Foglalásod megerősítve!",
          body: `<p style="color:#222222;font-size:15px;line-height:1.5;">
              Sikeresen lefoglaltál <strong>${booking.seats_booked}</strong> helyet az alábbi útra:
            </p>
            <p style="font-size:16px;font-weight:700;color:#222222;margin:16px 0 4px;">${listing.from_city} → ${listing.to_city}</p>
            <p style="color:#717171;margin:0 0 16px;">${dateStr}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF0F2;border-radius:12px;padding:16px;margin-bottom:16px;">
              <tr><td style="font-size:13px;color:#FF385C;font-weight:700;padding-bottom:4px;">SOFŐR</td></tr>
              <tr><td style="font-size:14px;color:#222222;font-weight:700;">${driverProfile?.full_name ?? driverProfile?.username ?? "—"}</td></tr>
              <tr><td style="font-size:13px;color:#717171;">@${driverProfile?.username ?? "—"}</td></tr>
              ${contactRows(driverProfile?.phone, driverEmail)}
              <tr><td style="font-size:13px;color:#717171;padding-top:8px;">Jármű: ${listing.car_type}${listing.car_color ? ` · ${listing.car_color}` : ""} · Rendszám: ${listing.car_plate ?? "—"}</td></tr>
            </table>
            <p style="color:#222222;font-size:14px;"><strong>Összesen: ${totalPrice} Ft</strong></p>`,
        };

    if (passengerEmail) {
      try {
        await sendMailgun(passengerEmail, passengerContent.subject, emailShell(passengerContent.title, passengerContent.body));
        results.push({ target: "passenger", ok: true });
      } catch (err) {
        results.push({ target: "passenger", ok: false, error: String(err) });
      }
    } else {
      results.push({ target: "passenger", ok: false, error: `no email found for passenger_id ${booking.passenger_id}` });
    }

    // ------------------------------------------------------------------
    // Sofőrnek szóló e-mail
    // ------------------------------------------------------------------
    const driverContent = notifyEvent === "booking_cancelled"
      ? {
          subject: `Egy utas lemondta a foglalását — ${listing.from_city} → ${listing.to_city}`,
          title: "Egy utasod lemondta a foglalását",
          body: `<p style="color:#222222;font-size:15px;line-height:1.5;">
              Egy utasod lemondta <strong>${booking.seats_booked}</strong> helyes foglalását a hirdetéseden:
            </p>
            <p style="font-size:16px;font-weight:700;color:#222222;margin:16px 0 4px;">${listing.from_city} → ${listing.to_city}</p>
            <p style="color:#717171;margin:0 0 16px;">${dateStr}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF0F2;border-radius:12px;padding:16px;">
              <tr><td style="font-size:13px;color:#FF385C;font-weight:700;padding-bottom:4px;">UTAS</td></tr>
              <tr><td style="font-size:14px;color:#222222;font-weight:700;">${passengerProfile?.full_name ?? passengerProfile?.username ?? "—"}</td></tr>
              <tr><td style="font-size:13px;color:#717171;">@${passengerProfile?.username ?? "—"}${passengerProfile?.phone ? ` · ${passengerProfile.phone}` : ""}</td></tr>
              ${passengerEmail ? `<tr><td style="font-size:13px;color:#717171;padding-top:4px;">✉️ ${passengerEmail}</td></tr>` : ""}
            </table>
            <p style="color:#717171;font-size:13px;margin-top:16px;">${booking.seats_booked} hely ismét szabaddá vált a hirdetéseden.</p>`,
        }
      : notifyEvent === "booking_updated"
      ? {
          subject: `Egy utas módosította a foglalását — ${listing.from_city} → ${listing.to_city}`,
          title: "Egy utasod módosította a foglalását",
          body: `<p style="color:#222222;font-size:15px;line-height:1.5;">
              Egy utasod <strong>${booking.seats_booked}</strong> főre módosította${seatsChangeText} a foglalását a hirdetéseden:
            </p>
            <p style="font-size:16px;font-weight:700;color:#222222;margin:16px 0 4px;">${listing.from_city} → ${listing.to_city}</p>
            <p style="color:#717171;margin:0 0 16px;">${dateStr}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF0F2;border-radius:12px;padding:16px;">
              <tr><td style="font-size:13px;color:#FF385C;font-weight:700;padding-bottom:4px;">UTAS</td></tr>
              <tr><td style="font-size:14px;color:#222222;font-weight:700;">${passengerProfile?.full_name ?? passengerProfile?.username ?? "—"}</td></tr>
              <tr><td style="font-size:13px;color:#717171;">@${passengerProfile?.username ?? "—"}${passengerProfile?.phone ? ` · ${passengerProfile.phone}` : ""}</td></tr>
              ${passengerEmail ? `<tr><td style="font-size:13px;color:#717171;padding-top:4px;">✉️ ${passengerEmail}</td></tr>` : ""}
            </table>`,
        }
      : {
          subject: `Új utas foglalt helyet — ${listing.from_city} → ${listing.to_city}`,
          title: "Új utasod érkezett!",
          body: `<p style="color:#222222;font-size:15px;line-height:1.5;">
              Valaki lefoglalt <strong>${booking.seats_booked}</strong> helyet a hirdetéseden:
            </p>
            <p style="font-size:16px;font-weight:700;color:#222222;margin:16px 0 4px;">${listing.from_city} → ${listing.to_city}</p>
            <p style="color:#717171;margin:0 0 16px;">${dateStr}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF0F2;border-radius:12px;padding:16px;">
              <tr><td style="font-size:13px;color:#FF385C;font-weight:700;padding-bottom:4px;">UTAS</td></tr>
              <tr><td style="font-size:14px;color:#222222;font-weight:700;">${passengerProfile?.full_name ?? passengerProfile?.username ?? "—"}</td></tr>
              <tr><td style="font-size:13px;color:#717171;">@${passengerProfile?.username ?? "—"}${passengerProfile?.phone ? ` · ${passengerProfile.phone}` : ""}</td></tr>
              ${passengerEmail ? `<tr><td style="font-size:13px;color:#717171;padding-top:4px;">✉️ ${passengerEmail}</td></tr>` : ""}
            </table>`,
        };

    if (driverEmail) {
      try {
        await sendMailgun(driverEmail, driverContent.subject, emailShell(driverContent.title, driverContent.body));
        results.push({ target: "driver", ok: true });
      } catch (err) {
        results.push({ target: "driver", ok: false, error: String(err) });
      }
    } else {
      results.push({ target: "driver", ok: false, error: `no email found for driver_id ${listing.driver_id}` });
    }

    return new Response(JSON.stringify({ ok: true, event: notifyEvent, results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-booking error:", err);
    // Sosem dobjunk 5xx-et a triggernek — a pg_net hívás fire-and-forget,
    // egy hibás e-mail-küldés soha nem hiúsíthatja meg magát a foglalást / lemondást / törlést / módosítást.
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
