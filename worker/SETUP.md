# Cloudflare Worker setup

Workern hostar (1) en proxy till Supercells officiella CoC-API och (2) en daily
legend-tracker som pollar familjeklanerna var 5:e minut.

Total tid: ~25 minuter. Allt gratis.

---

## 1. Skapa Supercell-API-nyckel

1. Gå till https://developer.clashofclans.com och skapa konto (gratis).
2. **My Account → Create New Key**:
   - **Key Name**: `swe-dashboard`
   - **Description**: vad som helst
   - **Allowed IP Addresses**: `45.79.218.79`
     (det är cocproxy.royaleapi.dev's fasta IP — Workern går igenom den)
3. Spara nyckel-stringen som dyker upp. Du behöver den i steg 5.

---

## 2. Skapa Cloudflare-konto

Gå till https://dash.cloudflare.com och skapa konto (gratis). Ingen betalkort krävs.

---

## 3. Skapa KV-namespace

1. Sidopanel → **Workers & Pages** → **KV** → **Create namespace**
2. Name: `LEGEND_KV`
3. Klicka **Add**

---

## 4. Skapa Workern

1. **Workers & Pages** → **Create** → **Create Worker**
2. Name: `swe-dashboard-api` (eller vad du vill — namnet blir en del av URL:en)
3. Klicka **Deploy**
4. Klicka **Edit code** uppe till höger
5. Markera och radera all default-kod
6. Klistra in HELA innehållet från `worker/coc-proxy.js`
7. Klicka **Deploy**

---

## 5. Lägg till bindings (API-nyckel + KV)

Gå till din Worker → **Settings** → **Variables**:

**Variabel 1: API-nyckeln**
1. Under "Environment Variables" → klicka **Add variable**
2. Type: **Encrypt** (viktigt — så den inte syns i klartext)
3. Variable name: `COC_API_KEY`
4. Value: Supercell-nyckeln från steg 1
5. **Save and deploy**

**Variabel 2: KV-bindningen**
1. Under "KV Namespace Bindings" → klicka **Add binding**
2. Variable name: `LEGEND_KV`
3. KV namespace: `LEGEND_KV` (som du skapade i steg 3)
4. **Save and deploy**

---

## 6. Sätt cron-trigger (5-min polling)

1. Worker → **Settings** → **Triggers** → **Cron Triggers** → **Add Cron Trigger**
2. Cron expression: `*/5 * * * *`
3. **Add**

---

## 7. Testa Workern

Din Worker har en URL typ `https://swe-dashboard-api.<ditt-konto>.workers.dev`.

Hämta den från Worker-overview, sen testa i browsern:

- `https://...workers.dev/health` → ska returnera `{"ok":true,"clans":[...]}`
- `https://...workers.dev/coc/clans/%2329PULV99J` → ska returnera SWE-klanens fulla data

Om `/coc/...` ger 403/401, då är API-nyckeln eller IP-whitelistet fel.
Om `/coc/...` ger 200 men `legends/...` är tomt — det är förväntat tills
första cron-pollen körts (~5 min) och spelare börjat ändra trofeer.

---

## 8. Klistra in Worker-URL i appen

Öppna `js/config.js` och sätt:

```js
export const WORKER_URL = 'https://swe-dashboard-api.<ditt-konto>.workers.dev';
```

Klart. Dashboarden använder Workern direkt.

---

## Hur du senare lägger till en klan

1. Öppna `worker/coc-proxy.js`, lägg till tag i `FAMILY_CLAN_TAGS`
2. Workers & Pages → din Worker → **Edit code** → klistra in nya versionen → **Deploy**
3. Gör samma sak i `js/config.js` `FAMILY_CLANS`
