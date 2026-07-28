"use client";

import { ArrowLeft, Check, ChevronRight, RotateCcw } from "lucide-react";
import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

export type ToonbtiCanvasOption = {
  id: string;
  label: string;
};

type FloatingCharacterStyle = CSSProperties & {
  "--float-delay": string;
  "--float-duration": string;
};

const desktopCharacterPositions = [
  "left-[2%] top-[6%] h-28 w-28 xl:left-[4%] xl:h-36 xl:w-36",
  "left-[8%] top-[38%] h-36 w-36 xl:left-[11%] xl:h-44 xl:w-44",
  "left-[3%] bottom-[5%] h-24 w-24 xl:left-[6%] xl:h-32 xl:w-32",
  "right-[3%] top-[7%] h-28 w-28 xl:right-[5%] xl:h-40 xl:w-40",
  "right-[9%] top-[40%] h-28 w-28 xl:right-[11%] xl:h-36 xl:w-36",
  "right-[3%] bottom-[6%] h-32 w-32 xl:right-[6%] xl:h-44 xl:w-44",
  "left-[16%] bottom-[18%] h-20 w-20 xl:left-[19%] xl:h-28 xl:w-28"
];

const mobileCharacterPositions = [
  "left-[2%] top-1 h-16 w-16",
  "left-[22%] top-7 h-14 w-14",
  "right-[23%] top-4 h-16 w-16",
  "right-[2%] top-8 h-14 w-14"
];

function selectCharacterUrls(urls: string[], step: number) {
  const uniqueUrls = Array.from(new Set(urls.map((url) => url.trim()).filter(Boolean)));

  if (uniqueUrls.length <= 7) {
    const offset = uniqueUrls.length > 0 ? step % uniqueUrls.length : 0;
    return [...uniqueUrls.slice(offset), ...uniqueUrls.slice(0, offset)];
  }

  const offset = (step * 7) % uniqueUrls.length;
  return Array.from(
    { length: 7 },
    (_, index) => uniqueUrls[(offset + index) % uniqueUrls.length]
  );
}

function FloatingCharacters({
  characterUrls,
  characterStep
}: {
  characterUrls: string[];
  characterStep: number;
}) {
  const urls = selectCharacterUrls(characterUrls, characterStep);

  if (urls.length === 0) {
    return null;
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden overflow-hidden lg:block"
      >
        {urls.map((url, index) => (
          <div
            key={`${url}-${index}`}
            className={`absolute ${desktopCharacterPositions[index]} toonbti-floating-character`}
            style={
              {
                "--float-delay": `${index * -0.7}s`,
                "--float-duration": `${5.4 + index * 0.55}s`
              } as FloatingCharacterStyle
            }
          >
            <Image
              src={url}
              alt=""
              fill
              className="object-contain drop-shadow-[0_18px_24px_rgba(57,42,88,0.14)]"
              sizes="176px"
            />
          </div>
        ))}
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none relative mx-auto h-24 w-full max-w-md overflow-hidden lg:hidden"
      >
        {urls.slice(0, 4).map((url, index) => (
          <div
            key={`${url}-mobile-${index}`}
            className={`absolute ${mobileCharacterPositions[index]} toonbti-floating-character`}
            style={
              {
                "--float-delay": `${index * -0.55}s`,
                "--float-duration": `${4.8 + index * 0.5}s`
              } as FloatingCharacterStyle
            }
          >
            <Image
              src={url}
              alt=""
              fill
              className="object-contain drop-shadow-[0_10px_16px_rgba(57,42,88,0.13)]"
              sizes="64px"
            />
          </div>
        ))}
      </div>
    </>
  );
}

