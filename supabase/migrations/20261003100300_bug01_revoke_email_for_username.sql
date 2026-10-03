-- BUG-01 (Kritikus): az email_for_username RPC bárki (anon) számára kiadta
-- bármely felhasználó e-mail címét. A felhasználónévvel történő bejelentkezés
-- mostantól a "login" Edge Functionben, szerveroldalon oldja fel a címet, így a
-- függvényre a kliensnek nincs szüksége.
-- FONTOS: csak az új frontend élesítése UTÁN alkalmazandó (a régi frontend még
-- ezt hívja a felhasználónév-alapú bejelentkezéshez).

revoke execute on function public.email_for_username(text) from public, anon, authenticated;
