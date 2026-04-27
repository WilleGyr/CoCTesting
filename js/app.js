import { renderFamily } from './views/family.js';
import { renderClan } from './views/clan.js';
import { renderPlayer } from './views/player.js';
import { renderWars } from './views/wars.js';
import { renderLegends } from './views/legends.js';
import { WORKER_URL } from './config.js';

const app = document.getElementById('app');

function setActiveNav(route) {
  document.querySelectorAll('.nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.route === route);
  });
}

async function route() {
  const hash = location.hash.slice(1) || '/';
  const parts = hash.split('/').filter(Boolean);

  app.innerHTML = '<div class="loading">Laddar…</div>';

  if (!WORKER_URL) {
    app.innerHTML = `
      <div class="setup-banner">
        <h2>Setup krävs</h2>
        <p>Cloudflare Workern är inte konfigurerad än. Följ <code>worker/SETUP.md</code> (~25 min) och klistra in din Worker-URL i <code>js/config.js</code>.</p>
        <p class="muted">När det är gjort: ladda om sidan.</p>
      </div>
    `;
    return;
  }

  try {
    if (parts.length === 0) {
      setActiveNav('family');
      await renderFamily(app);
    } else if (parts[0] === 'clan' && parts[1]) {
      setActiveNav(null);
      await renderClan(app, parts[1]);
    } else if (parts[0] === 'player' && parts[1]) {
      setActiveNav(null);
      await renderPlayer(app, parts[1]);
    } else if (parts[0] === 'wars') {
      setActiveNav('wars');
      await renderWars(app);
    } else if (parts[0] === 'legends') {
      setActiveNav('legends');
      await renderLegends(app);
    } else {
      app.innerHTML = '<div class="error">Okänd sida</div>';
    }
  } catch (err) {
    console.error(err);
    if (err.isCocUpstream) {
      app.innerHTML = renderOutage(err.status);
      app.querySelector('.outage-retry')?.addEventListener('click', () => location.reload());
    } else {
      app.innerHTML = `<div class="error">Kunde inte ladda: ${err.message}</div>`;
    }
  }
}

function renderOutage(status) {
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/><line x1="2" x2="22" y1="2" y2="22" stroke-width="1.8"/></svg>`;
  return `
    <div class="outage">
      <div class="outage-icon">${icon}</div>
      <h2 class="outage-title">Supercells API är nere</h2>
      <p class="outage-desc">
        Clash of Clans servrar svarar inte just nu. Det här gäller alla
        tjänster som hämtar data från Supercell — inte bara den här sidan.
      </p>
      <p class="outage-meta">Upstream-status: ${status} · oftast nere några minuter, ibland under måndagsunderhåll.</p>
      <button class="outage-retry" type="button">Försök igen</button>
    </div>
  `;
}

window.addEventListener('hashchange', route);
window.addEventListener('load', route);
