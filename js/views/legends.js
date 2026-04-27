import { api } from '../api.js';
import { FAMILY_CLANS, SWEDEN_LOCATION_ID, LEGEND_TROPHY_THRESHOLD } from '../config.js';
import { fmt, escapeHtml, tagToUrl, currentLegendSeasonStart, currentLegendDayEvents } from '../util.js';
import { icons } from '../icons.js';

export async function renderLegends(root) {
  const [clans, swPlayerRank] = await Promise.all([
    Promise.all(FAMILY_CLANS.map(c => api.clanBasic(c.tag).then(data => ({ ...c, data })))),
    api.playerRanking(SWEDEN_LOCATION_ID).catch(() => ({ items: [] })),
  ]);

  const allMembers = clans.flatMap(c =>
    c.data.memberList.map(m => ({ ...m, clanLabel: c.label, clanTag: c.tag }))
  );

  const legendMembers = allMembers.filter(m =>
    m.leagueTier?.name === 'Legend League'
  );

  const seasonStart = currentLegendSeasonStart();

  // Fetch player stats (for global rank) + per-day legend data in parallel
  const enriched = await Promise.all(legendMembers.map(async m => {
    const [playerData, legendData] = await Promise.all([
      api.playerStats(m.tag).catch(() => null),
      api.playerLegends(m.tag).catch(() => ({ legends: {} })),
    ]);
    const todayEvents = currentLegendDayEvents(legendData.legends);
    const seasonDays = Object.keys(legendData.legends || {}).filter(d => d >= seasonStart);
    let seasonNet = 0;
    for (const d of seasonDays) {
      const day = legendData.legends[d];
      seasonNet += (day.attacks || []).reduce((a, b) => a + b, 0);
      seasonNet -= (day.defenses || []).reduce((a, b) => a + b, 0);
    }
    return {
      ...m,
      trophies: playerData?.trophies ?? m.trophies,
      globalRank: playerData?.legendStatistics?.currentSeason?.rank || null,
      todayAttacks: todayEvents.attacks.length,
      todayDefenses: todayEvents.defenses.length,
      todayGain: todayEvents.attacks.reduce((s, e) => s + e.change, 0),
      todayLoss: todayEvents.defenses.reduce((s, e) => s + e.change, 0),
      seasonNet,
      seasonDays: seasonDays.length,
    };
  }));

  enriched.sort((a, b) => b.trophies - a.trophies);

  // Sweden top 200 — just show top 50 with family highlighted
  const familyTags = new Set(legendMembers.map(m => m.tag));
  const swedenTop = (swPlayerRank.items || []).slice(0, 50);

  // Rankings endpoint returns stale badge URLs (Supercell bug — they all point
  // to a default image). Fetch fresh /clan/{tag} for each unique clan to get
  // working badges. Cached, so repeats are free.
  const uniqueClanTags = [...new Set(swedenTop.filter(p => p.clan?.tag).map(p => p.clan.tag))];
  const freshClans = await Promise.all(uniqueClanTags.map(t => api.clanBasic(t).catch(() => null)));
  const badgeByClanTag = new Map();
  freshClans.forEach(c => {
    if (c?.tag && c?.badgeUrls?.small) badgeByClanTag.set(c.tag, c.badgeUrls.small);
  });

  root.innerHTML = `
    <div class="stat-row">
      <div class="stat-card featured">
        <div class="stat-label">${icons.trophy()} Familjens topp legend</div>
        <div class="stat-value">${icons.trophy()}<span class="accent">${enriched[0] ? fmt(enriched[0].trophies) : '—'}</span></div>
        <div class="stat-sub">${enriched[0] ? escapeHtml(enriched[0].name) : ''}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${icons.zap()} Legend league spelare</div>
        <div class="stat-value">${enriched.length}</div>
        <div class="stat-sub">i familjen</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${icons.trendUp()} Attacks idag</div>
        <div class="stat-value positive">${enriched.reduce((s, m) => s + m.todayAttacks, 0)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${icons.trendDown()} Defenses idag</div>
        <div class="stat-value negative">${enriched.reduce((s, m) => s + m.todayDefenses, 0)}</div>
      </div>
    </div>

    <section class="section">
      <div class="section-title">${icons.zap()} Familjens legend league spelare</div>
      ${enriched.length === 0 ? '<div class="loading">Ingen i familjen är i Legend League just nu</div>' : `
        <table class="table">
          <thead>
            <tr>
              <th class="rank">#</th>
              <th>Spelare</th>
              <th>Clan</th>
              <th class="num">Trophies</th>
              <th class="num">Global rank</th>
              <th class="num">Today atk</th>
              <th class="num">Today def</th>
              <th class="num">Net today</th>
            </tr>
          </thead>
          <tbody>
            ${enriched.map((m, i) => {
              const todayNet = m.todayGain - m.todayLoss;
              return `
                <tr>
                  <td class="rank">${i + 1}</td>
                  <td>${m.leagueTier?.icon ? `<img src="${m.leagueTier.icon}" alt="" class="league-mini">` : ''}<a href="#/player/${tagToUrl(m.tag)}" class="player-link">${escapeHtml(m.name)}</a></td>
                  <td><a href="#/clan/${tagToUrl(m.clanTag)}">${escapeHtml(m.clanLabel)}</a></td>
                  <td class="num"><span class="trophy">${fmt(m.trophies)}</span></td>
                  <td class="num">${m.globalRank ? '#' + fmt(m.globalRank) : '—'}</td>
                  <td class="num positive">${m.todayAttacks > 0 ? `${m.todayAttacks} (+${m.todayGain})` : '—'}</td>
                  <td class="num negative">${m.todayDefenses > 0 ? `${m.todayDefenses} (−${m.todayLoss})` : '—'}</td>
                  <td class="num ${todayNet > 0 ? 'positive' : todayNet < 0 ? 'negative' : ''}">${m.todayAttacks + m.todayDefenses === 0 ? '—' : (todayNet > 0 ? '+' : '') + todayNet}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        <div class="stat-sub" style="margin-top:8px">Daglig data börjar fyllas på från första cron-pollen efter att Workern startade. Rankings live från Supercell.</div>
      `}
    </section>

    <section class="section">
      <div class="section-title">${icons.mapPin()} Sverige top 50</div>
      ${swedenTop.length === 0 ? '<div class="loading">Ingen ranking-data</div>' : `
        <table class="table">
          <thead>
            <tr>
              <th class="rank">#</th>
              <th>Spelare</th>
              <th>Clan</th>
              <th class="num">Trophies</th>
            </tr>
          </thead>
          <tbody>
            ${swedenTop.map(p => `
              <tr class="${familyTags.has(p.tag) ? 'highlight' : ''}">
                <td class="rank">${p.rank}</td>
                <td>${p.leagueTier?.iconUrls?.small ? `<img src="${p.leagueTier.iconUrls.small}" alt="" class="league-mini">` : ''}<a href="#/player/${tagToUrl(p.tag)}" class="player-link">${escapeHtml(p.name)}</a></td>
                <td class="clan-cell">${p.clan ? (() => {
                  const badge = badgeByClanTag.get(p.clan.tag);
                  return `
                    ${badge ? `<img src="${badge}" alt="" class="clan-badge-mini">` : '<span class="clan-badge-placeholder"></span>'}
                    <a href="#/clan/${tagToUrl(p.clan.tag)}" class="player-link">${escapeHtml(p.clan.name)}</a>
                  `;
                })() : '<span class="tag">— ingen klan</span>'}</td>
                <td class="num"><span class="trophy">${fmt(p.trophies)}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </section>
  `;
}
