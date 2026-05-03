import {
  getUserProfile,
  getCircleClubRankByCircleId,
  getRankThresholds,
  searchByTrainerId,
  ApiError,
} from './umamoe.js';

export class ProfileNotFoundError extends Error {
  constructor(trainerId) {
    super(`No profile found for trainer ID ${trainerId}`);
    this.trainerId = trainerId;
  }
}

function tierName(thresholds, rankIndex) {
  if (rankIndex == null || !thresholds) return null;
  const t = thresholds.thresholds.find((x) => x.rank_index === rankIndex);
  return t ? t.name : null;
}

export async function loadProfile(trainerId) {
  const id = String(trainerId).trim();
  if (!/^\d{9,12}$/.test(id)) {
    throw new Error('Trainer ID must be 9-12 digits.');
  }

  let raw;
  try {
    raw = await getUserProfile(id);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
      throw new ProfileNotFoundError(id);
    }
    throw err;
  }
  if (!raw || !raw.trainer) {
    throw new ProfileNotFoundError(id);
  }

  const [thresholds, clubRankIndex, searchRow] = await Promise.all([
    getRankThresholds().catch(() => null),
    // Look up club tier by the trainer's *current* circle_id (from /user/profile)
    // — the viewer_id-keyed endpoint returns a stale circle for trainers who
    // recently switched.
    getCircleClubRankByCircleId(raw.circle?.circle_id),
    // /user/profile omits affinity_score; pull it from the search endpoint.
    searchByTrainerId(id).catch(() => null),
  ]);
  // Merge affinity_score from search if profile inheritance lacks it.
  if (
    raw.inheritance &&
    raw.inheritance.affinity_score == null &&
    searchRow?.inheritance?.affinity_score != null
  ) {
    raw.inheritance.affinity_score = searchRow.inheritance.affinity_score;
  }

  const trainer = raw.trainer;
  const rawCircle = raw.circle;

  const circle = rawCircle
    ? {
        id: rawCircle.circle_id,
        name: rawCircle.name,
        memberCount: rawCircle.member_count,
        monthlyRank: rawCircle.monthly_rank,
        monthlyPoints: rawCircle.monthly_point,
        liveRank: rawCircle.live_rank,
        livePoints: rawCircle.live_points,
        clubRankIndex,
        clubRankName: tierName(thresholds, clubRankIndex),
      }
    : null;

  return {
    trainerId: id,
    trainerName: trainer.name || 'Unknown Trainer',
    followerCount: trainer.follower_num ?? null,
    comment: trainer.comment ?? null,
    teamClass: trainer.team_class ?? null,
    bestTeamClass: trainer.best_team_class ?? null,
    teamStadiumPoints: trainer.team_stadium_user?.best_point ?? null,
    rankScore: trainer.rank_score ?? null,
    inheritance: raw.inheritance ?? null,
    supportCard: raw.support_card ?? null,
    circle,
    circleHistory: raw.circle_history ?? [],
    rankings: {
      monthly: raw.fan_history?.monthly?.[0] ?? null,
      alltime: raw.fan_history?.alltime ?? null,
      gains: raw.fan_history?.rolling ?? null,
    },
    teamStadium: raw.team_stadium ?? [],
    veterans: raw.veterans ?? [],
  };
}
