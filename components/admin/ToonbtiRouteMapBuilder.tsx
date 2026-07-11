"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  ToonRouteDraft as RouteDraft,
  ToonRouteNode as RouteNode,
  ToonRouteOption as RouteOption
} from "@/lib/domain/toon-test";
import type { Artist } from "@/lib/types";
type RouteNodeType = RouteNode["type"];
type SelectionMode = NonNullable<RouteNode["selectionMode"]>;

type ToonbtiRouteMapBuilderProps = {
  artists: Artist[];
};

const BASE_NODE_WIDTH = 240;
const BASE_NODE_HEIGHT = 132;
const CANVAS_WIDTH = 1800;
const CANVAS_HEIGHT = 1100;

const createId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const INITIAL_DRAFT: RouteDraft = {
  startNodeId: "q-start",
  nodes: [
    {
      id: "q-start",
      type: "question",
      title: "Q1. 어떤 감정으로 보고 싶나요?",
      description: "툰비티아이 Tone을 고르는 시작 질문",
      x: 32,
      y: 52,
      selectionMode: "single",
      maxSelections: 1
    },
    {
      id: "q-depth",
      type: "question",
      title: "Q2. 이야기 밀도는 어느 쪽인가요?",
      description: "다중 선택을 테스트할 수 있는 개발용 질문",
      x: 380,
      y: 44,
      selectionMode: "multi",
      maxSelections: 2
    },
    {
      id: "r-soft",
      type: "result",
      title: "잔잔한 몰입형",
      description: "편안하게 스며드는 감정선을 좋아하는 타입",
      x: 738,
      y: 24,
      traits: "잔잔함, 여운, 감정선",
      artistIds: []
    }
  ],
  options: [
    {
      id: "o-soft",
      questionId: "q-start",
      label: "잔잔한 여운",
      actionNote: "Tone에서 고자극을 소거하고 잔잔함을 선택",
      includeTags: "잔잔",
      excludeTags: "고자극",
      nextNodeId: "q-depth"
    },
    {
      id: "o-result",
      questionId: "q-depth",
      label: "감정선이 오래 남는 쪽",
      actionNote: "결과 후보를 잔잔한 몰입형으로 확정",
      includeTags: "감성, 여운",
      excludeTags: "",
      nextNodeId: "r-soft"
    }
  ]
};

function cloneInitialDraft() {
  return JSON.parse(JSON.stringify(INITIAL_DRAFT)) as RouteDraft;
}

function splitTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function mergeTagFields(...values: Array<string | undefined>) {
  return values.flatMap((value) => splitTags(value ?? ""));
}

