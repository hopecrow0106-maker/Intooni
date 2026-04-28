"use client";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
};

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative max-w-[480px] flex-1">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#a0a0a0]">
        🔍
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="예: 썰, 클럽, 미대, 흑백, 매운맛 등등... 생각 나는 단어들로!"
        className="w-full rounded-full border border-[rgba(0,0,0,0.1)] bg-white py-2 pl-9 pr-4 text-sm text-[#1a1a1a] outline-none transition-colors duration-150 placeholder:text-[#a0a0a0] focus:border-[#ff4d6d]"
      />
    </div>
  );
}
