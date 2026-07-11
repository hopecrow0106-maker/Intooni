-- Backfill data into the additive refactor schema.
-- This migration preserves all legacy columns and source data.

insert into public.categories (name, sort_order)
select distinct nullif(normalize(btrim(genre), NFC), ''), 0
from public.artists
where nullif(normalize(btrim(genre), NFC), '') is not null
on conflict (name) do nothing;

update public.artists artist
set main_category_id = category.id
from public.categories category
where artist.main_category_id is null
  and category.name = normalize(btrim(artist.genre), NFC);

update public.artists
set search_tags = public.normalize_text_array(hidden_tags)
where (search_tags is null or search_tags = '{}')
  and hidden_tags is not null
  and array_length(hidden_tags, 1) is not null;

update public.artists
set is_trending = is_hot
where is_hot = true
  and is_trending = false;

insert into public.artist_stats (
  artist_id,
  recorded_date,
  followers,
  post_count
)
select
  id,
  coalesce(last_stats_updated_at::date, current_date),
  greatest(coalesce(followers, 0), 0),
  greatest(coalesce(post_count, 0), 0)
from public.artists
where followers is not null
  and post_count is not null
on conflict (artist_id, recorded_date) do update
set
  followers = excluded.followers,
  post_count = excluded.post_count,
  updated_at = now();

insert into public.magazine_artists (magazine_id, artist_id, sort_order)
select
  magazine.id,
  related_artist_id,
  related_artist.ordinality - 1
from public.magazines magazine
cross join lateral unnest(magazine.related_artist_ids) with ordinality as related_artist(related_artist_id, ordinality)
where exists (
  select 1
  from public.artists artist
  where artist.id = related_artist.related_artist_id
)
on conflict (magazine_id, artist_id) do update
set sort_order = excluded.sort_order;

update public.artist_event_logs
set event_type = case
  when event_type in ('instagram_click', 'embed_click') then 'instagram_outbound'
  else 'artist_click'
end
where event_type in (
  'profile_click',
  'instagram_click',
  'embed_click',
  'hero_click',
  'toonbti_result_click',
  'toonbti_character_click',
  'random_click'
);

do $$
declare
  category_count integer;
  artist_category_count integer;
  search_tag_count integer;
  stat_count integer;
  magazine_artist_count integer;
begin
  select count(*) into category_count from public.categories;
  select count(*) into artist_category_count from public.artists where main_category_id is not null;
  select count(*) into search_tag_count from public.artists where array_length(search_tags, 1) is not null;
  select count(*) into stat_count from public.artist_stats;
  select count(*) into magazine_artist_count from public.magazine_artists;

  raise notice 'Backfill summary: categories=%, artists_with_category=%, artists_with_search_tags=%, legacy_stats=%, magazine_artists=%',
    category_count,
    artist_category_count,
    search_tag_count,
    stat_count,
    magazine_artist_count;
end
$$;