function ToonbtiScene({
  characterUrls,
  characterStep = 0,
  children
}: {
  characterUrls: string[];
  characterStep?: number;
  children: ReactNode;
}) {
  return (
    <div className="relative isolate flex min-h-[calc(100vh-60px)] w-full flex-col overflow-hidden bg-[#f8f7f4] px-4 py-5 sm:px-6 sm:py-8">
      <style jsx global>{`
        @keyframes toonbti-character-float {
          0%,
          100% {
            transform: translate3d(0, 0, 0) rotate(-2deg);
          }
          50% {
            transform: translate3d(8px, -17px, 0) rotate(3deg);
          }
        }

        .toonbti-floating-character {
          animation: toonbti-character-float var(--float-duration) ease-in-out infinite;
          animation-delay: var(--float-delay);
        }

        @media (prefers-reduced-motion: reduce) {
          .toonbti-floating-character {
            animation: none;
          }
        }
      `}</style>

      <FloatingCharacters characterUrls={characterUrls} characterStep={characterStep} />
      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 items-center justify-center">
        {children}
      </div>
    </div>
  );
}

export function ToonbtiIntroCanvas({
  imageUrl,
  characterUrls,
  startLabel,
  onStart,
  disabled = false,
  preview = false
}: {
  title: string;
  description: string;
  imageUrl?: string;
  characterUrls?: string[];
  startLabel: string;
  onStart: () => void;
  disabled?: boolean;
  preview?: boolean;
}) {
  return (
    <ToonbtiScene characterUrls={characterUrls ?? []}>
      <article className="w-full overflow-hidden rounded-[30px] border border-black/[0.07] bg-white px-5 py-8 text-center shadow-[0_24px_70px_rgba(38,31,50,0.08)] sm:px-10 sm:py-11">
        <p className="text-sm font-black text-[#ff4d6d]">
          {preview ? "관리자 미리보기 · " : ""}
          나의 인스타툰 취향은?
        </p>
        <h1 className="mt-3 break-keep font-moyamoya text-[42px] leading-[1.08] text-[#19171e] sm:text-[60px]">
          툰-비티아이
          <br />
          테스트
        </h1>

        {imageUrl ? (
          <div className="relative mx-auto mt-6 aspect-[5/2] w-full max-w-lg overflow-hidden rounded-2xl bg-[#f5f0ff]">
            <Image
              src={imageUrl}
              alt="툰비티아이 소개 이미지"
              fill
              priority={!preview}
              className="object-cover"
              sizes="(max-width: 768px) 90vw, 520px"
            />
          </div>
        ) : null}

        <button
          type="button"
          disabled={disabled}
          onClick={onStart}
          className="group mx-auto mt-10 flex min-h-14 w-full max-w-md items-center justify-between rounded-full bg-[#ff4d6d] px-6 text-left text-white shadow-[0_14px_32px_rgba(255,77,109,0.24)] transition hover:bg-[#e83a5a] disabled:cursor-not-allowed disabled:bg-[#cbc8c4] sm:px-7"
        >
          <span>
            <span className="block text-[10px] font-bold text-white/75">
              4가지 취향 축으로 찾기
            </span>
            <span className="mt-0.5 block text-base font-black sm:text-lg">
              {startLabel}
            </span>
          </span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white">
            <ChevronRight size={19} />
          </span>
        </button>
      </article>
    </ToonbtiScene>
  );
}

