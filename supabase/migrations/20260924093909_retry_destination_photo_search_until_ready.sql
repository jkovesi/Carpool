create or replace function public.trigger_search_destination_photo() returns trigger
  language plpgsql security definer set search_path to 'public' as $function$
  declare
    v_destination text;
    v_secret text;
    v_status text;
  begin
    v_destination := public.normalize_destination(NEW.to_city);

    -- Biztosítjuk, hogy legyen sor erre a célállomásra (első alkalommal 'pending'-ként).
    insert into public.destination_photo_cache (destination, status, source)
      values (v_destination, 'pending', 'ai-search')
      on conflict (destination) do nothing;

    select status into v_status
      from public.destination_photo_cache
      where destination = v_destination;

    -- Ha még nincs sikeres ('ready') találat -- akár mert még nem is indult keresés,
    -- akár mert a korábbi próbálkozás 'failed'-del zárult --, minden újabb, erre a
    -- célállomásra létrehozott hirdetés újraindítja a háttérkeresést.
    if v_status is distinct from 'ready' then
      select decrypted_secret into v_secret
        from vault.decrypted_secrets
        where name = 'destination_photo_webhook_secret';

      perform net.http_post(
        url := 'https://yctezzkwrzncgsvzhbjk.supabase.co/functions/v1/search-destination-photo',
        headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret', v_secret),
        body := jsonb_build_object('destination', v_destination),
        timeout_milliseconds := 8000
      );
    end if;

    return NEW;
  end;
$function$;
