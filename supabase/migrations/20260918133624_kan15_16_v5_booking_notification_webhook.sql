create extension if not exists pg_net;

create or replace function public.notify_booking_created()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if NEW.status = 'active' then
    perform net.http_post(
      url := 'https://yctezzkwrzncgsvzhbjk.supabase.co/functions/v1/notify-booking',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        -- 2026-09-28: az eredetileg itt szereplő, nyílt szövegű titkot
        -- (amit a GitHub secret scanning [GitGuardian] valós, publikusan
        -- kitett titokként jelzett) eltávolítottuk és rotáltuk -- a régi
        -- érték mostantól érvénytelen. Lásd supabase/README.md.
        'x-webhook-secret', '[REDACTED-ROTATED-2026-09-28]'
      ),
      body := jsonb_build_object('booking_id', NEW.id),
      timeout_milliseconds := 8000
    );
  end if;
  return NEW;
end;
$function$;

drop trigger if exists trg_notify_booking_created on public.bookings;
create trigger trg_notify_booking_created
after insert on public.bookings
for each row
execute function public.notify_booking_created();
