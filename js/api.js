import { WORKER_URL as RAW_WORKER_URL, CLASHKING_BASE } from './config.js';

const WORKER_URL = (RAW_WORKER_URL || '').replace(/\/+$/, '');
const CACHE_TTL_MS = 60 * 1000; // 1 min — Supercell live, no need to be stale

function encodeTag(tag) {
  const clean = tag.startsWith('#') ? tag : '#' + tag;
  return encodeURIComponent(clean);
}

function cacheGet(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return data;
  } catch { return null; }
}

function cacheSet(key, data) {
  try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

async function fetchJson(url, cacheKey) {
  if (cacheKey) {
    const cached = cacheGet(cacheKey);
    if (cached) return cached;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}: ${url}`);
  const data = await res.json();
  if (cacheKey) cacheSet(cacheKey, data);
  return data;
}

function requireWorker() {
  if (!WORKER_URL) {
    throw new Error('WORKER_URL är inte satt i js/config.js. Se worker/SETUP.md för deploy-instruktioner.');
  }
}

// ---- Adapters: Supercell shape → shape used by views ----

function adaptClan(sc) {
  return {
    tag: sc.tag,
    name: sc.name,
    level: sc.clanLevel,
    members: sc.members,
    clanPoints: sc.clanPoints,
    warWins: sc.warWins,
    warWinStreak: sc.warWinStreak,
    warLeague: sc.warLeague?.name || null,
    capitalLeague: sc.capitalLeague?.name || null,
    location: sc.location || null,
    badgeUrls: sc.badgeUrls || null,
    memberList: (sc.memberList || []).map(m => ({
      name: m.name,
      tag: m.tag,
      role: m.role,
      expLevel: m.expLevel,
      trophies: m.trophies,
      townhall: m.townHallLevel,
      leagueTier: m.leagueTier ? {
        name: m.leagueTier.name,
        icon: m.leagueTier.iconUrls?.small || m.leagueTier.iconUrls?.large || null,
      } : null,
      builderTrophies: m.builderBaseTrophies,
      donations: m.donations,
      donationsReceived: m.donationsReceived,
    })),
  };
}

function adaptWarlog(sc) {
  // Supercell's warlog already exposes .clan and .opponent with stars/destruction
  // and result. Our views work with that shape if we add endTime if missing.
  return { items: (sc.items || []).map(w => ({ ...w })) };
}

function adaptPlayer(sc) {
  return {
    name: sc.name,
    tag: sc.tag,
    townhall: sc.townHallLevel,
    trophies: sc.trophies,
    warStars: sc.warStars,
    donations: sc.donations,
    donationsReceived: sc.donationsReceived,
    leagueTier: sc.leagueTier ? {
      name: sc.leagueTier.name,
      icon: sc.leagueTier.iconUrls?.small || sc.leagueTier.iconUrls?.large || null,
    } : null,
    clan_tag: sc.clan?.tag || null,
    legendStatistics: sc.legendStatistics || null,
    legends: {}, // filled by /legends/{tag}
  };
}

// ---- Public API ----

export const api = {
  async clanBasic(tag) {
    requireWorker();
    const url = `${WORKER_URL}/coc/clans/${encodeTag(tag)}`;
    const data = await fetchJson(url, `coc:clan:${tag}`);
    return adaptClan(data);
  },

  async warPrevious(tag, limit = 30) {
    requireWorker();
    const url = `${WORKER_URL}/coc/clans/${encodeTag(tag)}/warlog?limit=${limit}`;
    const data = await fetchJson(url, `coc:warlog:${tag}:${limit}`);
    return adaptWarlog(data);
  },

  async warCurrent(tag) {
    requireWorker();
    const url = `${WORKER_URL}/coc/clans/${encodeTag(tag)}/currentwar`;
    return fetchJson(url, `coc:currentwar:${tag}`).catch(() => null);
  },

  async clanRanking(locationId) {
    requireWorker();
    const url = `${WORKER_URL}/coc/locations/${locationId}/rankings/clans`;
    return fetchJson(url, `coc:rank:clans:${locationId}`);
  },

  async playerRanking(locationId) {
    requireWorker();
    const url = `${WORKER_URL}/coc/locations/${locationId}/rankings/players`;
    return fetchJson(url, `coc:rank:players:${locationId}`);
  },

  async playerStats(tag) {
    requireWorker();
    const url = `${WORKER_URL}/coc/players/${encodeTag(tag)}`;
    const data = await fetchJson(url, `coc:player:${tag}`);
    return adaptPlayer(data);
  },

  // Fetch many players in parallel; failed lookups become null in the array.
  async playerStatsBatch(tags) {
    return Promise.all(tags.map(t => this.playerStats(t).catch(() => null)));
  },

  async playerLegends(tag) {
    requireWorker();
    const url = `${WORKER_URL}/legends/${encodeTag(tag)}`;
    return fetchJson(url, `legends:${tag}`);
  },

  // Player war hits — kept on ClashKing (Supercell doesn't expose attack-level history).
  async playerWarhits(tag, limit = 20) {
    const url = `${CLASHKING_BASE}/player/${encodeTag(tag)}/warhits?limit=${limit}`;
    return fetchJson(url, `ck:warhits:${tag}:${limit}`);
  },

};
