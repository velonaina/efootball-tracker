// ─────────────────────────────────────────────────────────────────────────────
// efb-ui.js — eFootball Tracker · Couche interface
// ─────────────────────────────────────────────────────────────────────────────

// ── État global ───────────────────────────────────────────────────────────────

// ── Authentification ──────────────────────────────────────────────────────────
var EFB_SECRET = 'HARVEL_efb2026';
var EFB_AUTH_KEY = 'efb_auth';

function isAuthenticated() {
  return localStorage.getItem(EFB_AUTH_KEY) === EFB_SECRET;
}

function renderAuthScreen() {
  document.getElementById('app').innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:20px;background:var(--bg)">' +
      '<div style="font-size:32px">&#9917;</div>' +
      '<div style="font-size:18px;font-weight:700;color:#fff">eFootball Tracker</div>' +
      '<div style="font-size:13px;color:var(--muted)">Real Madrid</div>' +
      '<div style="display:flex;flex-direction:column;gap:10px;width:280px;margin-top:12px">' +
        '<input type="password" id="auth-input" placeholder="Mot de passe..." ' +
          'style="padding:10px 14px;border-radius:10px;background:var(--surface2);border:1px solid var(--border);color:var(--text);font-size:14px;outline:none;text-align:center" ' +
          'onkeydown="if(event.key===String.fromCharCode(69,110,116,101,114))checkAuth()">' +
        '<button onclick="checkAuth()" ' +
          'style="padding:10px;border-radius:10px;background:var(--accent);color:#fff;font-size:14px;font-weight:600;cursor:pointer">Accéder</button>' +
        '<div id="auth-error" style="color:var(--red);font-size:12px;text-align:center;display:none">Mot de passe incorrect</div>' +
      '</div>' +
    '</div>';
  setTimeout(function() {
    var inp = document.getElementById('auth-input');
    if (inp) inp.focus();
  }, 100);
}

function checkAuth() {
  var val = document.getElementById('auth-input') ? document.getElementById('auth-input').value.trim() : '';
  if (val === EFB_SECRET) {
    localStorage.setItem(EFB_AUTH_KEY, EFB_SECRET);
    init();
  } else {
    var err = document.getElementById('auth-error');
    if (err) err.style.display = 'block';
    var inp = document.getElementById('auth-input');
    if (inp) { inp.value = ''; inp.focus(); }
  }
}

// ── Sync state ───────────────────────────────────────────────────────────────
var _syncState = 'idle'; // idle | syncing | ok | error
var _lastSyncTime = null;

const State = {
  players: [],
  cards: {},       // { playerId: [cards] }
  builds: {},      // { cardId: [builds] }
  matches: [],
  coaches: [],
  selectedPlayerId: null,
  selectedCardId: null,
  selectedBuildId: null,
  activeTab: 'effectif', // effectif | formation | analyse | matchs | coachs
  activePlayerTab: 'stats', // stats | builds | matchs
  loading: false,
  search: {
    open: false,
    query: '',
    results: { players: [], builds: [], matches: [] },
  },
};

// ── Init ──────────────────────────────────────────────────────────────────────

// ── Synchronisation globale vers Supabase ─────────────────────────────────────
async function syncAllToSupabase() {
  _syncState = 'syncing';
  renderSyncBadge();
  try {
    // Squad 23
    var squad = JSON.parse(localStorage.getItem(SQUAD_STORAGE_KEY) || '[]');
    await AppState.set('squad23', squad);
    // Formation lineup
    var lineup = JSON.parse(localStorage.getItem(FT_STORAGE_KEY) || '{}');
    await AppState.set('ft_lineup', lineup);
    // Instructions
    var instructions = JSON.parse(localStorage.getItem(INSTRUCTIONS_STORAGE_KEY) || '{}');
    await AppState.set('last_instructions', instructions);
    // Coach actif
    var coach = localStorage.getItem(COACH_STORAGE_KEY) || null;
    await AppState.set('active_coach', coach);
    _syncState = 'ok';
    _lastSyncTime = new Date();
    renderSyncBadge();
    showToast('Données synchronisées !', 'success', 2000);
  } catch(e) {
    _syncState = 'error';
    renderSyncBadge();
    showToast('Erreur sync : ' + e.message, 'error');
  }
}

async function syncAllFromSupabase() {
  try {
    var all = await AppState.getAll();
    // Squad 23
    if (all.squad23) {
      localStorage.setItem(SQUAD_STORAGE_KEY, JSON.stringify(all.squad23));
    }
    // Formation lineup
    if (all.ft_lineup) {
      localStorage.setItem(FT_STORAGE_KEY, JSON.stringify(all.ft_lineup));
    }
    // Instructions
    if (all.last_instructions) {
      localStorage.setItem(INSTRUCTIONS_STORAGE_KEY, JSON.stringify(all.last_instructions));
    }
    // Coach actif
    if (all.active_coach) {
      localStorage.setItem(COACH_STORAGE_KEY, all.active_coach);
    }
    _syncState = 'ok';
    _lastSyncTime = new Date();
  } catch(e) {
    _syncState = 'error';
    console.warn('Sync from Supabase échoué:', e);
  }
}

function renderSyncBadge() {
  var badge = document.getElementById('sync-badge');
  if (!badge) return;
  var colors = { idle: 'var(--muted)', syncing: 'var(--amber)', ok: 'var(--green)', error: 'var(--red)' };
  var icons  = { idle: 'ti-cloud', syncing: 'ti-loader-2', ok: 'ti-cloud-check', error: 'ti-cloud-x' };
  var labels = { idle: 'Sync', syncing: 'Sync...', ok: 'Synchronisé', error: 'Erreur sync' };
  var spin = _syncState === 'syncing' ? ';animation:spin 1s linear infinite' : '';
  var timeStr = _lastSyncTime ? ' · ' + _lastSyncTime.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'}) : '';
  badge.innerHTML = '<i class="ti ' + icons[_syncState] + '" style="font-size:14px;color:' + colors[_syncState] + spin + '"></i>' +
    '<span style="font-size:11px;color:' + colors[_syncState] + '">' + labels[_syncState] + timeStr + '</span>';
}

async function init() {
  if (!isAuthenticated()) { renderAuthScreen(); return; }
  renderSkeleton();
  loadAllCustomFormations();
  syncFormationsFromSupabase();
  await syncAllFromSupabase();
  try {
    State.players = await Players.getAll();
    State.matches = await Matches.getAll();
    State.coaches = await Coaches.getAll();
    // Charger les cartes de TOUS les joueurs
    const allCards = await Cards.getAll();
    allCards.forEach(c => {
      if (!State.cards[c.player_id]) State.cards[c.player_id] = [];
      if (!State.cards[c.player_id].find(x => x.id === c.id)) {
        State.cards[c.player_id].push(c);
      }
    });
    // Charger les builds de TOUS les joueurs
    const allBuilds = await Builds.getAll();
    allBuilds.forEach(b => {
      if (!State.builds[b.card_id]) State.builds[b.card_id] = [];
      if (!State.builds[b.card_id].find(x => x.id === b.id)) {
        State.builds[b.card_id].push(b);
      }
    });
    // Sélectionner le premier joueur
    if (State.players.length > 0) {
      await selectPlayer(State.players[0].id);
    }
    render();
  } catch (e) {
    showError('Erreur de connexion Supabase : ' + e.message);
  }
}

async function selectPlayer(playerId) {
  State.selectedPlayerId = playerId;
  if (!State.cards[playerId]) {
    State.cards[playerId] = await Cards.getByPlayer(playerId);
  }
  const cards = State.cards[playerId];
  if (cards.length > 0) {
    await selectCard(cards[0].id);
  } else {
    State.selectedCardId = null;
    State.selectedBuildId = null;
  }
}

async function selectCard(cardId) {
  State.selectedCardId = cardId;
  if (!State.builds[cardId]) {
    State.builds[cardId] = await Builds.getByCard(cardId);
  }
  const builds = State.builds[cardId];
  if (builds.length > 0) {
    State.selectedBuildId = builds[0].id;
  } else {
    State.selectedBuildId = null;
  }
}

// ── Système de toasts ─────────────────────────────────────────────────────────
var _toastTimeout = null;

function showToast(msg, type, duration) {
  type = type || 'info'; // info | success | error | warning
  duration = duration || 3000;
  var existing = document.getElementById('efb-toast');
  if (existing) existing.remove();
  if (_toastTimeout) clearTimeout(_toastTimeout);
  var colors = {
    success: 'var(--green)',
    error: 'var(--red)',
    warning: 'var(--amber)',
    info: 'var(--accent)',
  };
  var icons = {
    success: 'ti-circle-check',
    error: 'ti-circle-x',
    warning: 'ti-alert-triangle',
    info: 'ti-info-circle',
  };
  var toast = document.createElement('div');
  toast.id = 'efb-toast';
  toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;background:var(--surface2);border:1px solid ' + colors[type] + ';border-radius:10px;padding:10px 18px;display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--text);box-shadow:0 4px 20px rgba(0,0,0,0.5);max-width:360px;animation:toastIn 0.2s ease';
  toast.innerHTML = '<i class="ti ' + icons[type] + '" style="color:' + colors[type] + ';font-size:16px;flex-shrink:0"></i><span>' + msg + '</span>';
  document.body.appendChild(toast);
  _toastTimeout = setTimeout(function() {
    toast.style.animation = 'toastOut 0.2s ease forwards';
    setTimeout(function() { if (toast.parentNode) toast.remove(); }, 200);
  }, duration);
  if (!document.getElementById('efb-toast-style')) {
    var style = document.createElement('style');
    style.id = 'efb-toast-style';
    style.textContent = '@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}@keyframes toastOut{from{opacity:1}to{opacity:0;transform:translateX(-50%) translateY(10px)}}';
    document.head.appendChild(style);
  }
}

function showConfirm(msg, onConfirm) {
  var existing = document.getElementById('efb-confirm');
  if (existing) existing.remove();
  var overlay = document.createElement('div');
  overlay.id = 'efb-confirm';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:20px 24px;max-width:320px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.5)">' +
    '<div style="font-size:13px;color:var(--text);line-height:1.5;margin-bottom:16px">' + msg + '</div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end">' +
      '<button class="btn-sm btn-ghost" onclick="document.getElementById(' + String.fromCharCode(39) + 'efb-confirm' + String.fromCharCode(39) + ').remove()">Annuler</button>' +
      '<button class="btn-sm btn-primary" id="efb-confirm-ok">Confirmer</button>' +
    '</div>' +
  '</div>';
  document.body.appendChild(overlay);
  document.getElementById('efb-confirm-ok').onclick = function() {
    overlay.remove();
    onConfirm();
  };
}

// ── Render principal ──────────────────────────────────────────────────────────
function render() {
  document.getElementById('app').innerHTML = `
    ${renderTopbar()}
    ${renderNav()}
    <div class="app-body">
      ${State.activeTab === 'effectif'  ? renderEffectif() : ''}
      ${State.activeTab === 'formation' ? renderFormationTab() : ''}
      ${State.activeTab === 'analyse'   ? renderAnalyse() : ''}
      ${State.activeTab === 'matchs'    ? renderMatchsGlobal() : ''}
      ${State.activeTab === 'coachs'    ? renderCoachs() : ''}
    </div>
    ${renderModals()}
  `;
  bindEvents();
}

