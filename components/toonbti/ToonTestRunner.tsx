"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  ToonbtiIntroCanvas,
  ToonbtiQuestionCanvas
} from "@/components/toonbti/ToonbtiTestCanvas";
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

export function ToonTestRunner({
  config,
  characterUrls
}: {
  config: ToonbtiConfig;
  characterUrls?: string[];
}) {
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
    return (
      <div
        className="min-h-[calc(100vh-60px)] bg-[#f2f3f7]"
        aria-label="툰비티아이 불러오는 중"
      />
    );
  }

  if (!started) {
    return (
      <ToonbtiIntroCanvas
        title={config.test.title}
        description={config.test.description}
        imageUrl={config.test.introImageUrl}
        characterUrls={characterUrls}
        startLabel={config.test.startButtonLabel}
        onStart={begin}
      />
    );
  }

  if (!question) {
    return <p className="py-24 text-center text-slate-500">활성 질문을 찾지 못했습니다.</p>;
  }

  return (
    <ToonbtiQuestionCanvas
      testTitle={config.test.title}
      questionText={question.questionText}
      options={options.map((option) => ({
        id: option.id,
        label: option.optionText
      }))}
      questionNumber={questionIndex + 1}
      totalQuestions={questions.length}
      selectedOptionId={selectedOptionId}
      onChoose={choose}
      onBack={() => setQuestionIndex((current) => Math.max(0, current - 1))}
      characterUrls={characterUrls}
    />
  );
}
