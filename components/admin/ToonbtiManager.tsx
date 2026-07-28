"use client";

import {
  AlertCircle,
  Check,
  ChevronRight,
  ImagePlus,
  Play,
  Plus,
  Save,
  Search,
  Upload
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import { ToonbtiTestPreview } from "@/components/admin/ToonbtiTestPreview";
import {
  CANONICAL_TOONBTI_AXES,
  getActiveToonbtiAxes,
  getActiveTraitsForAxis,
  getPossibleToonbtiCodes,
  type ToonbtiAxis,
  type ToonbtiConfig,
  type ToonbtiQuestion,
  type ToonbtiQuestionOption,
  type ToonbtiResultType,
  type ToonbtiTrait
} from "@/lib/domain/toonbti";
import type { Artist } from "@/lib/types";

type AdminToonbtiResponse = {
  config: ToonbtiConfig | null;
  assignments: Array<{ artistId: string; testId: string; resultTypeId: string }>;
  storageAvailable: boolean;
  message?: string;
};

type ManagerTab = "axes" | "questions" | "results" | "artists";
type Notice = { tone: "success" | "error" | "info"; text: string } | null;

const TABS: Array<{ id: ManagerTab; label: string }> = [
  { id: "axes", label: "1. 축 설정" },
  { id: "questions", label: "2. 질문·답변" },
  { id: "results", label: "3. 결과 유형" },
  { id: "artists", label: "4. 작가 연결" }
];

function createId() {
  return crypto.randomUUID();
}

function sortByPosition<T extends { position: number }>(items: T[]) {
  return [...items].sort((left, right) => left.position - right.position);
}

function replaceById<T extends { id: string }>(items: T[], id: string, patch: Partial<T>) {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

function buildQuestion(
  testId: string,
  axis: ToonbtiAxis,
  traits: ToonbtiTrait[],
  position: number
): { question: ToonbtiQuestion; options: ToonbtiQuestionOption[] } {
  const questionId = createId();
  const [left, right] = sortByPosition(traits);
  const question: ToonbtiQuestion = {
    id: questionId,
    testId,
    axisId: axis.id,
    questionText: "",
    position,
    isActive: true
  };
  const specs: Array<{ traitId: string; score: 5 | 10 }> = [
    { traitId: left.id, score: 10 },
    { traitId: left.id, score: 5 },
    { traitId: right.id, score: 5 },
    { traitId: right.id, score: 10 }
  ];
  return {
    question,
    options: specs.map((spec, optionPosition) => ({
      id: createId(),
      questionId,
      axisId: axis.id,
      traitId: spec.traitId,
      optionText: "",
      score: spec.score,
      position: optionPosition,
      isActive: true
    }))
  };
}

function buildFourAxisTemplate(config: ToonbtiConfig): ToonbtiConfig {
  const axes: ToonbtiAxis[] = [];
  const traits: ToonbtiTrait[] = [];
  const questions: ToonbtiQuestion[] = [];
  const options: ToonbtiQuestionOption[] = [];

  for (
    let axisPosition = 0;
    axisPosition < CANONICAL_TOONBTI_AXES.length;
    axisPosition += 1
  ) {
    const definition = CANONICAL_TOONBTI_AXES[axisPosition];
    const axisId = createId();
    const axisTraits: ToonbtiTrait[] = definition.traits.map((trait, traitPosition) => ({
      id: createId(),
      testId: config.test.id,
      axisId,
      code: trait.code,
      name: trait.name,
      description: trait.description,
      position: traitPosition,
      isActive: true
    }));
    axes.push({
      id: axisId,
      testId: config.test.id,
      name: definition.name,
      position: axisPosition,
      tieBreakTraitId: axisTraits[0].id,
      isActive: true
    });
    traits.push(...axisTraits);
    for (let questionIndex = 0; questionIndex < 4; questionIndex += 1) {
      const built = buildQuestion(
        config.test.id,
        axes[axes.length - 1],
        axisTraits,
        axisPosition * 4 + questionIndex
      );
      questions.push(built.question);
      options.push(...built.options);
    }
  }

  const template = { ...config, axes, traits, questions, options, resultTypes: [] };
  return {
    ...template,
    resultTypes: getPossibleToonbtiCodes(template).map((code, position) => ({
      ...resultFromCode(config.test.id, code, position),
      name: `${code} 유형`
    }))
  };
}

function resultFromCode(testId: string, code: string, position: number): ToonbtiResultType {
  return {
    id: createId(),
    testId,
    code,
    name: "",
    shortDescription: "",
    longDescription: "",
    imageUrl: "",
    shareImageUrl: "",
    keywords: [],
    shareText: "",
    position,
    isActive: true
  };
}

function FieldLabel({
  label,
  hint,
  children,
  className = ""
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] leading-5 text-slate-400">{hint}</span> : null}
    </label>
  );
}

const inputClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500";
const textareaClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500";

function Toggle({
  active,
  label,
  onClick,
  disabled = false
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
        active ? "bg-blue-600" : "bg-slate-300"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
          active ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { message?: string };
  if (!response.ok) throw new Error(data.message || "요청 처리에 실패했습니다.");
  return data;
}

export function ToonbtiManager({ artists }: { artists: Artist[] }) {
  const [config, setConfig] = useState<ToonbtiConfig | null>(null);
  const [assignments, setAssignments] = useState<
    Array<{ artistId: string; testId: string; resultTypeId: string }>
  >([]);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [activeTab, setActiveTab] = useState<ManagerTab>("axes");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [selectedResultId, setSelectedResultId] = useState("");
  const [questionAxisId, setQuestionAxisId] = useState("");
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [artistSearch, setArtistSearch] = useState("");
  const [artistFilter, setArtistFilter] = useState<"all" | "unassigned" | string>("all");
  const [selectedArtistId, setSelectedArtistId] = useState("");
  const [selectedTraitIds, setSelectedTraitIds] = useState<Record<string, string>>({});
  const baselineRef = useRef("");

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/toonbti", { cache: "no-store" })
      .then((response) => readJson<AdminToonbtiResponse>(response))
      .then((data) => {
        if (!active) return;
        setStorageAvailable(data.storageAvailable);
        setConfig(data.config);
        setAssignments(data.assignments ?? []);
        baselineRef.current = data.config ? JSON.stringify(data.config) : "";
        if (data.message) setNotice({ tone: "info", text: data.message });
      })
      .catch((error) => {
        if (active) setNotice({ tone: "error", text: error instanceof Error ? error.message : "불러오기 실패" });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const dirty = config ? JSON.stringify(config) !== baselineRef.current : false;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const activeAxes = useMemo(() => (config ? getActiveToonbtiAxes(config) : []), [config]);
  const possibleCodes = useMemo(() => (config ? getPossibleToonbtiCodes(config) : []), [config]);
  const resultById = useMemo(
    () => new Map((config?.resultTypes ?? []).map((result) => [result.id, result])),
    [config]
  );
  const assignmentByArtistId = useMemo(
    () => new Map(assignments.map((assignment) => [assignment.artistId, assignment])),
    [assignments]
  );

  useEffect(() => {
    if (!config) return;
    if (!questionAxisId) setQuestionAxisId(activeAxes[0]?.id ?? "");
    if (!selectedResultId && config.resultTypes.length > 0) {
      setSelectedResultId(sortByPosition(config.resultTypes)[0].id);
    }
  }, [activeAxes, config, questionAxisId, selectedResultId]);

  useEffect(() => {
    if (!config || !questionAxisId) return;
    const axisQuestions = sortByPosition(
      config.questions.filter((question) => question.axisId === questionAxisId)
    );
    if (!axisQuestions.some((question) => question.id === selectedQuestionId)) {
      setSelectedQuestionId(axisQuestions[0]?.id ?? "");
    }
  }, [config, questionAxisId, selectedQuestionId]);

  const patchConfig = (recipe: (current: ToonbtiConfig) => ToonbtiConfig) => {
    setConfig((current) => (current ? recipe(current) : current));
    setNotice(null);
  };

  const saveConfig = async (nextConfig: ToonbtiConfig, successText: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const data = await readJson<{ config: ToonbtiConfig }>(
        await fetch("/api/admin/toonbti", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: nextConfig })
        })
      );
      setConfig(data.config);
      baselineRef.current = JSON.stringify(data.config);
      setNotice({ tone: "success", text: successText });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "저장 실패" });
    } finally {
      setBusy(false);
    }
  };

  const uploadImage = async (
    file: File,
    apply: (url: string) => void
  ) => {
    const formData = new FormData();
    formData.set("file", file);
    formData.set("folder", "toonbti");
    setBusy(true);
    try {
      const data = await readJson<{ publicUrl: string }>(
        await fetch("/api/admin/upload", { method: "POST", body: formData })
      );
      apply(data.publicUrl);
      setNotice({ tone: "success", text: "이미지를 업로드했습니다. 설정 저장을 눌러 반영해 주세요." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "이미지 업로드 실패" });
    } finally {
      setBusy(false);
    }
  };

  const generateMissingResults = () => {
    if (!config) return;
    const existingCodes = new Set(config.resultTypes.map((result) => result.code));
    const missing = possibleCodes.filter((code) => !existingCodes.has(code));
    patchConfig((current) => ({
      ...current,
      resultTypes: [
        ...current.resultTypes,
        ...missing.map((code, index) =>
          resultFromCode(current.test.id, code, current.resultTypes.length + index)
        )
      ]
    }));
    setNotice({
      tone: "info",
      text: missing.length > 0 ? `${missing.length}개 결과 유형 틀을 만들었습니다.` : "누락된 결과 코드가 없습니다."
    });
  };

  const filteredArtists = useMemo(() => {
    const query = artistSearch.trim().toLowerCase().replace(/^@/, "");
    return artists.filter((artist) => {
      const assignment = assignmentByArtistId.get(artist.id);
      if (artistFilter === "unassigned" && assignment) return false;
      if (artistFilter !== "all" && artistFilter !== "unassigned") {
        if (resultById.get(assignment?.resultTypeId ?? "")?.code !== artistFilter) return false;
      }
      return (
        !query ||
        artist.name.toLowerCase().includes(query) ||
        artist.instagram_handle.toLowerCase().includes(query)
      );
    });
  }, [artistFilter, artistSearch, artists, assignmentByArtistId, resultById]);

  const chooseArtist = (artistId: string) => {
    setSelectedArtistId(artistId);
    const result = resultById.get(assignmentByArtistId.get(artistId)?.resultTypeId ?? "");
    const next: Record<string, string> = {};
    if (result && config) {
      activeAxes.forEach((axis, index) => {
        const trait = getActiveTraitsForAxis(config, axis.id).find(
          (candidate) => candidate.code === result.code[index]
        );
        if (trait) next[axis.id] = trait.id;
      });
    }
    setSelectedTraitIds(next);
    setNotice(null);
  };

  const selectedCode =
    config && activeAxes.length === 4
      ? activeAxes
          .map((axis) =>
            config.traits.find((trait) => trait.id === selectedTraitIds[axis.id])?.code ?? "-"
          )
          .join("")
      : "----";
  const selectedResult = config?.resultTypes.find(
    (result) => result.code === selectedCode && result.isActive
  );

  const saveArtistAssignment = async (clear = false) => {
    if (!config || !selectedArtistId) return;
    if (!clear && (Object.keys(selectedTraitIds).length !== 4 || !selectedResult)) {
      setNotice({
        tone: "error",
        text: "4개 축을 모두 선택하고, 해당 코드의 활성 결과 유형을 먼저 준비해 주세요."
      });
      return;
    }
    setBusy(true);
    try {
      const data = await readJson<{
        assignment: { artistId: string; testId: string; resultTypeId: string } | null;
      }>(
        await fetch("/api/admin/toonbti/assignments", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            artistId: selectedArtistId,
            testId: config.test.id,
            resultTypeId: clear ? null : selectedResult?.id
          })
        })
      );
      setAssignments((current) => {
        const rest = current.filter((assignment) => assignment.artistId !== selectedArtistId);
        return data.assignment ? [...rest, data.assignment] : rest;
      });
      if (clear) setSelectedTraitIds({});
      setNotice({ tone: "success", text: clear ? "작가 유형을 미지정으로 변경했습니다." : "작가 유형을 저장했습니다." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "작가 유형 저장 실패" });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Toon-BTI 설정을 불러오는 중입니다.</div>;
  }

  if (!storageAvailable || !config) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm leading-6 text-amber-800">
        <strong>Toon-BTI 점수형 스키마가 필요합니다.</strong>
        <p className="mt-1">{notice?.text || "마이그레이션 013을 적용한 뒤 다시 열어 주세요."}</p>
      </div>
    );
  }

  const currentResult = config.resultTypes.find((result) => result.id === selectedResultId) ?? null;
  const selectedAxisQuestionCount = config.questions.filter(
    (question) => question.axisId === questionAxisId
  ).length;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Toon-BTI Studio</p>
            <h2 className="mt-1 text-xl font-bold text-ink">{config.test.title || "툰비티아이"}</h2>
            <p className="mt-1 text-xs text-slate-500">
              버전 {config.test.version} · {config.test.status === "published" ? "게시됨" : "초안"} ·{" "}
              {config.test.status === "published"
                ? config.test.isActive
                  ? "테스트 공개 중"
                  : "개선 중 안내 표시"
                : "게시 전"}{" "}
              · 활성 축 {activeAxes.length}/4
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dirty ? (
              <span className="rounded-md bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                저장하지 않은 변경사항
              </span>
            ) : null}
            <button
              type="button"
              disabled={busy || !dirty}
              onClick={() => void saveConfig(config, "초안을 저장했습니다.")}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 disabled:opacity-40"
            >
              <Save size={16} /> 저장
            </button>
            <div className="flex h-12 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3">
              <div>
                <p className="text-xs font-bold text-slate-700">테스트 공개</p>
                <p className="text-[11px] text-slate-500">
                  {config.test.status !== "published"
                    ? "게시 전 · 검증 후 게시 필요"
                    : config.test.isActive
                      ? "ON · 실제 테스트 표시"
                      : "OFF · 개선 중 안내 표시"}
                </p>
              </div>
              <Toggle
                active={config.test.status === "published" && config.test.isActive}
                label="툰비티아이 공개 상태"
                disabled={busy || config.test.status !== "published"}
                onClick={() =>
                  void saveConfig(
                    {
                      ...config,
                      test: {
                        ...config.test,
                        isActive: !config.test.isActive
                      }
                    },
                    config.test.isActive
                      ? "툰비티아이를 개선 중 상태로 전환했습니다."
                      : "툰비티아이를 공개했습니다."
                  )
                }
              />
            </div>
            {config.test.status !== "published" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void saveConfig(
                    { ...config, test: { ...config.test, status: "published", isActive: true } },
                    "테스트를 게시했습니다."
                  )
                }
                className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-40"
              >
                검증 후 게시
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto px-4 pt-3">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {notice ? (
        <div
          className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
            notice.tone === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : notice.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-blue-200 bg-blue-50 text-blue-700"
          }`}
        >
          {notice.tone === "success" ? <Check size={17} /> : <AlertCircle size={17} />}
          <span>{notice.text}</span>
        </div>
      ) : null}

      {activeTab === "axes" ? (
        <section className="space-y-4">
          {config.axes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-blue-300 bg-blue-50 p-8 text-center">
              <h3 className="text-lg font-bold text-blue-900">인투니 고정 4축 불러오기</h3>
              <p className="mt-2 text-sm text-blue-700">
                R/F · L/D · P/S · M/H 분류와 축마다 질문 4개, 결과 코드 16개를 한 번에 준비합니다.
              </p>
              <button
                type="button"
                onClick={() => setConfig(buildFourAxisTemplate(config))}
                className="mt-5 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white"
              >
                고정 4축 불러오기
              </button>
            </div>
          ) : (
            sortByPosition(config.axes).map((axis, axisIndex) => {
              const traits = sortByPosition(
                config.traits.filter((trait) => trait.axisId === axis.id)
              );
              return (
                <div key={axis.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-blue-600">{axisIndex + 1}번째 축</p>
                      <h3 className="mt-1 text-base font-bold text-ink">{axis.name}</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {CANONICAL_TOONBTI_AXES[axisIndex]?.summary}
                      </p>
                    </div>
                    <span className="rounded-md bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                      인투니 고정 기준
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {traits.map((trait) => (
                      <div key={trait.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-900 font-mono text-lg font-bold text-white">
                            {trait.code}
                          </span>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{trait.name}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {trait.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </section>
      ) : null}

      {activeTab === "questions" ? (
        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-base font-bold text-ink">축별 질문 설계</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  질문을 축별로 분류하고, 한 문항씩 선택해 질문과 네 가지 답변을 정리합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white"
              >
                <Play size={16} fill="currentColor" />
                예상 테스트 실시하기
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {sortByPosition(config.axes).map((axis, axisIndex) => {
                const traits = getActiveTraitsForAxis(config, axis.id);
                const axisQuestions = sortByPosition(
                  config.questions.filter((question) => question.axisId === axis.id)
                );
                const completedCount = axisQuestions.filter((question) => {
                  const options = config.options.filter(
                    (option) => option.questionId === question.id
                  );
                  return (
                    Boolean(question.questionText.trim()) &&
                    options.length === 4 &&
                    options.every((option) => Boolean(option.optionText.trim()))
                  );
                }).length;
                const selected = questionAxisId === axis.id;
                return (
                  <button
                    key={axis.id}
                    type="button"
                    onClick={() => setQuestionAxisId(axis.id)}
                    className={`min-h-32 rounded-lg border p-4 text-left transition ${
                      selected
                        ? "border-blue-500 bg-blue-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`text-xs font-bold ${selected ? "text-blue-700" : "text-slate-400"}`}>
                          {axisIndex + 1}축
                        </p>
                        <p className="mt-1 text-lg font-extrabold text-slate-900">
                          {traits.map((trait) => trait.code).join(" / ")}
                        </p>
                      </div>
                      <span
                        className={`rounded-md px-2 py-1 text-[11px] font-bold ${
                          completedCount === 4
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {completedCount}/4 완료
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">
                      {CANONICAL_TOONBTI_AXES[axisIndex]?.summary}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {(() => {
            const axis = config.axes.find((item) => item.id === questionAxisId);
            const axisIndex = sortByPosition(config.axes).findIndex(
              (item) => item.id === questionAxisId
            );
            const traits = axis ? getActiveTraitsForAxis(config, axis.id) : [];
            const axisQuestions = sortByPosition(
              config.questions.filter((question) => question.axisId === questionAxisId)
            );
            const selectedQuestion =
              axisQuestions.find((question) => question.id === selectedQuestionId) ??
              axisQuestions[0] ??
              null;
            const selectedQuestionIndex = selectedQuestion
              ? axisQuestions.findIndex((question) => question.id === selectedQuestion.id)
              : -1;
            const selectedOptions = selectedQuestion
              ? sortByPosition(
                  config.options.filter(
                    (option) => option.questionId === selectedQuestion.id
                  )
                )
              : [];

            return (
              <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
                <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="border-b border-slate-100 pb-4">
                    <p className="text-xs font-bold text-blue-600">
                      {axisIndex >= 0 ? `${axisIndex + 1}축 질문` : "질문 목록"}
                    </p>
                    <p className="mt-1 text-sm font-extrabold text-slate-900">
                      {traits.length === 2
                        ? `${traits[0].code} ${traits[0].name} ↔ ${traits[1].code} ${traits[1].name}`
                        : "성향축을 선택해 주세요"}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      현재 {selectedAxisQuestionCount}/4문항
                    </p>
                  </div>

                  <div className="mt-3 space-y-2">
                    {axisQuestions.map((question, questionIndex) => {
                      const options = config.options.filter(
                        (option) => option.questionId === question.id
                      );
                      const completed =
                        Boolean(question.questionText.trim()) &&
                        options.length === 4 &&
                        options.every((option) => Boolean(option.optionText.trim()));
                      return (
                        <button
                          key={question.id}
                          type="button"
                          onClick={() => setSelectedQuestionId(question.id)}
                          className={`w-full rounded-lg border p-3 text-left transition ${
                            selectedQuestion?.id === question.id
                              ? "border-blue-500 bg-blue-50"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-slate-700">
                              Q{questionIndex + 1}
                            </span>
                            <span
                              className={`text-[11px] font-bold ${
                                completed ? "text-emerald-600" : "text-amber-600"
                              }`}
                            >
                              {completed ? "작성 완료" : "작성 중"}
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-slate-600">
                            {question.questionText || "질문 문구를 입력해 주세요."}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    disabled={!questionAxisId || selectedAxisQuestionCount >= 4}
                    onClick={() => {
                      if (selectedAxisQuestionCount >= 4) return;
                      const selectedAxis = config.axes.find(
                        (item) => item.id === questionAxisId
                      );
                      const selectedTraits = config.traits.filter(
                        (trait) => trait.axisId === questionAxisId
                      );
                      if (!selectedAxis || selectedTraits.length !== 2) return;
                      const built = buildQuestion(
                        config.test.id,
                        selectedAxis,
                        selectedTraits,
                        Math.max(-1, ...config.questions.map((question) => question.position)) + 1
                      );
                      patchConfig((current) => ({
                        ...current,
                        questions: [...current.questions, built.question],
                        options: [...current.options, ...built.options]
                      }));
                      setSelectedQuestionId(built.question.id);
                    }}
                    className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 disabled:opacity-40"
                  >
                    <Plus size={15} />
                    {selectedAxisQuestionCount >= 4 ? "질문 4개 설정 완료" : "질문 추가"}
                  </button>
                </aside>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  {selectedQuestion ? (
                    <>
                      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-black text-white">
                              Q{selectedQuestionIndex + 1}
                            </span>
                            <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                              측정 축 · {axisIndex + 1}축
                            </span>
                            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                              {traits.map((trait) => trait.code).join(" ↔ ")}
                            </span>
                          </div>
                          <h4 className="mt-3 text-lg font-extrabold text-slate-900">
                            질문과 응답 분류
                          </h4>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            네 답변은 양쪽 성향의 강한 선택과 약한 선택으로 각각 연결됩니다.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                          {selectedQuestion.isActive ? "활성 질문" : "비활성 질문"}
                          <Toggle
                            active={selectedQuestion.isActive}
                            label="질문 활성화"
                            onClick={() =>
                              patchConfig((current) => ({
                                ...current,
                                questions: replaceById(
                                  current.questions,
                                  selectedQuestion.id,
                                  { isActive: !selectedQuestion.isActive }
                                )
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div className="mt-5">
                        <FieldLabel
                          label="질문 문구"
                          hint="사용자가 실제 테스트에서 가장 크게 읽게 되는 문장입니다."
                        >
                          <textarea
                            rows={3}
                            value={selectedQuestion.questionText}
                            onChange={(event) =>
                              patchConfig((current) => ({
                                ...current,
                                questions: replaceById(
                                  current.questions,
                                  selectedQuestion.id,
                                  { questionText: event.target.value }
                                )
                              }))
                            }
                            placeholder="예: 이야기를 볼 때 더 끌리는 쪽은?"
                            className={`${textareaClass} text-base font-semibold leading-7`}
                          />
                        </FieldLabel>
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-2">
                        {selectedOptions.map((option, optionIndex) => {
                          const trait = traits.find(
                            (candidate) => candidate.id === option.traitId
                          );
                          const strong = option.score === 10;
                          const left = trait?.id === traits[0]?.id;
                          return (
                            <div
                              key={option.id}
                              className={`rounded-lg border p-4 ${
                                left
                                  ? "border-blue-200 bg-blue-50/50"
                                  : "border-rose-200 bg-rose-50/50"
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`flex h-8 w-8 items-center justify-center rounded-md font-mono text-sm font-black text-white ${
                                      left ? "bg-blue-600" : "bg-rose-500"
                                    }`}
                                  >
                                    {trait?.code || "?"}
                                  </span>
                                  <div>
                                    <p className="text-xs font-extrabold text-slate-800">
                                      {trait?.name || "성향 미지정"}
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                      {strong ? "강한 선택" : "약한 선택"} · {option.score}점
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[11px] font-bold text-slate-400">
                                  답변 {optionIndex + 1}
                                </span>
                              </div>

                              <input
                                value={option.optionText}
                                onChange={(event) =>
                                  patchConfig((current) => ({
                                    ...current,
                                    options: replaceById(current.options, option.id, {
                                      optionText: event.target.value
                                    })
                                  }))
                                }
                                placeholder="사용자에게 보일 답변 문구"
                                className={`${inputClass} mt-3`}
                              />

                              <div className="mt-3 grid grid-cols-[1fr_100px] gap-2">
                                <select
                                  aria-label={`답변 ${optionIndex + 1} 연결 성향`}
                                  value={option.traitId}
                                  onChange={(event) =>
                                    patchConfig((current) => ({
                                      ...current,
                                      options: replaceById(current.options, option.id, {
                                        traitId: event.target.value,
                                        axisId: selectedQuestion.axisId
                                      })
                                    }))
                                  }
                                  className={inputClass}
                                >
                                  {traits.map((candidate) => (
                                    <option key={candidate.id} value={candidate.id}>
                                      {candidate.code} · {candidate.name}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  aria-label={`답변 ${optionIndex + 1} 점수`}
                                  value={String(option.score)}
                                  onChange={(event) =>
                                    patchConfig((current) => ({
                                      ...current,
                                      options: replaceById(current.options, option.id, {
                                        score: Number(event.target.value) as 5 | 10
                                      })
                                    }))
                                  }
                                  className={inputClass}
                                >
                                  <option value="5">5점</option>
                                  <option value="10">10점</option>
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="flex min-h-80 items-center justify-center text-center">
                      <div>
                        <p className="text-sm font-bold text-slate-700">
                          편집할 질문이 없습니다.
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          왼쪽에서 질문을 추가해 주세요.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </section>
      ) : null}

      {activeTab === "results" ? (
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["가능한 조합", possibleCodes.length],
              ["등록 결과", config.resultTypes.length],
              ["누락 결과", possibleCodes.filter((code) => !config.resultTypes.some((result) => result.code === code)).length],
              ["비활성 결과", config.resultTypes.filter((result) => !result.isActive).length]
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-base font-bold text-ink">결과 유형 관리</h3>
                <p className="mt-1 text-xs text-slate-500">
                  누락 코드: {possibleCodes.filter((code) => !config.resultTypes.some((result) => result.code === code)).join(", ") || "없음"}
                </p>
              </div>
              <button
                type="button"
                disabled={possibleCodes.length !== 16}
                onClick={generateMissingResults}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-40"
              >
                <Plus size={16} /> 누락 결과 틀 생성
              </button>
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-[230px_1fr]">
              <div className="max-h-[680px] space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {sortByPosition(config.resultTypes).map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => setSelectedResultId(result.id)}
                    className={`w-full rounded-md px-3 py-2 text-left ${
                      selectedResultId === result.id ? "bg-blue-50 text-blue-800" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="block text-sm font-bold">{result.code}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {result.name || "이름 미입력"} {!result.isActive ? "· 비활성" : ""}
                    </span>
                  </button>
                ))}
              </div>
              {currentResult ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-[110px_1fr_100px]">
                    <FieldLabel label="결과 코드">
                      <input
                        maxLength={4}
                        value={currentResult.code}
                        onChange={(event) =>
                          patchConfig((current) => ({
                            ...current,
                            resultTypes: replaceById(current.resultTypes, currentResult.id, {
                              code: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
                            })
                          }))
                        }
                        className={inputClass}
                      />
                    </FieldLabel>
                    <FieldLabel label="결과 이름">
                      <input
                        value={currentResult.name}
                        onChange={(event) =>
                          patchConfig((current) => ({
                            ...current,
                            resultTypes: replaceById(current.resultTypes, currentResult.id, {
                              name: event.target.value
                            })
                          }))
                        }
                        className={inputClass}
                      />
                    </FieldLabel>
                    <FieldLabel label="활성화">
                      <div className="flex h-10 items-center">
                        <Toggle
                          active={currentResult.isActive}
                          label="결과 유형 활성화"
                          onClick={() =>
                            patchConfig((current) => ({
                              ...current,
                              resultTypes: replaceById(current.resultTypes, currentResult.id, {
                                isActive: !currentResult.isActive
                              })
                            }))
                          }
                        />
                      </div>
                    </FieldLabel>
                  </div>
                  <FieldLabel label="한 줄 설명">
                    <input
                      value={currentResult.shortDescription}
                      onChange={(event) =>
                        patchConfig((current) => ({
                          ...current,
                          resultTypes: replaceById(current.resultTypes, currentResult.id, {
                            shortDescription: event.target.value
                          })
                        }))
                      }
                      className={inputClass}
                    />
                  </FieldLabel>
                  <FieldLabel label="상세 설명">
                    <textarea
                      rows={6}
                      value={currentResult.longDescription}
                      onChange={(event) =>
                        patchConfig((current) => ({
                          ...current,
                          resultTypes: replaceById(current.resultTypes, currentResult.id, {
                            longDescription: event.target.value
                          })
                        }))
                      }
                      className={textareaClass}
                    />
                  </FieldLabel>
                  <div className="grid gap-3 md:grid-cols-2">
                    <FieldLabel label="키워드" hint="쉼표로 구분합니다.">
                      <input
                        value={currentResult.keywords.join(", ")}
                        onChange={(event) =>
                          patchConfig((current) => ({
                            ...current,
                            resultTypes: replaceById(current.resultTypes, currentResult.id, {
                              keywords: event.target.value.split(",").map((item) => item.trim()).filter(Boolean)
                            })
                          }))
                        }
                        className={inputClass}
                      />
                    </FieldLabel>
                    <FieldLabel label="결과별 공유 문구">
                      <input
                        value={currentResult.shareText}
                        onChange={(event) =>
                          patchConfig((current) => ({
                            ...current,
                            resultTypes: replaceById(current.resultTypes, currentResult.id, {
                              shareText: event.target.value
                            })
                          }))
                        }
                        className={inputClass}
                      />
                    </FieldLabel>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {[
                      { key: "imageUrl" as const, label: "대표 이미지", value: currentResult.imageUrl },
                      { key: "shareImageUrl" as const, label: "공유 카드용 이미지", value: currentResult.shareImageUrl }
                    ].map((image) => (
                      <div key={image.key} className="rounded-lg border border-slate-200 p-3">
                        <p className="text-xs font-semibold text-slate-600">{image.label}</p>
                        {image.value ? (
                          <div className="relative mt-2 aspect-[4/3] w-full overflow-hidden rounded-md bg-slate-50">
                            <Image
                              src={image.value}
                              alt=""
                              fill
                              className="object-contain"
                              sizes="(max-width: 768px) 100vw, 480px"
                            />
                          </div>
                        ) : (
                          <div className="mt-2 flex aspect-[4/3] items-center justify-center rounded-md bg-slate-50 text-slate-400">
                            <ImagePlus size={24} />
                          </div>
                        )}
                        <div className="mt-3 flex gap-2">
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold">
                            <Upload size={14} /> 업로드
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) {
                                  void uploadImage(file, (url) =>
                                    patchConfig((current) => ({
                                      ...current,
                                      resultTypes: replaceById(current.resultTypes, currentResult.id, {
                                        [image.key]: url
                                      })
                                    }))
                                  );
                                }
                                event.target.value = "";
                              }}
                            />
                          </label>
                          {image.value ? (
                            <button
                              type="button"
                              onClick={() =>
                                patchConfig((current) => ({
                                  ...current,
                                  resultTypes: replaceById(current.resultTypes, currentResult.id, {
                                    [image.key]: ""
                                  })
                                }))
                              }
                              className="rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-600"
                            >
                              제거
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="rounded-lg bg-slate-50 p-8 text-center text-sm text-slate-500">
                  결과 유형을 생성한 뒤 선택해 주세요.
                </p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "artists" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
            <div>
              <div className="relative">
                <Search className="absolute left-3 top-3 text-slate-400" size={16} />
                <input
                  value={artistSearch}
                  onChange={(event) => setArtistSearch(event.target.value)}
                  placeholder="작가명 또는 인스타 계정 검색"
                  className={`${inputClass} pl-9`}
                />
              </div>
              <select
                value={artistFilter}
                onChange={(event) => setArtistFilter(event.target.value)}
                className={`${inputClass} mt-2`}
              >
                <option value="all">전체 작가</option>
                <option value="unassigned">Toon-BTI 미지정</option>
                {sortByPosition(config.resultTypes).map((result) => (
                  <option key={result.id} value={result.code}>
                    {result.code} {result.name || "이름 미입력"}
                  </option>
                ))}
              </select>
              <div className="mt-3 max-h-[650px] space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {filteredArtists.map((artist) => {
                  const result = resultById.get(assignmentByArtistId.get(artist.id)?.resultTypeId ?? "");
                  return (
                    <button
                      key={artist.id}
                      type="button"
                      onClick={() => chooseArtist(artist.id)}
                      className={`flex w-full items-center gap-3 rounded-md p-2 text-left ${
                        selectedArtistId === artist.id ? "bg-blue-50" : "hover:bg-slate-50"
                      }`}
                    >
                      {artist.thumbnail_url ? (
                        <Image
                          src={artist.thumbnail_url}
                          alt=""
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded-md object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-slate-100" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-800">{artist.name}</span>
                        <span className="block truncate text-xs text-slate-500">
                          @{artist.instagram_handle} · {result ? `${result.code} ${result.name}` : "미지정"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            {selectedArtistId ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-xs font-semibold text-blue-600">작가 Toon-BTI 설정</p>
                    <h3 className="mt-1 text-xl font-bold text-ink">
                      {artists.find((artist) => artist.id === selectedArtistId)?.name}
                    </h3>
                  </div>
                  <div className="rounded-lg bg-slate-900 px-4 py-2 text-right text-white">
                    <p className="text-[10px] text-slate-300">선택 결과</p>
                    <p className="font-mono text-xl font-bold">{selectedCode}</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {activeAxes.map((axis, axisIndex) => (
                    <div key={axis.id} className="rounded-lg border border-slate-200 p-4">
                      <p className="text-xs font-semibold text-slate-500">
                        {axisIndex + 1}. {axis.name}
                      </p>
                      <div className="mt-3 grid gap-2">
                        {getActiveTraitsForAxis(config, axis.id).map((trait) => {
                          const selected = selectedTraitIds[axis.id] === trait.id;
                          return (
                            <button
                              key={trait.id}
                              type="button"
                              onClick={() =>
                                setSelectedTraitIds((current) => ({ ...current, [axis.id]: trait.id }))
                              }
                              className={`rounded-lg border p-3 text-left transition ${
                                selected
                                  ? "border-blue-600 bg-blue-50"
                                  : "border-slate-200 hover:border-slate-400"
                              }`}
                            >
                              <span className="block text-sm font-bold text-slate-800">
                                {trait.code} · {trait.name}
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-slate-500">
                                {trait.description || "설명 미입력"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-lg bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500">연결될 결과 유형</p>
                  <p className="mt-1 text-base font-bold text-slate-800">
                    {selectedResult
                      ? `${selectedResult.code} · ${selectedResult.name}`
                      : selectedCode.includes("-")
                        ? "4개 축을 모두 선택해 주세요."
                        : "해당 코드의 활성 결과 유형이 없습니다."}
                  </p>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy || !selectedResult}
                    onClick={() => void saveArtistAssignment(false)}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    <Save size={16} /> 유형 저장
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void saveArtistAssignment(true)}
                    className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 disabled:opacity-40"
                  >
                    미지정으로 변경
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const index = filteredArtists.findIndex((artist) => artist.id === selectedArtistId);
                      const next = filteredArtists[index + 1];
                      if (next) chooseArtist(next.id);
                    }}
                    className="ml-auto inline-flex h-10 items-center gap-1 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700"
                  >
                    다음 작가 <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex min-h-80 items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-500">
                왼쪽 목록에서 작가를 선택해 주세요.
              </div>
            )}
          </div>
        </section>
      ) : null}

      {previewOpen ? (
        <ToonbtiTestPreview
          config={config}
          characterUrls={Array.from(
            new Set(artists.map((artist) => artist.character_url.trim()).filter(Boolean))
          )}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </div>
  );
}
