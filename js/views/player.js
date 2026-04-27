import { api } from '../api.js';
import { SWEDEN_LOCATION_ID } from '../config.js';
import {
  fmt, escapeHtml, urlToTag, tagToUrl, formatWarDate, derivedLeague,
  currentLegendSeasonStart, currentLegendDayEvents, inferLegendStars, formatHM,
} from '../util.js';
import { applyChartDefaults, COLORS } from '../charts.js';
import { icons } from '../icons.js';

export async function renderPlayer(root, urlTag) {
  const tag = urlToTag(urlTag);
  const [stats, legendsData, warhits, swedenRanking] = await Promise.all([
    api.playerStats(tag),
    api.playerLegends(tag).catch(() => ({ legends: {} })),
    api.playerWarhits(tag, 20).catch(() => ({ items: [] })),
    api.playerRanking(SWEDEN_LOCATION_ID).catch(() => ({ items: [] })),
  ]);

  stats.legends = legendsData.legends || {};
  const globalRank = stats.legendStatistics?.currentSeason?.rank;
  const swedenRank = swedenRanking.items?.find(p => p.tag === stats.tag)?.rank;

  applyChartDefaults();

  const inLegends = stats.leagueTier?.name === 'Legend League';
  const seasonStart = currentLegendSeasonStart();
  const seasonDays = Object.keys(stats.legends || {})
    .filter(d => d >= seasonStart)
    .sort();
  const today = currentLegendDayEvents(stats.legends);
  const ls = stats.legendStatistics;

  root.innerHTML = `
    <a href="${stats.clan_tag ? `#/clan/${tagToUrl(stats.clan_tag)}` : '#/'}" class="back-link">${icons.arrow({size:14})} Tillbaka</a>

    <div class="clan-header">
      <div>
        <div class="clan-header-name">${escapeHtml(stats.name)}</div>
        <div class="clan-header-meta">
          <span class="tag">${escapeHtml(stats.tag)}</span>
          <span class="meta-sep"></span>
          <span class="meta-item">TH ${stats.townhall || '—'}</span>
          <span class="meta-sep"></span>
          <span class="meta-item">${renderPlayerLeaguePill(stats)}</span>
          ${stats.clan_tag ? `
            <span class="meta-sep"></span>
            <span class="meta-item">${icons.shield({size:13})} <a href="#/clan/${tagToUrl(stats.clan_tag)}">${escapeHtml(stats.clan_tag)}</a></span>
          ` : ''}
        </div>
      </div>
      <div class="clan-header-stats">
        <div>
          <div class="clan-header-stat-value">${icons.trophy({size:18})}<span class="trophy">${fmt(stats.trophies)}</span></div>
          <div class="clan-header-stat-label">Trophies</div>
        </div>
        <div>
          <div class="clan-header-stat-value">${icons.star({size:18})}${fmt(stats.warStars)}</div>
          <div class="clan-header-stat-label">War stars</div>
        </div>
        <div>
          <div class="clan-header-stat-value">${icons.trendUp({size:18})}${fmt(stats.donations)}</div>
          <div class="clan-header-stat-label">Donations</div>
        </div>
        ${globalRank ? `
          <div>
            <div class="clan-header-stat-value rank-global">${icons.globe({size:18})}#${fmt(globalRank)}</div>
            <div class="clan-header-stat-label">Global rank</div>
          </div>` : ''}
        ${swedenRank ? `
          <div>
            <div class="clan-header-stat-value rank-sweden">${icons.mapPin({size:18})}#${swedenRank}</div>
            <div class="clan-header-stat-label">Sverige rank</div>
          </div>` : ''}
      </div>
    </div>

    ${inLegends ? renderTodaySection(today, stats.trophies) : ''}

    <section class="section">
      <div class="section-title">${icons.zap()} Legend league — current season</div>
      ${seasonDays.length === 0 ? `
        <div class="loading">${inLegends ? 'Ingen daglig data än — trackern börjar fyllas på från första trofé-ändring' : 'Spelaren är inte i Legend League'}</div>
      ` : `
        <div class="chart-wrap"><canvas id="legendChart"></canvas></div>
        <div class="stat-row" style="margin-top:16px">
          ${renderLegendSummary(seasonDays, stats.legends)}
        </div>
        <div class="section-title" style="margin-top:24px">${icons.calendar()} Per dag</div>
        ${renderLegendDayTable(seasonDays, stats.legends)}
      `}
    </section>

    ${ls ? `
      <section class="section">
        <div class="section-title">${icons.award()} Legend stats (Supercell summary)</div>
        <div class="stat-row">
          <div class="stat-card">
            <div class="stat-label">${icons.flame()} Lifetime legend trophies</div>
            <div class="stat-value">${icons.trophy()}<span class="trophy">${fmt(ls.legendTrophies)}</span></div>
          </div>
          ${ls.previousSeason ? `
            <div class="stat-card">
              <div class="stat-label">${icons.calendar()} Previous season</div>
              <div class="stat-value">${icons.trophy()}${fmt(ls.previousSeason.trophies)}</div>
              <div class="stat-sub">${icons.crown({size:12})} ${ls.previousSeason.rank ? '#' + fmt(ls.previousSeason.rank) : '—'} · ${ls.previousSeason.id || ''}</div>
            </div>` : ''}
          ${ls.bestSeason ? `
            <div class="stat-card">
              <div class="stat-label">${icons.award()} Best season</div>
              <div class="stat-value">${icons.trophy()}<span class="trophy">${fmt(ls.bestSeason.trophies)}</span></div>
              <div class="stat-sub">${icons.crown({size:12})} ${ls.bestSeason.rank ? '#' + fmt(ls.bestSeason.rank) : '—'} · ${ls.bestSeason.id || ''}</div>
            </div>` : ''}
        </div>
      </section>
    ` : ''}

    <section class="section">
      <div class="section-title">${icons.swords()} War performance (last ${(warhits.items || []).length})</div>
      ${renderWarHits(warhits.items || [])}
    </section>
  `;

  if (seasonDays.length > 0) {
    drawLegendChart(seasonDays, stats.legends);
  }
}

function renderTodaySection(today, currentTrophies) {
  const atkCount = today.attacks.length;
  const defCount = today.defenses.length;
  const gain = today.attacks.reduce((s, a) => s + a.change, 0);
  const loss = today.defenses.reduce((s, d) => s + d.change, 0);
  const net = gain - loss;
  return `
    <section class="section">
      <div class="section-title">${icons.activity()} Idag <span class="section-meta">(sedan 07:00)</span></div>
      <div class="stat-row">
        <div class="stat-card">
          <div class="stat-label">${icons.swords()} Attacks</div>
          <div class="stat-value">${atkCount}<span class="stat-denom"> / 8</span></div>
          <div class="stat-sub positive">+${fmt(gain)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${icons.shield()} Defenses</div>
          <div class="stat-value">${defCount}<span class="stat-denom"> / 8</span></div>
          <div class="stat-sub negative">−${fmt(loss)}</div>
        </div>
        <div class="stat-card ${net >= 0 ? '' : 'negative-card'}">
          <div class="stat-label">${icons.trendUp()} Net</div>
          <div class="stat-value ${net >= 0 ? 'positive' : 'negative'}">${net >= 0 ? '+' : ''}${fmt(net)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${icons.trophy()} Current</div>
          <div class="stat-value"><span class="trophy">${fmt(currentTrophies)}</span></div>
        </div>
      </div>
      <div class="today-events">
        <div class="today-col">
          <div class="today-col-title">${icons.swords({size:14})} Attacks · ${atkCount}/8</div>
          ${atkCount === 0
            ? `<div class="today-empty">Inga attacks idag än</div>`
            : today.attacks.map(e => renderTodayEvent(e, true)).join('')}
        </div>
        <div class="today-col">
          <div class="today-col-title">${icons.shield({size:14})} Defenses · ${defCount}/8</div>
          ${defCount === 0
            ? `<div class="today-empty">Inga defenses idag än</div>`
            : today.defenses.map(e => renderTodayEvent(e, false)).join('')}
        </div>
      </div>
    </section>
  `;
}

function renderTodayEvent(e, isAttack) {
  const stars = inferLegendStars(e.change);
  const filled = '★'.repeat(stars);
  const empty = '☆'.repeat(3 - stars);
  const sign = isAttack ? '+' : '−';
  const cls = isAttack ? 'positive' : 'negative';
  return `
    <div class="today-event">
      <span class="today-stars stars-${stars}">${filled}<span class="today-stars-empty">${empty}</span></span>
      <span class="today-change ${cls}">${sign}${fmt(e.change)}</span>
      <span class="today-trophies">${fmt(e.trophies)}</span>
      <span class="today-time">${formatHM(e.time)}</span>
    </div>
  `;
}

function renderLegendSummary(seasonDays, legends) {
  let totalAttacks = 0, totalDefenses = 0, totalGain = 0, totalLoss = 0;
  for (const d of seasonDays) {
    const day = legends[d];
    totalAttacks += (day.attacks || []).length;
    totalDefenses += (day.defenses || []).length;
    totalGain += (day.attacks || []).reduce((a,b) => a+b, 0);
    totalLoss += (day.defenses || []).reduce((a,b) => a+b, 0);
  }
  const net = totalGain - totalLoss;
  return `
    <div class="stat-card"><div class="stat-label">Active days</div><div class="stat-value">${seasonDays.length}</div></div>
    <div class="stat-card"><div class="stat-label">Attacks</div><div class="stat-value">${totalAttacks}</div><div class="stat-sub positive">+${fmt(totalGain)}</div></div>
    <div class="stat-card"><div class="stat-label">Defenses</div><div class="stat-value">${totalDefenses}</div><div class="stat-sub negative">−${fmt(totalLoss)}</div></div>
    <div class="stat-card"><div class="stat-label">Net</div><div class="stat-value ${net >= 0 ? 'positive' : 'negative'}">${net >= 0 ? '+' : ''}${fmt(net)}</div></div>
  `;
}

function renderLegendDayTable(seasonDays, legends) {
  const rows = [...seasonDays].reverse().map(date => {
    const day = legends[date];
    const attacks = day.attacks || [];
    const defenses = day.defenses || [];
    const gain = attacks.reduce((a,b) => a+b, 0);
    const loss = defenses.reduce((a,b) => a+b, 0);
    const net = gain - loss;
    const allActions = [...(day.new_attacks||[]), ...(day.new_defenses||[])].sort((a,b) => a.time - b.time);
    const eod = allActions.length ? allActions[allActions.length-1].trophies : null;
    return `
      <tr>
        <td>${date}</td>
        <td class="num">${attacks.length}</td>
        <td class="num positive">+${fmt(gain)}</td>
        <td class="num">${defenses.length}</td>
        <td class="num negative">−${fmt(loss)}</td>
        <td class="num ${net >= 0 ? 'positive' : 'negative'}">${net >= 0 ? '+' : ''}${fmt(net)}</td>
        <td class="num">${eod != null ? fmt(eod) : '—'}</td>
      </tr>
    `;
  }).join('');

  return `
    <table class="table">
      <thead>
        <tr>
          <th>Date</th>
          <th class="num">Atk</th>
          <th class="num">Gain</th>
          <th class="num">Def</th>
          <th class="num">Loss</th>
          <th class="num">Net</th>
          <th class="num">EoD</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function drawLegendChart(seasonDays, legends) {
  const points = [];
  for (const date of seasonDays) {
    const day = legends[date];
    for (const a of (day.new_attacks || [])) points.push({ x: a.time * 1000, y: a.trophies });
    for (const d of (day.new_defenses || [])) points.push({ x: d.time * 1000, y: d.trophies });
  }
  points.sort((a, b) => a.x - b.x);

  const ctx = document.getElementById('legendChart').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: 'Trophies',
        data: points,
        borderColor: COLORS.accent,
        backgroundColor: COLORS.accent + '22',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.15,
        fill: true,
      }],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        x: { type: 'time', time: { unit: 'day' }, grid: { display: false }, ticks: { color: COLORS.dim, font: { size: 11 } } },
        y: { grid: { color: COLORS.border }, ticks: { color: COLORS.dim, font: { size: 11 } } },
      },
      plugins: {
        legend: { display: false },
        tooltip: { mode: 'index', intersect: false },
      },
    },
  });
}

