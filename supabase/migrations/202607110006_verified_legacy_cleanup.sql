-- Destructive finalization. Apply only after 001-005, backup, Admin/public smoke tests,
-- and a published new ToonBTI route map. Guards abort before any drop when migration
-- evidence is incomplete. Source values are copied to a private JSON backup table.

create table if not exists public.migration_legacy_backup (
  scope text not null,
  row_key text not null,
  payload jsonb not null,
  backed_up_at timestamptz not null default now(),
  primary key (scope, row_key)
);

alter table public.migration_legacy_backup enable row level security;
revoke all on public.migration_legacy_backup from anon, authenticated;
grant select, insert, update, delete on public.migration_legacy_backup to service_role;

do $$
begin
  if exists (
    select 1
    from public.artists
    where nullif(normalize(btrim(genre), NFC), '') is not null
      and main_category_id is null
  ) then
    raise exception 'cleanup blocked: non-empty legacy genre remains without main_category_id';
  end if;

  if exists (
    select 1
    from public.artists artist
    where not exists (
      select 1 from public.artist_stats stat where stat.artist_id = artist.id
    )
  ) then
    raise exception 'cleanup blocked: at least one artist has no artist_stats snapshot';
  end if;

  if exists (
    select 1
    from public.artists
    where not (
      public.normalize_text_array(coalesce(search_tags, '{}'::text[]))
      @> public.normalize_text_array(coalesce(hidden_tags, '{}'::text[]))
    )
  ) then
    raise exception 'cleanup blocked: hidden_tags values are not preserved in search_tags';
  end if;

  if exists (
    select 1
    from public.artists
    where is_hot = true and is_trending = false
  ) then
    raise exception 'cleanup blocked: is_hot values are not preserved in is_trending';
  end if;

  if exists (
    select 1
    from public.magazines magazine
    cross join lateral unnest(magazine.related_artist_ids) as legacy(artist_id)
    where exists (select 1 from public.artists where id = legacy.artist_id)
      and not exists (
        select 1
        from public.magazine_artists relation
        where relation.magazine_id = magazine.id
          and relation.artist_id = legacy.artist_id
      )
  ) then
    raise exception 'cleanup blocked: magazine related_artist_ids are not fully migrated';
  end if;

  if (
    exists (select 1 from public.toonbti_question_groups)
    or exists (select 1 from public.toonbti_question_options)
    or exists (select 1 from public.artist_toonbti_option_links)
  ) and not exists (
    select 1 from public.toon_tests where status = 'published'
  ) then
    raise exception 'cleanup blocked: publish the new ToonBTI route map before dropping legacy data';
  end if;
end
$$;

update public.artists
set internal_memo = normalize(btrim(memo), NFC)
where nullif(btrim(memo), '') is not null
  and nullif(btrim(internal_memo), '') is null;

insert into public.migration_legacy_backup (scope, row_key, payload)
select 'artists_legacy_columns', id::text, to_jsonb(artist)
from public.artists artist
on conflict (scope, row_key) do update
set payload = excluded.payload,
    backed_up_at = now();

insert into public.migration_legacy_backup (scope, row_key, payload)
select 'magazines_related_artist_ids', id::text, to_jsonb(magazine)
from public.magazines magazine
on conflict (scope, row_key) do update
set payload = excluded.payload,
    backed_up_at = now();

insert into public.migration_legacy_backup (scope, row_key, payload)
select 'toonbti_question_groups', id::text, to_jsonb(source)
from public.toonbti_question_groups source
on conflict (scope, row_key) do update
set payload = excluded.payload,
    backed_up_at = now();

insert into public.migration_legacy_backup (scope, row_key, payload)
select 'toonbti_question_options', id::text, to_jsonb(source)
from public.toonbti_question_options source
on conflict (scope, row_key) do update
set payload = excluded.payload,
    backed_up_at = now();

insert into public.migration_legacy_backup (scope, row_key, payload)
select
  'artist_toonbti_option_links',
  artist_id::text || ':' || option_id::text,
  to_jsonb(source)
from public.artist_toonbti_option_links source
on conflict (scope, row_key) do update
set payload = excluded.payload,
    backed_up_at = now();

alter table public.artists
  drop column if exists genre,
  drop column if exists followers,
  drop column if exists post_count,
  drop column if exists weekly_follower_growth,
  drop column if exists weekly_post_growth,
  drop column if exists weekly_follower_growth_rate,
  drop column if exists weekly_post_growth_rate,
  drop column if exists stats_period_start,
  drop column if exists stats_period_end,
  drop column if exists last_stats_updated_at,
  drop column if exists is_ad,
  drop column if exists is_hot,
  drop column if exists hidden_tags,
  drop column if exists episode_formats,
  drop column if exists avg_likes,
  drop column if exists memo;

alter table public.magazines
  drop column if exists related_artist_ids;

drop table if exists public.artist_toonbti_option_links;
drop table if exists public.toonbti_question_options;
drop table if exists public.toonbti_question_groups;

comment on table public.migration_legacy_backup is
  'Private rollback evidence captured immediately before verified legacy cleanup.';
