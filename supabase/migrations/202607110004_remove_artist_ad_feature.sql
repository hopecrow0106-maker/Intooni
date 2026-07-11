-- Remove the paid artist promotion ranking path while keeping the legacy
-- artists.is_ad column for rollback and older data compatibility.

drop index if exists public.artists_sort_order_idx;

update public.artists
set is_ad = false
where is_ad = true;

create index if not exists artists_sort_order_idx on public.artists (sort_order asc);
