import { api } from '../api.js';
import { FAMILY_CLANS, SWEDEN_LOCATION_ID, LEGEND_TROPHY_THRESHOLD } from '../config.js';
import { fmt, escapeHtml, tagToUrl } from '../util.js';
import { icons } from '../icons.js';

export async function renderFamily(root) {
  const [clans, swedenRank, globalRank] = await Promise.all([
    Promise.all(FAMILY_CLANS.map(c => api.clanBasic(c.tag).then(data => ({ ...c, data })))),
    api.clanRanking(SWEDEN_LOCATION_ID).catch(() => ({ items: [] })),
    api.clanRanking('global').catch(() => ({ items: [] })),
  ]);

  const swRanks = Object.fromEntries((swedenRank.items || []).map(c => [c.tag, c.rank]));
  const glRanks = Object.fromEntries((globalRank.items || []).map(c => [c.tag, c.rank]));

  const totalMembers = clans.reduce((s, c) => s + c.data.members, 0);
  const totalWarWins = clans.reduce((s, c) => s + (c.data.warWins || 0), 0);

  const allMembers = clans.flatMap(c =>
    c.data.memberList.map(m => ({ ...m, clanLabel: c.label, clanTag: c.tag }))
  );

  const legendCount = allMembers.filter(m => m.leagueTier?.name === 'Legend League').length;

  const topTrophy = allMembers.reduce((a, b) => (b.trophies > a.trophies ? b : a));

  const topTrophies = [...allMembers].sort((a, b) => b.trophies - a.trophies).slice(0, 10);
  const topDonors = [...allMembers].sort((a, b) => b.donations - a.donations).slice(0, 5);

  root.innerHTML = `
    <div class="hero">
      <div class="hero-content">
        <h1 class="hero-title">SWE <span class="accent">Familjen</span></h1>
        <div class="hero-stats">
          <div class="hero-stat">${icons.shield()} <strong>${clans.length}</strong> clans</div>
          <div class="hero-stat">${icons.users()} <strong>${totalMembers}</strong> medlemmar</div>
          <div class="hero-stat">${icons.zap()} <strong>${legendCount}</strong> i Legend</div>
          <div class="hero-stat">${icons.swords()} <strong>${fmt(totalWarWins)}</strong> war wins</div>
        </div>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-card featured">
        <div class="stat-label">${icons.trophy()} Top trophies</div>
        <div class="stat-value">${icons.trophy()}<span class="accent">${fmt(topTrophy.trophies)}</span></div>
        <div class="stat-sub">${escapeHtml(topTrophy.name)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${icons.users()} Members totalt</div>
        <div class="stat-value">${totalMembers}</div>
        <div class="stat-sub">fördelat på ${clans.length} clans</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${icons.zap()} Legend league</div>
        <div class="stat-value">${legendCount}</div>
        <div class="stat-sub">spelare i familjen</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${icons.swords()} War wins totalt</div>
        <div class="stat-value">${fmt(totalWarWins)}</div>
        <div class="stat-sub">genom åren</div>
      </div>
    </div>

    <section class="section">
      <div class="section-title">${icons.shield()} Clans</div>
      <div class="clan-grid">
        ${clans.map(c => renderClanCard(c, swRanks, glRanks)).join('')}
      </div>
    </section>

    <div class="two-col">
      <section class="section">
        <div class="section-title">${icons.trophy()} Topp 10 trophies</div>
        <table class="table">
          <thead>
            <tr><th class="rank">#</th><th>Spelare</th><th>Clan</th><th class="num">Trophies</th></tr>
          </thead>
          <tbody>
            ${topTrophies.map((m, i) => `
              <tr>
                <td class="rank">${i + 1}</td>
                <td>${m.leagueTier?.icon ? `<img src="${m.leagueTier.icon}" alt="" class="league-mini">` : ''}<a href="#/player/${tagToUrl(m.tag)}" class="player-link">${escapeHtml(m.name)}</a></td>
                <td><a href="#/clan/${tagToUrl(m.clanTag)}">${escapeHtml(m.clanLabel)}</a></td>
                <td class="num"><span class="trophy">${fmt(m.trophies)}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>

      <section class="section">
        <div class="section-title">${icons.trendUp()} Topp 5 donations</div>
        <table class="table">
          <thead>
            <tr><th class="rank">#</th><th>Spelare</th><th>Clan</th><th class="num">Donations</th></tr>
          </thead>
          <tbody>
            ${topDonors.map((m, i) => `
              <tr>
                <td class="rank">${i + 1}</td>
                <td>${m.leagueTier?.icon ? `<img src="${m.leagueTier.icon}" alt="" class="league-mini">` : ''}<a href="#/player/${tagToUrl(m.tag)}" class="player-link">${escapeHtml(m.name)}</a></td>
                <td><a href="#/clan/${tagToUrl(m.clanTag)}">${escapeHtml(m.clanLabel)}</a></td>
                <td class="num">${fmt(m.donations)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>
    </div>
  `;
}

function renderClanCard(c, swRanks, glRanks) {
  const badge = c.data.badgeUrls?.medium || c.data.badgeUrls?.small || '';
  const swRank = swRanks[c.tag] || swRanks[c.data.tag];
  const glRank = glRanks[c.tag] || glRanks[c.data.tag];
  return `
    <a href="#/clan/${tagToUrl(c.tag)}" class="clan-card">
      ${badge ? `<div class="clan-card-bg" style="background-image:url('${badge}')"></div>` : ''}
      <div class="clan-flag-deco"></div>
      <div class="clan-card-header">
        ${badge ? `<img src="${badge}" alt="" class="clan-card-badge">` : ''}
        <div class="clan-card-meta">
          <div class="clan-card-name">${escapeHtml(c.data.name)}</div>
          <div class="clan-card-sub">Level ${c.data.level} · ${escapeHtml(c.data.warLeague || 'Unranked')}</div>
          ${(swRank || glRank) ? `
            <div class="clan-card-rank">
              ${swRank ? `<span class="rank-chip">${icons.mapPin({size:11})} Sverige #${swRank}</span>` : ''}
              ${glRank ? `<span class="rank-chip global">${icons.globe({size:11})} #${fmt(glRank)}</span>` : ''}
            </div>` : ''}
        </div>
      </div>
      <div class="clan-card-stats">
        <div>
          <div class="clan-card-stat-label">Trophies</div>
          <div class="clan-card-stat-value">${icons.trophy({size:14})}<span class="trophy">${fmt(c.data.clanPoints)}</span></div>
        </div>
        <div>
          <div class="clan-card-stat-label">Members</div>
          <div class="clan-card-stat-value">${icons.users({size:14})}${c.data.members}/50</div>
        </div>
        <div>
          <div class="clan-card-stat-label">War wins</div>
          <div class="clan-card-stat-value">${icons.swords({size:14})}${fmt(c.data.warWins || 0)}</div>
        </div>
        <div>
          <div class="clan-card-stat-label">Win streak</div>
          <div class="clan-card-stat-value">${icons.flame({size:14})}${c.data.warWinStreak || 0}</div>
        </div>
      </div>
    </a>
  `;
}
