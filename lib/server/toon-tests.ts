import "server-only";

import {
  normalizeToonRouteDraft,
  validatePublishableToonRouteDraft,
  type ToonRouteDraft
} from "@/lib/domain/toon-test";
import type { PublicArtistDTO } from "@/lib/domain/public-artist";
import { listPublicArtistsByIds } from "@/lib/server/public-artists";
import { getSupabaseAdminClient } from "@/lib/supabase";

const DEFAULT_TEST_SLUG = "default";

export type PublicToonTestDTO = {
  title: string;
  version: number;
  draft: {
    startNodeId: string;
    nodes: Array<{
      id: string;
      type: "question" | "result";
      title: string;
      description: string;
      imageUrl: string;
      traits: string;
      selectionMode: "single" | "multi";
      maxSelections: number;
      artistIds: string[];
    }>;
    options: Array<{
      id: string;
      questionId: string;
      label: string;
      nextNodeId: string;
    }>;
  };
  artists: PublicArtistDTO[];
};

export async function getAdminToonTest() {
  const supabase = getSupabaseAdminClient() as any;
  const { data, error } = await supabase
    .from("toon_tests")
    .select("id, slug, title, status, version, start_node_key, draft, updated_at")
    .eq("slug", DEFAULT_TEST_SLUG)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, draft: normalizeToonRouteDraft(data.draft) };
}

async function validatePublishedArtists(draft: ToonRouteDraft) {
  const artistIds = Array.from(
    new Set(
      draft.nodes.flatMap((node) => (node.type === "result" ? (node.artistIds ?? []) : []))
    )
  );
  if (artistIds.length === 0) return;

  const supabase = getSupabaseAdminClient() as any;
  const { data, error } = await supabase
    .from("artists")
    .select("id, status, show_on_site")
    .in("id", artistIds);
  if (error) throw error;
  const publicIds = new Set(
    (data ?? [])
      .filter((artist: any) => artist.status === "active" && artist.show_on_site === true)
      .map((artist: any) => artist.id)
  );
  const invalidIds = artistIds.filter((artistId) => !publicIds.has(artistId));
  if (invalidIds.length > 0) {
    throw new Error("Published result cards may reference only active public artists.");
  }
}

export async function saveAdminToonTest({
  title,
  status,
  draft
}: {
  title: string;
  status: "draft" | "published";
  draft: unknown;
}) {
  const normalizedDraft = normalizeToonRouteDraft(draft);
  if (status === "published") {
    validatePublishableToonRouteDraft(normalizedDraft);
    await validatePublishedArtists(normalizedDraft);
  }

  const supabase = getSupabaseAdminClient() as any;
  const { data: savedTest, error: testError } = await supabase
    .from("toon_tests")
    .upsert(
      {
        slug: DEFAULT_TEST_SLUG,
        title: title.trim() || "툰비티아이",
        status,
        start_node_key: normalizedDraft.startNodeId,
        draft: normalizedDraft
      },
      { onConflict: "slug" }
    )
    .select("id, title, status, version, updated_at")
    .single();
  if (testError) throw testError;

  const testId = savedTest.id as string;
  const { error: edgeDeleteError } = await supabase.from("toon_edges").delete().eq("test_id", testId);
  if (edgeDeleteError) throw edgeDeleteError;
  const { error: resultDeleteError } = await supabase
    .from("toon_result_artists")
    .delete()
    .eq("test_id", testId);
  if (resultDeleteError) throw resultDeleteError;
  const { error: nodeDeleteError } = await supabase.from("toon_nodes").delete().eq("test_id", testId);
  if (nodeDeleteError) throw nodeDeleteError;

  const nodeRows = normalizedDraft.nodes.map((node, index) => ({
    test_id: testId,
    node_key: node.id,
    node_type: node.type,
    title: node.title,
    description: node.description,
    image_url: node.imageUrl || null,
    sort_order: index,
    config: {
      x: node.x,
      y: node.y,
      selectionMode: node.selectionMode,
      maxSelections: node.maxSelections,
      traits: node.traits
    }
  }));
  const { error: nodeInsertError } = await supabase.from("toon_nodes").insert(nodeRows);
  if (nodeInsertError) throw nodeInsertError;

  if (normalizedDraft.options.length > 0) {
    const { error: edgeInsertError } = await supabase.from("toon_edges").insert(
      normalizedDraft.options.map((option, index) => ({
        test_id: testId,
        edge_key: option.id,
        from_node_key: option.questionId,
        to_node_key: option.nextNodeId,
        option_label: option.label,
        sort_order: index,
        config: option
      }))
    );
    if (edgeInsertError) throw edgeInsertError;
  }

  const resultRows = normalizedDraft.nodes.flatMap((node) =>
    node.type === "result"
      ? (node.artistIds ?? []).map((artistId, index) => ({
          test_id: testId,
          result_node_key: node.id,
          artist_id: artistId,
          sort_order: index
        }))
      : []
  );
  if (resultRows.length > 0) {
    const { error: resultInsertError } = await supabase
      .from("toon_result_artists")
      .insert(resultRows);
    if (resultInsertError) throw resultInsertError;
  }

  return { ...savedTest, draft: normalizedDraft };
}

export async function getPublishedToonTest(): Promise<PublicToonTestDTO | null> {
  const supabase = getSupabaseAdminClient() as any;
  const { data, error } = await supabase
    .from("toon_tests")
    .select("title, version, draft")
    .eq("slug", DEFAULT_TEST_SLUG)
    .eq("status", "published")
    .maybeSingle();
  if (error || !data) return null;

  const draft = normalizeToonRouteDraft(data.draft);
  const requestedArtistIds = Array.from(
    new Set(draft.nodes.flatMap((node) => (node.type === "result" ? (node.artistIds ?? []) : [])))
  );
  const artists = await listPublicArtistsByIds(requestedArtistIds);
  const publicIds = new Set(artists.map((artist) => artist.id));

  return {
    title: data.title,
    version: data.version,
    draft: {
      startNodeId: draft.startNodeId,
      nodes: draft.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        title: node.title,
        description: node.description,
        imageUrl: node.imageUrl ?? "",
        traits: node.traits ?? "",
        selectionMode: node.selectionMode ?? "single",
        maxSelections: node.maxSelections ?? 1,
        artistIds: (node.artistIds ?? []).filter((artistId) => publicIds.has(artistId))
      })),
      options: draft.options.map((option) => ({
        id: option.id,
        questionId: option.questionId,
        label: option.label,
        nextNodeId: option.nextNodeId
      }))
    },
    artists
  };
}
