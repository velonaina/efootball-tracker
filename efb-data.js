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

// ── COACHES ───────────────────────────────────────────────────────────────────
const Coaches = {
  getAll() {
    return sbFetch('efb_coaches?select=*&order=name.asc');
  },
  get(id) {
    return sbFetch(`efb_coaches?id=eq.${id}&select=*`).then(r => r[0]);
  },
  create(data) {
    return sbFetch('efb_coaches', { method: 'POST', body: JSON.stringify(data) }).then(r => r[0]);
  },
  update(id, data) {
    return sbFetch(`efb_coaches?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then(r => r[0]);
  },
  delete(id) {
    return sbFetch(`efb_coaches?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
  },
};

// ── MATCHES ───────────────────────────────────────────────────────────────────
const Matches = {
  getAll() {
    return sbFetch('efb_matches?select=*,efb_builds(name,efb_cards(efb_players(name))),efb_coaches(name,style,formation)&order=played_at.desc');
  },
  getByBuild(buildId) {
    return sbFetch(`efb_matches?build_id=eq.${buildId}&select=*&order=played_at.desc`);
  },
  getByCoach(coachId) {
    return sbFetch(`efb_matches?coach_id=eq.${coachId}&select=*&order=played_at.desc`);
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
  pointsFromLevelCap(levelCap) {
    const known = { 22: 42, 25: 48, 28: 54, 30: 58, 33: 64, 35: 68, 40: 78 };
    return known[levelCap] || Math.round(levelCap * 1.94);
  },

  // Stat finale = stat efhub de base + gain des clics
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

  // Stats par build (depuis player_stats de chaque match)
  byBuild(matches) {
    const builds = {};
    matches.forEach(m => {
      const ps = m.player_stats || [];
      ps.forEach(p => {
        if (!p.build_id) return;
        if (!builds[p.build_id]) builds[p.build_id] = { matchIds: new Set(), goals: 0, assists: 0, ratings: [], saves: 0 };
        builds[p.build_id].matchIds.add(m.id);
        builds[p.build_id].goals   += p.goals   || 0;
        builds[p.build_id].assists += p.assists  || 0;
        builds[p.build_id].saves   += p.saves    || 0;
        if (p.rating > 0) builds[p.build_id].ratings.push(p.rating);
      });
    });
    return Object.entries(builds).map(([bid, data]) => {
      const ms = matches.filter(m => data.matchIds.has(m.id));
      const stats = this.globalStats(ms);
      const avgRating = data.ratings.length > 0
        ? Math.round(data.ratings.reduce((a,b) => a+b, 0) / data.ratings.length * 10) / 10
        : 0;
      return { build_id: bid, matchCount: data.matchIds.size, goals: data.goals, assists: data.assists, saves: data.saves, avgRating, ...stats };
    }).sort((a, b) => b.winRate - a.winRate);
  },

  // Stats par joueur (depuis player_stats)
  byPlayer(matches) {
    const players = {};
    matches.forEach(m => {
      const ps = m.player_stats || [];
      ps.forEach(p => {
        if (!p.player_id) return;
        if (!players[p.player_id]) players[p.player_id] = { matchCount: 0, goals: 0, assists: 0, saves: 0, ratings: [], yellowCards: 0, redCards: 0 };
        players[p.player_id].matchCount++;
        players[p.player_id].goals       += p.goals   || 0;
        players[p.player_id].assists     += p.assists  || 0;
        players[p.player_id].saves       += p.saves    || 0;
        players[p.player_id].yellowCards += p.yellow_card ? 1 : 0;
        players[p.player_id].redCards    += p.red_card   ? 1 : 0;
        if (p.rating > 0) players[p.player_id].ratings.push(p.rating);
      });
    });
    return Object.entries(players).map(([pid, data]) => {
      const avgRating = data.ratings.length > 0
        ? Math.round(data.ratings.reduce((a,b) => a+b, 0) / data.ratings.length * 10) / 10
        : 0;
      return { player_id: pid, ...data, avgRating };
    }).sort((a, b) => b.goals - a.goals);
  },

  // Stats par formation
  byFormation(matches) {
    const formations = {};
    matches.forEach(m => {
      const f = m.formation || 'Inconnue';
      if (!formations[f]) formations[f] = [];
      formations[f].push(m);
    });
    return Object.entries(formations).map(([formation, ms]) => ({
      formation,
      ...this.globalStats(ms),
    })).sort((a, b) => b.winRate - a.winRate);
  },

  // Stats par type de match
  byMatchType(matches) {
    const types = {};
    matches.forEach(m => {
      const t = m.match_type || 'Inconnu';
      if (!types[t]) types[t] = [];
      types[t].push(m);
    });
    return Object.entries(types).map(([type, ms]) => ({
      match_type: type,
      ...this.globalStats(ms),
    })).sort((a, b) => b.total - a.total);
  },

  // Stats par coach
  byCoach(matches) {
    const coaches = {};
    matches.forEach(m => {
      const cid = m.coach_id || '__none__';
      const label = m.efb_coaches ? m.efb_coaches.name : (m.coach_id ? m.coach_id : 'Sans coach');
      if (!coaches[cid]) coaches[cid] = { matches: [], label, style: m.efb_coaches ? m.efb_coaches.style : null, formation: m.efb_coaches ? m.efb_coaches.formation : null };
      coaches[cid].matches.push(m);
    });
    return Object.entries(coaches).map(([cid, data]) => ({
      coach_id: cid === '__none__' ? null : cid,
      name: data.label,
      style: data.style,
      formation: data.formation,
      ...this.globalStats(data.matches),
      serie: this.series(data.matches),
    })).sort((a, b) => b.winRate - a.winRate);
  },

  // Meilleur XI — joueurs avec le meilleur taux de victoire (min 3 matchs)
  bestXI(matches) {
    const byPlayer = this.byPlayer(matches);
    const playerWins = {};
    matches.forEach(m => {
      const ps = m.player_stats || [];
      ps.forEach(p => {
        if (!p.player_id) return;
        if (!playerWins[p.player_id]) playerWins[p.player_id] = { wins: 0, total: 0 };
        playerWins[p.player_id].total++;
        if (m.result === 'V') playerWins[p.player_id].wins++;
      });
    });
    return Object.entries(playerWins)
      .filter(([pid, d]) => d.total >= 3)
      .map(([pid, d]) => ({
        player_id: pid,
        winRate: Math.round(d.wins / d.total * 100),
        matchCount: d.total,
        wins: d.wins,
        goals:     (byPlayer.find(p => p.player_id === pid) || {}).goals     || 0,
        assists:   (byPlayer.find(p => p.player_id === pid) || {}).assists   || 0,
        avgRating: (byPlayer.find(p => p.player_id === pid) || {}).avgRating || 0,
      }))
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 11);
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
    icon: `<i class="ti ti-focus-2" style="font-size:24px;color:currentColor"></i>`
  },
  {
    key: 'passing', label: 'Passing',
    stats: ['lowPass', 'loftedPass'],
    icon: `<i class="ti ti-ball-football" style="font-size:24px;color:currentColor"></i>`
  },
  {
    key: 'dribbling', label: 'Dribbling',
    stats: ['ballControl', 'dribbling', 'tightPossession'],
    icon: `<i class="ti ti-brand-vlc" style="font-size:24px;color:currentColor"></i>`
  },
  {
    key: 'dexterity', label: 'Dexterity',
    stats: ['offensiveAwareness', 'acceleration', 'balance'],
    icon: `<i class="ti ti-activity" style="font-size:24px;color:currentColor"></i>`
  },
  {
    key: 'lowerbody', label: 'Lower Body',
    stats: ['speed', 'kickingPower', 'stamina'],
    icon: `<i class="ti ti-shoe" style="font-size:24px;color:currentColor"></i>`
  },
  {
    key: 'aerial', label: 'Aerial',
    stats: ['heading', 'jump', 'physicalContact'],
    icon: `<i class="ti ti-chevrons-up" style="font-size:24px;color:currentColor"></i>`
  },
  {
    key: 'defending', label: 'Defending',
    stats: ['defensiveAwareness', 'trackingBack', 'ballWinning', 'aggression'],
    icon: `<i class="ti ti-shield" style="font-size:24px;color:currentColor"></i>`
  },
  {
    key: 'gk1', label: 'GK 1',
    stats: ['gkAwareness', 'jump'],
    icon: `<i class="ti ti-hand-stop" style="font-size:24px;color:currentColor"></i><sup style="font-size:10px;font-weight:700">1</sup>`
  },
  {
    key: 'gk2', label: 'GK 2',
    stats: ['gkClearing', 'gkReach'],
    icon: `<i class="ti ti-hand-stop" style="font-size:24px;color:currentColor"></i><sup style="font-size:10px;font-weight:700">2</sup>`
  },
  {
    key: 'gk3', label: 'GK 3',
    stats: ['gkCatching', 'gkReflexes'],
    icon: `<i class="ti ti-hand-stop" style="font-size:24px;color:currentColor"></i><sup style="font-size:10px;font-weight:700">3</sup>`
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

// Styles de jeu coach connus en eFootball
const EFB_COACH_STYLES = [
  'Possession Game',
  'Quick Counter',
  'Long Ball Counter',
  'Out Wide',
  'Long Ball',
  'Tiki-Taka',
  'High Pressure',
  'Park the Bus',
];
