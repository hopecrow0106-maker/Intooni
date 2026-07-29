export type ToonbtiAnalyticsArtistStatus = "active" | "hidden" | "archived";

export type ToonbtiAnalyticsArtist = {
  id: string;
  status?: ToonbtiAnalyticsArtistStatus;
};

export type ToonbtiAnalyticsAssignment = {
  artist_id: string;
  result_type_id: string;
};

export type ToonbtiAnalyticsResultType = {
  id: string;
  code: string;
  name: string;
  position: number;
  is_active?: boolean;
};

export type ToonbtiAnalyticsAxis = {
  id: string;
  name: string;
  position: number;
  is_active?: boolean;
};

export type ToonbtiAnalyticsTrait = {
  axis_id: string;
  code: string;
  name: string;
  position: number;
  is_active?: boolean;
};

export type ToonbtiTypeDistribution = {
  result_type_id: string;
  code: string;
  name: string;
  count: number;
  share: number;
  active_count: number;
  hidden_count: number;
  archived_count: number;
};

export type ToonbtiAxisDistribution = {
  axis_id: string;
  axis_name: string;
  position: number;
  total: number;
  left: {
    code: string;
    name: string;
    count: number;
    share: number;
  };
  right: {
    code: string;
    name: string;
    count: number;
    share: number;
  };
};

export type AdminToonbtiAnalytics = {
  summary: {
    total_artists: number;
    assigned_artists: number;
    unassigned_artists: number;
    assignment_rate: number;
    configured_types: number;
    most_common_code: string | null;
    most_common_name: string | null;
    most_common_count: number;
  };
  assigned_artist_ids: string[];
  types: ToonbtiTypeDistribution[];
  axes: ToonbtiAxisDistribution[];
};

function percentage(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

export function buildAdminToonbtiAnalytics(
  artists: ToonbtiAnalyticsArtist[],
  assignments: ToonbtiAnalyticsAssignment[],
  resultTypes: ToonbtiAnalyticsResultType[],
  axes: ToonbtiAnalyticsAxis[],
  traits: ToonbtiAnalyticsTrait[]
): AdminToonbtiAnalytics {
  const artistById = new Map(artists.map((artist) => [artist.id, artist]));
  const resultTypeById = new Map(resultTypes.map((resultType) => [resultType.id, resultType]));
  const assignmentByArtist = new Map<string, ToonbtiAnalyticsAssignment>();

  for (const assignment of assignments) {
    if (!artistById.has(assignment.artist_id) || !resultTypeById.has(assignment.result_type_id)) {
      continue;
    }
    assignmentByArtist.set(assignment.artist_id, assignment);
  }

  const assignedArtists = assignmentByArtist.size;
  const typeCounters = new Map<
    string,
    { count: number; active: number; hidden: number; archived: number }
  >();

  for (const [artistId, assignment] of assignmentByArtist) {
    const artist = artistById.get(artistId);
    const current = typeCounters.get(assignment.result_type_id) ?? {
      count: 0,
      active: 0,
      hidden: 0,
      archived: 0
    };
    current.count += 1;
    const status = artist?.status ?? "active";
    current[status] += 1;
    typeCounters.set(assignment.result_type_id, current);
  }

  const typeDistribution = resultTypes
    .map((resultType) => {
      const counter = typeCounters.get(resultType.id) ?? {
        count: 0,
        active: 0,
        hidden: 0,
        archived: 0
      };
      return {
        result_type_id: resultType.id,
        code: resultType.code,
        name: resultType.name,
        count: counter.count,
        share: percentage(counter.count, assignedArtists),
        active_count: counter.active,
        hidden_count: counter.hidden,
        archived_count: counter.archived,
        position: resultType.position
      };
    })
    .sort((a, b) => b.count - a.count || a.position - b.position)
    .map(({ position: _position, ...item }) => item);

  const sortedAxes = axes
    .filter((axis) => axis.is_active !== false)
    .sort((a, b) => a.position - b.position);

  const axisDistribution = sortedAxes.map((axis, axisIndex) => {
    const axisTraits = traits
      .filter((trait) => trait.axis_id === axis.id && trait.is_active !== false)
      .sort((a, b) => a.position - b.position)
      .slice(0, 2);
    const leftTrait = axisTraits[0] ?? { code: "-", name: "미설정" };
    const rightTrait = axisTraits[1] ?? { code: "-", name: "미설정" };
    let leftCount = 0;
    let rightCount = 0;

    for (const assignment of assignmentByArtist.values()) {
      const resultType = resultTypeById.get(assignment.result_type_id);
      const code = resultType?.code.trim().toUpperCase().charAt(axisIndex) ?? "";
      if (code === leftTrait.code.trim().toUpperCase()) leftCount += 1;
      if (code === rightTrait.code.trim().toUpperCase()) rightCount += 1;
    }

    const total = leftCount + rightCount;
    return {
      axis_id: axis.id,
      axis_name: axis.name,
      position: axis.position,
      total,
      left: {
        code: leftTrait.code,
        name: leftTrait.name,
        count: leftCount,
        share: percentage(leftCount, total)
      },
      right: {
        code: rightTrait.code,
        name: rightTrait.name,
        count: rightCount,
        share: percentage(rightCount, total)
      }
    };
  });

  const mostCommon = typeDistribution.find((item) => item.count > 0) ?? null;

  return {
    summary: {
      total_artists: artists.length,
      assigned_artists: assignedArtists,
      unassigned_artists: Math.max(artists.length - assignedArtists, 0),
      assignment_rate: percentage(assignedArtists, artists.length),
      configured_types: resultTypes.length,
      most_common_code: mostCommon?.code ?? null,
      most_common_name: mostCommon?.name ?? null,
      most_common_count: mostCommon?.count ?? 0
    },
    assigned_artist_ids: [...assignmentByArtist.keys()],
    types: typeDistribution,
    axes: axisDistribution
  };
}
