"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { ArtistModal } from "@/components/ArtistModal";
import { InstagramEmbed } from "@/components/InstagramEmbed";
import { ARTIST_SQUARE_PLACEHOLDER } from "@/lib/placeholders";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { Artist } from "@/lib/types";

type ToonbtiField = "mood_tags" | "episode_formats" | "style_tags" | "topic_tags";

type ToonbtiQuestion = {
  key: ToonbtiField;
  eyebrow: string;
  title: string;
  helper: string;
  maxSelections: number;
  options: Array<{
    label: string;
    description?: string;
  }>;
};

type ToonbtiAnswers = Record<ToonbtiField, string[]>;

const DEFAULT_QUESTIONS: ToonbtiQuestion[] = [
  {
    key: "mood_tags",
    eyebrow: "Q1",
    title: "나는 이런 분위기의 인스타툰이 좋아!",
    helper: "최대 2개 선택",
    maxSelections: 2,
    options: [{ label: "개그" }, { label: "잔잔" }, { label: "달달" }, { label: "고자극" }, { label: "귀여움" }]
  },
  {
    key: "episode_formats",
    eyebrow: "Q2",
    title: "에피소드는 이 정도 호흡이 좋지..",
    helper: "1개 선택",
    maxSelections: 1,
    options: [
      { label: "짧다", description: "한 화마다 바로 끝남" },
      { label: "중간", description: "2~3화 안에 마무리" },
      { label: "길다", description: "스토리가 계속 이어짐" }
    ]
  },
  {
    key: "style_tags",
    eyebrow: "Q3",
    title: "그림체는 이런 게 좋더라",
    helper: "최대 2개 선택",
    maxSelections: 2,
    options: [
      { label: "단순" },
      { label: "귀여움" },
      { label: "감성적" },
      { label: "현실적" },
      { label: "개성적" },
      { label: "흑백" },
      { label: "컬러풀" },
      { label: "밈" }
    ]
  },
  {
    key: "topic_tags",
    eyebrow: "Q4",
    title: "어떤 주제가 제일 좋을까..",
    helper: "최대 4개 선택",
    maxSelections: 4,
    options: [
      { label: "상관없어" },
      { label: "연애" },
      { label: "직장" },
      { label: "일상" },
      { label: "썰" },
      { label: "괴담" },
      { label: "대학생" },
      { label: "여행" },
      { label: "운동" },
      { label: "군대" },
      { label: "워홀" },
      { label: "공룡" }
    ]
  }
];

const INITIAL_ANSWERS: ToonbtiAnswers = {
  mood_tags: [],
  episode_formats: [],
  style_tags: [],
  topic_tags: []
};

const REVEAL_DELAY_MS = 2000;
const RESULT_PAGE_SIZE = 8;
const FLOATING_CHARACTER_POSITIONS = [
  "left-[3vw] top-[8vh] h-28 w-28 xl:left-[5vw] xl:h-36 xl:w-36",
  "left-[14vw] top-[29vh] h-32 w-32 xl:left-[13vw] xl:h-44 xl:w-44",
  "left-[6vw] bottom-[13vh] h-24 w-24 xl:left-[7vw] xl:h-32 xl:w-32",
  "right-[4vw] top-[10vh] h-28 w-28 xl:right-[6vw] xl:h-40 xl:w-40",
  "right-[15vw] top-[35vh] h-24 w-24 xl:right-[14vw] xl:h-36 xl:w-36",
  "right-[7vw] bottom-[11vh] h-32 w-32 xl:right-[8vw] xl:h-44 xl:w-44",
  "left-[18vw] bottom-[26vh] h-20 w-20 xl:left-[19vw] xl:h-28 xl:w-28"
];
const MOBILE_FLOATING_CHARACTER_POSITIONS = [
  "left-[4%] top-8 h-20 w-20",
  "left-[34%] top-2 h-24 w-24",
  "right-[5%] top-10 h-20 w-20",
  "left-[19%] bottom-3 h-16 w-16",
  "right-[24%] bottom-0 h-24 w-24"
];

function getOverlapCount(values: string[], selected: string[]) {
  const normalizedValues = new Set(values.map((value) => value.trim()).filter(Boolean));
  return selected.filter((value) => normalizedValues.has(value)).length;
}

