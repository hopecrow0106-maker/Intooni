export const HALF_HOUR_INTERVAL_MS = 30 * 60 * 1000;

type OrderableArtist = {
  id: string;
};

function hashOrderKey(value: string) {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

export function getHalfHourBucket(timestamp = Date.now()) {
  return Math.floor(timestamp / HALF_HOUR_INTERVAL_MS);
}

export function orderArtistsForHalfHour<T extends OrderableArtist>(
  artists: T[],
  timestamp = Date.now()
) {
  const bucket = getHalfHourBucket(timestamp);

  return [...artists].sort((left, right) => {
    const leftOrder = hashOrderKey(`${bucket}:${left.id}`);
    const rightOrder = hashOrderKey(`${bucket}:${right.id}`);

    return leftOrder - rightOrder || left.id.localeCompare(right.id);
  });
}

export function createHalfHourlyOrderMap<T extends OrderableArtist>(
  artists: T[],
  timestamp = Date.now()
) {
  return orderArtistsForHalfHour(artists, timestamp).reduce<Record<string, number>>(
    (orderMap, artist, index) => {
      orderMap[artist.id] = index;
      return orderMap;
    },
    {}
  );
}

export function millisecondsUntilNextHalfHour(timestamp = Date.now()) {
  const nextBoundary = (getHalfHourBucket(timestamp) + 1) * HALF_HOUR_INTERVAL_MS;
  return Math.max(1, nextBoundary - timestamp);
}
