import "server-only";

import crypto from "node:crypto";

import {
  normalizeToonbtiConfig,
  validatePublishableToonbtiConfig,
  type ToonbtiConfig,
  type ToonbtiTestStatus
} from "@/lib/domain/toonbti";
import type { PublicArtistDTO } from "@/lib/domain/public-artist";
import { listPublicArtistsByIds } from "@/lib/server/public-artists";
import { getSupabaseAdminClient } from "@/lib/supabase";

const DEFAULT_TEST_SLUG = "default";

export type ToonbtiArtistAssignment = {
  artistId: string;
  testId: string;
  resultTypeId: string;
};

export type AdminToonbtiData = {
  config: ToonbtiConfig;
  assignments: ToonbtiArtistAssignment[];
};

export type PublicToonbtiResult = {
  config: ToonbtiConfig;
  resultType: ToonbtiConfig["resultTypes"][number];
  artists: PublicArtistDTO[];
};

function createEmptyConfig(): ToonbtiConfig {
  const id = crypto.randomUUID();
  return {
    test: {
      id,
      slug: DEFAULT_TEST_SLUG,
      title: "툰비티아이",
      version: 1,
      description: "",
      introImageUrl: "",
      startButtonLabel: "테스트 시작하기",
      shareText: "",
      status: "draft",
      isActive: false
    },
    axes: [],
    traits: [],
    questions: [],
    options: [],
    resultTypes: []
  };
}

function mapConfigRows({
  test,
  axes,
  traits,
  questions,
  options,
  resultTypes
}: {
  test: any;
  axes: any[];
  traits: any[];
  questions: any[];
  options: any[];
  resultTypes: any[];
}) {
  return normalizeToonbtiConfig({
    test: {
      id: test.id,
      slug: test.slug,
      title: test.title,
      version: test.version,
      description: test.description,
      introImageUrl: test.intro_image_url,
      startButtonLabel: test.start_button_label,
      shareText: test.share_text,
      status: test.status,
      isActive: test.is_active
    },
    axes: axes.map((axis) => ({
      id: axis.id,
      testId: axis.test_id,
      name: axis.name,
      position: axis.position,
      tieBreakTraitId: axis.tie_break_trait_id,
      isActive: axis.is_active
    })),
    traits: traits.map((trait) => ({
      id: trait.id,
      testId: trait.test_id,
      axisId: trait.axis_id,
      code: trait.code,
      name: trait.name,
      description: trait.description,
      position: trait.position,
      isActive: trait.is_active
    })),
    questions: questions.map((question) => ({
      id: question.id,
      testId: question.test_id,
      axisId: question.axis_id,
      questionText: question.question_text,
      position: question.position,
      isActive: question.is_active
    })),
    options: options.map((option) => ({
      id: option.id,
      questionId: option.question_id,
      axisId: option.axis_id,
      traitId: option.trait_id,
      optionText: option.option_text,
      score: option.score,
      position: option.position,
      isActive: option.is_active
    })),
    resultTypes: resultTypes.map((result) => ({
      id: result.id,
      testId: result.test_id,
      code: result.code,
      name: result.name,
      shortDescription: result.short_description,
      longDescription: result.long_description,
      imageUrl: result.image_url,
      shareImageUrl: result.share_image_url,
      keywords: result.keywords,
      shareText: result.share_text,
      position: result.position,
      isActive: result.is_active
    }))
  });
}

async function loadConfigByTest(test: any): Promise<ToonbtiConfig> {
  const supabase = getSupabaseAdminClient() as any;
  const [axesResult, traitsResult, questionsResult, resultTypesResult] = await Promise.all([
    supabase.from("toonbti_axes").select("*").eq("test_id", test.id).order("position"),
    supabase.from("toonbti_traits").select("*").eq("test_id", test.id).order("position"),
    supabase.from("toonbti_questions").select("*").eq("test_id", test.id).order("position"),
    supabase.from("toonbti_result_types").select("*").eq("test_id", test.id).order("position")
  ]);
  for (const result of [axesResult, traitsResult, questionsResult, resultTypesResult]) {
    if (result.error) throw result.error;
  }

  const questionIds = (questionsResult.data ?? []).map((question: any) => question.id);
  const optionsResult =
    questionIds.length > 0
      ? await supabase
          .from("toonbti_question_options")
          .select("*")
          .in("question_id", questionIds)
          .order("position")
      : { data: [], error: null };
  if (optionsResult.error) throw optionsResult.error;

  return mapConfigRows({
    test,
    axes: axesResult.data ?? [],
    traits: traitsResult.data ?? [],
    questions: questionsResult.data ?? [],
    options: optionsResult.data ?? [],
    resultTypes: resultTypesResult.data ?? []
  });
}

