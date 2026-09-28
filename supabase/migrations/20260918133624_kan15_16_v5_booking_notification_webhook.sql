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
        'x-webhook-secret', 'L__PxaLiEnn32btmbVvC5e_28Wn88BilkZS5bH5oyx0'
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
