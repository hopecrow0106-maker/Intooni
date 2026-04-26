"use client";

import clsx from "clsx";

export const FOLLOWER_RANGES = [
  { key: "under10k", label: "1만 미만" },
  { key: "10kTo50k", label: "1만~5만" },
  { key: "50kTo100k", label: "5만~10만" },
  { key: "over100k", label: "10만 이상" }
] as const;

export type FollowerRangeKey = (typeof FOLLOWER_RANGES)[number]["key"];

export type GenreFilterItem = {
  key: string;
  label: string;
  count: number;
};

type FilterBarProps = {
  genreItems: GenreFilterItem[];
  activeGenres: string[];
  activeFollowerRanges: FollowerRangeKey[];
  showFollowerFilters: boolean;
  onToggleGenre: (genre: string) => void;
  onToggleFollowerRange: (range: FollowerRangeKey) => void;
  onToggleFollowerFilters: () => void;
};

export function FilterBar({
  genreItems,
  activeGenres,
  activeFollowerRanges,
  showFollowerFilters,
  onToggleGenre,
  onToggleFollowerRange,
  onToggleFollowerFilters
}: FilterBarProps) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="flex flex-wrap justify-center gap-2">
        {genreItems.map((item) => {
          const isAll = item.key === "전체";
          const isActive = isAll ? activeGenres.length === 0 : activeGenres.includes(item.key);

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onToggleGenre(item.key)}
              className={clsx("genre-pill", isActive && "genre-pill-active")}
            >
              <span>{item.label}</span>
              <span className="genre-count">{item.count}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onToggleFollowerFilters}
          className={clsx("genre-pill", showFollowerFilters && "genre-pill-active")}
        >
          팔로워수
        </button>
        {showFollowerFilters
          ? FOLLOWER_RANGES.map((range) => (
              <button
                key={range.key}
                type="button"
                onClick={() => onToggleFollowerRange(range.key)}
                className={clsx(
                  "genre-pill",
                  activeFollowerRanges.includes(range.key) && "genre-pill-active"
                )}
              >
                {range.label}
              </button>
            ))
          : null}
      </div>
    </div>
  );
}
