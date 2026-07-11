-- Restore the pre-refactor growth baseline as a dated artist_stats snapshot.
-- The cleanup migration preserved every legacy artist row in migration_legacy_backup.

with legacy_growth_baseline as (
  select
    row_key::uuid as artist_id,
    (payload ->> 'stats_period_start')::date as recorded_date,
    greatest(
      (payload ->> 'followers')::integer
        - coalesce((payload ->> 'weekly_follower_growth')::integer, 0),
      0
    ) as followers,
    greatest(
      (payload ->> 'post_count')::integer
        - coalesce((payload ->> 'weekly_post_growth')::integer, 0),
      0
    ) as post_count
  from public.migration_legacy_backup
  where scope = 'artists_legacy_columns'
    and coalesce(payload ->> 'stats_period_start', '') ~ '^\d{4}-\d{2}-\d{2}$'
    and coalesce(payload ->> 'followers', '') ~ '^\d+$'
    and coalesce(payload ->> 'post_count', '') ~ '^\d+$'
    and coalesce(payload ->> 'weekly_follower_growth', '0') ~ '^-?\d+$'
    and coalesce(payload ->> 'weekly_post_growth', '0') ~ '^-?\d+$'
)
insert into public.artist_stats (
  artist_id,
  recorded_date,
  followers,
  post_count
)
select
  baseline.artist_id,
  baseline.recorded_date,
  baseline.followers,
  baseline.post_count
from legacy_growth_baseline baseline
where exists (
  select 1
  from public.artists artist
  where artist.id = baseline.artist_id
)
and exists (
  select 1
  from public.artist_stats current_stat
  where current_stat.artist_id = baseline.artist_id
    and current_stat.recorded_date > baseline.recorded_date
)
on conflict (artist_id, recorded_date) do nothing;
