"use client";

import { Check, RotateCcw, X } from "lucide-react";
import { useMemo, useState } from "react";

import {
  ToonbtiIntroCanvas,
  ToonbtiQuestionCanvas,
  ToonbtiResultPreviewCanvas
} from "@/components/toonbti/ToonbtiTestCanvas";
import {
  calculateToonbtiResult,
  getActiveToonbtiAxes,
  getActiveTraitsForAxis,
  type ToonbtiAnswer,
  type ToonbtiConfig
} from "@/lib/domain/toonbti";

type PreviewStep = "intro" | "questions" | "result";

export function ToonbtiTestPreview({
  config,
  characterUrls,
  onClose
}: {
  config: ToonbtiConfig;
  characterUrls: string[];
  onClose: () => void;
}) {
  const axes = useMemo(() => getActiveToonbtiAxes(config), [config]);
  const questions = useMemo(
    () =>
      [...config.questions]
        .filter((question) => question.isActive)
        .sort((left, right) => left.position - right.position),
    [config.questions]
  );
  const [step, setStep] = useState<PreviewStep>("intro");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<ToonbtiAnswer[]>([]);
  const [resultCode, setResultCode] = useState("");
  const [error, setError] = useState("");
  const [previewCharacterUrls] = useState(() =>
    [...characterUrls].sort(() => Math.random() - 0.5)
  );

  const question = questions[questionIndex] ?? null;
  const questionOptions = question
    ? config.options
        .filter((option) => option.questionId === question.id && option.isActive)
        .sort((left, right) => left.position - right.position)
    : [];
  const selectedOptionId = question
    ? answers.find((answer) => answer.questionId === question.id)?.optionId
    : undefined;
  const result = config.resultTypes.find(
    (candidate) => candidate.isActive && candidate.code === resultCode
  );
  const incompleteQuestions = questions.filter((item) => {
    const options = config.options.filter(
      (option) => option.questionId === item.id && option.isActive
    );
    return (
      !item.questionText.trim() ||
      options.length !== 4 ||
      options.some((option) => !option.optionText.trim())
    );
  });
  const canRun =
    axes.length === 4 &&
    questions.length > 0 &&
    questions.every((item) => {
      const options = config.options.filter(
        (option) => option.questionId === item.id && option.isActive
      );
      return options.length === 4;
    });

  const restart = () => {
    setStep("intro");
    setQuestionIndex(0);
    setAnswers([]);
    setResultCode("");
    setError("");
  };

  const choose = (optionId: string) => {
    if (!question) return;
    const nextAnswers = [
      ...answers.filter((answer) => answer.questionId !== question.id),
      { questionId: question.id, optionId }
    ];
    setAnswers(nextAnswers);
    setError("");

    if (questionIndex < questions.length - 1) {
      setQuestionIndex((current) => current + 1);
      return;
    }

    try {
      const calculation = calculateToonbtiResult(config, nextAnswers);
      setResultCode(calculation.code);
      setStep("result");
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : "예상 결과를 계산하지 못했습니다."
      );
    }
  };

  const currentAxis = question
    ? axes.find((axis) => axis.id === question.axisId)
    : undefined;
  const currentAxisIndex = currentAxis
    ? axes.findIndex((axis) => axis.id === currentAxis.id)
    : -1;
  const resultTraits = axes.map((axis, axisIndex) => {
    const trait = getActiveTraitsForAxis(config, axis.id).find(
      (item) => item.code === resultCode[axisIndex]
    );
    return {
      axis: axis.name,
      label: trait ? `${trait.code} · ${trait.name}` : resultCode[axisIndex] || "-"
    };
  });

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-2 md:p-5">
      <div className="grid h-[min(900px,calc(100vh-16px))] w-full max-w-6xl overflow-hidden rounded-lg bg-white shadow-2xl md:h-[min(900px,calc(100vh-40px))] md:grid-cols-[240px_1fr]">
        <aside className="border-b border-slate-800 bg-slate-950 p-4 text-white md:flex md:flex-col md:border-b-0 md:border-r md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-300">
                Admin Preview
              </p>
              <h2 className="mt-1 text-lg font-bold">테스트 미리보기</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="예상 테스트 닫기"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-white/15 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-1 md:grid-cols-1 md:gap-0">
            {[
              ["축", `${axes.length}/4`],
              ["질문", `${questions.length}`],
              ["완료", `${questions.length - incompleteQuestions.length}/${questions.length}`],
              ["결과", `${config.resultTypes.filter((item) => item.isActive).length}/16`]
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-md bg-white/[0.08] p-2 text-center md:flex md:items-center md:justify-between md:rounded-none md:border-b md:border-white/10 md:bg-transparent md:px-0 md:py-3 md:text-left"
              >
                <span className="block text-[10px] text-slate-400 md:text-xs">{label}</span>
                <span className="mt-1 block text-xs font-bold md:mt-0 md:text-sm">{value}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 hidden rounded-md bg-white/[0.08] p-4 md:block">
            <p className="text-xs font-bold text-blue-200">미리보기 안내</p>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              현재 편집 중인 데이터만 사용합니다. 통계와 운영 DB에는 기록되지 않습니다.
            </p>
          </div>

          {incompleteQuestions.length > 0 ? (
            <div className="mt-3 hidden rounded-md border border-amber-300/25 bg-amber-300/10 p-4 md:block">
              <p className="text-xs font-bold text-amber-200">
                미입력 문항 {incompleteQuestions.length}개
              </p>
              <p className="mt-1 text-xs leading-5 text-amber-100/75">
                빈 문구는 자리표시자로 보입니다.
              </p>
            </div>
          ) : (
            <div className="mt-3 hidden items-center gap-2 rounded-md bg-emerald-400/10 p-4 text-xs font-bold text-emerald-200 md:flex">
              <Check size={15} />
              질문 문구 준비 완료
            </div>
          )}

          <button
            type="button"
            onClick={restart}
            className="mt-3 hidden h-11 items-center justify-center gap-2 rounded-md border border-white/15 text-sm font-bold text-slate-200 hover:bg-white/10 md:mt-auto md:inline-flex"
          >
            <RotateCcw size={16} />
            처음부터
          </button>
        </aside>

        <div className="min-h-0 overflow-y-auto bg-[#f2f3f7]">
          <div className="flex min-h-full w-full items-center justify-center px-3 py-6 sm:px-6 sm:py-9">
            {step === "intro" ? (
              <ToonbtiIntroCanvas
                title={config.test.title}
                description={config.test.description}
                imageUrl={config.test.introImageUrl}
                characterUrls={previewCharacterUrls}
                startLabel={
                  canRun
                    ? config.test.startButtonLabel || "예상 테스트 시작"
                    : "질문 구조를 먼저 준비해 주세요"
                }
                disabled={!canRun}
                preview
                onStart={() => {
                  setStep("questions");
                  setQuestionIndex(0);
                }}
              />
            ) : null}

            {step === "questions" && question ? (
              <div className="w-full">
                <ToonbtiQuestionCanvas
                  testTitle={config.test.title}
                  questionText={question.questionText}
                  options={questionOptions.map((option) => ({
                    id: option.id,
                    label: option.optionText
                  }))}
                  questionNumber={questionIndex + 1}
                  totalQuestions={questions.length}
                  selectedOptionId={selectedOptionId}
                  onChoose={choose}
                  onBack={() =>
                    setQuestionIndex((current) => Math.max(0, current - 1))
                  }
                  contextLabel={`관리자 확인 · ${currentAxisIndex + 1}축`}
                  characterUrls={previewCharacterUrls}
                />
                {error ? (
                  <p className="mx-auto mt-3 max-w-[600px] rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">
                    {error}
                  </p>
                ) : null}
              </div>
            ) : null}

            {step === "result" ? (
              <ToonbtiResultPreviewCanvas
                code={resultCode}
                name={result?.name || `${resultCode} 결과 유형`}
                description={
                  result?.shortDescription ||
                  "이 결과 코드의 한 줄 설명을 입력하면 여기에 표시됩니다."
                }
                traits={resultTraits}
                onRestart={restart}
                characterUrls={previewCharacterUrls}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