export async function getAdminToonbtiData(): Promise<AdminToonbtiData> {
  const supabase = getSupabaseAdminClient() as any;
  const { data: test, error } = await supabase
    .from("toon_tests")
    .select(
      "id, slug, title, version, status, description, intro_image_url, start_button_label, share_text, is_active"
    )
    .eq("slug", DEFAULT_TEST_SLUG)
    .maybeSingle();
  if (error) throw error;
  if (!test) return { config: createEmptyConfig(), assignments: [] };

  const [config, assignmentsResult] = await Promise.all([
    loadConfigByTest(test),
    supabase
      .from("artist_toonbti_types")
      .select("artist_id, test_id, result_type_id")
      .eq("test_id", test.id)
  ]);
  if (assignmentsResult.error) throw assignmentsResult.error;
  return {
    config,
    assignments: (assignmentsResult.data ?? []).map((assignment: any) => ({
      artistId: assignment.artist_id,
      testId: assignment.test_id,
      resultTypeId: assignment.result_type_id
    }))
  };
}

async function deleteRowsByIds(table: string, ids: string[]) {
  if (ids.length === 0) return;
  const supabase = getSupabaseAdminClient() as any;
  const { error } = await supabase.from(table).delete().in("id", ids);
  if (error) throw error;
}

export async function saveAdminToonbtiConfig(input: unknown) {
  const config = normalizeToonbtiConfig(input);
  if (config.test.status === "published" || config.test.isActive) {
    validatePublishableToonbtiConfig(config);
  }

  const supabase = getSupabaseAdminClient() as any;
  const { data: existingTest, error: existingTestError } = await supabase
    .from("toon_tests")
    .select("id, version")
    .eq("slug", config.test.slug || DEFAULT_TEST_SLUG)
    .maybeSingle();
  if (existingTestError) throw existingTestError;

  const testId = existingTest?.id ?? config.test.id;
  const nextVersion = (existingTest?.version ?? 0) + 1;
  const { data: savedTest, error: testError } = await supabase
    .from("toon_tests")
    .upsert(
      {
        id: testId,
        slug: config.test.slug || DEFAULT_TEST_SLUG,
        title: config.test.title,
        version: nextVersion,
        status: config.test.status,
        description: config.test.description,
        intro_image_url: config.test.introImageUrl || null,
        start_button_label: config.test.startButtonLabel,
        share_text: config.test.shareText,
        is_active: config.test.isActive
      },
      { onConflict: "slug" }
    )
    .select(
      "id, slug, title, version, status, description, intro_image_url, start_button_label, share_text, is_active"
    )
    .single();
  if (testError) throw testError;

  const [existingAxes, existingTraits, existingQuestions, existingResults] = await Promise.all([
    supabase.from("toonbti_axes").select("id").eq("test_id", testId),
    supabase.from("toonbti_traits").select("id").eq("test_id", testId),
    supabase.from("toonbti_questions").select("id").eq("test_id", testId),
    supabase.from("toonbti_result_types").select("id").eq("test_id", testId)
  ]);
  for (const result of [existingAxes, existingTraits, existingQuestions, existingResults]) {
    if (result.error) throw result.error;
  }
  const oldQuestionIds = (existingQuestions.data ?? []).map((row: any) => row.id);
  const existingOptions =
    oldQuestionIds.length > 0
      ? await supabase
          .from("toonbti_question_options")
          .select("id")
          .in("question_id", oldQuestionIds)
      : { data: [], error: null };
  if (existingOptions.error) throw existingOptions.error;

  if ((existingAxes.data ?? []).length > 0) {
    const { error } = await supabase
      .from("toonbti_axes")
      .update({ tie_break_trait_id: null })
      .eq("test_id", testId);
    if (error) throw error;
  }

  if (config.axes.length > 0) {
    const { error } = await supabase.from("toonbti_axes").upsert(
      config.axes.map((axis) => ({
        id: axis.id,
        test_id: testId,
        name: axis.name,
        position: axis.position,
        tie_break_trait_id: null,
        is_active: axis.isActive
      }))
    );
    if (error) throw error;
  }
  if (config.traits.length > 0) {
    const { error } = await supabase.from("toonbti_traits").upsert(
      config.traits.map((trait) => ({
        id: trait.id,
        test_id: testId,
        axis_id: trait.axisId,
        code: trait.code,
        name: trait.name,
        description: trait.description,
        position: trait.position,
        is_active: trait.isActive
      }))
    );
    if (error) throw error;
  }
  if (config.questions.length > 0) {
    const { error } = await supabase.from("toonbti_questions").upsert(
      config.questions.map((question) => ({
        id: question.id,
        test_id: testId,
        axis_id: question.axisId,
        question_text: question.questionText,
        position: question.position,
        is_active: question.isActive
      }))
    );
    if (error) throw error;
  }
  if (config.options.length > 0) {
    const { error } = await supabase.from("toonbti_question_options").upsert(
      config.options.map((option) => ({
        id: option.id,
        question_id: option.questionId,
        axis_id: option.axisId,
        trait_id: option.traitId,
        option_text: option.optionText,
        score: option.score,
        position: option.position,
        is_active: option.isActive
      }))
    );
    if (error) throw error;
  }
  if (config.resultTypes.length > 0) {
    const { error } = await supabase.from("toonbti_result_types").upsert(
      config.resultTypes.map((result) => ({
        id: result.id,
        test_id: testId,
        code: result.code,
        name: result.name,
        short_description: result.shortDescription,
        long_description: result.longDescription,
        image_url: result.imageUrl || null,
        share_image_url: result.shareImageUrl || null,
        keywords: result.keywords,
        share_text: result.shareText,
        position: result.position,
        is_active: result.isActive
      }))
    );
    if (error) throw error;
  }

  const keepIds = {
    axes: new Set(config.axes.map((axis) => axis.id)),
    traits: new Set(config.traits.map((trait) => trait.id)),
    questions: new Set(config.questions.map((question) => question.id)),
    options: new Set(config.options.map((option) => option.id)),
    results: new Set(config.resultTypes.map((result) => result.id))
  };
  await deleteRowsByIds(
    "toonbti_question_options",
    (existingOptions.data ?? [])
      .map((row: any) => row.id)
      .filter((id: string) => !keepIds.options.has(id))
  );
  await deleteRowsByIds(
    "toonbti_questions",
    (existingQuestions.data ?? [])
      .map((row: any) => row.id)
      .filter((id: string) => !keepIds.questions.has(id))
  );
  await deleteRowsByIds(
    "toonbti_traits",
    (existingTraits.data ?? [])
      .map((row: any) => row.id)
      .filter((id: string) => !keepIds.traits.has(id))
  );
  await deleteRowsByIds(
    "toonbti_axes",
    (existingAxes.data ?? [])
      .map((row: any) => row.id)
      .filter((id: string) => !keepIds.axes.has(id))
  );
  await deleteRowsByIds(
    "toonbti_result_types",
    (existingResults.data ?? [])
      .map((row: any) => row.id)
      .filter((id: string) => !keepIds.results.has(id))
  );

  for (const axis of config.axes) {
    const tieBreakTraitId =
      axis.tieBreakTraitId &&
      config.traits.some(
        (trait) => trait.id === axis.tieBreakTraitId && trait.axisId === axis.id
      )
        ? axis.tieBreakTraitId
        : null;
    const { error } = await supabase
      .from("toonbti_axes")
      .update({ tie_break_trait_id: tieBreakTraitId })
      .eq("id", axis.id)
      .eq("test_id", testId);
    if (error) throw error;
  }

  return loadConfigByTest(savedTest);
}

