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
    app.innerHTML = `<div class="error">Kunde inte ladda: ${err.message}</div>`;
  }
}

window.addEventListener('hashchange', route);
window.addEventListener('load', route);
