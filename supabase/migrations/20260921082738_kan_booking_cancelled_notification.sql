-- Lemondás e-mail értesítés a foglalás-létrehozás mintájára (KAN-15/16 bővítés).
-- Akkor sül el, ha egy bookings sor status mezője 'active'-ból bármi másra vált
-- 'cancelled'-re (akár az utas saját maga mondja le a foglalását a
-- cancel_booking() RPC-vel, akár a sofőr mondja le a teljes hirdetést a
-- cancel_listing() RPC-vel, ami kaszkádban lemondja az aktív foglalásokat is).
create or replace function public.notify_booking_cancelled()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_secret text;
begin
  if OLD.status is distinct from NEW.status and NEW.status = 'cancelled' then
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'booking_webhook_secret';
    perform net.http_post(
      url := 'https://yctezzkwrzncgsvzhbjk.supabase.co/functions/v1/notify-booking',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', v_secret
      ),
      body := jsonb_build_object('booking_id', NEW.id, 'event', 'booking_cancelled'),
      timeout_milliseconds := 8000
    );
  end if;
  return NEW;
end;
$function$;

create trigger trg_notify_booking_cancelled
after update on public.bookings
for each row
execute function public.notify_booking_cancelled();

-- Ugyanaz a hardening, mint a notify_booking_created()-nél: ez a függvény
-- kizárólag a saját triggerünkből hívódhat, PostgREST RPC-n keresztül nem.
revoke execute on function public.notify_booking_cancelled() from public;
revoke execute on function public.notify_booking_cancelled() from anon;
revoke execute on function public.notify_booking_cancelled() from authenticated;
