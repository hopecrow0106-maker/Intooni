import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const supabaseSource = readFileSync(path.resolve(__dirname, "../lib/supabase.ts"), "utf8");
const databaseTypesSource = readFileSync(
  path.resolve(__dirname, "../lib/database.types.ts"),
  "utf8"
);
const packageSource = readFileSync(path.resolve(__dirname, "../package.json"), "utf8");

describe("Supabase generated type wiring", () => {
  it("keeps Supabase clients wired to the database types artifact", () => {
    expect(supabaseSource).toContain('import type { Database } from "@/lib/database.types"');
    expect(supabaseSource).not.toContain('import type { Database } from "@/lib/types"');
  });

  it("covers the refactor tables in the database types artifact", () => {
    for (const tableName of [
      "artist_stats",
      "artist_contacts",
      "brand_categories",
      "artist_recommended_brand_categories",
      "artist_b2b_profiles",
      "artist_collaborations",
      "magazine_artists",
      "toon_tests",
      "toon_nodes",
      "toon_edges",
      "toon_result_artists",
      "toonbti_axes",
      "toonbti_traits",
      "toonbti_questions",
      "toonbti_question_options",
      "toonbti_result_types",
      "artist_toonbti_types",
      "toonbti_events",
      "sheet_sync_jobs",
      "migration_legacy_backup"
    ]) {
      expect(databaseTypesSource).toContain(`${tableName}: Row<`);
    }
    expect(databaseTypesSource).not.toContain("toonbti_question_groups: Row<");
    expect(databaseTypesSource).not.toContain("artist_toonbti_option_links: Row<");
    expect(databaseTypesSource).not.toContain("related_artist_ids: string[]");
    expect(databaseTypesSource).not.toContain("episode_formats: string[]");
  });

  it("keeps scripts for regenerating local or remote Supabase types", () => {
    const packageJson = JSON.parse(packageSource) as { scripts: Record<string, string> };

    expect(packageJson.scripts["types:supabase:local"]).toBe(
      "npx supabase gen types typescript --local > lib/database.types.ts"
    );
    expect(packageJson.scripts["types:supabase:remote"]).toBe(
      "npx supabase gen types typescript --project-id %SUPABASE_PROJECT_ID% --schema public > lib/database.types.ts"
    );
  });
});
