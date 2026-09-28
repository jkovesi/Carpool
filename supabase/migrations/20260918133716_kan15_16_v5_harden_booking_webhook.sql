-- 1) A webhook megosztott titkát a Vault-ban tároljuk (titkosítva), nem
--    nyílt szövegként a függvény forráskódjában (ami pg_proc-on keresztül
--    más szerepkörök számára is olvasható lehetne).
select vault.create_secret(
  'L__PxaLiEnn32btmbVvC5e_28Wn88BilkZS5bH5oyx0',
  'booking_webhook_secret',
  'Megosztott titok a bookings INSERT trigger -> notify-booking Edge Function hívásához'
);

create or replace function public.notify_booking_created()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_secret text;
begin
  if NEW.status = 'active' then
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'booking_webhook_secret';
    perform net.http_post(
      url := 'https://yctezzkwrzncgsvzhbjk.supabase.co/functions/v1/notify-booking',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', v_secret
      ),
      body := jsonb_build_object('booking_id', NEW.id),
      timeout_milliseconds := 8000
    );
  end if;
  return NEW;
end;
$function$;

-- 2) A trigger-függvény kizárólag triggerként hívódjon, ne legyen közvetlenül
--    hívható /rest/v1/rpc/notify_booking_created végponton keresztül sem
--    anon, sem authenticated szerepkörrel (ellentétben a ténylegesen publikus
--    API-t alkotó RPC-kkel, mint a book_ride vagy create_listing).
revoke execute on function public.notify_booking_created() from public;
revoke execute on function public.notify_booking_created() from anon;
revoke execute on function public.notify_booking_created() from authenticated;
