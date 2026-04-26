import { api } from '../api.js';
import { FAMILY_CLANS } from '../config.js';
import { fmt, escapeHtml, formatWarDate, urlToTag, tagToUrl, derivedLeague } from '../util.js';
import { applyChartDefaults, COLORS } from '../charts.js';
import { icons } from '../icons.js';

export async function renderClan(root, urlTag) {
  const tag = urlToTag(urlTag);
  const familyClan = FAMILY_CLANS.find(c => c.tag.replace('#', '').toUpperCase() === urlTag.toUpperCase());
  const [clan, warlog] = await Promise.all([
    api.clanBasic(tag),
    api.warPrevious(tag, 30).catch(() => ({ items: [] })),
  ]);

  applyChartDefaults();

  const members = [...clan.memberList].sort((a, b) => b.trophies - a.trophies);
  const wars = (warlog.items || []).filter(w => w.clan && w.opponent);
  const badge = clan.badgeUrls?.medium || clan.badgeUrls?.small;

  const wins = wars.filter(w => warResult(w, clan.tag) === 'win').length;
  const losses = wars.filter(w => warResult(w, clan.tag) === 'lose').length;
  const ties = wars.filter(w => warResult(w, clan.tag) === 'tie').length;
  const winRate = wars.length ? Math.round((wins / wars.length) * 100) : 0;

  root.innerHTML = `
    <a href="#/" class="back-link">${icons.arrow({size:14})} Familjen</a>

    <div class="clan-header">
      <div class="clan-header-left">
        ${badge ? `<img src="${badge}" alt="" class="clan-logo">` : ''}
        <div>
          <div class="clan-header-name">${escapeHtml(clan.name)}</div>
          <div class="clan-header-meta">
            <span class="tag">${escapeHtml(clan.tag)}</span>
            <span class="meta-sep"></span>
            <span class="meta-item">Level ${clan.level}</span>
            <span class="meta-sep"></span>
            <span class="meta-item">${icons.mapPin({size:13})} ${escapeHtml(clan.location?.name || '—')}</span>
            <span class="meta-sep"></span>
            <span class="meta-item">${icons.award({size:13})} ${escapeHtml(clan.warLeague || 'Unranked')}</span>
          </div>
        </div>
      </div>
      <div class="clan-header-stats">
        <div>
          <div class="clan-header-stat-value">${icons.trophy({size:18})}<span class="trophy">${fmt(clan.clanPoints)}</span></div>
          <div class="clan-header-stat-label">Trophies</div>
        </div>
        <div>
          <div class="clan-header-stat-value">${icons.users({size:18})}${clan.members}/50</div>
          <div class="clan-header-stat-label">Members</div>
        </div>
        <div>
          <div class="clan-header-stat-value">${icons.swords({size:18})}${fmt(clan.warWins || 0)}</div>
          <div class="clan-header-stat-label">War wins</div>
        </div>
        <div>
          <div class="clan-header-stat-value">${icons.flame({size:18})}${clan.warWinStreak || 0}</div>
          <div class="clan-header-stat-label">Streak</div>
        </div>
      </div>
    </div>

    <section class="section">
      <div class="section-title">${icons.users()} Members (${members.length})</div>
      <table class="table">
        <thead>
          <tr>
            <th class="rank">#</th>
            <th>Namn</th>
            <th class="num">TH</th>
            <th>League</th>
            <th>Role</th>
            <th class="num">Trophies</th>
            <th class="num">Donations</th>
          </tr>
        </thead>
        <tbody>
          ${members.map((m, i) => `
            <tr>
              <td class="rank">${i + 1}</td>
              <td>
                <a href="#/player/${tagToUrl(m.tag)}" class="player-link">${escapeHtml(m.name)}</a>
                <span class="tag">${escapeHtml(m.tag)}</span>
              </td>
              <td class="num"><span class="pill th">${m.townhall}</span></td>
              <td>${renderLeaguePill(m)}</td>
              <td>${escapeHtml(formatRole(m.role))}</td>
              <td class="num"><span class="trophy">${fmt(m.trophies)}</span></td>
              <td class="num">${fmt(m.donations)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>

    <section class="section">
      <div class="section-title">${icons.swords()} War history (senaste ${wars.length})</div>
      ${wars.length === 0 ? '<div class="loading">Inga wars loggade eller war log är privat</div>' : `
        <div class="stat-row" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 16px">
          <div class="stat-card"><div class="stat-label">${icons.trendUp()} Wins</div><div class="stat-value positive">${wins}</div></div>
          <div class="stat-card"><div class="stat-label">${icons.trendDown()} Losses</div><div class="stat-value negative">${losses}</div></div>
          <div class="stat-card"><div class="stat-label">Ties</div><div class="stat-value">${ties}</div></div>
          <div class="stat-card"><div class="stat-label">${icons.activity()} Win rate</div><div class="stat-value"><span class="accent">${winRate}%</span></div></div>
        </div>
        <div class="war-list">
          ${wars.map(w => renderWarRow(w, clan.tag)).join('')}
        </div>
      `}
    </section>
  `;
}

function warResult(w, clanTag) {
  const us = w.clan.tag === clanTag ? w.clan : w.opponent;
  const them = w.clan.tag === clanTag ? w.opponent : w.clan;
  if ((us.stars || 0) > (them.stars || 0)) return 'win';
  if ((us.stars || 0) < (them.stars || 0)) return 'lose';
  if ((us.destructionPercentage || 0) > (them.destructionPercentage || 0)) return 'win';
  if ((us.destructionPercentage || 0) < (them.destructionPercentage || 0)) return 'lose';
  return 'tie';
}

function formatRole(role) {
  const map = { leader: 'Leader', coLeader: 'Co-Leader', admin: 'Elder', member: 'Member' };
  return map[role] || role;
}

function renderLeaguePill(m) {
  const tier = m.leagueTier;
  if (!tier) return `<span class="pill pill-dim">—</span>`;
  const isLegend = tier.name === 'Legend League';
  const short = tier.name.replace(' League', '');
  return `<span class="pill ${isLegend ? 'league-legend' : ''}">${tier.icon ? `<img src="${tier.icon}" alt="" class="pill-icon">` : ''}${escapeHtml(short)}</span>`;
}

function renderWarRow(w, clanTag) {
  const us = w.clan.tag === clanTag ? w.clan : w.opponent;
  const them = w.clan.tag === clanTag ? w.opponent : w.clan;
  const usStars = us.stars || 0;
  const themStars = them.stars || 0;
  const usDest = us.destructionPercentage || 0;
  const themDest = them.destructionPercentage || 0;

  const r = warResult(w, clanTag);
  const resultMap = { win: 'WIN', lose: 'LOSS', tie: 'TIE' };
  const themBadge = them.badgeUrls?.small;

  return `
    <div class="war-row">
      <span class="war-result ${r === 'lose' ? 'lose' : r}">${resultMap[r]}</span>
      <span class="war-opp">
        ${themBadge ? `<img src="${themBadge}" alt="" class="war-opp-badge">` : ''}
        vs ${them.tag ? `<a href="#/clan/${tagToUrl(them.tag)}" class="player-link">${escapeHtml(them.name)}</a>` : escapeHtml(them.name)}
      </span>
      <span class="war-score">${usStars}–${themStars} ★ · ${usDest.toFixed(1)}%–${themDest.toFixed(1)}%</span>
      <span class="war-date">${formatWarDate(w.endTime)}</span>
    </div>
  `;
}

