-- BUG-02: a jármű törlésének zárolása is csak a még el nem indult, aktív
-- hirdetésekre vonatkozzon. (Külön fájl: a Supabase MCP a DELETE-et
-- tartalmazó migrációt csak külön jóváhagyással futtatja — a Supabase
-- SQL Editorban kell lefuttatni.)

create or replace function public.remove_vehicle(p_vehicle_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_owner_id uuid;
begin
  select owner_id into v_owner_id from public.vehicles where id = p_vehicle_id for update;

  if not found or v_owner_id != auth.uid() then
    raise exception 'A jármű nem található, vagy nem a tiéd.';
  end if;

  if public.vehicle_has_upcoming_active_listing(p_vehicle_id) then
    raise exception 'A jármű nem törölhető, mert van hozzá tartozó aktív hirdetés. Előbb töröld vagy zárd le az érintett hirdetést.';
  end if;

  delete from public.vehicles where id = p_vehicle_id;
end;
$function$;
