"use client";

import { Check, RotateCcw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  CANONICAL_TOONBTI_AXES,
  getActiveToonbtiAxes,
  getActiveTraitsForAxis,
  type ToonbtiConfig
} from "@/lib/domain/toonbti";

type ArtistToonbtiAssignmentProps = {
  artistId?: string;
};

type ArtistAssignment = {
  artistId: string;
  testId: string;
  resultTypeId: string;
};

type AdminToonbtiResponse = {
  config: ToonbtiConfig | null;
  assignments: ArtistAssignment[];
  storageAvailable: boolean;
  message?: string;
};

type Notice = {
  tone: "success" | "error";
  text: string;
} | null;

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { message?: string };
  if (!response.ok) {
    throw new Error(data.message || "Toon-BTI 정보를 처리하지 못했습니다.");
  }
  return data;
}

export function ArtistToonbtiAssignment({
  artistId
}: ArtistToonbtiAssignmentProps) {
  const [config, setConfig] = useState<ToonbtiConfig | null>(null);
  const [selectedTraitIds, setSelectedTraitIds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(Boolean(artistId));
  const [busy, setBusy] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);

  const activeAxes = useMemo(
    () => (config ? getActiveToonbtiAxes(config) : []),
    [config]
  );

  useEffect(() => {
    setSelectedTraitIds({});
    setNotice(null);

    if (!artistId) {
      setLoading(false);
      setConfig(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    void fetch("/api/admin/toonbti", {
      cache: "no-store",
      signal: controller.signal
    })
      .then((response) => readJson<AdminToonbtiResponse>(response))
      .then((data) => {
        setStorageAvailable(data.storageAvailable);
        setConfig(data.config);

        const assignment = data.assignments.find(
          (item) => item.artistId === artistId
        );
        const result = data.config?.resultTypes.find(
          (item) => item.id === assignment?.resultTypeId
        );
        if (!data.config || !result) return;

        const nextSelection: Record<string, string> = {};
        getActiveToonbtiAxes(data.config).forEach((axis, index) => {
          const trait = getActiveTraitsForAxis(data.config!, axis.id).find(
            (candidate) => candidate.code === result.code[index]
          );
          if (trait) nextSelection[axis.id] = trait.id;
        });
        setSelectedTraitIds(nextSelection);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setNotice({
          tone: "error",
          text:
            error instanceof Error
              ? error.message
              : "Toon-BTI 정보를 불러오지 못했습니다."
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [artistId]);

  const selectedCode =
    config && activeAxes.length === 4
      ? activeAxes
          .map((axis) => {
            const selectedTraitId = selectedTraitIds[axis.id];
            return (
              config.traits.find((trait) => trait.id === selectedTraitId)?.code ??
              "-"
            );
          })
          .join("")
      : "----";

  const selectedResult = config?.resultTypes.find(
    (result) => result.isActive && result.code === selectedCode
  );
  const isComplete =
    activeAxes.length === 4 &&
    activeAxes.every((axis) => Boolean(selectedTraitIds[axis.id]));

  const saveAssignment = async (clear = false) => {
    if (!artistId || !config) return;
    if (!clear && (!isComplete || !selectedResult)) {
      setNotice({
        tone: "error",
        text: "네 가지 축을 모두 선택하고 연결할 결과 유형을 확인해 주세요."
      });
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      await readJson<{ assignment: ArtistAssignment | null }>(
        await fetch("/api/admin/toonbti/assignments", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            artistId,
            testId: config.test.id,
            resultTypeId: clear ? null : selectedResult?.id
          })
        })
      );
      if (clear) setSelectedTraitIds({});
      setNotice({
        tone: "success",
        text: clear
          ? "이 작가의 Toon-BTI 지정을 해제했습니다."
          : `${selectedCode} 유형으로 저장했습니다.`
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "작가 Toon-BTI를 저장하지 못했습니다."
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800">작가 Toon-BTI</h3>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            검색 태그와는 별개입니다. 테스트 결과와 같은 4축 유형의 작가를
            연결할 때만 사용합니다.
          </p>
        </div>
        <div className="rounded-lg bg-slate-900 px-4 py-2 text-right text-white">
          <p className="text-[10px] text-slate-300">현재 선택</p>
          <p className="font-mono text-lg font-bold">{selectedCode}</p>
        </div>
      </div>

      {!artistId ? (
        <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
          작가 기본 정보를 먼저 저장한 뒤 Toon-BTI를 지정할 수 있습니다.
        </p>
      ) : loading ? (
        <p className="mt-4 rounded-lg bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
          Toon-BTI 설정을 불러오는 중입니다.
        </p>
      ) : !storageAvailable ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Toon-BTI 데이터베이스 설정이 아직 준비되지 않았습니다.
        </p>
      ) : !config || activeAxes.length !== 4 ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          관리자 Toon-BTI 설정에서 활성 축 네 개를 먼저 준비해 주세요.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {activeAxes.map((axis, axisIndex) => (
              <div
                key={axis.id}
                className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"
              >
                <p className="text-xs font-bold text-slate-700">
                  {axisIndex + 1}. {axis.name}
                </p>
                <p className="mt-1 text-[10px] leading-4 text-slate-500">
                  {CANONICAL_TOONBTI_AXES[axisIndex]?.summary}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {getActiveTraitsForAxis(config, axis.id).map((trait) => {
                    const selected = selectedTraitIds[axis.id] === trait.id;
                    return (
                      <button
                        key={trait.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setSelectedTraitIds((current) => ({
                            ...current,
                            [axis.id]: trait.id
                          }));
                          setNotice(null);
                        }}
                        className={`min-h-20 rounded-lg border px-3 py-2 text-left transition ${
                          selected
                            ? "border-blue-600 bg-blue-50 text-blue-800"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                        }`}
                      >
                        <span className="flex items-center gap-1.5 text-xs font-bold">
                          {selected ? <Check size={14} /> : null}
                          {trait.code} · {trait.name}
                        </span>
                        <span className="mt-1 block text-[10px] leading-4 text-slate-500">
                          {trait.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-3">
            <div>
              <p className="text-[10px] font-bold text-slate-400">연결 결과</p>
              <p className="mt-0.5 text-sm font-bold text-slate-800">
                {selectedResult
                  ? `${selectedResult.code} · ${selectedResult.name}`
                  : selectedCode.includes("-")
                    ? "네 가지 축을 모두 선택해 주세요."
                    : "이 코드에 연결된 활성 결과 유형이 없습니다."}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveAssignment(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 disabled:opacity-50"
              >
                <RotateCcw size={14} />
                지정 해제
              </button>
              <button
                type="button"
                disabled={busy || !selectedResult}
                onClick={() => void saveAssignment(false)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white disabled:opacity-40"
              >
                <Save size={14} />
                유형 저장
              </button>
            </div>
          </div>
        </>
      )}

      {notice ? (
        <p
          role="status"
          className={`mt-3 rounded-lg px-3 py-2 text-xs ${
            notice.tone === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {notice.text}
        </p>
      ) : null}
    </section>
  );
}
