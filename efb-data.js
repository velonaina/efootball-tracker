// ─────────────────────────────────────────────────────────────────────────────
// efb-data.js — eFootball Tracker · Couche données
// Supabase + Worker efhub + Calculs progression
// ─────────────────────────────────────────────────────────────────────────────

const EFB_CONFIG = {
  supabaseUrl: 'https://hxrepxhtxksrxtjskkon.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4cmVweGh0eGtzcnh0anNra29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MzA5MjAsImV4cCI6MjA5NjUwNjkyMH0.rIzono7x1-Uhm90X3m1fUbyBDZ7JWX_BWBWooFoRheo',
  workerUrl: 'https://efhub-proxy.herryharivelo.workers.dev',
};

// ── Supabase client léger ─────────────────────────────────────────────────────
function sbFetch(path, options = {}) {
  const url = EFB_CONFIG.supabaseUrl + '/rest/v1/' + path;
  const headers = {
    'apikey': EFB_CONFIG.supabaseKey,
    'Authorization': 'Bearer ' + EFB_CONFIG.supabaseKey,
    'Content-Type': 'application/json',
    'Prefer': options.prefer || 'return=representation',
    ...options.headers,
  };
  return fetch(url, { ...options, headers })
    .then(r => {
      if (!r.ok) return r.json().then(e => { throw new Error(e.message || 'Supabase error'); });
      if (r.status === 204 || options.prefer === 'return=minimal') return null;
      const ct = r.headers.get('content-type') || '';
      return ct.includes('json') ? r.json() : null;
    });
}

