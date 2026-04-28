"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  examples?: string[];
};

const FALLBACK_EXAMPLES = ["썰", "클럽", "미대", "흑백", "매운맛", "육아"];

function pickExamples(examples: string[], startIndex: number) {
  const source = examples.length > 0 ? examples : FALLBACK_EXAMPLES;
  return Array.from({ length: Math.min(3, source.length) }, (_, index) => {
    return source[(startIndex + index) % source.length];
  });
}

export function SearchBar({ value, onChange, examples = [] }: SearchBarProps) {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const flipTimeoutRef = useRef<number | null>(null);

  const normalizedExamples = useMemo(
    () =>
      [...new Set(examples.map((item) => item.replace(/^#/, "").trim()).filter(Boolean))],
    [examples]
  );

  const rotatingExamples = useMemo(
    () => pickExamples(normalizedExamples, exampleIndex),
    [exampleIndex, normalizedExamples]
  );
  const placeholder = `예: ${rotatingExamples.join(", ")} 등등... 생각 나는 단어들로!`;

  useEffect(() => {
    setExampleIndex(0);
  }, [normalizedExamples]);

  useEffect(() => {
    const sourceLength = normalizedExamples.length || FALLBACK_EXAMPLES.length;
    if (sourceLength <= 3) {
      return;
    }

    const timer = window.setInterval(() => {
      setIsFlipping(true);
      flipTimeoutRef.current = window.setTimeout(() => {
        setExampleIndex((current) => (current + 3) % sourceLength);
        setIsFlipping(false);
        flipTimeoutRef.current = null;
      }, 260);
    }, 2000);

    return () => {
      window.clearInterval(timer);
      if (flipTimeoutRef.current !== null) {
        window.clearTimeout(flipTimeoutRef.current);
        flipTimeoutRef.current = null;
      }
    };
  }, [normalizedExamples.length]);

  return (
    <div className="relative max-w-[480px] flex-1">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#a0a0a0]">
        🔍
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label="인스타툰 검색"
        className="w-full rounded-full border border-[rgba(0,0,0,0.1)] bg-white py-2 pl-9 pr-4 text-sm text-[#1a1a1a] outline-none transition-colors duration-150 placeholder:text-transparent focus:border-[#ff4d6d]"
      />
      {!value ? (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute left-9 right-4 top-1/2 -translate-y-1/2 truncate text-sm text-[#a0a0a0] transition-all duration-300 ease-out ${
            isFlipping ? "-translate-y-[120%] opacity-0" : "opacity-100"
          }`}
        >
          {placeholder}
        </div>
      ) : null}
    </div>
  );
}