// ── Topbar ────────────────────────────────────────────────────────────────────
function renderTopbar() {
  return `
    <header class="topbar">
      <div class="topbar-left">
        <span class="topbar-logo">⚽</span>
        <span class="topbar-title">eFootball Tracker</span>
      </div>
      <div class="topbar-search-wrap">
        <i class="ti ti-search topbar-search-icon"></i>
        <input
          type="text"
          class="topbar-search-input"
          placeholder="Rechercher joueur, build, match…"
          value="${State.search.query}"
          onclick="openSearchOverlay()"
          onkeydown="if(event.key==='Enter'||event.key==='ArrowDown'){openSearchOverlay();}"
          readonly
        >
        ${State.search.query ? `<button class="topbar-search-clear" onclick="clearSearch(event)"><i class="ti ti-x"></i></button>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <button id="sync-badge" onclick="syncAllToSupabase()" title="Synchroniser toutes les données"
          style="display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;background:var(--surface3);border:0.5px solid var(--border);cursor:pointer">
          <i class="ti ti-cloud" style="font-size:14px;color:var(--muted)"></i>
          <span style="font-size:11px;color:var(--muted)">Sync</span>
        </button>
        <span class="topbar-squad">Real Madrid</span>
      </div>
    </header>
    ${State.search.open ? renderSearchOverlay() : ''}
  `;
}

// ── Navigation ────────────────────────────────────────────────────────────────
function renderNav() {
  const tabs = [
    { id: 'effectif',  label: 'Effectif',  icon: 'ti-users' },
    { id: 'formation', label: 'Formation', icon: 'ti-layout-soccer-field' },
    { id: 'analyse',   label: 'Analyse',   icon: 'ti-chart-bar' },
    { id: 'matchs',    label: 'Matchs',    icon: 'ti-ball-football' },
    { id: 'coachs',    label: 'Coachs',    icon: 'ti-whistle' },
  ];
  return `
    <nav class="main-nav">
      ${tabs.map(t => `
        <button class="nav-tab ${State.activeTab === t.id ? 'active' : ''}"
                onclick="setTab('${t.id}')">
          <i class="ti ${t.icon}"></i>
          <span>${t.label}</span>
        </button>
      `).join('')}
    </nav>
  `;
}

// ── Recherche globale ─────────────────────────────────────────────────────────
function openSearchOverlay() {
  State.search.open = true;
  render();
  setTimeout(function() {
    var inp = document.getElementById('search-panel-input');
    if (inp) inp.focus();
  }, 30);
}

function closeSearchOverlay() {
  State.search.open = false;
  render();
}

function clearSearch(e) {
  if (e) e.stopPropagation();
  State.search.query = '';
  State.search.results = { players: [], builds: [], matches: [] };
  State.search.open = false;
  render();
}

function onSearchInput(val) {
  State.search.query = val;
  if (!val.trim()) {
    State.search.results = { players: [], builds: [], matches: [] };
    renderSearchResults();
    return;
  }
  var q = val.toLowerCase().trim();
  // Joueurs
  var players = State.players.filter(function(p) {
    var cards = State.cards[p.id] || [];
    var card = cards[0];
    return (
      (p.name || '').toLowerCase().includes(q) ||
      (card && (card.playing_style || '').toLowerCase().includes(q)) ||
      (card && (card.card_type || '').toLowerCase().includes(q))
    );
  });
  // Builds
  var builds = [];
  Object.values(State.builds).forEach(function(arr) {
    arr.forEach(function(b) {
      var playerName = '';
      // Chercher le nom du joueur via la carte
      Object.entries(State.cards).forEach(function(entry) {
        var pid = entry[0]; var pcards = entry[1];
        if (pcards.find(function(c) { return c.id === b.card_id; })) {
          var p = State.players.find(function(pl) { return pl.id === pid; });
          if (p) playerName = p.name;
        }
      });
      if (
        (b.name || '').toLowerCase().includes(q) ||
        playerName.toLowerCase().includes(q)
      ) {
        builds.push({ build: b, playerName: playerName });
      }
    });
  });
  // Matchs
  var matches = State.matches.filter(function(m) {
    var dateStr = m.match_date || (m.played_at ? m.played_at.slice(0,10) : '');
    var resultLabel = m.result === 'V' ? 'victoire' : m.result === 'N' ? 'nul' : 'défaite';
    return (
      (m.opp_name || '').toLowerCase().includes(q) ||
      (m.rank || '').toLowerCase().includes(q) ||
      dateStr.includes(q) ||
      resultLabel.includes(q)
    );
  });
  State.search.results = { players: players, builds: builds, matches: matches };
  renderSearchResults();
}

function renderSearchResults() {
  var container = document.getElementById('search-results-body');
  if (!container) return;
  container.innerHTML = buildSearchResultsHTML();
}

function buildSearchResultsHTML() {
  var q = State.search.query.trim();
  if (!q) {
    return '<div class="search-hint">Tapez pour rechercher parmi vos joueurs,<br>builds et matchs enregistrés.</div>';
  }
  var r = State.search.results;
  var total = r.players.length + r.builds.length + r.matches.length;
  if (total === 0) {
    return '<div class="search-empty"><i class="ti ti-mood-empty" style="font-size:24px;margin-bottom:8px;display:block"></i>Aucun résultat pour "<strong>' + q + '</strong>"</div>';
  }
  var html = '';
  if (r.players.length > 0) {
    html += '<div class="search-group"><div class="search-group-title"><i class="ti ti-users" style="margin-right:4px"></i>Joueurs</div>';
    r.players.forEach(function(p) {
      var cards = State.cards[p.id] || [];
      var card = cards[0];
      var sub = card ? [(card.playing_style || ''), (card.card_type || '')].filter(Boolean).join(' · ') : 'Aucune carte';
      var q2 = String.fromCharCode(39);
      html += '<div class="search-result-item" onclick="navigateToPlayer(' + q2 + p.id + q2 + ')">' +
        '<div class="search-result-icon player"><i class="ti ti-user"></i></div>' +
        '<div class="search-result-body">' +
          '<div class="search-result-name">' + p.name + '</div>' +
          '<div class="search-result-sub">' + sub + '</div>' +
        '</div>' +
        (card ? '<span class="search-result-badge ' + (card.card_type === 'Trending' ? 'loss' : card.card_type === 'Epic' ? 'draw' : 'win') + '">' + (card.card_type || '—') + '</span>' : '') +
      '</div>';
    });
    html += '</div>';
  }
  if (r.builds.length > 0) {
    html += '<div class="search-group"><div class="search-group-title"><i class="ti ti-adjustments" style="margin-right:4px"></i>Builds</div>';
    r.builds.forEach(function(item) {
      var b = item.build;
      var q2 = String.fromCharCode(39);
      var pts = b.points_used || 0;
      html += '<div class="search-result-item" onclick="navigateToBuild(' + q2 + b.id + q2 + ')">' +
        '<div class="search-result-icon build"><i class="ti ti-sliders"></i></div>' +
        '<div class="search-result-body">' +
          '<div class="search-result-name">' + (b.name || 'Build sans nom') + '</div>' +
          '<div class="search-result-sub">' + (item.playerName || '—') + ' · ' + pts + ' pts</div>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';
  }
  if (r.matches.length > 0) {
    html += '<div class="search-group"><div class="search-group-title"><i class="ti ti-ball-football" style="margin-right:4px"></i>Matchs</div>';
    r.matches.forEach(function(m) {
      var q2 = String.fromCharCode(39);
      var resClass = m.result === 'V' ? 'win' : m.result === 'N' ? 'draw' : 'loss';
      var resLabel = m.result === 'V' ? 'Victoire' : m.result === 'N' ? 'Nul' : 'Défaite';
      var score = (m.score_for || 0) + ' - ' + (m.score_against || 0);
      var date = m.match_date || (m.played_at ? m.played_at.slice(0,10) : '');
      var sub = [score, m.rank || '', date].filter(Boolean).join(' · ');
      html += '<div class="search-result-item" onclick="navigateToMatch(' + q2 + m.id + q2 + ')">' +
        '<div class="search-result-icon match ' + resClass + '">' +
          (m.result === 'V' ? '<i class="ti ti-trophy"></i>' : m.result === 'N' ? '<i class="ti ti-minus"></i>' : '<i class="ti ti-x"></i>') +
        '</div>' +
        '<div class="search-result-body">' +
          '<div class="search-result-name">vs ' + (m.opp_name || 'Adversaire inconnu') + '</div>' +
          '<div class="search-result-sub">' + sub + '</div>' +
        '</div>' +
        '<span class="search-result-badge ' + resClass + '">' + resLabel + '</span>' +
      '</div>';
    });
    html += '</div>';
  }
  return html;
}

function renderSearchOverlay() {
  return '<div class="search-overlay" id="search-overlay" onclick="onSearchOverlayClick(event)">' +
    '<div class="search-panel" onclick="event.stopPropagation()">' +
      '<div class="search-panel-input-wrap">' +
        '<i class="ti ti-search"></i>' +
        '<input id="search-panel-input" class="search-panel-input" type="text" placeholder="Rechercher joueur, build, match…" ' +
          'value="' + (State.search.query || '') + '" ' +
          'oninput="onSearchInput(this.value)" ' +
          'onkeydown="onSearchKeydown(event)">' +
        '<span class="search-kbd" onclick="closeSearchOverlay()">Esc</span>' +
      '</div>' +
      '<div class="search-results" id="search-results-body">' +
        buildSearchResultsHTML() +
      '</div>' +
    '</div>' +
  '</div>';
}

function onSearchOverlayClick(e) {
  if (e.target.id === 'search-overlay') closeSearchOverlay();
}

function onSearchKeydown(e) {
  if (e.key === 'Escape') closeSearchOverlay();
}

async function navigateToPlayer(playerId) {
  closeSearchOverlay();
  State.activeTab = 'effectif';
  await selectPlayer(playerId);
  render();
}

async function navigateToBuild(buildId) {
  closeSearchOverlay();
  State.activeTab = 'effectif';
  State.activePlayerTab = 'builds';
  // Trouver la carte et le joueur
  var foundCardId = null;
  var foundPlayerId = null;
  Object.entries(State.cards).forEach(function(entry) {
    var pid = entry[0]; var pcards = entry[1];
    pcards.forEach(function(c) {
      var builds = State.builds[c.id] || [];
      if (builds.find(function(b) { return b.id === buildId; })) {
        foundCardId = c.id;
        foundPlayerId = pid;
      }
    });
  });
  if (foundPlayerId) {
    State.selectedPlayerId = foundPlayerId;
    State.selectedCardId = foundCardId;
    State.selectedBuildId = buildId;
  }
  render();
}

function navigateToMatch(matchId) {
  closeSearchOverlay();
  State.activeTab = 'matchs';
  State.search.highlightMatchId = matchId;
  render();
  // Highlight temporaire
  setTimeout(function() {
    var el = document.getElementById('match-row-' + matchId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'background 0.3s';
      el.style.background = 'var(--accent-dim)';
      setTimeout(function() { el.style.background = ''; }, 1500);
    }
    State.search.highlightMatchId = null;
  }, 80);
}

// ── Onglet Formation ──────────────────────────────────────────────────────────
var LINEUP_STORAGE_KEY = 'efb_last_lineup';
var SQUAD_STORAGE_KEY = 'efb_squad_23';
var _ftFormation = '';        // formation sélectionnée
var _ftTitulaires = [];       // [{player_id, card_id, build_id, slot_idx}] 11 max
var _ftRemplacants = [];      // [{player_id, card_id, build_id}] 12 max
var _ftSelectedSlot = null;   // slot terrain sélectionné (idx)
var _ftMode = 'terrain';      // 'terrain' | 'liste'
var FT_STORAGE_KEY = 'efb_ft_lineup';

function ftLoad() {
  loadSquad23();
  loadAllCustomFormations();
  try {
    var saved = JSON.parse(localStorage.getItem(FT_STORAGE_KEY) || 'null');
    if (saved) {
      var allPids = State.players.map(function(p) { return p.id; });
      _ftFormation = saved.formation || '';
      _ftTitulaires = (saved.titulaires || []).filter(function(s) { return !s.player_id || allPids.includes(s.player_id); });
      _ftRemplacants = (saved.remplacants || []).filter(function(s) { return allPids.includes(s.player_id); });
      return;
    }
  } catch(e) {}
  // Initialiser depuis Squad23
  _ftFormation = '';
  _ftTitulaires = Array(11).fill(null).map(function(_, i) { return { slot_idx: i, player_id: null }; });
  _ftRemplacants = [];
  // Pré-remplir depuis squad23 si disponible
  if (_squad23.length > 0) {
    _squad23.slice(0, 11).forEach(function(s, i) {
      _ftTitulaires[i] = { slot_idx: i, player_id: s.player_id, card_id: s.card_id, build_id: s.build_id };
    });
    _ftRemplacants = _squad23.slice(11).map(function(s) {
      return { player_id: s.player_id, card_id: s.card_id, build_id: s.build_id };
    });
  }
}

function ftSave() {
  try {
    localStorage.setItem(FT_STORAGE_KEY, JSON.stringify({
      formation: _ftFormation,
      titulaires: _ftTitulaires,
      remplacants: _ftRemplacants,
    }));
    // Synchroniser avec LINEUP_STORAGE_KEY pour que le modal match en profite
    var validTitus = _ftTitulaires.filter(function(t) { return t && t.player_id; });
    localStorage.setItem(LINEUP_STORAGE_KEY, JSON.stringify({
      titulaires: validTitus,
      remplacants: _ftRemplacants,
    }));
  } catch(e) {}
}

function renderFormationTab() {
  ftLoad();
  var q = String.fromCharCode(39);
  var slots = _ftFormation ? buildPitchSlots(_ftFormation) : null;
  var hasPitch = !!(slots && slots.length === 11);

  // Header
  var html = '<div class="ft-layout">';

  // Colonne gauche : terrain
  html += '<div class="ft-pitch-col">';
  html += '<div class="ft-toolbar">';
  html += '<div style="display:flex;gap:6px;align-items:center;flex:1">';
  html += '<input type="text" id="ft-formation-input" class="form-input form-input-sm" style="width:90px" placeholder="4-3-3" value="' + _ftFormation + '" oninput="ftOnFormationInput(this.value)">';
  html += '<button class="btn-sm btn-ghost" onclick="ftOpenPicker()" title="Choisir"><i class="ti ti-ball-football"></i></button>';
  html += '</div>';
  html += '<div style="display:flex;gap:4px">';
  html += '<button class="btn-sm ' + (_ftMode === 'terrain' ? 'btn-primary' : 'btn-ghost') + '" onclick="ftSetMode(' + q + 'terrain' + q + ')"><i class="ti ti-layout-soccer-field"></i> Terrain</button>';
  html += '<button class="btn-sm ' + (_ftMode === 'liste' ? 'btn-primary' : 'btn-ghost') + '" onclick="ftSetMode(' + q + 'liste' + q + ')"><i class="ti ti-list"></i> Liste</button>';
  html += '</div>';
  html += '</div>';

  if (_ftMode === 'terrain') {
    if (hasPitch) {
      html += '<div class="pitch-formation-label">' + _ftFormation + '</div>';
      html += renderFtPitchSVG(slots);
      html += '<div class="pitch-legend">' +
        '<span class="pitch-legend-item"><span class="pitch-legend-dot" style="border-color:#60a5fa"></span>Titulaire — glisse pour repositionner</span>' +
        '<span class="pitch-legend-item"><span class="pitch-legend-dot" style="border-color:var(--border);background:rgba(255,255,255,0.04)"></span>Poste vide</span>' +
      '</div>';
      setTimeout(bindFtPitchDrag, 60);
    } else {
      html += '<div class="pitch-placeholder">' +
        '<i class="ti ti-ball-football" style="font-size:36px;color:var(--border)"></i>' +
        '<p>Entre une formation<br>pour voir le terrain</p>' +
      '</div>';
    }
  } else {
    html += renderFtListeView();
  }

  html += '</div>'; // ft-pitch-col

  // Séparateur redimensionnable
  html += '<div class="ft-divider" id="ft-divider" onmousedown="ftDividerStart(event)"></div>';

  // Colonne droite : joueurs disponibles + slot sélectionné
  html += '<div class="ft-right-col">';
  html += '<div class="ft-right-top" id="ft-slot-panel">' + renderFtSlotPanel() + '</div>';
  html += '<div class="ft-hdivider" id="ft-hdivider" onmousedown="ftHDividerStart(event)"></div>';
  html += '<div class="ft-right-bottom">' + renderFtBench() + '</div>';
  html += '</div>';

  html += '</div>'; // ft-layout
  return html;
}

function renderFtPitchSVG(slots) {
  var q = String.fromCharCode(39);
  var W = 200; var H = 310;

  var nodes = slots.map(function(slot, i) {
    var titu = _ftTitulaires[i];
    var cx = Math.round(slot.left / 100 * W);
    var cy = Math.round(slot.top / 100 * H);
    var hasPlayer = titu && titu.player_id;
    var player = hasPlayer ? State.players.find(function(p) { return p.id === titu.player_id; }) : null;
    var name = player ? player.name.split(' ').pop() : '';
    var isSelected = _ftSelectedSlot === i;
    var swapMode = _ftSelectedSlot !== null && _ftSelectedSlot !== i; // un autre slot est sélectionné

    if (!hasPlayer) {
      // Poste vide — cible possible si un joueur est sélectionné
      var emptyFill = swapMode ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)';
      var emptyStroke = isSelected ? '#f59e0b' : (swapMode ? '#f59e0b' : 'rgba(255,255,255,0.2)');
      var emptyStrokeW = swapMode ? '1.5' : '1';
      return '<g onclick="ftSelectSlot(' + i + ')" style="cursor:pointer">' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="15" fill="' + emptyFill + '" stroke="' + emptyStroke + '" stroke-width="' + emptyStrokeW + '" stroke-dasharray="3,2"/>' +
        '<text x="' + cx + '" y="' + (cy+4) + '" text-anchor="middle" font-size="8" fill="rgba(255,255,255,0.3)">' + slot.label + '</text>' +
      '</g>';
    }

    // Joueur présent
    var fill = isSelected ? '#2a1f00' : (swapMode ? '#1a2a3a' : '#1e3a5f');
    var stroke = isSelected ? '#f59e0b' : (swapMode ? '#60a5fa' : '#60a5fa');
    var strokeW = isSelected ? '2.5' : '1.5';
    // Halo d'échange sur les cibles
    var halo = swapMode && hasPlayer ? '<circle cx=\"' + cx + '\" cy=\"' + cy + '\" r=\"18\" fill=\"none\" stroke=\"#f59e0b\" stroke-width=\"1\" stroke-dasharray=\"3,2\" opacity=\"0.5\"/>' : '';
    var posLabel = titu.position_label || slot.label;

    return '<g class=\"ft-draggable-node\" data-slot=\"' + i + '\" onclick=\"ftSelectSlot(' + i + ')\" style=\"cursor:grab\">' +
      halo +
      '<circle cx=\"' + cx + '\" cy=\"' + cy + '\" r=\"15\" fill=\"' + fill + '\" stroke=\"' + stroke + '\" stroke-width=\"' + strokeW + '\"/>' +
      (isSelected ? '<circle cx=\"' + cx + '\" cy=\"' + cy + '\" r=\"19\" fill=\"none\" stroke=\"#f59e0b\" stroke-width=\"1.5\" opacity=\"0.6\"/>' : '') +
      '<text x=\"' + cx + '\" y=\"' + (cy+3) + '\" text-anchor=\"middle\" font-size=\"8\" font-weight=\"700\" fill=\"#fff\">' + posLabel + '</text>' +
      '<text x=\"' + cx + '\" y=\"' + (cy+24) + '\" text-anchor=\"middle\" font-size=\"7.5\" fill=\"' + (isSelected ? '#f59e0b' : '#e2e8f0') + '\" font-weight=\"' + (isSelected ? '700' : '500') + '\">' + name + '</text>' +
    '</g>';
  }).join('');

  return '<svg id="ft-pitch-svg" viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;border-radius:8px;max-height:calc(100vh - 200px)">' +
    '<rect x="0" y="0" width="' + W + '" height="' + H + '" rx="8" fill="#1a3a1a"/>' +
    '<rect x="8" y="8" width="' + (W-16) + '" height="' + (H-16) + '" rx="4" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>' +
    '<line x1="8" y1="' + (H/2) + '" x2="' + (W-8) + '" y2="' + (H/2) + '" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>' +
    '<circle cx="' + (W/2) + '" cy="' + (H/2) + '" r="26" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>' +
    '<rect x="' + (W/2-28) + '" y="8" width="56" height="32" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>' +
    '<rect x="' + (W/2-28) + '" y="' + (H-40) + '" width="56" height="32" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>' +
    nodes +
  '</svg>';
}

function renderFtListeView() {
  var q = String.fromCharCode(39);
  var html = '<div class="ft-liste">';

  html += '<div class="ft-liste-section">';
  html += '<div class="ft-liste-title">Titulaires (' + _ftTitulaires.filter(function(t) { return t && t.player_id; }).length + '/11)</div>';
  _ftTitulaires.forEach(function(titu, i) {
    var slots = _ftFormation ? buildPitchSlots(_ftFormation) : null;
    var posLabel = slots && slots[i] ? slots[i].label : (i + 1);
    var player = titu && titu.player_id ? State.players.find(function(p) { return p.id === titu.player_id; }) : null;
    var isSelected = _ftSelectedSlot === i;
    html += '<div class="ft-liste-row' + (isSelected ? ' selected' : '') + '" onclick="ftSelectSlot(' + i + ')">' +
      '<span class="ft-liste-pos">' + posLabel + '</span>' +
      (player
        ? '<span class="ft-liste-name">' + player.name + '</span>' +
          '<button class="btn-icon-xs" onclick="ftRemoveFromSlot(event,' + i + ')"><i class="ti ti-x"></i></button>'
        : '<span class="ft-liste-empty">— vide —</span>') +
    '</div>';
  });
  html += '</div>';

  html += '<div class="ft-liste-section" style="margin-top:10px">';
  html += '<div class="ft-liste-title">Remplaçants (' + _ftRemplacants.length + '/12)</div>';
  _ftRemplacants.forEach(function(remp, i) {
    var player = State.players.find(function(p) { return p.id === remp.player_id; });
    html += '<div class="ft-liste-row">' +
      '<span class="ft-liste-pos" style="color:var(--muted)">' + (i+1) + '</span>' +
      '<span class="ft-liste-name">' + (player ? player.name : '?') + '</span>' +
      '<button class="btn-icon-xs" onclick="ftRemoveRemplacant(event,' + i + ')"><i class="ti ti-x"></i></button>' +
    '</div>';
  });
  html += '</div>';

  html += '</div>';
  return html;
}

function renderFtSlotPanel() {
  var q = String.fromCharCode(39);
  if (_ftSelectedSlot === null) {
    return '<div class="ft-slot-hint"><i class="ti ti-click" style="font-size:20px;color:var(--muted)"></i><p>Clique un poste sur le terrain<br>pour assigner un joueur</p></div>';
  }
  var slots = _ftFormation ? buildPitchSlots(_ftFormation) : null;
  var posLabel = slots && slots[_ftSelectedSlot] ? slots[_ftSelectedSlot].label : ('Poste ' + (_ftSelectedSlot + 1));
  var titu = _ftTitulaires[_ftSelectedSlot];
  var player = titu && titu.player_id ? State.players.find(function(p) { return p.id === titu.player_id; }) : null;

  var html = '<div class="ft-slot-header">' +
    '<span class="ft-slot-pos-badge">' + posLabel + '</span>' +
    '<span class="ft-slot-title">' + (player ? player.name : 'Poste vide') + '</span>' +
    (player ? '<button class="btn-icon-xs" onclick="ftRemoveFromSlot(null,' + _ftSelectedSlot + ')"><i class="ti ti-x"></i></button>' : '') +
  '</div>';

  if (player) {
    html += '<div style="font-size:11px;color:var(--amber);padding:6px 0 8px;display:flex;align-items:center;gap:6px">' +
      '<i class="ti ti-arrows-exchange"></i>' +
      '<span>Clique un autre poste pour échanger, ou un poste vide pour déplacer</span>' +
    '</div>';
  }

  // Liste joueurs disponibles pour ce poste (ni titulaires ni remplaçants)
  var usedPids = _ftTitulaires.filter(function(t) { return t && t.player_id; }).map(function(t) { return t.player_id; });
  var rempPids = _ftRemplacants.map(function(r) { return r.player_id; });

  // Joueurs du banc en priorité
  var benchPlayers = _ftRemplacants.map(function(r) {
    return State.players.find(function(p) { return p.id === r.player_id; });
  }).filter(Boolean);

  // Joueurs ni titulaires ni remplaçants
  var available = State.players.filter(function(p) {
    return !usedPids.includes(p.id) && !rempPids.includes(p.id) && (State.cards[p.id] || []).length > 0;
  });

  html += '<div class="ft-player-picker">';

  // Joueurs du banc en premier (avec badge banc)
  if (benchPlayers.length > 0) {
    html += '<div style="font-size:10px;color:var(--muted);padding:4px 6px 2px;text-transform:uppercase;letter-spacing:.5px">Du banc</div>';
    benchPlayers.forEach(function(p) {
      var cards = State.cards[p.id] || [];
      var card = cards[0];
      var cardType = card ? (card.card_type || '') : '';
      html += '<div class="ft-player-pick-row" onclick="ftAssignToSlot(' + q + p.id + q + ')" style="border-left:2px solid var(--green)">' +
        '<span class="ft-player-pick-name">' + p.name + '</span>' +
        (cardType ? '<span class="ft-player-pick-type">' + cardType + '</span>' : '') +
        '<span style="font-size:9px;color:var(--green)">Banc</span>' +
      '</div>';
    });
  }

  // Autres joueurs disponibles
  if (available.length > 0) {
    html += '<div style="font-size:10px;color:var(--muted);padding:6px 6px 2px;text-transform:uppercase;letter-spacing:.5px">Autres joueurs</div>';
    available.forEach(function(p) {
      var cards = State.cards[p.id] || [];
      var card = cards[0];
      var cardType = card ? (card.card_type || '') : '';
      html += '<div class="ft-player-pick-row" onclick="ftAssignToSlot(' + q + p.id + q + ')">' +
        '<span class="ft-player-pick-name">' + p.name + '</span>' +
        (cardType ? '<span class="ft-player-pick-type">' + cardType + '</span>' : '') +
      '</div>';
    });
  }

  if (benchPlayers.length === 0 && available.length === 0) {
    html += '<div style="font-size:11px;color:var(--muted);padding:8px 0">Tous les joueurs sont assignés</div>';
  }

  html += '</div>';
  return html;
}

function renderFtBench() {
  var q = String.fromCharCode(39);
  var usedPids = _ftTitulaires.filter(function(t) { return t && t.player_id; }).map(function(t) { return t.player_id; });
  var rempPids = _ftRemplacants.map(function(r) { return r.player_id; });

  var html = '<div class="ft-bench-header">' +
    '<span class="ft-bench-title"><i class="ti ti-armchair"></i> Banc (' + _ftRemplacants.length + '/12)</span>' +
    '<button class="btn-sm btn-ghost" onclick="ftSaveAndApply()" style="font-size:11px"><i class="ti ti-device-floppy"></i> Sauvegarder</button>' +
  '</div>';

  var available = State.players.filter(function(p) {
    return !usedPids.includes(p.id) && !rempPids.includes(p.id) && (State.cards[p.id] || []).length > 0;
  });

  // Remplaçants actuels
  if (_ftRemplacants.length > 0) {
    html += '<div class="ft-bench-list">';
    _ftRemplacants.forEach(function(remp, i) {
      var player = State.players.find(function(p) { return p.id === remp.player_id; });
      html += '<div class="ft-bench-row">' +
        '<span class="ft-bench-name">' + (player ? player.name : '?') + '</span>' +
        '<button class="btn-icon-xs" onclick="ftRemoveRemplacant(event,' + i + ')"><i class="ti ti-x"></i></button>' +
      '</div>';
    });
    html += '</div>';
  }

  // Joueurs disponibles à ajouter au banc
  if (available.length > 0 && _ftRemplacants.length < 12) {
    html += '<div class="ft-bench-available">';
    html += '<div style="font-size:10px;color:var(--muted);margin-bottom:4px">Ajouter au banc :</div>';
    available.forEach(function(p) {
      html += '<div class="ft-bench-add-row" onclick="ftAddToBench(' + q + p.id + q + ')">' +
        '<i class="ti ti-plus" style="font-size:10px;color:var(--green)"></i>' +
        '<span>' + p.name + '</span>' +
      '</div>';
    });
    html += '</div>';
  }

  return html;
}

// ── Actions Formation Tab ─────────────────────────────────────────────────────
function ftSelectSlot(idx) {
  // Aucun sélectionné → sélectionner
  if (_ftSelectedSlot === null) {
    _ftSelectedSlot = idx;
    ftRefresh();
    return;
  }
  // Même slot → désélectionner
  if (_ftSelectedSlot === idx) {
    _ftSelectedSlot = null;
    ftRefresh();
    return;
  }
  // Deux slots différents → échanger leurs joueurs
  var slotA = _ftTitulaires[_ftSelectedSlot];
  var slotB = _ftTitulaires[idx];
  // Échanger en conservant les slot_idx
  var idxA = _ftSelectedSlot;
  var idxB = idx;
  _ftTitulaires[idxA] = slotB ? Object.assign({}, slotB, { slot_idx: idxA }) : { slot_idx: idxA, player_id: null };
  _ftTitulaires[idxB] = slotA ? Object.assign({}, slotA, { slot_idx: idxB }) : { slot_idx: idxB, player_id: null };
  _ftSelectedSlot = null;
  ftSave();
  ftRefresh();
}

function ftAssignToSlot(pid) {
  if (_ftSelectedSlot === null) return;
  var sq = _squad23.find(function(s) { return s.player_id === pid; });
  var cards = State.cards[pid] || [];
  var card = sq ? cards.find(function(c) { return c.id === sq.card_id; }) || cards[0] : cards[0];

  // Récupérer l'ancien titulaire du slot
  var displaced = _ftTitulaires[_ftSelectedSlot];
  var displacedPid = displaced && displaced.player_id ? displaced.player_id : null;

  // Vérifier si le nouveau joueur vient du banc
  var fromBenchIdx = _ftRemplacants.findIndex(function(r) { return r.player_id === pid; });

  if (fromBenchIdx >= 0 && displacedPid) {
    // Échange : remplacer le slot du banc par l'ancien titulaire
    var sq2 = _squad23.find(function(s) { return s.player_id === displacedPid; });
    var cards2 = State.cards[displacedPid] || [];
    var card2 = sq2 ? cards2.find(function(c) { return c.id === sq2.card_id; }) || cards2[0] : cards2[0];
    _ftRemplacants[fromBenchIdx] = {
      player_id: displacedPid,
      card_id: card2 ? card2.id : null,
      build_id: sq2 ? sq2.build_id : null,
    };
  } else {
    // Joueur hors banc → retirer du banc si présent, envoyer l'ancien titulaire au banc
    _ftRemplacants = _ftRemplacants.filter(function(r) { return r.player_id !== pid; });
    if (displacedPid && !_ftRemplacants.find(function(r) { return r.player_id === displacedPid; }) && _ftRemplacants.length < 12) {
      var sq3 = _squad23.find(function(s) { return s.player_id === displacedPid; });
      var cards3 = State.cards[displacedPid] || [];
      var card3 = sq3 ? cards3.find(function(c) { return c.id === sq3.card_id; }) || cards3[0] : cards3[0];
      _ftRemplacants.push({
        player_id: displacedPid,
        card_id: card3 ? card3.id : null,
        build_id: sq3 ? sq3.build_id : null,
      });
    }
  }

  // Placer le nouveau joueur sur le slot
  _ftTitulaires[_ftSelectedSlot] = {
    slot_idx: _ftSelectedSlot,
    player_id: pid,
    card_id: card ? card.id : null,
    build_id: sq ? sq.build_id : null,
  };

  _ftSelectedSlot = null;
  ftSave();
  ftRefresh();
}

function ftRemoveFromSlot(e, idx) {
  if (e) e.stopPropagation();
  _ftTitulaires[idx] = { slot_idx: idx, player_id: null };
  if (_ftSelectedSlot === idx) _ftSelectedSlot = null;
  ftSave();
  ftRefresh();
}

function ftAddToBench(pid) {
  if (_ftRemplacants.length >= 12) return;
  var sq = _squad23.find(function(s) { return s.player_id === pid; });
  var cards = State.cards[pid] || [];
  var card = sq ? cards.find(function(c) { return c.id === sq.card_id; }) || cards[0] : cards[0];
  _ftRemplacants.push({ player_id: pid, card_id: card ? card.id : null, build_id: sq ? sq.build_id : null });
  ftSave();
  ftRefresh();
}

function ftRemoveRemplacant(e, idx) {
  if (e) e.stopPropagation();
  _ftRemplacants.splice(idx, 1);
  ftSave();
  ftRefresh();
}

function ftOnFormationInput(val) {
  _ftFormation = val.trim();
  ftSave();
  ftRefresh();
}

function ftOpenPicker() {
  // Réutiliser le picker existant avec callback custom
  loadAllCustomFormations();
  var q = String.fromCharCode(39);
  var customs = loadCustomFormations();
  var customNames = Object.keys(customs);
  var builtinNames = Object.keys(FORMATION_LAYOUTS).filter(function(k) { return !FORMATION_LAYOUTS[k]._custom_slots; });

  var html = '<div class="fmpicker-overlay" id="fmpicker-overlay" onclick="closeFmPickerIfBg(event)">' +
    '<div class="fmpicker-panel">' +
      '<div class="fmpicker-header">' +
        '<span class="fmpicker-title">Choisir une formation</span>' +
        '<div style="display:flex;gap:6px">' +
          '<button class="btn-sm btn-primary" onclick="openFormationEditor(null)"><i class="ti ti-plus"></i> Créer</button>' +
          '<button class="btn-icon" onclick="closeFmPicker()"><i class="ti ti-x"></i></button>' +
        '</div>' +
      '</div>' +
      '<div class="fmpicker-body">' +
        (customNames.length > 0 ? '<div class="fmpicker-group-title">Mes formations</div><div class="fmpicker-grid">' + customNames.map(function(n) { return renderFtFormationCard(n, true); }).join('') + '</div>' : '') +
        '<div class="fmpicker-group-title">Formations standard</div>' +
        '<div class="fmpicker-grid">' + builtinNames.map(function(n) { return renderFtFormationCard(n, false); }).join('') + '</div>' +
      '</div>' +
    '</div>' +
  '</div>';

  var root = document.createElement('div');
  root.id = 'fmpicker-root';
  root.innerHTML = html;
  document.body.appendChild(root);
}

function renderFtFormationCard(name, isCustom) {
  var q = String.fromCharCode(39);
  var slots = buildPitchSlots(name);
  if (!slots) return '';
  var miniSvg = renderMiniPitchSVG(slots);
  return '<div class="fmpicker-card" onclick="ftSelectFormation(' + q + name.replace(/'/g, "\\'") + q + ')">' +
    miniSvg +
    '<div class="fmpicker-card-name">' + name + (isCustom ? ' <span class="badge-custom">Perso</span>' : '') + '</div>' +
    (isCustom ? '<button class="fmpicker-delete" onclick="deleteCustomFm(event,' + q + name.replace(/'/g, "\\'") + q + ')" title="Supprimer"><i class="ti ti-trash"></i></button>' : '') +
  '</div>';
}

function ftSelectFormation(name) {
  _ftFormation = name;
  var inp = document.getElementById('ft-formation-input');
  if (inp) inp.value = name;
  closeFmPicker();
  ftSave();
  ftRefresh();
}

function ftSetMode(mode) {
  _ftMode = mode;
  ftRefresh();
}

function ftSaveAndApply() {
  ftSave();
  // Toast visuel
  var btn = document.querySelector('.ft-bench-header .btn-sm');
  if (btn) { btn.innerHTML = '<i class="ti ti-check"></i> Sauvegardé !'; setTimeout(function() { btn.innerHTML = '<i class="ti ti-device-floppy"></i> Sauvegarder'; }, 1500); }
}

function ftRefresh() {
  if (State.activeTab !== 'formation') return;
  var pitchCol = document.querySelector('.ft-pitch-col');
  var slots = _ftFormation ? buildPitchSlots(_ftFormation) : null;
  var hasPitch = !!(slots && slots.length === 11);
  if (pitchCol && hasPitch && _ftMode === 'terrain') {
    // Re-render seulement le SVG et la légende sans tout re-render
    var svgEl = document.getElementById('ft-pitch-svg');
    if (svgEl) {
      var newSvg = document.createElement('div');
      newSvg.innerHTML = renderFtPitchSVG(slots);
      svgEl.parentNode.replaceChild(newSvg.firstChild, svgEl);
      setTimeout(bindFtPitchDrag, 40);
    } else {
      render();
    }
    // Refresh slot panel
    var slotPanel = document.getElementById('ft-slot-panel');
    if (slotPanel) slotPanel.innerHTML = renderFtSlotPanel();
    // Refresh bench
    var bench = document.querySelector('.ft-right-bottom');
    if (bench) bench.innerHTML = renderFtBench();
    // Refresh formation label
    var formLabel = document.querySelector('.pitch-formation-label');
    if (formLabel) formLabel.textContent = _ftFormation;
  } else {
    render();
  }
}

// ── Détection de position selon zone du terrain ───────────────────────────────
// Le terrain est divisé en zones : top% détermine la ligne, left% détermine le côté
// top: 0-30=ATT, 30-55=MID_OFF, 55-75=MID_DEF, 75-90=DEF, 90-100=GK
// left: 0-25=Far Left, 25-40=Left, 40-60=Center, 60-75=Right, 75-100=Far Right

var POSITION_SUGGESTIONS = {
  // GK
  GK_CENTER:          ['GK'],
  // DEF
  DEF_FAR_LEFT:       ['LB', 'CB'],
  DEF_LEFT:           ['LB', 'CB'],
  DEF_CENTER:         ['CB'],
  DEF_RIGHT:          ['RB', 'CB'],
  DEF_FAR_RIGHT:      ['RB', 'CB'],
  // MID_DEF
  MID_DEF_FAR_LEFT:   ['LB', 'LMF', 'DMF'],
  MID_DEF_LEFT:       ['LMF', 'CMF', 'DMF'],
  MID_DEF_CENTER:     ['DMF', 'CMF'],
  MID_DEF_RIGHT:      ['RMF', 'CMF', 'DMF'],
  MID_DEF_FAR_RIGHT:  ['RB', 'RMF', 'DMF'],
  // MID_OFF
  MID_OFF_FAR_LEFT:   ['LMF', 'LWF', 'CMF'],
  MID_OFF_LEFT:       ['LMF', 'CMF', 'AMF'],
  MID_OFF_CENTER:     ['CMF', 'AMF', 'DMF'],
  MID_OFF_RIGHT:      ['RMF', 'CMF', 'AMF'],
  MID_OFF_FAR_RIGHT:  ['RMF', 'RWF', 'CMF'],
  // ATT
  ATT_FAR_LEFT:       ['LWF', 'SS'],
  ATT_LEFT:           ['LWF', 'SS', 'CF'],
  ATT_CENTER:         ['CF', 'SS'],
  ATT_RIGHT:          ['RWF', 'SS', 'CF'],
  ATT_FAR_RIGHT:      ['RWF', 'SS'],
  // TOP
  TOP_FAR_LEFT:       ['LWF'],
  TOP_LEFT:           ['LWF', 'SS'],
  TOP_CENTER:         ['CF', 'SS'],
  TOP_RIGHT:          ['RWF', 'SS'],
  TOP_FAR_RIGHT:      ['RWF'],
};

function detectPositionSuggestions(leftPct, topPct) {
  var h, v;
  // Vertical (ligne)
  if (topPct > 85)       h = 'GK';
  else if (topPct > 70)  h = 'DEF';
  else if (topPct > 52)  h = 'MID_DEF';
  else if (topPct > 35)  h = 'MID_OFF';
  else if (topPct > 15)  h = 'ATT';
  else                   h = 'TOP';
  // Horizontal (côté)
  if (leftPct < 22)       v = 'FAR_LEFT';
  else if (leftPct < 40)  v = 'LEFT';
  else if (leftPct < 60)  v = 'CENTER';
  else if (leftPct < 78)  v = 'RIGHT';
  else                    v = 'FAR_RIGHT';

  if (h === 'GK') return ['GK'];
  var key = h + '_' + v;
  return POSITION_SUGGESTIONS[key] || ['CM'];
}

function recalcFormation() {
  // Compter les joueurs par ligne selon leur top%
  var counts = { gk: 0, def: 0, mid_def: 0, mid_off: 0, att: 0, top: 0 };
  _ftTitulaires.forEach(function(t) {
    if (!t || !t.player_id) return;
    var top = t.top_pct || 88;
    if (top > 85)       counts.gk++;
    else if (top > 70)  counts.def++;
    else if (top > 52)  counts.mid_def++;
    else if (top > 35)  counts.mid_off++;
    else                counts.att++;
  });
  // Construire le nom de la formation
  var parts = [];
  if (counts.def > 0)     parts.push(counts.def);
  if (counts.mid_def > 0) parts.push(counts.mid_def);
  if (counts.mid_off > 0) parts.push(counts.mid_off);
  if (counts.att > 0)     parts.push(counts.att);
  if (parts.length >= 2) {
    var name = parts.join('-');
    _ftFormation = name;
    var inp = document.getElementById('ft-formation-input');
    if (inp) inp.value = name;
  }
}

// ── Drag & drop joueurs sur le terrain Formation ───────────────────────────────
var _ftDragIdx = null;
var _ftDragStartLeft = 0;
var _ftDragStartTop = 0;

function bindFtPitchDrag() {
  var svg = document.getElementById('ft-pitch-svg');
  if (!svg) return;
  var W = 200; var H = 310;

  function getSVGPos(e) {
    var rect = svg.getBoundingClientRect();
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    var leftPct = Math.max(5, Math.min(95, (clientX - rect.left) / rect.width * 100));
    var topPct  = Math.max(5, Math.min(95, (clientY - rect.top)  / rect.height * 100));
    return { leftPct: leftPct, topPct: topPct };
  }

  svg.querySelectorAll('.ft-draggable-node').forEach(function(node) {
    var idx = parseInt(node.getAttribute('data-slot'));
    var _startX = 0, _startY = 0, _moved = false;

    function onStart(e) {
      _startX = e.touches ? e.touches[0].clientX : e.clientX;
      _startY = e.touches ? e.touches[0].clientY : e.clientY;
      _moved = false;
      _ftDragIdx = null;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
    }

    function onMove(e) {
      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      var clientY = e.touches ? e.touches[0].clientY : e.clientY;
      var dx = clientX - _startX;
      var dy = clientY - _startY;
      if (!_moved && Math.sqrt(dx*dx + dy*dy) > 6) {
        _moved = true;
        _ftDragIdx = idx;
        _ftSelectedSlot = null;
        node.style.opacity = '0.6';
      }
      if (!_moved || _ftDragIdx !== idx) return;
      e.preventDefault();
      var pos = getSVGPos(e);
      var cx = Math.round(pos.leftPct / 100 * W);
      var cy = Math.round(pos.topPct  / 100 * H);
      var circle = node.querySelector('circle');
      var texts  = node.querySelectorAll('text');
      if (circle) { circle.setAttribute('cx', cx); circle.setAttribute('cy', cy); }
      if (texts[0]) { texts[0].setAttribute('x', cx); texts[0].setAttribute('y', cy + 3); }
      if (texts[1]) { texts[1].setAttribute('x', cx); texts[1].setAttribute('y', cy + 24); }
      node._dragPos = pos;
    }

    function onEnd(e) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      if (!_moved) {
        _ftDragIdx = null;
        node.style.opacity = '1';
        ftSelectSlot(idx);
        return;
      }
      node.style.opacity = '1';
      _ftDragIdx = null;
      if (!node._dragPos) return;
      var pos = node._dragPos;
      node._dragPos = null;
      ftDropPlayer(idx, pos.leftPct, pos.topPct);
    }

    node.addEventListener('mousedown', onStart);
    node.addEventListener('touchstart', onStart, { passive: false });
  });
}

function ftDropPlayer(slotIdx, leftPct, topPct) {
  var titu = _ftTitulaires[slotIdx];
  if (!titu || !titu.player_id) return;

  // Mettre à jour les coordonnées
  titu.left_pct = Math.round(leftPct * 10) / 10;
  titu.top_pct  = Math.round(topPct  * 10) / 10;

  // Détecter suggestions de position
  var suggestions = detectPositionSuggestions(leftPct, topPct);

  // Recalculer formation
  recalcFormation();

  // Afficher le picker de position
  showPositionPicker(slotIdx, suggestions, leftPct, topPct);
}

function showPositionPicker(slotIdx, suggestions, leftPct, topPct) {
  // Supprimer picker existant
  var existing = document.getElementById('ft-pos-picker');
  if (existing) existing.remove();

  var svg = document.getElementById('ft-pitch-svg');
  if (!svg) return;
  var rect = svg.getBoundingClientRect();
  var x = rect.left + leftPct / 100 * rect.width;
  var y = rect.top  + topPct  / 100 * rect.height;

  var q = String.fromCharCode(39);
  var picker = document.createElement('div');
  picker.id = 'ft-pos-picker';
  picker.style.cssText = 'position:fixed;z-index:400;background:var(--surface);border:0.5px solid var(--accent);border-radius:8px;padding:6px;display:flex;flex-direction:column;gap:4px;box-shadow:0 4px 20px rgba(0,0,0,0.5)';
  picker.style.left = Math.min(x + 20, window.innerWidth - 140) + 'px';
  picker.style.top  = Math.min(y - 20, window.innerHeight - 120) + 'px';

  var label = document.createElement('div');
  label.style.cssText = 'font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;padding:2px 4px;';
  label.textContent = 'Choisir la position';
  picker.appendChild(label);

  suggestions.forEach(function(pos) {
    var btn = document.createElement('button');
    btn.style.cssText = 'padding:5px 14px;border-radius:5px;border:0.5px solid var(--border);background:var(--surface3);color:var(--text);font-size:12px;font-weight:600;cursor:pointer;text-align:left;';
    btn.textContent = pos;
    btn.onmouseenter = function() { btn.style.background = 'var(--accent)'; btn.style.color = '#fff'; };
    btn.onmouseleave = function() { btn.style.background = 'var(--surface3)'; btn.style.color = 'var(--text)'; };
    btn.onclick = function() {
      ftApplyPosition(slotIdx, pos);
      picker.remove();
    };
    picker.appendChild(btn);
  });

  // Bouton annuler
  var cancel = document.createElement('button');
  cancel.style.cssText = 'padding:4px 14px;border-radius:5px;border:none;background:none;color:var(--muted);font-size:11px;cursor:pointer;';
  cancel.textContent = '✕ Annuler';
  cancel.onclick = function() { picker.remove(); ftRefresh(); };
  picker.appendChild(cancel);

  document.body.appendChild(picker);

  // Fermer si clic extérieur
  setTimeout(function() {
    document.addEventListener('mousedown', function closePicker(e) {
      if (!picker.contains(e.target)) {
        picker.remove();
        ftRefresh();
        document.removeEventListener('mousedown', closePicker);
      }
    });
  }, 100);
}

function ftApplyPosition(slotIdx, posLabel) {
  var titu = _ftTitulaires[slotIdx];
  if (!titu) return;
  titu.position_label = posLabel;
  // Mettre à jour le label dans le slot du terrain
  var slots = buildPitchSlots(_ftFormation);
  if (slots && slots[slotIdx]) {
    slots[slotIdx].label = posLabel;
    // Mettre à jour FORMATION_LAYOUTS custom si formation custom
    // ou reconstruire les labels
    POSITION_LABELS_BY_FORMATION[_ftFormation] = _ftTitulaires.map(function(t, i) {
      return t && t.position_label ? t.position_label : (slots[i] ? slots[i].label : '?');
    });
  }
  recalcFormation();
  ftSave();
  ftRefresh();
}
var _ftHDivDragging = false;
var _ftHDivStartY = 0;
var _ftHDivStartH = 0;

function ftHDividerStart(e) {
  e.preventDefault();
  var top = document.getElementById('ft-slot-panel');
  if (!top) return;
  _ftHDivDragging = true;
  _ftHDivStartY = e.clientY;
  _ftHDivStartH = top.offsetHeight;
  var divider = document.getElementById('ft-hdivider');
  if (divider) divider.classList.add('dragging');
  document.addEventListener('mousemove', ftHDividerMove);
  document.addEventListener('mouseup', ftHDividerEnd);
}

function ftHDividerMove(e) {
  if (!_ftHDivDragging) return;
  var top = document.getElementById('ft-slot-panel');
  var rightCol = document.querySelector('.ft-right-col');
  if (!top || !rightCol) return;
  var delta = e.clientY - _ftHDivStartY;
  var totalH = rightCol.offsetHeight;
  var newH = Math.max(80, Math.min(totalH - 120, _ftHDivStartH + delta));
  top.style.height = newH + 'px';
  top.style.flex = 'none';
}

function ftHDividerEnd() {
  _ftHDivDragging = false;
  var divider = document.getElementById('ft-hdivider');
  if (divider) divider.classList.remove('dragging');
  document.removeEventListener('mousemove', ftHDividerMove);
  document.removeEventListener('mouseup', ftHDividerEnd);
}
var _ftDivStartX = 0;
var _ftDivStartW = 0;

function ftDividerStart(e) {
  e.preventDefault();
  var pitchCol = document.querySelector('.ft-pitch-col');
  if (!pitchCol) return;
  _ftDivDragging = true;
  _ftDivStartX = e.clientX;
  _ftDivStartW = pitchCol.offsetWidth;
  var divider = document.getElementById('ft-divider');
  if (divider) divider.classList.add('dragging');
  document.addEventListener('mousemove', ftDividerMove);
  document.addEventListener('mouseup', ftDividerEnd);
}

function ftDividerMove(e) {
  if (!_ftDivDragging) return;
  var pitchCol = document.querySelector('.ft-pitch-col');
  if (!pitchCol) return;
  var delta = e.clientX - _ftDivStartX;
  var newW = Math.max(180, Math.min(window.innerWidth * 0.6, _ftDivStartW + delta));
  pitchCol.style.width = newW + 'px';
}

function ftDividerEnd() {
  _ftDivDragging = false;
  var divider = document.getElementById('ft-divider');
  if (divider) divider.classList.remove('dragging');
  document.removeEventListener('mousemove', ftDividerMove);
  document.removeEventListener('mouseup', ftDividerEnd);
}

// ── Onglet Effectif ───────────────────────────────────────────────────────────
function renderEffectif() {
  const player = State.players.find(p => p.id === State.selectedPlayerId);
  return `
    <div class="effectif-layout">
      ${renderSidebar()}
      <div class="effectif-main">
        ${player ? renderPlayerDetail(player) : renderEmptyState()}
        <div id="squad23-container" style="margin-top:20px">${renderSquad23Section()}</div>
      </div>
    </div>
  `;
}

function renderSidebar() {
  return `
    <aside class="sidebar">
      <div class="sidebar-header">
        <span class="sidebar-label">Joueurs</span>
        <button class="btn-icon" onclick="openModal('addPlayer')" title="Ajouter joueur">
          <i class="ti ti-plus"></i>
        </button>
      </div>
      <div class="sidebar-list">
        ${State.players.map(p => renderPlayerItem(p)).join('')}
        ${State.players.length === 0 ? `
          <div class="sidebar-empty">
            <p>Aucun joueur</p>
            <button class="btn-sm btn-primary" onclick="openModal('addPlayer')">+ Ajouter</button>
          </div>
        ` : ''}
      </div>
    </aside>
  `;
}

function renderPlayerItem(player) {
  const active = player.id === State.selectedPlayerId;
  const cards = State.cards[player.id] || [];
  const card = cards[0];
  const playerId = card?.efhub_stats ? Efhub.parseId(player.efhub_url || '') : null;
  const imgUrl = playerId ? Efhub.imgUrl(playerId) : null;
  const ovr = card?.efhub_stats?.offensiveAwareness ? Object.values(card.efhub_stats).reduce((a,b)=>a+b,0) : null;

  return `
    <div class="player-item ${active ? 'active' : ''}" onclick="onSelectPlayer('${player.id}')">
      <div class="player-avatar">
        ${imgUrl
          ? `<img src="${imgUrl}" alt="${player.name}" onerror="this.style.display='none'">`
          : `<i class="ti ti-user"></i>`}
      </div>
      <div class="player-info">
        <span class="player-name">${player.name}</span>
        <span class="player-meta">${card ? (card.playing_style || card.card_type || '—') : 'Aucune carte'}</span>
      </div>
      ${card ? `<span class="ovr-badge ${card.card_type === 'Trending' ? 'trending' : card.card_type === 'Epic' ? 'epic' : card.card_type === 'Iconic' ? 'iconic' : ''}">${card.card_type || '—'}</span>` : ''}
    </div>
  `;
}

// ── Détail joueur ─────────────────────────────────────────────────────────────
function renderPlayerDetail(player) {
  const cards = State.cards[player.id] || [];
  const card = cards.find(c => c.id === State.selectedCardId) || cards[0];
  const efhubId = Efhub.parseId(player.efhub_url || '');
  const imgUrl = efhubId ? Efhub.imgUrl(efhubId) : null;

  return `
    <div class="player-detail">
      ${renderPlayerHeader(player, card, imgUrl)}
      ${cards.length > 1 ? renderCardSelector(cards) : ''}
      ${renderPlayerTabs()}
      <div class="player-tab-content">
        ${State.activePlayerTab === 'stats'  ? renderStatsTab(card) : ''}
        ${State.activePlayerTab === 'builds' ? renderBuildsTab(card) : ''}
        ${State.activePlayerTab === 'matchs' ? renderPlayerMatchsTab(player) : ''}
      </div>
    </div>
  `;
}

function renderPlayerHeader(player, card, imgUrl) {
  return `
    <div class="player-header">
      <div class="player-header-img">
        ${imgUrl
          ? `<img src="${imgUrl}" alt="${player.name}">`
          : `<div class="player-img-placeholder"><i class="ti ti-user"></i></div>`}
      </div>
      <div class="player-header-info">
        <div class="player-header-top">
          <h2 class="player-header-name">${player.name}</h2>
          <div class="player-header-actions">
            <button class="btn-icon" onclick="openModal('editPlayer','${player.id}')" title="Modifier">
              <i class="ti ti-pencil"></i>
            </button>
            <button class="btn-icon danger" onclick="confirmDelete('player','${player.id}')" title="Supprimer">
              <i class="ti ti-trash"></i>
            </button>
          </div>
        </div>
        ${card ? `
          <div class="player-badges">
            ${card.efhub_stats ? `<span class="badge badge-pos">${card.efhub_stats.position || '—'}</span>` : ''}
            ${card.playing_style ? `<span class="badge badge-style">${card.playing_style}</span>` : ''}
            ${card.card_type ? `<span class="badge ${card.card_type === 'Trending' ? 'badge-trending' : 'badge-type'}">${card.card_type}</span>` : ''}
            ${card.level_cap ? `<span class="badge badge-lv">Lv ${card.level_cap} · ${card.points_max} pts</span>` : ''}
          </div>
          ${card.skills && card.skills.length > 0 ? `
            <div class="player-skills">
              ${card.skills.map(s => `<span class="skill-tag">${s}</span>`).join('')}
            </div>
          ` : ''}
        ` : `
          <button class="btn-sm btn-primary" onclick="openModal('addCard','${player.id}')">
            + Ajouter une carte
          </button>
        `}
      </div>
    </div>
  `;
}

function renderCardSelector(cards) {
  return `
    <div class="card-selector">
      ${cards.map(c => `
        <button class="card-selector-btn ${c.id === State.selectedCardId ? 'active' : ''}"
                onclick="onSelectCard('${c.id}')">
          ${c.card_type || 'Carte'} · Lv ${c.level_cap}
        </button>
      `).join('')}
      <button class="card-selector-btn add" onclick="openModal('addCard','${State.selectedPlayerId}')">
        <i class="ti ti-plus"></i>
      </button>
    </div>
  `;
}

function renderEffectifFooter() {
  return '<div id="squad23-container">' + renderSquad23Section() + '</div>';
}

function renderPlayerTabs() {
  const tabs = [
    { id: 'stats',  label: 'Stats & Build' },
    { id: 'builds', label: 'Builds' },
    { id: 'matchs', label: 'Matchs' },
  ];
  return `
    <div class="player-tabs">
      ${tabs.map(t => `
        <button class="player-tab ${State.activePlayerTab === t.id ? 'active' : ''}"
                onclick="setPlayerTab('${t.id}')">
          ${t.label}
        </button>
      `).join('')}
    </div>
  `;
}

// ── Stats Tab ─────────────────────────────────────────────────────────────────
function renderStatsTab(card) {
  if (!card) return renderNoCard();
  if (!card.efhub_stats || Object.keys(card.efhub_stats).length === 0) {
    return `<div class="empty-state"><p>Aucune stat importée</p></div>`;
  }

  const build = State.builds[card.id]?.find(b => b.id === State.selectedBuildId);
  const sliders = build?.sliders || {};
  const statsFinal = Progression.allStatsFinal(card.efhub_stats, sliders);

  // Grouper les stats
  const groups = {};
  EFB_STATS_ORDER.forEach(s => {
    if (!groups[s.group]) groups[s.group] = [];
    groups[s.group].push(s);
  });

  return `
    <div class="stats-tab">
      ${Object.entries(groups).map(([group, stats]) => `
        <div class="stats-group">
          <div class="stats-group-title">${group}</div>
          <div class="stats-grid">
            ${stats.map(s => {
              const base = card.efhub_stats[s.key] || 0;
              const final = statsFinal[s.key] || base;
              const clics = sliders[s.key] || 0;
              const delta = final - base;
              return `
                <div class="stat-row">
                  <div class="stat-icon" style="background:${s.color}22">
                    <i class="ti ${s.icon}" style="color:${s.color}"></i>
                  </div>
                  <span class="stat-label">${s.label}</span>
                  <div class="stat-bar-wrap">
                    <div class="stat-bar-base" style="width:${base}%;background:${s.color}55"></div>
                    ${delta > 0 ? `<div class="stat-bar-delta" style="width:${delta}%;background:${s.color}"></div>` : ''}
                  </div>
                  <span class="stat-val">${final}</span>
                  ${delta > 0 ? `<span class="stat-delta">+${delta}</span>` : '<span class="stat-delta"></span>'}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ── Builds Tab ────────────────────────────────────────────────────────────────
function renderBuildsTab(card) {
  if (!card) return renderNoCard();
  const builds = State.builds[card.id] || [];
  const isTrending = card.card_type === 'Trending';

  // Vérifier si le joueur est déjà dans la sélection
  loadSquad23();
  const inSquad = _squad23.some(function(s) { return s.card_id === card.id; });

  if (isTrending) {
    return `
      <div class="builds-tab">
        <div class="builds-header">
          <div style="display:flex;align-items:center;gap:8px;flex:1">
            <span class="badge badge-trending">Trending</span>
            <span style="font-size:12px;color:var(--muted)">Carte figée — pas de build possible</span>
          </div>
          <button class="btn-sm ${inSquad ? 'btn-ghost' : 'btn-primary'}" onclick="addTrendingToSquad23('${card.id}')" ${inSquad ? 'disabled' : ''}>
            <i class="ti ti-user-${inSquad ? 'check' : 'plus'}"></i>
            ${inSquad ? 'Dans la sélection' : 'Ajouter à la sélection'}
          </button>
        </div>
        <div class="empty-state" style="padding:20px 0">
          <p style="color:var(--muted);font-size:12px">Les cartes Trending sont non développables.<br>Le joueur peut être ajouté à la sélection sans build.</p>
        </div>
      </div>
    `;
  }

  return `
    <div class="builds-tab">
      <div class="builds-header">
        <button class="btn-sm btn-primary" onclick="openModal('addBuild','${card.id}')">
          + Nouveau build
        </button>
      </div>
      ${builds.length === 0
        ? `<div class="empty-state"><p>Aucun build créé</p></div>`
        : builds.map(b => renderBuildCard(b, card)).join('')
      }
    </div>
  `;
}

function renderBuildCard(build, card) {
  const active = build.id === State.selectedBuildId;
  const sliders = build.sliders || {};
  const pointsUsed = Progression.totalPoints(sliders);
  const pointsMax = card.points_max || 0;
  const isTrending = card.card_type === 'Trending';
  const buildMatches = State.matches.filter(m => m.build_id === build.id);
  const stats = Analyse.globalStats(buildMatches);
  const serie = Analyse.series(buildMatches);
  const expandId = 'build-expand-' + build.id;
  const player = State.players.find(p => p.id === State.selectedPlayerId);
  const efhubId = player ? Efhub.parseId(player.efhub_url || '') : null;
  const imgUrl = efhubId ? Efhub.imgUrl(efhubId) : null;

  // Icônes compactes style efhub
  const activeSliders = SLIDERS_CONFIG.filter(s => (sliders[s.key] || 0) > 0);

  return `
    <div class="build-card ${active ? 'active' : ''}" onclick="onSelectBuild('${build.id}')">
      <div class="build-card-header">
        <div class="build-card-left">
          <span class="build-name">${build.name}</span>
          <span class="build-pts ${pointsUsed === pointsMax ? 'full' : ''}">${pointsUsed} / ${pointsMax} pts</span>
        </div>
        <div class="build-card-actions">
          <button class="btn-icon" onclick="addBuildToSquad23('${build.id}');event.stopPropagation()" title="Ajouter à la sélection">
            <i class="ti ti-user-plus" id="squad-btn-${build.id}"></i>
          </button>
          ${!isTrending ? `<button class="btn-icon" onclick="openModal('editBuild','${build.id}');event.stopPropagation()">
            <i class="ti ti-pencil"></i>
          </button>` : ''}
          <button class="btn-icon danger" onclick="confirmDelete('build','${build.id}');event.stopPropagation()">
            <i class="ti ti-trash"></i>
          </button>
        </div>
      </div>

      <!-- Style efhub : photo + position + icônes sliders -->
      <div class="build-efhub-preview">
        <div class="build-efhub-left">
          ${imgUrl ? `<img src="${imgUrl}" class="build-player-img" alt="${player.name}">` : ''}
          <div class="build-player-meta">
            <span class="build-player-name">${player ? player.name.toUpperCase() : ''}</span>
            ${card.efhub_stats?.position ? `<span class="build-player-pos">${card.efhub_stats.position}</span>` : ''}
          </div>
        </div>
        <div class="build-icons-row">
          ${activeSliders.map(s => `
            <div class="build-slider-icon-wrap">
              <div class="build-slider-svg" style="display:flex;align-items:center;justify-content:center;color:#e2e8f0">${s.icon}</div>
              <span class="build-slider-count">${sliders[s.key]}</span>
            </div>
          `).join('')}
          ${activeSliders.length === 0 ? '<span class="build-empty-sliders">Aucun clic</span>' : ''}
        </div>
      </div>

      ${buildMatches.length > 0 ? `
        <div class="build-perf">
          <span class="build-perf-item">${stats.total} matchs</span>
          <span class="build-perf-item win">${stats.winRate}% victoires</span>
          <span class="build-perf-item serie">Série: ${serie.current}</span>
        </div>
      ` : ''}

      <!-- Expand/Collapse -->
      <button class="build-expand-btn" onclick="toggleBuildExpand('${expandId}');event.stopPropagation()">
        <i class="ti ti-chevron-down" id="${expandId}-icon"></i> Détails
      </button>
      <div class="build-expand-content hidden" id="${expandId}">
        ${renderBuildDetails(build, card)}
      </div>
    </div>
  `;
}

function renderBuildDetails(build, card) {
  const sliders = build.sliders || {};
  const statsFinal = card.efhub_stats ? Progression.allStatsFinal(card.efhub_stats, sliders) : {};
  const isTrending = card.card_type === 'Trending';

  // Grouper les stats
  const groups = {};
  EFB_STATS_ORDER.forEach(s => {
    if (!groups[s.group]) groups[s.group] = [];
    groups[s.group].push(s);
  });

  return `
    <div class="build-details">
      <!-- Stats finales -->
      <div class="build-details-section">
        <div class="build-details-title">Stats après développement</div>
        ${Object.entries(groups).map(([group, stats]) => `
          <div class="build-detail-group">
            <div class="build-detail-group-label">${group}</div>
            <div class="build-detail-stats">
              ${stats.map(s => {
                const base = card.efhub_stats?.[s.key] || 0;
                const final = statsFinal[s.key] || base;
                const delta = final - base;
                return `
                  <div class="build-detail-stat">
                    <span class="build-detail-label">${s.label}</span>
                    <div class="build-detail-bar-wrap">
                      <div class="build-detail-bar-base" style="width:${base}%;background:${s.color}55"></div>
                      ${delta > 0 ? `<div class="build-detail-bar-delta" style="width:${delta}%;background:${s.color}"></div>` : ''}
                    </div>
                    <span class="build-detail-val">${final}</span>
                    ${delta > 0 ? `<span class="build-detail-delta">+${delta}</span>` : '<span class="build-detail-delta"></span>'}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Boosters -->
      ${card.booster_native || card.booster_extra ? `
        <div class="build-details-section">
          <div class="build-details-title">Boosters</div>
          <div class="build-boosters">
            ${card.booster_native ? `<span class="booster-tag native">⚡ ${card.booster_native}</span>` : ''}
            ${card.booster_extra ? `<span class="booster-tag extra">⚡ ${card.booster_extra}</span>` : ''}
          </div>
        </div>
      ` : ''}

      <!-- Skills -->
      ${card.skills && card.skills.length > 0 ? `
        <div class="build-details-section">
          <div class="build-details-title">Skills ${!isTrending ? '(+ Additional max 5)' : '(figés)'}</div>
          <div class="build-skills-list">
            ${card.skills.map(sk => `<span class="skill-tag base">${sk}</span>`).join('')}
          </div>
          ${!isTrending ? `
            <div class="additional-skills-wrap" onclick="event.stopPropagation()">
              <div class="additional-skills-list" id="additional-skills-${build.id}">
                ${(build.additional_skills || []).map((sk, i) => `
                  <span class="skill-tag additional">
                    ${sk}
                    <button onclick="removeAdditionalSkill('${build.id}', ${i})">×</button>
                  </span>
                `).join('')}
              </div>
              ${(build.additional_skills || []).length < 5 ? `
                <div class="add-skill-row">
                  <input type="text" id="new-skill-${build.id}" placeholder="Nouveau skill..." class="form-input form-input-sm" style="width:160px">
                  <button class="btn-sm btn-ghost" onclick="addAdditionalSkill('${build.id}')">+ Ajouter</button>
                </div>
              ` : ''}
            </div>
          ` : '<span style="font-size:10px;color:var(--muted)">Carte Trending — skills non modifiables</span>'}
        </div>
      ` : ''}
    </div>
  `;
}

function toggleBuildExpand(id) {
  const el = document.getElementById(id);
  const icon = document.getElementById(id + '-icon');
  if (el) el.classList.toggle('hidden');
  if (icon) icon.className = el.classList.contains('hidden') ? 'ti ti-chevron-down' : 'ti ti-chevron-up';
}

async function addAdditionalSkill(buildId) {
  const input = document.getElementById('new-skill-' + buildId);
  const skill = input?.value?.trim();
  if (!skill) return;
  const build = Object.values(State.builds).flat().find(b => b.id === buildId);
  if (!build) return;
  const current = build.additional_skills || [];
  if (current.length >= 5) return;
  const updated = [...current, skill];
  await Builds.update(buildId, { additional_skills: updated });
  const cardId = build.card_id;
  State.builds[cardId] = await Builds.getByCard(cardId);
  render();
}

async function removeAdditionalSkill(buildId, index) {
  const build = Object.values(State.builds).flat().find(b => b.id === buildId);
  if (!build) return;
  const updated = (build.additional_skills || []).filter((_, i) => i !== index);
  await Builds.update(buildId, { additional_skills: updated });
  const cardId = build.card_id;
  State.builds[cardId] = await Builds.getByCard(cardId);
  render();
}

// ── Matchs Tab (par joueur) ───────────────────────────────────────────────────
function renderPlayerMatchsTab(player) {
  const cards = State.cards[player.id] || [];
  const cardIds = cards.map(c => c.id);
  const buildIds = cardIds.flatMap(cid => (State.builds[cid] || []).map(b => b.id));
  const playerMatches = State.matches.filter(m => buildIds.includes(m.build_id));

  return `
    <div class="matchs-tab">
      <button class="btn-sm btn-primary" onclick="openModal('addMatch','${State.selectedBuildId}')">
        + Enregistrer un match
      </button>
      <div class="match-list">
        ${playerMatches.length === 0
          ? `<div class="empty-state"><p>Aucun match enregistré</p></div>`
          : playerMatches.map(m => renderMatchRow(m)).join('')}
      </div>
    </div>
  `;
}

function renderMatchRow(match) {
  const resultClass = match.result === 'V' ? 'win' : match.result === 'N' ? 'draw' : 'loss';
  const resultLabel = match.result === 'V' ? 'V' : match.result === 'N' ? 'N' : 'D';
  const date = match.match_date
    ? new Date(match.match_date).toLocaleDateString('fr-FR')
    : new Date(match.played_at).toLocaleDateString('fr-FR');

  const typeLabels = {
    ligue_jcj_d1:'JCJ D1', ligue_jcj_d2:'JCJ D2', ligue_jcj_d3:'JCJ D3',
    ligue_ia_d1:'IA D1', ligue_ia_d2:'IA D2', ligue_ia_d3:'IA D3',
    event_jcj:'Évènement JCJ', event_ia:'Évènement IA', amical:'Amical', my_league:'My League',
  };
  const typeLabel = typeLabels[match.match_type] || match.match_type || '';
  const coach = match.efb_coaches ? match.efb_coaches.name : null;

  return `
    <div class="match-row" id="match-row-${match.id}" onclick="openMatchDetail('${match.id}')" style="cursor:pointer">
      <div class="match-result ${resultClass}">${resultLabel}</div>
      <div class="match-info">
        <div class="match-score-line">
          <span class="match-score">${match.score_for} – ${match.score_against}</span>
          <span class="match-opp">${match.opp_name || '—'}</span>
        </div>
        <div class="match-meta-line">
          ${typeLabel ? `<span class="match-tag">${typeLabel}</span>` : ''}
          ${match.formation ? `<span class="match-tag">${match.formation}</span>` : ''}
          ${coach ? `<span class="match-tag coach"><i class="ti ti-whistle" style="font-size:9px"></i> ${coach}</span>` : ''}
          ${match.rank ? `<span class="match-tag rank">🏅 ${match.rank}</span>` : ''}
          <span class="match-date">${date}</span>
        </div>
      </div>
      <div class="match-actions">
        <button class="btn-icon" onclick="openModal('editMatch','${match.id}')" title="Modifier">
          <i class="ti ti-pencil"></i>
        </button>
        <button class="btn-icon danger" onclick="confirmDelete('match','${match.id}')">
          <i class="ti ti-trash"></i>
        </button>
      </div>
    </div>
  `;
}

// ── Onglet Analyse ────────────────────────────────────────────────────────────
// ── Coaching IA ───────────────────────────────────────────────────────────────
var _coachingResult = null;
var _coachingLoading = false;

async function generateCoaching() {
  if (_coachingLoading) return;
  _coachingLoading = true;
  _coachingResult = null;

  // Afficher le loader
  const el = document.getElementById('coaching-result');
  if (el) el.innerHTML = '<div class="coaching-loading"><i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> Analyse en cours...</div>';

  try {
    // Préparer les données pour Claude
    const coachingData = buildCoachingData();
    if (coachingData.matches < 3) {
      _coachingResult = { error: 'Pas assez de données — joue au moins 3 matchs pour obtenir un coaching.' };
      _coachingLoading = false;
      renderCoachingResult();
      return;
    }

    const prompt = buildCoachingPrompt(coachingData);

    const response = await fetch(EFB_CONFIG.supabaseUrl + '/functions/v1/coaching', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    const text = data.content?.map(b => b.text || '').join('') || '';
    _coachingResult = { text };
  } catch(e) {
    _coachingResult = { error: 'Erreur API : ' + e.message };
  }

  _coachingLoading = false;
  renderCoachingResult();
}

function buildCoachingData() {
  const matches = State.matches;
  const players = State.players;
  const allBuilds = Object.values(State.builds).flat();

  // Stats globales
  const globalStats = Analyse.globalStats(matches);
  const serie = Analyse.series(matches);
  const byRank = Analyse.byRank(matches);

  // Stats par build
  const buildStats = allBuilds.map(b => {
    const bMatches = matches.filter(m => m.build_id === b.id);
    const bs = Analyse.globalStats(bMatches);
    const bSerie = Analyse.series(bMatches);
    const card = Object.values(State.cards).flat().find(c => c.id === b.card_id);
    const player = players.find(p => p.id === card?.player_id);
    return {
      name: b.name,
      player: player?.name || '?',
      matches: bs.total,
      winRate: bs.winRate,
      serie: bSerie.record,
      currentSerie: bSerie.current,
    };
  }).filter(b => b.matches > 0);

  // Stats par joueur
  const playerStats = players.map(p => {
    const playerMatches = matches.filter(m =>
      m.player_stats?.some(ps => ps.player_id === p.id)
    );
    if (playerMatches.length === 0) return null;

    const ratings = playerMatches
      .map(m => m.player_stats?.find(ps => ps.player_id === p.id)?.rating || 0)
      .filter(r => r > 0);
    const avgRating = ratings.length > 0 ? (ratings.reduce((a,b) => a+b, 0) / ratings.length).toFixed(1) : null;
    const goals = playerMatches.reduce((s, m) => s + (m.player_stats?.find(ps => ps.player_id === p.id)?.goals || 0), 0);
    const assists = playerMatches.reduce((s, m) => s + (m.player_stats?.find(ps => ps.player_id === p.id)?.assists || 0), 0);
    const wins = playerMatches.filter(m => m.result === 'V').length;
    const winRate = playerMatches.length > 0 ? Math.round(wins/playerMatches.length*100) : 0;
    return { name: p.name, matches: playerMatches.length, avgRating, goals, assists, winRate };
  }).filter(Boolean);

  // Combinaisons XI gagnantes
  const winningMatches = matches.filter(m => m.result === 'V' && m.titulaires?.length >= 3);
  const playerCoOccurrence = {};
  winningMatches.forEach(m => {
    const pids = m.titulaires.map(t => t.player_id);
    pids.forEach(p1 => {
      pids.forEach(p2 => {
        if (p1 >= p2) return;
        const key = p1 + '|' + p2;
        playerCoOccurrence[key] = (playerCoOccurrence[key] || 0) + 1;
      });
    });
  });
  const topCombos = Object.entries(playerCoOccurrence)
    .sort((a,b) => b[1]-a[1])
    .slice(0,3)
    .map(([key, count]) => {
      const [p1id, p2id] = key.split('|');
      const p1 = players.find(p => p.id === p1id);
      const p2 = players.find(p => p.id === p2id);
      return { players: [p1?.name || '?', p2?.name || '?'], wins: count };
    });

  return {
    matches: matches.length,
    winRate: globalStats.winRate,
    currentSerie: serie.current,
    recordSerie: serie.record,
    byRank,
    buildStats,
    playerStats,
    topCombos,
  };
}

function buildCoachingPrompt(data) {
  var nl = String.fromCharCode(10);
  var rankLines = data.byRank.map(function(r) {
    return '- ' + r.rank + ' : ' + r.winRate + '% (' + r.total + ' matchs, serie record: ' + r.serie.record + ')';
  }).join(nl);
  var buildLines = data.buildStats.map(function(b) {
    return '- ' + b.name + ' (' + b.player + ') : ' + b.winRate + '% sur ' + b.matches + ' matchs, serie: ' + b.serie + ', actuelle: ' + b.currentSerie;
  }).join(nl);
  var playerLines = data.playerStats.map(function(p) {
    return '- ' + p.name + ' : note ' + (p.avgRating || 'N/A') + '/10, ' + p.goals + ' buts, ' + p.assists + ' passes, ' + p.winRate + '% victoires';
  }).join(nl);
  var comboLines = data.topCombos.map(function(c) {
    return '- ' + c.players.join(' + ') + ' : ' + c.wins + ' victoires';
  }).join(nl);
  return 'Tu es un coach eFootball Mobile expert. Analyse ces donnees et donne des recommandations en francais.' + nl + nl +
    'Matchs: ' + data.matches + ', Victoires: ' + data.winRate + '%, Serie: ' + data.currentSerie + ', Record: ' + data.recordSerie + nl + nl +
    'PAR RANG:' + nl + rankLines + nl + nl +
    'BUILDS:' + nl + buildLines + nl + nl +
    'JOUEURS:' + nl + playerLines + nl + nl +
    'COMBOS GAGNANTS:' + nl + comboLines + nl + nl +
    'Reponds en 3 sections: 1. COACHING EQUIPE 2. BUILDS 3. JOUEURS. Max 300 mots.';
}

function renderCoachingResult() {
  var el = document.getElementById('coaching-result');
  if (!el) return;
  if (!_coachingResult) { el.innerHTML = ''; return; }
  if (_coachingResult.error) {
    el.innerHTML = '<div class="coaching-error">' + _coachingResult.error + '</div>';
    return;
  }
  var text = _coachingResult.text;
  var lines = text.split(String.fromCharCode(10));
  var parts = lines.map(function(line) {
    line = line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    line = line.replace(/^#{1,3}\s*/, '');
    if (/^\d+\./.test(line) && line.length > 5) return '<div class="coaching-section-title">' + line + '</div>';
    if (/^[-]\s/.test(line)) return '<div class="coaching-bullet">&bull; ' + line.replace(/^[-]\s+/, '') + '</div>';
    if (line.trim() === '') return '<br>';
    return line;
  });
  el.innerHTML = '<div class="coaching-text">' + parts.join(' ') + '</div>';
}

function renderAnalyse() {
  const matches = State.matches;
  const stats    = Analyse.globalStats(matches);
  const serie    = Analyse.series(matches);
  const byRank   = Analyse.byRank(matches);
  const byBuild  = Analyse.byBuild(matches);
  const byPlayer = Analyse.byPlayer(matches);
  const byForm   = Analyse.byFormation(matches);
  const byType   = Analyse.byMatchType(matches);
  const byCoach  = Analyse.byCoach(matches);
  const bestXI   = Analyse.bestXI(matches);

  const MATCH_TYPE_LABELS = {
    ligue_jcj_d1: '🏆 Ligue JCJ D1', ligue_jcj_d2: '🏆 Ligue JCJ D2', ligue_jcj_d3: '🏆 Ligue JCJ D3',
    ligue_ia_d1: '🤖 Ligue IA D1',   ligue_ia_d2: '🤖 Ligue IA D2',   ligue_ia_d3: '🤖 Ligue IA D3',
    event_jcj: '🎯 Évènement JCJ',   event_ia: '🎯 Évènement IA',
    amical: '🤝 Amical',             my_league: '⚽ My League',
  };

  // ── Helpers ──
  function winBar(wins, draws, losses, total) {
    if (!total) return '';
    return `<div class="an-bar-wrap">
      <div class="an-seg-w" style="width:${wins/total*100}%"></div>
      <div class="an-seg-d" style="width:${draws/total*100}%"></div>
      <div class="an-seg-l" style="width:${losses/total*100}%"></div>
    </div>`;
  }

  function pill(val, color) {
    return `<span class="an-pill" style="color:${color}">${val}</span>`;
  }

  // ── KPIs ──
  const kpiHtml = `
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-val">${stats.total}</div><div class="kpi-label">Matchs</div></div>
      <div class="kpi"><div class="kpi-val" style="color:#34d399">${stats.winRate}%</div><div class="kpi-label">Victoires</div></div>
      <div class="kpi"><div class="kpi-val">${stats.goalsFor}</div><div class="kpi-label">Buts marqués</div></div>
      <div class="kpi"><div class="kpi-val">${stats.goalsAgainst}</div><div class="kpi-label">Buts encaissés</div></div>
      <div class="kpi highlight"><div class="kpi-val" style="color:#a78bfa">${serie.current}</div><div class="kpi-label">Série actuelle</div></div>
      <div class="kpi highlight"><div class="kpi-val" style="color:#a78bfa">${serie.record}</div><div class="kpi-label">Record</div></div>
    </div>`;

  // ── Séries ──
  const serieHtml = renderSerieBlock('Série en cours', serie.current, serie.currentMatches, 'actuelle') +
    (serie.record > serie.current ? renderSerieBlock('Record', serie.record, serie.recordMatches, 'record') : '');

  // ── Coaching IA ──
  const coachingHtml = `
    <div class="coaching-block">
      <div class="coaching-header">
        <div><div class="coaching-title">🤖 Coaching IA</div><div class="coaching-subtitle">Analyse ta performance et recommandations personnalisées</div></div>
        <button class="btn-sm btn-primary" onclick="generateCoaching()" id="btn-coaching">✨ Générer</button>
      </div>
      <div id="coaching-result"></div>
    </div>`;

  // ── Par type de match ──
  const byTypeHtml = byType.length === 0 ? '' : `
    <div class="an-section">
      <div class="an-section-title"><i class="ti ti-tournament"></i> Par type de match</div>
      <div class="an-table">
        ${byType.map(t => `
          <div class="an-row">
            <span class="an-row-label">${MATCH_TYPE_LABELS[t.match_type] || t.match_type}</span>
            ${winBar(t.wins, t.draws, t.losses, t.total)}
            <span class="an-row-pct">${t.winRate}%</span>
            <span class="an-row-sub">${t.total}J</span>
          </div>`).join('')}
      </div>
    </div>`;

  // ── Par rang ──
  const byRankHtml = byRank.length === 0 ? '' : `
    <div class="an-section">
      <div class="an-section-title"><i class="ti ti-medal"></i> Par rang</div>
      <div class="an-table">
        ${byRank.map(r => `
          <div class="an-row">
            <span class="an-row-label">${r.rank}</span>
            ${winBar(r.wins, r.draws, r.losses, r.total)}
            <span class="an-row-pct">${r.winRate}%</span>
            <span class="an-row-sub">${r.total}J · Série ${r.serie.record}</span>
          </div>`).join('')}
      </div>
    </div>`;

  // ── Par formation ──
  const byFormHtml = byForm.length === 0 ? '' : `
    <div class="an-section">
      <div class="an-section-title"><i class="ti ti-layout-soccer-field"></i> Par formation</div>
      <div class="an-table">
        ${byForm.map(f => `
          <div class="an-row">
            <span class="an-row-label" style="font-weight:700">${f.formation}</span>
            ${winBar(f.wins, f.draws, f.losses, f.total)}
            <span class="an-row-pct">${f.winRate}%</span>
            <span class="an-row-sub">${f.total}J · ${f.goalsFor} buts</span>
          </div>`).join('')}
      </div>
    </div>`;

  // ── Par coach ──
  const byCoachHtml = byCoach.filter(c => c.coach_id).length === 0 ? '' : `
    <div class="an-section">
      <div class="an-section-title"><i class="ti ti-whistle"></i> Performance par coach</div>
      <div class="an-table">
        ${byCoach.filter(c => c.coach_id).map(c => `
          <div class="an-row an-row-build">
            <div class="an-row-build-info">
              <span class="an-row-label">${c.name}</span>
              <span class="an-row-sub">${[c.style, c.formation].filter(Boolean).join(' · ') || '—'}</span>
            </div>
            ${winBar(c.wins, c.draws, c.losses, c.total)}
            <span class="an-row-pct">${c.winRate}%</span>
            <div class="an-row-build-stats">
              <span title="Matchs">${c.total}J</span>
              <span title="Série record" style="color:var(--accent)">⚡${c.serie.record}</span>
              <span title="Série actuelle" style="color:#34d399">→${c.serie.current}</span>
            </div>
          </div>`).join('')}
      </div>
    </div>`;

  // ── Par build ──
  const byBuildHtml = byBuild.length === 0 ? '' : `
    <div class="an-section">
      <div class="an-section-title"><i class="ti ti-sliders"></i> Performance par build</div>
      <div class="an-table">
        ${byBuild.slice(0, 10).map(b => {
          const build = Object.values(State.builds).flat().find(x => x.id === b.build_id);
          const card  = build ? Object.values(State.cards).flat().find(c => c.id === build.card_id) : null;
          const playerObj = card ? State.players.find(p => p.id === card.player_id) : null;
          const buildName  = build  ? build.name  : '—';
          const playerName = playerObj ? playerObj.name : '—';
          return `
          <div class="an-row an-row-build">
            <div class="an-row-build-info">
              <span class="an-row-label">${buildName}</span>
              <span class="an-row-sub">${playerName}</span>
            </div>
            ${winBar(b.wins, b.draws, b.losses, b.matchCount)}
            <span class="an-row-pct">${b.winRate}%</span>
            <div class="an-row-build-stats">
              <span title="Buts">⚽ ${b.goals}</span>
              <span title="Passes">🎯 ${b.assists}</span>
              <span title="Note moy." style="color:var(--accent)">★ ${b.avgRating || '—'}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

  // ── Meilleur XI ──
  const bestXIHtml = bestXI.length === 0 ? '' : `
    <div class="an-section">
      <div class="an-section-title"><i class="ti ti-users"></i> Meilleur XI (taux de victoire)</div>
      <div class="an-xi-grid">
        ${bestXI.map((p, i) => {
          const player = State.players.find(x => x.id === p.player_id);
          const cards  = State.cards[p.player_id] || [];
          const card   = cards[0];
          const pos    = card && card.efhub_stats ? (card.efhub_stats.position || '') : '';
          const efhubId = player ? Efhub.parseId(player.efhub_url || '') : null;
          const imgUrl  = efhubId ? Efhub.imgUrl(efhubId) : null;
          const ratingColor = p.winRate >= 70 ? '#34d399' : p.winRate >= 50 ? '#f59e0b' : '#f87171';
          return `
          <div class="an-xi-card">
            <div class="an-xi-rank">#${i+1}</div>
            ${imgUrl ? `<img src="${imgUrl}" class="an-xi-img" onerror="this.style.display='none'">` : ''}
            <div class="an-xi-name">${player ? player.name : '?'}</div>
            <div class="an-xi-pos">${pos}</div>
            <div class="an-xi-wr" style="color:${ratingColor}">${p.winRate}%</div>
            <div class="an-xi-sub">⚽${p.goals} 🎯${p.assists} ★${p.avgRating||'—'}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

  // ── Top joueurs ──
  const topPlayersHtml = byPlayer.length === 0 ? '' : `
    <div class="an-section">
      <div class="an-section-title"><i class="ti ti-award"></i> Classements joueurs</div>
      <div class="an-players-grid">
        <div class="an-players-col">
          <div class="an-players-col-title">⚽ Top buteurs</div>
          ${byPlayer.filter(p => p.goals > 0).slice(0, 5).map((p, i) => {
            const player = State.players.find(x => x.id === p.player_id);
            return `<div class="an-player-row">
              <span class="an-player-rank">${i+1}</span>
              <span class="an-player-name">${player ? player.name : '?'}</span>
              <span class="an-player-val">${p.goals} ⚽</span>
            </div>`;
          }).join('')}
        </div>
        <div class="an-players-col">
          <div class="an-players-col-title">🎯 Top passeurs</div>
          ${[...byPlayer].sort((a,b) => b.assists - a.assists).filter(p => p.assists > 0).slice(0, 5).map((p, i) => {
            const player = State.players.find(x => x.id === p.player_id);
            return `<div class="an-player-row">
              <span class="an-player-rank">${i+1}</span>
              <span class="an-player-name">${player ? player.name : '?'}</span>
              <span class="an-player-val">${p.assists} 🎯</span>
            </div>`;
          }).join('')}
        </div>
        <div class="an-players-col">
          <div class="an-players-col-title">★ Meilleures notes</div>
          ${[...byPlayer].filter(p => p.avgRating > 0).sort((a,b) => b.avgRating - a.avgRating).slice(0, 5).map((p, i) => {
            const player = State.players.find(x => x.id === p.player_id);
            return `<div class="an-player-row">
              <span class="an-player-rank">${i+1}</span>
              <span class="an-player-name">${player ? player.name : '?'}</span>
              <span class="an-player-val" style="color:var(--accent)">${p.avgRating} ★</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;

  return `
    <div class="analyse-page">
      ${kpiHtml}
      ${serieHtml}
      ${coachingHtml}
      ${byTypeHtml}
      ${byRankHtml}
      ${byFormHtml}
      ${byCoachHtml}
      ${byBuildHtml}
      ${bestXIHtml}
      ${topPlayersHtml}
    </div>`;
}

function renderSerieBlock(title, count, matches, type) {
  return `
    <div class="serie-block">
      <div class="serie-header">
        <span class="serie-title">${title}</span>
        <span class="serie-badge ${type}">${count} victoire${count > 1 ? 's' : ''}</span>
      </div>
      <div class="serie-timeline">
        ${matches.map(m => `
          <div class="match-dot ${m.result === 'V' ? 'w' : m.result === 'N' ? 'd' : 'l'}">
            ${m.result}
          </div>
        `).join('')}
        ${matches.length === 0 ? '<span style="color:#4b5563;font-size:11px">Aucun match</span>' : ''}
      </div>
      ${matches.length > 0 ? `
        <div class="serie-stats">
          <div class="serie-stat">
            <div class="serie-stat-val" style="color:#34d399">${count}</div>
            <div class="serie-stat-label">Victoires</div>
          </div>
          <div class="serie-stat">
            <div class="serie-stat-val">${matches.reduce((s,m)=>s+(m.score_for||0),0)}</div>
            <div class="serie-stat-label">Buts marqués</div>
          </div>
          <div class="serie-stat">
            <div class="serie-stat-val">${matches.reduce((s,m)=>s+(m.score_against||0),0)}</div>
            <div class="serie-stat-label">Buts encaissés</div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// ── Onglet Matchs global ──────────────────────────────────────────────────────
// ── Filtres matchs ────────────────────────────────────────────────────────────
var _matchFilters = {
  result: '',       // V | N | D | ''
  matchType: '',
  rank: '',
  formation: '',
  coach: '',
  search: '',
};
var _matchSort = 'desc'; // desc | asc

function setMatchFilter(key, val) {
  _matchFilters[key] = val;
  refreshMatchsGlobal();
}

function setMatchSort(val) {
  _matchSort = val;
  refreshMatchsGlobal();
}

function clearMatchFilters() {
  _matchFilters = { result: '', matchType: '', rank: '', formation: '', coach: '', search: '' };
  _matchSort = 'desc';
  refreshMatchsGlobal();
}

function refreshMatchsGlobal() {
  var el = document.querySelector('.matchs-page');
  if (el) el.outerHTML = renderMatchsGlobal();
}

function getFilteredMatches() {
  var f = _matchFilters;
  var matches = State.matches.slice();

  // Tri
  matches.sort(function(a, b) {
    var da = new Date(a.played_at), db = new Date(b.played_at);
    return _matchSort === 'asc' ? da - db : db - da;
  });

  // Filtres
  if (f.result)    matches = matches.filter(function(m) { return m.result === f.result; });
  if (f.matchType) matches = matches.filter(function(m) { return m.match_type === f.matchType; });
  if (f.rank)      matches = matches.filter(function(m) { return (m.rank || '') === f.rank; });
  if (f.formation) matches = matches.filter(function(m) { return (m.formation || '') === f.formation; });
  if (f.coach)     matches = matches.filter(function(m) { return (m.coach_id || '') === f.coach; });
  if (f.search) {
    var q = f.search.toLowerCase();
    matches = matches.filter(function(m) {
      return (m.opp_name || '').toLowerCase().includes(q) ||
             (m.formation || '').toLowerCase().includes(q) ||
             (m.match_type || '').toLowerCase().includes(q);
    });
  }
  return matches;
}

function renderMatchsGlobal() {
  var q = String.fromCharCode(39);
  var filtered = getFilteredMatches();
  var total = State.matches.length;
  var f = _matchFilters;

  // Options dynamiques depuis les matchs existants
  var matchTypes = [...new Set(State.matches.map(function(m) { return m.match_type; }).filter(Boolean))];
  var ranks = [...new Set(State.matches.map(function(m) { return m.rank; }).filter(Boolean))];
  var formations = [...new Set(State.matches.map(function(m) { return m.formation; }).filter(Boolean))].sort();
  var hasFilters = Object.values(f).some(function(v) { return v !== ''; }) || _matchSort !== 'desc';

  // Labels match type
  var typeLabels = {
    ligue_jcj_d1: '🏆 Ligue JCJ D1', ligue_jcj_d2: '🏆 Ligue JCJ D2', ligue_jcj_d3: '🏆 Ligue JCJ D3',
    ligue_ia_d1: '🤖 Ligue IA D1',  ligue_ia_d2: '🤖 Ligue IA D2',  ligue_ia_d3: '🤖 Ligue IA D3',
    event_jcj: '🎯 Évènement JCJ', event_ia: '🎯 Évènement IA',
    amical: '🤝 Amical', my_league: '⚽ My League',
  };

  return `<div class="matchs-page">
    <style>
      .matchs-page{display:flex;flex-direction:column;gap:10px;padding:12px 14px;height:calc(100vh - 96px);overflow-y:auto}
      .matchs-search-bar{display:flex;align-items:center;gap:8px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:6px 10px;margin-bottom:8px}
      .matchs-search-input{flex:1;background:none;border:none;outline:none;color:var(--text);font-size:13px}
      .matchs-filters{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;align-items:center}
      .mf-group{display:flex;gap:4px}
      .mf-btn{padding:4px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer}
      .mf-btn:hover{border-color:var(--accent);color:var(--text)}
      .mf-btn-active{background:var(--accent);color:#fff;border-color:var(--accent)}
      .mf-btn-reset{background:var(--surface3);color:var(--red);border-color:var(--red)}
      .mf-select{padding:4px 8px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:12px;outline:none;cursor:pointer}
      .mf-select:focus{border-color:var(--accent)}
      .matchs-quick-stats{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:var(--surface2);border-radius:8px;padding:6px 10px;margin-bottom:8px;font-size:12px}
      .mqs-item{font-weight:600}.mqs-item.win{color:var(--green)}.mqs-item.draw{color:var(--amber)}.mqs-item.loss{color:var(--red)}.mqs-item.muted{color:var(--muted)}.mqs-sep{color:var(--border)}
      .match-score-line{display:flex;align-items:center;gap:8px}
      .match-opp{font-size:13px;font-weight:600;color:var(--text)}
      .match-meta-line{display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-top:2px}
      .match-tag{font-size:10px;padding:1px 6px;border-radius:6px;background:var(--surface3);color:var(--muted)}
      .match-tag.coach{color:var(--accent-light)}
      .match-tag.rank{color:var(--gold)}
      .match-date{font-size:10px;color:var(--muted);margin-left:auto}
    </style>
    <div class="matchs-page-header">
      <span class="matchs-count">${filtered.length}${filtered.length !== total ? '/' + total : ''} match${total > 1 ? 's' : ''}</span>
      <button class="btn-sm btn-primary" onclick="openModal('addMatch',null)">+ Enregistrer</button>
    </div>

    <!-- Barre de recherche -->
    <div class="matchs-search-bar">
      <i class="ti ti-search" style="color:var(--muted);font-size:14px"></i>
      <input type="text" placeholder="Rechercher adversaire, formation..." value="${f.search}"
        oninput="setMatchFilter('search', this.value)"
        class="matchs-search-input">
      ${f.search ? `<button class="btn-icon" onclick="setMatchFilter('search','')"><i class="ti ti-x"></i></button>` : ''}
    </div>

    <!-- Filtres -->
    <div class="matchs-filters">
      <!-- Résultat -->
      <div class="mf-group">
        ${['','V','N','D'].map(function(r) {
          var labels = {'':'Tous', V:'✅ V', N:'🟡 N', D:'❌ D'};
          var active = f.result === r;
          return `<button class="mf-btn ${active ? 'mf-btn-active' : ''}" onclick="setMatchFilter('result','${r}')">${labels[r]}</button>`;
        }).join('')}
      </div>

      <!-- Type de match -->
      <select class="mf-select" onchange="setMatchFilter('matchType', this.value)">
        <option value="">Tous les types</option>
        ${matchTypes.map(function(t) {
          return `<option value="${t}" ${f.matchType === t ? 'selected' : ''}>${typeLabels[t] || t}</option>`;
        }).join('')}
      </select>

      <!-- Rang -->
      <select class="mf-select" onchange="setMatchFilter('rank', this.value)">
        <option value="">Tous les rangs</option>
        ${ranks.map(function(r) {
          return `<option value="${r}" ${f.rank === r ? 'selected' : ''}>${r}</option>`;
        }).join('')}
      </select>

      <!-- Formation -->
      <select class="mf-select" onchange="setMatchFilter('formation', this.value)">
        <option value="">Toutes formations</option>
        ${formations.map(function(fm) {
          return `<option value="${fm}" ${f.formation === fm ? 'selected' : ''}>${fm}</option>`;
        }).join('')}
      </select>

      <!-- Coach -->
      ${State.coaches.length > 0 ? `
      <select class="mf-select" onchange="setMatchFilter('coach', this.value)">
        <option value="">Tous les coachs</option>
        ${State.coaches.map(function(c) {
          return `<option value="${c.id}" ${f.coach === c.id ? 'selected' : ''}>${c.name}</option>`;
        }).join('')}
      </select>` : ''}

      <!-- Tri + Reset -->
      <div class="mf-group" style="margin-left:auto">
        <button class="mf-btn ${_matchSort === 'desc' ? 'mf-btn-active' : ''}" onclick="setMatchSort('desc')" title="Plus récent">↓</button>
        <button class="mf-btn ${_matchSort === 'asc' ? 'mf-btn-active' : ''}" onclick="setMatchSort('asc')" title="Plus ancien">↑</button>
        ${hasFilters ? `<button class="mf-btn mf-btn-reset" onclick="clearMatchFilters()" title="Effacer filtres"><i class="ti ti-filter-off"></i></button>` : ''}
      </div>
    </div>

    <!-- Stats rapides des matchs filtrés -->
    ${filtered.length > 0 ? (function() {
      var wins = filtered.filter(function(m) { return m.result === 'V'; }).length;
      var draws = filtered.filter(function(m) { return m.result === 'N'; }).length;
      var losses = filtered.filter(function(m) { return m.result === 'D'; }).length;
      var gf = filtered.reduce(function(s,m) { return s + (m.score_for||0); }, 0);
      var ga = filtered.reduce(function(s,m) { return s + (m.score_against||0); }, 0);
      var wr = Math.round(wins / filtered.length * 100);
      return `<div class="matchs-quick-stats">
        <span class="mqs-item win">${wins}V</span>
        <span class="mqs-item draw">${draws}N</span>
        <span class="mqs-item loss">${losses}D</span>
        <span class="mqs-sep">·</span>
        <span class="mqs-item">${wr}% victoires</span>
        <span class="mqs-sep">·</span>
        <span class="mqs-item">${gf} buts pour</span>
        <span class="mqs-item muted">${ga} contre</span>
      </div>`;
    })() : ''}

    <!-- Liste des matchs -->
    <div class="match-list">
      ${filtered.length === 0
        ? `<div class="empty-state"><i class="ti ti-filter-off" style="font-size:32px;color:var(--border)"></i><p>${hasFilters ? 'Aucun match avec ces filtres' : 'Aucun match enregistré'}</p></div>`
        : filtered.map(function(m) { return renderMatchRow(m); }).join('')}
    </div>
  </div>`;
}

// ── Modals ────────────────────────────────────────────────────────────────────
function renderModals() {
  return `<div id="modal-overlay" class="modal-overlay hidden" onclick="closeModal()"></div>
          <div id="modal-container" class="modal-container hidden"></div>`;
}

function openModal(type, id) {
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-container').classList.remove('hidden');
  const container = document.getElementById('modal-container');

  if (type === 'addPlayer')  container.innerHTML = renderModalAddPlayer();
  if (type === 'editPlayer') container.innerHTML = renderModalEditPlayer(id);
  if (type === 'addCard')    container.innerHTML = renderModalAddCard(id);
  if (type === 'addBuild')   container.innerHTML = renderModalAddBuild(id);
  if (type === 'editBuild')  container.innerHTML = renderModalEditBuild(id);
  if (type === 'addMatch')   {
    container.innerHTML = renderModalAddMatch(id);
    setTimeout(applyLastInstructions, 100);
  }
  if (type === 'editMatch')  container.innerHTML = renderModalEditMatch(id);
  if (type === 'addCoach')   container.innerHTML = renderModalAddCoach();
  if (type === 'editCoach')  container.innerHTML = renderModalEditCoach(id);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-container').classList.add('hidden');
}

// Modal — Ajouter joueur
function renderModalAddPlayer() {
  return `
    <div class="modal">
      <div class="modal-header">
        <h3>Ajouter un joueur</h3>
        <button class="btn-icon" onclick="closeModal()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Nom du joueur</label>
          <input type="text" id="m-player-name" placeholder="Ex: Rodrygo" class="form-input">
        </div>
        <div class="form-group">
          <label>Lien efhub</label>
          <div class="efhub-input-wrap">
            <input type="text" id="m-efhub-url" placeholder="https://efhub.com/players/..."
                   class="form-input" oninput="onEfhubUrlInput(this.value)">
            <button class="btn-sm btn-primary" id="btn-efhub-import"
                    onclick="importFromEfhub()" disabled>
              🔍 Importer
            </button>
          </div>
          <div id="efhub-import-status"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-sm btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn-sm btn-primary" onclick="savePlayer()">Ajouter</button>
      </div>
    </div>
  `;
}

// Modal — Modifier joueur
function renderModalEditPlayer(playerId) {
  const player = State.players.find(p => p.id === playerId);
  if (!player) return '';
  return `
    <div class="modal">
      <div class="modal-header">
        <h3>Modifier ${player.name}</h3>
        <button class="btn-icon" onclick="closeModal()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Nom</label>
          <input type="text" id="m-player-name" value="${player.name}" class="form-input">
        </div>
        <div class="form-group">
          <label>Lien efhub</label>
          <input type="text" id="m-efhub-url" value="${player.efhub_url || ''}" class="form-input">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-sm btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn-sm btn-primary" onclick="updatePlayer('${playerId}')">Sauvegarder</button>
      </div>
    </div>
  `;
}

// Modal — Ajouter carte
function renderModalAddCard(playerId) {
  return `
    <div class="modal modal-lg">
      <div class="modal-header">
        <h3>Ajouter une carte</h3>
        <button class="btn-icon" onclick="closeModal()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Lien efhub</label>
          <div class="efhub-input-wrap">
            <input type="text" id="m-card-efhub-url" placeholder="https://efhub.com/players/..."
                   class="form-input" oninput="onCardEfhubInput(this.value)">
            <button class="btn-sm btn-primary" id="btn-card-import"
                    onclick="importCardFromEfhub('${playerId}')" disabled>
              🔍 Importer
            </button>
          </div>
          <div id="card-import-status"></div>
        </div>
        <div id="card-form-fields" class="hidden">
          <div class="form-row">
            <div class="form-group">
              <label>Level Cap</label>
              <input type="number" id="m-level-cap" class="form-input" min="1" max="50"
                     oninput="updatePointsMax(this.value)">
            </div>
            <div class="form-group">
              <label>Points max</label>
              <input type="number" id="m-points-max" class="form-input" readonly>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Playing Style</label>
              <input type="text" id="m-playing-style" class="form-input" placeholder="Ex: Prolific Winger">
            </div>
            <div class="form-group">
              <label>Card Type</label>
              <input type="text" id="m-card-type" class="form-input" placeholder="Ex: Featured">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Booster natif</label>
              <input type="text" id="m-booster-native" class="form-input" placeholder="Ex: Dribbling">
            </div>
            <div class="form-group">
              <label>Booster supplémentaire</label>
              <input type="text" id="m-booster-extra" class="form-input" placeholder="Ex: Pace">
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-sm btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn-sm btn-primary" id="btn-save-card" class="hidden"
                onclick="saveCard('${playerId}')">Ajouter la carte</button>
      </div>
    </div>
  `;
}

// Modal — Ajouter build
function renderModalAddBuild(cardId) {
  const card = Object.values(State.cards).flat().find(c => c.id === cardId);
  if (!card) return '';
  const pointsMax = card.points_max || 0;
  const isTrending = card.card_type === 'Trending';

  if (isTrending) {
    return `
      <div class="modal">
        <div class="modal-header">
          <h3>Carte Trending</h3>
          <button class="btn-icon" onclick="closeModal()"><i class="ti ti-x"></i></button>
        </div>
        <div class="modal-body">
          <p style="color:var(--muted);font-size:13px">Les cartes Trending sont figées — aucun développement possible.</p>
        </div>
        <div class="modal-footer">
          <button class="btn-sm btn-ghost" onclick="closeModal()">Fermer</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="modal modal-lg">
      <div class="modal-header">
        <h3>Nouveau build</h3>
        <button class="btn-icon" onclick="closeModal()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Nom du build</label>
          <input type="text" id="m-build-name" placeholder="Ex: Build Vitesse Max" class="form-input">
        </div>
        <div class="build-points-display">
          Points utilisés : <span id="build-pts-used">0</span> / ${pointsMax}
          <div class="build-pts-bar-wrap">
            <div class="build-pts-bar" id="build-pts-bar" style="width:0%"></div>
          </div>
        </div>
        <div class="build-sliders-form">
          ${SLIDERS_CONFIG.map(s => {
            // Calculer la stat de base moyenne pour ce slider
            const affectedStats = s.stats.map(sk => card.efhub_stats?.[sk] || 0);
            const avgBase = affectedStats.length > 0 ? Math.round(affectedStats.reduce((a,b)=>a+b,0)/affectedStats.length) : 0;
            return `
              <div class="build-slider-form-row">
                <div class="build-slider-svg-icon" style="display:flex;align-items:center;justify-content:center;color:#e2e8f0">${s.icon}</div>
                <div class="build-slider-form-info">
                  <span class="build-slider-form-label">${s.label}</span>
                  <span class="build-slider-form-stats">${s.stats.map(sk => {
                    const statDef = EFB_STATS_ORDER.find(e => e.key === sk);
                    return statDef ? statDef.label : sk;
                  }).join(', ')}</span>
                </div>
                <div class="build-slider-controls">
                  <button class="btn-click" onclick="adjustSlider('${s.key}',-1,'${cardId}')">−</button>
                  <span class="build-slider-val" id="slider-val-${s.key}">0</span>
                  <button class="btn-click" onclick="adjustSlider('${s.key}',1,'${cardId}')">+</button>
                </div>
                <span class="build-slider-cost" id="slider-cost-${s.key}">0 pts</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-sm btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn-sm btn-primary" onclick="saveBuild('${cardId}')">Sauvegarder</button>
      </div>
    </div>
  `;
}

// Modal — Enregistrer match
// ── État temporaire modal match ───────────────────────────────────────────────
var _matchPlayerStats = {};
var _matchTitulaires = [];   // [{player_id, card_id}]
var _matchRemplacants = [];  // [{player_id, card_id}]
var _matchSubs = [];         // [{out_player_id, in_player_id, minute}]

function saveLineupToStorage() {
  try {
    localStorage.setItem(LINEUP_STORAGE_KEY, JSON.stringify({
      titulaires: _matchTitulaires,
      remplacants: _matchRemplacants
    }));
  } catch(e) {}
}

function loadLineupFromStorage() {
  try {
    const saved = localStorage.getItem(LINEUP_STORAGE_KEY);
    if (!saved) return;
    const data = JSON.parse(saved);
    // Vérifier que les joueurs existent encore
    const allPlayerIds = State.players.map(p => p.id);
    const allCardIds = Object.values(State.cards).flat().map(c => c.id);
    if (data.titulaires) {
      _matchTitulaires = data.titulaires.filter(s =>
        allPlayerIds.includes(s.player_id) && allCardIds.includes(s.card_id)
      );
    }
    if (data.remplacants) {
      _matchRemplacants = data.remplacants.filter(s =>
        allPlayerIds.includes(s.player_id) && allCardIds.includes(s.card_id)
      );
    }
  } catch(e) {}
}

function loadSquad23IntoLineup() {
  loadSquad23();

  // Priorité 1 : données de l'onglet Formation (FT_STORAGE_KEY)
  var ftData = null;
  try {
    var fts = localStorage.getItem(FT_STORAGE_KEY);
    if (fts) ftData = JSON.parse(fts);
  } catch(e) {}

  if (ftData && ftData.titulaires && ftData.titulaires.some(function(t) { return t && t.player_id; })) {
    var allPids = State.players.map(function(p) { return p.id; });
    var allCids = Object.values(State.cards).flat().map(function(c) { return c.id; });

    // Titulaires — garder l'ordre des slots, ignorer les postes vides
    _matchTitulaires = (ftData.titulaires || [])
      .filter(function(t) { return t && t.player_id && allPids.includes(t.player_id); })
      .map(function(t) {
        // Résoudre card_id si absent
        var card_id = t.card_id && allCids.includes(t.card_id) ? t.card_id : null;
        if (!card_id) {
          var sq = _squad23.find(function(s) { return s.player_id === t.player_id; });
          if (sq) card_id = sq.card_id;
          else {
            var cards = Object.values(State.cards).flat().filter(function(c) {
              return State.cards[t.player_id] && State.cards[t.player_id].some(function(x) { return x.id === c.id; });
            });
            if (cards.length) card_id = cards[0].id;
          }
        }
        var sq2 = _squad23.find(function(s) { return s.player_id === t.player_id; });
        return { player_id: t.player_id, card_id: card_id, build_id: sq2 ? sq2.build_id : null };
      });

    _matchRemplacants = (ftData.remplacants || [])
      .filter(function(t) { return t && t.player_id && allPids.includes(t.player_id); })
      .map(function(t) {
        var card_id = t.card_id && allCids.includes(t.card_id) ? t.card_id : null;
        if (!card_id) {
          var sq = _squad23.find(function(s) { return s.player_id === t.player_id; });
          if (sq) card_id = sq.card_id;
        }
        var sq2 = _squad23.find(function(s) { return s.player_id === t.player_id; });
        return { player_id: t.player_id, card_id: card_id, build_id: sq2 ? sq2.build_id : null };
      });

    // Pré-remplir la formation dans le modal match
    if (ftData.formation) _matchLastFormation = ftData.formation;
    return;
  }

  // Priorité 2 : LINEUP_STORAGE_KEY (ancien système)
  var saved = null;
  try {
    var s = localStorage.getItem(LINEUP_STORAGE_KEY);
    if (s) saved = JSON.parse(s);
  } catch(e) {}

  if (saved && saved.titulaires && saved.titulaires.length > 0) {
    var allPids2 = State.players.map(function(p) { return p.id; });
    var allCids2 = Object.values(State.cards).flat().map(function(c) { return c.id; });
    _matchTitulaires = (saved.titulaires || []).filter(function(s) {
      return allPids2.includes(s.player_id);
    }).map(function(sel) {
      var sq = _squad23.find(function(s) { return s.player_id === sel.player_id; });
      return { player_id: sel.player_id, card_id: sel.card_id, build_id: sq ? sq.build_id : null };
    });
    _matchRemplacants = (saved.remplacants || []).filter(function(s) {
      return allPids2.includes(s.player_id);
    }).map(function(sel) {
      var sq = _squad23.find(function(s) { return s.player_id === sel.player_id; });
      return { player_id: sel.player_id, card_id: sel.card_id, build_id: sq ? sq.build_id : null };
    });
  } else if (_squad23.length > 0) {
    _matchTitulaires = _squad23.slice(0, 11).map(function(s) {
      return { player_id: s.player_id, card_id: s.card_id, build_id: s.build_id, played: true };
    });
    _matchRemplacants = _squad23.slice(11).map(function(s) {
      return { player_id: s.player_id, card_id: s.card_id, build_id: s.build_id, played: false };
    });
  } else {
    _matchTitulaires = [];
    _matchRemplacants = [];
  }
}

// ── État modal match ──────────────────────────────────────────────────────────
var _matchActiveTab = 'match'; // match | compo | stats | resume
var _pitchSelectedPid = null;  // joueur sélectionné sur le terrain
var _pitchSelectedSlot = null; // slot index sélectionné pour échange
var _pitchSubMode = false;     // mode sélection remplaçant
var _pitchSubOutPid = null;    // joueur sortant en cours

// ── Formations → positions (% left, % top depuis but adverse en haut) ─────────
// ── Formations préétablies ────────────────────────────────────────────────────
var FORMATION_LAYOUTS = {
  '4-3-3':     { gk:[[50,88]], def:[[15,70],[37,70],[63,70],[85,70]], mid:[[25,50],[50,47],[75,50]], att:[[18,25],[50,20],[82,25]] },
  '4-3-3 ATT': { gk:[[50,88]], def:[[15,72],[37,72],[63,72],[85,72]], mid:[[22,52],[50,48],[78,52]], att:[[18,22],[50,17],[82,22]] },
  '4-3-3 DEF': { gk:[[50,88]], def:[[15,68],[37,68],[63,68],[85,68]], mid:[[22,53],[50,50],[78,53]], att:[[18,28],[50,23],[82,28]] },
  '4-4-2':     { gk:[[50,88]], def:[[15,70],[37,70],[63,70],[85,70]], mid:[[12,50],[37,50],[63,50],[88,50]], att:[[33,25],[67,25]] },
  '4-4-2 FLAT':{ gk:[[50,88]], def:[[15,70],[37,70],[63,70],[85,70]], mid:[[12,52],[37,52],[63,52],[88,52]], att:[[33,28],[67,28]] },
  '4-2-3-1':   { gk:[[50,88]], def:[[15,70],[37,70],[63,70],[85,70]], mid:[[33,60],[67,60],[18,40],[50,37],[82,40]], att:[[50,20]] },
  '4-1-4-1':   { gk:[[50,88]], def:[[15,70],[37,70],[63,70],[85,70]], mid:[[50,62],[12,48],[37,48],[63,48],[88,48]], att:[[50,20]] },
  '4-3-1-2':   { gk:[[50,88]], def:[[15,70],[37,70],[63,70],[85,70]], mid:[[22,55],[50,52],[78,55]], att:[[50,37],[33,22],[67,22]] },
  '4-3-2-1':   { gk:[[50,88]], def:[[15,70],[37,70],[63,70],[85,70]], mid:[[22,55],[50,52],[78,55]], att:[[33,35],[67,35],[50,20]] },
  '4-4-1-1':   { gk:[[50,88]], def:[[15,70],[37,70],[63,70],[85,70]], mid:[[12,52],[37,52],[63,52],[88,52]], att:[[50,33],[50,20]] },
  '4-5-1':     { gk:[[50,88]], def:[[15,70],[37,70],[63,70],[85,70]], mid:[[10,50],[28,48],[50,45],[72,48],[90,50]], att:[[50,20]] },
  '3-5-2':     { gk:[[50,88]], def:[[25,72],[50,72],[75,72]], mid:[[8,52],[28,48],[50,47],[72,48],[92,52]], att:[[33,25],[67,25]] },
  '3-4-3':     { gk:[[50,88]], def:[[25,72],[50,72],[75,72]], mid:[[15,53],[38,53],[62,53],[85,53]], att:[[18,25],[50,20],[82,25]] },
  '3-4-2-1':   { gk:[[50,88]], def:[[25,72],[50,72],[75,72]], mid:[[15,55],[38,55],[62,55],[85,55]], att:[[33,35],[67,35],[50,20]] },
  '3-3-3-1':   { gk:[[50,88]], def:[[25,72],[50,72],[75,72]], mid:[[22,57],[50,55],[78,57]], att:[[18,37],[50,35],[82,37],[50,20]] },
  '5-3-2':     { gk:[[50,88]], def:[[8,72],[27,70],[50,72],[73,70],[92,72]], mid:[[22,50],[50,47],[78,50]], att:[[33,25],[67,25]] },
  '5-4-1':     { gk:[[50,88]], def:[[8,72],[27,70],[50,72],[73,70],[92,72]], mid:[[12,52],[37,52],[63,52],[88,52]], att:[[50,20]] },
  '5-2-3':     { gk:[[50,88]], def:[[8,72],[27,70],[50,72],[73,70],[92,72]], mid:[[33,52],[67,52]], att:[[18,25],[50,20],[82,25]] },
  '5-2-2-1':   { gk:[[50,88]], def:[[8,72],[27,70],[50,72],[73,70],[92,72]], mid:[[33,55],[67,55]], att:[[33,33],[67,33],[50,20]] },
  '4-6-0':     { gk:[[50,88]], def:[[15,70],[37,70],[63,70],[85,70]], mid:[[8,50],[25,47],[42,45],[58,45],[75,47],[92,50]], att:[] },
};

var POSITION_LABELS_BY_FORMATION = {
  '4-3-3':     ['GK','LB','CB','CB','RB','DMF','CMF','DMF','LWF','CF','RWF'],
  '4-3-3 ATT': ['GK','LB','CB','CB','RB','DMF','CMF','AMF','LWF','CF','RWF'],
  '4-3-3 DEF': ['GK','LB','CB','CB','RB','DMF','CMF','DMF','LWF','CF','RWF'],
  '4-4-2':     ['GK','LB','CB','CB','RB','LMF','CMF','CMF','RMF','CF','SS'],
  '4-4-2 FLAT':['GK','LB','CB','CB','RB','LMF','CMF','CMF','RMF','CF','SS'],
  '4-2-3-1':   ['GK','LB','CB','CB','RB','DMF','CMF','LWF','AMF','RWF','CF'],
  '4-1-4-1':   ['GK','LB','CB','CB','RB','DMF','LMF','AMF','AMF','RMF','CF'],
  '4-3-1-2':   ['GK','LB','CB','CB','RB','DMF','DMF','DMF','AMF','CF','SS'],
  '4-3-2-1':   ['GK','LB','CB','CB','RB','DMF','DMF','DMF','SS','SS','CF'],
  '4-4-1-1':   ['GK','LB','CB','CB','RB','LMF','DMF','DMF','RMF','SS','CF'],
  '4-5-1':     ['GK','LB','CB','CB','RB','LMF','DMF','AMF','DMF','RMF','CF'],
  '3-5-2':     ['GK','CB','CB','CB','LMF','DMF','CMF','DMF','RMF','CF','SS'],
  '3-4-3':     ['GK','CB','CB','CB','LMF','CMF','CMF','RMF','LWF','CF','RWF'],
  '3-4-2-1':   ['GK','CB','CB','CB','LMF','DMF','DMF','RMF','SS','SS','CF'],
  '3-3-3-1':   ['GK','CB','CB','CB','DMF','DMF','DMF','LWF','CF','RWF','CF'],
  '5-3-2':     ['GK','LB','CB','CB','CB','RB','DMF','AMF','DMF','CF','SS'],
  '5-4-1':     ['GK','LB','CB','CB','CB','RB','LMF','DMF','DMF','RMF','CF'],
  '5-2-3':     ['GK','LB','CB','CB','CB','RB','DMF','DMF','LWF','CF','RWF'],
  '5-2-2-1':   ['GK','LB','CB','CB','CB','RB','DMF','DMF','SS','SS','CF'],
  '4-6-0':     ['GK','LB','CB','CB','RB','LMF','DMF','AMF','AMF','DMF','RMF'],
};

// ── Formations personnalisées (localStorage) ──────────────────────────────────
var CUSTOM_FORMATIONS_KEY = 'efb_custom_formations';

function loadCustomFormations() {
  try {
    var data = localStorage.getItem(CUSTOM_FORMATIONS_KEY);
    return data ? JSON.parse(data) : {};
  } catch(e) { return {}; }
}

// Charger les formations depuis Supabase et synchroniser avec localStorage
async function syncFormationsFromSupabase() {
  try {
    var remote = await Formations.getAll();
    if (!remote || remote.length === 0) return;
    var customs = {};
    remote.forEach(function(f) {
      customs[f.name] = { slots: f.slots, custom: true, supabase_id: f.id };
    });
    localStorage.setItem(CUSTOM_FORMATIONS_KEY, JSON.stringify(customs));
    loadAllCustomFormations();
  } catch(e) { console.warn('Sync formations Supabase échoué:', e); }
}

function saveCustomFormation(name, slots) {
  try {
    var customs = loadCustomFormations();
    customs[name] = { slots: slots, custom: true };
    localStorage.setItem(CUSTOM_FORMATIONS_KEY, JSON.stringify(customs));
    injectCustomFormation(name, slots);
  } catch(e) {}
  // Sauvegarder dans Supabase
  Formations.create(name, slots).catch(function(e) {
    console.warn('Sauvegarde Supabase formation échouée:', e);
  });
}

function deleteCustomFormation(name) {
  try {
    var customs = loadCustomFormations();
    delete customs[name];
    localStorage.setItem(CUSTOM_FORMATIONS_KEY, JSON.stringify(customs));
    delete FORMATION_LAYOUTS[name];
    delete POSITION_LABELS_BY_FORMATION[name];
  } catch(e) {}
  // Supprimer dans Supabase
  Formations.deleteByName(name).catch(function(e) {
    console.warn('Suppression Supabase formation échouée:', e);
  });
}

function injectCustomFormation(name, slots) {
  // Ne pas écraser les formations builtin (sécurité supplémentaire)
  var isBuiltin = FORMATION_LAYOUTS[name] && !FORMATION_LAYOUTS[name]._custom_slots;
  if (isBuiltin) return;
  FORMATION_LAYOUTS[name] = { _custom_slots: slots };
  POSITION_LABELS_BY_FORMATION[name] = slots.map(function(s) { return s.label || '?'; });
}

function loadAllCustomFormations() {
  var customs = loadCustomFormations();
  Object.keys(customs).forEach(function(name) {
    injectCustomFormation(name, customs[name].slots);
  });
}

function getFormationLayout(formation) {
  if (!formation) return null;
  var f = formation.trim();
  if (FORMATION_LAYOUTS[f]) return FORMATION_LAYOUTS[f];
  var normalized = f.replace(/\s/g,'');
  if (FORMATION_LAYOUTS[normalized]) return FORMATION_LAYOUTS[normalized];
  return null;
}

function buildPitchSlots(formation) {
  var layout = getFormationLayout(formation);
  if (!layout) return null;

  // Formation custom → slots directs
  if (layout._custom_slots) {
    return layout._custom_slots.map(function(s, i) {
      return { idx: i, label: s.label || '?', left: s.left, top: s.top };
    });
  }

  var slots = [];
  var labels = POSITION_LABELS_BY_FORMATION[formation.trim()] || [];
  var idx = 0;
  ['gk','def','mid','att'].forEach(function(group) {
    (layout[group] || []).forEach(function(pct) {
      slots.push({ idx: idx, label: labels[idx] || '?', left: pct[0], top: pct[1] });
      idx++;
    });
  });
  return slots;
}

// ── Modal Picker de formations ────────────────────────────────────────────────
function openFormationPicker() {
  loadAllCustomFormations();
  var customs = loadCustomFormations();
  var customNames = Object.keys(customs);
  var builtinNames = Object.keys(FORMATION_LAYOUTS).filter(function(k) { return !FORMATION_LAYOUTS[k]._custom_slots; });
  var q = String.fromCharCode(39);

  var html = '<div class="fmpicker-overlay" id="fmpicker-overlay" onclick="closeFmPickerIfBg(event)">' +
    '<div class="fmpicker-panel">' +
      '<div class="fmpicker-header">' +
        '<span class="fmpicker-title">Choisir une formation</span>' +
        '<div style="display:flex;gap:6px">' +
          '<button class="btn-sm btn-primary" onclick="openFormationEditor(null)"><i class="ti ti-plus"></i> Créer</button>' +
          '<button class="btn-icon" onclick="closeFmPicker()"><i class="ti ti-x"></i></button>' +
        '</div>' +
      '</div>' +
      '<div class="fmpicker-body">' +
        // Formations custom en premier
        (customNames.length > 0 ? (
          '<div class="fmpicker-group-title">Mes formations</div>' +
          '<div class="fmpicker-grid">' +
          customNames.map(function(name) {
            return renderFormationCard(name, true);
          }).join('') +
          '</div>'
        ) : '') +
        '<div class="fmpicker-group-title">Formations standard</div>' +
        '<div class="fmpicker-grid">' +
          builtinNames.map(function(name) {
            return renderFormationCard(name, false);
          }).join('') +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';

  var overlay = document.createElement('div');
  overlay.id = 'fmpicker-root';
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
}

function renderFormationCard(name, isCustom) {
  var q = String.fromCharCode(39);
  var slots = buildPitchSlots(name);
  if (!slots) return '';
  var miniSvg = renderMiniPitchSVG(slots);
  return '<div class="fmpicker-card" onclick="selectFormation(' + q + name.replace(/'/g,"\\'") + q + ')">' +
    miniSvg +
    '<div class="fmpicker-card-name">' + name + (isCustom ? ' <span class="badge-custom">Perso</span>' : '') + '</div>' +
    (isCustom ? '<button class="fmpicker-delete" onclick="deleteCustomFm(event,' + q + name.replace(/'/g,"\\'") + q + ')" title="Supprimer"><i class="ti ti-trash"></i></button>' : '') +
  '</div>';
}

function renderMiniPitchSVG(slots) {
  var W = 70; var H = 90;
  var nodes = slots.map(function(s) {
    var cx = Math.round(s.left / 100 * W);
    var cy = Math.round(s.top / 100 * H);
    return '<circle cx="' + cx + '" cy="' + cy + '" r="4" fill="#60a5fa" opacity="0.9"/>';
  }).join('');
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" style="display:block">' +
    '<rect x="0" y="0" width="' + W + '" height="' + H + '" rx="4" fill="#1a3a1a"/>' +
    '<line x1="4" y1="' + (H/2) + '" x2="' + (W-4) + '" y2="' + (H/2) + '" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/>' +
    '<rect x="4" y="4" width="' + (W-8) + '" height="' + (H-8) + '" rx="3" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/>' +
    nodes +
  '</svg>';
}

function selectFormation(name) {
  _matchLastFormation = name;
  // Mettre à jour les deux inputs de formation
  var fEl = document.getElementById('m-formation');
  if (fEl) fEl.value = name;
  var fqEl = document.getElementById('m-formation-quick');
  if (fqEl) fqEl.value = name;
  closeFmPicker();
  // Re-render le terrain
  onFormationInput(name);
  // Si terrain pas encore visible, re-render tout l'onglet
  var pitchCol = document.querySelector('.match-pitch-col');
  if (pitchCol && !pitchCol.querySelector('svg')) {
    var el = document.getElementById('match-tab-content');
    if (el) el.innerHTML = renderMatchTabMain();
  }
}

function closeFmPicker() {
  var root = document.getElementById('fmpicker-root');
  if (root) root.remove();
}

function closeFmPickerIfBg(e) {
  if (e.target.id === 'fmpicker-overlay') closeFmPicker();
}

function deleteCustomFm(e, name) {
  e.stopPropagation();
  if (!confirm('Supprimer la formation "' + name + '" ?')) return;
  deleteCustomFormation(name);
  closeFmPicker();
  openFormationPicker();
}

// ── Éditeur de formation (drag & drop SVG) ────────────────────────────────────
var _fmEditorSlots = [];      // [{idx, label, left, top}]
var _fmEditorDragging = null; // idx du nœud en cours de drag
var _fmEditorBaseName = '';

function openFormationEditor(baseName) {
  loadAllCustomFormations();
  _fmEditorBaseName = baseName || '';
  var customs = loadCustomFormations();

  if (baseName && FORMATION_LAYOUTS[baseName]) {
    // Partir d'une base existante
    var slots = buildPitchSlots(baseName);
    _fmEditorSlots = slots.map(function(s) {
      return { idx: s.idx, label: s.label, left: s.left, top: s.top };
    });
  } else {
    // Formation vide — 4-3-3 par défaut
    var defaultSlots = buildPitchSlots('4-3-3');
    _fmEditorSlots = defaultSlots.map(function(s) {
      return { idx: s.idx, label: s.label, left: s.left, top: s.top };
    });
  }

  closeFmPicker();
  renderFmEditor();
}

function renderFmEditor() {
  var existing = document.getElementById('fmeditor-root');
  if (existing) existing.remove();

  var customs = loadCustomFormations();
  var q = String.fromCharCode(39);

  var html = '<div class="fmeditor-overlay" id="fmeditor-overlay">' +
    '<div class="fmeditor-panel">' +
      '<div class="fmeditor-header">' +
        '<span class="fmeditor-title">Éditeur de formation</span>' +
        '<button class="btn-icon" onclick="closeFmEditor()"><i class="ti ti-x"></i></button>' +
      '</div>' +
      '<div class="fmeditor-body">' +
        '<div class="fmeditor-pitch-wrap">' +
          '<div id="fmeditor-pitch">' + renderEditorPitchSVG() + '</div>' +
          '<p class="fmeditor-hint"><i class="ti ti-drag-drop"></i> Glisse les joueurs pour repositionner</p>' +
        '</div>' +
        '<div class="fmeditor-controls">' +
          '<div class="fmeditor-slots-list" id="fmeditor-slots-list">' + renderEditorSlotsList() + '</div>' +
          '<div class="fmeditor-save-row">' +
            '<div class="form-group" style="flex:1"><label>Nom de la formation</label>' +
              '<input type="text" id="fmeditor-name" class="form-input" placeholder="ex: Mon 4-3-3 offensif" value="' + (_fmEditorBaseName || '') + '">' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;gap:8px;margin-top:10px">' +
            '<button class="btn-sm btn-ghost" style="flex:1" onclick="closeFmEditor()">Annuler</button>' +
            '<button class="btn-sm btn-ghost" style="flex:1" onclick="fmEditorReset()"><i class="ti ti-refresh"></i> Réinitialiser</button>' +
            '<button class="btn-sm btn-primary" style="flex:1" onclick="saveFmEditor()"><i class="ti ti-check"></i> Enregistrer</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';

  var root = document.createElement('div');
  root.id = 'fmeditor-root';
  root.innerHTML = html;
  document.body.appendChild(root);

  // Bind drag events après insertion
  setTimeout(bindFmEditorDrag, 50);
}

function renderEditorPitchSVG() {
  var W = 220; var H = 340;
  var nodes = _fmEditorSlots.map(function(s) {
    var cx = Math.round(s.left / 100 * W);
    var cy = Math.round(s.top / 100 * H);
    return '<g class="fmeditor-node" data-idx="' + s.idx + '" style="cursor:pointer">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="16" fill="#1e3a5f" stroke="#60a5fa" stroke-width="1.5"/>' +
      '<text x="' + cx + '" y="' + (cy+3) + '" text-anchor="middle" font-size="8" font-weight="700" fill="#fff">' + s.label + '</text>' +
      '<text x="' + cx + '" y="' + (cy+16+9) + '" text-anchor="middle" font-size="7" fill="#a0c4ff">' + s.label + '</text>' +
    '</g>';
  }).join('');

  return '<svg id="fmeditor-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" style="display:block;touch-action:none">' +
    '<rect x="0" y="0" width="' + W + '" height="' + H + '" rx="8" fill="#1a3a1a"/>' +
    '<rect x="8" y="8" width="' + (W-16) + '" height="' + (H-16) + '" rx="4" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>' +
    '<line x1="8" y1="' + (H/2) + '" x2="' + (W-8) + '" y2="' + (H/2) + '" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>' +
    '<circle cx="' + (W/2) + '" cy="' + (H/2) + '" r="28" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>' +
    '<rect x="' + (W/2-30) + '" y="8" width="60" height="36" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>' +
    '<rect x="' + (W/2-30) + '" y="' + (H-44) + '" width="60" height="36" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>' +
    nodes +
  '</svg>';
}

function renderEditorSlotsList() {
  var q = String.fromCharCode(39);
  return '<div style="font-size:10px;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.6px">Labels de position</div>' +
  '<div style="display:flex;flex-wrap:wrap;gap:4px">' +
    _fmEditorSlots.map(function(s) {
      return '<input type="text" value="' + s.label + '" maxlength="4" ' +
        'style="width:46px;padding:4px 6px;font-size:11px;text-align:center;background:var(--surface3);border:0.5px solid var(--border);border-radius:4px;color:var(--text)" ' +
        'oninput="updateFmSlotLabel(' + s.idx + ',this.value)" ' +
        'title="Poste #' + (s.idx+1) + '">';
    }).join('') +
  '</div>';
}

function updateFmSlotLabel(idx, val) {
  var slot = _fmEditorSlots.find(function(s) { return s.idx === idx; });
  if (slot) slot.label = val.toUpperCase();
  // Mettre à jour le texte dans le SVG sans re-render complet
  var svg = document.getElementById('fmeditor-svg');
  if (svg) {
    var node = svg.querySelector('[data-idx="' + idx + '"]');
    if (node) {
      var texts = node.querySelectorAll('text');
      texts.forEach(function(t) { t.textContent = val.toUpperCase(); });
    }
  }
}

function bindFmEditorDrag() {
  var svg = document.getElementById('fmeditor-svg');
  if (!svg) return;
  var W = 220; var H = 340;

  function getPos(e) {
    var rect = svg.getBoundingClientRect();
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.max(8, Math.min(W-8, (clientX - rect.left) / rect.width * W)),
      y: Math.max(8, Math.min(H-8, (clientY - rect.top) / rect.height * H))
    };
  }

  svg.querySelectorAll('.fmeditor-node').forEach(function(node) {
    var idx = parseInt(node.getAttribute('data-idx'));

    function onStart(e) {
      e.preventDefault();
      _fmEditorDragging = idx;
      node.style.cursor = 'grabbing';
      node.querySelector('circle').setAttribute('stroke', '#f59e0b');
      node.querySelector('circle').setAttribute('stroke-width', '2.5');
    }
    node.addEventListener('mousedown', onStart);
    node.addEventListener('touchstart', onStart, { passive: false });
  });

  function onMove(e) {
    if (_fmEditorDragging === null) return;
    e.preventDefault();
    var pos = getPos(e);
    var slot = _fmEditorSlots.find(function(s) { return s.idx === _fmEditorDragging; });
    if (!slot) return;
    slot.left = Math.round(pos.x / W * 100 * 10) / 10;
    slot.top  = Math.round(pos.y / H * 100 * 10) / 10;
    // Déplacer le nœud dans le SVG
    var node = svg.querySelector('[data-idx="' + _fmEditorDragging + '"]');
    if (node) {
      var circle = node.querySelector('circle');
      var texts = node.querySelectorAll('text');
      circle.setAttribute('cx', Math.round(pos.x));
      circle.setAttribute('cy', Math.round(pos.y));
      if (texts[0]) { texts[0].setAttribute('x', Math.round(pos.x)); texts[0].setAttribute('y', Math.round(pos.y)+3); }
      if (texts[1]) { texts[1].setAttribute('x', Math.round(pos.x)); texts[1].setAttribute('y', Math.round(pos.y)+25); }
    }
  }

  function onEnd(e) {
    if (_fmEditorDragging === null) return;
    var draggedIdx = _fmEditorDragging;
    var node = svg.querySelector('[data-idx="' + draggedIdx + '"]');
    if (node) {
      node.style.cursor = 'grab';
      node.querySelector('circle').setAttribute('stroke', '#60a5fa');
      node.querySelector('circle').setAttribute('stroke-width', '1.5');
    }
    _fmEditorDragging = null;

    // Détecter la position selon la zone et afficher le picker
    var slot = _fmEditorSlots.find(function(s) { return s.idx === draggedIdx; });
    if (!slot) return;
    var suggestions = detectPositionSuggestions(slot.left, slot.top);

    // Afficher picker inline dans l'éditeur
    showFmEditorPositionPicker(draggedIdx, suggestions, slot.left, slot.top);
  }

  svg.addEventListener('mousemove', onMove);
  svg.addEventListener('touchmove', onMove, { passive: false });
  svg.addEventListener('mouseup', onEnd);
  svg.addEventListener('touchend', onEnd);
  document.addEventListener('mouseup', onEnd);
}

function showFmEditorPositionPicker(slotIdx, suggestions, leftPct, topPct) {
  var existing = document.getElementById('fmeditor-pos-picker');
  if (existing) existing.remove();

  var svg = document.getElementById('fmeditor-svg');
  if (!svg) return;
  var rect = svg.getBoundingClientRect();
  var x = rect.left + leftPct / 100 * rect.width;
  var y = rect.top  + topPct  / 100 * rect.height;

  var picker = document.createElement('div');
  picker.id = 'fmeditor-pos-picker';
  picker.style.cssText = 'position:fixed;z-index:500;background:var(--surface);border:0.5px solid var(--accent);border-radius:8px;padding:6px;display:flex;flex-direction:column;gap:4px;box-shadow:0 4px 20px rgba(0,0,0,0.6)';
  picker.style.left = Math.min(x + 24, window.innerWidth - 150) + 'px';
  picker.style.top  = Math.max(y - 80, 60) + 'px';

  var label = document.createElement('div');
  label.style.cssText = 'font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;padding:2px 4px';
  label.textContent = 'Position';
  picker.appendChild(label);

  suggestions.forEach(function(pos) {
    var btn = document.createElement('button');
    btn.style.cssText = 'padding:5px 16px;border-radius:5px;border:0.5px solid var(--border);background:var(--surface3);color:var(--text);font-size:12px;font-weight:600;cursor:pointer';
    btn.textContent = pos;
    btn.onmouseenter = function() { btn.style.background = 'var(--accent)'; btn.style.color = '#fff'; };
    btn.onmouseleave = function() { btn.style.background = 'var(--surface3)'; btn.style.color = 'var(--text)'; };
    btn.onclick = function() {
      // Mettre à jour le label du slot
      var slot = _fmEditorSlots.find(function(s) { return s.idx === slotIdx; });
      if (slot) slot.label = pos;
      picker.remove();
      // Mettre à jour le texte dans le SVG
      var svgEl = document.getElementById('fmeditor-svg');
      if (svgEl) {
        var nodeEl = svgEl.querySelector('[data-idx="' + slotIdx + '"]');
        if (nodeEl) {
          var texts = nodeEl.querySelectorAll('text');
          if (texts[0]) texts[0].textContent = pos;
          if (texts[1]) texts[1].textContent = pos;
        }
      }
      // Mettre à jour l'input label correspondant
      var inputs = document.querySelectorAll('#fmeditor-slots-list input');
      if (inputs[slotIdx]) inputs[slotIdx].value = pos;
    };
    picker.appendChild(btn);
  });

  var cancel = document.createElement('button');
  cancel.style.cssText = 'padding:4px 16px;border-radius:5px;border:none;background:none;color:var(--muted);font-size:11px;cursor:pointer';
  cancel.textContent = '✕ Garder';
  cancel.onclick = function() { picker.remove(); };
  picker.appendChild(cancel);

  document.body.appendChild(picker);

  setTimeout(function() {
    document.addEventListener('mousedown', function closePicker(ev) {
      if (!picker.contains(ev.target)) {
        picker.remove();
        document.removeEventListener('mousedown', closePicker);
      }
    });
  }, 100);
}

function fmEditorReset() {
  var base = _fmEditorBaseName || '4-3-3';
  var slots = buildPitchSlots(base);
  if (slots) {
    _fmEditorSlots = slots.map(function(s) {
      return { idx: s.idx, label: s.label, left: s.left, top: s.top };
    });
  }
  var pitchEl = document.getElementById('fmeditor-pitch');
  if (pitchEl) pitchEl.innerHTML = renderEditorPitchSVG();
  var listEl = document.getElementById('fmeditor-slots-list');
  if (listEl) listEl.innerHTML = renderEditorSlotsList();
  setTimeout(bindFmEditorDrag, 50);
}

function saveFmEditor() {
  var name = (document.getElementById('fmeditor-name')?.value || '').trim();
  if (!name) { showToast('Donne un nom à ta formation', 'warning'); return; }

  // Vérifier si le nom est une formation builtin
  var isBuiltin = FORMATION_LAYOUTS[name] && !FORMATION_LAYOUTS[name]._custom_slots;
  if (isBuiltin) {
    var inp = document.getElementById('fmeditor-name');
    if (inp) {
      inp.style.borderColor = 'var(--red)';
      inp.placeholder = 'Ce nom est réservé — choisis un autre';
      inp.value = '';
      setTimeout(function() { inp.style.borderColor = ''; }, 2000);
    }
    showToast('Nom réservé — choisis un autre (ex: "Mon ' + name + '")', 'warning', 4000);
    return;
  }

  saveCustomFormation(name, _fmEditorSlots.map(function(s) {
    return { idx: s.idx, label: s.label, left: s.left, top: s.top };
  }));
  closeFmEditor();
  // Utiliser ftSelectFormation (onglet Formation) et non selectFormation (modal match)
  ftSelectFormation(name);
}

function closeFmEditor() {
  var root = document.getElementById('fmeditor-root');
  if (root) root.remove();
}

function renderModalAddMatch(buildId) {
  _matchPlayerStats = {};
  _matchSubs = [];
  _matchActiveTab = 'match';
  _pitchSelectedPid = null;
  _pitchSelectedSlot = null;
  _pitchSubMode = false;
  _pitchSubOutPid = null;
  loadSquad23IntoLineup();
  initMatchPlayerStatsFromLineup();
  setTimeout(applyLastInstructions, 80);

  var now = new Date();
  var todayDate = now.toISOString().split('T')[0];
  var nowTime = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  var q = String.fromCharCode(39);

  var tabs = [{ id:'match', label:'Match' }, { id:'resume', label:'Résumé' }];
  var tabNav = '<div class="match-modal-tabs">' +
    tabs.map(function(t) {
      return '<button class="match-modal-tab' + (_matchActiveTab === t.id ? ' active' : '') + '" onclick="switchMatchTab(' + q + t.id + q + ')">' + t.label + '</button>';
    }).join('') +
  '</div>';

  return '<div class="modal-match-fullscreen" id="modal-match-fs">' +
    '<div class="modal-header" style="background:var(--surface2);min-height:48px">' +
      '<h3>Enregistrer un match</h3>' +
      '<div style="display:flex;gap:4px;flex-shrink:0">' +
        '<button class="btn-icon" onclick="minimizeMatch()" title="Réduire"><i class="ti ti-minus"></i></button>' +
        '<button class="btn-icon" id="btn-fs-toggle" onclick="toggleMatchFullscreen()" title="Plein écran"><i class="ti ti-maximize" id="fs-icon"></i></button>' +
        '<button class="btn-icon" onclick="closeModal()"><i class="ti ti-x"></i></button>' +
      '</div>' +
    '</div>' +
    '<input type="hidden" id="m-match-date" value="' + todayDate + '">' +
    '<input type="hidden" id="m-match-time" value="' + nowTime + '">' +
    '<input type="hidden" id="m-match-result" value="">' +
    tabNav +
    '<div class="modal-match-body" id="match-tab-content">' + renderMatchTabContent() + '</div>' +
    '<div class="modal-footer">' +
      '<button class="btn-sm btn-ghost" onclick="closeModal()">Annuler</button>' +
      '<button class="btn-sm btn-primary" onclick="saveMatch()"><i class="ti ti-device-floppy"></i> Enregistrer</button>' +
    '</div>' +
  '</div>';
}

var _matchLastFormation = '';
var _matchIsFullscreen = false;
var _matchMinimized = false;

function minimizeMatch() {
  _matchMinimized = true;
  var container = document.getElementById('modal-container');
  var overlay = document.getElementById('modal-overlay');
  if (container) container.style.display = 'none';
  if (overlay) overlay.style.display = 'none';
  // Créer la barre flottante
  var existing = document.getElementById('match-floating-bar');
  if (existing) existing.remove();
  var scoreFor = document.getElementById('m-score-for')?.value || '0';
  var scoreAgainst = document.getElementById('m-score-against')?.value || '0';
  var result = document.getElementById('m-match-result')?.value || '';
  var resultColor = result === 'V' ? 'var(--green)' : result === 'D' ? 'var(--red)' : 'var(--amber)';
  var bar = document.createElement('div');
  bar.id = 'match-floating-bar';
  bar.className = 'match-floating-bar';
  bar.onclick = restoreMatch;
  bar.innerHTML = '<i class="ti ti-ball-football" style="color:var(--accent)"></i>' +
    '<span style="font-size:13px;font-weight:700">Enregistrer un match</span>' +
    '<span style="font-size:13px;font-weight:700;color:' + resultColor + '">' + scoreFor + ' – ' + scoreAgainst + '</span>' +
    '<span style="font-size:11px;color:var(--muted)">Cliquer pour rouvrir</span>' +
    '<button class="btn-icon" onclick="event.stopPropagation();closeMatchMinimized()" title="Annuler"><i class="ti ti-x"></i></button>';
  document.body.appendChild(bar);
}

function restoreMatch() {
  _matchMinimized = false;
  var container = document.getElementById('modal-container');
  var overlay = document.getElementById('modal-overlay');
  if (container) container.style.display = '';
  if (overlay) overlay.style.display = '';
  var bar = document.getElementById('match-floating-bar');
  if (bar) bar.remove();
}

function closeMatchMinimized() {
  _matchMinimized = false;
  var bar = document.getElementById('match-floating-bar');
  if (bar) bar.remove();
  closeModal();
}

function toggleMatchFullscreen() {
  _matchIsFullscreen = !_matchIsFullscreen;
  var modal = document.getElementById('modal-match-fs');
  var icon = document.getElementById('fs-icon');
  if (_matchIsFullscreen) {
    if (modal) {
      modal.style.width = '100vw';
      modal.style.maxWidth = '100vw';
      modal.style.height = '100vh';
      modal.style.borderRadius = '0';
    }
    if (icon) icon.className = 'ti ti-minimize';
  } else {
    if (modal) {
      modal.style.width = '';
      modal.style.maxWidth = '';
      modal.style.height = '';
      modal.style.borderRadius = '';
    }
    if (icon) icon.className = 'ti ti-maximize';
  }
}

function renderMatchTabContent() {
  if (_matchActiveTab === 'match')  return renderMatchTabMain();
  if (_matchActiveTab === 'resume') return renderMatchTabResume();
  return '';
}

function switchMatchTab(tab) {
  _matchActiveTab = tab;
  var el = document.getElementById('match-tab-content');
  if (el) el.innerHTML = renderMatchTabContent();
  document.querySelectorAll('.match-modal-tab').forEach(function(b) {
    b.classList.toggle('active', b.textContent.trim() === (tab === 'match' ? 'Match' : 'Résumé'));
  });
  if (tab === 'match') setTimeout(applyLastInstructions, 50);
}

function renderMatchTabMain() {
  var q = String.fromCharCode(39);
  var savedFormation = _matchLastFormation || '';
  var slots = savedFormation ? buildPitchSlots(savedFormation) : null;
  var hasPitch = !!(slots && slots.length === 11);

  var leftCol = '<div class="match-pitch-col">';
  if (hasPitch) {
    leftCol += '<div class="pitch-formation-label">' + savedFormation + '</div>';
    leftCol += renderPitchSVG(slots, savedFormation);
    leftCol += '<div class="pitch-legend">' +
      '<span class="pitch-legend-item"><span class="pitch-legend-dot" style="border-color:#60a5fa"></span>Titulaire</span>' +
      '<span class="pitch-legend-item"><span class="pitch-legend-dot" style="border-color:#34d399"></span>Remplacé</span>' +
      '<span class="pitch-legend-item"><span class="pitch-legend-dot" style="background:#2d1f4e;border-color:#a78bfa"></span>Stats</span>' +
    '</div>';
  } else {
    leftCol += '<div class="pitch-placeholder">' +
      '<i class="ti ti-ball-football" style="font-size:48px;color:var(--border)"></i>' +
      '<p>Entre ta formation<br>pour voir le terrain</p>' +
      '<input type="text" id="m-formation-quick" class="form-input" style="width:100px;text-align:center;margin-top:8px" placeholder="4-3-3" oninput="onFormationQuickInput(this.value)">' +
    '</div>';
  }
  leftCol += '</div>';

  var rightCol = '<div class="match-info-col" id="match-info-col">' +
    '<div class="match-info-top">';

  rightCol += '<div class="match-score-block">' +
    '<div class="match-score-team">' +
      '<div class="match-score-team-name">Real Madrid</div>' +
      '<input type="number" id="m-score-for" class="match-score-input" min="0" value="0" oninput="autoUpdateResult()">' +
    '</div>' +
    '<div class="match-score-mid">' +
      '<input type="text" id="m-opp-name" class="match-opp-input" placeholder="Adversaire...">' +
      '<div class="result-selector" style="margin-top:6px">' +
        '<button class="result-btn" data-val="V" onclick="selectResult(' + q + 'V' + q + ')">V</button>' +
        '<button class="result-btn" data-val="N" onclick="selectResult(' + q + 'N' + q + ')">N</button>' +
        '<button class="result-btn" data-val="D" onclick="selectResult(' + q + 'D' + q + ')">D</button>' +
      '</div>' +
    '</div>' +
    '<div class="match-score-team">' +
      '<div class="match-score-team-name">Adversaire</div>' +
      '<input type="number" id="m-score-against" class="match-score-input" min="0" value="0" oninput="autoUpdateResult()">' +
    '</div>' +
  '</div>';

  rightCol += '<div class="match-infos-compact">' +
    '<div class="mic-row">' +
      '<div class="form-group" style="flex:1"><label>Type</label><select id="m-match-type" class="form-input form-input-sm" onchange="onMatchTypeChange(this.value)">' +
        '<option value="ligue_jcj_d1">🏆 Ligue JCJ D1</option>' +
        '<option value="ligue_jcj_d2">🏆 Ligue JCJ D2</option>' +
        '<option value="ligue_jcj_d3">🏆 Ligue JCJ D3</option>' +
        '<option value="ligue_ia_d1">🤖 Ligue IA D1</option>' +
        '<option value="ligue_ia_d2">🤖 Ligue IA D2</option>' +
        '<option value="ligue_ia_d3">🤖 Ligue IA D3</option>' +
        '<option value="event_jcj">🎯 Évènement JCJ</option>' +
        '<option value="event_ia">🎯 Évènement IA</option>' +
        '<option value="amical">🤝 Amical</option>' +
        '<option value="my_league">⚽ My League</option>' +
      '</select></div>' +
      '<div class="form-group" id="m-rank-group" style="flex:1"><label>Rang</label><select id="m-match-rank" class="form-input form-input-sm" onchange="onRankChange(this.value)">' +
        EFB_RANKS.map(function(r) { return '<option value="' + r + '">' + r + '</option>'; }).join('') +
      '</select></div>' +
    '</div>' +
    '<div class="mic-row">' +
      '<div class="form-group" style="flex:1"><label>Notre formation</label>' +
        '<div style="display:flex;gap:4px">' +
          '<input type="text" id="m-formation" class="form-input form-input-sm" placeholder="4-3-3" value="' + savedFormation + '" oninput="onFormationInput(this.value)" style="flex:1">' +
          '<button class="btn-sm btn-ghost" onclick="openFormationPicker()" title="Choisir formation" style="padding:4px 8px;flex-shrink:0"><i class="ti ti-ball-football"></i></button>' +
        '</div>' +
      '</div>' +
      '<div class="form-group" style="flex:1"><label>Formation adv.</label><input type="text" id="m-opp-formation" class="form-input form-input-sm" placeholder="4-4-2"></div>' +
    '</div>' +
    '<div class="mic-row">' +
      '<div class="form-group" style="flex:1"><label>Mon rang pts</label><input type="number" id="m-my-rank" class="form-input form-input-sm" placeholder="1250"></div>' +
      '<div class="form-group" style="flex:1"><label>Rang adv. pts</label><input type="number" id="m-opp-rank" class="form-input form-input-sm" placeholder="1380"></div>' +
    '</div>' +
    '<div class="mic-row">' +
      '<div class="form-group" style="flex:2"><label><i class="ti ti-whistle" style="font-size:11px"></i> Coach utilisé</label><select id="m-coach-id" class="form-input form-input-sm">' +
        '<option value="">— Sans coach —</option>' +
        State.coaches.map(function(c) {
          var activeCoachId = getActiveCoachId();
          return '<option value="' + c.id + '"' + (c.id === activeCoachId ? ' selected' : '') + '>' + c.name + (c.style ? ' · ' + c.style : '') + (c.formation ? ' (' + c.formation + ')' : '') + '</option>';
        }).join('') +
      '</select></div>' +
    '</div>' +
    '<div class="mic-row">' +
      '<div class="form-group" style="flex:1"><label>Date</label><input type="date" id="m-match-date-vis" class="form-input form-input-sm" value="' + new Date().toISOString().split('T')[0] + '" oninput="document.getElementById(' + q + 'm-match-date' + q + ').value=this.value"></div>' +
      '<div class="form-group" style="flex:1"><label>Heure</label><input type="time" id="m-match-time-vis" class="form-input form-input-sm" value="' + String(new Date().getHours()).padStart(2,'0') + ':' + String(new Date().getMinutes()).padStart(2,'0') + '" oninput="document.getElementById(' + q + 'm-match-time' + q + ').value=this.value"></div>' +
    '</div>' +
  '</div>';

  rightCol += '<details class="match-instructions-details">' +
    '<summary class="match-instructions-summary"><i class="ti ti-list-details"></i> Instructions individuelles</summary>' +
    '<div class="instructions-grid" style="margin-top:8px">' +
      ['attack1','attack2','defence1','defence2'].map(function(slot) {
        var isAttack = slot.startsWith('attack');
        var options = isAttack ? EFB_ATTACK_INSTRUCTIONS : EFB_DEFENCE_INSTRUCTIONS;
        var label = slot === 'attack1' ? 'Attack 1' : slot === 'attack2' ? 'Attack 2' : slot === 'defence1' ? 'Defence 1' : 'Defence 2';
        return '<div class="instruction-slot">' +
          '<div class="instruction-slot-title">' + label + '</div>' +
          '<select id="m-' + slot + '-instruction" class="form-input form-input-sm" onchange="saveLastInstructions()">' +
            options.map(function(o) { return '<option value="' + o + '">' + o + '</option>'; }).join('') +
          '</select>' +
          '<select id="m-' + slot + '-target" class="form-input form-input-sm" onchange="saveLastInstructions()">' +
            '<option value="">Targeted Player</option>' +
            (function() {
              var usedInPids = _matchSubs.map(function(s) { return s.in_player_id; });
              var onPitch = _matchTitulaires.map(function(t) {
                var sub = _matchSubs.find(function(s) { return s.out_player_id === t.player_id; });
                return sub ? sub.in_player_id : t.player_id;
              });
              usedInPids.forEach(function(pid) { if (!onPitch.includes(pid)) onPitch.push(pid); });
              return onPitch.map(function(pid) {
                var p = State.players.find(function(x) { return x.id === pid; });
                return p ? '<option value="' + p.id + '">' + p.name + '</option>' : '';
              }).join('');
            })() +
          '</select>' +
        '</div>';
      }).join('') +
    '</div>' +
  '</details>';

  rightCol += '</div>'; // fin match-info-top

  // Séparateur horizontal redimensionnable
  rightCol += '<div class="match-hdivider" id="match-hdivider" onmousedown="matchHDividerStart(event)"></div>';

  // Zone basse fixe — fiche joueur toujours visible
  rightCol += '<div class="match-player-panel-fixed">' +
    '<div class="match-player-panel-title" id="match-player-panel-label">' +
      '<i class="ti ti-user"></i> <span>Clique un joueur sur le terrain</span>' +
    '</div>' +
    '<div id="pitch-stats-col" class="pitch-player-panel">' + renderPitchStatsPanel() + '</div>' +
  '</div>';

  rightCol += '</div>';

  return '<div class="match-main-layout">' + leftCol + '<div class="match-divider" id="match-divider" onmousedown="matchDividerStart(event)"></div>' + rightCol + '</div>';
}

function onFormationInput(val) {
  _matchLastFormation = val.trim();
  var pitchCol = document.querySelector('.match-pitch-col');
  var slots = _matchLastFormation ? buildPitchSlots(_matchLastFormation) : null;
  var hasPitch = !!(slots && slots.length === 11);
  if (pitchCol && hasPitch) {
    pitchCol.innerHTML =
      '<div class="pitch-formation-label">' + _matchLastFormation + '</div>' +
      renderPitchSVG(slots, _matchLastFormation) +
      '<div class="pitch-legend">' +
        '<span class="pitch-legend-item"><span class="pitch-legend-dot" style="border-color:#60a5fa"></span>Titulaire</span>' +
        '<span class="pitch-legend-item"><span class="pitch-legend-dot" style="border-color:#34d399"></span>Remplacé</span>' +
        '<span class="pitch-legend-item"><span class="pitch-legend-dot" style="background:#2d1f4e;border-color:#a78bfa"></span>Stats</span>' +
      '</div>';
  } else if (pitchCol && !hasPitch) {
    var el = document.getElementById('match-tab-content');
    if (el) el.innerHTML = renderMatchTabMain();
  }
}

function onFormationQuickInput(val) {
  _matchLastFormation = val.trim();
  var slots = _matchLastFormation ? buildPitchSlots(_matchLastFormation) : null;
  if (slots && slots.length === 11) {
    var el = document.getElementById('match-tab-content');
    if (el) el.innerHTML = renderMatchTabMain();
  }
}

// ── Terrain SVG interactif ────────────────────────────────────────────────────
function renderPitchSVG(slots, formation) {
  var q = String.fromCharCode(39);
  var W = 180; var H = 290;

  var svgNodes = slots.map(function(slot, i) {
    var titu = _matchTitulaires[i];
    var cx = Math.round(slot.left / 100 * W);
    var cy = Math.round(slot.top  / 100 * H);

    // Slot vide — pas encore de joueur assigné
    if (!titu) {
      return '<g>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="14" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="3,2"/>' +
        '<text x="' + cx + '" y="' + (cy+4) + '" text-anchor="middle" font-size="8" fill="rgba(255,255,255,0.3)">' + slot.label + '</text>' +
      '</g>';
    }

    var sub = _matchSubs.find(function(s) { return s.out_player_id === titu.player_id; });
    var activePid = sub ? sub.in_player_id : titu.player_id;
    var player = State.players.find(function(p) { return p.id === activePid; });
    var origPlayer = sub ? State.players.find(function(p) { return p.id === titu.player_id; }) : null;
    var name = player ? player.name.split(' ').pop() : '?';
    var origName = origPlayer ? origPlayer.name.split(' ').pop() : '';
    var st = _matchPlayerStats[activePid] || {};
    var hasStats = st.goals > 0 || st.assists > 0 || st.saves > 0 || st.yellow_card || st.red_card || st.rating > 0;
    var name = player ? player.name.split(' ').pop() : '?';
    var origName = origPlayer ? origPlayer.name.split(' ').pop() : '';
    var st = _matchPlayerStats[activePid] || {};
    var hasStats = st.goals > 0 || st.assists > 0 || st.saves > 0 || st.yellow_card || st.red_card || st.rating > 0;
    var isSelected = _pitchSelectedSlot === i;
    var swapMode = _pitchSelectedSlot !== null && _pitchSelectedSlot !== i;
    var r = 14;

    // Couleurs
    var fill = sub ? '#0d2818' : (isSelected ? '#2a1f00' : '#1e3a5f');
    var stroke = sub ? '#34d399' : (isSelected ? '#f59e0b' : (hasStats ? '#a78bfa' : '#60a5fa'));
    var strokeW = isSelected ? 2.5 : 1.5;

    var nodeHtml = '<g class="match-pitch-node" data-slot="' + i + '" onclick="onPitchPlayerClick(' + q + titu.player_id + q + ',' + q + activePid + q + ',' + i + ')" style="cursor:pointer">';
    if (swapMode) {
      nodeHtml += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r+4) + '" fill="none" stroke="#f59e0b" stroke-width="1" stroke-dasharray="3,2" opacity="0.6"/>';
    }
    nodeHtml += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + strokeW + '"/>';
    if (isSelected) {
      nodeHtml += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r+3) + '" fill="none" stroke="#f59e0b" stroke-width="1.5" opacity="0.7"/>';
    }

    // Badge stats
    var statCount = (st.goals || 0) + (st.assists || 0);
    if (statCount > 0) {
      nodeHtml += '<circle cx="' + (cx+10) + '" cy="' + (cy-10) + '" r="6" fill="#a78bfa"/>';
      nodeHtml += '<text x="' + (cx+10) + '" y="' + (cy-7) + '" text-anchor="middle" font-size="7" font-weight="700" fill="#fff">' + statCount + '</text>';
    }

    // Label position
    nodeHtml += '<text x="' + cx + '" y="' + (cy+4) + '" text-anchor="middle" font-size="8" font-weight="700" fill="#fff">' + slot.label + '</text>';

    // Nom joueur (sous le cercle)
    nodeHtml += '<text x="' + cx + '" y="' + (cy+r+9) + '" text-anchor="middle" font-size="7.5" fill="' + (sub ? '#34d399' : '#e2e8f0') + '" font-weight="600">' + name + '</text>';

    // Nom titulaire barré si remplacé
    if (sub && origName) {
      nodeHtml += '<text x="' + cx + '" y="' + (cy+r+18) + '" text-anchor="middle" font-size="6.5" fill="#6b7280" text-decoration="line-through">' + origName + '</text>';
    }

    // Joueur sélectionné pour remplacement — halo orange
    if (_pitchSubMode && _pitchSubOutPid === titu.player_id) {
      nodeHtml += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r+3) + '" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4,2"/>';
    }

    nodeHtml += '</g>';
    return nodeHtml;
  }).join('');

  var svgHtml = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;border-radius:8px;overflow:visible;max-height:calc(90vh - 220px)">' +
    '<rect x="0" y="0" width="' + W + '" height="' + H + '" rx="6" fill="#1a3a1a"/>' +
    '<rect x="10" y="10" width="' + (W-20) + '" height="' + (H-20) + '" rx="4" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>' +
    '<line x1="10" y1="' + (H/2) + '" x2="' + (W-10) + '" y2="' + (H/2) + '" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>' +
    '<circle cx="' + (W/2) + '" cy="' + (H/2) + '" r="22" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>' +
    '<rect x="' + (W/2-25) + '" y="10" width="50" height="30" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>' +
    '<rect x="' + (W/2-25) + '" y="' + (H-40) + '" width="50" height="30" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>' +
    svgNodes +
  '</svg>';

  // Liste remplaçants toujours visible sous le terrain
  var usedInPids = _matchSubs.map(function(s) { return s.in_player_id; });
  var benchPlayers = _matchRemplacants.filter(function(r) { return !usedInPids.includes(r.player_id); });
  var alreadyIn = _matchRemplacants.filter(function(r) { return usedInPids.includes(r.player_id); });

  var benchHtml = '<div class="pitch-bench">';
  benchHtml += '<div class="pitch-bench-title">' + (_pitchSubMode && _pitchSubOutPid ? '<span style="color:var(--amber)">⇄ Choisir le remplaçant</span>' : 'Banc (' + benchPlayers.length + ')') + '</div>';
  benchHtml += '<div class="pitch-bench-list">';

  benchPlayers.forEach(function(sel) {
    var p = State.players.find(function(x) { return x.id === sel.player_id; });
    var cards = State.cards[sel.player_id] || [];
    var card = cards.find(function(c) { return c.id === sel.card_id; }) || cards[0];
    var pos = card && card.efhub_stats ? (card.efhub_stats.position || '') : '';
    var isTarget = _pitchSubMode && _pitchSubOutPid;
    benchHtml += '<div class="pitch-bench-player' + (isTarget ? ' sub-target' : '') + '" onclick="onPitchSubSelect(' + q + sel.player_id + q + ')">' +
      '<span class="pitch-bench-pos">' + pos + '</span>' +
      '<span class="pitch-bench-name">' + (p ? p.name : '?') + '</span>' +
      (isTarget ? '<span class="pitch-bench-in">↑</span>' : '') +
    '</div>';
  });

  if (alreadyIn.length > 0) {
    benchHtml += '<div class="pitch-bench-subtitle">Déjà entrés</div>';
    alreadyIn.forEach(function(sel) {
      var p = State.players.find(function(x) { return x.id === sel.player_id; });
      var sub = _matchSubs.find(function(s) { return s.in_player_id === sel.player_id; });
      benchHtml += '<div class="pitch-bench-player played">' +
        '<span class="pitch-bench-name" style="color:var(--muted)">' + (p ? p.name : '?') + '</span>' +
        '<span class="pitch-bench-min">' + (sub ? sub.minute + String.fromCharCode(39) : '') + '</span>' +
      '</div>';
    });
  }

  benchHtml += '</div></div>';
  return svgHtml + benchHtml;
}

// ── Clic sur un joueur du terrain ─────────────────────────────────────────────
function onPitchPlayerClick(origPid, activePid, slotIdx) {
  if (_pitchSubMode) {
    if (_pitchSubOutPid !== origPid) {
      _pitchSubOutPid = origPid;
    }
    return;
  }

  // Si un slot est déjà sélectionné et qu'on clique sur un autre → échanger
  if (_pitchSelectedSlot !== null && _pitchSelectedSlot !== slotIdx) {
    // Échanger les titulaires des deux slots
    var slotA = _pitchSelectedSlot;
    var slotB = slotIdx;
    var tmp = _matchTitulaires[slotA];
    _matchTitulaires[slotA] = _matchTitulaires[slotB];
    _matchTitulaires[slotB] = tmp;
    // Échanger aussi les subs associées
    _matchSubs.forEach(function(s) {
      if (s.out_player_id === (_matchTitulaires[slotB] ? _matchTitulaires[slotB].player_id : null)) return;
    });
    _pitchSelectedSlot = null;
    _pitchSelectedPid = null;
    refreshPitchStats();
    return;
  }

  // Sélectionner ou désélectionner
  if (_pitchSelectedSlot === slotIdx) {
    _pitchSelectedSlot = null;
    _pitchSelectedPid = null;
  } else {
    _pitchSelectedSlot = slotIdx;
    _pitchSelectedPid = activePid;
  }

  // Mettre à jour le panneau stats directement
  var statsCol = document.getElementById('pitch-stats-col');
  if (statsCol) {
    statsCol.innerHTML = renderPitchStatsPanel();
  }

  // Mettre à jour le titre du panel
  var label = document.getElementById('match-player-panel-label');
  if (label && _pitchSelectedPid) {
    var p = State.players.find(function(x) { return x.id === _pitchSelectedPid; });
    label.innerHTML = '<i class="ti ti-user"></i> <span>' + (p ? p.name : '—') + '</span>';
  } else if (label) {
    label.innerHTML = '<i class="ti ti-user"></i> <span>Clique un joueur sur le terrain</span>';
  }

  // Scroll vers le panel
  var panel = document.querySelector('.match-player-panel-fixed');
  if (panel && _pitchSelectedPid) {
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Re-render terrain pour surbrillance
  var formationVal = _matchLastFormation || '';
  var fEl = document.getElementById('m-formation');
  if (fEl && fEl.value) formationVal = fEl.value;
  var slots = formationVal ? buildPitchSlots(formationVal) : null;
  if (slots) {
    var pitchCol = document.querySelector('.match-pitch-col');
    if (pitchCol) {
      pitchCol.innerHTML =
        '<div class="pitch-formation-label">' + formationVal + '</div>' +
        renderPitchSVG(slots, formationVal) +
        '<div class="pitch-legend">' +
          '<span class="pitch-legend-item"><span class="pitch-legend-dot" style="border-color:#60a5fa"></span>Titulaire</span>' +
          '<span class="pitch-legend-item"><span class="pitch-legend-dot" style="border-color:#34d399"></span>Remplacé</span>' +
          '<span class="pitch-legend-item"><span class="pitch-legend-dot" style="background:#2d1f4e;border-color:#a78bfa"></span>Stats</span>' +
        '</div>';
    }
  }
}

// ── Sélection d'un remplaçant entrant ─────────────────────────────────────────
function onPitchSubSelect(inPid) {
  if (!_pitchSubOutPid) return;
  // Demander la minute via un petit prompt inline
  var min = parseInt(prompt('Minute de substitution :', '60') || '60');
  if (isNaN(min) || min < 1) return;
  _matchSubs.push({ out_player_id: _pitchSubOutPid, in_player_id: inPid, minute: min });
  // Ajouter le remplaçant aux stats
  if (!_matchPlayerStats[inPid]) {
    _matchPlayerStats[inPid] = { goals:0, assists:0, saves:0, yellow_card:false, red_card:false, rating:0 };
  }
  _pitchSubMode = false;
  _pitchSubOutPid = null;
  _pitchSelectedPid = inPid;
  refreshPitchStats();
}

// ── Activer le mode remplacement depuis la fiche ──────────────────────────────
function updateSubMinute(outPid, newMinute) {
  var min = parseInt(newMinute);
  if (isNaN(min) || min < 1) return;
  var sub = _matchSubs.find(function(s) { return s.out_player_id === outPid; });
  if (sub) {
    sub.minute = min;
    // Mettre à jour le badge dans la fiche remplaçant sans re-render complet
    var badge = document.querySelector('.ppc-sub-badge');
    if (badge) badge.textContent = '⇄ ' + min + String.fromCharCode(39);
  }
}

function cancelSub(outPid) {
  var subIdx = _matchSubs.findIndex(function(s) { return s.out_player_id === outPid; });
  if (subIdx < 0) return;
  var sub = _matchSubs[subIdx];
  // Supprimer les stats du remplaçant entrant
  delete _matchPlayerStats[sub.in_player_id];
  // Supprimer la substitution
  _matchSubs.splice(subIdx, 1);
  _pitchSelectedPid = outPid;
  refreshPitchStats();
}

function startPitchSubMode(origPid) {
  _pitchSubMode = true;
  _pitchSubOutPid = origPid;
  _pitchSelectedPid = null;
  refreshPitchStats();
}

function cancelPitchSubMode() {
  _pitchSubMode = false;
  _pitchSubOutPid = null;
  refreshPitchStats();
}

// ── Refresh terrain + panneau droite ─────────────────────────────────────────
function refreshPitchStats() {
  var formationVal = _matchLastFormation || '';
  var fEl = document.getElementById('m-formation');
  if (fEl && fEl.value) formationVal = fEl.value;
  var slots = formationVal ? buildPitchSlots(formationVal) : null;
  if (!slots) return;

  // Re-render SVG dans la colonne terrain
  var pitchCol = document.querySelector('.match-pitch-col');
  if (pitchCol) {
    pitchCol.innerHTML =
      '<div class="pitch-formation-label">' + formationVal + '</div>' +
      renderPitchSVG(slots, formationVal) +
      '<div class="pitch-legend">' +
        '<span class="pitch-legend-item"><span class="pitch-legend-dot" style="border-color:#60a5fa"></span>Titulaire</span>' +
        '<span class="pitch-legend-item"><span class="pitch-legend-dot" style="border-color:#34d399"></span>Remplacé</span>' +
        '<span class="pitch-legend-item"><span class="pitch-legend-dot" style="background:#2d1f4e;border-color:#a78bfa"></span>Stats</span>' +
      '</div>';
    setTimeout(bindMatchPitchDrag, 40);
  }

  // Re-render panneau stats droite
  var statsCol = document.getElementById('pitch-stats-col');
  if (statsCol) {
    statsCol.innerHTML = renderPitchStatsPanel();
  }
}

// ── Panneau stats à droite du terrain ────────────────────────────────────────
function renderPitchStatsPanel() {
  var q = String.fromCharCode(39);

  if (_pitchSubMode) {
    return '<div style="padding:12px;color:var(--amber);font-size:12px;display:flex;align-items:center;gap:8px">' +
      '<i class="ti ti-replace"></i>' +
      '<span>Clique sur un remplaçant (vert) en bas du terrain</span>' +
      '</div>' +
      '<button class="btn-sm btn-ghost" style="margin:0 12px;width:calc(100% - 24px)" onclick="cancelPitchSubMode()">Annuler</button>';
  }

  if (!_pitchSelectedPid) {
    return '<div class="pitch-stats-hint">' +
      '<i class="ti ti-click" style="font-size:24px;color:var(--muted)"></i>' +
      '<p>Clique sur un joueur<br>sur le terrain</p>' +
    '</div>';
  }

  // Chercher le slot du joueur sélectionné (titulaire original ou remplaçant entrant)
  var tituEntry = _matchTitulaires.find(function(t) {
    if (t.player_id === _pitchSelectedPid) return true;
    var sub = _matchSubs.find(function(s) { return s.out_player_id === t.player_id; });
    return sub && sub.in_player_id === _pitchSelectedPid;
  });

  // Si pas trouvé dans titulaires, chercher dans remplaçants (entré en jeu)
  if (!tituEntry) {
    var subEntry = _matchSubs.find(function(s) { return s.in_player_id === _pitchSelectedPid; });
    if (subEntry) {
      tituEntry = _matchTitulaires.find(function(t) { return t.player_id === subEntry.out_player_id; });
    }
  }

  // Toujours afficher au moins la fiche du joueur cliqué
  var cards = [];
  var subEntry = null;
  if (tituEntry) {
    subEntry = _matchSubs.find(function(s) { return s.out_player_id === tituEntry.player_id; });
    cards.push({ pid: tituEntry.player_id, isSub: false, minute: null });
    if (subEntry) cards.push({ pid: subEntry.in_player_id, isSub: true, minute: subEntry.minute });
  } else {
    cards.push({ pid: _pitchSelectedPid, isSub: false, minute: null });
  }

  var html = '';
  cards.forEach(function(item, i) {
    html += renderPitchPlayerCard(item.pid, item.isSub, item.minute);
    // Insérer le séparateur minute entre titulaire sorti et remplaçant entrant
    if (i === 0 && subEntry) {
      var q2 = String.fromCharCode(39);
      html += '<div class="sub-minute-editor">' +
        '<span class="sub-minute-label"><i class="ti ti-replace"></i> Substitution</span>' +
        '<div class="sub-minute-input-wrap">' +
          '<input type="number" class="sub-minute-input" id="sub-min-input" min="1" max="120" value="' + (subEntry.minute || '') + '" ' +
            'onchange="updateSubMinute(' + q2 + subEntry.out_player_id + q2 + ', this.value)" ' +
            'onblur="updateSubMinute(' + q2 + subEntry.out_player_id + q2 + ', this.value)">' +
          '<span class="sub-minute-unit">\'</span>' +
        '</div>' +
      '</div>';
    }
  });
  return html;
}

function renderPitchPlayerCard(pid, isSub, subMinute) {
  var q = String.fromCharCode(39);
  var st = _matchPlayerStats[pid] || { goals:0, assists:0, saves:0, yellow_card:false, red_card:false, rating:0 };
  var player = State.players.find(function(p) { return p.id === pid; });
  var cards = State.cards[pid] || [];
  var card = cards[0];
  var isGK = card && card.efhub_stats && card.efhub_stats.position === 'GK';
  var efhubId = player ? Efhub.parseId(player.efhub_url || '') : null;
  var imgUrl = efhubId ? Efhub.imgUrl(efhubId) : null;
  // Vérifier si ce joueur peut encore être remplacé
  var alreadySub = _matchSubs.some(function(s) { return s.out_player_id === pid; });
  var canReplace = !isSub && !alreadySub && _matchRemplacants.filter(function(r) {
    return !_matchSubs.some(function(s) { return s.in_player_id === r.player_id; });
  }).length > 0;

  var html = '<div class="pitch-player-card' + (isSub ? ' is-sub' : '') + '" id="ppc-' + pid + '">';

  // Header
  html += '<div class="ppc-header">';
  if (imgUrl) html += '<img src="' + imgUrl + '" class="ppc-img" onerror="this.style.display=' + q + 'none' + q + '">';
  html += '<div class="ppc-info">';
  html += '<div class="ppc-name">' + (player ? player.name : pid) + '</div>';
  var pos = card && card.efhub_stats ? (card.efhub_stats.position || '') : '';
  html += '<div class="ppc-sub-row">';
  if (pos) html += '<span class="ppc-pos">' + pos + '</span>';
  if (isSub) html += '<span class="ppc-sub-badge">⇄ ' + (subMinute || '') + String.fromCharCode(39) + '</span>';
  html += '</div>';
  html += '</div>';
  if (canReplace) {
    html += '<button class="btn-sm btn-ghost ppc-sub-btn" onclick="startPitchSubMode(' + q + pid + q + ')"><i class="ti ti-replace"></i> Remplacer</button>';
  }
  if (alreadySub) {
    html += '<button class="btn-sm btn-ghost ppc-sub-btn" style="color:var(--red)" onclick="cancelSub(' + q + pid + q + ')"><i class="ti ti-x"></i> Annuler</button>';
  }
  // Bouton changer de rôle — toujours disponible
  var slotIdx = _matchTitulaires.findIndex(function(t) {
    if (!t) return false;
    var sub = _matchSubs.find(function(s) { return s.out_player_id === t.player_id; });
    var activePid = sub ? sub.in_player_id : t.player_id;
    return activePid === pid || t.player_id === pid;
  });
  if (slotIdx >= 0) {
    var slots = _matchLastFormation ? buildPitchSlots(_matchLastFormation) : null;
    var currentRole = slots && slots[slotIdx] ? (POSITION_LABELS_BY_FORMATION[_matchLastFormation] ? POSITION_LABELS_BY_FORMATION[_matchLastFormation][slotIdx] : slots[slotIdx].label) : '?';
    html += '<button class="btn-sm btn-ghost ppc-sub-btn" onclick="openRolePicker(' + slotIdx + ',this)" style="font-size:10px"><i class="ti ti-tag"></i> ' + currentRole + '</button>';
  }
  html += '</div>';

  // Stats
  html += '<div class="ppc-stats">';
  html += '<div class="ppc-stat-chip"><span>⚽</span><button class="btn-click" onclick="updateMatchStat(' + q + pid + q + ',' + q + 'goals' + q + ',-1)">−</button><span id="mps-goals-' + pid + '">' + st.goals + '</span><button class="btn-click" onclick="updateMatchStat(' + q + pid + q + ',' + q + 'goals' + q + ',1)">+</button></div>';
  html += '<div class="ppc-stat-chip"><span><i class="ti ti-shoe"></i></span><button class="btn-click" onclick="updateMatchStat(' + q + pid + q + ',' + q + 'assists' + q + ',-1)">−</button><span id="mps-assists-' + pid + '">' + st.assists + '</span><button class="btn-click" onclick="updateMatchStat(' + q + pid + q + ',' + q + 'assists' + q + ',1)">+</button></div>';
  if (isGK) html += '<div class="ppc-stat-chip"><span>🧤</span><button class="btn-click" onclick="updateMatchStat(' + q + pid + q + ',' + q + 'saves' + q + ',-1)">−</button><span id="mps-saves-' + pid + '">' + st.saves + '</span><button class="btn-click" onclick="updateMatchStat(' + q + pid + q + ',' + q + 'saves' + q + ',1)">+</button></div>';
  html += '<button class="card-btn-small ' + (st.yellow_card ? 'active-yellow' : '') + '" onclick="pitchToggleCard(' + q + pid + q + ',' + q + 'yellow' + q + ')">🟡</button>';
  html += '<button class="card-btn-small ' + (st.red_card ? 'active-red' : '') + '" onclick="pitchToggleCard(' + q + pid + q + ',' + q + 'red' + q + ')">🔴</button>';
  html += '</div>';

  // Note
  html += '<div class="ppc-rating-row">';
  [1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10].forEach(function(n) {
    html += '<button class="rating-mini-btn ' + (st.rating === n ? 'active' : '') + '" onclick="pitchSetRating(' + q + pid + q + ',' + n + ')">' + n + '</button>';
  });
  html += '</div>';
  html += '</div>';
  return html;
}

// ── Actions stats depuis le terrain ──────────────────────────────────────────
function pitchToggleCard(pid, type) {
  if (!_matchPlayerStats[pid]) _matchPlayerStats[pid] = { goals:0, assists:0, saves:0, yellow_card:false, red_card:false, rating:0 };
  _matchPlayerStats[pid][type + '_card'] = !_matchPlayerStats[pid][type + '_card'];
  refreshPitchStats();
}

function pitchSetRating(pid, val) {
  if (!_matchPlayerStats[pid]) _matchPlayerStats[pid] = { goals:0, assists:0, saves:0, yellow_card:false, red_card:false, rating:0 };
  var newVal = _matchPlayerStats[pid].rating === val ? 0 : val;
  _matchPlayerStats[pid].rating = newVal;
  // Mettre à jour les boutons de note directement sans re-render complet
  var card = document.getElementById('ppc-' + pid);
  if (card) {
    card.querySelectorAll('.rating-mini-btn').forEach(function(btn) {
      var btnVal = parseFloat(btn.textContent);
      btn.classList.toggle('active', btnVal === newVal);
    });
  }
}

var _matchHDivDragging = false;
var _matchHDivStartY = 0;
var _matchHDivStartH = 0;

function matchHDividerStart(e) {
  e.preventDefault();
  var top = document.querySelector('.match-info-top');
  if (!top) return;
  _matchHDivDragging = true;
  _matchHDivStartY = e.clientY;
  _matchHDivStartH = top.offsetHeight;
  var divider = document.getElementById('match-hdivider');
  if (divider) divider.classList.add('dragging');
  document.addEventListener('mousemove', matchHDividerMove);
  document.addEventListener('mouseup', matchHDividerEnd);
}

function matchHDividerMove(e) {
  if (!_matchHDivDragging) return;
  var top = document.querySelector('.match-info-top');
  var infoCol = document.querySelector('.match-info-col');
  if (!top || !infoCol) return;
  var delta = e.clientY - _matchHDivStartY;
  var totalH = infoCol.offsetHeight;
  var newH = Math.max(30, Math.min(totalH - 30, _matchHDivStartH + delta));
  top.style.height = newH + 'px';
  top.style.flex = 'none';
}

function matchHDividerEnd() {
  _matchHDivDragging = false;
  var divider = document.getElementById('match-hdivider');
  if (divider) divider.classList.remove('dragging');
  document.removeEventListener('mousemove', matchHDividerMove);
  document.removeEventListener('mouseup', matchHDividerEnd);
}

// ── Drag & drop rôle joueur dans modal match ──────────────────────────────────
// ── Changer de rôle depuis la fiche joueur ────────────────────────────────────
var ALL_POSITIONS = ['GK','CB','LB','RB','DMF','CMF','AMF','LMF','RMF','LWF','RWF','SS','CF'];

function openRolePicker(slotIdx, btn) {
  // Supprimer picker existant
  var existing = document.getElementById('role-picker');
  if (existing) { existing.remove(); return; }

  var rect = btn.getBoundingClientRect();
  var picker = document.createElement('div');
  picker.id = 'role-picker';
  picker.style.cssText = 'position:fixed;z-index:500;background:var(--surface);border:0.5px solid var(--accent);border-radius:8px;padding:6px;display:flex;flex-wrap:wrap;gap:4px;box-shadow:0 4px 20px rgba(0,0,0,0.6);max-width:200px;';
  picker.style.left = Math.min(rect.left, window.innerWidth - 210) + 'px';
  picker.style.top  = (rect.bottom + 4) + 'px';

  ALL_POSITIONS.forEach(function(pos) {
    var b = document.createElement('button');
    b.textContent = pos;
    b.style.cssText = 'padding:4px 10px;border-radius:5px;border:0.5px solid var(--border);background:var(--surface3);color:var(--text);font-size:11px;font-weight:600;cursor:pointer;';
    b.onmouseenter = function() { b.style.background = 'var(--accent)'; b.style.color = '#fff'; };
    b.onmouseleave = function() { b.style.background = 'var(--surface3)'; b.style.color = 'var(--text)'; };
    b.onclick = function() {
      // Mettre à jour le label
      var labels = POSITION_LABELS_BY_FORMATION[_matchLastFormation];
      if (labels && labels[slotIdx] !== undefined) {
        labels[slotIdx] = pos;
      }
      picker.remove();
      refreshPitchStats();
    };
    picker.appendChild(b);
  });

  document.body.appendChild(picker);
  setTimeout(function() {
    document.addEventListener('mousedown', function close(e) {
      if (!picker.contains(e.target) && e.target !== btn) {
        picker.remove();
        document.removeEventListener('mousedown', close);
      }
    });
  }, 100);
}

// ── Redimensionnement modal match ─────────────────────────────────────────────
var _matchDivDragging = false;
var _matchDivStartX = 0;
var _matchDivStartW = 0;

function matchDividerStart(e) {
  e.preventDefault();
  var pitchCol = document.querySelector('.match-pitch-col');
  if (!pitchCol) return;
  _matchDivDragging = true;
  _matchDivStartX = e.clientX;
  _matchDivStartW = pitchCol.offsetWidth;
  var divider = document.getElementById('match-divider');
  if (divider) divider.classList.add('dragging');
  document.addEventListener('mousemove', matchDividerMove);
  document.addEventListener('mouseup', matchDividerEnd);
}

function matchDividerMove(e) {
  if (!_matchDivDragging) return;
  var pitchCol = document.querySelector('.match-pitch-col');
  if (!pitchCol) return;
  var delta = e.clientX - _matchDivStartX;
  var newW = Math.max(80, Math.min(window.innerWidth * 0.7, _matchDivStartW + delta));
  pitchCol.style.width = newW + 'px';
  pitchCol.style.flexShrink = '0';
}

function matchDividerEnd() {
  _matchDivDragging = false;
  var divider = document.getElementById('match-divider');
  if (divider) divider.classList.remove('dragging');
  document.removeEventListener('mousemove', matchDividerMove);
  document.removeEventListener('mouseup', matchDividerEnd);
}

// ── Onglet Résumé ────────────────────────────────────────────────────────────
function renderMatchTabResume() {
  var allPlayers = State.players;
  var q = String.fromCharCode(39);

  // Section builds par joueur
  var allLineup = _matchTitulaires.concat(_matchRemplacants);
  var buildsHtml = '<div class="form-section-title" style="margin-bottom:8px">Builds utilisés</div>';
  buildsHtml += '<div class="resume-builds-list">';
  allLineup.forEach(function(sel) {
    if (!sel || !sel.player_id) return;
    var p = State.players.find(function(x) { return x.id === sel.player_id; });
    var buildId = sel.build_id;
    var build = buildId ? Object.values(State.builds).flat().find(function(b) { return b.id === buildId; }) : null;
    var cards = State.cards[sel.player_id] || [];
    var card = cards.find(function(c) { return c.id === sel.card_id; }) || cards[0];
    var pos = card && card.efhub_stats ? (card.efhub_stats.position || '') : '';
    buildsHtml += '<div class="resume-build-row">' +
      '<span class="resume-build-pos">' + pos + '</span>' +
      '<span class="resume-build-name">' + (p ? p.name : '?') + '</span>' +
      '<span class="resume-build-val ' + (build ? '' : 'no-build') + '">' + (build ? build.name : '— Sans build —') + '</span>' +
    '</div>';
  });
  buildsHtml += '</div>';

  return buildsHtml +
  '<div class="form-row" style="margin-top:12px">' +
    '<div class="form-group"><label>🏅 Homme du match</label><select id="m-man-of-match" class="form-input">' +
      '<option value="">— Aucun —</option>' +
      allPlayers.map(function(p) { return '<option value="' + p.id + '">' + p.name + '</option>'; }).join('') +
    '</select></div>' +
    '<div class="form-group"><label>Note globale (1-5)</label><select id="m-note" class="form-input">' +
      '<option value="3">3 — Moyen</option>' +
      '<option value="1">1 — Très mauvais</option>' +
      '<option value="2">2 — Mauvais</option>' +
      '<option value="4">4 — Bon</option>' +
      '<option value="5">5 — Excellent</option>' +
    '</select></div>' +
  '</div>' +
  '<div class="form-group">' +
    '<label class="checkbox-label"><input type="checkbox" id="m-repeated-opponent"> Adversaire répétitif</label>' +
  '</div>';
}

// ── Gestion titulaires/remplaçants dans le modal match ────────────────────────
function renderMatchGroupList(arr, isTitu) {
  const otherPids = (isTitu ? _matchRemplacants : _matchTitulaires).map(x => x.player_id);
  const max = isTitu ? 11 : 12;

  let html = arr.map((sel, i) => {
    const p = State.players.find(x => x.id === sel.player_id);
    const cards = State.cards[sel.player_id] || [];
    const c = cards.find(x => x.id === sel.card_id) || cards[0];
    const efhubId = p ? Efhub.parseId(p.efhub_url || '') : null;
    const imgUrl = efhubId ? Efhub.imgUrl(efhubId) : null;
    const sq = _squad23.find(s => s.player_id === sel.player_id);
    const buildId = sel.build_id || (sq ? sq.build_id : null);
    const builds = c ? (State.builds[c.id] || []) : [];
    const activeBuild = builds.find(b => b.id === buildId);
    // Case "A joué" pour les remplaçants
    const played = sel.played !== false; // true par défaut
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:0.5px solid var(--border)">
        ${imgUrl ? `<img src="${imgUrl}" style="width:24px;height:30px;border-radius:3px;object-fit:cover">` : ''}
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600">${p ? p.name : '?'}</div>
          <div style="font-size:10px;color:var(--muted)">${c ? (c.efhub_stats?.position || '') : ''}${activeBuild ? ' · ' + activeBuild.name : ''}</div>
        </div>
        ${!isTitu ? `<label style="font-size:10px;color:var(--muted);display:flex;align-items:center;gap:3px;cursor:pointer">
          <input type="checkbox" ${played ? 'checked' : ''} onchange="toggleMatchPlayerPlayed('${sel.player_id}',${i},this.checked)" style="width:12px;height:12px">
          A joué
        </label>` : ''}
        <button class="btn-icon danger" onclick="removeMatchGroupPlayer(${i},${isTitu ? 1 : 0})"><i class="ti ti-x"></i></button>
      </div>
    `;
  }).join('');

  // Disponibles = seulement depuis la Squad 23, excluant déjà sélectionnés et l'autre groupe
  const squadPids = _squad23.map(s => s.player_id);
  const available = _squad23.filter(sq =>
    !arr.some(s => s.player_id === sq.player_id) &&
    !otherPids.includes(sq.player_id)
  );

  if (arr.length < max && available.length > 0) {
    html += `
      <select class="form-input form-input-sm" style="margin-top:6px"
              onchange="addMatchGroupPlayer(this.value,${isTitu ? 1 : 0})">
        <option value="">+ Ajouter depuis la Squad 23...</option>
        ${available.map(sq => {
          const p = State.players.find(x => x.id === sq.player_id);
          const cards = State.cards[sq.player_id] || [];
          const c = cards.find(x => x.id === sq.card_id) || cards[0];
          const builds = c ? (State.builds[c.id] || []) : [];
          const build = builds.find(b => b.id === sq.build_id);
          const label = (p ? p.name : '?') + (c ? ' · ' + (c.efhub_stats?.position || '') : '') + (build ? ' — ' + build.name : '');
          return `<option value="${sq.player_id}|${sq.card_id}|${sq.build_id || ''}">${label}</option>`;
        }).join('')}
      </select>
    `;
  } else if (available.length === 0 && arr.length === 0 && _squad23.length === 0) {
    html += '<div style="color:var(--amber);font-size:11px;padding:6px 0">&#9888; Definis d\'abord ta Squad 23 dans l\'onglet Effectif</div>';
  }

  if (arr.length === 0) html = '<div style="color:var(--muted);font-size:11px;padding:4px 0">Aucun joueur</div>' + html;
  return `<div style="margin-bottom:8px"><div style="font-size:10px;color:var(--muted);margin-bottom:4px">${arr.length}${isTitu ? '/11' : ''} joueur${arr.length > 1 ? 's' : ''}</div>${html}</div>`;
}

function addMatchGroupPlayer(val, isTitu) {
  if (!val) return;
  const [pid, cid] = val.split('|');
  const arr = isTitu ? _matchTitulaires : _matchRemplacants;
  arr.push({ player_id: pid, card_id: cid });
  saveLineupToStorage();
  if (!_matchPlayerStats[pid]) {
    _matchPlayerStats[pid] = { goals: 0, assists: 0, saves: 0, yellow_card: false, red_card: false, rating: 0, _collapsed: true };
    var sl = document.getElementById('match-player-stats-list');
    if (sl) sl.innerHTML = renderMatchPlayerStatsListV2();
  }
  const el = document.getElementById(isTitu ? 'm-titu-list' : 'm-rempl-list');
  if (el) el.innerHTML = renderMatchGroupList(arr, !!isTitu);
}

function removeMatchGroupPlayer(idx, isTitu) {
  const arr = isTitu ? _matchTitulaires : _matchRemplacants;
  const removed = arr[idx];
  arr.splice(idx, 1);
  saveLineupToStorage();
  // Retirer des stats si titulaire retiré
  if (isTitu && removed && _matchPlayerStats[removed.player_id]) {
    const stats = _matchPlayerStats[removed.player_id];
    if (stats.goals === 0 && stats.assists === 0 && stats.rating === 0) {
      delete _matchPlayerStats[removed.player_id];
      const sl = document.getElementById('match-player-stats-list');
      if (sl) sl.innerHTML = renderMatchPlayerStatsListV2();
    }
  }
  // Rafraîchir les 2 listes
  const el = document.getElementById(isTitu ? 'm-titu-list' : 'm-rempl-list');
  if (el) el.innerHTML = renderMatchGroupList(arr, !!isTitu);
  const otherEl = document.getElementById(isTitu ? 'm-rempl-list' : 'm-titu-list');
  const otherArr = isTitu ? _matchRemplacants : _matchTitulaires;
  if (otherEl) otherEl.innerHTML = renderMatchGroupList(otherArr, !isTitu);
}

function renderMatchSubsList() {
  if (_matchSubs.length === 0) return '<div style="color:var(--muted);font-size:11px;padding:4px 0">Aucune substitution</div>';
  return _matchSubs.map((s, i) => {
    const pOut = State.players.find(p => p.id === s.out_player_id);
    const pIn = State.players.find(p => p.id === s.in_player_id);
    return `
      <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:0.5px solid var(--border);font-size:12px">
        <span style="color:var(--red)">↓ ${pOut ? pOut.name : '?'}</span>
        <span style="color:var(--green)">↑ ${pIn ? pIn.name : '?'}</span>
        <span style="color:var(--muted)">${s.minute}'</span>
        <button class="btn-icon danger" onclick="removeMatchSub(${i})"><i class="ti ti-x"></i></button>
      </div>
    `;
  }).join('');
}

function addMatchSub() {
  const allOnField = _matchTitulaires.concat(_matchRemplacants);
  const subsInPids = _matchSubs.map(s => s.in_player_id);
  const subsOutPids = _matchSubs.map(s => s.out_player_id);
  const canOut = _matchTitulaires.filter(s => !subsOutPids.includes(s.player_id))
    .concat(_matchSubs.filter(s => !subsOutPids.includes(s.in_player_id)).map(s => ({ player_id: s.in_player_id })));
  const canIn = _matchRemplacants.filter(s => !subsInPids.includes(s.player_id));
  if (!canOut.length || !canIn.length) return;

  const container = document.getElementById('m-subs-list');
  const formId = 'sub-form-new';
  if (document.getElementById(formId)) return;

  const div = document.createElement('div');
  div.id = formId;
  div.style.cssText = 'display:flex;gap:6px;align-items:center;margin-top:6px;flex-wrap:wrap';
  div.innerHTML = `
    <select id="sub-out-sel" class="form-input form-input-sm" style="flex:1">
      <option value="">Qui sort...</option>
      ${canOut.map(s => { const p = State.players.find(x => x.id === s.player_id); return `<option value="${s.player_id}">${p ? p.name : '?'}</option>`; }).join('')}
    </select>
    <select id="sub-in-sel" class="form-input form-input-sm" style="flex:1">
      <option value="">Qui entre...</option>
      ${canIn.map(s => { const p = State.players.find(x => x.id === s.player_id); return `<option value="${s.player_id}">${p ? p.name : '?'}</option>`; }).join('')}
    </select>
    <input type="number" id="sub-min-input" class="form-input form-input-sm" placeholder="min" style="width:60px" min="1" max="120">
    <button class="btn-sm btn-primary" onclick="confirmMatchSub()">✅</button>
  `;
  container.appendChild(div);
}

function confirmMatchSub() {
  const outPid = document.getElementById('sub-out-sel')?.value;
  const inPid = document.getElementById('sub-in-sel')?.value;
  const min = parseInt(document.getElementById('sub-min-input')?.value) || 60;
  if (!outPid || !inPid) return;
  _matchSubs.push({ out_player_id: outPid, in_player_id: inPid, minute: min });
  const el = document.getElementById('m-subs-list');
  if (el) el.innerHTML = renderMatchSubsList();
}

function removeMatchSub(idx) {
  _matchSubs.splice(idx, 1);
  const el = document.getElementById('m-subs-list');
  if (el) el.innerHTML = renderMatchSubsList();
}

// ── Empty states ──────────────────────────────────────────────────────────────
function renderNoCard() {
  return `
    <div class="empty-state">
      <i class="ti ti-id-badge"></i>
      <p>Aucune carte pour ce joueur</p>
      <button class="btn-sm btn-primary"
              onclick="openModal('addCard','${State.selectedPlayerId}')">
        + Ajouter une carte
      </button>
    </div>
  `;
}

function renderEmptyState() {
  return `
    <div class="empty-state-full">
      <i class="ti ti-users" style="font-size:48px;color:#2a2d3a"></i>
      <p>Aucun joueur dans l'effectif</p>
      <button class="btn-sm btn-primary" onclick="openModal('addPlayer')">
        + Ajouter le premier joueur
      </button>
    </div>
  `;
}

function renderSkeleton() {
  document.getElementById('app').innerHTML = `
    <div style="padding:20px;color:#6b7280;text-align:center">
      <i class="ti ti-loader-2" style="font-size:32px;animation:spin 1s linear infinite"></i>
      <p style="margin-top:8px">Chargement...</p>
    </div>
  `;
}

function showError(msg) {
  document.getElementById('app').innerHTML = `
    <div style="padding:20px;color:#f87171;text-align:center">
      <i class="ti ti-alert-circle" style="font-size:32px"></i>
      <p style="margin-top:8px">${msg}</p>
    </div>
  `;
}

// ── Event handlers ────────────────────────────────────────────────────────────
function bindEvents() {}

function setTab(tab) {
  State.activeTab = tab;
  render();
}

function setPlayerTab(tab) {
  State.activePlayerTab = tab;
  render();
}

async function onSelectPlayer(id) {
  await selectPlayer(id);
  render();
}

async function onSelectCard(id) {
  await selectCard(id);
  render();
}

function onSelectBuild(id) {
  State.selectedBuildId = id;
  render();
}

// Import efhub dans modal joueur
function onEfhubUrlInput(val) {
  const btn = document.getElementById('btn-efhub-import');
  if (btn) btn.disabled = !Efhub.parseId(val);
}

function onCardEfhubInput(val) {
  const btn = document.getElementById('btn-card-import');
  if (btn) btn.disabled = !Efhub.parseId(val);
}

async function importFromEfhub() {
  const url = document.getElementById('m-efhub-url')?.value;
  const playerId = Efhub.parseId(url || '');
  if (!playerId) return;
  const status = document.getElementById('efhub-import-status');
  const btn = document.getElementById('btn-efhub-import');
  btn.disabled = true; btn.textContent = '⏳';
  status.innerHTML = '<span style="color:#6b7280;font-size:11px">Récupération...</span>';
  try {
    const data = await Efhub.fetch(playerId);
    if (data.name) document.getElementById('m-player-name').value = data.name;
    status.innerHTML = `<span style="color:#34d399;font-size:11px">✅ ${data.name} (${data.ovr} OVR · ${data.position})</span>`;
    btn.textContent = '✅';
    // Stocker les données pour la carte
    window._efhubData = data;
  } catch(e) {
    status.innerHTML = `<span style="color:#f87171;font-size:11px">❌ ${e.message}</span>`;
    btn.disabled = false; btn.textContent = '🔍 Importer';
  }
}

async function importCardFromEfhub(playerId) {
  const url = document.getElementById('m-card-efhub-url')?.value;
  const efhubPlayerId = Efhub.parseId(url || '');
  if (!efhubPlayerId) return;
  const status = document.getElementById('card-import-status');
  const btn = document.getElementById('btn-card-import');
  btn.disabled = true; btn.textContent = '⏳';
  status.innerHTML = '<span style="color:#6b7280;font-size:11px">Récupération...</span>';
  try {
    const data = await Efhub.fetch(efhubPlayerId);
    // Remplir les champs
    document.getElementById('card-form-fields').classList.remove('hidden');
    document.getElementById('btn-save-card').classList.remove('hidden');
    if (data.level_cap) {
      document.getElementById('m-level-cap').value = data.level_cap;
      document.getElementById('m-points-max').value = Progression.pointsFromLevelCap(data.level_cap);
    }
    if (data.playingStyle) document.getElementById('m-playing-style').value = data.playingStyle;
    if (data.cardType) document.getElementById('m-card-type').value = data.cardType;
    status.innerHTML = `<span style="color:#34d399;font-size:11px">✅ ${data.name} · ${data.position} · ${data.ovr} OVR</span>`;
    btn.textContent = '✅';
    window._cardEfhubData = { ...data, efhubPlayerId };
  } catch(e) {
    status.innerHTML = `<span style="color:#f87171;font-size:11px">❌ ${e.message}</span>`;
    btn.disabled = false; btn.textContent = '🔍 Importer';
  }
}

function updatePointsMax(levelCap) {
  const pts = Progression.pointsFromLevelCap(parseInt(levelCap) || 0);
  const el = document.getElementById('m-points-max');
  if (el) el.value = pts;
}

// Sliders build
const _buildSliders = {};
function adjustSlider(sliderKey, delta, cardId) {
  const card = Object.values(State.cards).flat().find(c => c.id === cardId);
  if (!card) return;
  const current = _buildSliders[sliderKey] || 0;
  const newVal = Math.max(0, current + delta);
  const testSliders = { ..._buildSliders, [sliderKey]: newVal };
  const totalPts = Progression.totalPoints(testSliders);
  const pointsMax = card.points_max || 0;
  if (totalPts > pointsMax && delta > 0) return;
  _buildSliders[sliderKey] = newVal;
  // Mettre à jour affichage
  const valEl = document.getElementById('slider-val-' + sliderKey);
  const costEl = document.getElementById('slider-cost-' + sliderKey);
  const ptsEl = document.getElementById('build-pts-used');
  const ptsBar = document.getElementById('build-pts-bar');
  if (valEl) valEl.textContent = newVal;
  if (costEl) costEl.textContent = Progression.clickCost(newVal) + ' pts';
  const totalUsed = Progression.totalPoints(_buildSliders);
  if (ptsEl) ptsEl.textContent = totalUsed;
  if (ptsBar) {
    const pct = pointsMax > 0 ? Math.min(100, (totalUsed / pointsMax) * 100) : 0;
    ptsBar.style.width = pct + '%';
    ptsBar.style.background = pct >= 100 ? 'var(--green)' : 'var(--accent)';
  }
}

// ── Stats joueurs dans le modal match ────────────────────────────────────────
function renderMatchPlayerStatsList() {
  if (Object.keys(_matchPlayerStats).length === 0) {
    return '<div style="color:var(--muted);font-size:11px;padding:6px 0">Aucun joueur ajouté — clique + pour ajouter</div>';
  }
  return Object.entries(_matchPlayerStats).map(([pid, stats]) => {
    const player = State.players.find(p => p.id === pid);
    const cards = State.cards[pid] || [];
    const card = cards[0];
    const isGK = card?.efhub_stats?.position === 'GK';
    const efhubId = player ? Efhub.parseId(player.efhub_url || '') : null;
    const imgUrl = efhubId ? Efhub.imgUrl(efhubId) : null;
    return `
      <div class="match-player-stat-row" id="mpsr-${pid}">
        <div class="match-player-stat-header">
          ${imgUrl ? `<img src="${imgUrl}" style="width:28px;height:35px;border-radius:4px;object-fit:cover">` : ''}
          <span class="match-player-stat-name">${player ? player.name : pid}</span>
          <button class="btn-icon danger" onclick="removeMatchPlayerStat('${pid}')"><i class="ti ti-x"></i></button>
        </div>
        <div class="match-player-stat-fields">
          <div class="match-stat-field">
            <span>⚽</span>
            <button class="btn-click" onclick="updateMatchStat('${pid}','goals',-1)">−</button>
            <span id="mps-goals-${pid}">${stats.goals}</span>
            <button class="btn-click" onclick="updateMatchStat('${pid}','goals',1)">+</button>
          </div>
          <div class="match-stat-field">
            <span>🎯</span>
            <button class="btn-click" onclick="updateMatchStat('${pid}','assists',-1)">−</button>
            <span id="mps-assists-${pid}">${stats.assists}</span>
            <button class="btn-click" onclick="updateMatchStat('${pid}','assists',1)">+</button>
          </div>
          ${isGK ? `
          <div class="match-stat-field">
            <span>🧤</span>
            <button class="btn-click" onclick="updateMatchStat('${pid}','saves',-1)">−</button>
            <span id="mps-saves-${pid}">${stats.saves}</span>
            <button class="btn-click" onclick="updateMatchStat('${pid}','saves',1)">+</button>
          </div>` : ''}
          <button class="card-btn-small ${stats.yellow_card ? 'active-yellow' : ''}"
                  onclick="toggleMatchCard('${pid}','yellow')">🟡</button>
          <button class="card-btn-small ${stats.red_card ? 'active-red' : ''}"
                  onclick="toggleMatchCard('${pid}','red')">🔴</button>
        </div>
        <div class="match-player-rating">
          <span style="font-size:10px;color:var(--muted)">Note eFootball /10</span>
          <div class="rating-mini-btns">
            ${[1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10].map(n => `
              <button class="rating-mini-btn ${stats.rating === n ? 'active' : ''}"
                      onclick="setMatchPlayerRating('${pid}',${n})">${n}</button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function addMatchPlayerStat() {
  // Créer un select pour choisir le joueur
  const existing = Object.keys(_matchPlayerStats);
  const available = State.players.filter(p => !existing.includes(p.id));
  if (available.length === 0) return;

  const container = document.getElementById('match-player-stats-list');
  const selectId = 'mps-select-new';
  if (document.getElementById(selectId)) return;

  const div = document.createElement('div');
  div.id = selectId;
  div.style.marginBottom = '8px';
  div.innerHTML = `
    <select class="form-input" onchange="confirmAddMatchPlayer(this.value)">
      <option value="">Choisir un joueur...</option>
      ${available.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
    </select>
  `;
  container.appendChild(div);
}

function confirmAddMatchPlayer(pid) {
  if (!pid) return;
  const sel = document.getElementById('mps-select-new');
  if (sel) sel.remove();
  _matchPlayerStats[pid] = { goals: 0, assists: 0, saves: 0, yellow_card: false, red_card: false, rating: 0 };
  document.getElementById('match-player-stats-list').innerHTML = renderMatchPlayerStatsList();
}

function removeMatchPlayerStat(pid) {
  delete _matchPlayerStats[pid];
  document.getElementById('match-player-stats-list').innerHTML = renderMatchPlayerStatsList();
}

function updateMatchStat(pid, stat, delta) {
  if (!_matchPlayerStats[pid]) return;
  _matchPlayerStats[pid][stat] = Math.max(0, (_matchPlayerStats[pid][stat] || 0) + delta);
  // Mettre à jour l'affichage du compteur
  var el = document.getElementById('mps-' + stat + '-' + pid);
  if (el) el.textContent = _matchPlayerStats[pid][stat];
  // Si but marqué → incrémenter le score Real Madrid automatiquement
  if (stat === 'goals') {
    var scoreEl = document.getElementById('m-score-for');
    if (scoreEl) {
      var current = parseInt(scoreEl.value) || 0;
      var newScore = Math.max(0, current + delta);
      scoreEl.value = newScore;
      autoUpdateResult();
    }
  }
}

function toggleMatchCard(pid, type) {
  if (!_matchPlayerStats[pid]) return;
  _matchPlayerStats[pid][type + '_card'] = !_matchPlayerStats[pid][type + '_card'];
  // Mettre à jour seulement le bouton carton sans re-render complet
  var row = document.getElementById('mpsr-' + pid);
  if (row) {
    var yellowBtn = row.querySelector('.card-btn-small.active-yellow, .card-btn-small:not(.active-red)');
    // Re-render uniquement cette ligne
    var newHtml = renderSinglePlayerStatRow(pid);
    if (newHtml && row) row.outerHTML = newHtml;
  }
}

function setMatchPlayerRating(pid, val) {
  if (!_matchPlayerStats[pid]) return;
  _matchPlayerStats[pid].rating = val;
  // Mettre à jour seulement les boutons de note
  var row = document.getElementById('mpsr-' + pid);
  if (row) {
    var newHtml = renderSinglePlayerStatRow(pid);
    if (newHtml) row.outerHTML = newHtml;
  }
  // Mettre à jour le résumé dans le header
  var headerSummary = document.querySelector('#mpsr-' + pid + ' .match-player-stat-header span[style*="muted"]');
  if (headerSummary) {
    var stats = _matchPlayerStats[pid];
    var parts = [];
    if (stats.goals > 0) parts.push('Buts: ' + stats.goals);
    if (stats.assists > 0) parts.push('Passes: ' + stats.assists);
    if (stats.saves > 0) parts.push('Arrets: ' + stats.saves);
    if (stats.yellow_card) parts.push('Jaune');
    if (stats.red_card) parts.push('Rouge');
    if (stats.rating > 0) parts.push(stats.rating + '/10');
    headerSummary.textContent = parts.length > 0 ? parts.join(' | ') : 'Aucune stat';
  }
}

function selectResult(val) {
  document.getElementById('m-match-result').value = val;
  document.querySelectorAll('.result-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.val === val);
  });
}

function autoUpdateResult() {
  var sf = parseInt(document.getElementById('m-score-for')?.value) || 0;
  var sa = parseInt(document.getElementById('m-score-against')?.value) || 0;
  var result = sf > sa ? 'V' : sf < sa ? 'D' : 'N';
  selectResult(result);
}

var RANK_TYPES = ['ligue_ia_d1','ligue_ia_d2','ligue_ia_d3','event_ia','my_league'];

function onMatchTypeChange(type) {
  autoUpdateResult();
  var rankGroup = document.getElementById('m-rank-group');
  if (!rankGroup) return;
  var showRank = !type || RANK_TYPES.includes(type);
  rankGroup.style.display = showRank ? '' : 'none';
  if (!showRank) {
    var rankSel = document.getElementById('m-match-rank');
    if (rankSel) rankSel.value = '';
  }
}

function onRankChange(val) {
  // Réservé pour extension future
}

// ── CRUD actions ──────────────────────────────────────────────────────────────
async function savePlayer() {
  const name = document.getElementById('m-player-name')?.value?.trim();
  const efhub_url = document.getElementById('m-efhub-url')?.value?.trim();
  if (!name) return;
  try {
    const player = await Players.create({ name, efhub_url });
    // Si données efhub disponibles, créer la carte automatiquement
    if (window._efhubData && efhub_url) {
      const d = window._efhubData;
      const levelCap = d.level_cap || 25;
      await Cards.create({
        player_id: player.id,
        efhub_stats: d.baseStats ? { ...d.baseStats, position: d.position } : {},
        level_cap: levelCap,
        points_max: Progression.pointsFromLevelCap(levelCap),
        playing_style: d.playingStyle,
        card_type: d.cardType,
        skills: d.skills || [],
      });
      window._efhubData = null;
    }
    State.players = await Players.getAll();
    await selectPlayer(player.id);
    closeModal();
    render();
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}

async function updatePlayer(playerId) {
  const name = document.getElementById('m-player-name')?.value?.trim();
  const efhub_url = document.getElementById('m-efhub-url')?.value?.trim();
  if (!name) return;
  try {
    await Players.update(playerId, { name, efhub_url });
    State.players = await Players.getAll();
    closeModal();
    render();
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}

async function saveCard(playerId) {
  const d = window._cardEfhubData;
  if (!d) return;
  const levelCap = parseInt(document.getElementById('m-level-cap')?.value) || 25;
  const pointsMax = parseInt(document.getElementById('m-points-max')?.value) || Progression.pointsFromLevelCap(levelCap);
  const playingStyle = document.getElementById('m-playing-style')?.value?.trim();
  const cardType = document.getElementById('m-card-type')?.value?.trim();
  const boosterNative = document.getElementById('m-booster-native')?.value?.trim();
  const boosterExtra = document.getElementById('m-booster-extra')?.value?.trim();
  try {
    const card = await Cards.create({
      player_id: playerId,
      efhub_stats: d.baseStats ? { ...d.baseStats, position: d.position } : {},
      level_cap: levelCap,
      points_max: pointsMax,
      playing_style: playingStyle,
      card_type: cardType,
      booster_native: boosterNative,
      booster_extra: boosterExtra,
      skills: d.skills || [],
    });
    State.cards[playerId] = await Cards.getByPlayer(playerId);
    await selectCard(card.id);
    window._cardEfhubData = null;
    closeModal();
    render();
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}

async function saveBuild(cardId) {
  const name = document.getElementById('m-build-name')?.value?.trim();
  if (!name) return;
  const sliders = { ..._buildSliders };
  const pointsUsed = Progression.totalPoints(sliders);
  try {
    const build = await Builds.create({ card_id: cardId, name, sliders, points_used: pointsUsed });
    State.builds[cardId] = await Builds.getByCard(cardId);
    State.selectedBuildId = build.id;
    Object.keys(_buildSliders).forEach(k => delete _buildSliders[k]);
    closeModal();
    render();
  } catch(e) { alert('Erreur : ' + e.message); }
}

async function saveMatch() {
  const buildId = document.getElementById('m-match-build')?.value;
  const result = document.getElementById('m-match-result')?.value;
  if (!result) { showToast('Sélectionne un résultat', 'warning'); return; }
  // Vérifier que les 11 titulaires ont tous une note
  var titulairesPids = _matchTitulaires.map(function(t) { return t.player_id; }).filter(Boolean);
  var notesManquantes = titulairesPids.filter(function(pid) {
    return !_matchPlayerStats[pid] || !(_matchPlayerStats[pid].rating > 0);
  });
  if (notesManquantes.length > 0) {
    var names = notesManquantes.map(function(pid) {
      var p = State.players.find(function(x) { return x.id === pid; });
      return p ? p.name : pid;
    });
    showToast('Notes manquantes : ' + names.join(', '), 'warning', 5000);
    return;
  }
  saveLastInstructions();

  // Construire player_stats depuis _matchPlayerStats — avec build_id par joueur
  const allLineup = _matchTitulaires.concat(_matchRemplacants);
  const playerStats = Object.entries(_matchPlayerStats).map(([pid, stats]) => {
    const lineupEntry = allLineup.find(s => s.player_id === pid);
    const squad23Entry = _squad23.find(s => s.player_id === pid);
    const buildId_player = (lineupEntry && lineupEntry.build_id) || (squad23Entry && squad23Entry.build_id) || null;
    return {
      player_id: pid,
      build_id: buildId_player,
      goals: stats.goals || 0,
      assists: stats.assists || 0,
      saves: stats.saves || 0,
      yellow_card: stats.yellow_card || false,
      red_card: stats.red_card || false,
      rating: stats.rating || 0,
    };
  });

  const data = {
    build_id: null, // Retiré — build_id est maintenant par joueur dans player_stats
    coach_id: document.getElementById('m-coach-id')?.value || null,
    result,
    match_date: document.getElementById('m-match-date')?.value || null,
    match_time: document.getElementById('m-match-time')?.value || null,
    match_type: document.getElementById('m-match-type')?.value || null,
    rank: document.getElementById('m-match-rank')?.value,
    score_for: parseInt(document.getElementById('m-score-for')?.value) || 0,
    score_against: parseInt(document.getElementById('m-score-against')?.value) || 0,
    opp_name: document.getElementById('m-opp-name')?.value?.trim() || null,
    formation: document.getElementById('m-formation')?.value?.trim() || null,
    opp_formation: document.getElementById('m-opp-formation')?.value?.trim() || null,
    my_rank: parseInt(document.getElementById('m-my-rank')?.value) || null,
    opp_rank: parseInt(document.getElementById('m-opp-rank')?.value) || null,
    titulaires: _matchTitulaires,
    remplacants: _matchRemplacants,
    substitutions: _matchSubs,
    attack1_instruction: document.getElementById('m-attack1-instruction')?.value || 'Off',
    attack1_target: document.getElementById('m-attack1-target')?.value || null,
    attack2_instruction: document.getElementById('m-attack2-instruction')?.value || 'Off',
    attack2_target: document.getElementById('m-attack2-target')?.value || null,
    defence1_instruction: document.getElementById('m-defence1-instruction')?.value || 'Off',
    defence1_target: document.getElementById('m-defence1-target')?.value || null,
    defence2_instruction: document.getElementById('m-defence2-instruction')?.value || 'Off',
    defence2_target: document.getElementById('m-defence2-target')?.value || null,
    player_stats: playerStats,
    man_of_match: document.getElementById('m-man-of-match')?.value || null,
    note: parseInt(document.getElementById('m-note')?.value) || 3,
    repeated_opponent: document.getElementById('m-repeated-opponent')?.checked || false,
    source: 'app',
  };
  try {
    await Matches.create(data);
    State.matches = await Matches.getAll();
    _matchPlayerStats = {};
    closeModal();
    render();
    showToast('Match enregistré !', 'success');
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}

async function confirmDelete(type, id) {
  showConfirm('Supprimer définitivement ?', async function() {
  try {
    if (type === 'player') {
      await Players.delete(id);
      State.players = await Players.getAll();
      State.selectedPlayerId = State.players[0]?.id || null;
      if (State.selectedPlayerId) await selectPlayer(State.selectedPlayerId);
    }
    if (type === 'build') {
      await Builds.delete(id);
      const cardId = State.selectedCardId;
      State.builds[cardId] = await Builds.getByCard(cardId);
      State.selectedBuildId = State.builds[cardId][0]?.id || null;
    }
    if (type === 'match') {
      await Matches.delete(id);
      State.matches = await Matches.getAll();
    }
    render();
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
  });
}

// ── Nouvelles fonctionnalités ─────────────────────────────────────────────────

// 1. Auto-init stats depuis la composition + instructions mémorisées
var INSTRUCTIONS_STORAGE_KEY = 'efb_last_instructions';

function initMatchPlayerStatsFromLineup() {
  // Titulaires → toujours dans les stats
  _matchTitulaires.forEach(function(sel) {
    if (!_matchPlayerStats[sel.player_id]) {
      _matchPlayerStats[sel.player_id] = {
        goals: 0, assists: 0, saves: 0,
        yellow_card: false, red_card: false,
        rating: 0, _collapsed: true
      };
    }
  });
  // Remplaçants → seulement ceux qui ont joué (played === true)
  _matchRemplacants.forEach(function(sel) {
    if (sel.played === true && !_matchPlayerStats[sel.player_id]) {
      _matchPlayerStats[sel.player_id] = {
        goals: 0, assists: 0, saves: 0,
        yellow_card: false, red_card: false,
        rating: 0, _collapsed: true
      };
    }
  });
}

function saveLastInstructions() {
  try {
    var data = {
      a1: document.getElementById('m-attack1-instruction') ? document.getElementById('m-attack1-instruction').value : 'Off',
      a1t: document.getElementById('m-attack1-target') ? document.getElementById('m-attack1-target').value : '',
      a2: document.getElementById('m-attack2-instruction') ? document.getElementById('m-attack2-instruction').value : 'Off',
      a2t: document.getElementById('m-attack2-target') ? document.getElementById('m-attack2-target').value : '',
      d1: document.getElementById('m-defence1-instruction') ? document.getElementById('m-defence1-instruction').value : 'Off',
      d1t: document.getElementById('m-defence1-target') ? document.getElementById('m-defence1-target').value : '',
      d2: document.getElementById('m-defence2-instruction') ? document.getElementById('m-defence2-instruction').value : 'Off',
      d2t: document.getElementById('m-defence2-target') ? document.getElementById('m-defence2-target').value : '',
    };
    localStorage.setItem(INSTRUCTIONS_STORAGE_KEY, JSON.stringify(data));
  } catch(e) {}
}

function applyLastInstructions() {
  try {
    var saved = localStorage.getItem(INSTRUCTIONS_STORAGE_KEY);
    if (!saved) return;
    var d = JSON.parse(saved);
    // Joueurs actuellement sur le terrain
    var usedInPids = _matchSubs.map(function(s) { return s.in_player_id; });
    var onPitch = _matchTitulaires.map(function(t) {
      var sub = _matchSubs.find(function(s) { return s.out_player_id === t.player_id; });
      return sub ? sub.in_player_id : t.player_id;
    });
    usedInPids.forEach(function(pid) { if (!onPitch.includes(pid)) onPitch.push(pid); });

    var fields = [
      ['m-attack1-instruction', d.a1], ['m-attack1-target', onPitch.includes(d.a1t) ? d.a1t : ''],
      ['m-attack2-instruction', d.a2], ['m-attack2-target', onPitch.includes(d.a2t) ? d.a2t : ''],
      ['m-defence1-instruction', d.d1], ['m-defence1-target', onPitch.includes(d.d1t) ? d.d1t : ''],
      ['m-defence2-instruction', d.d2], ['m-defence2-target', onPitch.includes(d.d2t) ? d.d2t : ''],
    ];
    fields.forEach(function(f) {
      var el = document.getElementById(f[0]);
      if (el) el.value = f[1] || '';
    });
  } catch(e) {}
}

// Render une seule ligne de stats joueur (pour mise à jour partielle)
function renderSinglePlayerStatRow(pid) {
  var stats = _matchPlayerStats[pid];
  if (!stats) return '';
  var player = State.players.find(function(p) { return p.id === pid; });
  var cards = State.cards[pid] || [];
  var card = cards[0];
  var isGK = card && card.efhub_stats && card.efhub_stats.position === 'GK';
  var efhubId = player ? Efhub.parseId(player.efhub_url || '') : null;
  var imgUrl = efhubId ? Efhub.imgUrl(efhubId) : null;
  var isCollapsed = stats._collapsed !== false;
  var isFromLineup = _matchTitulaires.concat(_matchRemplacants).some(function(s) { return s.player_id === pid; });
  var q = String.fromCharCode(39);

  var parts = [];
  if (stats.goals > 0) parts.push('Buts: ' + stats.goals);
  if (stats.assists > 0) parts.push('Passes: ' + stats.assists);
  if (stats.saves > 0) parts.push('Arrets: ' + stats.saves);
  if (stats.yellow_card) parts.push('Jaune');
  if (stats.red_card) parts.push('Rouge');
  if (stats.rating > 0) parts.push(stats.rating + '/10');
  var summary = parts.length > 0 ? parts.join(' | ') : 'Aucune stat';

  // SVG icônes
  var iconBut = '<i class="ti ti-target-arrow" style="font-size:16px"></i>';
  var iconPasse = '<i class="ti ti-ball-football" style="font-size:16px"></i>';
  var iconGK = '<i class="ti ti-hand-stop" style="font-size:16px"></i>';

  var html = '<div class="match-player-stat-row" id="mpsr-' + pid + '">';
  html += '<div class="match-player-stat-header" onclick="toggleMatchPlayerCollapse(' + q + pid + q + ')" style="cursor:pointer">';
  if (imgUrl) html += '<img src="' + imgUrl + '" style="width:24px;height:30px;border-radius:3px;object-fit:cover">';
  html += '<span class="match-player-stat-name">' + (player ? player.name : pid) + '</span>';
  html += '<span style="font-size:10px;color:var(--muted);flex:1;margin-left:6px">' + summary + '</span>';
  html += '<i class="ti ' + (isCollapsed ? 'ti-chevron-down' : 'ti-chevron-up') + '" style="font-size:12px;color:var(--muted)"></i>';
  if (!isFromLineup) {
    html += '<button class="btn-icon danger" style="margin-left:4px" onclick="removeMatchPlayerStat(' + q + pid + q + ');event.stopPropagation()"><i class="ti ti-x"></i></button>';
  }
  html += '</div>';

  if (!isCollapsed) {
    html += '<div class="match-player-stat-fields">';
    html += '<div class="match-stat-field">' + iconBut;
    html += '<button class="btn-click" onclick="updateMatchStat(' + q + pid + q + ',' + q + 'goals' + q + ',-1)">-</button>';
    html += '<span id="mps-goals-' + pid + '">' + stats.goals + '</span>';
    html += '<button class="btn-click" onclick="updateMatchStat(' + q + pid + q + ',' + q + 'goals' + q + ',1)">+</button></div>';

    html += '<div class="match-stat-field">' + iconPasse;
    html += '<button class="btn-click" onclick="updateMatchStat(' + q + pid + q + ',' + q + 'assists' + q + ',-1)">-</button>';
    html += '<span id="mps-assists-' + pid + '">' + stats.assists + '</span>';
    html += '<button class="btn-click" onclick="updateMatchStat(' + q + pid + q + ',' + q + 'assists' + q + ',1)">+</button></div>';

    if (isGK) {
      html += '<div class="match-stat-field">' + iconGK;
      html += '<button class="btn-click" onclick="updateMatchStat(' + q + pid + q + ',' + q + 'saves' + q + ',-1)">-</button>';
      html += '<span id="mps-saves-' + pid + '">' + stats.saves + '</span>';
      html += '<button class="btn-click" onclick="updateMatchStat(' + q + pid + q + ',' + q + 'saves' + q + ',1)">+</button></div>';
    }

    html += '<button class="card-btn-small ' + (stats.yellow_card ? 'active-yellow' : '') + '" onclick="toggleMatchCard(' + q + pid + q + ',' + q + 'yellow' + q + ')">🟡</button>';
    html += '<button class="card-btn-small ' + (stats.red_card ? 'active-red' : '') + '" onclick="toggleMatchCard(' + q + pid + q + ',' + q + 'red' + q + ')">🔴</button>';
    html += '</div>';

    html += '<div class="match-player-rating"><span style="font-size:10px;color:var(--muted)">Note eFootball /10</span>';
    html += '<div class="rating-mini-btns">';
    [1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10].forEach(function(n) {
      html += '<button class="rating-mini-btn ' + (stats.rating === n ? 'active' : '') + '" onclick="setMatchPlayerRating(' + q + pid + q + ',' + n + ')">' + n + '</button>';
    });
    html += '</div></div>';
  }
  html += '</div>';
  return html;
}

function toggleMatchPlayerCollapse(pid) {
  if (_matchPlayerStats[pid]) {
    _matchPlayerStats[pid]._collapsed = !_matchPlayerStats[pid]._collapsed;
    var row = document.getElementById('mpsr-' + pid);
    if (row) row.outerHTML = renderSinglePlayerStatRow(pid);
  }
}

// 2. Nouveau rendu stats avec collapse
function renderMatchPlayerStatsListV2() {
  var pids = Object.keys(_matchPlayerStats);
  if (pids.length === 0) {
    return '<div style="color:var(--muted);font-size:11px;padding:6px 0">Aucun joueur — ajoute des titulaires</div>';
  }
  return pids.map(function(pid) {
    return renderSinglePlayerStatRow(pid);
  }).join('');
}

function _renderMatchPlayerStatsListV2_OLD() {
  var q = String.fromCharCode(39);
  var pids = Object.keys(_matchPlayerStats);
  if (pids.length === 0) {
    return '<div style="color:var(--muted);font-size:11px;padding:6px 0">Aucun joueur</div>';
  }
  return pids.map(function(pid) {
    var stats = _matchPlayerStats[pid];
    var player = State.players.find(function(p) { return p.id === pid; });
    var cards = State.cards[pid] || [];
    var card = cards[0];
    var isGK = card && card.efhub_stats && card.efhub_stats.position === 'GK';
    var efhubId = player ? Efhub.parseId(player.efhub_url || '') : null;
    var imgUrl = efhubId ? Efhub.imgUrl(efhubId) : null;
    var isCollapsed = stats._collapsed !== false;
    var isFromLineup = _matchTitulaires.concat(_matchRemplacants).some(function(s) { return s.player_id === pid; });

    var parts = [];
    if (stats.goals > 0) parts.push('Buts: ' + stats.goals);
    if (stats.assists > 0) parts.push('Passes: ' + stats.assists);
    if (stats.saves > 0) parts.push('Arrets: ' + stats.saves);
    if (stats.yellow_card) parts.push('Jaune');
    if (stats.red_card) parts.push('Rouge');
    if (stats.rating > 0) parts.push(stats.rating + '/10');
    var summary = parts.length > 0 ? parts.join(' | ') : 'Aucune stat';

    var html = '<div class="match-player-stat-row" id="mpsr-' + pid + '">';
    html += '<div class="match-player-stat-header" onclick="toggleMatchPlayerCollapse(' + q + pid + q + ')" style="cursor:pointer">';
    if (imgUrl) html += '<img src="' + imgUrl + '" style="width:24px;height:30px;border-radius:3px;object-fit:cover">';
    html += '<span class="match-player-stat-name">' + (player ? player.name : pid) + '</span>';
    html += '<span style="font-size:10px;color:var(--muted);flex:1;margin-left:6px">' + summary + '</span>';
    html += '<i class="ti ' + (isCollapsed ? 'ti-chevron-down' : 'ti-chevron-up') + '" style="font-size:12px;color:var(--muted)"></i>';
    if (!isFromLineup) {
      html += '<button class="btn-icon danger" style="margin-left:4px" onclick="removeMatchPlayerStat(' + q + pid + q + ');event.stopPropagation()"><i class="ti ti-x"></i></button>';
    }
    html += '</div>';

    if (!isCollapsed) {
      html += '<div class="match-player-stat-fields">';
      html += '<div class="match-stat-field"><span>Buts</span>';
      html += '<button class="btn-click" onclick="updateMatchStat(' + q + pid + q + ',' + q + 'goals' + q + ',-1)">-</button>';
      html += '<span id="mps-goals-' + pid + '">' + stats.goals + '</span>';
      html += '<button class="btn-click" onclick="updateMatchStat(' + q + pid + q + ',' + q + 'goals' + q + ',1)">+</button></div>';

      html += '<div class="match-stat-field"><span>Passes</span>';
      html += '<button class="btn-click" onclick="updateMatchStat(' + q + pid + q + ',' + q + 'assists' + q + ',-1)">-</button>';
      html += '<span id="mps-assists-' + pid + '">' + stats.assists + '</span>';
      html += '<button class="btn-click" onclick="updateMatchStat(' + q + pid + q + ',' + q + 'assists' + q + ',1)">+</button></div>';

      if (isGK) {
        html += '<div class="match-stat-field"><span>Arrets</span>';
        html += '<button class="btn-click" onclick="updateMatchStat(' + q + pid + q + ',' + q + 'saves' + q + ',-1)">-</button>';
        html += '<span id="mps-saves-' + pid + '">' + stats.saves + '</span>';
        html += '<button class="btn-click" onclick="updateMatchStat(' + q + pid + q + ',' + q + 'saves' + q + ',1)">+</button></div>';
      }

      html += '<button class="card-btn-small ' + (stats.yellow_card ? 'active-yellow' : '') + '" onclick="toggleMatchCard(' + q + pid + q + ',' + q + 'yellow' + q + ')">Jaune</button>';
      html += '<button class="card-btn-small ' + (stats.red_card ? 'active-red' : '') + '" onclick="toggleMatchCard(' + q + pid + q + ',' + q + 'red' + q + ')">Rouge</button>';
      html += '</div>';

      html += '<div class="match-player-rating"><span style="font-size:10px;color:var(--muted)">Note eFootball /10</span>';
      html += '<div class="rating-mini-btns">';
      [1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10].forEach(function(n) {
        html += '<button class="rating-mini-btn ' + (stats.rating === n ? 'active' : '') + '" onclick="setMatchPlayerRating(' + q + pid + q + ',' + n + ')">' + n + '</button>';
      });
      html += '</div></div>';
    }
    html += '</div>';
    return html;
  }).join('');
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPOSITION MATCH — 23 joueurs avec builds
// ══════════════════════════════════════════════════════════════════════════════
var _squad23 = []; // [{player_id, card_id, build_id}]

function saveSquad23() {
  try { localStorage.setItem(SQUAD_STORAGE_KEY, JSON.stringify(_squad23)); } catch(e) {}
}

function loadSquad23() {
  try {
    var saved = localStorage.getItem(SQUAD_STORAGE_KEY);
    if (!saved) return;
    var data = JSON.parse(saved);
    var allPids = State.players.map(function(p) { return p.id; });
    var allCids = Object.values(State.cards).flat().map(function(c) { return c.id; });
    var allBids = Object.values(State.builds).flat().map(function(b) { return b.id; });
    _squad23 = data.filter(function(s) {
      return allPids.includes(s.player_id) && allCids.includes(s.card_id);
    }).map(function(s) {
      // Si le build n'existe plus, mettre null
      return { player_id: s.player_id, card_id: s.card_id, build_id: allBids.includes(s.build_id) ? s.build_id : null };
    });
  } catch(e) {}
}

function renderSquad23Section() {
  loadSquad23();
  var q = String.fromCharCode(39);
  var available = State.players.filter(function(p) {
    return !_squad23.some(function(s) { return s.player_id === p.id; });
  }).filter(function(p) { return (State.cards[p.id] || []).length > 0; });

  var html = '<div class="squad23-section">';
  html += '<div class="squad23-header">';
  html += '<span class="squad23-title">Composition match (' + _squad23.length + '/23)</span>';
  if (_squad23.length > 0) html += '<button class="btn-sm btn-ghost" onclick="clearSquad23()">Effacer tout</button>';
  html += '</div>';

  // Liste des 23 sélectionnés
  html += '<div class="squad23-list">';
  _squad23.forEach(function(sel, i) {
    var p = State.players.find(function(x) { return x.id === sel.player_id; });
    var cards = State.cards[sel.player_id] || [];
    var card = cards.find(function(c) { return c.id === sel.card_id; }) || cards[0];
    var builds = State.builds[sel.card_id] || [];
    var efhubId = p ? Efhub.parseId(p.efhub_url || '') : null;
    var imgUrl = efhubId ? Efhub.imgUrl(efhubId) : null;

    html += '<div class="squad23-row">';
    html += '<span class="squad23-num">' + (i+1) + '</span>';
    if (imgUrl) html += '<img src="' + imgUrl + '" style="width:24px;height:30px;border-radius:3px;object-fit:cover;flex-shrink:0">';
    html += '<span class="squad23-name">' + (p ? p.name : '?') + '</span>';
    html += '<span class="squad23-pos">' + (card && card.efhub_stats ? card.efhub_stats.position || '' : '') + '</span>';
    // Select build
    html += '<select class="form-input form-input-sm squad23-build-sel" onchange="updateSquad23Build(' + i + ',this.value)">';
    html += '<option value="">— Build —</option>';
    builds.forEach(function(b) {
      html += '<option value="' + b.id + '"' + (sel.build_id === b.id ? ' selected' : '') + '>' + b.name + '</option>';
    });
    html += '</select>';
    html += '<button class="btn-icon danger" onclick="removeFromSquad23(' + i + ')"><i class="ti ti-x"></i></button>';
    html += '</div>';
  });

  // Ajouter joueur
  if (_squad23.length < 23 && available.length > 0) {
    html += '<select class="form-input form-input-sm" style="margin-top:6px" onchange="addToSquad23(this.value)">';
    html += '<option value="">+ Ajouter un joueur...</option>';
    available.forEach(function(p) {
      var cards = State.cards[p.id] || [];
      cards.forEach(function(c) {
        html += '<option value="' + p.id + '|' + c.id + '">' + p.name + ' — ' + (c.card_type || '') + ' ' + (c.efhub_stats ? c.efhub_stats.position || '' : '') + '</option>';
      });
    });
    html += '</select>';
  }
  html += '</div></div>';
  return html;
}

function addTrendingToSquad23(cardId) {
  loadSquad23();
  var card = Object.values(State.cards).flat().find(function(c) { return c.id === cardId; });
  if (!card) return;
  var pid = card.player_id;

  // Vérifier si déjà dans la Squad 23
  if (_squad23.find(function(s) { return s.player_id === pid; })) return;

  if (_squad23.length >= 23) {
    showToast('Sélection complète (23 joueurs)', 'warning');
    return;
  }

  _squad23.push({ player_id: pid, card_id: cardId, build_id: null });
  saveSquad23();
  render();
}

function addBuildToSquad23(buildId) {
  loadSquad23();
  var build = Object.values(State.builds).flat().find(function(b) { return b.id === buildId; });
  if (!build) return;
  var card = Object.values(State.cards).flat().find(function(c) { return c.id === build.card_id; });
  if (!card) return;
  var pid = card.player_id;

  // Vérifier si le joueur est déjà dans la Squad 23
  var existing = _squad23.find(function(s) { return s.player_id === pid; });
  if (existing) {
    // Mettre à jour le build actif
    existing.build_id = buildId;
    saveSquad23();
    // Feedback visuel
    var btn = document.getElementById('squad-btn-' + buildId);
    if (btn) { btn.className = 'ti ti-check'; setTimeout(function() { btn.className = 'ti ti-user-plus'; }, 1500); }
    var el = document.getElementById('squad23-container');
    if (el) el.innerHTML = renderSquad23Section();
    return;
  }

  // Vérifier la limite de 23
  if (_squad23.length >= 23) {
    showToast('Sélection complète (23 joueurs)', 'warning');
    return;
  }

  // Ajouter le joueur avec ce build
  _squad23.push({ player_id: pid, card_id: card.id, build_id: buildId });
  saveSquad23();

  // Feedback visuel
  var btn = document.getElementById('squad-btn-' + buildId);
  if (btn) { btn.className = 'ti ti-check'; setTimeout(function() { btn.className = 'ti ti-user-plus'; }, 1500); }

  // Rafraîchir la section Squad 23
  var el = document.getElementById('squad23-container');
  if (el) el.innerHTML = renderSquad23Section();
}

function addToSquad23(val) {
  if (!val) return;
  var parts = val.split('|');
  var pid = parts[0]; var cid = parts[1];
  var builds = State.builds[cid] || [];
  var defaultBuild = builds.length > 0 ? builds[0].id : null;
  _squad23.push({ player_id: pid, card_id: cid, build_id: defaultBuild });
  saveSquad23();
  // Re-render la section
  var el = document.getElementById('squad23-container');
  if (el) el.innerHTML = renderSquad23Section();
}

function removeFromSquad23(idx) {
  _squad23.splice(idx, 1);
  saveSquad23();
  var el = document.getElementById('squad23-container');
  if (el) el.innerHTML = renderSquad23Section();
}

function updateSquad23Build(idx, buildId) {
  if (_squad23[idx]) { _squad23[idx].build_id = buildId || null; saveSquad23(); }
}

function clearSquad23() {
  showConfirm('Effacer toute la composition ?', function() {
  _squad23 = [];
  saveSquad23();
  var el = document.getElementById('squad23-container');
  if (el) el.innerHTML = renderSquad23Section();
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// MODIFIER BUILD
// ══════════════════════════════════════════════════════════════════════════════
function renderModalEditBuild(buildId) {
  var build = Object.values(State.builds).flat().find(function(b) { return b.id === buildId; });
  if (!build) return '';
  var card = Object.values(State.cards).flat().find(function(c) { return c.id === build.card_id; });
  if (!card) return '';
  var pointsMax = card.points_max || 0;
  var isTrending = card.card_type === 'Trending';

  if (isTrending) return '<div class="modal"><div class="modal-header"><h3>Carte Trending</h3><button class="btn-icon" onclick="closeModal()"><i class="ti ti-x"></i></button></div><div class="modal-body"><p style="color:var(--muted)">Non développable.</p></div><div class="modal-footer"><button class="btn-sm btn-ghost" onclick="closeModal()">Fermer</button></div></div>';

  // Initialiser _buildSliders avec les valeurs actuelles
  Object.keys(_buildSliders).forEach(function(k) { delete _buildSliders[k]; });
  var currentSliders = build.sliders || {};
  Object.keys(currentSliders).forEach(function(k) { _buildSliders[k] = currentSliders[k]; });

  var q = String.fromCharCode(39);
  return '<div class="modal modal-lg">' +
    '<div class="modal-header"><h3>Modifier ' + build.name + '</h3><button class="btn-icon" onclick="closeModal()"><i class="ti ti-x"></i></button></div>' +
    '<div class="modal-body">' +
    '<div class="form-group"><label>Nom du build</label><input type="text" id="m-build-name" value="' + (build.name || '') + '" class="form-input"></div>' +
    '<div class="build-points-display">Points utilisés : <span id="build-pts-used">' + Progression.totalPoints(_buildSliders) + '</span> / ' + pointsMax +
    '<div class="build-pts-bar-wrap"><div class="build-pts-bar" id="build-pts-bar" style="width:' + Math.min(100, (Progression.totalPoints(_buildSliders)/pointsMax)*100) + '%"></div></div></div>' +
    '<div class="build-sliders-form">' +
    SLIDERS_CONFIG.map(function(s) {
      var base = card.efhub_stats ? (card.efhub_stats[s.stats[0]] || 0) : 0;
      var currentClics = _buildSliders[s.key] || 0;
      return '<div class="build-slider-form-row">' +
        '<div class="build-slider-svg-icon">' + s.icon + '</div>' +
        '<div class="build-slider-form-info">' +
          '<span class="build-slider-form-label">' + s.label + '</span>' +
          '<span class="build-slider-form-stats">' + s.stats.map(function(sk) {
            var def = EFB_STATS_ORDER.find(function(e) { return e.key === sk; });
            return def ? def.label : sk;
          }).join(', ') + '</span>' +
        '</div>' +
        '<div class="build-slider-controls">' +
          '<button class="btn-click" onclick="adjustSlider(' + q + s.key + q + ',-1,' + q + card.id + q + ')">−</button>' +
          '<span class="build-slider-val" id="slider-val-' + s.key + '">' + currentClics + '</span>' +
          '<button class="btn-click" onclick="adjustSlider(' + q + s.key + q + ',1,' + q + card.id + q + ')">+</button>' +
        '</div>' +
        '<span class="build-slider-cost" id="slider-cost-' + s.key + '">' + Progression.clickCost(currentClics) + ' pts</span>' +
      '</div>';
    }).join('') +
    '</div></div>' +
    '<div class="modal-footer"><button class="btn-sm btn-ghost" onclick="closeModal()">Annuler</button><button class="btn-sm btn-primary" onclick="updateBuild(' + q + buildId + q + ')">Sauvegarder</button></div>' +
  '</div>';
}

async function updateBuild(buildId) {
  var name = document.getElementById('m-build-name')?.value?.trim();
  if (!name) return;
  var sliders = Object.assign({}, _buildSliders);
  var pointsUsed = Progression.totalPoints(sliders);
  try {
    await Builds.update(buildId, { name: name, sliders: sliders, points_used: pointsUsed });
    var build = Object.values(State.builds).flat().find(function(b) { return b.id === buildId; });
    if (build) {
      State.builds[build.card_id] = await Builds.getByCard(build.card_id);
    }
    Object.keys(_buildSliders).forEach(function(k) { delete _buildSliders[k]; });
    closeModal();
    render();
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}

// ── DÉTAIL MATCH (read-only) ──────────────────────────────────────────────────
function openMatchDetail(matchId) {
  var match = State.matches.find(function(m) { return m.id === matchId; });
  if (!match) return;
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-container').classList.remove('hidden');
  document.getElementById('modal-container').innerHTML = renderMatchDetail(match);
}

function renderMatchDetail(match) {
  var q = String.fromCharCode(39);
  var resultColor = match.result === 'V' ? 'var(--green)' : match.result === 'N' ? 'var(--amber)' : 'var(--red)';
  var date = match.match_date
    ? new Date(match.match_date).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
    : (match.played_at ? new Date(match.played_at).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) : '—');
  var typeLabels = {
    ligue_jcj_d1:'🏆 Ligue JCJ D1', ligue_jcj_d2:'🏆 Ligue JCJ D2', ligue_jcj_d3:'🏆 Ligue JCJ D3',
    ligue_ia_d1:'🤖 Ligue IA D1', ligue_ia_d2:'🤖 Ligue IA D2', ligue_ia_d3:'🤖 Ligue IA D3',
    event_jcj:'🎯 Évènement JCJ', event_ia:'🎯 Évènement IA', amical:'🤝 Amical', my_league:'⚽ My League',
  };
  var typeLabel = typeLabels[match.match_type] || match.match_type || '—';
  var coachName = match.efb_coaches ? match.efb_coaches.name : '—';
  var playerStats = match.player_stats || [];
  var tituPids = (match.titulaires || []).map(function(t) { return t.player_id; });
  var sortedStats = playerStats.slice().sort(function(a, b) {
    var ai = tituPids.indexOf(a.player_id);
    var bi = tituPids.indexOf(b.player_id);
    if (ai === -1) ai = 999;
    if (bi === -1) bi = 999;
    return ai - bi;
  });

  var html = '<div class="modal modal-lg" style="max-width:600px;max-height:88vh">' +
    '<div class="modal-header" style="background:var(--surface2)">' +
      '<div style="display:flex;align-items:center;gap:10px;flex:1">' +
        '<div style="width:36px;height:36px;border-radius:8px;background:' + (match.result === 'V' ? '#0d2818' : match.result === 'N' ? '#1a2000' : '#2a0f0f') + ';display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:' + resultColor + '">' + (match.result || '—') + '</div>' +
        '<div>' +
          '<div style="font-size:15px;font-weight:700">Real Madrid ' + (match.score_for || 0) + ' – ' + (match.score_against || 0) + ' ' + (match.opp_name || 'Adversaire') + '</div>' +
          '<div style="font-size:11px;color:var(--muted)">' + date + (match.match_time ? ' · ' + match.match_time : '') + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:4px">' +
        '<button class="btn-icon" onclick="closeModal();setTimeout(function(){openModal(' + q + 'editMatch' + q + ',' + q + match.id + q + ')},50)" title="Modifier"><i class="ti ti-pencil"></i></button>' +
        '<button class="btn-icon" onclick="closeModal()"><i class="ti ti-x"></i></button>' +
      '</div>' +
    '</div>' +
    '<div class="modal-body" style="gap:10px">' +

    '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
      '<span class="match-tag" style="font-size:11px;padding:3px 8px">' + typeLabel + '</span>' +
      (match.formation ? '<span class="match-tag" style="font-size:11px;padding:3px 8px"><i class="ti ti-layout-soccer-field" style="font-size:10px"></i> ' + match.formation + '</span>' : '') +
      (match.opp_formation ? '<span class="match-tag" style="font-size:11px;padding:3px 8px">Adv: ' + match.opp_formation + '</span>' : '') +
      (match.rank ? '<span class="match-tag rank" style="font-size:11px;padding:3px 8px">🏅 ' + match.rank + '</span>' : '') +
      (coachName !== '—' ? '<span class="match-tag coach" style="font-size:11px;padding:3px 8px"><i class="ti ti-whistle" style="font-size:10px"></i> ' + coachName + '</span>' : '') +
    '</div>' +

    (match.my_rank || match.opp_rank ? '<div style="font-size:11px;color:var(--muted)">Pts rang : ' + (match.my_rank || '—') + ' (moi) vs ' + (match.opp_rank || '—') + ' (adv)</div>' : '') +

    (match.substitutions && match.substitutions.length > 0 ? (function() {
      var s = '<div style="background:var(--surface3);border-radius:8px;padding:8px 10px">';
      s += '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:5px">Substitutions</div>';
      match.substitutions.forEach(function(sub) {
        var pOut = State.players.find(function(p) { return p.id === sub.out_player_id; });
        var pIn = State.players.find(function(p) { return p.id === sub.in_player_id; });
        s += '<div style="font-size:12px;display:flex;align-items:center;gap:6px;padding:2px 0">' +
          '<span style="color:var(--muted)">' + (sub.minute || '?') + String.fromCharCode(39) + '</span>' +
          '<span style="color:var(--red)">↓ ' + (pOut ? pOut.name : '?') + '</span>' +
          '<span style="color:var(--green)">↑ ' + (pIn ? pIn.name : '?') + '</span>' +
        '</div>';
      });
      s += '</div>';
      return s;
    })() : '') +

    (function() {
      var slots = [
        { key: 'attack1', label: 'Attack 1' }, { key: 'attack2', label: 'Attack 2' },
        { key: 'defence1', label: 'Defence 1' }, { key: 'defence2', label: 'Defence 2' },
      ];
      var active = slots.filter(function(sl) {
        var inst = match[sl.key + '_instruction'];
        return inst && inst !== 'Off';
      });
      if (!active.length) return '';
      var s = '<div style="background:var(--surface3);border-radius:8px;padding:8px 10px">';
      s += '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:5px">Instructions</div>';
      s += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">';
      active.forEach(function(sl) {
        var inst = match[sl.key + '_instruction'];
        var targetId = match[sl.key + '_target'];
        var targetName = targetId ? ((State.players.find(function(p) { return p.id === targetId; }) || {}).name || '') : '';
        s += '<div style="font-size:11px"><span style="color:var(--muted)">' + sl.label + '</span> ' + inst + (targetName ? ' · <span style="color:var(--accent)">' + targetName + '</span>' : '') + '</div>';
      });
      s += '</div></div>';
      return s;
    })() +

    (sortedStats.length > 0 ? (function() {
      var s = '<div>';
      s += '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">Performances joueurs</div>';
      s += '<div style="display:flex;flex-direction:column;gap:4px">';
      sortedStats.forEach(function(ps) {
        var player = State.players.find(function(p) { return p.id === ps.player_id; });
        var cards = State.cards[ps.player_id] || [];
        var card = cards[0];
        var pos = card && card.efhub_stats ? (card.efhub_stats.position || '') : '';
        var isTitu = tituPids.includes(ps.player_id);
        var efhubId = player ? Efhub.parseId(player.efhub_url || '') : null;
        var imgUrl = efhubId ? Efhub.imgUrl(efhubId) : null;
        var isMOTM = match.man_of_match === ps.player_id;
        s += '<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--surface3);border-radius:7px;' + (isMOTM ? 'border:0.5px solid var(--amber)' : '') + '">';
        if (imgUrl) s += '<img src="' + imgUrl + '" style="width:22px;height:28px;border-radius:3px;object-fit:cover;flex-shrink:0" onerror="this.style.display=\'none\'">';
        s += '<span style="font-size:10px;color:var(--accent);font-weight:700;width:26px;flex-shrink:0">' + pos + '</span>';
        s += '<span style="flex:1;font-size:12px;font-weight:600">' + (player ? player.name : '?') + (isMOTM ? ' 🏅' : '') + '</span>';
        if (!isTitu) s += '<span style="font-size:9px;color:var(--muted);background:var(--surface);padding:1px 5px;border-radius:4px">Rempl.</span>';
        if (ps.rating > 0) s += '<span style="font-size:12px;font-weight:700;color:' + (ps.rating >= 8 ? 'var(--green)' : ps.rating >= 6 ? 'var(--amber)' : 'var(--muted)') + '">' + ps.rating + '</span>';
        if (ps.goals > 0) s += '<span style="font-size:11px">⚽' + ps.goals + '</span>';
        if (ps.assists > 0) s += '<span style="font-size:11px">🎯' + ps.assists + '</span>';
        if (ps.saves > 0) s += '<span style="font-size:11px">🧤' + ps.saves + '</span>';
        if (ps.yellow_card) s += '<span style="font-size:12px">🟡</span>';
        if (ps.red_card) s += '<span style="font-size:12px">🔴</span>';
        s += '</div>';
      });
      s += '</div></div>';
      return s;
    })() : '') +

    '<div style="display:flex;gap:8px;align-items:center;padding:8px 10px;background:var(--surface3);border-radius:8px">' +
      '<span style="font-size:11px;color:var(--muted)">Note globale</span>' +
      '<span style="font-size:14px;font-weight:700;color:var(--accent)">' + (match.note || '—') + '/5</span>' +
      (match.repeated_opponent ? '<span style="font-size:11px;color:var(--amber);margin-left:auto">⚠ Adversaire répétitif</span>' : '') +
    '</div>' +

    '</div>' +
  '</div>';

  return html;
}

// ══════════════════════════════════════════════════════════════════════════════
// MODIFIER MATCH
// ══════════════════════════════════════════════════════════════════════════════
function renderModalEditMatch(matchId) {
  var match = State.matches.find(function(m) { return m.id === matchId; });
  if (!match) return '';
  var allPlayers = State.players;
  var q = String.fromCharCode(39);

  return '<div class="modal modal-lg">' +
    '<div class="modal-header"><h3>Modifier le match</h3><button class="btn-icon" onclick="closeModal()"><i class="ti ti-x"></i></button></div>' +
    '<div class="modal-body">' +

    '<div class="form-row">' +
      '<div class="form-group"><label>Adversaire</label><input type="text" id="em-opp" class="form-input" value="' + (match.opp_name || '') + '"></div>' +
      '<div class="form-group"><label>Type</label><select id="em-type" class="form-input">' +
        '<option value="ligue_jcj_d1"' + (match.match_type === 'ligue_jcj_d1' ? ' selected' : '') + '>🏆 Ligue JCJ D1</option>' +
        '<option value="ligue_jcj_d2"' + (match.match_type === 'ligue_jcj_d2' ? ' selected' : '') + '>🏆 Ligue JCJ D2</option>' +
        '<option value="ligue_jcj_d3"' + (match.match_type === 'ligue_jcj_d3' ? ' selected' : '') + '>🏆 Ligue JCJ D3</option>' +
        '<option value="ligue_ia_d1"' + (match.match_type === 'ligue_ia_d1' ? ' selected' : '') + '>🤖 Ligue IA D1</option>' +
        '<option value="ligue_ia_d2"' + (match.match_type === 'ligue_ia_d2' ? ' selected' : '') + '>🤖 Ligue IA D2</option>' +
        '<option value="ligue_ia_d3"' + (match.match_type === 'ligue_ia_d3' ? ' selected' : '') + '>🤖 Ligue IA D3</option>' +
        '<option value="event_jcj"' + (match.match_type === 'event_jcj' ? ' selected' : '') + '>🎯 Évènement JCJ</option>' +
        '<option value="event_ia"' + (match.match_type === 'event_ia' ? ' selected' : '') + '>🎯 Évènement IA</option>' +
        '<option value="amical"' + (match.match_type === 'amical' ? ' selected' : '') + '>🤝 Amical</option>' +
        '<option value="my_league"' + (match.match_type === 'my_league' ? ' selected' : '') + '>⚽ My League</option>' +
      '</select></div>' +
    '</div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label>Rang</label><select id="em-rank" class="form-input">' +
        '<option value="">— Sans rang —</option>' +
        EFB_RANKS.map(function(r) { return '<option value="' + r + '"' + (match.rank === r ? ' selected' : '') + '>' + r + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="form-group"><label><i class="ti ti-whistle" style="font-size:11px"></i> Coach</label><select id="em-coach" class="form-input">' +
        '<option value="">— Sans coach —</option>' +
        State.coaches.map(function(c) { return '<option value="' + c.id + '"' + (match.coach_id === c.id ? ' selected' : '') + '>' + c.name + '</option>'; }).join('') +
      '</select></div>' +
    '</div>' +

    '<div class="form-group"><label>Résultat</label>' +
    '<div class="result-selector">' +
      ['V','N','D'].map(function(v) {
        var label = v === 'V' ? 'Victoire' : v === 'N' ? 'Nul' : 'Défaite';
        return '<button class="result-btn' + (match.result === v ? ' active' : '') + '" data-val="' + v + '" onclick="selectResult(' + q + v + q + ')">' + label + '</button>';
      }).join('') +
    '</div>' +
    '<input type="hidden" id="m-match-result" value="' + (match.result || '') + '"></div>' +

    '<div class="form-row">' +
      '<div class="form-group"><label>Buts marqués</label><input type="number" id="em-score-for" class="form-input" value="' + (match.score_for || 0) + '"></div>' +
      '<div class="form-group"><label>Buts encaissés</label><input type="number" id="em-score-against" class="form-input" value="' + (match.score_against || 0) + '"></div>' +
    '</div>' +

    '<div class="form-row">' +
      '<div class="form-group"><label>Date</label><input type="date" id="em-date" class="form-input" value="' + (match.match_date || '') + '"></div>' +
      '<div class="form-group"><label>Heure</label><input type="time" id="em-time" class="form-input" value="' + (match.match_time || '') + '"></div>' +
    '</div>' +

    '<div class="form-row">' +
      '<div class="form-group"><label>🏅 Homme du match</label><select id="em-motm" class="form-input">' +
        '<option value="">— Aucun —</option>' +
        allPlayers.map(function(p) { return '<option value="' + p.id + '"' + (match.man_of_match === p.id ? ' selected' : '') + '>' + p.name + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="form-group"><label>Note globale (1-5)</label><select id="em-note" class="form-input">' +
        [1,2,3,4,5].map(function(n) { return '<option value="' + n + '"' + (match.note === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') +
      '</select></div>' +
    '</div>' +

    '<div class="form-group"><label class="checkbox-label"><input type="checkbox" id="em-repeated"' + (match.repeated_opponent ? ' checked' : '') + '> Adversaire répétitif</label></div>' +

    '</div>' +
    '<div class="modal-footer"><button class="btn-sm btn-ghost" onclick="closeModal()">Annuler</button><button class="btn-sm btn-primary" onclick="saveEditMatch(' + q + matchId + q + ')">Sauvegarder</button></div>' +
  '</div>';
}

async function saveEditMatch(matchId) {
  var result = document.getElementById('m-match-result')?.value;
  if (!result) { showToast('Sélectionne un résultat', 'warning'); return; }
  var data = {
    opp_name: document.getElementById('em-opp')?.value?.trim() || null,
    match_type: document.getElementById('em-type')?.value || null,
    rank: document.getElementById('em-rank')?.value || null,
    coach_id: document.getElementById('em-coach')?.value || null,
    result: result,
    score_for: parseInt(document.getElementById('em-score-for')?.value) || 0,
    score_against: parseInt(document.getElementById('em-score-against')?.value) || 0,
    match_date: document.getElementById('em-date')?.value || null,
    match_time: document.getElementById('em-time')?.value || null,
    man_of_match: document.getElementById('em-motm')?.value || null,
    note: parseInt(document.getElementById('em-note')?.value) || 3,
    repeated_opponent: document.getElementById('em-repeated')?.checked || false,
  };
  try {
    await Matches.update(matchId, data);
    State.matches = await Matches.getAll();
    closeModal();
    render();
    showToast('Match modifié !', 'success');
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}

// ══════════════════════════════════════════════════════════════════════════════
// ONGLET COACHS
// ══════════════════════════════════════════════════════════════════════════════

// localStorage key pour le coach actif
var COACH_STORAGE_KEY = 'efb_active_coach';

function getActiveCoachId() {
  try { return localStorage.getItem(COACH_STORAGE_KEY) || null; } catch(e) { return null; }
}

function setActiveCoachId(id) {
  try { if (id) localStorage.setItem(COACH_STORAGE_KEY, id); else localStorage.removeItem(COACH_STORAGE_KEY); } catch(e) {}
}

function renderCoachs() {
  var q = String.fromCharCode(39);
  var activeCoachId = getActiveCoachId();
  var coaches = State.coaches;

  var html = '<div class="coachs-page">';
  html += '<style>';
  html += '.coachs-page{padding:10px 14px;height:calc(100vh - 60px);overflow-y:auto}';
  html += '.coachs-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}';
  html += '.coachs-title{font-size:15px;font-weight:700}';
  html += '.coachs-list{display:flex;flex-direction:column;gap:10px}';
  html += '.coach-card{background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:10px 12px}';
  html += '.coach-card.coach-active{border-color:var(--accent)}';
  html += '.coach-card-header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px}';
  html += '.coach-card-left{flex:1;min-width:0}';
  html += '.coach-name{font-size:14px;font-weight:700;margin-bottom:3px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}';
  html += '.badge-active{font-size:10px;padding:1px 7px;border-radius:20px;background:var(--accent);color:#fff}';
  html += '.coach-meta{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:4px}';
  html += '.coach-meta-item{font-size:11px;color:var(--muted);display:flex;align-items:center;gap:3px}';
  html += '.coach-notes{font-size:11px;color:var(--muted);line-height:1.4;margin-top:2px;word-break:break-word}';
  html += '.coach-card-actions{display:flex;align-items:center;gap:4px;flex-shrink:0}';
  html += '.coach-stats{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}';
  html += '.coach-stat{font-size:11px;font-weight:600;color:var(--muted)}';
  html += '.coach-stat.win{color:var(--green)}.coach-stat.serie{color:var(--accent-light)}.coach-stat.serie-current{color:var(--green)}';
  html += '</style>';

  html += '<div class="coachs-header">';
  html += '<span class="coachs-title"><i class="ti ti-whistle"></i> Coachs (' + coaches.length + ')</span>';
  html += '<button class="btn-sm btn-primary" onclick="openModal(' + q + 'addCoach' + q + ')"><i class="ti ti-plus"></i> Ajouter</button>';
  html += '</div>';

  if (coaches.length === 0) {
    html += '<div class="empty-state"><i class="ti ti-whistle" style="font-size:36px;color:var(--border)"></i><p>Aucun coach enregistré</p><button class="btn-sm btn-primary" onclick="openModal(' + q + 'addCoach' + q + ')">+ Ajouter un coach</button></div>';
  } else {
    html += '<div class="coachs-list">';
    coaches.forEach(function(c) {
      var isActive = c.id === activeCoachId;
      var matchCount = State.matches.filter(function(m) { return m.coach_id === c.id; }).length;
      var coachMatches = State.matches.filter(function(m) { return m.coach_id === c.id; });
      var stats = Analyse.globalStats(coachMatches);
      var serie = Analyse.series(coachMatches);

      html += '<div class="coach-card' + (isActive ? ' coach-active' : '') + '">';
      html += '<div class="coach-card-header">';
      html += '<div class="coach-card-left">';
      html += '<div class="coach-name">' + c.name + (isActive ? ' <span class="badge-active">Actif</span>' : '') + '</div>';
      html += '<div class="coach-meta">';
      if (c.nationality) html += '<span class="coach-meta-item"><i class="ti ti-flag"></i> ' + c.nationality + '</span>';
      if (c.style)       html += '<span class="coach-meta-item"><i class="ti ti-run"></i> ' + c.style + '</span>';
      if (c.formation)   html += '<span class="coach-meta-item"><i class="ti ti-layout-soccer-field"></i> ' + c.formation + '</span>';
      html += '</div>';
      if (c.notes) html += '<div class="coach-notes">' + c.notes + '</div>';
      html += '</div>';
      html += '<div class="coach-card-actions">';
      html += '<button class="btn-sm ' + (isActive ? 'btn-ghost' : 'btn-primary') + '" onclick="toggleActiveCoach(' + q + c.id + q + ')">' + (isActive ? '<i class="ti ti-check"></i> Actif' : '<i class="ti ti-star"></i> Activer') + '</button>';
      html += '<button class="btn-icon" onclick="openModal(' + q + 'editCoach' + q + ',' + q + c.id + q + ')"><i class="ti ti-pencil"></i></button>';
      html += '<button class="btn-icon danger" onclick="confirmDeleteCoach(' + q + c.id + q + ')"><i class="ti ti-trash"></i></button>';
      html += '</div>';
      html += '</div>';

      // Stats
      if (matchCount > 0) {
        html += '<div class="coach-stats">';
        html += '<span class="coach-stat">' + stats.total + ' matchs</span>';
        html += '<span class="coach-stat win">' + stats.wins + 'V</span>';
        html += '<span class="coach-stat" style="color:var(--amber)">' + stats.draws + 'N</span>';
        html += '<span class="coach-stat" style="color:var(--red)">' + stats.losses + 'D</span>';
        html += '<span class="coach-stat win">(' + stats.winRate + '%)</span>';
        html += '<span class="coach-stat">' + stats.goalsFor + ' buts</span>';
        html += '<span class="coach-stat serie">⚡ Record: ' + serie.record + '</span>';
        if (serie.current > 0) html += '<span class="coach-stat serie-current">→ ' + serie.current + '</span>';
        html += '</div>';
        // Barre victoires
        html += '<div class="an-bar-wrap" style="margin:4px 0 0">';
        html += '<div class="an-seg-w" style="width:' + (stats.wins/stats.total*100) + '%"></div>';
        html += '<div class="an-seg-d" style="width:' + (stats.draws/stats.total*100) + '%"></div>';
        html += '<div class="an-seg-l" style="width:' + (stats.losses/stats.total*100) + '%"></div>';
        html += '</div>';
      } else {
        html += '<div style="font-size:11px;color:var(--muted);padding:6px 0">Aucun match avec ce coach</div>';
      }

      html += '</div>'; // coach-card
    });
    html += '</div>'; // coachs-list
  }

  html += '</div>'; // coachs-page
  return html;
}

function toggleActiveCoach(coachId) {
  var current = getActiveCoachId();
  if (current === coachId) {
    setActiveCoachId(null);
  } else {
    setActiveCoachId(coachId);
  }
  // Rafraîchir l'onglet
  var el = document.querySelector('.coachs-page');
  if (el) el.outerHTML = renderCoachs();
  else render();
}

async function confirmDeleteCoach(coachId) {
  showConfirm('Supprimer ce coach ?', async function() {
  try {
    await Coaches.delete(coachId);
    State.coaches = await Coaches.getAll();
    if (getActiveCoachId() === coachId) setActiveCoachId(null);
    render();
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
  });
}

// Modal — Ajouter coach
function renderModalAddCoach() {
  var q = String.fromCharCode(39);
  var alreadyNames = State.coaches.map(function(c) { return c.name.toLowerCase(); });

  // Grouper par style pour le dropdown
  var styles = ['Possession Game', 'Quick Counter', 'Long Ball Counter', 'Out Wide', 'Long Ball'];
  var dbOptions = '<option value="">— Importer depuis la base (' + EFB_COACHES_DB.length + ' coachs) —</option>';
  styles.forEach(function(style) {
    var coaches = EFB_COACHES_DB.filter(function(c) { return c.style === style; });
    if (coaches.length === 0) return;
    dbOptions += '<optgroup label="' + style + '">';
    coaches.forEach(function(c) {
      var idx = EFB_COACHES_DB.indexOf(c);
      var already = alreadyNames.includes(c.name.toLowerCase());
      var maxScore = Math.max(c.proficiency.possessionGame, c.proficiency.quickCounter, c.proficiency.longBallCounter, c.proficiency.outWide, c.proficiency.longBall);
      var hasBoosters = c.boosters && c.boosters.length > 0;
      var dateStr = c.releaseDate ? c.releaseDate.slice(0, 7) : '?';
      dbOptions += '<option value="' + idx + '"' + (already ? ' disabled' : '') + '>' +
        c.name + ' (' + maxScore + ')' + (hasBoosters ? ' ⚡' : '') + ' — ' + dateStr + (already ? ' ✓' : '') +
      '</option>';
    });
    dbOptions += '</optgroup>';
  });

  return '<div class="modal modal-lg">' +
    '<div class="modal-header"><h3>Ajouter un coach</h3><button class="btn-icon" onclick="closeModal()"><i class="ti ti-x"></i></button></div>' +
    '<div class="modal-body" style="max-height:65vh;overflow-y:auto">' +

    '<div class="form-group" style="background:var(--surface3);border-radius:8px;padding:10px;margin-bottom:12px">' +
      '<label style="color:var(--accent)"><i class="ti ti-database"></i> Import depuis la base</label>' +
      '<select id="mc-db-select" class="form-input" style="margin-top:6px" onchange="importCoachFromDB(this.value)">' +
        dbOptions +
      '</select>' +
      '<div id="mc-db-preview" style="margin-top:8px;font-size:11px;color:var(--muted)">Sélectionne un coach pour remplir le formulaire automatiquement. ⚡ = a des boosters.</div>' +
    '</div>' +

    '<div class="form-group"><label>Nom *</label><input type="text" id="mc-name" class="form-input" placeholder="Ex: Xabi Alonso"></div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label>Nationalité</label><input type="text" id="mc-nationality" class="form-input" placeholder="Ex: Espagnol"></div>' +
      '<div class="form-group"><label>Formation favorite</label><input type="text" id="mc-formation" class="form-input" placeholder="Ex: 4-3-3"></div>' +
    '</div>' +
    '<div class="form-group"><label>Style principal</label><select id="mc-style" class="form-input">' +
      '<option value="">— Choisir —</option>' +
      EFB_COACH_STYLES.map(function(s) { return '<option value="' + s + '">' + s + '</option>'; }).join('') +
    '</select></div>' +
    '<div class="form-group"><label>Notes (boosters, link-up play...)</label><textarea id="mc-notes" class="form-input" rows="3" placeholder="Ex: Low Pass +1, Defensive Engagement +1 | Link-Up: Over-the-Top Pass A"></textarea></div>' +

    '</div>' +
    '<div class="modal-footer">' +
      '<button class="btn-sm btn-ghost" onclick="closeModal()">Annuler</button>' +
      '<button class="btn-sm btn-primary" onclick="saveCoach()">Ajouter</button>' +
    '</div>' +
  '</div>';
}

function importCoachFromDB(idxStr) {
  if (idxStr === '' || idxStr === null || idxStr === undefined) return;
  var idx = parseInt(idxStr);
  if (isNaN(idx) || !EFB_COACHES_DB[idx]) return;
  var c = EFB_COACHES_DB[idx];

  // Remplir les champs
  var nameEl = document.getElementById('mc-name');
  if (nameEl) nameEl.value = c.name;

  var styleEl = document.getElementById('mc-style');
  if (styleEl) styleEl.value = c.style || '';

  var formEl = document.getElementById('mc-formation');
  if (formEl) formEl.value = '';

  // Notes avec toutes les infos utiles
  var notesEl = document.getElementById('mc-notes');
  if (notesEl) {
    var parts = [];
    if (c.boosters && c.boosters.length > 0) parts.push('Boosters: ' + c.boosters.join(', '));
    if (c.linkUpPlay) parts.push('Link-Up: ' + c.linkUpPlay + (c.linkUpCenterPiece ? ' | CP: ' + c.linkUpCenterPiece : '') + (c.linkUpKeyMan ? ' | KM: ' + c.linkUpKeyMan : ''));
    if (c.releaseDate) parts.push('Sortie: ' + c.releaseDate);
    notesEl.value = parts.join(' | ');
  }

  // Preview des proficiency scores
  var preview = document.getElementById('mc-db-preview');
  if (preview && c.proficiency) {
    var p = c.proficiency;
    preview.innerHTML =
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">' +
      '<span style="color:' + (p.possessionGame >= 85 ? 'var(--green)' : 'var(--muted)') + '">PG: ' + p.possessionGame + '</span>' +
      '<span style="color:' + (p.quickCounter >= 85 ? 'var(--green)' : 'var(--muted)') + '">QC: ' + p.quickCounter + '</span>' +
      '<span style="color:' + (p.longBallCounter >= 85 ? 'var(--green)' : 'var(--muted)') + '">LBC: ' + p.longBallCounter + '</span>' +
      '<span style="color:' + (p.outWide >= 85 ? 'var(--green)' : 'var(--muted)') + '">OW: ' + p.outWide + '</span>' +
      '<span style="color:' + (p.longBall >= 85 ? 'var(--green)' : 'var(--muted)') + '">LB: ' + p.longBall + '</span>' +
      '</div>';
  }
}

// Modal — Modifier coach
function renderModalEditCoach(coachId) {
  var c = State.coaches.find(function(x) { return x.id === coachId; });
  if (!c) return '';
  var q = String.fromCharCode(39);
  return '<div class="modal">' +
    '<div class="modal-header"><h3>Modifier ' + c.name + '</h3><button class="btn-icon" onclick="closeModal()"><i class="ti ti-x"></i></button></div>' +
    '<div class="modal-body">' +
      '<div class="form-group"><label>Nom *</label><input type="text" id="mc-name" class="form-input" value="' + (c.name || '') + '"></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label>Nationalité</label><input type="text" id="mc-nationality" class="form-input" value="' + (c.nationality || '') + '"></div>' +
        '<div class="form-group"><label>Formation favorite</label><input type="text" id="mc-formation" class="form-input" value="' + (c.formation || '') + '"></div>' +
      '</div>' +
      '<div class="form-group"><label>Style de jeu</label><select id="mc-style" class="form-input">' +
        '<option value="">— Choisir —</option>' +
        EFB_COACH_STYLES.map(function(s) { return '<option value="' + s + '"' + (c.style === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="form-group"><label>Notes</label><textarea id="mc-notes" class="form-input" rows="2">' + (c.notes || '') + '</textarea></div>' +
    '</div>' +
    '<div class="modal-footer">' +
      '<button class="btn-sm btn-ghost" onclick="closeModal()">Annuler</button>' +
      '<button class="btn-sm btn-primary" onclick="updateCoach(' + q + coachId + q + ')">Sauvegarder</button>' +
    '</div>' +
  '</div>';
}

async function saveCoach() {
  var name = document.getElementById('mc-name')?.value?.trim();
  if (!name) { showToast('Le nom est obligatoire', 'warning'); return; }
  var data = {
    name: name,
    nationality: document.getElementById('mc-nationality')?.value?.trim() || null,
    formation: document.getElementById('mc-formation')?.value?.trim() || null,
    style: document.getElementById('mc-style')?.value || null,
    notes: document.getElementById('mc-notes')?.value?.trim() || null,
  };
  try {
    await Coaches.create(data);
    State.coaches = await Coaches.getAll();
    closeModal();
    render();
    showToast('Coach ajouté !', 'success');
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}

async function updateCoach(coachId) {
  var name = document.getElementById('mc-name')?.value?.trim();
  if (!name) { alert('Le nom est obligatoire'); return; }
  var data = {
    name: name,
    nationality: document.getElementById('mc-nationality')?.value?.trim() || null,
    formation: document.getElementById('mc-formation')?.value?.trim() || null,
    style: document.getElementById('mc-style')?.value || null,
    notes: document.getElementById('mc-notes')?.value?.trim() || null,
  };
  try {
    await Coaches.update(coachId, data);
    State.coaches = await Coaches.getAll();
    closeModal();
    render();
    showToast('Coach modifié !', 'success');
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}
