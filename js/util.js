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

// Legend League seasons run on a fixed 4-week (28-day) cycle, independent
// of the general trophy season (which uses last-Monday-of-month).
// Anchor: May 2026 season starts 2026-04-20 at 05:00 UTC (07:00 CEST).
const LEGEND_SEASON_ANCHOR_MS = Date.UTC(2026, 3, 20, 5, 0, 0);
const LEGEND_SEASON_LENGTH_MS = 28 * 24 * 60 * 60 * 1000;
const LEGEND_DAY_RESET_HOUR_UTC = 5; // 05:00 UTC = 07:00 CEST

export function currentLegendSeasonStart() {
  const elapsed = Date.now() - LEGEND_SEASON_ANCHOR_MS;
  const cycles = Math.floor(elapsed / LEGEND_SEASON_LENGTH_MS);
  const startMs = LEGEND_SEASON_ANCHOR_MS + cycles * LEGEND_SEASON_LENGTH_MS;
  return new Date(startMs).toISOString().slice(0, 10);
}

// Unix-ms of the start of the current Legend day (last 05:00 UTC).
export function legendDayStartMs(now = Date.now()) {
  const d = new Date(now);
  d.setUTCHours(LEGEND_DAY_RESET_HOUR_UTC, 0, 0, 0);
  if (d.getTime() > now) d.setUTCDate(d.getUTCDate() - 1);
  return d.getTime();
}

// Trophy change → star count, based on Legend trophy reward bands:
//   0★ = 1–4, 1★ = 5–15, 2★ = 16–32, 3★ = 33+
export function inferLegendStars(change) {
  const c = Math.abs(change);
  if (c >= 33) return 3;
  if (c >= 16) return 2;
  if (c >= 5) return 1;
  return 0;
}

// { attacks, defenses } from worker `legends` data, filtered to the current
// Legend day window. Each entry is { change, time, trophies } already.
export function currentLegendDayEvents(legends, now = Date.now()) {
  const startMs = legendDayStartMs(now);
  const endMs = startMs + 24 * 60 * 60 * 1000;
  const attacks = [];
  const defenses = [];
  for (const date of Object.keys(legends || {})) {
    const day = legends[date];
    for (const a of (day.new_attacks || [])) {
      const t = a.time * 1000;
      if (t >= startMs && t < endMs) attacks.push(a);
    }
    for (const d of (day.new_defenses || [])) {
      const t = d.time * 1000;
      if (t >= startMs && t < endMs) defenses.push(d);
    }
  }
  attacks.sort((a, b) => a.time - b.time);
  defenses.sort((a, b) => a.time - b.time);
  return { attacks, defenses };
}

// HH:MM in user's local time.
export function formatHM(unixSec) {
  const d = new Date(unixSec * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