function collectArtistTags(artists: Artist[], field: ToonbtiField) {
  const tags = new Set<string>();

  artists.forEach((artist) => {
    artist[field].forEach((tag) => {
      const trimmed = tag.trim();

      if (trimmed) {
        tags.add(trimmed);
      }
    });
  });

  return [...tags];
}

function mergeQuestionOptions(question: ToonbtiQuestion, artists: Artist[]): ToonbtiQuestion {
  if (question.key === "episode_formats") {
    return question;
  }

  const artistLabels = collectArtistTags(artists, question.key);
  const mergedLabels = artistLabels.filter(
    (label, index, labels) => labels.indexOf(label) === index
  );

  return {
    ...question,
    options: mergedLabels.map((label) => ({ label }))
  };
}

function buildQuestionsFromArtists(artists: Artist[]) {
  return DEFAULT_QUESTIONS.map((question) => mergeQuestionOptions(question, artists));
}

function artistMatchesSelectedFilters(
  artist: Artist,
  answers: ToonbtiAnswers,
  questions: ToonbtiQuestion[]
) {
  return questions.every((question) => {
    const selected = answers[question.key];
    const effectiveSelected = selected.filter((value) => value !== "상관없어");

    if (effectiveSelected.length === 0) {
      return true;
    }

    return getOverlapCount(artist[question.key], effectiveSelected) > 0;
  });
}

function formatChoiceSummary(answers: ToonbtiAnswers) {
  const selected = [...answers.mood_tags, ...answers.episode_formats, ...answers.style_tags, ...answers.topic_tags]
    .filter((value) => value !== "상관없어")
    .slice(0, 5);

  if (selected.length === 0) {
    return "아직 취향을 고르는 중이에요.";
  }

  return `${selected.join(", ")} 쪽의 인스타툰을 좋아하는 타입이에요.`;
}

function getFallbackInstagramUrl(artist: Artist) {
  return artist.gallery_post_urls.find((url) => url.trim()) ?? "";
}

function pickFloatingArtists(artists: Artist[], step: number) {
  const withCharacter = artists.filter((artist) => artist.character_url);

  if (withCharacter.length === 0) {
    return [];
  }

  return [...withCharacter]
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(7, withCharacter.length))
    .map((artist, index) => ({
      artist,
      position: FLOATING_CHARACTER_POSITIONS[index],
      delay: `${(step + index) * 0.35}s`,
      duration: `${5.2 + index * 0.65}s`
    }));
}

function FloatingToonbtiCharacters({
  artists,
  onPick
}: {
  artists: Array<{ artist: Artist; position: string; delay: string; duration: string }>;
  onPick: (artist: Artist) => void;
}) {
  if (artists.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[60px] z-0 hidden h-[calc(100vh-60px)] overflow-hidden lg:block">
      {artists.map(({ artist, position, delay, duration }) => (
        <button
          key={artist.id}
          type="button"
          aria-label={`${artist.name} 작가 보기`}
          onClick={() => onPick(artist)}
          className={`pointer-events-auto absolute ${position} rounded-[28px] p-2 transition hover:scale-105`}
          style={{
            animation: `toonbti-character-float ${duration} ease-in-out infinite`,
            animationDelay: delay
          }}
        >
          <span className="relative block h-full w-full drop-shadow-[0_18px_24px_rgba(0,0,0,0.14)]">
            <Image
              src={artist.character_url}
              alt={artist.name}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 96px, 160px"
            />
          </span>
        </button>
      ))}
    </div>
  );
}

function MobileFloatingToonbtiCharacters({
  artists,
  onPick
}: {
  artists: Array<{ artist: Artist; delay: string; duration: string }>;
  onPick: (artist: Artist) => void;
}) {
  if (artists.length === 0) {
    return null;
  }

  return (
    <div className="relative mx-auto mt-8 h-44 max-w-md overflow-hidden rounded-[32px] bg-[#fff9fb] lg:hidden">
      {artists.slice(0, 5).map(({ artist, delay, duration }, index) => (
        <button
          key={artist.id}
          type="button"
          aria-label={`${artist.name} 작가 보기`}
          onClick={() => onPick(artist)}
          className={`absolute ${MOBILE_FLOATING_CHARACTER_POSITIONS[index]} rounded-[24px] p-2 transition active:scale-95`}
          style={{
            animation: `toonbti-character-float ${duration} ease-in-out infinite`,
            animationDelay: delay
          }}
        >
          <span className="relative block h-full w-full drop-shadow-[0_14px_20px_rgba(0,0,0,0.12)]">
            <Image
              src={artist.character_url}
              alt={artist.name}
              fill
              className="object-contain"
              sizes="96px"
            />
          </span>
        </button>
      ))}
    </div>
  );
}

