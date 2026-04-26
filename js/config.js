export const FAMILY_CLANS = [
  { tag: '#29PULV99J', label: 'SWE' },
  { tag: '#2YRCQJVLP', label: 'SWE Mini' },
  { tag: '#2GRY8Y9GU', label: 'SWE Mini 2' },
];

// Trophy threshold to count as Legend League in this dashboard. The actual
// CoC Legend boundary is 5000, but this catches active players who dipped
// below mid-season, plus active grinders just below the line.
export const LEGEND_TROPHY_THRESHOLD = 4000;

export const SWEDEN_LOCATION_ID = 32000225;

// Cloudflare Worker URL (see worker/SETUP.md). Required for live data + legend tracker.
export const WORKER_URL = 'https://swe-dashboard-api.william-gyrulf.workers.dev/';

// Fallback for endpoints we still want from ClashKing (war hits per player).
export const CLASHKING_BASE = 'https://api.clashk.ing';
