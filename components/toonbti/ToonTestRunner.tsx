"use client";

import { ArrowLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  calculateToonbtiResult,
  type ToonbtiAnswer,
  type ToonbtiConfig
} from "@/lib/domain/toonbti";

type StoredProgress = {
  started: boolean;
  questionIndex: number;
  answers: ToonbtiAnswer[];
};

function sendEvent(payload: Record<string, string>) {
  void fetch("/api/toonbti-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true
  }).catch(() => undefined);
}

export function ToonTestRunner({ config }: { config: ToonbtiConfig }) {
  const router = useRouter();
  const questions = useMemo(
    () => [...config.questions].sort((left, right) => left.position - right.position),
    [config.questions]
  );
  const storageKey = `intooni:toonbti:${config.test.id}:v${config.test.version}`;
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<ToonbtiAnswer[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as StoredProgress;
        setStarted(Boolean(saved.started));
        setQuestionIndex(Math.min(Math.max(0, saved.questionIndex ?? 0), questions.length - 1));
        setAnswers(Array.isArray(saved.answers) ? saved.answers : []);
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    } finally {
      setReady(true);
    }
  }, [questions.length, storageKey]);

  useEffect(() => {
    if (!ready) return;
    const progress: StoredProgress = { started, questionIndex, answers };
    window.localStorage.setItem(storageKey, JSON.stringify(progress));
  }, [answers, questionIndex, ready, started, storageKey]);

  const question = questions[questionIndex] ?? null;
  const options = useMemo(
    () =>
      question
        ? config.options
            .filter((option) => option.questionId === question.id)
            .sort((left, right) => left.position - right.position)
        : [],
    [config.options, question]
  );
  const selectedOptionId = question
    ? answers.find((answer) => answer.questionId === question.id)?.optionId
    : undefined;

  const begin = () => {
    setStarted(true);
    sendEvent({ eventType: "toonbti_start", testId: config.test.id });
  };

  const choose = (optionId: string) => {
    if (!question) return;
    const nextAnswers = [
      ...answers.filter((answer) => answer.questionId !== question.id),
      { questionId: question.id, optionId }
    ];
    setAnswers(nextAnswers);
    sendEvent({
      eventType: "toonbti_answer",
      testId: config.test.id,
      questionId: question.id
    });

    if (questionIndex < questions.length - 1) {
      window.setTimeout(() => setQuestionIndex((current) => current + 1), 120);
      return;
    }

    const calculation = calculateToonbtiResult(config, nextAnswers);
    if (!calculation.resultType) return;
    sendEvent({
      eventType: "toonbti_complete",
      testId: config.test.id,
      resultCode: calculation.code
    });
    window.localStorage.removeItem(storageKey);
    router.push(`/toonbti/result/${encodeURIComponent(calculation.code)}`);
  };

  if (!ready) {
    return <div className="min-h-[calc(100vh-60px)]" aria-label="툰비티아이 불러오는 중" />;
  }

  if (!started) {
    return (
      <section className="mx-auto grid min-h-[calc(100vh-60px)] w-full max-w-5xl items-center gap-10 px-5 py-12 md:grid-cols-[minmax(0,1fr)_360px] md:px-8">
        <div>
          <p className="text-sm font-black text-[#ff4d6d]">TOON-BTI</p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight md:text-6xl">{config.test.title}</h1>
          <p className="mt-5 max-w-xl whitespace-pre-wrap text-base leading-8 text-slate-600">
            {config.test.description}
          </p>
          <button
            type="button"
            onClick={begin}
            className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#ff4d6d] px-7 text-base font-bold text-white transition hover:bg-[#e93b5d]"
          >
            {config.test.startButtonLabel}
            <ChevronRight size={18} />
          </button>
        </div>
        {config.test.introImageUrl ? (
          <div className="relative aspect-square overflow-hidden rounded-lg bg-white">
            <Image
              src={config.test.introImageUrl}
              alt=""
              fill
              priority
              className="object-cover"
              sizes="(max-width: 768px) 90vw, 360px"
            />
          </div>
        ) : (
          <div className="hidden aspect-square items-center justify-center rounded-lg bg-[#fff0f3] text-7xl font-black text-[#ff4d6d] md:flex">
            T
          </div>
        )}
      </section>
    );
  }

  if (!question) {
    return <p className="py-24 text-center text-slate-500">활성 질문을 찾지 못했습니다.</p>;
  }

  const progress = Math.round(((questionIndex + 1) / questions.length) * 100);
  return (
    <section className="mx-auto flex min-h-[calc(100vh-60px)] w-full max-w-3xl items-center px-5 py-12 md:px-8">
      <div className="w-full">
        <div className="flex items-center justify-between text-sm font-bold text-slate-500">
          <button
            type="button"
            disabled={questionIndex === 0}
            onClick={() => setQuestionIndex((current) => Math.max(0, current - 1))}
            className="inline-flex items-center gap-1 disabled:invisible"
          >
            <ArrowLeft size={17} />
            이전
          </button>
          <span>
            {questionIndex + 1} / {questions.length}
          </span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-[#ff4d6d] transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-10 text-sm font-bold text-[#ff4d6d]">{config.test.title}</p>
        <h1 className="mt-3 text-3xl font-extrabold leading-tight md:text-5xl">
          {question.questionText}
        </h1>
        <div className="mt-8 grid gap-3">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => choose(option.id)}
              className={`min-h-14 rounded-lg border px-5 py-4 text-left text-base font-bold transition ${
                selectedOptionId === option.id
                  ? "border-[#ff4d6d] bg-[#fff0f3] text-[#c9153d]"
                  : "border-slate-200 bg-white text-slate-700 hover:border-[#ff4d6d]"
              }`}
            >
              {option.optionText}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
