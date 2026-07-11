-- INTOONI post-migration verification. Read-only query only.

with
required_tables(table_name) as (
  values
    ('artist_stats'),
    ('artist_contacts'),
    ('brand_categories'),
    ('artist_collaborations'),
    ('artist_b2b_profiles'),
    ('magazine_artists'),
    ('toon_tests'),
    ('toon_nodes'),
    ('toon_edges'),
    ('toon_result_artists'),
    ('migration_legacy_backup')
),
required_artist_columns(column_name) as (
  values
    ('status'),
    ('show_on_site'),
    ('show_growth_on_site'),
    ('hide_from_new'),
    ('main_category_id'),
    ('search_tags')
),
required_collaboration_columns(column_name) as (
  values
    ('artist_id'),
    ('brand_name'),
    ('content_summary'),
    ('post_url'),
    ('collaboration_year'),
    ('collaboration_month')
),
protected_tables(table_name) as (
  values
    ('artists'),
    ('artist_stats'),
    ('artist_contacts'),
    ('artist_collaborations'),
    ('artist_b2b_profiles'),
    ('magazine_artists'),
    ('toon_tests')
)
select
  jsonb_build_object(
    'artists', (select count(*) from public.artists),
    'categories', (select count(*) from public.categories),
    'artist_stats', (select count(*) from public.artist_stats),
    'magazines', (select count(*) from public.magazines),
    'magazine_artists', (select count(*) from public.magazine_artists),
    'artist_collaborations', (select count(*) from public.artist_collaborations),
    'legacy_backup_rows', (select count(*) from public.migration_legacy_backup)
  ) as row_counts,
  array(
    select required.table_name
    from required_tables required
    where not exists (
      select 1
      from information_schema.tables existing
      where existing.table_schema = 'public'
        and existing.table_name = required.table_name
    )
    order by required.table_name
  ) as missing_tables,
  array(
    select required.column_name
    from required_artist_columns required
    where not exists (
      select 1
      from information_schema.columns existing
      where existing.table_schema = 'public'
        and existing.table_name = 'artists'
        and existing.column_name = required.column_name
    )
    order by required.column_name
  ) as missing_artist_columns,
  array(
    select required.column_name
    from required_collaboration_columns required
    where not exists (
      select 1
      from information_schema.columns existing
      where existing.table_schema = 'public'
        and existing.table_name = 'artist_collaborations'
        and existing.column_name = required.column_name
    )
    order by required.column_name
  ) as missing_collaboration_columns,
  array(
    select protected.table_name
    from protected_tables protected
    left join pg_class relation
      on relation.relnamespace = 'public'::regnamespace
     and relation.relname = protected.table_name
    where coalesce(relation.relrowsecurity, false) = false
    order by protected.table_name
  ) as rls_disabled_tables,
  (
    select count(*)
    from public.artists artist
    where not exists (
      select 1
      from public.artist_stats stat
      where stat.artist_id = artist.id
    )
  ) as artists_without_stats,
  array(
    select distinct grant_row.grantee || ':' || grant_row.table_name || ':' || grant_row.privilege_type
    from information_schema.role_table_grants grant_row
    join protected_tables protected on protected.table_name = grant_row.table_name
    where grant_row.table_schema = 'public'
      and grant_row.grantee in ('anon', 'authenticated')
    order by grant_row.grantee || ':' || grant_row.table_name || ':' || grant_row.privilege_type
  ) as anon_authenticated_grants;