export async function saveArtistToonbtiAssignment({
  artistId,
  testId,
  resultTypeId
}: {
  artistId: string;
  testId: string;
  resultTypeId: string | null;
}) {
  const supabase = getSupabaseAdminClient() as any;
  if (!resultTypeId) {
    const { error } = await supabase
      .from("artist_toonbti_types")
      .delete()
      .eq("artist_id", artistId)
      .eq("test_id", testId);
    if (error) throw error;
    return null;
  }

  const { data: resultType, error: resultError } = await supabase
    .from("toonbti_result_types")
    .select("id, test_id, is_active")
    .eq("id", resultTypeId)
    .eq("test_id", testId)
    .maybeSingle();
  if (resultError) throw resultError;
  if (!resultType?.is_active) throw new Error("선택한 활성 결과 유형을 찾을 수 없습니다.");

  const { data: artist, error: artistError } = await supabase
    .from("artists")
    .select("id")
    .eq("id", artistId)
    .maybeSingle();
  if (artistError) throw artistError;
  if (!artist) throw new Error("작가를 찾을 수 없습니다.");

  const { data, error } = await supabase
    .from("artist_toonbti_types")
    .upsert(
      {
        artist_id: artistId,
        test_id: testId,
        result_type_id: resultTypeId
      },
      { onConflict: "artist_id,test_id" }
    )
    .select("artist_id, test_id, result_type_id")
    .single();
  if (error) throw error;
  return {
    artistId: data.artist_id,
    testId: data.test_id,
    resultTypeId: data.result_type_id
  } satisfies ToonbtiArtistAssignment;
}

