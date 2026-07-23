import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const schemaPath = path.join(process.cwd(), "supabase", "schema.sql");

const migrationFiles = {
  baseline: "202607110000_legacy_baseline.sql",
  additive: "202607110001_db_refactor_additive.sql",
  security: "202607110002_security_rls_lockdown.sql",
  backfill: "202607110003_db_refactor_backfill.sql",
  removeAd: "202607110004_remove_artist_ad_feature.sql",
  toonRouteMap: "202607110005_toon_test_route_map.sql",
  cleanup: "202607110006_verified_legacy_cleanup.sql",
  collaborationContent: "202607110007_add_collaboration_content_summary.sql",
  legacyGrowthBaseline: "202607110008_backfill_legacy_growth_baseline.sql",
  schemaHousekeeping: "202607110009_schema_housekeeping.sql",
  domainClassification: "202607110010_domain_classification.sql",
  publicBioBackfill: "202607130011_backfill_public_bio_from_internal_memo.sql",
  collaborationSimplification: "202607230012_simplify_artist_collaborations.sql"
} as const;

function readMigration(fileName: string) {
  return readFileSync(path.join(migrationsDir, fileName), "utf8");
}

function normalizeSql(sql: string) {
  return sql.toLowerCase().replace(/\s+/g, " ").trim();
}