function renderPlayerLeaguePill(stats) {
  const tier = stats.leagueTier;
  if (!tier) return `<span class="pill pill-dim">Unranked</span>`;
  const isLegend = tier.name === 'Legend League';
  const short = tier.name.replace(' League', '');
  return `<span class="pill ${isLegend ? 'league-legend' : ''}">${tier.icon ? `<img src="${tier.icon}" alt="" class="pill-icon">` : ''}${escapeHtml(short)}</span>`;
}

function renderWarHits(items) {
  if (items.length === 0) return '<div class="loading">Inga war hits loggade</div>';

  const allAttacks = items.flatMap(i => i.attacks || []);
  const totalAttacks = allAttacks.length;
  const totalStars = allAttacks.reduce((s, a) => s + (a.stars || 0), 0);
  const triples = allAttacks.filter(a => a.stars === 3).length;
  const doubles = allAttacks.filter(a => a.stars === 2).length;
  const singles = allAttacks.filter(a => a.stars === 1).length;
  const zeros = allAttacks.filter(a => a.stars === 0).length;
  const avgDest = totalAttacks ? (allAttacks.reduce((s, a) => s + (a.destructionPercentage || 0), 0) / totalAttacks) : 0;
  const triplePct = totalAttacks ? Math.round(triples/totalAttacks*100) : 0;

  const maxAttacks = Math.max(...items.map(i => (i.attacks || []).length), 1);

  const rows = items.map(i => {
    const w = i.war_data;
    const opponent = w.opponent;
    const attacks = i.attacks || [];
    const cells = [];
    for (let n = 0; n < maxAttacks; n++) {
      cells.push(renderAttackCell(attacks[n]));
    }
    return `
      <tr>
        <td>${formatWarDate(w.endTime)}</td>
        <td>vs ${escapeHtml(opponent.name)}</td>
        ${cells.join('')}
      </tr>
    `;
  }).join('');

  const attackHeaders = Array.from({ length: maxAttacks }, (_, i) =>
    `<th>Attack ${i + 1}</th>`
  ).join('');

  return `
    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-label">${icons.swords()} Attacks</div>
        <div class="stat-value">${totalAttacks}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${icons.star()} Total stars</div>
        <div class="stat-value">${icons.star({size:18})}<span class="trophy">${totalStars}</span></div>
        <div class="stat-sub">${totalAttacks ? (totalStars/totalAttacks).toFixed(2) : '—'} avg</div>
      </div>
      <div class="stat-card ${triplePct >= 50 ? 'featured' : ''}">
        <div class="stat-label">${icons.flame()} Triples</div>
        <div class="stat-value positive">${triples}</div>
        <div class="stat-sub">${triplePct}% av attacks</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${icons.activity()} Avg destruction</div>
        <div class="stat-value">${avgDest.toFixed(1)}%</div>
      </div>
    </div>
    ${totalAttacks > 0 ? `
      <div class="star-distribution">
        <div class="star-dist-label">Stjärnfördelning</div>
        <div class="star-dist-bar">
          ${triples > 0 ? `<div class="seg seg-3" style="flex:${triples}" title="3★: ${triples}"><span>${triples}</span></div>` : ''}
          ${doubles > 0 ? `<div class="seg seg-2" style="flex:${doubles}" title="2★: ${doubles}"><span>${doubles}</span></div>` : ''}
          ${singles > 0 ? `<div class="seg seg-1" style="flex:${singles}" title="1★: ${singles}"><span>${singles}</span></div>` : ''}
          ${zeros > 0 ? `<div class="seg seg-0" style="flex:${zeros}" title="0★: ${zeros}"><span>${zeros}</span></div>` : ''}
        </div>
        <div class="star-dist-legend">
          <span class="seg-key seg-3"></span> 3★
          <span class="seg-key seg-2"></span> 2★
          <span class="seg-key seg-1"></span> 1★
          <span class="seg-key seg-0"></span> 0★
        </div>
      </div>
    ` : ''}
    <table class="table" style="margin-top:16px">
      <thead><tr><th>Date</th><th>Opponent</th>${attackHeaders}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderAttackCell(a) {
  if (!a) return '<td class="war-attack-cell empty">—</td>';
  const filled = '★'.repeat(a.stars);
  const empty = '☆'.repeat(3 - a.stars);
  const dest = (a.destructionPercentage || 0).toFixed(0) + '%';
  return `
    <td class="war-attack-cell stars-${a.stars}">
      <span class="war-stars-filled">${filled}</span><span class="war-stars-empty">${empty}</span>
      <span class="war-dest">${dest}</span>
    </td>
  `;
}
