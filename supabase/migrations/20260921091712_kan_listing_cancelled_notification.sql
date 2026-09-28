-- Hirdetés-törlés e-mail értesítés: a sofőr + minden érintett (a törléskor
-- aktív foglalással rendelkező) utas kap értesítést, a szövegezés jelzi,
-- hogy a sofőr törölte az utat. Emellett elnyomjuk az egyedi
-- "booking_cancelled" e-mailt azokra a foglalásokra, amiket ez a kaszkád
-- mond le, hogy ne menjen ki két, egymásnak ellentmondó e-mail.

-- 1) notify_booking_cancelled(): kihagyja a küldést, ha a cancel_listing()
--    állította be az elnyomó session flaget.
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
    if coalesce(current_setting('app.suppress_booking_cancel_notify', true), '') = 'true' then
      return NEW;
    end if;
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

-- 2) notify_listing_cancelled(): a listings UPDATE utáni AFTER trigger MÉG A
--    bookings kaszkád UPDATE ELŐTT fut le (mert az a cancel_listing()
--    függvényben a következő statement), így itt még pontosan látjuk, mely
--    foglalások aktívak és fognak lemondásra kerülni — ezeket a booking_id
--    listát adjuk át a webhook body-ban.
create or replace function public.notify_listing_cancelled()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_secret text;
  v_booking_ids jsonb;
begin
  if OLD.status is distinct from NEW.status and NEW.status = 'cancelled' then
    select coalesce(jsonb_agg(id), '[]'::jsonb) into v_booking_ids
    from public.bookings
    where listing_id = NEW.id and status = 'active';

    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'booking_webhook_secret';
    perform net.http_post(
      url := 'https://yctezzkwrzncgsvzhbjk.supabase.co/functions/v1/notify-booking',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', v_secret
      ),
      body := jsonb_build_object('listing_id', NEW.id, 'event', 'listing_cancelled', 'booking_ids', v_booking_ids),
      timeout_milliseconds := 8000
    );
  end if;
  return NEW;
end;
$function$;

create trigger trg_notify_listing_cancelled
after update on public.listings
for each row
execute function public.notify_listing_cancelled();

revoke execute on function public.notify_listing_cancelled() from public;
revoke execute on function public.notify_listing_cancelled() from anon;
revoke execute on function public.notify_listing_cancelled() from authenticated;

-- 3) cancel_listing(): állítsa be az elnyomó flaget a bookings kaszkád
--    UPDATE előtt, hogy a notify_booking_cancelled() trigger ne küldjön
--    külön e-mailt ezekre a foglalásokra.
create or replace function public.cancel_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_driver_id uuid;
begin
  select driver_id into v_driver_id from public.listings where id = p_listing_id for update;

  if not found then
    raise exception 'A hirdetés nem található.';
  end if;

  if v_driver_id != auth.uid() then
    raise exception 'Nincs jogosultságod ehhez a hirdetéshez.';
  end if;

  update public.listings set status = 'cancelled', updated_at = now() where id = p_listing_id;

  perform set_config('app.suppress_booking_cancel_notify', 'true', true);
  update public.bookings set status = 'cancelled' where listing_id = p_listing_id and status = 'active';
end;
$function$;