describe("Supabase refactor migrations", () => {
  it("keeps the prepared migration sequence explicit and ordered", () => {
    const files = readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();

    expect(files).toEqual([
      migrationFiles.baseline,
      migrationFiles.additive,
      migrationFiles.security,
      migrationFiles.backfill,
      migrationFiles.removeAd,
      migrationFiles.toonRouteMap,
      migrationFiles.cleanup,
      migrationFiles.collaborationContent,
      migrationFiles.legacyGrowthBaseline,
      migrationFiles.schemaHousekeeping,
      migrationFiles.domainClassification,
      migrationFiles.publicBioBackfill,
      migrationFiles.collaborationSimplification
    ]);
  });

  it("provides an idempotent baseline so a fresh database has every pre-refactor table", () => {
    const sql = normalizeSql(readMigration(migrationFiles.baseline));
    for (const table of [
      "categories",
      "artists",
      "magazines",
      "artist_event_logs",
      "search_query_logs",
      "toonbti_question_groups",
      "toonbti_question_options",
      "artist_toonbti_option_links"
    ]) {
      expect(sql).toContain(`create table if not exists public.${table}`);
    }
    expect(sql).not.toMatch(/\b(drop\s+column|drop\s+table|truncate)\b/);
  });

  it("creates the additive target schema without dropping legacy data", () => {
    const sql = normalizeSql(readMigration(migrationFiles.additive));

    expect(sql).toContain("create type public.artist_status as enum ('active', 'hidden', 'archived')");
    expect(sql).toContain("add column if not exists main_category_id uuid references public.categories(id) on delete restrict");
    expect(sql).toContain("add column if not exists search_tags text[] not null default '{}'");
    expect(sql).toContain("add column if not exists show_on_site boolean not null default true");
    expect(sql).toContain("add column if not exists show_growth_on_site boolean not null default true");
    expect(sql).toContain("add column if not exists is_trending boolean not null default false");
    expect(sql).toContain("add column if not exists status public.artist_status not null default 'active'");
    expect(sql).toContain("add column if not exists internal_memo text not null default ''");
    expect(sql).toContain("create or replace function public.normalize_text_array(input_values text[])");
    expect(sql).toContain("new.instagram_handle = lower(normalize(regexp_replace(btrim(new.instagram_handle), '^@', ''), nfc))");
    expect(sql).toContain("create unique index if not exists categories_name_nfc_unique_idx");
    expect(sql).toContain("create unique index if not exists brand_categories_name_nfc_unique_idx");
    expect(sql).toContain("create trigger normalize_artists_text");

    expect(sql).toContain("create table if not exists public.artist_stats");
    expect(sql).toContain("recorded_date date not null");
    expect(sql).toContain("followers integer not null check (followers >= 0)");
    expect(sql).toContain("post_count integer not null check (post_count >= 0)");
    expect(sql).toContain("unique (artist_id, recorded_date)");

    expect(sql).toContain("create table if not exists public.artist_contacts");
    expect(sql).toContain("artist_id uuid primary key references public.artists(id) on delete restrict");
    expect(sql).not.toContain("contact_url text");
    expect(sql).not.toContain("manager_name text");
    expect(sql).not.toContain("manager_contact text");
    expect(sql).toContain("create table if not exists public.brand_categories");
    expect(sql).toContain("create table if not exists public.artist_recommended_brand_categories");
    expect(sql).toContain("create table if not exists public.artist_b2b_profiles");
    expect(sql).toContain("strengths text not null default ''");
    expect(sql).toContain("cautions text not null default ''");
    expect(sql).toContain("brand_safety_grade text check (brand_safety_grade is null or brand_safety_grade in ('unknown', 'safe', 'normal', 'caution'))");
    expect(sql).not.toContain("portfolio_url text");
    expect(sql).toContain("create table if not exists public.artist_collaborations");
    expect(sql).toContain("create or replace function public.admin_replace_artist_b2b_profile");
    expect(sql).toContain("security definer");
    expect(sql).toContain("grant execute on function public.admin_replace_artist_b2b_profile");
    expect(sql).toContain("collaboration_year smallint not null");
    expect(sql).toContain("collaboration_month smallint");
    expect(sql).toContain("content_summary text not null default ''");
    expect(sql).toContain("ad_disclosure_status text not null default 'unknown'");
    expect(sql).toContain("views bigint check (views is null or views >= 0)");
    expect(sql).toContain("check (collaboration_year >= 2000)");
    expect(sql).toContain("check (collaboration_month is null or collaboration_month between 1 and 12)");
    expect(sql).toContain("create table if not exists public.magazine_artists");
    expect(sql).toContain("create table if not exists public.sheet_sync_jobs");

    expect(sql).toContain("alter table public.artist_stats enable row level security");
    expect(sql).toContain("revoke all on public.artist_stats from anon, authenticated");
    expect(sql).toContain("grant select, insert, update, delete on public.artist_stats to service_role");
    expect(sql).toContain("comment on column public.artists.internal_memo");
    expect(sql).not.toMatch(/\b(drop\s+column|drop\s+table|truncate)\b/);
  });

  it("locks source tables from public roles while keeping service-role operations possible", () => {
    const sql = normalizeSql(readMigration(migrationFiles.security));

    expect(sql).toContain("revoke all on public.artists from anon, authenticated");
    expect(sql).toContain("revoke all on public.artist_stats from anon, authenticated");
    expect(sql).toContain("revoke all on public.artist_contacts from anon, authenticated");
    expect(sql).toContain("revoke all on public.artist_b2b_profiles from anon, authenticated");
    expect(sql).toContain("revoke all on public.artist_collaborations from anon, authenticated");
    expect(sql).toContain("drop policy if exists \"public read artists\" on public.artists");
    expect(sql).toContain("create policy \"public read published magazines\"");
    expect(sql).toContain("using (is_public = true)");
    expect(sql).toContain("grant select on public.categories to anon, authenticated");
    expect(sql).toContain("grant select, insert, update, delete on public.artists to service_role");
    expect(sql).toContain("grant select, insert, update, delete on public.artist_stats to service_role");
    expect(sql).not.toMatch(/\b(drop\s+column|drop\s+table|truncate)\b/);
  });

  it("backfills legacy columns into the new structures without cleanup drops", () => {
    const sql = normalizeSql(readMigration(migrationFiles.backfill));

    expect(sql).toContain("insert into public.categories (name, sort_order)");
    expect(sql).toContain("select distinct nullif(normalize(btrim(genre), nfc), ''), 0");
    expect(sql).toContain("set main_category_id = category.id");
    expect(sql).toContain("set search_tags = public.normalize_text_array(hidden_tags)");
    expect(sql).toContain("set is_trending = is_hot");
    expect(sql).toContain("insert into public.artist_stats");
    expect(sql).not.toContain("source text not null default 'collector'");
    expect(sql).not.toContain("raw_collected_at");
    expect(sql).toContain("insert into public.magazine_artists");
    expect(sql).toContain("with ordinality");
    expect(sql).toContain(
      "when event_type in ('instagram_click', 'embed_click') then 'instagram_outbound'"
    );
    expect(sql).toContain("else 'artist_click'");
    expect(sql).not.toMatch(/\b(drop\s+column|drop\s+table|truncate)\b/);
  });

  it("restores the preserved legacy growth baseline as an idempotent snapshot", () => {
    const sql = normalizeSql(readMigration(migrationFiles.legacyGrowthBaseline));

    expect(sql).toContain("from public.migration_legacy_backup");
    expect(sql).toContain("weekly_follower_growth");
    expect(sql).toContain("weekly_post_growth");
    expect(sql).toContain("insert into public.artist_stats");
    expect(sql).toContain("on conflict (artist_id, recorded_date) do nothing");
    expect(sql).not.toMatch(/\b(drop|truncate|delete)\b/);
  });

  it("adds query indexes and descriptions without changing stored rows", () => {
    const sql = normalizeSql(readMigration(migrationFiles.schemaHousekeeping));

    expect(sql).toContain("create index if not exists artist_stats_recorded_date_idx");
    expect(sql).toContain("create index if not exists artist_collaborations_artist_date_idx");
    expect(sql).toContain("create index if not exists sheet_sync_jobs_status_created_idx");
    expect(sql).toContain("comment on table public.magazine_artists");
    expect(sql).not.toMatch(/\b(insert|update|delete|drop|truncate)\b/);
  });

  it("classifies every target table through metadata without moving data", () => {
    const sql = normalizeSql(readMigration(migrationFiles.domainClassification));

    for (const domain of ["core", "business", "editorial", "toonbti", "analytics", "ops"]) {
      expect(sql).toContain(`'[${domain}]`);
    }
    expect(sql).toContain("comment on table public.artists");
    expect(sql).toContain("comment on table public.artist_collaborations");
    expect(sql).toContain("comment on table public.magazine_artists");
    expect(sql).toContain("comment on table public.toon_tests");
    expect(sql).toContain("comment on table public.artist_event_logs");
    expect(sql).toContain("comment on table public.sheet_sync_jobs");
    expect(sql).not.toMatch(/\b(insert|update|delete|drop|truncate|alter\s+table|create\s+table)\b/);
  });

  it("removes paid artist promotion ranking without deleting the rollback column", () => {
    const sql = normalizeSql(readMigration(migrationFiles.removeAd));

    expect(sql).toContain("drop index if exists public.artists_sort_order_idx");
    expect(sql).toContain("set is_ad = false");
    expect(sql).toContain("where is_ad = true");
    expect(sql).toContain("create index if not exists artists_sort_order_idx on public.artists (sort_order asc)");
    expect(sql).not.toMatch(/\bdrop\s+column\b/);
  });

  it("persists the new question/result route map behind private source tables", () => {
    const sql = normalizeSql(readMigration(migrationFiles.toonRouteMap));

    expect(sql).toContain("create table if not exists public.toon_tests");
    expect(sql).toContain("create table if not exists public.toon_nodes");
    expect(sql).toContain("create table if not exists public.toon_edges");
    expect(sql).toContain("create table if not exists public.toon_result_artists");
    expect(sql).toContain("status text not null default 'draft' check (status in ('draft', 'published'))");
    expect(sql).toContain("artist_id uuid not null references public.artists(id) on delete restrict");
    expect(sql).toContain("revoke all on public.toon_tests from anon, authenticated");
    expect(sql).toContain("grant select, insert, update, delete on public.toon_tests to service_role");
    expect(sql).not.toMatch(/\b(drop\s+column|drop\s+table|truncate)\b/);
  });

  it("adds simplified collaboration fields and backfills legacy values without deleting data", () => {
    const sql = normalizeSql(readMigration(migrationFiles.collaborationSimplification));

    expect(sql).toContain("add column if not exists brand_industry text not null default ''");
    expect(sql).toContain("add column if not exists collaboration_date text not null default ''");
    expect(sql).toContain("set brand_industry = coalesce(category.name, '')");
    expect(sql).toContain("right(collaboration_year::text, 2)");
    expect(sql).toContain("lpad(collaboration_month::text, 2, '0')");
    expect(sql).toContain("advertising disclosure is treated as mandatory");
    expect(sql).toContain("view counts are no longer collected");
    expect(sql).not.toMatch(/\b(drop\s+column|drop\s+table|truncate)\b/);
  });

  it("guards, backs up, and then removes verified legacy structures", () => {
    const sql = normalizeSql(readMigration(migrationFiles.cleanup));

    expect(sql).toContain("create table if not exists public.migration_legacy_backup");
    expect(sql).toContain("cleanup blocked: at least one artist has no artist_stats snapshot");
    expect(sql).toContain("cleanup blocked: magazine related_artist_ids are not fully migrated");
    expect(sql).toContain("publish the new toonbti route map before dropping legacy data");
    expect(sql).toContain("insert into public.migration_legacy_backup");
    for (const column of [
      "genre",
      "followers",
      "post_count",
      "is_ad",
      "is_hot",
      "hidden_tags",
      "episode_formats",
      "memo",
      "related_artist_ids"
    ]) {
      expect(sql).toContain(`drop column if exists ${column}`);
    }
    expect(sql).toContain("drop table if exists public.artist_toonbti_option_links");
    expect(sql).toContain("drop table if exists public.toonbti_question_options");
    expect(sql).toContain("drop table if exists public.toonbti_question_groups");
  });

  it("keeps the local schema snapshot aligned with the refactor security model", () => {
    const sql = normalizeSql(readFileSync(schemaPath, "utf8"));

    expect(sql).toContain("create table if not exists public.artist_stats");
    expect(sql).toContain("create table if not exists public.artist_contacts");
    expect(sql).toContain("artist_id uuid primary key references public.artists(id) on delete restrict");
    expect(sql).toContain("create table if not exists public.artist_b2b_profiles");
    expect(sql).toContain("strengths text not null default ''");
    expect(sql).toContain("cautions text not null default ''");
    expect(sql).toContain("create table if not exists public.artist_collaborations");
    expect(sql).toContain("brand_industry text not null default ''");
    expect(sql).toContain("collaboration_date text not null default ''");
    expect(sql).toContain("collaboration_year smallint not null");
    expect(sql).toContain("content_summary text not null default ''");
    expect(sql).toContain("views bigint check (views is null or views >= 0)");
    expect(sql).toContain("create table if not exists public.sheet_sync_jobs");
    expect(sql).toContain("create table if not exists public.migration_legacy_backup");
    expect(sql).toContain("revoke all on public.artists from anon, authenticated");
    expect(sql).toContain("create policy \"public read published magazines\"");
    expect(sql).not.toContain("grant select on public.artists to anon, authenticated");
    expect(sql).not.toContain("create policy \"public read artists\"");
    expect(sql).not.toContain("toonbti_question_groups");
    expect(sql).not.toContain("artist_toonbti_option_links");
    expect(sql).not.toContain("related_artist_ids uuid[]");
    expect(sql).not.toContain("is_ad boolean");
    expect(sql).not.toContain("episode_formats text[]");
  });
});