export function ToonbtiRouteMapBuilder({ artists }: ToonbtiRouteMapBuilderProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<{
    active: boolean;
    x: number;
    y: number;
    left: number;
    top: number;
  }>({ active: false, x: 0, y: 0, left: 0, top: 0 });
  const [draft, setDraft] = useState<RouteDraft>(() => cloneInitialDraft());
  const [selectedNodeId, setSelectedNodeId] = useState(INITIAL_DRAFT.startNodeId);
  const [testNodeId, setTestNodeId] = useState(INITIAL_DRAFT.startNodeId);
  const [testSelectedOptions, setTestSelectedOptions] = useState<string[]>([]);
  const [testIncludedTags, setTestIncludedTags] = useState<string[]>([]);
  const [testExcludedTags, setTestExcludedTags] = useState<string[]>([]);
  const [testHistory, setTestHistory] = useState<string[]>([]);
  const [uploadingResultId, setUploadingResultId] = useState<string | null>(null);
  const [cardScale, setCardScale] = useState(1);
  const [mapZoom, setMapZoom] = useState(0.9);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [testTitle, setTestTitle] = useState("툰비티아이");
  const [testStatus, setTestStatus] = useState<"draft" | "published">("draft");
  const [saveState, setSaveState] = useState<"idle" | "loading" | "saving" | "error" | "unavailable">("loading");
  const [saveMessage, setSaveMessage] = useState("");

  const nodeWidth = Math.round(BASE_NODE_WIDTH * cardScale);
  const nodeHeight = Math.round(BASE_NODE_HEIGHT * cardScale);

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/toon-tests", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as {
          test?: { title?: string; status?: "draft" | "published"; draft?: RouteDraft } | null;
          storageAvailable?: boolean;
          message?: string;
        };
        if (!response.ok) throw new Error(data.message ?? "테스트를 불러오지 못했습니다.");
        if (!active) return;
        const loadedDraft = data.test?.draft;
        if (loadedDraft) {
          setDraft(loadedDraft);
          setTestTitle(data.test?.title ?? "툰비티아이");
          setTestStatus(data.test?.status ?? "draft");
          setSelectedNodeId(loadedDraft.startNodeId || loadedDraft.nodes[0]?.id || "");
          setTestNodeId(loadedDraft.startNodeId || loadedDraft.nodes[0]?.id || "");
        }
        setSaveState(data.storageAvailable === false ? "unavailable" : "idle");
        setSaveMessage(data.message ?? "");
      })
      .catch((error) => {
        if (!active) return;
        setSaveState("error");
        setSaveMessage(error instanceof Error ? error.message : "테스트를 불러오지 못했습니다.");
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedNode = useMemo(
    () => draft.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [draft.nodes, selectedNodeId]
  );
  const testNode = useMemo(
    () => draft.nodes.find((node) => node.id === testNodeId) ?? null,
    [draft.nodes, testNodeId]
  );
  const nodeOptions = useMemo(
    () => draft.options.filter((option) => option.questionId === selectedNodeId),
    [draft.options, selectedNodeId]
  );
  const testOptions = useMemo(
    () => draft.options.filter((option) => option.questionId === testNodeId),
    [draft.options, testNodeId]
  );
  const resultArtists = useMemo(() => {
    if (!testNode || testNode.type !== "result") {
      return [];
    }

    const ids = new Set(testNode.artistIds ?? []);
    return artists.filter((artist) => ids.has(artist.id));
  }, [artists, testNode]);

  const updateNode = (nodeId: string, patch: Partial<RouteNode>) => {
    setDraft((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node))
    }));
  };

  const updateOption = (optionId: string, patch: Partial<RouteOption>) => {
    setDraft((current) => ({
      ...current,
      options: current.options.map((option) =>
        option.id === optionId ? { ...option, ...patch } : option
      )
    }));
  };

  const addNode = (type: RouteNodeType) => {
    const node: RouteNode =
      type === "question"
        ? {
            id: createId("q"),
            type,
            title: "새 질문",
            description: "",
            x: 96,
            y: 260,
            selectionMode: "single",
            maxSelections: 1
          }
        : {
            id: createId("r"),
            type,
            title: "새 결과",
            description: "결과 설명을 입력하세요.",
            x: 660,
            y: 260,
            traits: "",
            artistIds: []
          };

    setDraft((current) => ({
      ...current,
      startNodeId: current.startNodeId || node.id,
      nodes: [...current.nodes, node]
    }));
    setSelectedNodeId(node.id);
  };

  const addOption = () => {
    if (!selectedNode || selectedNode.type !== "question") {
      return;
    }

    const fallbackTarget = draft.nodes.find((node) => node.id !== selectedNode.id)?.id ?? "";
    setDraft((current) => ({
      ...current,
      options: [
        ...current.options,
        {
          id: createId("o"),
          questionId: selectedNode.id,
          label: "새 선택지",
          actionNote: "",
          includeTags: "",
          excludeTags: "",
          includeTone: "",
          excludeTone: "",
          includePace: "",
          excludePace: "",
          includeStyle: "",
          excludeStyle: "",
          includeTopic: "",
          excludeTopic: "",
          nextNodeId: fallbackTarget
        }
      ]
    }));
  };

  const deleteNode = (nodeId: string) => {
    if (draft.nodes.length <= 1) {
      return;
    }

    const nextNodes = draft.nodes.filter((node) => node.id !== nodeId);
    const fallbackId = nextNodes[0]?.id ?? "";

    setDraft((current) => ({
      ...current,
      startNodeId: current.startNodeId === nodeId ? fallbackId : current.startNodeId,
      nodes: nextNodes,
      options: current.options.filter(
        (option) => option.questionId !== nodeId && option.nextNodeId !== nodeId
      )
    }));
    setSelectedNodeId(fallbackId);
    setTestNodeId(fallbackId);
  };

  const deleteOption = (optionId: string) => {
    setDraft((current) => ({
      ...current,
      options: current.options.filter((option) => option.id !== optionId)
    }));
  };

  const handleDropNode = (event: React.DragEvent<HTMLDivElement>) => {
    const nodeId = event.dataTransfer.getData("text/plain");
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();

    if (!nodeId || !canvas || !rect) {
      return;
    }

    updateNode(nodeId, {
      x: Math.max(8, (event.clientX - rect.left + canvas.scrollLeft) / mapZoom - nodeWidth / 2),
      y: Math.max(8, (event.clientY - rect.top + canvas.scrollTop) / mapZoom - nodeHeight / 2)
    });
  };

  const beginPan = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !canvasRef.current) {
      return;
    }

    panRef.current = {
      active: true,
      x: event.clientX,
      y: event.clientY,
      left: canvasRef.current.scrollLeft,
      top: canvasRef.current.scrollTop
    };
  };

  const movePan = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!panRef.current.active || !canvasRef.current) {
      return;
    }

    canvasRef.current.scrollLeft = panRef.current.left - (event.clientX - panRef.current.x);
    canvasRef.current.scrollTop = panRef.current.top - (event.clientY - panRef.current.y);
  };

  const endPan = () => {
    panRef.current.active = false;
  };

  const uploadResultImage = async (nodeId: string, file: File | undefined) => {
    if (!file) {
      return;
    }

    setUploadingResultId(nodeId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "toonbti");

      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as { publicUrl?: string; message?: string };

      if (!response.ok || !data.publicUrl) {
        throw new Error(data.message ?? "이미지 업로드에 실패했습니다.");
      }

      updateNode(nodeId, { imageUrl: data.publicUrl });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "이미지 업로드에 실패했습니다.");
    } finally {
      setUploadingResultId(null);
    }
  };

  const saveDraft = async (status: "draft" | "published") => {
    if (saveState === "unavailable") {
      setSaveMessage("DB 마이그레이션 후 저장과 발행을 사용할 수 있습니다.");
      return;
    }

    setSaveState("saving");
    setSaveMessage("");
    try {
      const response = await fetch("/api/admin/toon-tests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: testTitle, status, draft })
      });
      const data = (await response.json()) as {
        test?: { status?: "draft" | "published" };
        message?: string;
      };
      if (!response.ok) throw new Error(data.message ?? "테스트 저장에 실패했습니다.");
      setTestStatus(data.test?.status ?? status);
      setSaveState("idle");
      setSaveMessage(status === "published" ? "발행되었습니다." : "초안이 저장되었습니다.");
    } catch (error) {
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "테스트 저장에 실패했습니다.");
    }
  };

  const resetTest = () => {
    setTestNodeId(draft.startNodeId || draft.nodes[0]?.id || "");
    setTestSelectedOptions([]);
    setTestIncludedTags([]);
    setTestExcludedTags([]);
    setTestHistory([]);
  };

  const applyTestOptions = (optionIds: string[]) => {
    const selectedOptions = draft.options.filter((option) => optionIds.includes(option.id));
    const lastOption = selectedOptions[selectedOptions.length - 1];

    if (!lastOption) {
      return;
    }

    const includeTags = selectedOptions.flatMap((option) =>
      mergeTagFields(
        option.includeTone ?? option.includeTags,
        option.includePace,
        option.includeStyle,
        option.includeTopic
      )
    );
    const excludeTags = selectedOptions.flatMap((option) =>
      mergeTagFields(
        option.excludeTone ?? option.excludeTags,
        option.excludePace,
        option.excludeStyle,
        option.excludeTopic
      )
    );

    setTestIncludedTags((current) => [...new Set([...current, ...includeTags])]);
    setTestExcludedTags((current) => [...new Set([...current, ...excludeTags])]);
    setTestHistory((current) => [
      ...current,
      ...selectedOptions.map((option) => `${testNode?.title ?? "질문"} -> ${option.label}`)
    ]);
    setTestNodeId(lastOption.nextNodeId);
    setTestSelectedOptions([]);
  };

  const copyResultShareText = async () => {
    if (!testNode || testNode.type !== "result") {
      return;
    }

    const text = `[툰비티아이 결과] ${testNode.title}\n${testNode.description}`;

    try {
      await navigator.clipboard.writeText(text);
      window.alert("카톡에 붙여넣을 결과 문구를 복사했습니다.");
    } catch {
      window.alert(text);
    }
  };

  const saveResultImage = () => {
    if (!testNode || testNode.type !== "result" || !testNode.imageUrl) {
      window.alert("먼저 결과 이미지를 업로드하세요.");
      return;
    }

    const link = document.createElement("a");
    link.href = testNode.imageUrl;
    link.download = `${testNode.title || "toonbti-result"}.png`;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.click();
  };

  const toggleTestOption = (option: RouteOption) => {
    if (!testNode || testNode.type !== "question") {
      return;
    }

    if (testNode.selectionMode === "single") {
      applyTestOptions([option.id]);
      return;
    }

    setTestSelectedOptions((current) => {
      if (current.includes(option.id)) {
        return current.filter((id) => id !== option.id);
      }

      if (current.length >= (testNode.maxSelections ?? 1)) {
        return current;
      }

      return [...current, option.id];
    });
  };

  const targetOptions = draft.nodes.map((node) => ({
    id: node.id,
    label: `${node.type === "question" ? "질문" : "결과"} · ${node.title}`
  }));

  return (
    <section
      className={
        isFullscreen
          ? "fixed inset-0 z-[80] overflow-y-auto bg-[#f8f7f4] p-5"
          : "space-y-5"
      }
    >
      <div className="panel-surface px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-coral">
              ToonBTI Route Map · {testStatus === "published" ? "발행됨" : "초안"}
            </p>
            <h2 className="mt-2 font-[var(--font-display)] text-3xl font-semibold text-ink">
              질문지 설정 및 루트맵
            </h2>
            <input
              value={testTitle}
              onChange={(event) => setTestTitle(event.target.value)}
              aria-label="테스트 제목"
              className="mt-3 w-full max-w-xl rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-ink"
            />
            {saveMessage ? (
              <p className={`mt-2 text-sm ${saveState === "error" ? "text-red-600" : saveState === "unavailable" ? "text-amber-700" : "text-slate-500"}`}>
                {saveMessage}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saveState === "loading" || saveState === "saving" || saveState === "unavailable"}
              onClick={() => void saveDraft("draft")}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-300"
            >
              {saveState === "saving" ? "저장 중" : "초안 저장"}
            </button>
            <button
              type="button"
              disabled={saveState === "loading" || saveState === "saving" || saveState === "unavailable"}
              onClick={() => void saveDraft("published")}
              className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
            >
              발행
            </button>
            <button
              type="button"
              onClick={() => addNode("question")}
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
            >
              질문 추가
            </button>
            <button
              type="button"
              onClick={() => addNode("result")}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              결과 추가
            </button>
            <button
              type="button"
              onClick={resetTest}
              className="rounded-full border border-coral/30 bg-[#fff0f3] px-4 py-2 text-sm font-semibold text-coral"
            >
              테스트 처음으로
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen((current) => !current)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              {isFullscreen ? "전체화면 닫기" : "전체화면 편집"}
            </button>
          </div>
        </div>
      </div>

      <div
        className={
          isFullscreen
            ? "grid gap-5 xl:grid-cols-[minmax(0,1fr)_460px]"
            : "grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_420px]"
        }
      >
        <div
          ref={canvasRef}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDropNode}
          className={
            isFullscreen
              ? "panel-surface relative h-[calc(100vh-190px)] overflow-auto p-5"
              : "panel-surface relative min-h-[680px] overflow-auto p-5"
          }
        >
          <div className="sticky left-0 top-0 z-20 mb-3 flex w-max items-center gap-3 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-600 backdrop-blur">
            <span>빈 공간 드래그로 화면 이동</span>
            <label className="flex items-center gap-2">
              화면 줌
              <input
                type="range"
                min={0.5}
                max={1.2}
                step={0.01}
                value={mapZoom}
                onChange={(event) => setMapZoom(Number(event.target.value))}
              />
              <span className="w-10 text-right">{Math.round(mapZoom * 100)}%</span>
            </label>
            <label className="flex items-center gap-2">
              카드 크기
              <input
                type="range"
                min={0.82}
                max={1.35}
                step={0.01}
                value={cardScale}
                onChange={(event) => setCardScale(Number(event.target.value))}
              />
            </label>
          </div>
          <div
            className="relative rounded-[24px] border border-dashed border-slate-200 bg-slate-50"
            style={{
              width: CANVAS_WIDTH * mapZoom,
              height: CANVAS_HEIGHT * mapZoom
            }}
          >
          <div
            onMouseDown={beginPan}
            onMouseMove={movePan}
            onMouseUp={endPan}
            onMouseLeave={endPan}
            className="relative cursor-grab overflow-visible active:cursor-grabbing"
            style={{
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              transform: `scale(${mapZoom})`,
              transformOrigin: "top left"
            }}
          >
            <svg
              className="pointer-events-none absolute left-0 top-0 overflow-visible"
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
            >
              {draft.options.map((option) => {
                const from = draft.nodes.find((node) => node.id === option.questionId);
                const to = draft.nodes.find((node) => node.id === option.nextNodeId);

                if (!from || !to) {
                  return null;
                }

                const startX = from.x + nodeWidth;
                const startY = from.y + nodeHeight / 2;
                const endX = to.x;
                const endY = to.y + nodeHeight / 2;
                const middle = Math.max(40, Math.abs(endX - startX) / 2);

                return (
                  <g key={option.id}>
                    <path
                      d={`M ${startX} ${startY} C ${startX + middle} ${startY}, ${endX - middle} ${endY}, ${endX} ${endY}`}
                      fill="none"
                      stroke="#ff4d6d"
                      strokeWidth={Math.max(2.5, 2.5 / mapZoom)}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                    <circle cx={endX} cy={endY} r="4" fill="#ff4d6d" />
                  </g>
                );
              })}
            </svg>

            {draft.nodes.map((node) => {
              const outgoingCount = draft.options.filter((option) => option.questionId === node.id).length;
              const isSelected = node.id === selectedNodeId;
              const badgeFontSize = Math.max(9, 12 * cardScale);
              const titleFontSize = Math.max(11, 16 * cardScale);
              const bodyFontSize = Math.max(9, 12 * cardScale);
              const footerFontSize = Math.max(9, 12 * cardScale);
              const nodePadding = Math.max(10, 16 * cardScale);

              return (
                <button
                  key={node.id}
                  type="button"
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData("text/plain", node.id)}
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`absolute rounded-[18px] border bg-white text-left shadow-[0_14px_30px_rgba(15,23,42,0.08)] transition ${
                    isSelected ? "border-coral ring-4 ring-coral/10" : "border-slate-200 hover:border-slate-300"
                  }`}
                  style={{
                    left: node.x,
                    top: node.y,
                    width: nodeWidth,
                    minHeight: nodeHeight,
                    padding: nodePadding
                  }}
                >
                  <span
                    className={`rounded-full px-2.5 py-1 font-bold ${
                      node.type === "question"
                        ? "bg-[#eef7ff] text-[#2b6cb0]"
                        : "bg-[#fff0f3] text-[#c9153d]"
                    }`}
                    style={{ fontSize: badgeFontSize }}
                  >
                    {node.type === "question" ? "질문" : "결과"}
                  </span>
                  <p className="mt-3 line-clamp-2 font-bold text-ink" style={{ fontSize: titleFontSize }}>
                    {node.title}
                  </p>
                  <p
                    className="mt-1 line-clamp-2 text-slate-500"
                    style={{ fontSize: bodyFontSize, lineHeight: 1.55 }}
                  >
                    {node.description}
                  </p>
                  <p className="mt-3 font-semibold text-slate-400" style={{ fontSize: footerFontSize }}>
                    {node.type === "question"
                      ? `${node.selectionMode === "multi" ? `다중 최대 ${node.maxSelections ?? 1}개` : "단일 선택"} · 연결 ${outgoingCount}개`
                      : `${node.artistIds?.length ?? 0}명 추천`}
                  </p>
                </button>
              );
            })}
          </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="panel-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-coral">Node Settings</p>
                <h3 className="mt-1 text-xl font-semibold text-ink">선택한 카드 설정</h3>
              </div>
              {selectedNode ? (
                <button
                  type="button"
                  onClick={() => deleteNode(selectedNode.id)}
                  className="rounded-full border border-red-200 px-3 py-2 text-xs font-semibold text-red-500"
                >
                  삭제
                </button>
              ) : null}
            </div>

            {selectedNode ? (
              <div className="mt-5 space-y-3">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-600">제목</span>
                  <input
                    value={selectedNode.title}
                    onChange={(event) => updateNode(selectedNode.id, { title: event.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-ink"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-600">설명</span>
                  <textarea
                    rows={3}
                    value={selectedNode.description}
                    onChange={(event) =>
                      updateNode(selectedNode.id, { description: event.target.value })
                    }
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-ink"
                  />
                </label>

                {selectedNode.type === "question" ? (
                  <>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-600">선택 방식</span>
                      <select
                        value={selectedNode.selectionMode ?? "single"}
                        onChange={(event) =>
                          updateNode(selectedNode.id, {
                            selectionMode: event.target.value as SelectionMode,
                            maxSelections: event.target.value === "single" ? 1 : selectedNode.maxSelections ?? 2
                          })
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-ink"
                      >
                        <option value="single">단일 선택</option>
                        <option value="multi">다중 선택</option>
                      </select>
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-600">최대 선택 개수</span>
                      <input
                        type="number"
                        min={1}
                        disabled={(selectedNode.selectionMode ?? "single") === "single"}
                        value={selectedNode.maxSelections ?? 1}
                        onChange={(event) =>
                          updateNode(selectedNode.id, {
                            maxSelections: Math.max(Number(event.target.value || 1), 1)
                          })
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-ink disabled:bg-slate-50"
                      />
                    </label>
                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600">
                      <input
                        type="radio"
                        checked={draft.startNodeId === selectedNode.id}
                        onChange={() =>
                          setDraft((current) => ({ ...current, startNodeId: selectedNode.id }))
                        }
                      />
                      시작 질문으로 사용
                    </label>
                    <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-ink">선택지 연결</p>
                        <button
                          type="button"
                          onClick={addOption}
                          className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          선택지 추가
                        </button>
                      </div>
                      <div className="mt-3 space-y-3">
                        {nodeOptions.map((option) => (
                          <div key={option.id} className="rounded-[18px] border border-slate-200 bg-white p-3">
                            <div className="flex items-start justify-between gap-2">
                              <input
                                value={option.label}
                                onChange={(event) =>
                                  updateOption(option.id, { label: event.target.value })
                                }
                                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-ink"
                              />
                              <button
                                type="button"
                                onClick={() => deleteOption(option.id)}
                                className="rounded-full px-2 py-1 text-xs font-semibold text-red-500"
                              >
                                삭제
                              </button>
                            </div>
                            <textarea
                              rows={2}
                              value={option.actionNote}
                              onChange={(event) =>
                                updateOption(option.id, { actionNote: event.target.value })
                              }
                              placeholder="예: Tone에서 고자극 소거, 잔잔함 선택"
                              className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-ink"
                            />
                            <div className="mt-2 hidden">
                              <input
                                value={option.includeTags}
                                onChange={(event) =>
                                  updateOption(option.id, { includeTags: event.target.value })
                                }
                                placeholder="선택 태그: 잔잔, 감성"
                                className="rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-ink"
                              />
                              <input
                                value={option.excludeTags}
                                onChange={(event) =>
                                  updateOption(option.id, { excludeTags: event.target.value })
                                }
                                placeholder="소거 태그: 고자극"
                                className="rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-ink"
                              />
                            </div>
                            <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                              <p className="text-xs font-bold text-slate-700">
                                결과 조건: Tone / 호흡 / 그림체 / 주제
                              </p>
                              <div className="mt-2 grid gap-2 md:grid-cols-2">
                                {[
                                  ["Tone 선택", "includeTone"],
                                  ["Tone 소거", "excludeTone"],
                                  ["호흡 선택", "includePace"],
                                  ["호흡 소거", "excludePace"],
                                  ["그림체 선택", "includeStyle"],
                                  ["그림체 소거", "excludeStyle"],
                                  ["주제 선택", "includeTopic"],
                                  ["주제 소거", "excludeTopic"]
                                ].map(([placeholder, key]) => (
                                  <input
                                    key={key}
                                    value={(option[key as keyof RouteOption] as string | undefined) ?? ""}
                                    onChange={(event) =>
                                      updateOption(option.id, {
                                        [key]: event.target.value
                                      } as Partial<RouteOption>)
                                    }
                                    placeholder={`${placeholder}: 쉼표로 구분`}
                                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-ink"
                                  />
                                ))}
                              </div>
                            </div>
                            <select
                              value={option.nextNodeId}
                              onChange={(event) =>
                                updateOption(option.id, { nextNodeId: event.target.value })
                              }
                              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-ink"
                            >
                              {targetOptions
                                .filter((target) => target.id !== selectedNode.id)
                                .map((target) => (
                                  <option key={target.id} value={target.id}>
                                    {target.label}
                                  </option>
                                ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-3">
                      <span className="text-sm font-medium text-slate-600">결과 이미지</span>
                      <div className="overflow-hidden rounded-[20px] border border-dashed border-slate-200 bg-slate-50">
                        {selectedNode.imageUrl ? (
                          <div className="relative h-[320px] w-full">
                            <Image
                              src={selectedNode.imageUrl}
                              alt={selectedNode.title}
                              fill
                              unoptimized
                              sizes="(max-width: 1024px) 100vw, 480px"
                              className="object-contain"
                            />
                          </div>
                        ) : (
                          <div className="flex min-h-40 items-center justify-center text-sm text-slate-400">
                            업로드한 비율 그대로 표시됩니다.
                          </div>
                        )}
                      </div>
                      <label className="flex cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                        {uploadingResultId === selectedNode.id ? "업로드 중..." : "결과 이미지 업로드"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) =>
                            void uploadResultImage(selectedNode.id, event.target.files?.[0])
                          }
                        />
                      </label>
                    </div>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-600">특성</span>
                      <input
                        value={selectedNode.traits ?? ""}
                        onChange={(event) =>
                          updateNode(selectedNode.id, { traits: event.target.value })
                        }
                        placeholder="예: 잔잔함, 여운, 귀여움"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-ink"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-600">추천 만화/작가</span>
                      <select
                        multiple
                        value={selectedNode.artistIds ?? []}
                        onChange={(event) =>
                          updateNode(selectedNode.id, {
                            artistIds: Array.from(event.target.selectedOptions).map((option) => option.value)
                          })
                        }
                        className="h-44 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-ink"
                      >
                        {artists.map((artist) => (
                          <option key={artist.id} value={artist.id}>
                            {artist.name} · {artist.genre}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                루트맵에서 카드를 선택하세요.
              </div>
            )}
          </div>

          <div className="panel-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-coral">Dev Test</p>
                <h3 className="mt-1 text-xl font-semibold text-ink">관리자 테스트</h3>
              </div>
              <button
                type="button"
                onClick={resetTest}
                className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
              >
                초기화
              </button>
            </div>

            {testNode?.type === "question" ? (
              <div className="mt-4 space-y-3">
                <p className="text-lg font-bold text-ink">{testNode.title}</p>
                <p className="text-sm leading-6 text-slate-500">{testNode.description}</p>
                <div className="space-y-2">
                  {testOptions.map((option) => {
                    const selected = testSelectedOptions.includes(option.id);

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => toggleTestOption(option)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                          selected
                            ? "border-coral bg-[#fff0f3] text-coral"
                            : "border-slate-200 bg-white text-slate-700 hover:border-coral"
                        }`}
                      >
                        {option.label}
                        {option.actionNote ? (
                          <span className="mt-1 block text-xs font-normal text-slate-400">
                            {option.actionNote}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                {testNode.selectionMode === "multi" ? (
                  <button
                    type="button"
                    onClick={() => applyTestOptions(testSelectedOptions)}
                    disabled={testSelectedOptions.length === 0}
                    className="w-full rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white disabled:bg-slate-300"
                  >
                    선택 완료
                  </button>
                ) : null}
              </div>
            ) : testNode?.type === "result" ? (
              <div className="mt-4 space-y-4">
                <p className="text-sm font-bold text-coral">결과</p>
                <h4 className="text-2xl font-black text-ink">{testNode.title}</h4>
                {testNode.imageUrl ? (
                  <div className="relative h-[360px] w-full overflow-hidden rounded-[24px] border border-slate-100">
                    <Image
                      src={testNode.imageUrl}
                      alt={testNode.title}
                      fill
                      unoptimized
                      sizes="(max-width: 1024px) 100vw, 480px"
                      className="object-contain"
                    />
                  </div>
                ) : null}
                <p className="text-sm leading-6 text-slate-600">{testNode.description}</p>
                {testNode.traits ? (
                  <div className="flex flex-wrap gap-2">
                    {splitTags(testNode.traits).map((trait) => (
                      <span key={trait} className="rounded-full bg-[#fff0f3] px-3 py-1 text-xs font-semibold text-coral">
                        {trait}
                      </span>
                    ))}
                  </div>
                ) : null}
                {resultArtists.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-ink">추천 만화/작가</p>
                    {resultArtists.map((artist) => (
                      <div key={artist.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-sm font-bold text-ink">{artist.name}</p>
                        <p className="text-xs text-slate-500">{artist.genre}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="grid gap-2 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void copyResultShareText()}
                    className="rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600"
                  >
                    카톡 공유하기
                  </button>
                  <button
                    type="button"
                    onClick={saveResultImage}
                    className="rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600"
                  >
                    이미지 저장하기
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                시작 질문을 설정하세요.
              </div>
            )}

            <div className="mt-4 rounded-[20px] bg-slate-50 p-4 text-xs leading-6 text-slate-500">
              <p className="font-bold text-slate-700">테스트 상태</p>
              <p>선택됨: {testIncludedTags.length ? testIncludedTags.join(", ") : "-"}</p>
              <p>소거됨: {testExcludedTags.length ? testExcludedTags.join(", ") : "-"}</p>
              <p>경로: {testHistory.length ? testHistory.join(" / ") : "-"}</p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
