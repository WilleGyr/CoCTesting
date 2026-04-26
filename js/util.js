export function fmt(n) {
  if (n == null) return '—';
  return n.toLocaleString('en-US');
}

export function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function tagToUrl(tag) {
  return (tag.startsWith('#') ? tag.slice(1) : tag).toUpperCase();
}

export function urlToTag(url) {
  return '#' + url.toUpperCase();
}

export function formatWarDate(coc) {
  if (!coc) return '—';
  const m = coc.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
  if (!m) return coc;
  const [, y, mo, d] = m;
  return `${y}-${mo}-${d}`;
}

// Returns a human-friendly relative time
export function timeAgo(unixSec) {
  if (!unixSec) return '—';
  const diff = Date.now() / 1000 - unixSec;
  if (diff < 60) return 'precis nu';
  if (diff < 3600) return `${Math.floor(diff / 60)} min sen`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h sen`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} d sen`;
  if (diff < 86400 * 365) return `${Math.floor(diff / (86400 * 30))} mån sen`;
  return `${Math.floor(diff / (86400 * 365))} år sen`;
}

// Derive league from trophies. Supercell's `league` field is unreliable
// (often "Unranked" or stuck on the previous season's league). Trophies are
// always accurate. Thresholds approximate the current CoC league bands.
const LEAGUE_THRESHOLDS = [
  [4000, 'Legend League',      'legend'],
  [3800, 'Titan League I',     'titan'],
  [3600, 'Titan League II',    'titan'],
  [3400, 'Titan League III',   'titan'],
  [3200, 'Champion League I',  'champion'],
  [3000, 'Champion League II', 'champion'],
  [2800, 'Champion League III','champion'],
  [2600, 'Master League I',    'master'],
  [2400, 'Master League II',   'master'],
  [2200, 'Master League III',  'master'],
  [2000, 'Crystal League I',   'crystal'],
  [1800, 'Crystal League II',  'crystal'],
  [1600, 'Crystal League III', 'crystal'],
  [1400, 'Gold League I',      'gold'],
  [1200, 'Gold League II',     'gold'],
  [1000, 'Gold League III',    'gold'],
  [ 800, 'Silver League I',    'silver'],
  [ 600, 'Silver League II',   'silver'],
  [ 400, 'Silver League III',  'silver'],
  [ 200, 'Bronze League I',    'bronze'],
  [ 100, 'Bronze League II',   'bronze'],
  [   0, 'Bronze League III',  'bronze'],
];

export function derivedLeague(trophies) {
  const t = trophies || 0;
  for (const [threshold, name, tier] of LEAGUE_THRESHOLDS) {
    if (t >= threshold) return { name, tier, short: shortenLeague(name) };
  }
  return { name: 'Unranked', tier: 'unranked', short: '—' };
}

// Best-effort exact league for a player.
// `inLegendThisSeason` should be true if Supercell's legendStatistics.currentSeason
// is set for this player (= confirmed Legend League this season).
// Otherwise falls back to deriving from trophies.
export function exactLeague(trophies, inLegendThisSeason) {
  if (inLegendThisSeason) {
    return { name: 'Legend League', tier: 'legend', short: 'Legend' };
  }
  const dl = derivedLeague(trophies);
  // If derivation says Legend but the player isn't actually in Legend this season,
  // demote to Titan I (the rank just below Legend).
  if (dl.tier === 'legend') {
    return { name: 'Titan League I', tier: 'titan', short: 'Titan I' };
  }
  return dl;
}

function shortenLeague(name) {
  return name.replace(' League', '');
}

// CoC seasons end the last Monday of the month at 05:00 UTC.
// Returns YYYY-MM-DD start of current season.
export function currentSeasonStart() {
  const now = new Date();
  const lastMonday = (year, month) => {
    const d = new Date(Date.UTC(year, month + 1, 0));
    while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() - 1);
    return d;
  };
  let start = lastMonday(now.getUTCFullYear(), now.getUTCMonth() - 1);
  let end = lastMonday(now.getUTCFullYear(), now.getUTCMonth());
  if (now < start) {
    start = lastMonday(now.getUTCFullYear(), now.getUTCMonth() - 2);
    end = lastMonday(now.getUTCFullYear(), now.getUTCMonth() - 1);
  } else if (now >= end) {
    start = end;
  }
  return start.toISOString().slice(0, 10);
}
