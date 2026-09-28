-- A biztonsagi advisor tovabbi (WARN szintu) talalatainak zart resze:
-- olyan fuggvenyek, amik nem-authentikalt (anon) hivo szamara semmilyen
-- funkcionalis okbol nem kellenek elerhetonek, csak azert jelentek meg
-- RPC-kent hivhatonak, mert alapertelmezetten minden public sema-beli
-- fuggveny automatikusan PostgREST vegpontot kap.
--  - handle_user_email_updated(): kizarolag trigger-kent hasznalt fuggveny,
--    sosem kene kozvetlenul, RPC-kent hivhatonak lennie (sem anon, sem
--    authenticated szamara).
--  - count_new_passengers() / mark_passengers_viewed(): a sofor sajat
--    "Utasaim" jelzoszamahoz tartoznak, csak bejelentkezve ertelmesek --
--    anon hivo eseten amugy is auth.uid() = null miatt no-op/0 eredmenyt
--    adnanak, de a felesleges anon elerest lezarjuk (ugyanaz a mintazat,
--    mint a korabbi revoke_anon_execute_on_update_booking migracioban).
--
-- FONTOS: az email_for_username() SZANDEKOSAN marad anon-hivhato -- ez a
-- felhasznalonevvel torteno bejelentkezes (signInWithIdentifier) resze,
-- ennek elvetele torne a funkciot. Ez a fuggveny viszont onmagaban is egy
-- valodi, komolyabb adatvedelmi kockazat (barki, bejelentkezes nelkul
-- lekerdezheti barmely felhasznalonevhez tartozo valodi e-mail cimet) --
-- ennek rendes javitasa (szerver oldali, Edge Function-alapu
-- bejelentkezesi folyamatra atallitas) kulon feladat, lasd a
-- supabase/README.md-t.
--
-- MEGJEGYZES: ez a lepes onmagaban nem volt eleg (lasd a kovetkezo,
-- revoke_public_execute_fix migraciot) -- a PUBLIC pszeudo-szerepkortol is
-- kifejezetten vissza kellett vonni a jogot.

revoke execute on function public.handle_user_email_updated() from anon, authenticated;
revoke execute on function public.count_new_passengers() from anon;
revoke execute on function public.mark_passengers_viewed() from anon;