function ResultArtistCard({
  artist,
  onClick
}: {
  artist: Artist;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group overflow-hidden rounded-[24px] border border-[rgba(0,0,0,0.08)] bg-white text-left transition hover:-translate-y-1 hover:shadow-[0_14px_34px_rgba(0,0,0,0.1)]"
    >
      <div className="relative aspect-square overflow-hidden bg-[#f2f0ec]">
        <Image
          src={artist.thumbnail_url || ARTIST_SQUARE_PLACEHOLDER}
          alt={artist.name}
          fill
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
          sizes="(max-width: 768px) 50vw, 260px"
        />
      </div>
      <div className="space-y-2 p-4">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-[#1a1a1a]">{artist.name}</p>
          <p className="mt-1 truncate text-sm text-[#8a8a8a]">{artist.genre} 작가</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {artist.hashtags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-[#efebff] px-2.5 py-0.5 text-[11px] font-semibold text-[#5a43d6]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

function ResultInstagramCard({
  artist,
  onClick
}: {
  artist: Artist;
  onClick: () => void;
}) {
  const instagramUrl = getFallbackInstagramUrl(artist);

  if (!instagramUrl) {
    return null;
  }

  return (
    <article className="overflow-hidden rounded-[24px] border border-[rgba(0,0,0,0.08)] bg-white">
      <div className="p-2">
        <InstagramEmbed
          url={instagramUrl}
          className="min-h-[320px] rounded-[18px] border border-[rgba(0,0,0,0.08)]"
        />
      </div>
      <div className="flex items-start justify-between gap-3 px-4 pb-4 pt-2">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-[#1a1a1a]">{artist.name}</p>
          <p className="mt-1 truncate text-sm text-[#8a8a8a]">{artist.genre} 작가</p>
        </div>
        <button
          type="button"
          onClick={onClick}
          className="shrink-0 rounded-full bg-[#fff0f3] px-3 py-1.5 text-xs font-bold text-[#ff4d6d]"
        >
          정보 보기
        </button>
      </div>
    </article>
  );
}

export default function ToonbtiPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const revealTimerRef = useRef<number | null>(null);
  const resultsRef = useRef<HTMLElement | null>(null);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<ToonbtiAnswers>(INITIAL_ANSWERS);
  const [currentStep, setCurrentStep] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [revealArtist, setRevealArtist] = useState<Artist | null>(null);
  const [resultPage, setResultPage] = useState(1);
  const questions = useMemo(() => buildQuestionsFromArtists(artists), [artists]);

  const currentQuestion = questions[currentStep] ?? DEFAULT_QUESTIONS[0];
  const currentSelected = answers[currentQuestion.key];
  const selectedCount = Object.values(answers).reduce((sum, values) => sum + values.length, 0);
  const isLastStep = currentStep === questions.length - 1;
  const floatingArtists = useMemo(() => pickFloatingArtists(artists, currentStep), [artists, currentStep]);
  useEffect(() => {
    let mounted = true;

    const fetchArtists = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.from("artists").select("*");

      if (!mounted) {
        return;
      }

      setArtists(error ? [] : data ?? []);

      setLoading(false);
    };

    void fetchArtists();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) {
        window.clearTimeout(revealTimerRef.current);
      }
    };
  }, []);

  const trackArtistEvent = (
    artistId: string,
    eventType: "toonbti_result_click" | "toonbti_character_click"
  ) => {
    void fetch("/api/artist-events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ artistId, eventType }),
      keepalive: true
    }).catch(() => undefined);
  };

  const openArtistModal = (
    artist: Artist,
    eventType: "toonbti_result_click" | "toonbti_character_click"
  ) => {
    trackArtistEvent(artist.id, eventType);
    setSelectedArtist(artist);
  };

  const allRecommendedArtists = useMemo(() => {
    return artists
      .filter((artist) => artistMatchesSelectedFilters(artist, answers, questions))
      .sort((a, b) => b.followers - a.followers)
      .map((artist) => ({ artist }));
  }, [answers, artists, questions]);
  const recommendedArtists = useMemo(
    () =>
      allRecommendedArtists.slice(
        (resultPage - 1) * RESULT_PAGE_SIZE,
        resultPage * RESULT_PAGE_SIZE
      ),
    [allRecommendedArtists, resultPage]
  );
  const canLoadMoreResults = resultPage * RESULT_PAGE_SIZE < allRecommendedArtists.length;
  const thumbnailRecommendations = recommendedArtists.filter((item) => item.artist.thumbnail_url);
  const instagramRecommendations = recommendedArtists.filter(
    (item) => !item.artist.thumbnail_url && getFallbackInstagramUrl(item.artist)
  );

  const toggleAnswer = (question: ToonbtiQuestion, value: string) => {
    setShowResults(false);
    setIsRevealing(false);
    setResultPage(1);
    setAnswers((current) => {
      const selected = current[question.key];
      const isSelected = selected.includes(value);

      if (question.key === "topic_tags" && value === "상관없어") {
        return {
          ...current,
          topic_tags: isSelected ? [] : ["상관없어"]
        };
      }

      const withoutAny = question.key === "topic_tags" ? selected.filter((item) => item !== "상관없어") : selected;

      if (isSelected) {
        return {
          ...current,
          [question.key]: selected.filter((item) => item !== value)
        };
      }

      if (withoutAny.length >= question.maxSelections) {
        return current;
      }

      return {
        ...current,
        [question.key]: [...withoutAny, value]
      };
    });
  };

  const revealResults = () => {
    const withCharacter = artists.filter((artist) => artist.character_url);

    setRevealArtist(
      withCharacter.length > 0 ? withCharacter[Math.floor(Math.random() * withCharacter.length)] : null
    );
    setIsRevealing(true);

    if (revealTimerRef.current) {
      window.clearTimeout(revealTimerRef.current);
    }

    revealTimerRef.current = window.setTimeout(() => {
      setIsRevealing(false);
      setShowResults(true);
    }, REVEAL_DELAY_MS);
  };

  const goNext = () => {
    if (currentSelected.length === 0 || loading) {
      return;
    }

    if (isLastStep) {
      revealResults();
      return;
    }

    setCurrentStep((step) => Math.min(step + 1, questions.length - 1));
  };

  const goBack = () => {
    setShowResults(false);
    setIsRevealing(false);
    setCurrentStep((step) => Math.max(step - 1, 0));
  };

  const resetTest = () => {
    setAnswers(INITIAL_ANSWERS);
    setCurrentStep(0);
    setShowResults(false);
    setIsRevealing(false);
    setSelectedArtist(null);
    setResultPage(1);
  };

  const loadMoreResults = () => {
    if (!canLoadMoreResults) {
      return;
    }

    setResultPage((page) => page + 1);
    window.setTimeout(() => {
      resultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 80);
  };

  return (
    <main className="min-h-screen bg-[#f8f7f4] text-[#1a1a1a]">
      <nav className="sticky top-0 z-40 flex h-[60px] items-center justify-between border-b border-[rgba(0,0,0,0.07)] bg-[rgba(248,247,244,0.93)] px-5 backdrop-blur-md md:px-8">
        <Link href="/" className="font-moyamoya text-[22px] text-[#ff4d6d]">
          인투<span className="text-[#1a1a1a]">니</span>
        </Link>
        <Link
          href="/"
          className="rounded-full border border-[rgba(0,0,0,0.08)] bg-white px-4 py-2 text-sm font-bold text-[#6b6b6b] transition hover:border-[#ff4d6d] hover:text-[#ff4d6d]"
        >
          홈으로
        </Link>
      </nav>

      <section className="relative mx-auto w-full max-w-5xl overflow-hidden px-5 pb-16 pt-10 md:px-8 md:pt-14">
        <style jsx global>{`
          @keyframes toonbti-character-float {
            0%,
            100% {
              transform: translate3d(0, 0, 0) rotate(-2deg);
            }
            50% {
              transform: translate3d(10px, -18px, 0) rotate(3deg);
            }
          }
        `}</style>
        <FloatingToonbtiCharacters
          artists={floatingArtists}
          onPick={(artist) => openArtistModal(artist, "toonbti_character_click")}
        />

        <div className="relative z-10 mb-8 text-center">
          <p className="mb-3 text-sm font-bold text-[#ff4d6d]">ToonBTI Test</p>
          <h1
            className="font-moyamoya text-[#1a1a1a]"
            style={{
              fontSize: "clamp(38px, 5.5vw, 64px)",
              lineHeight: 1.15
            }}
          >
            나랑 맞는
            <br />
            <span className="text-[#ff4d6d]">인스타툰</span> 작가는?
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[#6b6b6b]">
            네 취향을 톡톡 고르면, 인투니가 어울리는 작가를 또롱 찾아줄게요.
          </p>
        </div>

        {!showResults ? (
          isRevealing ? (
            <section className="relative z-10 mx-auto flex min-h-[360px] max-w-3xl items-center justify-center rounded-[34px] border border-[#ffd6df] bg-white px-6 py-16 text-center shadow-[0_24px_60px_rgba(255,77,109,0.12)]">
              <div>
                {revealArtist ? (
                  <button
                    type="button"
                    onClick={() => openArtistModal(revealArtist, "toonbti_character_click")}
                    className="relative mx-auto mb-6 block h-28 w-28 rounded-[28px] transition hover:scale-105"
                    style={{
                      animation: "toonbti-character-float 4.8s ease-in-out infinite"
                    }}
                  >
                    <Image
                      src={revealArtist.character_url}
                      alt={revealArtist.name}
                      fill
                      className="object-contain drop-shadow-[0_18px_24px_rgba(0,0,0,0.16)]"
                      sizes="112px"
                    />
                  </button>
                ) : (
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#fff0f3] text-3xl font-black text-[#ff4d6d] shadow-[0_16px_38px_rgba(255,77,109,0.18)]">
                    ?
                  </div>
                )}
                <p className="text-4xl font-black text-[#ff4d6d] md:text-5xl">또로로롱...</p>
                <p className="mt-4 text-base font-semibold text-[#6b6b6b]">결과가 나오고 있습니다</p>
                <div className="mx-auto mt-8 flex w-44 justify-center gap-2">
                  <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#ff4d6d]" />
                  <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#ff7a70] [animation-delay:140ms]" />
                  <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#ffd6df] [animation-delay:280ms]" />
                </div>
              </div>
            </section>
          ) : (
          <div className="relative z-10 mx-auto max-w-3xl">
            <div className="mb-5 rounded-full border border-[rgba(0,0,0,0.08)] bg-white p-1.5">
              <div className="grid grid-cols-4 gap-1.5">
                {questions.map((question, index) => (
                  <div
                    key={question.key}
                    className={`h-2 rounded-full transition ${
                      index <= currentStep ? "bg-[#ff4d6d]" : "bg-[#ece9e4]"
                    }`}
                  />
                ))}
              </div>
            </div>

            <section className="relative overflow-hidden rounded-[34px] border border-[rgba(0,0,0,0.08)] bg-white p-6 shadow-[0_24px_60px_rgba(0,0,0,0.06)] md:p-8">
              <div className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-[#fff0f3]" />
              <div className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-[#efebff]" />

              <div className="relative">
                <div className="mb-7 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-xs font-bold text-[#ff4d6d]">{currentQuestion.eyebrow}</p>
                    <h2 className="mt-2 text-2xl font-extrabold leading-snug text-[#1a1a1a] md:text-3xl">
                      {currentQuestion.title}
                    </h2>
                  </div>
                  <p className="text-sm font-semibold text-[#a0a0a0]">
                    {currentQuestion.helper} · 전체 {currentQuestion.options.length}개
                  </p>
                </div>

                <div className="max-h-[42vh] overflow-y-auto pr-1">
                  <div className="flex flex-wrap gap-2.5">
                  {currentQuestion.options.map((option) => {
                    const selected = currentSelected.includes(option.label);

                    return (
                      <button
                        key={`${currentQuestion.key}-${option.label}`}
                        type="button"
                        onClick={() => toggleAnswer(currentQuestion, option.label)}
                        className={`rounded-full border px-4 py-2.5 text-sm font-bold transition md:px-5 ${
                          selected
                            ? "border-[#ff4d6d] bg-[#ff4d6d] text-white shadow-[0_10px_24px_rgba(255,77,109,0.22)]"
                            : "border-[rgba(0,0,0,0.08)] bg-[#f8f7f4] text-[#6b6b6b] hover:border-[#ff4d6d] hover:text-[#ff4d6d]"
                        }`}
                      >
                        <span>{option.label}</span>
                        {option.description ? (
                          <span className={`ml-2 text-xs ${selected ? "text-white/75" : "text-[#a0a0a0]"}`}>
                            {option.description}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                  </div>
                </div>

                <div className="mt-9 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={currentStep === 0 || isRevealing}
                    className="rounded-full border border-[rgba(0,0,0,0.08)] bg-white px-5 py-3 text-sm font-bold text-[#6b6b6b] transition hover:border-[#1a1a1a] hover:text-[#1a1a1a] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    이전
                  </button>
                  <div className="hidden text-center text-xs font-semibold text-[#a0a0a0] md:block">
                    {formatChoiceSummary(answers)}
                  </div>
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={currentSelected.length === 0 || loading || isRevealing}
                    className="rounded-full bg-[#ff4d6d] px-6 py-3 text-sm font-extrabold text-white shadow-[0_16px_34px_rgba(255,77,109,0.22)] transition hover:bg-[#e83a5a] disabled:cursor-not-allowed disabled:bg-[#d8d6d2] md:px-8"
                  >
                    {isRevealing ? "또롱 찾는 중..." : isLastStep ? "결과 또롱 보기" : "다음으로"}
                  </button>
                </div>
              </div>
            </section>

          </div>
          )
        ) : (
          <section ref={resultsRef} className="relative z-10 mx-auto max-w-5xl scroll-mt-20">
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-bold text-[#ff4d6d]">Result</p>
                <h2 className="mt-1 text-3xl font-extrabold text-[#1a1a1a] md:text-4xl">이 작가들이 잘 맞아요</h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-[#8a8a8a]">{formatChoiceSummary(answers)}</p>
            </div>

            {loading ? (
              <div className="rounded-[28px] border border-[rgba(0,0,0,0.08)] bg-white px-6 py-14 text-center text-sm text-[#a0a0a0]">
                작가 데이터를 불러오는 중입니다.
              </div>
            ) : recommendedArtists.length === 0 ? (
              <div className="rounded-[28px] border border-[rgba(0,0,0,0.08)] bg-white px-6 py-14 text-center">
                <p className="text-xl font-extrabold text-[#1a1a1a]">아직 딱 맞는 작가가 없어요</p>
                <p className="mt-2 text-sm text-[#8a8a8a]">선택지를 조금 바꿔서 다시 찾아볼까요?</p>
              </div>
            ) : (
              <div className="space-y-8">
                {thumbnailRecommendations.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 md:gap-5 xl:grid-cols-4">
                    {thumbnailRecommendations.map((item) => (
                      <ResultArtistCard
                        key={item.artist.id}
                        artist={item.artist}
                        onClick={() => openArtistModal(item.artist, "toonbti_result_click")}
                      />
                    ))}
                  </div>
                ) : null}

                {instagramRecommendations.length > 0 ? (
                  <section>
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-extrabold text-[#1a1a1a]">
                        인스타 게시물로 보는 추천 작가
                      </h3>
                      <span className="text-sm text-[#a0a0a0]">{instagramRecommendations.length}명</span>
                    </div>
                    <div className="grid gap-5 md:grid-cols-2">
                      {instagramRecommendations.map((item) => (
                      <ResultInstagramCard
                        key={item.artist.id}
                        artist={item.artist}
                        onClick={() => openArtistModal(item.artist, "toonbti_result_click")}
                      />
                    ))}
                    </div>
                  </section>
                ) : null}
              </div>
            )}

            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={loadMoreResults}
                disabled={!canLoadMoreResults}
                className="mr-3 rounded-full bg-[#ff4d6d] px-6 py-3 text-sm font-bold text-white shadow-[0_16px_34px_rgba(255,77,109,0.18)] transition hover:bg-[#e83a5a] disabled:cursor-not-allowed disabled:bg-[#d8d6d2] disabled:shadow-none"
              >
                더 찾아보기!
              </button>
              <button
                type="button"
                onClick={resetTest}
                className="rounded-full border border-[rgba(0,0,0,0.08)] bg-white px-6 py-3 text-sm font-bold text-[#6b6b6b] transition hover:border-[#ff4d6d] hover:text-[#ff4d6d]"
              >
                다시 테스트하기
              </button>
            </div>
          </section>
        )}

        <MobileFloatingToonbtiCharacters
          artists={floatingArtists}
          onPick={(artist) => openArtistModal(artist, "toonbti_character_click")}
        />
      </section>

      <ArtistModal artist={selectedArtist} onClose={() => setSelectedArtist(null)} />
    </main>
  );
}
