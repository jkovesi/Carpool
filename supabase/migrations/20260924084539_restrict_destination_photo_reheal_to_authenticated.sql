revoke execute on function public.request_destination_photo_reheal(text) from public;
revoke execute on function public.request_destination_photo_reheal(text) from anon;
grant execute on function public.request_destination_photo_reheal(text) to authenticated;

revoke execute on function public.trigger_search_destination_photo() from public;
revoke execute on function public.trigger_search_destination_photo() from anon;
revoke execute on function public.trigger_search_destination_photo() from authenticated;