export function ToonbtiQuestionCanvas({
  testTitle,
  questionText,
  options,
  questionNumber,
  totalQuestions,
  selectedOptionId,
  onChoose,
  onBack,
  contextLabel,
  characterUrls = [],
  characterStep = questionNumber
}: {
  testTitle: string;
  questionText: string;
  options: ToonbtiCanvasOption[];
  questionNumber: number;
  totalQuestions: number;
  selectedOptionId?: string;
  onChoose: (optionId: string) => void;
  onBack: () => void;
  contextLabel?: string;
  characterUrls?: string[];
  characterStep?: number;
}) {
  const progress = totalQuestions > 0 ? (questionNumber / totalQuestions) * 100 : 0;

  return (
    <ToonbtiScene characterUrls={characterUrls} characterStep={characterStep}>
      <div className="w-full">
        <div className="mb-4 rounded-full border border-black/[0.07] bg-white p-1.5 shadow-sm">
          <div className="h-2 overflow-hidden rounded-full bg-[#ece9e4]">
            <div
              className="h-full rounded-full bg-[#ff4d6d] transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <article className="relative w-full overflow-hidden rounded-[30px] border border-black/[0.07] bg-white p-5 shadow-[0_24px_70px_rgba(38,31,50,0.08)] sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              disabled={questionNumber === 1}
              onClick={onBack}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-black/[0.08] px-4 text-xs font-bold text-[#6b6b6b] transition hover:border-[#ff4d6d] hover:text-[#ff4d6d] disabled:invisible"
            >
              <ArrowLeft size={15} />
              이전
            </button>
            <div className="text-right">
              {contextLabel ? (
                <p className="text-[11px] font-bold text-[#FD4C6C]">{contextLabel}</p>
              ) : null}
              <p className="mt-0.5 text-xs font-bold text-[#a0a0a0]">
                {questionNumber} / {totalQuestions}
              </p>
            </div>
          </div>

          <div className="py-7 text-center sm:py-9">
            <span className="inline-flex rounded-full bg-[#fff0f3] px-4 py-1.5 text-xs font-black text-[#ff4d6d]">
              Q {String(questionNumber).padStart(2, "0")}
            </span>
            <p className="mt-4 font-moyamoya text-xl text-[#FD4C6C] sm:text-2xl">
              {testTitle || "툰-비티아이"}
            </p>
            <h1 className="mx-auto mt-3 max-w-xl break-keep text-2xl font-black leading-[1.45] text-[#19171e] sm:text-[32px]">
              {questionText || "질문 문구를 입력해 주세요."}
            </h1>
          </div>

          <section className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
            {options.map((option, index) => {
              const selected = selectedOptionId === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onChoose(option.id)}
                  className={`flex min-h-16 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                    selected
                      ? "border-[#ff4d6d] bg-[#ff4d6d] text-white shadow-[0_10px_22px_rgba(255,77,109,0.2)]"
                      : "border-black/[0.08] bg-[#f8f7f4] text-[#56515c] hover:border-[#ff4d6d] hover:bg-[#fff8fa]"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                      selected
                        ? "bg-white text-[#ff4d6d]"
                        : "bg-white text-[#FD4C6C]"
                    }`}
                  >
                    {selected ? <Check size={16} strokeWidth={3} /> : index + 1}
                  </span>
                  <span className="break-keep text-sm font-bold leading-5">
                    {option.label || `답변 ${index + 1} 문구 미입력`}
                  </span>
                </button>
              );
            })}
          </section>
        </article>
      </div>
    </ToonbtiScene>
  );
}

export function ToonbtiResultPreviewCanvas({
  code,
  name,
  description,
  traits,
  onRestart,
  characterUrls = []
}: {
  code: string;
  name: string;
  description: string;
  traits: Array<{ axis: string; label: string }>;
  onRestart: () => void;
  characterUrls?: string[];
}) {
  return (
    <ToonbtiScene characterUrls={characterUrls}>
      <article className="w-full overflow-hidden rounded-[30px] border border-black/[0.07] bg-white shadow-[0_24px_70px_rgba(38,31,50,0.09)]">
        <header className="px-6 py-8 text-center sm:px-10 sm:py-10">
          <p className="text-xs font-black text-[#ff4d6d]">나의 툰-비티아이</p>
          <p className="mt-3 font-moyamoya text-6xl text-[#FD4C6C] sm:text-7xl">{code}</p>
          <h1 className="mt-3 break-keep text-2xl font-black text-[#19171e] sm:text-3xl">
            {name}
          </h1>
          <p className="mx-auto mt-4 max-w-lg break-keep text-sm leading-6 text-[#6b6b6b]">
            {description}
          </p>
        </header>

        <div className="grid grid-cols-2 border-y border-black/[0.07] bg-[#f8f7f4]">
          {traits.map((trait) => (
            <div key={trait.axis} className="border-b border-r border-black/[0.07] p-4">
              <p className="text-[11px] font-bold text-[#a0a0a0]">{trait.axis}</p>
              <p className="mt-1 text-sm font-black text-[#333037]">{trait.label}</p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onRestart}
          className="flex min-h-16 w-full items-center justify-center gap-2 bg-[#ff4d6d] px-6 text-sm font-black text-white transition hover:bg-[#e83a5a]"
        >
          <RotateCcw size={16} />
          다시 실시하기
        </button>
      </article>
    </ToonbtiScene>
  );
}
