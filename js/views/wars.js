import { api } from '../api.js';
import { FAMILY_CLANS } from '../config.js';
import { fmt, escapeHtml, formatWarDate, tagToUrl } from '../util.js';
import { icons } from '../icons.js';

export async function renderWars(root) {
  const clansData = await Promise.all(
    FAMILY_CLANS.map(async c => {
      const [basic, current, log] = await Promise.all([
        api.clanBasic(c.tag),
        api.warCurrent(c.tag),
        api.warPrevious(c.tag, 10).catch(() => ({ items: [] })),
      ]);
      return { ...c, basic, current, wars: log.items || [] };
    })
  );

  const activeWars = clansData.filter(c => c.current && c.current.state && c.current.state !== 'notInWar');
  const allRecent = clansData.flatMap(c =>
    (c.wars || []).map(w => ({ ...w, _clanLabel: c.label, _clanTag: c.tag }))
  ).sort((a, b) => (b.endTime || '').localeCompare(a.endTime || '')).slice(0, 15);

  let totalWins = 0, totalLosses = 0, totalTies = 0;
  for (const c of clansData) {
    for (const w of c.wars) {
      const r = recentResult(w, c.tag);
      if (r === 'win') totalWins++;
      else if (r === 'lose') totalLosses++;
      else totalTies++;
    }
  }
  const totalRecent = totalWins + totalLosses + totalTies;
  const recentWinRate = totalRecent ? Math.round((totalWins / totalRecent) * 100) : 0;

  root.innerHTML = `
    <div class="stat-row">
      <div class="stat-card featured">
        <div class="stat-label">${icons.activity()} Familjens win rate</div>
        <div class="stat-value"><span class="accent">${recentWinRate}%</span></div>
        <div class="stat-sub">senaste ${totalRecent} wars</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${icons.trendUp()} Wins</div>
        <div class="stat-value positive">${totalWins}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${icons.trendDown()} Losses</div>
        <div class="stat-value negative">${totalLosses}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${icons.swords()} Active wars</div>
        <div class="stat-value">${activeWars.length}</div>
        <div class="stat-sub">just nu</div>
      </div>
    </div>

    <section class="section">
      <div class="section-title">${icons.zap()} Active wars</div>
      ${activeWars.length === 0 ? `
        <div class="loading">Ingen klan är i krig just nu</div>
      ` : `
        <div class="active-war-grid">
          ${activeWars.map(c => renderActiveWar(c)).join('')}
        </div>
      `}
    </section>

    <section class="section">
      <div class="section-title">${icons.calendar()} Recent results (cross-family)</div>
      <div class="war-list">
        ${allRecent.map(w => renderWarRow(w)).join('')}
      </div>
    </section>
  `;
}

function recentResult(w, clanTag) {
  const us = w.clan?.tag === clanTag ? w.clan : w.opponent;
  const them = w.clan?.tag === clanTag ? w.opponent : w.clan;
  if (!us || !them) return 'tie';
  if ((us.stars || 0) > (them.stars || 0)) return 'win';
  if ((us.stars || 0) < (them.stars || 0)) return 'lose';
  if ((us.destructionPercentage || 0) > (them.destructionPercentage || 0)) return 'win';
  if ((us.destructionPercentage || 0) < (them.destructionPercentage || 0)) return 'lose';
  return 'tie';
}

function renderActiveWar(c) {
  const w = c.current;
  const phase = phaseLabel(w.state);
  const usStars = w.clan?.stars ?? 0;
  const themStars = w.opponent?.stars ?? 0;
  const usDest = (w.clan?.destructionPercentage ?? 0).toFixed(1);
  const themDest = (w.opponent?.destructionPercentage ?? 0).toFixed(1);
  const usBadge = w.clan?.badgeUrls?.medium || w.clan?.badgeUrls?.small;
  const themBadge = w.opponent?.badgeUrls?.medium || w.opponent?.badgeUrls?.small;
  return `
    <div class="active-war-card">
      <div class="active-war-header">
        <div class="active-war-title">
          <a href="#/clan/${tagToUrl(c.tag)}">${escapeHtml(c.label)}</a>
        </div>
        <span class="pill">${phase}</span>
      </div>
      <div class="active-war-score">
        <div class="active-war-side">
          ${usBadge ? `<img src="${usBadge}" alt="" class="active-war-badge">` : ''}
          <div class="name">${escapeHtml(w.clan?.name || '—')}</div>
          <div class="stars"><span class="trophy">${usStars} ★</span></div>
          <div class="destruction">${usDest}%</div>
        </div>
        <div class="active-war-vs">VS</div>
        <div class="active-war-side">
          ${themBadge ? `<img src="${themBadge}" alt="" class="active-war-badge">` : ''}
          <div class="name">${escapeHtml(w.opponent?.name || '—')}</div>
          <div class="stars">${themStars} ★</div>
          <div class="destruction">${themDest}%</div>
        </div>
      </div>
    </div>
  `;
}

function phaseLabel(state) {
  switch (state) {
    case 'preparation': return 'Prep';
    case 'inWar': return 'Battle day';
    case 'warEnded': return 'Ended';
    default: return state || '—';
  }
}

function renderWarRow(w) {
  const r = recentResult(w, w._clanTag);
  const resultMap = { win: 'WIN', lose: 'LOSS', tie: 'TIE' };
  const us = w.clan?.tag === w._clanTag ? w.clan : w.opponent;
  const them = w.clan?.tag === w._clanTag ? w.opponent : w.clan;
  const themBadge = them?.badgeUrls?.small;
  return `
    <div class="war-row" style="grid-template-columns: 70px 110px 1fr auto auto">
      <span class="war-result ${r === 'lose' ? 'lose' : r}">${resultMap[r]}</span>
      <a href="#/clan/${tagToUrl(w._clanTag)}" style="font-size:12px;color:var(--text-muted)">${escapeHtml(w._clanLabel)}</a>
      <span class="war-opp">
        ${themBadge ? `<img src="${themBadge}" alt="" class="war-opp-badge">` : ''}
        vs ${them?.tag ? `<a href="#/clan/${tagToUrl(them.tag)}" class="player-link">${escapeHtml(them.name)}</a>` : escapeHtml(them?.name || '—')}
      </span>
      <span class="war-score">${us?.stars || 0}–${them?.stars || 0} ★</span>
      <span class="war-date">${formatWarDate(w.endTime)}</span>
    </div>
  `;
}