export async function getPublishedToonbtiConfig(): Promise<ToonbtiConfig | null> {
  const supabase = getSupabaseAdminClient() as any;
  const { data: test, error } = await supabase
    .from("toon_tests")
    .select(
      "id, slug, title, version, status, description, intro_image_url, start_button_label, share_text, is_active"
    )
    .eq("slug", DEFAULT_TEST_SLUG)
    .eq("status", "published")
    .eq("is_active", true)
    .maybeSingle();
  if (error || !test) return null;

  const config = await loadConfigByTest(test);
  try {
    validatePublishableToonbtiConfig(config);
  } catch {
    return null;
  }
  const activeAxes = config.axes.filter((item) => item.isActive);
  const activeAxisIds = new Set(activeAxes.map((item) => item.id));
  const activeTraits = config.traits.filter(
    (item) => item.isActive && activeAxisIds.has(item.axisId)
  );
  const activeTraitIds = new Set(activeTraits.map((item) => item.id));
  const activeQuestions = config.questions.filter(
    (item) => item.isActive && activeAxisIds.has(item.axisId)
  );
  const activeQuestionIds = new Set(activeQuestions.map((item) => item.id));
  return {
    ...config,
    axes: activeAxes,
    traits: activeTraits,
    questions: activeQuestions,
    options: config.options.filter(
      (item) =>
        item.isActive &&
        activeAxisIds.has(item.axisId) &&
        activeTraitIds.has(item.traitId) &&
        activeQuestionIds.has(item.questionId)
    ),
    resultTypes: config.resultTypes.filter((item) => item.isActive)
  };
}

export async function getPublishedToonbtiResult(
  code: string
): Promise<PublicToonbtiResult | null> {
  const config = await getPublishedToonbtiConfig();
  if (!config) return null;
  const normalizedCode = code.trim().toUpperCase();
  const resultType = config.resultTypes.find((result) => result.code === normalizedCode);
  if (!resultType) return null;

  const supabase = getSupabaseAdminClient() as any;
  const { data: assignments, error } = await supabase
    .from("artist_toonbti_types")
    .select("artist_id")
    .eq("test_id", config.test.id)
    .eq("result_type_id", resultType.id);
  if (error) throw error;
  const artistIds = (assignments ?? []).map((assignment: any) => assignment.artist_id);
  const artists = await listPublicArtistsByIds(artistIds);
  const artistMap = new Map(artists.map((artist) => [artist.id, artist]));
  return {
    config,
    resultType,
    artists: artistIds.map((artistId: string) => artistMap.get(artistId)).filter(Boolean) as PublicArtistDTO[]
  };
}

export const TOONBTI_EVENT_TYPES = [
  "toonbti_start",
  "toonbti_answer",
  "toonbti_complete",
  "toonbti_result_share",
  "toonbti_image_save",
  "toonbti_artist_click",
  "toonbti_instagram_outbound",
  "toonbti_restart"
] as const;

export type ToonbtiEventType = (typeof TOONBTI_EVENT_TYPES)[number];

export async function recordToonbtiEvent({
  eventType,
  testId,
  resultCode,
  questionId,
  artistId
}: {
  eventType: ToonbtiEventType;
  testId?: string;
  resultCode?: string;
  questionId?: string;
  artistId?: string;
}) {
  const supabase = getSupabaseAdminClient() as any;
  const { error } = await supabase.from("toonbti_events").insert({
    event_type: eventType,
    test_id: testId || null,
    result_code: resultCode?.trim().toUpperCase() || null,
    question_id: questionId || null,
    artist_id: artistId || null,
    metadata: {}
  });
  if (error) throw error;
}

export function setToonbtiTestStatus(
  config: ToonbtiConfig,
  status: ToonbtiTestStatus
): ToonbtiConfig {
  return {
    ...config,
    test: {
      ...config.test,
      status,
      isActive: status === "published" ? config.test.isActive : false
    }
  };
}
