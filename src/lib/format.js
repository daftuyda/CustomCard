export function formatNumber(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-US');
}

export function formatCompact(n) {
  if (n == null) return '—';
  const num = Number(n);
  if (Math.abs(num) >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
  if (Math.abs(num) >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (Math.abs(num) >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return String(num);
}

export function formatRank(n) {
  if (n == null) return '—';
  return '#' + Number(n).toLocaleString('en-US');
}

export function limitBreakStars(lb) {
  if (lb == null) return '';
  const filled = Math.max(0, Math.min(4, lb));
  return '★'.repeat(filled) + '☆'.repeat(4 - filled);
}

// Threshold-based color helpers — flat tones, no gradients.
// Lower rank number = better. Tier names go D → SS.
export function rankColor(rank) {
  if (rank == null) return '#6c7280';
  if (rank <= 10) return '#ffd66b';      // gold
  if (rank <= 100) return '#ffae42';     // orange
  if (rank <= 1000) return '#c0c8d6';    // silver
  if (rank <= 10000) return '#8a8f9c';   // light gray
  return '#5b606e';                       // dim
}

export function affinityColor(score) {
  if (score == null) return '#6c7280';
  if (score >= 150) return '#ffd66b';    // gold
  if (score >= 100) return '#7ee887';    // green
  if (score >= 50) return '#ffae42';     // orange
  return '#ff6b7a';                       // red
}

const TIER_COLORS = {
  SS: '#ffd66b',
  'S+': '#ff9e3b',
  S: '#ff9e3b',
  'A+': '#c97cff',
  A: '#c97cff',
  'B+': '#5cd1ff',
  B: '#5cd1ff',
  'C+': '#7ee887',
  C: '#7ee887',
  'D+': '#8a8f9c',
  D: '#8a8f9c',
};
export function tierColor(tier) {
  return TIER_COLORS[tier] || '#6c7280';
}

