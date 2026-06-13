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


// ── FORMATIONS ────────────────────────────────────────────────────────────────
const Formations = {
  getAll() {
    return sbFetch('efb_formations?select=*&order=created_at.asc');
  },
  create(name, slots) {
    return sbFetch('efb_formations', {
      method: 'POST',
      body: JSON.stringify({ name, slots })
    }).then(r => r[0]);
  },
  update(id, name, slots) {
    return sbFetch('efb_formations?id=eq.' + id, {
      method: 'PATCH',
      body: JSON.stringify({ name, slots })
    }).then(r => r[0]);
  },
  delete(id) {
    return sbFetch('efb_formations?id=eq.' + id, {
      method: 'DELETE',
      prefer: 'return=minimal'
    });
  },
  deleteByName(name) {
    return sbFetch('efb_formations?name=eq.' + encodeURIComponent(name), {
      method: 'DELETE',
      prefer: 'return=minimal'
    });
  },
};

// ── APP STATE (sync globale) ──────────────────────────────────────────────────
const AppState = {
  async get(key) {
    var rows = await sbFetch('efb_app_state?key=eq.' + encodeURIComponent(key) + '&select=*');
    return rows && rows[0] ? rows[0].value : null;
  },
  async set(key, value) {
    // Upsert via POST avec onConflict
    return sbFetch('efb_app_state?key=eq.' + encodeURIComponent(key), {
      method: 'PATCH',
      body: JSON.stringify({ value: value, updated_at: new Date().toISOString() }),
      prefer: 'return=minimal',
    }).catch(async function() {
      // Si PATCH échoue (ligne inexistante), on crée
      return sbFetch('efb_app_state', {
        method: 'POST',
        body: JSON.stringify({ key: key, value: value }),
        prefer: 'return=minimal',
      });
    });
  },
  async getAll() {
    var rows = await sbFetch('efb_app_state?select=*');
    var result = {};
    (rows || []).forEach(function(r) { result[r.key] = r.value; });
    return result;
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

// ── Base de coachs intégrée (source: amine250.github.io/efootball-managers) ────
// 64 coachs — triés par date de sortie (plus récent en premier)
const EFB_COACHES_DB = [
  // ── Juin 2026 ──
  { name: 'V. Montella',      releaseDate: '2026-06-11', style: 'Quick Counter',      boosters: ['Acceleration +1', 'Tight Possession +1'],     proficiency: { possessionGame:61, quickCounter:89, longBallCounter:58, outWide:89, longBall:68 }, linkUpPlay: 'Breakthrough Pass B',   linkUpCenterPiece: 'Box-to-Box / CMF',           linkUpKeyMan: 'Goal Poacher / CF' },
  { name: 'J. Nagelsmann',    releaseDate: '2026-06-11', style: 'Long Ball Counter',   boosters: ['Dribbling +1', 'Physical Contact +1'],          proficiency: { possessionGame:62, quickCounter:68, longBallCounter:89, outWide:59, longBall:89 },  linkUpPlay: 'Over-the-Top Pass C',   linkUpCenterPiece: 'Build Up / CB',              linkUpKeyMan: 'Prolific Winger / LWF RWF' },
  { name: 'Ronald Koeman',    releaseDate: '2026-06-11', style: 'Long Ball Counter',   boosters: ['Kicking Power +1', 'Jumping +1'],                proficiency: { possessionGame:60, quickCounter:65, longBallCounter:89, outWide:89, longBall:69 },  linkUpPlay: 'Over-the-Top Pass B',   linkUpCenterPiece: 'Orchestrator / CMF',         linkUpKeyMan: 'Prolific Winger / LWF RWF' },
  { name: 'D. Deschamps',     releaseDate: '2026-06-11', style: 'Possession Game',     boosters: ['Speed +1', 'Ball Control +1'],                   proficiency: { possessionGame:89, quickCounter:68, longBallCounter:89, outWide:59, longBall:63 },  linkUpPlay: 'Breakthrough Pass A',   linkUpCenterPiece: 'Creative Playmaker / AMF',   linkUpKeyMan: 'Goal Poacher / CF' },
  // ── Juin 2026 ──
  { name: 'R. Martinez',      releaseDate: '2026-06-04', style: 'Quick Counter',       boosters: ['Finishing +1', 'Attacking Awareness +1'],        proficiency: { possessionGame:58, quickCounter:90, longBallCounter:70, outWide:64, longBall:89 },  linkUpPlay: 'Diagonal Long Pass B',  linkUpCenterPiece: 'Creative Playmaker / LWF RWF', linkUpKeyMan: 'Attacking Full-back / LB RB' },
  { name: 'Thomas Tuchel',    releaseDate: '2026-06-04', style: 'Possession Game',     boosters: ['Low Pass +1', 'Stamina +1'],                     proficiency: { possessionGame:90, quickCounter:89, longBallCounter:59, outWide:70, longBall:58 },  linkUpPlay: 'Over-the-Top Pass A',   linkUpCenterPiece: 'Orchestrator / DMF',         linkUpKeyMan: 'Goal Poacher / CF' },
  // ── Avril 2026 ──
  { name: 'Johan Cruyff',     releaseDate: '2026-04-23', style: 'Possession Game',     boosters: ['Acceleration +1', 'Balance +1'],                 proficiency: { possessionGame:89, quickCounter:65, longBallCounter:54, outWide:89, longBall:54 },  linkUpPlay: '1-2 Cut-in A',          linkUpCenterPiece: 'Creative Playmaker / LMF RMF', linkUpKeyMan: 'Fox in the Box / CF' },
  // ── Mars 2026 ──
  { name: 'F. Beckenbauer',   releaseDate: '2026-03-12', style: 'Long Ball',           boosters: ['Dribbling +1', 'Defensive Awareness +1'],        proficiency: { possessionGame:65, quickCounter:57, longBallCounter:89, outWide:60, longBall:89 },  linkUpPlay: 'Breakthrough Pass B',   linkUpCenterPiece: 'Box-to-Box / CMF',           linkUpKeyMan: 'Goal Poacher / CF' },
  // ── Février 2026 ──
  { name: 'Cristian Chivu',   releaseDate: '2026-02-19', style: 'Quick Counter',       boosters: ['Speed +1', 'Stamina +1'],                        proficiency: { possessionGame:58, quickCounter:89, longBallCounter:62, outWide:89, longBall:55 },  linkUpPlay: 'Aggressive Centring A', linkUpCenterPiece: 'Cross Specialist / LMF RMF', linkUpKeyMan: 'Fox in the Box / CF' },
  { name: 'Jürgen Klopp',     releaseDate: '2026-02-05', style: 'Possession Game',     boosters: ['Speed +1', 'Aggression +1'],                     proficiency: { possessionGame:89, quickCounter:89, longBallCounter:59, outWide:70, longBall:57 },  linkUpPlay: 'Over-the-Top Pass C',   linkUpCenterPiece: 'Build Up / CB',              linkUpKeyMan: 'Prolific Winger / LWF RWF' },
  { name: 'Niko Kovač',       releaseDate: '2026-02-05', style: 'Long Ball Counter',   boosters: ['Kicking Power +1', 'Tight Possession +1'],       proficiency: { possessionGame:65, quickCounter:63, longBallCounter:89, outWide:89, longBall:56 },  linkUpPlay: 'Over-the-Top Pass A',   linkUpCenterPiece: 'Orchestrator / DMF',         linkUpKeyMan: 'Goal Poacher / CF' },
  // ── Janvier 2026 ──
  { name: 'Xabi Alonso',      releaseDate: '2026-01-08', style: 'Quick Counter',       boosters: ['Ball Control +1', 'Finishing +1'],                proficiency: { possessionGame:71, quickCounter:89, longBallCounter:54, outWide:89, longBall:56 },  linkUpPlay: 'Breakthrough Pass A',   linkUpCenterPiece: 'Creative Playmaker / AMF',   linkUpKeyMan: 'Goal Poacher / CF' },
  // ── Décembre 2025 ──
  { name: 'Mikel Arteta',     releaseDate: '2025-12-18', style: 'Possession Game',     boosters: ['Acceleration +1', 'Set Piece Taking +1'],        proficiency: { possessionGame:89, quickCounter:64, longBallCounter:88, outWide:57, longBall:54 },  linkUpPlay: 'Over-the-Top Pass B',   linkUpCenterPiece: 'Orchestrator / CMF',         linkUpKeyMan: 'Prolific Winger / LWF RWF' },
  { name: 'Ronald Koeman',    releaseDate: '2025-12-04', style: 'Possession Game',     boosters: ['Heading +1', 'Low Pass +1'],                     proficiency: { possessionGame:89, quickCounter:88, longBallCounter:55, outWide:68, longBall:61 },  linkUpPlay: 'Aggressive Centring A', linkUpCenterPiece: 'Cross Specialist / LMF RMF', linkUpKeyMan: 'Fox in the Box / CF' },
  { name: 'Gennaro Gattuso',  releaseDate: '2025-12-04', style: 'Out Wide',            boosters: ['Tackling +1', 'Lofted Pass +1'],                  proficiency: { possessionGame:53, quickCounter:65, longBallCounter:57, outWide:89, longBall:71 },  linkUpPlay: 'Diagonal Long Pass A',  linkUpCenterPiece: 'Creative Playmaker / AMF',   linkUpKeyMan: 'Hole Player / LMF RMF' },
  // ── Novembre 2025 ──
  { name: 'Pep Guardiola',    releaseDate: '2025-11-06', style: 'Possession Game',     boosters: ['Kicking Power +1', 'Aggression +1'],              proficiency: { possessionGame:89, quickCounter:63, longBallCounter:54, outWide:89, longBall:51 },  linkUpPlay: 'Diagonal Long Pass B',  linkUpCenterPiece: 'Creative Playmaker / LWF RWF', linkUpKeyMan: 'Attacking Full-back / LB RB' },
  // ── Octobre 2025 ──
  { name: 'M. Allegri',       releaseDate: '2025-10-23', style: 'Long Ball',           boosters: ['Attacking Awareness +1', 'Ball Control +1'],      proficiency: { possessionGame:58, quickCounter:67, longBallCounter:89, outWide:63, longBall:89 },  linkUpPlay: 'Aggressive Centring A', linkUpCenterPiece: 'Cross Specialist / LMF RMF', linkUpKeyMan: 'Fox in the Box / CF' },
  { name: 'Cesc Fabregas',    releaseDate: '2025-10-09', style: 'Possession Game',     boosters: ['Lofted Pass +1', 'Defensive Engagement +1'],      proficiency: { possessionGame:89, quickCounter:65, longBallCounter:56, outWide:68, longBall:57 },  linkUpPlay: 'Over-the-Top Pass A',   linkUpCenterPiece: 'Orchestrator / DMF',         linkUpKeyMan: 'Goal Poacher / CF' },
  { name: 'Frank Rijkaard',   releaseDate: '2025-10-02', style: 'Quick Counter',       boosters: ['Tight Possession +1', 'Balance +1'],              proficiency: { possessionGame:70, quickCounter:89, longBallCounter:48, outWide:89, longBall:46 },  linkUpPlay: 'Over-the-Top Pass B',   linkUpCenterPiece: 'Orchestrator / CMF',         linkUpKeyMan: 'Prolific Winger / LWF RWF' },
  // ── Septembre 2025 ──
  { name: 'Hansi Flick',      releaseDate: '2025-09-18', style: 'Possession Game',     boosters: ['Dribbling +1', 'Low Pass +1'],                    proficiency: { possessionGame:89, quickCounter:88, longBallCounter:69, outWide:57, longBall:45 },  linkUpPlay: 'Diagonal Long Pass A',  linkUpCenterPiece: 'Creative Playmaker / AMF',   linkUpKeyMan: 'Hole Player / LMF RMF' },
  { name: 'Fabio Capello',    releaseDate: '2025-09-04', style: 'Long Ball',           boosters: ['Defensive Awareness +1', 'Finishing +1'],         proficiency: { possessionGame:46, quickCounter:57, longBallCounter:89, outWide:64, longBall:89 },  linkUpPlay: 'Over-the-Top Pass A',   linkUpCenterPiece: 'Orchestrator / DMF',         linkUpKeyMan: 'Goal Poacher / CF' },
  // ── Août 2025 ──
  { name: 'Ruben Amorim',     releaseDate: '2025-08-14', style: 'Out Wide',            boosters: ['Physical Contact +1', 'Lofted Pass +1'],          proficiency: { possessionGame:62, quickCounter:81, longBallCounter:54, outWide:89, longBall:46 },  linkUpPlay: 'Aggressive Centring A', linkUpCenterPiece: 'Cross Specialist / LMF RMF', linkUpKeyMan: 'Fox in the Box / CF' },
  { name: 'José Mourinho',    releaseDate: '2025-08-14', style: 'Quick Counter',       boosters: ['Physical Contact +1', 'Stamina +1'],              proficiency: { possessionGame:59, quickCounter:89, longBallCounter:62, outWide:68, longBall:80 },  linkUpPlay: 'Diagonal Long Pass A',  linkUpCenterPiece: 'Creative Playmaker / AMF',   linkUpKeyMan: 'Hole Player / LMF RMF' },
  // ── Juillet 2025 ──
  { name: 'R. Martinez',      releaseDate: '2025-07-10', style: 'Long Ball Counter',   boosters: ['Ball Control +1', 'Aggression +1'],               proficiency: { possessionGame:64, quickCounter:46, longBallCounter:89, outWide:80, longBall:53 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  // ── Juin 2025 ──
  { name: 'Okan Buruk',       releaseDate: '2025-06-12', style: 'Out Wide',            boosters: ['Balance +1', 'Lofted Pass +1'],                   proficiency: { possessionGame:55, quickCounter:80, longBallCounter:43, outWide:89, longBall:63 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  // ── Mai 2025 ──
  { name: 'P. Kluivert',      releaseDate: '2025-05-22', style: 'Possession Game',     boosters: ['Low Pass +1', 'Defensive Engagement +1'],         proficiency: { possessionGame:89, quickCounter:80, longBallCounter:64, outWide:51, longBall:48 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  { name: 'Rudi Garcia',      releaseDate: '2025-05-22', style: 'Quick Counter',       boosters: ['Ball Control +1', 'Attacking Awareness +1'],      proficiency: { possessionGame:52, quickCounter:89, longBallCounter:58, outWide:80, longBall:69 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  { name: 'L. Spalletti',     releaseDate: '2025-05-22', style: 'Long Ball Counter',   boosters: ['Defensive Awareness +1', 'Stamina +1'],            proficiency: { possessionGame:82, quickCounter:56, longBallCounter:89, outWide:61, longBall:46 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  // ── Mai 2025 ──
  { name: 'F. Beckenbauer',   releaseDate: '2025-05-15', style: 'Long Ball',           boosters: ['Finishing +1', 'Kicking Power +1'],               proficiency: { possessionGame:53, quickCounter:67, longBallCounter:80, outWide:54, longBall:89 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  // ── Avril 2025 ──
  { name: 'Johan Cruyff',     releaseDate: '2025-04-17', style: 'Possession Game',     boosters: ['Tight Possession +1', 'Jumping +1'],              proficiency: { possessionGame:89, quickCounter:67, longBallCounter:54, outWide:81, longBall:43 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  { name: 'Ståle Solbakken',  releaseDate: '2025-04-10', style: 'Out Wide',            boosters: ['Heading +1', 'Physical Contact +1'],              proficiency: { possessionGame:47, quickCounter:56, longBallCounter:64, outWide:89, longBall:80 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  // ── Mars 2025 ──
  { name: 'G. P. Gasperini',  releaseDate: '2025-03-20', style: 'Quick Counter',       boosters: ['Physical Contact +1'],                            proficiency: { possessionGame:57, quickCounter:88, longBallCounter:88, outWide:52, longBall:41 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  { name: 'Simone Inzaghi',   releaseDate: '2025-03-06', style: 'Long Ball Counter',   boosters: ['Speed +1', 'Finishing +1'],                       proficiency: { possessionGame:60, quickCounter:78, longBallCounter:88, outWide:51, longBall:43 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  // ── Février 2025 ──
  { name: 'Xabi Alonso',      releaseDate: '2025-02-20', style: 'Possession Game',     boosters: ['Acceleration +1'],                                proficiency: { possessionGame:88, quickCounter:88, longBallCounter:46, outWide:59, longBall:42 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  { name: 'Vincent Kompany',  releaseDate: '2025-02-20', style: 'Possession Game',     boosters: ['Acceleration +1', 'Kicking Power +1'],            proficiency: { possessionGame:88, quickCounter:56, longBallCounter:58, outWide:76, longBall:54 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  { name: 'José Mourinho',    releaseDate: '2025-02-13', style: 'Long Ball Counter',   boosters: ['Tackling +1'],                                    proficiency: { possessionGame:49, quickCounter:45, longBallCounter:88, outWide:88, longBall:66 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  // ── Janvier 2025 ──
  { name: 'Ruben Amorim',     releaseDate: '2025-01-16', style: 'Quick Counter',       boosters: ['Speed +1', 'Attacking Awareness +1'],             proficiency: { possessionGame:74, quickCounter:88, longBallCounter:54, outWide:43, longBall:38 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  { name: 'Frank Rijkaard',   releaseDate: '2025-01-09', style: 'Possession Game',     boosters: ['Low Pass +1'],                                    proficiency: { possessionGame:88, quickCounter:57, longBallCounter:88, outWide:68, longBall:35 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  // ── Décembre 2024 ──
  { name: 'Ronald Koeman',    releaseDate: '2024-12-26', style: 'Long Ball Counter',   boosters: ['Ball Control +1', 'Stamina +1'],                  proficiency: { possessionGame:64, quickCounter:56, longBallCounter:88, outWide:72, longBall:45 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  { name: 'Frank Lampard',    releaseDate: '2024-12-05', style: 'Out Wide',            boosters: ['Balance +1'],                                     proficiency: { possessionGame:56, quickCounter:88, longBallCounter:54, outWide:88, longBall:45 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  // ── Novembre 2024 ──
  { name: 'Paulo Fonseca',    releaseDate: '2024-11-28', style: 'Quick Counter',       boosters: ['Physical Contact +1', 'Kicking Power +1'],        proficiency: { possessionGame:36, quickCounter:88, longBallCounter:73, outWide:50, longBall:63 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  { name: 'Hansi Flick',      releaseDate: '2024-11-21', style: 'Possession Game',     boosters: ['Low Pass +1', 'Speed +1'],                        proficiency: { possessionGame:88, quickCounter:75, longBallCounter:45, outWide:64, longBall:31 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  { name: 'Patrick Vieira',   releaseDate: '2024-11-07', style: 'Out Wide',            boosters: ['Tackling +1'],                                    proficiency: { possessionGame:35, quickCounter:67, longBallCounter:35, outWide:88, longBall:88 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  // ── Octobre 2024 ──
  { name: 'Mikel Arteta',     releaseDate: '2024-10-24', style: 'Long Ball Counter',   boosters: ['Acceleration +1', 'Tight Possession +1'],         proficiency: { possessionGame:72, quickCounter:68, longBallCounter:88, outWide:67, longBall:30 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  { name: 'Steven Gerrard',   releaseDate: '2024-10-10', style: 'Possession Game',     boosters: ['Dribbling +1'],                                   proficiency: { possessionGame:88, quickCounter:35, longBallCounter:55, outWide:68, longBall:88 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  // ── Juillet 2024 ──
  { name: 'D. Stojkovic',     releaseDate: '2024-07-25', style: 'Quick Counter',       boosters: ['Kicking Power +1'],                               proficiency: { possessionGame:63, quickCounter:88, longBallCounter:58, outWide:88, longBall:53 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  { name: 'L. de la Fuente',  releaseDate: '2024-07-25', style: 'Possession Game',     boosters: ['Acceleration +1'],                                proficiency: { possessionGame:88, quickCounter:61, longBallCounter:27, outWide:88, longBall:22 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  // ── Juin 2024 ──
  { name: 'L. Scaloni',       releaseDate: '2024-06-13', style: 'Possession Game',     boosters: ['Low Pass +1'],                                    proficiency: { possessionGame:87, quickCounter:86, longBallCounter:55, outWide:38, longBall:37 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  { name: 'D. Deschamps',     releaseDate: '2024-06-13', style: 'Long Ball Counter',   boosters: ['Low Pass +1'],                                    proficiency: { possessionGame:69, quickCounter:62, longBallCounter:88, outWide:75, longBall:67 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  { name: 'O. Henriques',     releaseDate: '2024-06-13', style: 'Quick Counter',       boosters: ['Kicking Power +1'],                               proficiency: { possessionGame:67, quickCounter:87, longBallCounter:52, outWide:45, longBall:86 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  { name: 'R. Martinez',      releaseDate: '2024-06-13', style: 'Long Ball',           boosters: ['Physical Contact +1'],                            proficiency: { possessionGame:72, quickCounter:68, longBallCounter:52, outWide:69, longBall:88 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  { name: 'V. Montella',      releaseDate: '2024-06-13', style: 'Out Wide',            boosters: ['Stamina +1'],                                     proficiency: { possessionGame:64, quickCounter:45, longBallCounter:74, outWide:88, longBall:57 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  { name: 'G. Southgate',     releaseDate: '2024-06-13', style: 'Quick Counter',       boosters: ['Acceleration +1'],                                proficiency: { possessionGame:44, quickCounter:86, longBallCounter:87, outWide:69, longBall:32 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  // ── Avril 2024 ──
  { name: 'Xabi Alonso',      releaseDate: '2024-04-11', style: 'Quick Counter',       boosters: ['Acceleration +1'],                                proficiency: { possessionGame:72, quickCounter:88, longBallCounter:35, outWide:51, longBall:28 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  { name: 'Pep Guardiola',    releaseDate: '2024-04-11', style: 'Possession Game',     boosters: ['Tight Possession +1'],                            proficiency: { possessionGame:88, quickCounter:74, longBallCounter:37, outWide:68, longBall:32 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  // ── Février 2024 ──
  { name: 'Zico',             releaseDate: '2024-02-01', style: 'Possession Game',     boosters: ['Dribbling +1'],                                   proficiency: { possessionGame:83, quickCounter:60, longBallCounter:34, outWide:75, longBall:20 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  // ── Octobre 2023 ──
  { name: 'Simone Inzaghi',   releaseDate: '2023-10-19', style: 'Quick Counter',       boosters: ['Stamina +1'],                                     proficiency: { possessionGame:41, quickCounter:85, longBallCounter:70, outWide:64, longBall:29 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  { name: 'Stefano Pioli',    releaseDate: '2023-10-19', style: 'Quick Counter',       boosters: ['Tackling +1'],                                    proficiency: { possessionGame:51, quickCounter:85, longBallCounter:59, outWide:75, longBall:45 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  { name: 'Thomas Tuchel',    releaseDate: '2023-10-19', style: 'Out Wide',            boosters: ['Physical Contact +1'],                            proficiency: { possessionGame:65, quickCounter:45, longBallCounter:70, outWide:85, longBall:24 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  // ── Octobre 2023 ──
  { name: 'Mikel Arteta',     releaseDate: '2023-10-07', style: 'Possession Game',     boosters: ['Low Pass +1'],                                    proficiency: { possessionGame:85, quickCounter:71, longBallCounter:68, outWide:73, longBall:20 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  { name: 'Erik ten Hag',     releaseDate: '2023-10-07', style: 'Long Ball Counter',   boosters: ['Speed +1'],                                       proficiency: { possessionGame:51, quickCounter:66, longBallCounter:85, outWide:70, longBall:40 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  { name: 'Xavi',             releaseDate: '2023-10-07', style: 'Possession Game',     boosters: ['Ball Control +1'],                                proficiency: { possessionGame:85, quickCounter:70, longBallCounter:18, outWide:42, longBall:25 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  // ── Inconnu ──
  { name: 'Luis A. Roman',    releaseDate: null,         style: 'Possession Game',     boosters: [],                                                 proficiency: { possessionGame:87, quickCounter:72, longBallCounter:27, outWide:68, longBall:34 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
  { name: 'Cristo Valbuena',  releaseDate: null,         style: 'Long Ball Counter',   boosters: [],                                                 proficiency: { possessionGame:66, quickCounter:44, longBallCounter:85, outWide:58, longBall:65 },  linkUpPlay: null,                    linkUpCenterPiece: null,                         linkUpKeyMan: null },
];
