-- Az elozo migracioban (revoke_unnecessary_public_rpc_execute) a
-- "revoke execute ... from anon, authenticated" nem volt eleg: uj
-- fuggveny letrehozasakor a Postgres automatikusan EXECUTE jogot ad a
-- PUBLIC pszeudo-szerepkornek, es mivel minden szerepkor (igy az anon is)
-- tagja a PUBLIC-nak, ez a jog "atszivarog" fuggetlenul attol, hogy az
-- anon/authenticated szerepkortol kulon mar visszavontuk. A helyes
-- javitas: kifejezetten a PUBLIC-tol kell visszavonni, majd -- ahol
-- szukseges -- kifejezetten visszaadni az authenticated szerepkornek.

revoke execute on function public.handle_user_email_updated() from public;

revoke execute on function public.count_new_passengers() from public;
grant execute on function public.count_new_passengers() to authenticated;

revoke execute on function public.mark_passengers_viewed() from public;
grant execute on function public.mark_passengers_viewed() to authenticated;
