const BASE = 'https://uma.moe';

async function getJSON(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ApiError(res.status, body || res.statusText, path);
  }
  return res.json();
}

export class ApiError extends Error {
  constructor(status, body, path) {
    super(`API ${status} on ${path}`);
    this.status = status;
    this.body = body;
    this.path = path;
  }
}

export async function searchByTrainerId(trainerId) {
  // uma.moe's /api/v3/search has no CORS for browser origins, so try our own
  // server-side proxy (/api/search) first when the deployment exposes one.
  // Falls through to a direct call when running on localhost / preview where
  // the proxy isn't deployed (the request will be CORS-blocked but we
  // gracefully return null).
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/search?id=${encodeURIComponent(trainerId)}`);
      if (res.ok) {
        const data = await res.json();
        return (data.items && data.items[0]) || null;
      }
    } catch {
      /* fall through */
    }
  }
  try {
    // max_follower_num default is 999 (friend-eligible); bump it so trainers
    // with 1000+ followers still resolve when looked up by ID.
    const data = await getJSON(
      `/api/v3/search?trainer_id=${encodeURIComponent(trainerId)}&limit=1&max_follower_num=99999`
    );
    return (data.items && data.items[0]) || null;
  } catch {
    return null;
  }
}

// Full profile (trainer + circle + circle_history + fan_history + inheritance
// + support_card + team_stadium + veterans). Same data uma.moe's own profile
// page uses. Works even for trainers who opted out of the public search index.
export async function getUserProfile(accountId) {
  return getJSON(`/api/v4/user/profile/${encodeURIComponent(accountId)}`);
}

// Lightweight call solely to recover `club_rank` (the D→SS tier index for the
// trainer's circle), which the rich /user/profile endpoint does not include.
// Query by *circle_id* (from the profile response), not viewer_id — the
// viewer_id form returns whatever circle the trainer was last cached against,
// which can lag behind their current circle membership.
export async function getCircleClubRankByCircleId(circleId) {
  if (circleId == null) return null;
  try {
    const data = await getJSON(`/api/v4/circles?circle_id=${encodeURIComponent(circleId)}`);
    return data?.club_rank ?? null;
  } catch {
    return null;
  }
}

export async function getCircleByViewerId(viewerId) {
  return getJSON(`/api/v4/circles?viewer_id=${encodeURIComponent(viewerId)}`);
}

export async function getMonthlyRanking(trainerId) {
  const data = await getJSON(
    `/api/v4/rankings/monthly?query=${encodeURIComponent(trainerId)}&limit=1`
  );
  return (data.rankings && data.rankings[0]) || null;
}

export async function getAlltimeRanking(trainerId) {
  const data = await getJSON(
    `/api/v4/rankings/alltime?query=${encodeURIComponent(trainerId)}&limit=1`
  );
  return (data.rankings && data.rankings[0]) || null;
}

export async function getGainsRanking(trainerId) {
  const data = await getJSON(
    `/api/v4/rankings/gains?query=${encodeURIComponent(trainerId)}&limit=1`
  );
  return (data.rankings && data.rankings[0]) || null;
}

let _thresholdsCache = null;
export async function getRankThresholds() {
  if (!_thresholdsCache) _thresholdsCache = getJSON('/api/v4/circles/rank-thresholds');
  try {
    return await _thresholdsCache;
  } catch (err) {
    _thresholdsCache = null;
    throw err;
  }
}
