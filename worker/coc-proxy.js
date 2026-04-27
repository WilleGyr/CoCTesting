// Cloudflare Worker for SWE Family Dashboard
// - Proxies Supercell CoC API requests (hides API key, adds CORS)
// - Polls family clans every 5 min and tracks Legend League trophy changes in KV
// - Exposes /legends/{tag} for the dashboard to read per-day attack/defense history

const COC_API = 'https://cocproxy.royaleapi.dev/v1';

const FAMILY_CLAN_TAGS = [
  '#29PULV99J', // SWE
  '#2YRCQJVLP', // SWE Mini
  '#2GRY8Y9GU', // SWE Mini 2
];

const KV_TTL_DAYS = 365;

export default {
  async fetch(request, env, ctx) {
    return handleHttp(request, env, ctx);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(pollAllClans(env));
  },
};

async function handleHttp(request, env, ctx) {
  const url = new URL(request.url);
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  try {
    let m = url.pathname.match(/^\/legends\/(.+)$/);
    if (m) {
      const tag = decodeURIComponent(m[1]);
      const cache = caches.default;
      const cacheKey = new Request(url.toString(), { method: 'GET' });
      const cached = await cache.match(cacheKey);
      if (cached) return cached;

      const data = await readLegends(env, tag);
      const response = new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          ...cors,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=60',
        },
      });
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    }

    m = url.pathname.match(/^\/coc\/(.+)$/);
    if (m) {
      const upstream = `${COC_API}/${m[1]}${url.search}`;
      const res = await fetch(upstream, {
        headers: { Authorization: `Bearer ${env.COC_API_KEY}` },
      });
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/health') {
      return jsonRes({ ok: true, clans: FAMILY_CLAN_TAGS }, cors);
    }

    return new Response('Not found', { status: 404, headers: cors });
  } catch (err) {
    return jsonRes({ error: err.message }, cors, 500);
  }
}

async function pollAllClans(env) {
  for (const clanTag of FAMILY_CLAN_TAGS) {
    try {
      const url = `${COC_API}/clans/${encodeURIComponent(clanTag)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${env.COC_API_KEY}` },
      });
      if (!res.ok) continue;
      const clan = await res.json();
      const now = Math.floor(Date.now() / 1000);
      const date = new Date().toISOString().slice(0, 10);

      for (const member of (clan.memberList || [])) {
        if (member.league?.name !== 'Legend League') continue;
        await trackPlayer(env, member.tag, member.trophies, now, date);
      }
    } catch (e) {
      // continue with next clan
    }
  }
}

async function trackPlayer(env, tag, trophies, now, date) {
  const stateKey = `state:${tag}`;
  const prev = await env.LEGEND_KV.get(stateKey, 'json');

  if (prev && prev.trophies !== trophies) {
    const diff = trophies - prev.trophies;
    const dayKey = `day:${tag}:${date}`;
    const day = (await env.LEGEND_KV.get(dayKey, 'json')) || {
      attacks: [], defenses: [], new_attacks: [], new_defenses: [],
    };
    const event = { change: Math.abs(diff), time: now, trophies };
    if (diff > 0) {
      day.attacks.push(Math.abs(diff));
      day.new_attacks.push(event);
    } else {
      day.defenses.push(Math.abs(diff));
      day.new_defenses.push(event);
    }
    await env.LEGEND_KV.put(dayKey, JSON.stringify(day), {
      expirationTtl: 60 * 60 * 24 * KV_TTL_DAYS,
    });
    await env.LEGEND_KV.put(stateKey, JSON.stringify({ trophies, time: now }));
  } else if (!prev) {
    await env.LEGEND_KV.put(stateKey, JSON.stringify({ trophies, time: now }));
  }
}

async function readLegends(env, tag) {
  const list = await env.LEGEND_KV.list({ prefix: `day:${tag}:` });
  const legends = {};
  await Promise.all(list.keys.map(async (k) => {
    const date = k.name.split(':').pop();
    const data = await env.LEGEND_KV.get(k.name, 'json');
    if (data) legends[date] = data;
  }));
  return { tag, legends };
}

function jsonRes(obj, headers = {}, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
