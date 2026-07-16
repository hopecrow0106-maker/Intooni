export type GrowthAnalyticsArtist = {
  id: string;
  name: string;
  instagram_handle: string;
  status?: "active" | "hidden" | "archived";
};

export type GrowthAnalyticsStat = {
  artist_id: string;
  recorded_date: string;
  followers: number;
  post_count: number;
};

export type GrowthRankItem = {
  artist_id: string;
  name: string;
  instagram_handle: string;
  latest_recorded_date: string;
  previous_recorded_date: string | null;
  interval_days: number | null;
  followers: number;
  followers_delta: number | null;
  followers_growth_rate: number | null;
  post_count: number;
  posts_delta: number | null;
  posts_growth_rate: number | null;
};

export type AdminGrowthAnalytics = {
  summary: {
    tracked_artists: number;
    snapshot_count: number;
    first_recorded_date: string | null;
    latest_recorded_date: string | null;
    latest_total_followers: number;
    latest_total_posts: number;
    followers_delta: number;
    posts_delta: number;
    comparable_artists: number;
    latest_date_coverage: number;
  };
  timeline: Array<{
    recorded_date: string;
    tracked_artists: number;
    total_followers: number;
    total_posts: number;
    followers_delta: number | null;
    posts_delta: number | null;
  }>;
  top_followers: GrowthRankItem[];
  top_posts: GrowthRankItem[];
  follower_declines: GrowthRankItem[];
  growth_distribution: Array<{ label: string; count: number }>;
  freshness: Array<{ label: string; count: number }>;
};

function dayDifference(left: string, right: string) {
  const leftTime = new Date(`${left}T00:00:00Z`).getTime();
  const rightTime = new Date(`${right}T00:00:00Z`).getTime();
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return null;
  return Math.round((leftTime - rightTime) / 86_400_000);
}

function rate(delta: number, previous: number) {
  return previous > 0 ? delta / previous : null;
}