// ── PLAYERS ───────────────────────────────────────────────────────────────────
const Players = {
  getAll() {
    return sbFetch('efb_players?select=*&order=name.asc');
  },
  get(id) {
    return sbFetch(`efb_players?id=eq.${id}&select=*`).then(r => r[0]);
  },
  create(data) {
    return sbFetch('efb_players', { method: 'POST', body: JSON.stringify(data) }).then(r => r[0]);
  },
  update(id, data) {
    return sbFetch(`efb_players?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then(r => r[0]);
  },
  delete(id) {
    return sbFetch(`efb_players?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
  },
};

// ── CARDS ─────────────────────────────────────────────────────────────────────
const Cards = {
  getAll() {
    return sbFetch('efb_cards?select=*,efb_players(name)&order=created_at.asc');
  },
  getByPlayer(playerId) {
    return sbFetch(`efb_cards?player_id=eq.${playerId}&select=*&order=created_at.asc`);
  },
  get(id) {
    return sbFetch(`efb_cards?id=eq.${id}&select=*`).then(r => r[0]);
  },
  create(data) {
    return sbFetch('efb_cards', { method: 'POST', body: JSON.stringify(data) }).then(r => r[0]);
  },
  update(id, data) {
    return sbFetch(`efb_cards?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then(r => r[0]);
  },
  delete(id) {
    return sbFetch(`efb_cards?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
  },
};

// ── BUILDS ────────────────────────────────────────────────────────────────────
const Builds = {
  getAll() {
    return sbFetch('efb_builds?select=*,efb_cards(playing_style,efb_players(name))&order=created_at.asc');
  },
  getByCard(cardId) {
    return sbFetch(`efb_builds?card_id=eq.${cardId}&select=*&order=created_at.asc`);
  },
  get(id) {
    return sbFetch(`efb_builds?id=eq.${id}&select=*`).then(r => r[0]);
  },
  create(data) {
    return sbFetch('efb_builds', { method: 'POST', body: JSON.stringify(data) }).then(r => r[0]);
  },
  update(id, data) {
    return sbFetch(`efb_builds?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then(r => r[0]);
  },
  delete(id) {
    return sbFetch(`efb_builds?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
  },
};

// ── MATCHES ───────────────────────────────────────────────────────────────────
const Matches = {
  getAll() {
    return sbFetch('efb_matches?select=*,efb_builds(name,efb_cards(efb_players(name)))&order=played_at.desc');
  },
  getByBuild(buildId) {
    return sbFetch(`efb_matches?build_id=eq.${buildId}&select=*&order=played_at.desc`);
  },
  get(id) {
    return sbFetch(`efb_matches?id=eq.${id}&select=*`).then(r => r[0]);
  },
  create(data) {
    return sbFetch('efb_matches', { method: 'POST', body: JSON.stringify(data) }).then(r => r[0]);
  },
  update(id, data) {
    return sbFetch(`efb_matches?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then(r => r[0]);
  },
  delete(id) {
    return sbFetch(`efb_matches?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
  },
};

// ── IMPORT EFHUB ──────────────────────────────────────────────────────────────
const Efhub = {
  // Extraire l'ID depuis une URL efhub
  parseId(url) {
    const m = url.match(/efhub\.com\/(?:[a-z]{2}\/)?players\/(\d+)/);
    return m ? m[1] : null;
  },

  // Fetch données complètes depuis le Worker
  fetch(playerId) {
    return fetch(`${EFB_CONFIG.workerUrl}/?id=${playerId}`)
      .then(r => r.json());
  },

  // URL image carte
  imgUrl(playerId) {
    return `https://efimg.com/efootballhub22/images/player_cards/${playerId}_l.png`;
  },
};

// ── CALCULS PROGRESSION ───────────────────────────────────────────────────────
const Progression = {
  // Coût en points pour N clics sur un slider
  // Règle eFootball : clics 1-4 = 1pt, 5-8 = 2pts, 9-12 = 3pts, etc.
  clickCost(n) {
    let total = 0;
    for (let i = 1; i <= n; i++) {
      total += Math.ceil(i / 4);
    }
    return total;
  },

  // Total de points utilisés pour un build (objet sliders {stat: clics})
  totalPoints(sliders) {
    return Object.values(sliders).reduce((sum, clics) => sum + this.clickCost(clics), 0);
  },

  // Calculer le points_max depuis le level_cap
  // Formule observée : points ≈ levelCap * 1.94
  // Valeurs exactes connues : 22→42, 25→48, 30→58, 33→64
  pointsFromLevelCap(levelCap) {
    const known = { 22: 42, 25: 48, 28: 54, 30: 58, 33: 64, 35: 68, 40: 78 };
    return known[levelCap] || Math.round(levelCap * 1.94);
  },

  // Stat finale = stat efhub de base + gain des clics
  // Gain par clic = +1 sur la stat (approximation eFootball)
  statFinal(baseValue, clics) {
    return baseValue + clics;
  },

  // Calculer toutes les stats finales d'un build
  allStatsFinal(efhubStats, sliders) {
    const result = { ...efhubStats };
    Object.entries(sliders).forEach(([stat, clics]) => {
      if (result[stat] !== undefined) {
        result[stat] = this.statFinal(result[stat], clics);
      }
    });
    return result;
  },
};

// ── ANALYSE ───────────────────────────────────────────────────────────────────
const Analyse = {
  // Calculer les séries de victoires depuis une liste de matchs (ordre chronologique)
  series(matches) {
    if (!matches.length) return { current: 0, record: 0, currentMatches: [], recordMatches: [] };

    let current = 0;
    let record = 0;
    let currentMatches = [];
    let recordMatches = [];
    let tempMatches = [];

    // Trier par date croissante
    const sorted = [...matches].sort((a, b) => new Date(a.played_at) - new Date(b.played_at));

    sorted.forEach(m => {
      if (m.result === 'V') {
        current++;
        tempMatches.push(m);
        if (current > record) {
          record = current;
          recordMatches = [...tempMatches];
        }
      } else {
        current = 0;
        tempMatches = [];
      }
    });

    // Série actuelle = dernière série en cours
    let curr = 0;
    let currMatches = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].result === 'V') {
        curr++;
        currMatches.unshift(sorted[i]);
      } else break;
    }

    return { current: curr, record, currentMatches: currMatches, recordMatches };
  },

  // Stats globales depuis une liste de matchs
  globalStats(matches) {
    const total = matches.length;
    const wins = matches.filter(m => m.result === 'V').length;
    const draws = matches.filter(m => m.result === 'N').length;
    const losses = matches.filter(m => m.result === 'D').length;
    const goalsFor = matches.reduce((s, m) => s + (m.score_for || 0), 0);
    const goalsAgainst = matches.reduce((s, m) => s + (m.score_against || 0), 0);
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    return { total, wins, draws, losses, goalsFor, goalsAgainst, winRate };
  },

  // Stats par rang
  byRank(matches) {
    const ranks = {};
    matches.forEach(m => {
      const r = m.rank || 'Inconnu';
      if (!ranks[r]) ranks[r] = [];
      ranks[r].push(m);
    });
    return Object.entries(ranks).map(([rank, ms]) => ({
      rank,
      ...this.globalStats(ms),
      serie: this.series(ms),
    }));
  },
};

// ── CONSTANTES JEUX ───────────────────────────────────────────────────────────
const EFB_STATS_ORDER = [
  // Attacking
  { key: 'offensiveAwareness', label: 'Offensive Awareness', group: 'Attacking', icon: 'ti-radar', color: '#a78bfa' },
  { key: 'ballControl',        label: 'Ball Control',        group: 'Attacking', icon: 'ti-circle-dot', color: '#34d399' },
  { key: 'dribbling',          label: 'Dribbling',           group: 'Attacking', icon: 'ti-run', color: '#34d399' },
  { key: 'tightPossession',    label: 'Tight Possession',    group: 'Attacking', icon: 'ti-shoe', color: '#34d399' },
  { key: 'lowPass',            label: 'Low Pass',            group: 'Attacking', icon: 'ti-arrow-right', color: '#60a5fa' },
  { key: 'loftedPass',         label: 'Lofted Pass',         group: 'Attacking', icon: 'ti-arrow-curve-right', color: '#60a5fa' },
  { key: 'finishing',          label: 'Finishing',           group: 'Attacking', icon: 'ti-target', color: '#f59e0b' },
  { key: 'heading',            label: 'Heading',             group: 'Attacking', icon: 'ti-arrow-up', color: '#f59e0b' },
  { key: 'setPieceTaking',     label: 'Place Kicking',       group: 'Attacking', icon: 'ti-flag', color: '#f59e0b' },
  { key: 'curl',               label: 'Curl',                group: 'Attacking', icon: 'ti-rotate-clockwise', color: '#f59e0b' },
  // Physical
  { key: 'speed',              label: 'Speed',               group: 'Physical',  icon: 'ti-bolt', color: '#818cf8' },
  { key: 'acceleration',       label: 'Acceleration',        group: 'Physical',  icon: 'ti-player-play', color: '#818cf8' },
  { key: 'kickingPower',       label: 'Kicking Power',       group: 'Physical',  icon: 'ti-arrow-narrow-right', color: '#818cf8' },
  { key: 'jump',               label: 'Jump',                group: 'Physical',  icon: 'ti-chevrons-up', color: '#818cf8' },
  { key: 'physicalContact',    label: 'Physical Contact',    group: 'Physical',  icon: 'ti-barbell', color: '#818cf8' },
  { key: 'balance',            label: 'Balance',             group: 'Physical',  icon: 'ti-scale', color: '#818cf8' },
  { key: 'stamina',            label: 'Stamina',             group: 'Physical',  icon: 'ti-heart-rate-monitor', color: '#818cf8' },
  // Defending
  { key: 'defensiveAwareness', label: 'Defensive Awareness', group: 'Defending', icon: 'ti-radar-2', color: '#c084fc' },
  { key: 'ballWinning',        label: 'Tackling',            group: 'Defending', icon: 'ti-shield', color: '#c084fc' },
  { key: 'trackingBack',       label: 'Def. Engagement',     group: 'Defending', icon: 'ti-user-check', color: '#c084fc' },
  { key: 'aggression',         label: 'Aggression',          group: 'Defending', icon: 'ti-flame', color: '#c084fc' },
  // Goalkeeping
  { key: 'gkCatching',         label: 'GK Catching',         group: 'Goalkeeping', icon: 'ti-hand-stop', color: '#2dd4bf' },
  { key: 'gkClearing',         label: 'GK Parrying',         group: 'Goalkeeping', icon: 'ti-hand-finger', color: '#2dd4bf' },
  { key: 'gkReflexes',         label: 'GK Reflexes',         group: 'Goalkeeping', icon: 'ti-eye', color: '#2dd4bf' },
  { key: 'gkReach',            label: 'GK Reach',            group: 'Goalkeeping', icon: 'ti-arrows-horizontal', color: '#2dd4bf' },
];

// ── Mapping sliders → stats efhub ────────────────────────────────────────────
const SLIDERS_CONFIG = [
  {
    key: 'shooting', label: 'Shooting',
    stats: ['finishing', 'setPieceTaking', 'curl'],
    icon: `<svg viewBox="0 0 56 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="28" cy="32" r="10" stroke="currentColor" stroke-width="2"/>
      <line x1="28" y1="22" x2="28" y2="10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="18" y1="32" x2="6" y2="32" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="38" y1="32" x2="50" y2="32" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="28" y1="42" x2="28" y2="50" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <polygon points="28,6 24,12 32,12" fill="currentColor"/>
      <polygon points="2,32 8,28 8,36" fill="currentColor"/>
      <polygon points="54,32 48,28 48,36" fill="currentColor"/>
      <polygon points="28,54 24,48 32,48" fill="currentColor"/>
      <circle cx="28" cy="32" r="4" fill="currentColor"/>
    </svg>`
  },
  {
    key: 'passing', label: 'Passing',
    stats: ['lowPass', 'loftedPass'],
    icon: `<svg viewBox="0 0 56 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="28" cy="30" r="18" stroke="currentColor" stroke-width="2"/>
      <polygon points="28,17 35,22 33,30 23,30 21,22" fill="currentColor"/>
      <line x1="28" y1="17" x2="28" y2="12" stroke="currentColor" stroke-width="1.5"/>
      <line x1="35" y1="22" x2="40" y2="19" stroke="currentColor" stroke-width="1.5"/>
      <line x1="33" y1="30" x2="38" y2="33" stroke="currentColor" stroke-width="1.5"/>
      <line x1="23" y1="30" x2="18" y2="33" stroke="currentColor" stroke-width="1.5"/>
      <line x1="21" y1="22" x2="16" y2="19" stroke="currentColor" stroke-width="1.5"/>
    </svg>`
  },
  {
    key: 'dribbling', label: 'Dribbling',
    stats: ['ballControl', 'dribbling', 'tightPossession'],
    icon: `<svg viewBox="0 0 56 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="28,10 40,44 16,44" fill="currentColor"/>
      <rect x="14" y="44" width="28" height="5" rx="2" fill="currentColor"/>
      <rect x="18" y="26" width="20" height="3" rx="1" fill="#0f1117"/>
      <rect x="20" y="34" width="16" height="3" rx="1" fill="#0f1117"/>
    </svg>`
  },
  {
    key: 'dexterity', label: 'Dexterity',
    stats: ['offensiveAwareness', 'acceleration', 'balance'],
    icon: `<svg viewBox="0 0 56 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 50 L10 36 L22 24 L34 36 L34 22 L46 10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <polygon points="46,6 42,14 50,14" fill="currentColor"/>
    </svg>`
  },
  {
    key: 'lowerbody', label: 'Lower Body',
    stats: ['speed', 'kickingPower', 'stamina'],
    icon: `<svg viewBox="0 0 56 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 42 L8 26 Q8 18 16 18 L24 18 L28 12 L36 12 L36 18 L42 18 Q48 18 48 26 L48 32 L42 32 L42 26 L14 26 L14 42 Z" fill="currentColor"/>
      <rect x="10" y="42" width="5" height="6" rx="1" fill="currentColor"/>
      <rect x="18" y="42" width="5" height="6" rx="1" fill="currentColor"/>
      <rect x="26" y="42" width="5" height="6" rx="1" fill="currentColor"/>
      <rect x="34" y="42" width="5" height="6" rx="1" fill="currentColor"/>
    </svg>`
  },
  {
    key: 'aerial', label: 'Aerial',
    stats: ['heading', 'jump', 'physicalContact'],
    icon: `<svg viewBox="0 0 56 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 50 L28 34 L42 50" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M14 34 L28 18 L42 34" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  },
  {
    key: 'defending', label: 'Defending',
    stats: ['defensiveAwareness', 'trackingBack', 'ballWinning', 'aggression'],
    icon: `<svg viewBox="0 0 56 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M28 10 L46 18 L46 32 Q46 46 28 52 Q10 46 10 32 L10 18 Z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
      <line x1="28" y1="10" x2="28" y2="52" stroke="currentColor" stroke-width="2"/>
      <path d="M10 28 Q19 28 28 34 Q37 28 46 28" stroke="currentColor" stroke-width="1.5" fill="none"/>
    </svg>`
  },
  {
    key: 'gk1', label: 'GK 1',
    stats: ['gkAwareness', 'jump'],
    icon: `<svg viewBox="0 0 56 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 48 L14 28 Q14 22 18 22 L18 17 Q18 12 22 12 Q26 12 26 17 L26 22 Q29 22 31 25 Q33 28 33 32 L33 40 Q33 46 26 48 Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <line x1="18" y1="22" x2="18" y2="48" stroke="currentColor" stroke-width="1.5"/>
      <line x1="22" y1="18" x2="22" y2="48" stroke="currentColor" stroke-width="1.5"/>
      <line x1="26" y1="22" x2="26" y2="48" stroke="currentColor" stroke-width="1.5"/>
      <text x="38" y="36" font-family="-apple-system,sans-serif" font-size="14" font-weight="700" fill="currentColor">1</text>
    </svg>`
  },
  {
    key: 'gk2', label: 'GK 2',
    stats: ['gkClearing', 'gkReach'],
    icon: `<svg viewBox="0 0 56 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 48 L14 28 Q14 22 18 22 L18 17 Q18 12 22 12 Q26 12 26 17 L26 22 Q29 22 31 25 Q33 28 33 32 L33 40 Q33 46 26 48 Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <line x1="18" y1="22" x2="18" y2="48" stroke="currentColor" stroke-width="1.5"/>
      <line x1="22" y1="18" x2="22" y2="48" stroke="currentColor" stroke-width="1.5"/>
      <line x1="26" y1="22" x2="26" y2="48" stroke="currentColor" stroke-width="1.5"/>
      <text x="38" y="36" font-family="-apple-system,sans-serif" font-size="14" font-weight="700" fill="currentColor">2</text>
    </svg>`
  },
  {
    key: 'gk3', label: 'GK 3',
    stats: ['gkCatching', 'gkReflexes'],
    icon: `<svg viewBox="0 0 56 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 48 L14 28 Q14 22 18 22 L18 17 Q18 12 22 12 Q26 12 26 17 L26 22 Q29 22 31 25 Q33 28 33 32 L33 40 Q33 46 26 48 Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <line x1="18" y1="22" x2="18" y2="48" stroke="currentColor" stroke-width="1.5"/>
      <line x1="22" y1="18" x2="22" y2="48" stroke="currentColor" stroke-width="1.5"/>
      <line x1="26" y1="22" x2="26" y2="48" stroke="currentColor" stroke-width="1.5"/>
      <text x="38" y="36" font-family="-apple-system,sans-serif" font-size="14" font-weight="700" fill="currentColor">3</text>
    </svg>`
  },
];

// Helper : calculer les stats finales depuis les clics sliders
Progression.allStatsFinal = function(efhubStats, sliders) {
  const result = { ...efhubStats };
  SLIDERS_CONFIG.forEach(function(slider) {
    const clics = sliders[slider.key] || 0;
    if (clics > 0) {
      slider.stats.forEach(function(statKey) {
        if (result[statKey] !== undefined) {
          result[statKey] = result[statKey] + clics;
        }
      });
    }
  });
  return result;
};

const EFB_ATTACK_INSTRUCTIONS = ['Off', 'Defensive', 'Attacking', 'Anchoring'];
const EFB_DEFENCE_INSTRUCTIONS = ['Off', 'Tight Marking', 'Man Marking', 'Counter Target', 'Deep Line'];
const EFB_RANKS = ['Professionnel', 'Superstar', 'Légende'];
