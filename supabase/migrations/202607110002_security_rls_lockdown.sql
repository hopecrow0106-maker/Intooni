-- Security lockdown after public pages move to server-side DTO APIs.
-- This migration does not drop legacy columns or data.

revoke all on public.artists from anon, authenticated;
revoke all on public.artist_stats from anon, authenticated;
revoke all on public.artist_contacts from anon, authenticated;
revoke all on public.brand_categories from anon, authenticated;
revoke all on public.artist_recommended_brand_categories from anon, authenticated;
revoke all on public.artist_b2b_profiles from anon, authenticated;
revoke all on public.artist_collaborations from anon, authenticated;
revoke all on public.magazine_artists from anon, authenticated;
revoke all on public.sheet_sync_jobs from anon, authenticated;

drop policy if exists "Public read artists" on public.artists;
drop policy if exists "Prototype manage magazines" on public.magazines;

drop policy if exists "Public read artist toonbti option links" on public.artist_toonbti_option_links;
drop policy if exists "Public read toonbti question groups" on public.toonbti_question_groups;
drop policy if exists "Public read toonbti question options" on public.toonbti_question_options;

revoke all on public.artist_toonbti_option_links from anon, authenticated;
revoke all on public.toonbti_question_groups from anon, authenticated;
revoke all on public.toonbti_question_options from anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'magazines'
      and policyname = 'Public read published magazines'
  ) then
    create policy "Public read published magazines"
    on public.magazines
    for select
    to anon, authenticated
    using (is_public = true);
  end if;
end
$$;

grant select on public.categories to anon, authenticated;
grant select on public.magazines to anon, authenticated;

grant select, insert, update, delete on public.artists to service_role;
grant select, insert, update, delete on public.artist_stats to service_role;
grant select, insert, update, delete on public.artist_contacts to service_role;
grant select, insert, update, delete on public.brand_categories to service_role;
grant select, insert, update, delete on public.artist_recommended_brand_categories to service_role;
grant select, insert, update, delete on public.artist_b2b_profiles to service_role;
grant select, insert, update, delete on public.artist_collaborations to service_role;
grant select, insert, update, delete on public.magazine_artists to service_role;
grant select, insert, update, delete on public.sheet_sync_jobs to service_role;
grant select, insert, update, delete on public.toonbti_question_groups to service_role;
grant select, insert, update, delete on public.toonbti_question_options to service_role;
grant select, insert, update, delete on public.artist_toonbti_option_links to service_role;

comment on table public.artists is 'Source table locked from anon/authenticated direct reads. Public artist data is served through server DTO APIs.';
comment on table public.artist_stats is 'Official dated stats snapshots. Locked from anon/authenticated direct reads.';