export function buildAdminGrowthAnalytics(
  artists: GrowthAnalyticsArtist[],
  stats: GrowthAnalyticsStat[],
  today = new Date()
): AdminGrowthAnalytics {
  const artistById = new Map(artists.map((artist) => [artist.id, artist]));
  const normalizedStats = stats
    .filter(
      (stat) =>
        artistById.has(stat.artist_id) &&
        /^\d{4}-\d{2}-\d{2}$/.test(stat.recorded_date) &&
        Number.isFinite(stat.followers) &&
        Number.isFinite(stat.post_count)
    )
    .sort(
      (left, right) =>
        left.recorded_date.localeCompare(right.recorded_date) ||
        left.artist_id.localeCompare(right.artist_id)
    );

  const statsByArtist = new Map<string, GrowthAnalyticsStat[]>();
  for (const stat of normalizedStats) {
    const rows = statsByArtist.get(stat.artist_id) ?? [];
    rows.push(stat);
    statsByArtist.set(stat.artist_id, rows);
  }

  const rankings: GrowthRankItem[] = [];
  for (const [artistId, rows] of statsByArtist) {
    const latest = rows.at(-1)!;
    const previous = rows.at(-2) ?? null;
    const followersDelta = previous ? latest.followers - previous.followers : null;
    const postsDelta = previous ? latest.post_count - previous.post_count : null;
    const artist = artistById.get(artistId)!;
    rankings.push({
      artist_id: artistId,
      name: artist.name,
      instagram_handle: artist.instagram_handle,
      latest_recorded_date: latest.recorded_date,
      previous_recorded_date: previous?.recorded_date ?? null,
      interval_days: previous ? dayDifference(latest.recorded_date, previous.recorded_date) : null,
      followers: latest.followers,
      followers_delta: followersDelta,
      followers_growth_rate:
        previous && followersDelta !== null ? rate(followersDelta, previous.followers) : null,
      post_count: latest.post_count,
      posts_delta: postsDelta,
      posts_growth_rate: previous && postsDelta !== null ? rate(postsDelta, previous.post_count) : null
    });
  }

  const dates = [...new Set(normalizedStats.map((stat) => stat.recorded_date))].sort();
  const latestByArtist = new Map<string, GrowthAnalyticsStat>();
  const timeline: AdminGrowthAnalytics["timeline"] = [];
  for (const recordedDate of dates) {
    for (const stat of normalizedStats) {
      if (stat.recorded_date === recordedDate) latestByArtist.set(stat.artist_id, stat);
    }
    const totalFollowers = [...latestByArtist.values()].reduce((sum, stat) => sum + stat.followers, 0);
    const totalPosts = [...latestByArtist.values()].reduce((sum, stat) => sum + stat.post_count, 0);
    const previous = timeline.at(-1) ?? null;
    timeline.push({
      recorded_date: recordedDate,
      tracked_artists: latestByArtist.size,
      total_followers: totalFollowers,
      total_posts: totalPosts,
      followers_delta: previous ? totalFollowers - previous.total_followers : null,
      posts_delta: previous ? totalPosts - previous.total_posts : null
    });
  }

  const comparable = rankings.filter((item) => item.followers_delta !== null);
  const rankingCandidates = comparable.filter((item) => {
    const status = artistById.get(item.artist_id)?.status;
    return status !== "hidden" && status !== "archived";
  });
  const latestDate = dates.at(-1) ?? null;
  const latestDateCoverage = latestDate
    ? normalizedStats.filter((stat) => stat.recorded_date === latestDate).length
    : 0;
  const latestRows = [...statsByArtist.values()].map((rows) => rows.at(-1)!);
  const latestDay = today.toISOString().slice(0, 10);

  return {
    summary: {
      tracked_artists: rankings.length,
      snapshot_count: normalizedStats.length,
      first_recorded_date: dates[0] ?? null,
      latest_recorded_date: latestDate,
      latest_total_followers: latestRows.reduce((sum, stat) => sum + stat.followers, 0),
      latest_total_posts: latestRows.reduce((sum, stat) => sum + stat.post_count, 0),
      followers_delta: comparable.reduce((sum, item) => sum + (item.followers_delta ?? 0), 0),
      posts_delta: comparable.reduce((sum, item) => sum + (item.posts_delta ?? 0), 0),
      comparable_artists: comparable.length,
      latest_date_coverage: latestDateCoverage
    },
    timeline,
    top_followers: [...rankingCandidates]
      .filter((item) => (item.followers_delta ?? 0) > 0)
      .sort((left, right) => (right.followers_delta ?? 0) - (left.followers_delta ?? 0))
      .slice(0, 12),
    top_posts: [...rankingCandidates]
      .filter((item) => (item.posts_delta ?? 0) > 0)
      .sort((left, right) => (right.posts_delta ?? 0) - (left.posts_delta ?? 0))
      .slice(0, 12),
    follower_declines: [...rankingCandidates]
      .filter((item) => (item.followers_delta ?? 0) < 0)
      .sort((left, right) => (left.followers_delta ?? 0) - (right.followers_delta ?? 0))
      .slice(0, 12),
    growth_distribution: [
      { label: "감소", count: comparable.filter((item) => (item.followers_growth_rate ?? 0) < 0).length },
      { label: "변화 없음", count: comparable.filter((item) => item.followers_growth_rate === 0).length },
      { label: "0~1%", count: comparable.filter((item) => (item.followers_growth_rate ?? 0) > 0 && (item.followers_growth_rate ?? 0) < 0.01).length },
      { label: "1~5%", count: comparable.filter((item) => (item.followers_growth_rate ?? 0) >= 0.01 && (item.followers_growth_rate ?? 0) < 0.05).length },
      { label: "5% 이상", count: comparable.filter((item) => (item.followers_growth_rate ?? 0) >= 0.05).length }
    ],
    freshness: [
      { label: "7일 이내", count: rankings.filter((item) => (dayDifference(latestDay, item.latest_recorded_date) ?? 0) <= 7).length },
      { label: "8~14일", count: rankings.filter((item) => { const days = dayDifference(latestDay, item.latest_recorded_date) ?? 0; return days > 7 && days <= 14; }).length },
      { label: "15~30일", count: rankings.filter((item) => { const days = dayDifference(latestDay, item.latest_recorded_date) ?? 0; return days > 14 && days <= 30; }).length },
      { label: "30일 초과", count: rankings.filter((item) => (dayDifference(latestDay, item.latest_recorded_date) ?? 0) > 30).length }
    ]
  };
}
