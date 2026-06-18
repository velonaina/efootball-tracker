// ─────────────────────────────────────────────────────────────────────────────
// efb-ui.js — eFootball Tracker · Couche interface
// ─────────────────────────────────────────────────────────────────────────────

// ── État global ───────────────────────────────────────────────────────────────
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
async function init() {
  renderSkeleton();
  loadAllCustomFormations();
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
    // Vérifier si un brouillon de match existe
    setTimeout(checkMatchDraftOnLoad, 500);
  } catch (e) {
    showError('Erreur de connexion Supabase : ' + e.message);
  }
}

async function selectPlayer(playerId) {
  State.selectedPlayerId = playerId;
  _buildIAResult = null;
  _buildIALoading = false;
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
      ${State.activeTab === 'saison'    ? renderSaison() : ''}
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
      <span class="topbar-squad">Real Madrid</span>
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
    { id: 'saison',    label: 'Saison',    icon: 'ti-trophy' },
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


// ── Formation IA ──────────────────────────────────────────────────────────────
var _formationIALoading = false;

// ── Fetch avec retry automatique pour les appels Claude ──────────────────────
async function fetchCoachingWithRetry(body, maxRetries) {
  maxRetries = maxRetries || 2;
  var lastError = null;
  for (var attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      var response = await fetch(EFB_CONFIG.supabaseUrl + '/functions/v1/coaching', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + EFB_CONFIG.supabaseKey,
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      return await response.json();
    } catch(e) {
      lastError = e;
      if (attempt < maxRetries) {
        // Attendre 1.5s avant de réessayer
        await new Promise(function(resolve) { setTimeout(resolve, 1500); });
      }
    }
  }
  throw lastError;
}
var FT_IA_ANALYSIS_KEY = 'efb_ft_ia_analysis';

function renderFtIAPanel(data) {
  var raison = data.raison_formation || '';
  var atouts = data.atouts_cles || '';
  var instructions = data.instructions_match || '';
  var formation = data.formation || '';
  if (!raison && !atouts && !instructions) return null;

  var q = String.fromCharCode(39);
  var panel = document.createElement('div');
  panel.id = 'ft-ia-justif-panel';
  panel.style.cssText = 'background:var(--surface-2);border-radius:10px;padding:12px;margin-top:10px;font-size:12px;border:1px solid var(--border)';
  panel.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
      '<span style="font-weight:700;color:var(--primary)">🤖 Analyse IA — Formation ' + formation + '</span>' +
      '<button onclick="var p=document.getElementById(' + q + 'ft-ia-justif-panel' + q + ');if(p)p.style.display=' + q + 'none' + q + '" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px">✕</button>' +
    '</div>' +
    (raison ? '<div style="margin-bottom:8px"><div style="font-size:10px;font-weight:700;color:var(--amber);margin-bottom:3px">📐 POURQUOI CETTE FORMATION</div><div style="color:var(--text-secondary)">' + raison + '</div></div>' : '') +
    (atouts ? '<div style="margin-bottom:8px"><div style="font-size:10px;font-weight:700;color:var(--green);margin-bottom:3px">⚡ ATOUTS CLÉS</div><div style="color:var(--text-secondary)">' + atouts + '</div></div>' : '') +
    (instructions ? '<div><div style="font-size:10px;font-weight:700;color:var(--red);margin-bottom:3px">🎯 INSTRUCTIONS POUR GAGNER</div><div style="color:var(--text-secondary)">' + instructions + '</div></div>' : '');
  return panel;
}

function loadFtIAPanel() {
  try {
    var saved = localStorage.getItem(FT_IA_ANALYSIS_KEY);
    if (!saved) return;
    var data = JSON.parse(saved);
    var pitchCol = document.querySelector('.ft-pitch-col');
    if (!pitchCol || document.getElementById('ft-ia-justif-panel')) return;
    var panel = renderFtIAPanel(data);
    if (panel) {
      pitchCol.appendChild(panel);
      addFtIAToggleBtn();
    }
  } catch(e) {}
}

function saveFtFormationAsCustom() {
  if (!_ftFormation) { showToast('Aucune formation active', 'warning'); return; }

  // Récupérer les slots actuels
  var slots = buildPitchSlots(_ftFormation);
  if (!slots) { showToast('Formation invalide', 'error'); return; }

  // Construire les notes depuis l'analyse IA sauvegardée
  var notes = '';
  try {
    var saved = localStorage.getItem(FT_IA_ANALYSIS_KEY);
    if (saved) {
      var data = JSON.parse(saved);
      var parts = [];
      if (data.raison_formation) parts.push(data.raison_formation);
      if (data.atouts_cles) parts.push('Atouts: ' + data.atouts_cles);
      if (data.instructions_match) parts.push('Instructions: ' + data.instructions_match);
      if (data.date) parts.push('Analyse du ' + data.date);
      notes = parts.join(' | ');
    }
  } catch(e) {}

  // Demander un nom
  var defaultName = _ftFormation + ' IA';
  var name = window.prompt('Nom de la formation personnalisée:', defaultName);
  if (!name || !name.trim()) return;
  name = name.trim();

  // Sauvegarder avec notes
  saveCustomFormation(name, slots.map(function(s) { return { left: s.left, top: s.top, label: s.label }; }), notes);
  loadAllCustomFormations();
  showToast('Formation "' + name + '" enregistrée avec notes IA !', 'success');
}

function addFtIAToggleBtn() {
  if (document.getElementById('btn-ft-ia-panel')) return;
  var toolbar = document.querySelector('.ft-toolbar');
  if (!toolbar) return;
  var toggleBtn = document.createElement('button');
  toggleBtn.id = 'btn-ft-ia-panel';
  toggleBtn.className = 'btn-sm btn-ghost';
  toggleBtn.title = 'Afficher/masquer l analyse IA';
  toggleBtn.innerHTML = '<i class="ti ti-clipboard-text"></i>';
  toggleBtn.onclick = function() {
    var p = document.getElementById('ft-ia-justif-panel');
    if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
  };
  toolbar.appendChild(toggleBtn);
}

async function requestFormationIA() {
  if (_formationIALoading) return;
  _formationIALoading = true;

  var btn = document.getElementById('btn-formation-ia');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> IA...'; }

  try {
    // Squad 23
    loadSquad23();
    if (_squad23.length === 0) { showToast('Squad 23 vide — ajoute des joueurs d' + String.fromCharCode(39) + 'abord', 'warning'); return; }

    // Coach actif
    var activeCoachId = getActiveCoachId();
    var activeCoach = activeCoachId ? State.coaches.find(function(c){ return c.id === activeCoachId; }) : null;

    // Stats par formation depuis les matchs
    var matches = filterStatsMatches(State.matches);
    var formationStats = {};
    matches.forEach(function(m) {
      if (!m.formation) return;
      if (!formationStats[m.formation]) formationStats[m.formation] = { total: 0, wins: 0 };
      formationStats[m.formation].total++;
      if (m.result === 'V') formationStats[m.formation].wins++;
    });
    var formationStatsStr = Object.entries(formationStats).map(function(e) {
      return e[0] + ': ' + e[1].total + ' matchs, ' + Math.round(e[1].wins/e[1].total*100) + '% victoires';
    }).join(', ') || 'Aucune donnée';

    // Formations disponibles
    var availableFormations = Object.keys(POSITION_LABELS_BY_FORMATION).join(', ');

    // Joueurs du Squad 23 avec position, style et build sélectionné
    // Dédupliquer par player_id — garder uniquement la première occurrence
    var seenPlayerIds = {};
    var squad23Unique = _squad23.filter(function(s) {
      if (seenPlayerIds[s.player_id]) return false;
      seenPlayerIds[s.player_id] = true;
      return true;
    });

    var squadDetails = squad23Unique.map(function(s, i) {
      var player = State.players.find(function(p){ return p.id === s.player_id; });
      var cards = State.cards[s.player_id] || [];
      var card = cards.find(function(c){ return c.id === s.card_id; }) || cards[0];
      var pos = card ? (card.efhub_stats.position || '?') : '?';
      var style = card ? (card.efhub_stats.playingStyle || '?') : '?';
      var name = player ? player.name : 'Joueur ' + (i+1);

      // Build sélectionné + stats clés développées
      var buildList = s.card_id ? (State.builds[s.card_id] || []) : [];
      var build = buildList.find(function(b){ return b.id === s.build_id; }) || buildList[0];
      var buildInfo = '';
      if (build && card && card.efhub_stats) {
        var sliders = build.sliders || {};
        var statsFinal = Progression.allStatsFinal(card.efhub_stats, sliders);
        // Stats clés selon position
        var keyStats = [];
        if (pos === 'GK') {
          keyStats = ['gkCatching','gkReflexes','gkReach'];
        } else if (['CB','LB','RB'].includes(pos)) {
          keyStats = ['defensiveAwareness','ballWinning','speed'];
        } else if (['DMF','CMF'].includes(pos)) {
          keyStats = ['ballWinning','lowPass','stamina'];
        } else if (['AMF','LMF','RMF'].includes(pos)) {
          keyStats = ['offensiveAwareness','dribbling','lowPass'];
        } else if (['LWF','RWF'].includes(pos)) {
          keyStats = ['speed','dribbling','acceleration'];
        } else if (['CF','SS'].includes(pos)) {
          keyStats = ['finishing','speed','offensiveAwareness'];
        }
        var statsStr = keyStats.map(function(k){ return k + ':' + (statsFinal[k] || card.efhub_stats[k] || 0); }).join('/');
        buildInfo = ' | build:"' + build.name + '" stats:' + statsStr;
      }

      // Win rate du joueur
      var pMatches = filterStatsMatches(State.matches).filter(function(m){
        return m.player_stats && m.player_stats.some(function(ps){ return ps.player_id === s.player_id; });
      });
      var pWinRate = pMatches.length > 0 ? Math.round(pMatches.filter(function(m){return m.result==='V';}).length/pMatches.length*100) : 0;

      return (i+1) + '. ' + name + ' [' + pos + '] style:' + style + ' winRate:' + pWinRate + '%' + buildInfo;
    }).join('\n');

    // Remplacer _squad23 par squad23Unique pour l'assignation
    var squadForIA = squad23Unique;

    // Positions disponibles selon formations
    var positionsParFormation = Object.entries(POSITION_LABELS_BY_FORMATION).map(function(e) {
      return e[0] + ': ' + e[1].join(', ');
    }).join('\n');

    var nl = '\n';
    // Formations gagnantes (>60% victoires avec min 5 matchs)
    var formationsGagnantes = Object.entries(formationStats)
      .filter(function(e){ return e[1].total >= 5 && Math.round(e[1].wins/e[1].total*100) >= 60; })
      .sort(function(a,b){ return (b[1].wins/b[1].total) - (a[1].wins/a[1].total); })
      .map(function(e){ return e[0] + ' (' + Math.round(e[1].wins/e[1].total*100) + '% sur ' + e[1].total + ' matchs)'; })
      .join(', ') || 'Aucune formation avec 5+ matchs et >60%';

    // Joueurs rapides (speed/acceleration élevé) pour Quick Counter
    var joueursRapides = squad23Unique.filter(function(s) {
      var cards = State.cards[s.player_id] || [];
      var card = cards.find(function(c){ return c.id === s.card_id; }) || cards[0];
      if (!card || !card.efhub_stats) return false;
      var build = (State.builds[s.card_id] || []).find(function(b){ return b.id === s.build_id; });
      var stats = build ? Progression.allStatsFinal(card.efhub_stats, build.sliders || {}) : card.efhub_stats;
      return (stats.speed || 0) >= 80 || (stats.acceleration || 0) >= 80;
    }).map(function(s){
      var p = State.players.find(function(pl){ return pl.id === s.player_id; });
      return p ? p.name : '';
    }).filter(Boolean).join(', ');

    var prompt = 'Tu es un expert eFootball Mobile. Analyse ce squad et propose la formation + composition optimale pour atteindre 70% de victoires.' + nl + nl +
      (activeCoach ? 'COACH ACTIF: ' + activeCoach.name + ' · Style: ' + (activeCoach.style||'—') + ' · Formation préférée: ' + (activeCoach.formation||'—') + nl + nl : '') +
      'FORMATIONS GAGNANTES (>60% victoires, min 5 matchs — privilégier ces formations): ' + formationsGagnantes + nl + nl +
      'HISTORIQUE COMPLET PAR FORMATION: ' + formationStatsStr + nl + nl +
      'SQUAD 23 avec builds et stats développées (' + squad23Unique.length + ' joueurs):' + nl + squadDetails + nl + nl +
      (joueursRapides ? 'JOUEURS RAPIDES (speed/accel ≥80, priorité en Quick Counter): ' + joueursRapides + nl + nl : '') +
      'PRIORITÉ DE DÉCISION:' + nl +
      '1. Stats développées des builds (speed, finishing, defensiveAwareness selon position)' + nl +
      '2. Formations gagnantes dans l' + String.fromCharCode(39) + 'historique (>60% victoires)' + nl +
      '3. Compatibilité style coach/joueurs (Quick Counter → joueurs rapides en avant, Possession → bonne passe)' + nl +
      '4. Position naturelle des joueurs' + nl + nl +
      'FORMATIONS DISPONIBLES (liste exhaustive — tu NE PEUX PAS utiliser une autre formation):' + nl + availableFormations + nl + nl +
      'POSITIONS PAR FORMATION:' + nl + positionsParFormation + nl + nl +
      'RÈGLES ABSOLUES:' + nl +
      '- La formation DOIT être exactement l' + String.fromCharCode(39) + 'une de celles listées ci-dessus, mot pour mot.' + nl +
      '- Slot 0 = toujours GK' + nl +
      '- Assigne chaque joueur à un slot en respectant sa position naturelle' + nl +
      '- Priorise les joueurs dont les stats builds correspondent au rôle (ex: speed élevé → LWF/RWF en QC)' + nl +
      '- Utilise exactement 11 joueurs titulaires (slots 0 à 10)' + nl +
      '- VÉRIFIE que ta formation est dans la liste avant de répondre' + nl + nl +
      'Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ou après:' + nl +
      '{' + nl +
      '  "formation": "4-3-3",' + nl +
      '  "titulaires": [' + nl +
      '    {"slot_idx": 0, "player_name": "Nom du joueur"},' + nl +
      '    {"slot_idx": 1, "player_name": "Nom"}' + nl +
      '  ],' + nl +
      '  "raison_formation": "Pourquoi cette formation est optimale pour ces builds et ce coach (2-3 phrases)",' + nl +
      '  "atouts_cles": "Les 2-3 forces principales de cette composition avec stats concrètes",' + nl +
      '  "instructions_match": "Instructions tactiques précises pour gagner : comment exploiter les stats builds, défendre, contre-attaquer (3-4 phrases)"' + nl +
      '}' + nl + nl +
      'IMPORTANT:' + nl +
      '- Utilise exactement les noms des joueurs tels qu' + String.fromCharCode(39) + 'ils apparaissent dans le Squad 23.' + nl +
      '- NE PAS inclure position_label.' + nl +
      '- slot_idx va de 0 à 10.' + nl +
      '- Les instructions_match doivent citer les joueurs et leurs stats concrètes, pas des généralités.';

    var data = await fetchCoachingWithRetry({ model: 'claude-sonnet-4-6', max_tokens: 1800, messages: [{ role: 'user', content: prompt }] });
    var text = (data.content || []).map(function(b){ return b.text||''; }).join('');

    // Parser JSON
    var jsonStart = text.indexOf('{');
    var depth = 0, jsonEnd = -1;
    for (var ci = jsonStart; ci < text.length; ci++) {
      if (text[ci] === '{') depth++;
      else if (text[ci] === '}') { depth--; if (depth === 0) { jsonEnd = ci; break; } }
    }
    var parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

    // Valider que la formation est dans la liste autorisée
    var formation = parsed.formation ? parsed.formation.trim() : '';
    if (!POSITION_LABELS_BY_FORMATION[formation]) {
      // Chercher la plus proche dans la liste
      var available = Object.keys(POSITION_LABELS_BY_FORMATION);
      var fallback = available.find(function(f) { return f.startsWith(formation.split('-')[0]); }) || '4-3-3';
      showToast('Formation "' + formation + '" non reconnue → utilisation de ' + fallback, 'warning', 4000);
      formation = fallback;
    }
    var slots = buildPitchSlots(formation);
    if (!slots || slots.length !== 11) throw new Error('Formation invalide : ' + formation);

    // Mettre à jour _ftFormation
    _ftFormation = formation;
    var ftInput = document.getElementById('ft-formation-input');
    if (ftInput) ftInput.value = formation;

    // Réinitialiser titulaires
    _ftTitulaires = Array(11).fill(null).map(function(_, i){ return { slot_idx: i, player_id: null }; });

    // Labels officiels depuis POSITION_LABELS_BY_FORMATION — pas depuis Claude
    var officialLabels = POSITION_LABELS_BY_FORMATION[formation] || [];

    // Assigner chaque joueur suggéré — depuis squadForIA (dédupliqué)
    var usedPlayerIds = {};
    (parsed.titulaires || []).forEach(function(t) {
      var sq = squadForIA.find(function(s) {
        if (usedPlayerIds[s.player_id]) return false; // éviter doublons
        var p = State.players.find(function(pl){ return pl.id === s.player_id; });
        return p && p.name === t.player_name;
      });
      if (sq) usedPlayerIds[sq.player_id] = true;
      if (sq && t.slot_idx >= 0 && t.slot_idx < 11) {
        _ftTitulaires[t.slot_idx] = {
          slot_idx: t.slot_idx,
          player_id: sq.player_id,
          card_id: sq.card_id,
          build_id: resolveBuildId(sq.player_id, sq.card_id, sq.build_id),
          position_label: officialLabels[t.slot_idx] || '?' // toujours depuis la liste officielle
        };
      }
    });

    // Remplir les remplaçants avec les joueurs du Squad non titulaires
    var tituPlayerIds = _ftTitulaires.filter(function(t){ return t && t.player_id; }).map(function(t){ return t.player_id; });
    _ftRemplacants = squadForIA.filter(function(s){
      return s.player_id && !tituPlayerIds.includes(s.player_id);
    }).map(function(s){
      return { player_id: s.player_id, card_id: s.card_id, build_id: s.build_id };
    });

    // Sauvegarder et re-render
    ftSave();
    render();

    // Afficher justification
    // Sauvegarder l'analyse dans localStorage
    var analysisData = {
      formation: parsed.formation,
      raison_formation: parsed.raison_formation || '',
      atouts_cles: parsed.atouts_cles || '',
      instructions_match: parsed.instructions_match || '',
      date: new Date().toLocaleDateString('fr-FR')
    };
    try { localStorage.setItem(FT_IA_ANALYSIS_KEY, JSON.stringify(analysisData)); } catch(e) {}

    // Afficher le panel
    var pitchCol = document.querySelector('.ft-pitch-col');
    var existing2 = document.getElementById('ft-ia-justif-panel');
    if (existing2) existing2.remove();
    var panel = renderFtIAPanel(analysisData);
    if (panel && pitchCol) {
      pitchCol.appendChild(panel);
      addFtIAToggleBtn();
    }

  } catch(e) {
    showToast('Erreur IA : ' + e.message, 'error');
  }

  _formationIALoading = false;
  var btn2 = document.getElementById('btn-formation-ia');
  if (btn2) { btn2.disabled = false; btn2.innerHTML = '<i class="ti ti-wand"></i> IA'; }
}

function renderFormationTab() {
  ftLoad();
  setTimeout(loadFtIAPanel, 100);
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
  html += '<button class="btn-sm btn-ghost" onclick="requestFormationIA()" title="Suggérer avec l' + String.fromCharCode(39) + 'IA" id="btn-formation-ia"><i class="ti ti-wand"></i> IA</button>';
  html += '<button class="btn-sm btn-ghost" onclick="saveFtFormationAsCustom()" title="Enregistrer comme formation personnalisée"><i class="ti ti-device-floppy"></i></button>';
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

    // Tooltip build au survol
    var tooltipBuildName = '';
    if (titu.build_id && titu.card_id) {
      var ttBuilds = State.builds[titu.card_id] || [];
      var ttBuild = ttBuilds.find(function(b){ return b.id === titu.build_id; });
      if (ttBuild) tooltipBuildName = ttBuild.name;
    }
    var titleTag = player ? ('<title>' + player.name + (tooltipBuildName ? ' — ' + tooltipBuildName : '') + '</title>') : '';
    return '<g class=\"ft-draggable-node\" data-slot=\"' + i + '\" onclick=\"ftSelectSlot(' + i + ')\" style=\"cursor:grab\">' +
      titleTag +
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
    // Build du titulaire
    var tituBuildName = '';
    if (titu && titu.build_id && titu.card_id) {
      var tituBuilds2 = State.builds[titu.card_id] || [];
      var tituBuild2 = tituBuilds2.find(function(b){ return b.id === titu.build_id; });
      if (tituBuild2) tituBuildName = tituBuild2.name;
    }
    html += '<div class="ft-liste-row' + (isSelected ? ' selected' : '') + '" onclick="ftSelectSlot(' + i + ')">' +
      '<span class="ft-liste-pos">' + posLabel + '</span>' +
      (player
        ? '<div style="flex:1;min-width:0">' +
            '<span class="ft-liste-name">' + player.name + '</span>' +
            (tituBuildName ? '<div style="font-size:10px;color:var(--primary);opacity:0.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + tituBuildName + '</div>' : '') +
          '</div>' +
          '<button class="btn-icon-xs" onclick="ftRemoveFromSlot(event,' + i + ')"><i class="ti ti-x"></i></button>'
        : '<span class="ft-liste-empty">— vide —</span>') +
    '</div>';
  });
  html += '</div>';

  html += '<div class="ft-liste-section" style="margin-top:10px">';
  html += '<div class="ft-liste-title">Remplaçants (' + _ftRemplacants.length + '/12)</div>';
  _ftRemplacants.forEach(function(remp, i) {
    var player = State.players.find(function(p) { return p.id === remp.player_id; });
    // Build du remplaçant
    var rempBuildName = '';
    if (remp.build_id && remp.card_id) {
      var rempBuilds = State.builds[remp.card_id] || [];
      var rempBuild = rempBuilds.find(function(b){ return b.id === remp.build_id; });
      if (rempBuild) rempBuildName = rempBuild.name;
    }
    html += '<div class="ft-liste-row">' +
      '<span class="ft-liste-pos" style="color:var(--muted)">' + (i+1) + '</span>' +
      '<div style="flex:1;min-width:0">' +
        '<span class="ft-liste-name">' + (player ? player.name : '?') + '</span>' +
        (rempBuildName ? '<div style="font-size:10px;color:var(--primary);opacity:0.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + rempBuildName + '</div>' : '') +
      '</div>' +
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
      build_id: resolveBuildId(displacedPid, card2 ? card2.id : null, sq2 ? sq2.build_id : null),
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
        build_id: resolveBuildId(displacedPid, card3 ? card3.id : null, sq3 ? sq3.build_id : null),
      });
    }
  }

  // Placer le nouveau joueur sur le slot
  _ftTitulaires[_ftSelectedSlot] = {
    slot_idx: _ftSelectedSlot,
    player_id: pid,
    card_id: card ? card.id : null,
    build_id: resolveBuildId(pid, card ? card.id : null, sq ? sq.build_id : null),
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
  _ftRemplacants.push({ player_id: pid, card_id: card ? card.id : null, build_id: resolveBuildId(pid, card ? card.id : null, sq ? sq.build_id : null) });
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
        ${State.activePlayerTab === 'stats'    ? renderStatsTab(card) : ''}
        ${State.activePlayerTab === 'builds'   ? renderBuildsTab(card) : ''}
        ${State.activePlayerTab === 'matchs'   ? renderPlayerMatchsTab(player) : ''}
        ${State.activePlayerTab === 'build-ia' ? renderBuildIA(player, card) : ''}
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

// ── Build IA ──────────────────────────────────────────────────────────────────
var _buildIAResult = null;
var _buildIALoading = false;
var _buildIAChatHistory = []; // [{role:'user'|'assistant', content:'...'}]
var _buildIAChatContext = null; // contexte système du joueur
var _buildIAChatLoading = false;
var _buildIAChatPlayerId = null;
var _buildIAChatCardId = null;

function renderBuildIA(player, card) {
  if (!card || !card.efhub_stats || Object.keys(card.efhub_stats).length === 0) {
    return '<div class="empty-state"><p>Aucune stat importée pour ce joueur.</p></div>';
  }

  var pos = card.efhub_stats.position || '—';
  var levelCap = card.level_cap || '—';
  var matches = filterStatsMatches(State.matches);
  var playerMatches = matches.filter(function(m) {
    return m.player_stats && m.player_stats.some(function(ps) { return ps.player_id === player.id; });
  });
  var winRate = playerMatches.length > 0
    ? Math.round(playerMatches.filter(function(m) { return m.result === 'V'; }).length / playerMatches.length * 100)
    : 0;

  var resultHtml = '';
  if (_buildIALoading) {
    resultHtml = '<div class="coaching-loading"><i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> Analyse en cours...</div>';
  } else if (_buildIAResult && _buildIAResult.error) {
    resultHtml = '<div style="color:var(--red);font-size:13px;padding:12px">' + _buildIAResult.error + '</div>';
  } else if (_buildIAResult && _buildIAResult.data) {
    resultHtml = renderBuildIAResult(_buildIAResult.data, player, card);
  }

  var q = String.fromCharCode(39);

  // Chat section
  var chatHtml = _buildIAChatHistory.map(function(msg) {
    return chatMessageBubble(msg.role, msg.content);
  }).join('');

  return [
    '<div class="build-ia-tab" style="padding:12px">',
    // Header info joueur
    '  <div style="background:var(--surface-2);border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:var(--text-secondary)">',
    '    <div style="display:flex;justify-content:space-between;margin-bottom:4px">',
    '      <span><b style="color:var(--text)">' + player.name + '</b> · ' + pos + ' · Level cap ' + levelCap + '</span>',
    '      <span>' + playerMatches.length + ' matchs · ' + winRate + '% victoires</span>',
    '    </div>',
    '    <div style="color:var(--amber);font-size:11px">🎯 Objectif : atteindre 70% de victoires</div>',
    '  </div>',
    // Bouton suggestion
    '  <button class="btn-primary" style="width:100%;margin-bottom:12px" onclick="requestBuildIA(' + q + player.id + q + ',' + q + card.id + q + ')" ' + (_buildIALoading ? 'disabled' : '') + '>',
    '    <i class="ti ti-wand"></i> ' + (_buildIAResult ? 'Nouvelle suggestion' : 'Suggérer un build optimal'),
    '  </button>',
    // Résultat build visuel
    '  <div id="build-ia-result">' + resultHtml + '</div>',
    // Séparateur chat
    '  <div style="border-top:1px solid var(--border);margin:12px 0"></div>',
    '  <div style="font-size:11px;font-weight:700;color:var(--primary);margin-bottom:8px">💬 Discussion avec Claude</div>',
    // Messages
    '  <div id="build-ia-chat-messages" style="max-height:300px;overflow-y:auto;margin-bottom:8px;display:flex;flex-direction:column">' + chatHtml + '</div>',
    // Input
    '  <div style="display:flex;gap:6px">',
    '    <input id="build-ia-chat-input" class="form-input form-input-sm" style="flex:1" placeholder="Ex: booste la vitesse, adapte pour Quick Counter..." onkeydown="if(event.key===String.fromCharCode(13))sendBuildIAChat(' + q + player.id + q + ',' + q + card.id + q + ')">',
    '    <button class="btn-sm btn-primary" onclick="sendBuildIAChat(' + q + player.id + q + ',' + q + card.id + q + ')" id="btn-build-ia-send" ' + (_buildIAChatLoading ? 'disabled' : '') + '>',
    '      <i class="ti ti-send"></i>',
    '    </button>',
    '    <button class="btn-sm btn-ghost" onclick="clearBuildIAChat()" title="Effacer la conversation">',
    '      <i class="ti ti-trash"></i>',
    '    </button>',
    '  </div>',
    '</div>',
  ].join('');
}

function renderBuildIAResult(data, player, card) {
  var sliders = data.sliders || {};
  var activeSliders = SLIDERS_CONFIG.filter(function(s) { return (sliders[s.key] || 0) > 0; });
  var pointsUsed = Object.entries(sliders).reduce(function(sum, entry) {
    return sum + Progression.clickCost(entry[1]);
  }, 0);
  var pointsMax = card.points_max || Progression.pointsFromLevelCap(card.level_cap || 0);

  // Calcul stats finales avec le build suggéré
  var statsFinal = Progression.allStatsFinal(card.efhub_stats, sliders);
  var efhubId = player ? Efhub.parseId(player.efhub_url || '') : null;
  var imgUrl = efhubId ? Efhub.imgUrl(efhubId) : null;
  var pos = card.efhub_stats.position || '';

  // Grouper les stats pour l'affichage détaillé
  var groups = {};
  EFB_STATS_ORDER.forEach(function(s) {
    if (!groups[s.group]) groups[s.group] = [];
    groups[s.group].push(s);
  });

  var html = '';

  // ── Carte visuelle style build card ──
  html += '<div class="build-card active" style="margin-bottom:12px;cursor:default">';
  html += '  <div class="build-card-header">';
  html += '    <div class="build-card-left">';
  html += '      <span class="build-name">🤖 Build suggéré par IA' + (data._budgetCorrige ? ' <span style="font-size:10px;color:var(--amber)">⚠ budget ajusté</span>' : '') + '</span>';
  html += '      <span class="build-pts ' + (pointsUsed === pointsMax ? 'full' : '') + '">' + pointsUsed + ' / ' + pointsMax + ' pts</span>';
  html += '    </div>';
  html += '  </div>';

  // Photo + position + icônes sliders
  html += '  <div class="build-efhub-preview">';
  html += '    <div class="build-efhub-left">';
  if (imgUrl) html += '      <img src="' + imgUrl + '" class="build-player-img" alt="' + player.name + '">';
  html += '      <div class="build-player-meta">';
  html += '        <span class="build-player-name">' + player.name.toUpperCase() + '</span>';
  if (pos) html += '        <span class="build-player-pos">' + pos + '</span>';
  html += '      </div>';
  html += '    </div>';
  html += '    <div class="build-icons-row">';
  activeSliders.forEach(function(s) {
    html += '      <div class="build-slider-icon-wrap">';
    html += '        <div class="build-slider-svg" style="display:flex;align-items:center;justify-content:center;color:#e2e8f0">' + s.icon + '</div>';
    html += '        <span class="build-slider-count">' + sliders[s.key] + '</span>';
    html += '      </div>';
  });
  if (activeSliders.length === 0) html += '<span class="build-empty-sliders">Aucun clic</span>';
  html += '    </div>';
  html += '  </div>';
  html += '</div>';

  // ── Stats finales détaillées ──
  html += '<div class="build-details" style="margin-bottom:12px">';
  html += '  <div class="build-details-section">';
  html += '    <div class="build-details-title">Stats après développement</div>';
  Object.entries(groups).forEach(function(entry) {
    var group = entry[0];
    var stats = entry[1];
    var hasChanges = stats.some(function(s) { return (statsFinal[s.key] || 0) > (card.efhub_stats[s.key] || 0); });
    // Pour GK : afficher Goalkeeping, sinon masquer ; pour non-GK masquer Goalkeeping
    if (group === 'Goalkeeping' && pos !== 'GK') return;
    html += '    <div class="build-detail-group">';
    html += '      <div class="build-detail-group-label">' + group + (hasChanges ? ' ✨' : '') + '</div>';
    html += '      <div class="build-detail-stats">';
    stats.forEach(function(s) {
      var base = card.efhub_stats[s.key] || 0;
      var final = statsFinal[s.key] || base;
      var delta = final - base;
      html += '        <div class="build-detail-stat">';
      html += '          <span class="build-detail-label">' + s.label + '</span>';
      html += '          <div class="build-detail-bar-wrap">';
      html += '            <div class="build-detail-bar-base" style="width:' + base + '%;background:' + s.color + '55"></div>';
      if (delta > 0) html += '            <div class="build-detail-bar-delta" style="width:' + delta + '%;background:' + s.color + '"></div>';
      html += '          </div>';
      html += '          <span class="build-detail-val">' + final + '</span>';
      html += '          ' + (delta > 0 ? '<span class="build-detail-delta">+' + delta + '</span>' : '<span class="build-detail-delta"></span>');
      html += '        </div>';
    });
    html += '      </div>';
    html += '    </div>';
  });
  html += '  </div>';
  html += '</div>';

  // ── Diagnostic & Conseils ──
  if (data.diagnostic) {
    html += '<div style="background:var(--surface-2);border-radius:10px;padding:10px 12px;margin-bottom:10px">';
    html += '  <div style="font-size:11px;font-weight:700;color:var(--amber);margin-bottom:6px">📊 DIAGNOSTIC</div>';
    html += '  <div style="font-size:12px;color:var(--text-secondary)">' + data.diagnostic + '</div>';
    html += '</div>';
  }
  if (data.conseils) {
    html += '<div style="background:var(--surface-2);border-radius:10px;padding:10px 12px;margin-bottom:10px">';
    html += '  <div style="font-size:11px;font-weight:700;color:var(--primary);margin-bottom:6px">💡 CONSEILS TACTIQUES</div>';
    html += '  <div style="font-size:12px;color:var(--text-secondary)">' + data.conseils + '</div>';
    html += '</div>';
  }

  // ── Bouton enregistrer ──
  var q = String.fromCharCode(39);
  var cardIdSafe = card ? card.id : '';
  html += '<div id="build-ia-save-section" style="margin-top:12px">';
  html += '  <div id="build-ia-save-form" style="display:none;background:var(--surface-2);border-radius:10px;padding:10px 12px;margin-bottom:8px">';
  html += '    <div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px">Nom du build</div>';
  html += '    <input id="build-ia-name-input" class="form-input form-input-sm" style="width:100%;margin-bottom:8px" value="Build IA — ' + new Date().toLocaleDateString('fr-FR') + '">';
  html += '    <div style="display:flex;gap:6px">';
  html += '      <button class="btn-sm btn-primary" style="flex:1" onclick="saveBuildFromIA(' + q + cardIdSafe + q + ')"><i class="ti ti-check"></i> Confirmer</button>';
  html += '      <button class="btn-sm btn-ghost" onclick="document.getElementById(' + q + 'build-ia-save-form' + q + ').style.display=' + q + 'none' + q + ';document.getElementById(' + q + 'build-ia-save-btn' + q + ').style.display=' + q + '' + q + '">Annuler</button>';
  html += '    </div>';
  html += '  </div>';
  html += '  <button id="build-ia-save-btn" class="btn-sm btn-ghost" style="width:100%" onclick="document.getElementById(' + q + 'build-ia-save-form' + q + ').style.display=' + q + 'block' + q + ';this.style.display=' + q + 'none' + q + '">';
  html += '    <i class="ti ti-bookmark-plus"></i> Enregistrer ce build';
  html += '  </button>';
  html += '</div>';

  return html;
}

async function saveBuildFromIA(cardId) {
  var name = document.getElementById('build-ia-name-input') ? document.getElementById('build-ia-name-input').value.trim() : '';
  if (!name) { showToast('Entre un nom pour le build', 'warning'); return; }
  if (!_buildIAResult || !_buildIAResult.data || !_buildIAResult.data.sliders) {
    showToast('Aucun build suggéré à enregistrer', 'error'); return;
  }
  var sliders = _buildIAResult.data.sliders;
  var pointsUsed = Object.entries(sliders).reduce(function(sum, e) {
    return sum + Progression.clickCost(e[1]);
  }, 0);
  try {
    var build = await Builds.create({ card_id: cardId, name: name, sliders: sliders, points_used: pointsUsed });
    // Trouver le player_id depuis la card
    var playerId = null;
    Object.entries(State.cards).forEach(function(entry) {
      if (entry[1].some(function(c) { return c.id === cardId; })) playerId = entry[0];
    });
    if (playerId) State.builds[cardId] = await Builds.getByCard(cardId);
    showToast('Build "' + name + '" enregistré !', 'success');
    // Masquer le form, afficher confirmation
    var saveSection = document.getElementById('build-ia-save-section');
    if (saveSection) {
      saveSection.innerHTML = '<div style="font-size:12px;color:var(--green);padding:8px 0"><i class="ti ti-check"></i> Build enregistré — visible dans l' + String.fromCharCode(39) + 'onglet Builds</div>';
    }
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}


function getBuildPriorityRules(pos, playingStyle, coachStyle) {
  var nl = '\n';
  var rules = '';

  // ── Règles par position ──
  var byPos = {
    'CF': 'Finisseur pur : Shooting (finishing/curl/setPieceTaking) > LowerBody (speed/kickingPower) > Dexterity (acceleration) > Aerial (heading). Evite Passing et Defending.',
    'SS': 'Attaquant second couteau : Shooting > Dribbling (ballControl/dribbling) > Dexterity > LowerBody. Peut avoir Passing si style créateur.',
    'LWF': 'Ailier gauche : LowerBody (speed/stamina) > Dribbling > Dexterity (acceleration/balance) > Shooting. Priorise la vitesse et le dribble.',
    'RWF': 'Ailier droit : LowerBody (speed/stamina) > Dribbling > Dexterity (acceleration/balance) > Shooting. Priorise la vitesse et le dribble.',
    'AMF': 'Meneur de jeu : Dribbling (ballControl/dribbling/tightPossession) > Dexterity (offensiveAwareness/acceleration/balance) > Passing (lowPass/loftedPass) > LowerBody. Evite Shooting et Defending sauf si rôle buteur.',
    'CMF': 'Milieu central : Passing > Dexterity > Dribbling > LowerBody (stamina). Equilibre entre création et physique.',
    'DMF': 'Milieu défensif : Defending (defensiveAwareness/ballWinning/trackingBack) > LowerBody (stamina) > Passing > Dexterity. Priorise la récupération.',
    'LMF': 'Milieu gauche : LowerBody (speed) > Passing > Dribbling > Dexterity. Polyvalence et dynamisme.',
    'RMF': 'Milieu droit : LowerBody (speed) > Passing > Dribbling > Dexterity. Polyvalence et dynamisme.',
    'CB': 'Défenseur central : Defending (defensiveAwareness/ballWinning/aggression) > Aerial (heading/jump/physicalContact) > LowerBody (speed). Evite Shooting et Passing.',
    'LB': 'Latéral gauche : Defending > LowerBody (speed/stamina) > Dexterity (acceleration). Si latéral offensif : ajoute Passing.',
    'RB': 'Latéral droit : Defending > LowerBody (speed/stamina) > Dexterity (acceleration). Si latéral offensif : ajoute Passing.',
    'GK': 'Gardien : GK3 (gkCatching/gkReflexes) > GK2 (gkClearing/gkReach) > GK1 (gkAwareness/jump). Ne jamais utiliser Shooting/Passing/Dribbling.',
  };
  rules += 'PRIORITÉ SLIDERS PAR POSITION (' + pos + '):' + nl;
  rules += (byPos[pos] || 'Position non reconnue — priorise les stats offensives.') + nl + nl;

  // ── Règles par style de jeu (playing style efhub) ──
  var byStyle = {
    'Hole Player':        'Hole Player : maximise offensiveAwareness (Dexterity) + ballControl/dribbling (Dribbling) + finishing (Shooting). Il doit être décisif dans la surface.',
    'Prolific Winger':    'Prolific Winger : maximise speed (LowerBody) + acceleration (Dexterity) + dribbling (Dribbling). Il doit déborder et centrer vite.',
    'Goal Poacher':       'Goal Poacher : maximise finishing/curl (Shooting) + speed (LowerBody) + acceleration (Dexterity). Il vit dans la surface.',
    'Fox in the Box':     'Fox in the Box : maximise finishing (Shooting) + heading/jump (Aerial) + physicalContact (Aerial). Présence dans la surface.',
    'Classic No. 10':     'Classic No. 10 : maximise lowPass/loftedPass (Passing) + ballControl (Dribbling) + offensiveAwareness (Dexterity). Créateur de jeu.',
    'Creative Playmaker': 'Creative Playmaker : maximise Passing + Dexterity + Dribbling. Vision et technique avant tout.',
    'Orchestrator':       'Orchestrator : maximise Passing (lowPass/loftedPass) + Dexterity + LowerBody (stamina). Moteur du milieu.',
    'Box-to-Box':         'Box-to-Box : équilibre LowerBody (stamina/speed) + Passing + Defending. Endurance maximale.',
    'Anchor Man':         'Anchor Man : maximise Defending + Aerial (physicalContact/heading) + LowerBody (stamina). Défenseur pur.',
    'Build Up':           'Build Up : maximise Passing + Defending (defensiveAwareness) + LowerBody. Relanceur depuis la défense.',
    'Destroyer':          'Destroyer : maximise Defending (ballWinning/aggression) + Aerial + LowerBody. Récupérateur agressif.',
    'Cross Specialist':   'Cross Specialist : maximise LowerBody (speed) + Passing (loftedPass) + Dexterity (acceleration). Largeur et centres.',
    'Attacking Full-back':'Attacking Full-back : maximise LowerBody (speed/stamina) + Passing + Dexterity. Montées incessantes.',
    'Defensive Full-back':'Defensive Full-back : maximise Defending + LowerBody (speed) + Dexterity (acceleration). Sécurité défensive.',
  };
  if (playingStyle && byStyle[playingStyle]) {
    rules += 'STYLE DE JEU (' + playingStyle + '):' + nl + byStyle[playingStyle] + nl + nl;
  }

  // ── Règles par style de coach ──
  var byCoach = {
    'Quick Counter':     'Quick Counter : maximise VITESSE (LowerBody speed/acceleration Dexterity). Les transitions rapides nécessitent des joueurs explosifs. Priorise speed > acceleration > stamina.',
    'Long Ball Counter': 'Long Ball Counter : maximise Aerial (heading/jump) + LowerBody (speed) + Passing (loftedPass). Jeu direct et duels aériens.',
    'Possession Game':   'Possession Game : maximise Passing (lowPass) + Dribbling (ballControl/tightPossession) + Dexterity (offensiveAwareness). Technique et conservation.',
    'Out Wide':          'Out Wide : maximise LowerBody (speed) + Passing (loftedPass) + Dribbling. Largeur du terrain et centres.',
    'Long Ball':         'Long Ball : maximise Aerial (heading/jump/physicalContact) + LowerBody (kickingPower) + Passing (loftedPass). Jeu aérien et physique.',
  };
  if (coachStyle && byCoach[coachStyle]) {
    rules += 'STYLE DU COACH (' + coachStyle + '):' + nl + byCoach[coachStyle] + nl + nl;
  }

  // ── Règle générale de distribution ──
  rules += 'RÈGLE DE DISTRIBUTION:' + nl +
    '1. Identifie les 2-3 sliders prioritaires selon position + style de jeu + coach.' + nl +
    '2. Investis 60-70% du budget sur ces sliders prioritaires.' + nl +
    '3. Répartis les 30-40% restants sur les sliders secondaires utiles.' + nl +
    '4. Evite de mettre trop de clics sur UN SEUL slider — diversifie.' + nl +
    '5. Ne booste pas les stats déjà très hautes (>90) — investis là où le gain est le plus impactant.' + nl;

  return rules;
}

function buildBuildIAChatContext(player, card) {
  var matches = filterStatsMatches(State.matches);
  var playerMatches = matches.filter(function(m) {
    return m.player_stats && m.player_stats.some(function(ps) { return ps.player_id === player.id; });
  });
  var goals = 0, assists = 0, ratings = [];
  playerMatches.forEach(function(m) {
    var ps = (m.player_stats || []).find(function(p) { return p.player_id === player.id; });
    if (ps) {
      goals += ps.goals || 0;
      assists += ps.assists || 0;
      if (ps.rating) ratings.push(ps.rating);
    }
  });
  var avgRating = ratings.length > 0 ? (ratings.reduce(function(a,b){return a+b;},0)/ratings.length).toFixed(1) : 'N/A';
  var winRate = playerMatches.length > 0 ? Math.round(playerMatches.filter(function(m){return m.result==='V';}).length/playerMatches.length*100) : 0;
  var activeCoachId = getActiveCoachId();
  var activeCoach = activeCoachId ? State.coaches.find(function(c){return c.id===activeCoachId;}) : null;
  var pos = card.efhub_stats.position || '';
  var pointsMax = card.points_max || Progression.pointsFromLevelCap(card.level_cap || 0);
  var nl = '\n';

  // Sliders disponibles avec coûts
  var isGK = pos === 'GK';
  var coutTable = [];
  for (var ci = 1; ci <= 12; ci++) coutTable.push(ci + ' clics=' + Progression.clickCost(ci) + 'pts');
  var slidersList = SLIDERS_CONFIG.filter(function(s) {
    return isGK ? true : !['gk1','gk2','gk3'].includes(s.key);
  }).map(function(s) {
    var cur = s.stats.map(function(sk){ return sk+':'+(card.efhub_stats[sk]||0); }).join(', ');
    return '- ' + s.key + ' (' + s.label + ') actuel: ' + cur;
  }).join(nl);

  // Build suggéré actuel si disponible
  var currentBuild = '';
  if (_buildIAResult && _buildIAResult.data && _buildIAResult.data.sliders) {
    var sl = _buildIAResult.data.sliders;
    var totalPts = Object.entries(sl).reduce(function(sum,e){return sum+Progression.clickCost(e[1]);},0);
    currentBuild = nl + 'BUILD SUGGÉRÉ ACTUEL: ' + JSON.stringify(sl) + ' (' + totalPts + '/' + pointsMax + ' pts)';
  }

  var priorityRules = getBuildPriorityRules(pos, card.efhub_stats.playingStyle || '', activeCoach ? (activeCoach.style||'') : '');

  var ctx = 'Tu es un expert eFootball Mobile. Tu analyses et discutes du build optimal pour ce joueur.' + nl + nl +
    'JOUEUR: ' + player.name + ' · ' + pos + ' · Level cap: ' + (card.level_cap||'—') + ' · Style: ' + (card.efhub_stats.playingStyle||'—') + nl +
    'PERFORMANCE: ' + playerMatches.length + ' matchs · ' + winRate + '% victoires · Note: ' + avgRating + '/10 · ' + goals + ' buts · ' + assists + ' passes' + nl +
    (activeCoach ? 'COACH: ' + activeCoach.name + ' · ' + (activeCoach.style||'—') + ' · Formation: ' + (activeCoach.formation||'—') + nl : '') +
    currentBuild + nl + nl +
    priorityRules +
    'SLIDERS DISPONIBLES:' + nl + slidersList + nl + nl +
    'COUT PAR CLICS: ' + coutTable.join(', ') + nl +
    'BUDGET: ' + pointsMax + ' pts. Utilise exactement 100% du budget.' + nl + nl +
    'Réponds en français. Si tu proposes un nouveau build, inclus un objet JSON entre balises <build> et </build> avec le format: <build>{"sliders":{"shooting":8}}</build>. ' +
    'Sinon réponds librement en texte. Sois concis (max 150 mots par réponse).';

  return ctx;
}

async function sendBuildIAChat(playerId, cardId) {
  var input = document.getElementById('build-ia-chat-input');
  var msgContainer = document.getElementById('build-ia-chat-messages');
  var sendBtn = document.getElementById('btn-build-ia-send');
  if (!input || !msgContainer) return;
  var text = input.value.trim();
  if (!text) return;

  var player = State.players.find(function(p){ return p.id === playerId; });
  var card = (State.cards[playerId]||[]).find(function(c){ return c.id === cardId; });
  if (!player || !card) return;

  // Réinitialiser contexte si joueur change
  if (_buildIAChatPlayerId !== playerId || _buildIAChatCardId !== cardId) {
    _buildIAChatHistory = [];
    _buildIAChatContext = null;
    _buildIAChatPlayerId = playerId;
    _buildIAChatCardId = cardId;
  }

  msgContainer.insertAdjacentHTML('beforeend', chatMessageBubble('user', text));
  input.value = '';
  input.disabled = true;
  if (sendBtn) sendBtn.disabled = true;
  _buildIAChatLoading = true;

  var typingId = 'build-ia-typing-' + Date.now();
  msgContainer.insertAdjacentHTML('beforeend', '<div id="' + typingId + '" style="font-size:11px;color:var(--muted);padding:4px 8px">Claude réfléchit...</div>');
  msgContainer.scrollTop = msgContainer.scrollHeight;

  if (!_buildIAChatContext) _buildIAChatContext = buildBuildIAChatContext(player, card);

  // Calculer les points restants et les rappeler automatiquement
  var pointsMax = card.points_max || Progression.pointsFromLevelCap(card.level_cap || 0);
  var ptsUsed = 0;
  if (_buildIAResult && _buildIAResult.data && _buildIAResult.data.sliders) {
    ptsUsed = Object.entries(_buildIAResult.data.sliders).reduce(function(sum, e) {
      return sum + Progression.clickCost(e[1]);
    }, 0);
  }
  var ptsRestants = pointsMax - ptsUsed;
  var budgetNote = ptsRestants > 0
    ? '[RAPPEL AUTOMATIQUE: il reste ' + ptsRestants + ' pts non utilisés sur ' + pointsMax + ' pts. Redistribue-les intelligemment sur les sliders les plus utiles pour ce joueur et propose un build mis à jour avec <build>{...}</build>.]'
    : '[Budget utilisé à 100% : ' + ptsUsed + '/' + pointsMax + ' pts]';

  var textAvecBudget = text + '\n\n' + budgetNote;
  _buildIAChatHistory.push({ role: 'user', content: textAvecBudget });

  var messages = [{ role: 'user', content: _buildIAChatContext + '\n\n---\n' + textAvecBudget }];
  if (_buildIAChatHistory.length > 1) {
    messages = [{ role: 'user', content: _buildIAChatContext }]
      .concat(_buildIAChatHistory.slice(0, -1))
      .concat([{ role: 'user', content: textAvecBudget }]);
  }

  try {
    var data = await fetchCoachingWithRetry({ model: 'claude-sonnet-4-6', max_tokens: 600, messages: messages });
    var reply = (data.content || []).map(function(b){ return b.text||''; }).join('');

    // Détecter si Claude propose un nouveau build dans <build>...</build>
    var buildMatch = reply.match(/<build>([\s\S]*?)<\/build>/);
    if (buildMatch) {
      try {
        var jsonStart = buildMatch[1].indexOf('{');
        var depth = 0, jsonEnd = -1;
        for (var ci3 = jsonStart; ci3 < buildMatch[1].length; ci3++) {
          if (buildMatch[1][ci3]==='{') depth++;
          else if (buildMatch[1][ci3]==='}') { depth--; if(depth===0){jsonEnd=ci3;break;} }
        }
        var newBuild = JSON.parse(buildMatch[1].slice(jsonStart, jsonEnd+1));
        // Valider budget
        var totalPts = Object.entries(newBuild.sliders||{}).reduce(function(sum,e){return sum+Progression.clickCost(e[1]);},0);
        var pointsMax = card.points_max || Progression.pointsFromLevelCap(card.level_cap||0);
        if (totalPts <= pointsMax) {
          _buildIAResult = { data: newBuild };
          var elResult = document.getElementById('build-ia-result');
          if (elResult) elResult.innerHTML = renderBuildIAResult(newBuild, player, card);
        }
        // Nettoyer les balises de la réponse affichée
        reply = reply.replace(/<build>[\s\S]*?<\/build>/, '✅ Build mis à jour ci-dessus.');
      } catch(e2) {}
    }

    _buildIAChatHistory.push({ role: 'assistant', content: reply });
    var typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();
    msgContainer.insertAdjacentHTML('beforeend', chatMessageBubble('assistant', reply));

  } catch(e) {
    var typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();
    msgContainer.insertAdjacentHTML('beforeend', chatMessageBubble('assistant', 'Erreur : ' + e.message));
  }

  _buildIAChatLoading = false;
  input.disabled = false;
  if (sendBtn) sendBtn.disabled = false;
  input.focus();
  msgContainer.scrollTop = msgContainer.scrollHeight;
}

function clearBuildIAChat() {
  _buildIAChatHistory = [];
  _buildIAChatContext = null;
  _buildIAChatPlayerId = null;
  _buildIAChatCardId = null;
  var el = document.getElementById('build-ia-chat-messages');
  if (el) el.innerHTML = '';
}

async function requestBuildIA(playerId, cardId) {
  if (_buildIALoading) return;
  _buildIALoading = true;
  _buildIAResult = null;

  var el = document.getElementById('build-ia-result');
  if (el) el.innerHTML = '<div class="coaching-loading"><i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i> Analyse en cours...</div>';

  try {
    var player = State.players.find(function(p) { return p.id === playerId; });
    var card = (State.cards[playerId] || []).find(function(c) { return c.id === cardId; });
    if (!player || !card) throw new Error('Joueur ou carte introuvable.');

    var matches = filterStatsMatches(State.matches);
    var playerMatches = matches.filter(function(m) {
      return m.player_stats && m.player_stats.some(function(ps) { return ps.player_id === playerId; });
    });

    var hasMatchData = playerMatches.length >= 3;

    // Builds existants avec stats
    var builds = (State.builds[cardId] || []).map(function(b) {
      var bMatches = matches.filter(function(m) {
        return m.player_stats && m.player_stats.some(function(ps) { return ps.build_id === b.id; });
      });
      var bWins = bMatches.filter(function(m) { return m.result === 'V'; }).length;
      var bWinRate = bMatches.length > 0 ? Math.round(bWins / bMatches.length * 100) : 0;
      return b.name + ' (sliders: ' + JSON.stringify(b.sliders || {}) + ') — ' + bMatches.length + ' matchs, ' + bWinRate + '% victoires';
    });

    // Stats joueur dans les matchs
    var goals = 0, assists = 0, ratings = [];
    playerMatches.forEach(function(m) {
      var ps = (m.player_stats || []).find(function(p) { return p.player_id === playerId; });
      if (ps) {
        goals += ps.goals || 0;
        assists += ps.assists || 0;
        if (ps.rating) ratings.push(ps.rating);
      }
    });
    var avgRating = ratings.length > 0 ? (ratings.reduce(function(a, b) { return a + b; }, 0) / ratings.length).toFixed(1) : 'N/A';
    var winRate = Math.round(playerMatches.filter(function(m) { return m.result === 'V'; }).length / playerMatches.length * 100);

    // Coach actif
    var activeCoachId = getActiveCoachId();
    var activeCoach = activeCoachId ? State.coaches.find(function(c) { return c.id === activeCoachId; }) : null;

    // Sliders disponibles pour ce joueur
    var pos = card.efhub_stats.position || '';
    var isGK = pos === 'GK';

    // Stats de base
    var baseStats = card.efhub_stats || {};

    var pointsMax = card.points_max || Progression.pointsFromLevelCap(card.level_cap || 0);
    var nl = String.fromCharCode(10);

    // Pre-calculer le cout par nombre de clics
    var coutTable = [];
    for (var ci = 1; ci <= 12; ci++) {
      coutTable.push(ci + ' clics=' + Progression.clickCost(ci) + 'pts');
    }

    // Sliders avec stats actuelles + projection apres clics
    var sliderDetails = SLIDERS_CONFIG.filter(function(s) {
      if (isGK) return true;
      return !['gk1', 'gk2', 'gk3'].includes(s.key);
    }).map(function(s) {
      var statsCurrent = s.stats.map(function(sk) {
        return sk + ':' + (baseStats[sk] || 0);
      }).join(', ');
      // Générer toutes les options de clics avec coût exact pré-calculé
      var options = [2, 4, 6, 8, 10, 12].map(function(n) {
        var cout = Progression.clickCost(n);
        var statsAfter = s.stats.map(function(sk) {
          return sk + ':' + ((baseStats[sk] || 0) + n);
        }).join(', ');
        return '  ' + n + ' clics (COUT EXACT: ' + cout + 'pts) -> ' + statsAfter;
      }).join(nl);
      return '- ' + s.key + ' (' + s.label + ')' + nl +
        '  Actuel: ' + statsCurrent + nl + options;
    });

    var priorityRules2 = getBuildPriorityRules(pos, card.efhub_stats.playingStyle || '', activeCoach ? (activeCoach.style||'') : '');

    var prompt = 'Tu es un expert eFootball Mobile. Analyse ce joueur et propose le build optimal pour atteindre 70% de victoires.' + nl + nl +
      priorityRules2 + nl +
      'JOUEUR: ' + player.name + ' · Position: ' + pos + ' · Level cap: ' + (card.level_cap || '—') + ' · Carte: ' + (card.card_type || '—') + nl +
      'Style de jeu: ' + (card.efhub_stats.playingStyle || '—') + nl + nl +
      (!hasMatchData
        ? 'PERFORMANCE: ' + playerMatches.length + ' match(s) — nouveau joueur, propose un build optimal basé uniquement sur ses stats et son style de jeu.' + nl + nl
        : 'PERFORMANCE: ' + playerMatches.length + ' matchs · ' + winRate + '% victoires · Note moy: ' + avgRating + '/10 · ' + goals + ' buts · ' + assists + ' passes' + nl + nl) +
      (activeCoach ? 'COACH ACTIF: ' + activeCoach.name + ' · Style: ' + (activeCoach.style || '—') + ' · Formation: ' + (activeCoach.formation || '—') + nl + nl : '') +
      'BUILDS EXISTANTS:' + nl + (builds.length > 0 ? builds.join(nl) : 'Aucun build') + nl + nl +
      'SLIDERS DISPONIBLES (stats actuelles + projections):' + nl + sliderDetails.join(nl) + nl + nl +
      'COUT EN POINTS (reference):' + nl +
      coutTable.join(', ') + nl + nl +
      'BUDGET TOTAL: ' + pointsMax + ' pts. OBJECTIF: utiliser exactement 100% du budget — tous les points doivent etre depenses.' + nl +
      'REGLE ABSOLUE: la somme des couts de tous les sliders choisis NE DOIT PAS depasser ' + pointsMax + ' pts.' + nl +
      'Si tu as des points restants apres ta premiere selection, ajoute des clics supplementaires sur les sliders les plus utiles.' + nl + nl +
      'Reponds UNIQUEMENT avec un objet JSON valide, sans texte avant ou apres, sans balises markdown:' + nl +
      '{' + nl +
      '  "sliders": { "shooting": 8, "passing": 4 },' + nl +
      '  "diagnostic": "Explication courte du win rate actuel et ce qui manque (2-3 phrases)",' + nl +
      '  "conseils": "2-3 conseils tactiques concrets pour ce joueur avec ce coach"' + nl +
      '}' + nl + nl +
      'VERIFICATION OBLIGATOIRE avant de repondre:' + nl +
      '1. Pour chaque slider choisi, lis le COUT EXACT dans la liste ci-dessus (ex: 8 clics = 12pts, pas 8pts).' + nl +
      '2. Additionne tous ces couts. Le total DOIT etre exactement ' + pointsMax + ' pts.' + nl +
      '3. Si le total est inferieur a ' + pointsMax + ' pts, ajoute des clics sur les sliders les plus utiles pour ce joueur jusqu\' a atteindre exactement ' + pointsMax + ' pts.';

    var data = await fetchCoachingWithRetry({ model: 'claude-sonnet-4-6', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] });
    var text = (data.content || []).map(function(b) { return b.text || ''; }).join('');

    // Parser le JSON retourné par Claude
    // Extraire le JSON meme si Claude ajoute du texte parasite
    // Extraire le JSON en trouvant les accolades équilibrées
    var jsonStart = text.indexOf('{');
    if (jsonStart === -1) throw new Error('Pas de JSON valide dans la réponse IA.');
    var depth = 0, jsonEnd = -1;
    for (var ci2 = jsonStart; ci2 < text.length; ci2++) {
      if (text[ci2] === '{') depth++;
      else if (text[ci2] === '}') { depth--; if (depth === 0) { jsonEnd = ci2; break; } }
    }
    if (jsonEnd === -1) throw new Error('JSON incomplet dans la réponse IA.');
    var parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

    // Valider le budget cote JS — Claude peut se tromper
    var slidersSuggeres = parsed.sliders || {};
    var totalPts = Object.entries(slidersSuggeres).reduce(function(sum, entry) {
      return sum + Progression.clickCost(entry[1]);
    }, 0);

    if (totalPts > pointsMax) {
      // Budget dépassé — corriger intelligemment en réduisant les sliders les moins prioritaires
      var sliderKeys = Object.keys(slidersSuggeres).sort(function(a, b) {
        return slidersSuggeres[b] - slidersSuggeres[a]; // du plus grand au plus petit
      });
      while (totalPts > pointsMax && sliderKeys.length > 0) {
        var lastKey = sliderKeys[sliderKeys.length - 1];
        if (slidersSuggeres[lastKey] > 2) {
          slidersSuggeres[lastKey] -= 2;
        } else {
          delete slidersSuggeres[lastKey];
          sliderKeys.pop();
        }
        totalPts = Object.entries(slidersSuggeres).reduce(function(sum, entry) {
          return sum + Progression.clickCost(entry[1]);
        }, 0);
      }
      parsed.sliders = slidersSuggeres;
      parsed._budgetCorrige = true;
    }

    _buildIAResult = { data: parsed };

  } catch(e) {
    _buildIAResult = { error: 'Erreur : ' + e.message };
  }

  _buildIALoading = false;
  var elFinal = document.getElementById('build-ia-result');
  if (elFinal) {
    if (_buildIAResult && _buildIAResult.error) {
      elFinal.innerHTML = '<div style="color:var(--red);font-size:13px;padding:12px">' + _buildIAResult.error + '</div>';
    } else if (_buildIAResult && _buildIAResult.data) {
      var pl = State.players.find(function(p) { return p.id === playerId; });
      var cd = (State.cards[playerId] || []).find(function(c) { return c.id === cardId; });
      elFinal.innerHTML = renderBuildIAResult(_buildIAResult.data, pl, cd);
    }
  }
}

// ── Player Tabs ───────────────────────────────────────────────────────────────
function renderPlayerTabs() {
  const tabs = [
    { id: 'stats',    label: 'Stats & Build' },
    { id: 'builds',   label: 'Builds' },
    { id: 'matchs',   label: 'Matchs' },
    { id: 'build-ia', label: '🤖 Build IA' },
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
  const buildMatches = filterStatsMatches(State.matches).filter(m =>
    m.player_stats && m.player_stats.some(ps => ps.build_id === build.id)
  );
  const stats = Analyse.globalStats(buildMatches);
  const serie = Analyse.series(buildMatches);

  // Stats individuelles avec ce build
  let bGoals = 0, bAssists = 0, bSaves = 0, bCS = 0, bRatings = [];
  buildMatches.forEach(m => {
    const ps = (m.player_stats || []).find(ps => ps.build_id === build.id);
    if (ps) {
      bGoals   += ps.goals   || 0;
      bAssists += ps.assists || 0;
      bSaves   += ps.saves   || 0;
      if (ps.rating > 0) bRatings.push(ps.rating);
    }
    if (m.result === 'V' && (m.score_against === 0)) bCS++;
  });
  const bAvgRating = bRatings.length > 0
    ? (bRatings.reduce((a,b) => a+b, 0) / bRatings.length).toFixed(1)
    : null;
  const bCSRate = buildMatches.length > 0 ? Math.round(bCS / buildMatches.length * 100) : 0;
  const pos = card.efhub_stats?.position || '';
  const isGK = pos === 'GK';

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
          <button class="btn-icon" onclick="openBuildCompare('${build.id}');event.stopPropagation()" title="Comparer">
            <i class="ti ti-arrows-diff"></i>
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
          <span class="build-perf-item">🎮 ${stats.total}</span>
          <span class="build-perf-item win">${stats.winRate}% V</span>
          ${bAvgRating ? `<span class="build-perf-item">⭐ ${bAvgRating}/10</span>` : ''}
          ${isGK ? `
            <span class="build-perf-item">${bSaves} arrêts</span>
            <span class="build-perf-item">🧤 ${bCSRate}% CS</span>
          ` : `
            ${bGoals > 0 ? `<span class="build-perf-item">⚽ ${bGoals} buts</span>` : ''}
            ${bAssists > 0 ? `<span class="build-perf-item">🎯 ${bAssists} passes</span>` : ''}
            <span class="build-perf-item">🛡️ ${bCSRate}% CS</span>
          `}
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

function openBuildCompare(buildId) {
  var cards = State.cards[State.selectedPlayerId] || [];
  var allBuilds = cards.flatMap(function(c) { return State.builds[c.id] || []; });

  if (allBuilds.length < 2) {
    showToast('Il faut au moins 2 builds pour comparer', 'warning');
    return;
  }

  var html = '<div class="modal" style="max-width:700px;max-height:90vh">';
  html += '<div class="modal-header"><h3>Comparer des builds</h3><button class="btn-icon" onclick="closeModal()"><i class="ti ti-x"></i></button></div>';
  html += '<div class="modal-body">';
  html += '<div style="display:flex;gap:10px;align-items:center;margin-bottom:12px">';
  html += '<div style="flex:1"><label style="font-size:11px;color:var(--muted)">Build A</label>';
  html += '<select id="compare-build-a" class="form-input form-input-sm" onchange="refreshBuildCompare()">';
  html += allBuilds.map(function(b) { return '<option value="' + b.id + '"' + (b.id === buildId ? ' selected' : '') + '>' + b.name + '</option>'; }).join('');
  html += '</select></div>';
  html += '<div style="font-size:16px;color:var(--muted);padding-top:16px">VS</div>';
  html += '<div style="flex:1"><label style="font-size:11px;color:var(--muted)">Build B</label>';
  html += '<select id="compare-build-b" class="form-input form-input-sm" onchange="refreshBuildCompare()">';
  html += allBuilds.filter(function(b) { return b.id !== buildId; }).map(function(b) { return '<option value="' + b.id + '">' + b.name + '</option>'; }).join('');
  html += '</select></div>';
  html += '</div>';
  html += '<div id="build-compare-result" style="overflow-y:auto;max-height:60vh"></div>';
  html += '</div></div>';

  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-container').classList.remove('hidden');
  document.getElementById('modal-container').innerHTML = html;
  setTimeout(refreshBuildCompare, 50);
}

function refreshBuildCompare() {
  var selA = document.getElementById('compare-build-a');
  var selB = document.getElementById('compare-build-b');
  var result = document.getElementById('build-compare-result');
  if (!selA || !selB || !result) return;

  var cards = State.cards[State.selectedPlayerId] || [];
  var allBuilds = cards.flatMap(function(c) { return State.builds[c.id] || []; });

  var buildA = allBuilds.find(function(b) { return b.id === selA.value; });
  var buildB = allBuilds.find(function(b) { return b.id === selB.value; });
  if (!buildA || !buildB || buildA.id === buildB.id) {
    result.innerHTML = '<div style="color:var(--muted);font-size:12px;text-align:center;padding:12px">Sélectionne deux builds différents</div>';
    return;
  }

  var cardA = cards.find(function(c) { return (State.builds[c.id] || []).some(function(b) { return b.id === buildA.id; }); });
  var cardB = cards.find(function(c) { return (State.builds[c.id] || []).some(function(b) { return b.id === buildB.id; }); });
  var statsA = cardA && cardA.efhub_stats ? Progression.allStatsFinal(cardA.efhub_stats, buildA.sliders || {}) : {};
  var statsB = cardB && cardB.efhub_stats ? Progression.allStatsFinal(cardB.efhub_stats, buildB.sliders || {}) : {};

  var matchesA = State.matches.filter(function(m) { return (m.player_stats || []).some(function(ps) { return ps.build_id === buildA.id; }); });
  var matchesB = State.matches.filter(function(m) { return (m.player_stats || []).some(function(ps) { return ps.build_id === buildB.id; }); });
  var gsA = Analyse.globalStats(matchesA);
  var gsB = Analyse.globalStats(matchesB);
  var ptsA = Progression.totalPoints(buildA.sliders || {});
  var ptsB = Progression.totalPoints(buildB.sliders || {});

  var html = '';

  // Header stats matchs
  html += '<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;margin-bottom:12px">';
  html += '<div style="background:var(--surface3);border-radius:10px;padding:10px;border-left:2px solid var(--accent)">';
  html += '<div style="font-size:13px;font-weight:700;margin-bottom:4px">' + buildA.name + '</div>';
  html += '<div style="font-size:11px;color:var(--muted)">' + ptsA + ' pts utilisés</div>';
  html += matchesA.length > 0 ? '<div style="font-size:12px;color:#34d399;font-weight:700;margin-top:4px">' + gsA.winRate + '% victoires · ' + matchesA.length + ' matchs</div>' : '<div style="font-size:11px;color:var(--muted);margin-top:4px">Aucun match</div>';
  html += '</div>';
  html += '<div style="display:flex;align-items:center;font-size:12px;color:var(--muted);font-weight:700">VS</div>';
  html += '<div style="background:var(--surface3);border-radius:10px;padding:10px;border-left:2px solid #6366f1">';
  html += '<div style="font-size:13px;font-weight:700;margin-bottom:4px">' + buildB.name + '</div>';
  html += '<div style="font-size:11px;color:var(--muted)">' + ptsB + ' pts utilisés</div>';
  html += matchesB.length > 0 ? '<div style="font-size:12px;color:#34d399;font-weight:700;margin-top:4px">' + gsB.winRate + '% victoires · ' + matchesB.length + ' matchs</div>' : '<div style="font-size:11px;color:var(--muted);margin-top:4px">Aucun match</div>';
  html += '</div></div>';

  // Sliders
  html += '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">Sliders</div>';
  html += '<div style="background:var(--surface3);border-radius:8px;overflow:hidden;margin-bottom:12px">';
  SLIDERS_CONFIG.forEach(function(s) {
    var va = (buildA.sliders || {})[s.key] || 0;
    var vb = (buildB.sliders || {})[s.key] || 0;
    if (va === 0 && vb === 0) return;
    var diff = va - vb;
    var colorA = diff > 0 ? '#34d399' : diff < 0 ? '#f87171' : 'var(--text)';
    var colorB = diff < 0 ? '#34d399' : diff > 0 ? '#f87171' : 'var(--text)';
    html += '<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;padding:5px 10px;border-bottom:0.5px solid var(--border)">';
    html += '<div style="text-align:right;font-size:12px;font-weight:' + (diff > 0 ? '700' : '400') + ';color:' + colorA + '">' + (va || '—') + '</div>';
    html += '<div style="text-align:center;font-size:10px;color:var(--muted)">' + s.label + '</div>';
    html += '<div style="text-align:left;font-size:12px;font-weight:' + (diff < 0 ? '700' : '400') + ';color:' + colorB + '">' + (vb || '—') + '</div>';
    html += '</div>';
  });
  html += '</div>';

  // Stats finales
  var allStatKeys = Array.from(new Set(Object.keys(statsA).concat(Object.keys(statsB))));
  if (allStatKeys.length > 0) {
    html += '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">Stats finales</div>';
    html += '<div style="background:var(--surface3);border-radius:8px;overflow:hidden">';
    allStatKeys.forEach(function(key) {
      var va = statsA[key] || 0;
      var vb = statsB[key] || 0;
      if (va === 0 && vb === 0) return;
      var diff = va - vb;
      var colorA = diff > 0 ? '#34d399' : diff < 0 ? '#f87171' : 'var(--text)';
      var colorB = diff < 0 ? '#34d399' : diff > 0 ? '#f87171' : 'var(--text)';
      html += '<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;padding:4px 10px;border-bottom:0.5px solid var(--border)">';
      html += '<div style="text-align:right;font-size:12px;font-weight:' + (diff > 0 ? '700' : '400') + ';color:' + colorA + '">' + va + '</div>';
      html += '<div style="text-align:center;font-size:10px;color:var(--muted)">' + key + '</div>';
      html += '<div style="text-align:left;font-size:12px;font-weight:' + (diff < 0 ? '700' : '400') + ';color:' + colorB + '">' + vb + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  result.innerHTML = html;
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
  // Filtrer par player_stats (nouveau système) ou par build_id (ancien système)
  const cards = State.cards[player.id] || [];
  const cardIds = cards.map(c => c.id);
  const buildIds = cardIds.flatMap(cid => (State.builds[cid] || []).map(b => b.id));
  const playerMatches = State.matches.filter(function(m) {
    // Nouveau système : player_stats contient le player_id
    if (m.player_stats && m.player_stats.some(function(ps) { return ps.player_id === player.id; })) return true;
    // Ancien système : build_id global
    if (buildIds.includes(m.build_id)) return true;
    return false;
  });

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
          ${match.match_status === 'interrompu_reseau' ? `<span class="match-tag" style="background:rgba(239,68,68,0.15);color:#f87171">🔌 Interrompu</span>` : ''}
          ${match.match_status === 'abandon_adverse' ? `<span class="match-tag" style="background:rgba(52,211,153,0.15);color:#34d399">🚪 Abandon</span>` : ''}
          <span class="match-date">${date}</span>
        </div>
      </div>
      <div class="match-actions" onclick="event.stopPropagation()">
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

function openMatchDetail(matchId) {
  var match = State.matches.find(function(m) { return m.id === matchId; });
  if (!match) return;
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
  var coachName = match.efb_coaches ? match.efb_coaches.name : null;
  var playerStats = match.player_stats || [];
  var tituPids = (match.titulaires || []).map(function(t) { return t.player_id; });

  // Trier : titulaires d'abord puis remplaçants
  var sorted = playerStats.slice().sort(function(a, b) {
    var ai = tituPids.indexOf(a.player_id);
    var bi = tituPids.indexOf(b.player_id);
    if (ai === -1) ai = 999;
    if (bi === -1) bi = 999;
    return ai - bi;
  });

  // Header du modal
  var html = '<div class="modal modal-lg" style="max-width:580px;max-height:88vh">';
  html += '<div class="modal-header" style="background:var(--surface2)">';
  html += '<div style="display:flex;align-items:center;gap:10px;flex:1">';
  html += '<div style="width:36px;height:36px;border-radius:8px;background:' + (match.result === 'V' ? '#0d2818' : match.result === 'N' ? '#1a2000' : '#2a0f0f') + ';display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:' + resultColor + '">' + (match.result || '—') + '</div>';
  html += '<div><div style="font-size:15px;font-weight:700">Real Madrid ' + (match.score_for || 0) + ' – ' + (match.score_against || 0) + ' ' + (match.opp_name || 'Adversaire') + '</div>';
  html += '<div style="font-size:11px;color:var(--muted)">' + date + (match.match_time ? ' · ' + match.match_time : '') + '</div></div>';
  html += '</div>';
  html += '<div style="display:flex;gap:4px">';
  html += '<button class="btn-icon" onclick="closeModal();setTimeout(function(){openModal(' + q + 'editMatch' + q + ',' + q + match.id + q + ')},50)" title="Modifier"><i class="ti ti-pencil"></i></button>';
  html += '<button class="btn-icon" onclick="closeModal()"><i class="ti ti-x"></i></button>';
  html += '</div></div>';

  html += '<div class="modal-body" style="gap:10px">';

  // Tags infos
  html += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
  html += '<span class="match-tag" style="font-size:11px;padding:3px 8px">' + typeLabel + '</span>';
  if (match.formation) html += '<span class="match-tag" style="font-size:11px;padding:3px 8px"><i class="ti ti-layout-soccer-field" style="font-size:10px"></i> ' + match.formation + '</span>';
  if (match.opp_formation) html += '<span class="match-tag" style="font-size:11px;padding:3px 8px">Adv: ' + match.opp_formation + '</span>';
  if (match.rank) html += '<span class="match-tag rank" style="font-size:11px;padding:3px 8px">🏅 ' + match.rank + '</span>';
  if (coachName) html += '<span class="match-tag coach" style="font-size:11px;padding:3px 8px"><i class="ti ti-whistle" style="font-size:10px"></i> ' + coachName + '</span>';
  html += '</div>';

  if (match.my_rank || match.opp_rank) {
    html += '<div style="font-size:11px;color:var(--muted)">Pts rang : ' + (match.my_rank || '—') + ' (moi) vs ' + (match.opp_rank || '—') + ' (adv)</div>';
  }

  // Substitutions
  if (match.substitutions && match.substitutions.length > 0) {
    html += '<div style="background:var(--surface3);border-radius:8px;padding:8px 10px">';
    html += '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:5px">Substitutions</div>';
    match.substitutions.forEach(function(sub) {
      var pOut = State.players.find(function(p) { return p.id === sub.out_player_id; });
      var pIn  = State.players.find(function(p) { return p.id === sub.in_player_id; });
      html += '<div style="font-size:12px;display:flex;align-items:center;gap:6px;padding:2px 0">';
      html += '<span style="color:var(--muted)">' + (sub.minute || '?') + String.fromCharCode(39) + '</span>';
      html += '<span style="color:var(--red)">↓ ' + (pOut ? pOut.name : '?') + '</span>';
      html += '<span style="color:var(--green)">↑ ' + (pIn ? pIn.name : '?') + '</span>';
      html += '</div>';
    });
    html += '</div>';
  }

  // Instructions
  var instrSlots = [
    {key:'attack1', label:'Attack 1'}, {key:'attack2', label:'Attack 2'},
    {key:'defence1', label:'Defence 1'}, {key:'defence2', label:'Defence 2'},
  ];
  var activeInstr = instrSlots.filter(function(sl) {
    return match[sl.key + '_instruction'] && match[sl.key + '_instruction'] !== 'Off';
  });
  if (activeInstr.length > 0) {
    html += '<div style="background:var(--surface3);border-radius:8px;padding:8px 10px">';
    html += '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:5px">Instructions</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">';
    activeInstr.forEach(function(sl) {
      var instr = match[sl.key + '_instruction'];
      var targetId = match[sl.key + '_target'];
      var targetName = targetId ? ((State.players.find(function(p) { return p.id === targetId; }) || {}).name || '') : '';
      html += '<div style="font-size:11px"><span style="color:var(--muted)">' + sl.label + '</span> ' + instr + (targetName ? ' · <span style="color:var(--accent)">' + targetName + '</span>' : '') + '</div>';
    });
    html += '</div></div>';
  }

  // Stats joueurs
  if (sorted.length > 0) {
    html += '<div>';
    html += '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">Performances joueurs</div>';
    html += '<div style="display:flex;flex-direction:column;gap:4px">';
    sorted.forEach(function(ps) {
      var player = State.players.find(function(p) { return p.id === ps.player_id; });
      var cards = State.cards[ps.player_id] || [];
      var card = cards[0];
      var pos = card && card.efhub_stats ? (card.efhub_stats.position || '') : '';
      var isTitu = tituPids.includes(ps.player_id);
      var efhubId = player ? Efhub.parseId(player.efhub_url || '') : null;
      var imgUrl = efhubId ? Efhub.imgUrl(efhubId) : null;
      var isMOTM = match.man_of_match === ps.player_id;
      var ratingColor = ps.rating >= 8 ? 'var(--green)' : ps.rating >= 6 ? 'var(--amber)' : 'var(--muted)';

      html += '<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--surface3);border-radius:7px;' + (isMOTM ? 'border:0.5px solid var(--amber)' : '') + '">';
      if (imgUrl) html += '<img src="' + imgUrl + '" style="width:22px;height:28px;border-radius:3px;object-fit:cover;flex-shrink:0" onerror="this.style.display=\'none\'">';
      html += '<span style="font-size:10px;color:var(--accent);font-weight:700;width:26px;flex-shrink:0">' + pos + '</span>';
      html += '<span style="flex:1;font-size:12px;font-weight:600">' + (player ? player.name : '?') + (isMOTM ? ' 🏅' : '') + '</span>';
      if (!isTitu) html += '<span style="font-size:9px;color:var(--muted);background:var(--surface);padding:1px 5px;border-radius:4px">Rempl.</span>';
      if (ps.rating > 0) html += '<span style="font-size:12px;font-weight:700;color:' + ratingColor + '">' + ps.rating + '</span>';
      if (ps.goals > 0) html += '<span style="font-size:11px">⚽' + ps.goals + '</span>';
      if (ps.assists > 0) html += '<span style="font-size:11px">🎯' + ps.assists + '</span>';
      if (ps.saves > 0) html += '<span style="font-size:11px">🧤' + ps.saves + '</span>';
      if (ps.yellow_card) html += '<span style="font-size:12px">🟡</span>';
      if (ps.red_card) html += '<span style="font-size:12px">🔴</span>';
      html += '</div>';
    });
    html += '</div></div>';
  }

  // Note globale + MOTM
  html += '<div style="display:flex;gap:8px;align-items:center;padding:8px 10px;background:var(--surface3);border-radius:8px">';
  html += '<span style="font-size:11px;color:var(--muted)">Note globale</span>';
  html += '<span style="font-size:14px;font-weight:700;color:var(--accent)">' + (match.note || '—') + '/5</span>';
  if (match.repeated_opponent) html += '<span style="font-size:11px;color:var(--amber);margin-left:auto">⚠ Adversaire répétitif</span>';
  html += '</div>';

  html += '</div></div>';

  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-container').classList.remove('hidden');
  document.getElementById('modal-container').innerHTML = html;
}

// ── Onglet Analyse ────────────────────────────────────────────────────────────
// ── Coaching IA ───────────────────────────────────────────────────────────────
var _coachingResult = null;
var _coachingLoading = false;
var _coachingMode = 'general'; // general | ligue_jcj | event_ia | my_league
var COACHING_HISTORY_KEY = 'efb_coaching_history';
var COACHING_HISTORY_MAX = 5; // Garder les 5 derniers conseils

var _groqHistory = []; // [{role:'user'|'assistant', content:'...'}]
var _groqContext = null;

function buildGroqContext() {
  var matches = filterStatsMatches(State.matches);
  var gs = Analyse.globalStats(matches);
  var serie = Analyse.series(matches);
  var activeCoachId = getActiveCoachId();
  var activeCoach = activeCoachId ? State.coaches.find(function(c) { return c.id === activeCoachId; }) : null;
  var nl = '\n';

  var ctx = 'Tu es un coach expert eFootball Mobile. Tu dois UNIQUEMENT parler des joueurs listés ci-dessous.' + nl;
  ctx += 'Ne mentionne JAMAIS de joueurs qui ne sont pas dans cette liste. Réponds en français.' + nl + nl;

  // Effectif réel
  ctx += 'MON EFFECTIF REAL MADRID :' + nl;
  State.players.forEach(function(p) {
    var cards = State.cards[p.id] || [];
    var card = cards[0];
    var pos = card && card.efhub_stats ? (card.efhub_stats.position || '') : '';
    var style = card ? (card.playing_style || '') : '';
    var cardType = card ? (card.card_type || '') : '';
    var builds = cards.flatMap(function(c) { return State.builds[c.id] || []; });
    var buildNames = builds.map(function(b) { return b.name; }).join(', ');
    ctx += '- ' + p.name + ' (' + pos + (style ? ' · ' + style : '') + (cardType ? ' · ' + cardType : '') + (buildNames ? ' | Builds: ' + buildNames : '') + ')' + nl;
  });

  // Squad 23
  if (_squad23 && _squad23.length > 0) {
    ctx += nl + 'MA SÉLECTION ACTUELLE (Squad 23) :' + nl;
    _squad23.forEach(function(s) {
      var player = State.players.find(function(p) { return p.id === s.player_id; });
      var cards = State.cards[s.player_id] || [];
      var card = cards.find(function(c) { return c.id === s.card_id; });
      var build = card ? (State.builds[card.id] || []).find(function(b) { return b.id === s.build_id; }) : null;
      var pos = card && card.efhub_stats ? (card.efhub_stats.position || '') : '';
      if (player) ctx += '- ' + player.name + ' · ' + pos + (build ? ' · Build: ' + build.name : '') + nl;
    });
  }

  // Stats globales
  ctx += nl + 'STATS GLOBALES : ' + matches.length + ' matchs · ' + gs.winRate + '% victoires · ' + gs.wins + 'V ' + gs.draws + 'N ' + gs.losses + 'D · Série: ' + serie.current + ' · Record: ' + serie.record + nl;

  // Coach actif
  if (activeCoach) {
    ctx += 'COACH ACTIF : ' + activeCoach.name + ' · Style: ' + (activeCoach.style || '—');
    if (activeCoach.notes) ctx += ' · ' + activeCoach.notes;
    ctx += nl;
  }

  // Stats par joueur
  var byPlayer = Analyse.byPlayer(matches);
  if (byPlayer.length > 0) {
    ctx += nl + 'STATS JOUEURS (matchs enregistrés) :' + nl;
    byPlayer.slice(0, 15).forEach(function(p) {
      var player = State.players.find(function(x) { return x.id === p.player_id; });
      if (!player) return;
      ctx += '- ' + player.name + ' : ' + p.matchCount + 'J · ' + (p.avgRating || '—') + '/10 · ⚽' + p.goals + ' · 🎯' + p.assists + (p.saves > 0 ? ' · 🧤' + p.saves : '') + ' · ' + p.winRate + '%V' + nl;
    });
  }

  // Derniers matchs
  if (matches.length > 0) {
    ctx += nl + 'DERNIERS MATCHS :' + nl;
    matches.slice(0, 5).forEach(function(m) {
      var typeLabels = { ligue_jcj_d1:'JCJ D1', ligue_jcj_d2:'JCJ D2', ligue_jcj_d3:'JCJ D3', event_ia:'Évènement IA', my_league:'My League', amical:'Amical' };
      ctx += '- ' + (m.result||'?') + ' ' + (m.score_for||0) + '-' + (m.score_against||0) + ' vs ' + (m.opp_name||'?') + ' · ' + (typeLabels[m.match_type]||m.match_type||'?') + ' · ' + (m.formation||'?') + nl;
    });
  }

  ctx += nl + 'RÈGLE IMPORTANTE : Ne cite que les joueurs listés dans MON EFFECTIF. Ne jamais inventer de joueurs.';
  return ctx;
}

function chatMessageBubble(role, text) {
  var isUser = role === 'user';
  return '<div style="display:flex;justify-content:' + (isUser?'flex-end':'flex-start') + ';margin-bottom:6px">' +
    '<div style="max-width:85%;padding:8px 12px;border-radius:' + (isUser?'12px 12px 2px 12px':'12px 12px 12px 2px') + ';background:' + (isUser?'var(--accent)':'var(--surface3)') + ';color:#fff;font-size:12px;line-height:1.5">' +
    text.replace(/\n/g,'<br>') +
    '</div></div>';
}

async function sendChatMessage() {
  var input = document.getElementById('gemini-input');
  var msgContainer = document.getElementById('gemini-messages');
  var sendBtn = document.getElementById('btn-gemini-send');
  if (!input || !msgContainer) return;
  var text = input.value.trim();
  if (!text) return;

  msgContainer.insertAdjacentHTML('beforeend', chatMessageBubble('user', text));
  input.value = '';
  input.disabled = true;
  if (sendBtn) sendBtn.disabled = true;

  var typingId = 'chat-typing-' + Date.now();
  msgContainer.insertAdjacentHTML('beforeend', '<div id="' + typingId + '" style="font-size:11px;color:var(--muted);padding:4px 8px">Llama réfléchit...</div>');
  msgContainer.scrollTop = msgContainer.scrollHeight;

  if (!_groqContext) _groqContext = buildGroqContext();
  _groqHistory.push({ role: 'user', content: text });

  // Construire les messages pour Groq (format OpenAI)
  var messages = [{ role: 'system', content: _groqContext }].concat(_groqHistory);

  try {
    var response = await fetch(EFB_CONFIG.workerUrl + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages })
    });
    var data = await response.json();
    var reply = data.choices?.[0]?.message?.content;
    if (!reply) reply = 'Erreur : ' + JSON.stringify(data).substring(0, 150);

    _groqHistory.push({ role: 'assistant', content: reply });

    var typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();
    msgContainer.insertAdjacentHTML('beforeend', chatMessageBubble('assistant', reply));
  } catch(e) {
    var typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();
    msgContainer.insertAdjacentHTML('beforeend', chatMessageBubble('assistant', 'Erreur : ' + e.message));
  }

  input.disabled = false;
  if (sendBtn) sendBtn.disabled = false;
  input.focus();
  msgContainer.scrollTop = msgContainer.scrollHeight;
}

function clearGeminiChat() {
  _groqHistory = [];
  _groqContext = null;
  var el = document.getElementById('gemini-messages');
  if (el) el.innerHTML = '';
}

// Score composite adapté par position
function compositeScore(avgRating, winRate, goalsPerMatch, assistsPerMatch, csRate, position, savesPerMatch) {
  var pos = (position || '').toUpperCase();
  var spm = savesPerMatch || 0;
  var w;
  if (pos === 'GK') {
    w = { note:30, win:20, goals:0, assists:0, cs:35 };
    return (avgRating/10)*w.note + (winRate/100)*w.win + (csRate/100)*w.cs + spm*15;
  } else if (pos === 'CB' || pos === 'LB' || pos === 'RB') {
    w = { note:35, win:25, goals:5, assists:5, cs:30 };
  } else if (pos === 'DMF' || pos === 'CMF') {
    w = { note:35, win:25, goals:15, assists:15, cs:10 };
  } else if (pos === 'AMF' || pos === 'LMF' || pos === 'RMF') {
    w = { note:35, win:25, goals:20, assists:10, cs:10 };
  } else {
    w = { note:40, win:25, goals:20, assists:10, cs:5 };
  }
  return (avgRating/10)*w.note + (winRate/100)*w.win + goalsPerMatch*w.goals + assistsPerMatch*w.assists + (csRate/100)*w.cs;
}

function openTop5Modal() {
  var matches = filterStatsMatches(State.matches);
  if (matches.length === 0) { showToast('Aucun match enregistré', 'warning'); return; }

  // Calcul score composite par joueur
  var playerData = {};
  matches.forEach(function(m) {
    var goalsAgainst = m.score_against || 0;
    var isCleanSheet = goalsAgainst === 0;
    (m.player_stats || []).forEach(function(ps) {
      if (!ps.player_id) return;
      if (!playerData[ps.player_id]) playerData[ps.player_id] = {
        player_id: ps.player_id, matches: 0, wins: 0, goals: 0, assists: 0,
        ratings: [], cleanSheets: 0, build_ids: {}
      };
      var pd = playerData[ps.player_id];
      pd.matches++;
      if (m.result === 'V') pd.wins++;
      pd.goals += ps.goals || 0;
      pd.assists += ps.assists || 0;
      if (ps.rating > 0) pd.ratings.push(ps.rating);
      if (isCleanSheet) pd.cleanSheets++;
      if (ps.build_id) pd.build_ids[ps.build_id] = (pd.build_ids[ps.build_id] || 0) + 1;
    });
  });

  // Score composite (min 1 match)
  var ranked = Object.values(playerData).filter(function(p) { return p.matches >= 1; }).map(function(p) {
    var avgRating = p.ratings.length > 0 ? p.ratings.reduce(function(a,b){return a+b;},0)/p.ratings.length : 0;
    var winRate = p.matches > 0 ? p.wins/p.matches*100 : 0;
    var goalsPerMatch = p.matches > 0 ? p.goals/p.matches : 0;
    var assistsPerMatch = p.matches > 0 ? p.assists/p.matches : 0;
    var csRate = p.matches > 0 ? p.cleanSheets/p.matches*100 : 0;
    // Position du joueur pour score adapté
    var cards = State.cards[p.player_id] || [];
    var card = cards[0];
    var pos = card && card.efhub_stats ? (card.efhub_stats.position || '') : '';
    var score = compositeScore(avgRating, winRate, goalsPerMatch, assistsPerMatch, csRate, pos, p.matches > 0 ? (p.saves||0)/p.matches : 0);
    // Build le plus utilisé
    var topBuildId = Object.entries(p.build_ids).sort(function(a,b){return b[1]-a[1];})[0]?.[0] || null;
    return {
      player_id: p.player_id, matches: p.matches, wins: p.wins, goals: p.goals,
      assists: p.assists, avgRating: avgRating.toFixed(1), winRate: Math.round(winRate),
      cleanSheets: p.cleanSheets, score: Math.round(score*10)/10, topBuildId
    };
  }).sort(function(a,b){ return b.score - a.score; }).slice(0,5);

  var medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
  var html = '<div class="modal modal-lg" style="max-width:640px;max-height:92vh">';
  html += '<div class="modal-header" style="background:linear-gradient(135deg,#1a1a2e,#16213e)">';
  html += '<div><div style="font-size:16px;font-weight:800;color:#f59e0b">🏆 Top 5 joueurs de la saison</div>';
  html += '<div style="font-size:11px;color:var(--muted)">Score composite : Note(40%) + Victoires(25%) + Buts(15%) + Passes(10%) + Clean sheets(10%)</div></div>';
  html += '<button class="btn-icon" onclick="closeModal()"><i class="ti ti-x"></i></button>';
  html += '</div>';
  html += '<div class="modal-body" style="gap:12px;padding:14px">';

  ranked.forEach(function(p, idx) {
    var player = State.players.find(function(x) { return x.id === p.player_id; });
    var cards = State.cards[p.player_id] || [];
    var card = cards[0];
    var pos = card?.efhub_stats?.position || '';
    var cardType = card?.card_type || '';
    var efhubId = player ? Efhub.parseId(player.efhub_url || '') : null;
    var imgUrl = efhubId ? Efhub.imgUrl(efhubId) : null;

    // Build le plus utilisé
    var allBuilds = cards.flatMap(function(c) { return State.builds[c.id] || []; });
    var topBuild = allBuilds.find(function(b) { return b.id === p.topBuildId; }) || allBuilds[0];
    var activeSliders = topBuild ? SLIDERS_CONFIG.filter(function(s) { return (topBuild.sliders||{})[s.key] > 0; }) : [];
    var ptsUsed = topBuild ? Progression.totalPoints(topBuild.sliders || {}) : 0;
    var ptsMax = card?.points_max || 0;

    var cardColors = {
      'Legendary': '#f59e0b', 'Iconic Moment': '#a78bfa', 'Iconic': '#6366f1',
      'Epic': '#ec4899', 'Featured': '#3b82f6', 'Standard': '#6b7280', 'Trending': '#10b981'
    };
    var cardColor = cardColors[cardType] || 'var(--accent)';

    html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:12px;position:relative;overflow:hidden">';
    html += '<div style="position:absolute;top:8px;right:12px;font-size:28px;opacity:0.15">' + medals[idx] + '</div>';

    // Header joueur
    html += '<div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px">';
    html += '<div style="font-size:32px;line-height:1">' + medals[idx] + '</div>';
    if (imgUrl) html += '<img src="' + imgUrl + '" style="width:52px;height:64px;border-radius:8px;object-fit:cover;border:2px solid ' + cardColor + '" onerror="this.style.display=\'none\'">';
    html += '<div style="flex:1">';
    html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">';
    html += '<span style="font-size:16px;font-weight:800;color:#fff">' + (player ? player.name : '?') + '</span>';
    html += '<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:' + cardColor + '22;color:' + cardColor + ';font-weight:700">' + pos + ' · ' + cardType + '</span>';
    html += '</div>';
    html += '<div style="font-size:11px;color:var(--muted);margin-top:2px">' + p.matches + ' matchs · ' + p.wins + ' victoires</div>';

    // Stats en ligne
    html += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">';
    html += '<span style="font-size:12px;color:#f59e0b;font-weight:700">★ ' + p.avgRating + '</span>';
    html += '<span style="font-size:12px;color:#34d399;font-weight:700">' + p.winRate + '% V</span>';
    html += '<span style="font-size:12px">⚽ ' + p.goals + '</span>';
    html += '<span style="font-size:12px">🎯 ' + p.assists + '</span>';
    html += '<span style="font-size:12px">🧹 ' + p.cleanSheets + ' CS</span>';
    html += '<span style="font-size:11px;color:var(--accent);font-weight:700">Score: ' + p.score + '</span>';
    html += '</div></div></div>';

    // Build
    if (topBuild) {
      html += '<div style="background:var(--surface3);border-radius:8px;padding:8px 10px">';
      html += '<div style="font-size:10px;color:var(--muted);margin-bottom:6px">Build : <strong style="color:var(--accent)">' + topBuild.name + '</strong> · ' + ptsUsed + '/' + ptsMax + ' pts</div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:8px">';
      activeSliders.forEach(function(s) {
        var val = (topBuild.sliders || {})[s.key] || 0;
        html += '<div style="display:flex;flex-direction:column;align-items:center;gap:2px">';
        html += '<div style="color:var(--accent)">' + s.icon + '</div>';
        html += '<span style="font-size:11px;font-weight:700;color:#fff">' + val + '</span>';
        html += '<span style="font-size:9px;color:var(--muted)">' + s.label + '</span>';
        html += '</div>';
      });
      if (activeSliders.length === 0) html += '<span style="font-size:11px;color:var(--muted)">Aucun clic enregistré</span>';
      html += '</div></div>';
    }
    html += '</div>';
  });

  if (ranked.length === 0) html += '<div style="text-align:center;color:var(--muted);padding:20px">Pas assez de données</div>';

  html += '</div></div>';

  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-container').classList.remove('hidden');
  document.getElementById('modal-container').innerHTML = html;
}

function setCoachingMode(mode, btn) {
  _coachingMode = mode;
  document.querySelectorAll('.coaching-mode-btn').forEach(function(b) {
    b.classList.remove('active');
  });
  if (btn) btn.classList.add('active');
}

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

    const data = await fetchCoachingWithRetry({ model: 'claude-sonnet-4-6', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] });
    const text = data.content?.map(b => b.text || '').join('') || '';
    _coachingResult = { text };

    // Sauvegarder dans l'historique
    saveCoachingToHistory(text);
  } catch(e) {
    _coachingResult = { error: 'Erreur API : ' + e.message };
  }

  _coachingLoading = false;
  renderCoachingResult();
}

function buildCoachingData() {
  const matches = filterStatsMatches(State.matches);
  const players = State.players;
  const allBuilds = Object.values(State.builds).flat();

  // Stats globales
  const globalStats = Analyse.globalStats(matches);
  const serie = Analyse.series(matches);
  const byRank = Analyse.byRank(matches);

  // Coach actif
  const activeCoachId = getActiveCoachId();
  const activeCoach = activeCoachId ? State.coaches.find(function(c) { return c.id === activeCoachId; }) : null;

  // Stats par coach
  const byCoach = Analyse.byCoach(matches).filter(function(c) { return c.coach_id && c.total > 0; }).map(function(c) {
    return {
      name: c.name,
      style: c.style || '—',
      total: c.total,
      winRate: c.winRate,
      serieRecord: c.serie.record,
      serieCurrent: c.serie.current,
      goalsFor: c.goalsFor,
    };
  });

  // Stats par build — chercher dans player_stats[].build_id
  const buildStats = allBuilds.map(b => {
    const bMatches = matches.filter(m =>
      m.player_stats && m.player_stats.some(function(ps) { return ps.build_id === b.id; })
    );
    const bs = Analyse.globalStats(bMatches);
    const bSerie = Analyse.series(bMatches);
    const card = Object.values(State.cards).flat().find(c => c.id === b.card_id);
    const player = players.find(p => p.id === card?.player_id);

    // Stats individuelles du joueur avec ce build
    var goals = 0, assists = 0, ratings = [], saves = 0;
    bMatches.forEach(function(m) {
      var ps = (m.player_stats || []).find(function(ps) { return ps.build_id === b.id; });
      if (ps) {
        goals   += ps.goals   || 0;
        assists += ps.assists || 0;
        saves   += ps.saves   || 0;
        if (ps.rating > 0) ratings.push(ps.rating);
      }
    });
    var avgRating = ratings.length > 0
      ? (ratings.reduce(function(a,x){return a+x;}, 0) / ratings.length).toFixed(1)
      : null;

    return {
      name: b.name,
      player: player?.name || '?',
      position: card ? (card.efhub_stats?.position || '?') : '?',
      matches: bs.total,
      winRate: bs.winRate,
      serie: bSerie.record,
      currentSerie: bSerie.current,
      goals,
      assists,
      saves,
      avgRating,
      goalsPerMatch: bs.total > 0 ? (goals / bs.total).toFixed(1) : 0,
      assistsPerMatch: bs.total > 0 ? (assists / bs.total).toFixed(1) : 0,
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

  // Dernier match joué
  var lastMatch = null;
  if (matches.length > 0) {
    var lm = matches[0]; // déjà trié par played_at desc
    var lmCoach = lm.coach_id ? State.coaches.find(function(c) { return c.id === lm.coach_id; }) : null;
    var lmTopPlayers = (lm.player_stats || [])
      .filter(function(ps) { return ps.rating > 0; })
      .sort(function(a, b) { return b.rating - a.rating; })
      .slice(0, 3)
      .map(function(ps) {
        var p = players.find(function(x) { return x.id === ps.player_id; });
        return (p ? p.name : '?') + ' (' + ps.rating + '/10' + (ps.goals > 0 ? ', ' + ps.goals + ' but' + (ps.goals > 1 ? 's' : '') : '') + ')';
      });
    var typeLabels = {
      ligue_jcj_d1:'Ligue JCJ D1', ligue_jcj_d2:'Ligue JCJ D2', ligue_jcj_d3:'Ligue JCJ D3',
      ligue_ia_d1:'Ligue IA D1', ligue_ia_d2:'Ligue IA D2', ligue_ia_d3:'Ligue IA D3',
      event_jcj:'Évènement JCJ', event_ia:'Évènement IA', amical:'Amical', my_league:'My League',
    };
    lastMatch = {
      result: lm.result,
      score: (lm.score_for || 0) + '-' + (lm.score_against || 0),
      opp: lm.opp_name || 'Inconnu',
      type: typeLabels[lm.match_type] || lm.match_type || '—',
      formation: lm.formation || '—',
      oppFormation: lm.opp_formation || '—',
      coach: lmCoach ? lmCoach.name : '—',
      note: lm.note || '—',
      topPlayers: lmTopPlayers,
      status: lm.match_status || 'termine',
    };
  }

  return {
    matches: matches.length,
    winRate: globalStats.winRate,
    currentSerie: serie.current,
    recordSerie: serie.record,
    byRank,
    activeCoach,
    byCoach,
    buildStats,
    playerStats,
    topCombos,
    lastMatch,
  };
}

function buildCoachingPrompt(data) {
  var nl = String.fromCharCode(10);
  var rankLines = data.byRank.map(function(r) {
    return '- ' + r.rank + ' : ' + r.winRate + '% (' + r.total + ' matchs, serie record: ' + r.serie.record + ')';
  }).join(nl);
  var buildLines = data.buildStats.length > 0
    ? data.buildStats.map(function(b) {
        var stats = [];
        if (b.avgRating) stats.push('note moy:' + b.avgRating + '/10');
        if (b.goals > 0) stats.push(b.goals + ' buts (' + b.goalsPerMatch + '/match)');
        if (b.assists > 0) stats.push(b.assists + ' passes (' + b.assistsPerMatch + '/match)');
        if (b.saves > 0) stats.push(b.saves + ' arrêts');
        return '- ' + b.name + ' [' + b.player + ' · ' + b.position + '] : ' + b.winRate + '% sur ' + b.matches + ' matchs' +
          (stats.length > 0 ? ' | ' + stats.join(', ') : '') +
          ' | série record:' + b.serie + ', actuelle:' + b.currentSerie;
      }).join(nl)
    : 'Aucun build avec données de match disponibles';
  var playerLines = data.playerStats.map(function(p) {
    return '- ' + p.name + ' : note ' + (p.avgRating || 'N/A') + '/10, ' + p.goals + ' buts, ' + p.assists + ' passes, ' + p.winRate + '% victoires';
  }).join(nl);
  var comboLines = data.topCombos.map(function(c) {
    return '- ' + c.players.join(' + ') + ' : ' + c.wins + ' victoires';
  }).join(nl);

  // Section coach actif
  var coachSection = '';
  if (data.activeCoach) {
    coachSection = 'COACH ACTIF: ' + data.activeCoach.name + ' · Style: ' + (data.activeCoach.style || '—') +
      (data.activeCoach.formation ? ' · Formation: ' + data.activeCoach.formation : '') +
      (data.activeCoach.notes ? nl + 'Notes: ' + data.activeCoach.notes : '') + nl + nl;
  }

  // Section stats par coach
  var coachLines = '';
  if (data.byCoach && data.byCoach.length > 0) {
    coachLines = 'PERFORMANCE PAR COACH:' + nl +
      data.byCoach.map(function(c) {
        return '- ' + c.name + ' (' + c.style + ') : ' + c.winRate + '% sur ' + c.total + ' matchs, ' + c.goalsFor + ' buts, serie record: ' + c.serieRecord;
      }).join(nl) + nl + nl;
  }

  // Section dernier match
  var lastMatchSection = '';
  if (data.lastMatch) {
    var lm = data.lastMatch;
    var resultLabel = lm.result === 'V' ? 'VICTOIRE' : lm.result === 'N' ? 'NUL' : 'DÉFAITE';
    lastMatchSection = 'DERNIER MATCH:' + nl +
      '- Résultat: ' + resultLabel + ' ' + lm.score + ' vs ' + lm.opp + nl +
      '- Type: ' + lm.type + (lm.status !== 'termine' ? ' (' + (lm.status === 'interrompu_reseau' ? 'interrompu réseau' : 'abandon adverse') + ')' : '') + nl +
      '- Formation: ' + lm.formation + ' vs ' + lm.oppFormation + nl +
      '- Coach: ' + lm.coach + nl +
      '- Note globale: ' + lm.note + '/5' + nl +
      (lm.topPlayers.length > 0 ? '- Meilleurs joueurs: ' + lm.topPlayers.join(', ') : '') + nl + nl;
  }

  return 'Tu es un coach eFootball Mobile expert. Analyse ces donnees et donne des recommandations en francais.' + nl + nl +
    'Matchs: ' + data.matches + ', Victoires: ' + data.winRate + '%, Serie: ' + data.currentSerie + ', Record: ' + data.recordSerie + nl + nl +
    lastMatchSection +
    coachSection +
    coachLines +
    'PAR RANG:' + nl + rankLines + nl + nl +
    'BUILDS:' + nl + buildLines + nl + nl +
    'JOUEURS:' + nl + playerLines + nl + nl +
    'COMBOS GAGNANTS:' + nl + comboLines + nl + nl +
    'Reponds en 5 sections: 1. DERNIER MATCH 2. COACH & TACTIQUE 3. COACHING EQUIPE 4. BUILDS 5. JOUEURS. Max 400 mots.';
}

function saveCoachingToHistory(text) {
  try {
    var history = loadCoachingHistory();
    var entry = {
      date: new Date().toISOString(),
      matches: filterStatsMatches(State.matches).length,
      text: text,
    };
    history.unshift(entry);
    if (history.length > COACHING_HISTORY_MAX) history = history.slice(0, COACHING_HISTORY_MAX);
    localStorage.setItem(COACHING_HISTORY_KEY, JSON.stringify(history));
  } catch(e) {}
}

function loadCoachingHistory() {
  try {
    return JSON.parse(localStorage.getItem(COACHING_HISTORY_KEY) || '[]');
  } catch(e) { return []; }
}

function clearCoachingHistory() {
  localStorage.removeItem(COACHING_HISTORY_KEY);
  var el = document.getElementById('coaching-history');
  if (el) el.innerHTML = '';
  showToast('Historique effacé', 'success');
}

function toggleCoachingHistory() {
  var el = document.getElementById('coaching-history');
  if (!el) return;
  var isHidden = el.classList.contains('hidden');
  el.classList.toggle('hidden');
  // Remplir le contenu au premier affichage
  if (isHidden) renderCoachingHistorySection();
}

function renderCoachingText(text) {
  var lines = text.split(String.fromCharCode(10));
  var parts = lines.map(function(line) {
    line = line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    line = line.replace(/^#{1,3}\s*/, '');
    if (/^\d+\./.test(line) && line.length > 5) return '<div class="coaching-section-title">' + line + '</div>';
    if (/^[-]\s/.test(line)) return '<div class="coaching-bullet">&bull; ' + line.replace(/^[-]\s+/, '') + '</div>';
    if (line.trim() === '') return '<br>';
    return line;
  });
  return '<div class="coaching-text">' + parts.join(' ') + '</div>';
}

function renderCoachingResult() {
  var el = document.getElementById('coaching-result');
  if (!el) return;
  if (!_coachingResult) { el.innerHTML = ''; return; }
  if (_coachingResult.error) {
    el.innerHTML = '<div class="coaching-error">' + _coachingResult.error + '</div>';
    return;
  }
  el.innerHTML = renderCoachingText(_coachingResult.text);

  // Rendre l'historique
  renderCoachingHistorySection();
}

function renderCoachingHistorySection() {
  var el = document.getElementById('coaching-history');
  if (!el) return;
  var history = loadCoachingHistory();
  // Le premier = résultat actuel déjà affiché, on affiche à partir du 2ème
  var past = history.slice(1);
  if (past.length === 0) {
    el.innerHTML = '<div style="font-size:12px;color:var(--muted);text-align:center;padding:8px">Aucun conseil précédent</div>';
    return;
  }
  el.innerHTML = past.map(function(entry, i) {
    var date = new Date(entry.date).toLocaleDateString('fr-FR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
    return '<div style="border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:8px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
        '<span style="font-size:11px;color:var(--muted)">📅 ' + date + ' · ' + entry.matches + ' matchs</span>' +
        '<button class="btn-icon" onclick="this.closest(\'div\').nextElementSibling || this.closest(\'div\').querySelector(\'.coaching-history-body\').classList.toggle(\'hidden\')" style="font-size:10px"><i class="ti ti-chevron-down"></i></button>' +
      '</div>' +
      '<div class="coaching-history-body" style="font-size:12px;color:var(--text-secondary)">' + renderCoachingText(entry.text) + '</div>' +
    '</div>';
  }).join('');
}

function renderAnalyse() {
  const matches = filterStatsMatches(State.matches);
  const stats    = Analyse.globalStats(matches);
  const serie    = Analyse.series(matches);
  const byRank   = Analyse.byRank(matches);
  const byBuild  = Analyse.byBuild(matches);
  const byPlayer = Analyse.byPlayer(matches);
  const byForm   = Analyse.byFormation(matches);
  const byType   = Analyse.byMatchType(matches);
  const byCoach  = Analyse.byCoach(matches);
  const bestXI   = Analyse.bestXI(matches);
  const byInstr  = Analyse.byIndividualInstruction(matches);
  const byDef    = Analyse.byDefensive(matches);

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
  var drawRate = stats.total > 0 ? Math.round(stats.draws / stats.total * 100) : 0;
  var lossRate = stats.total > 0 ? Math.round(stats.losses / stats.total * 100) : 0;
  const kpiHtml = `
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-val">${stats.total}</div><div class="kpi-label">Matchs</div></div>
      <div class="kpi"><div class="kpi-val" style="color:#34d399">${stats.winRate}%</div><div class="kpi-label">Victoires (${stats.wins})</div></div>
      <div class="kpi"><div class="kpi-val" style="color:#f59e0b">${drawRate}%</div><div class="kpi-label">Nuls (${stats.draws})</div></div>
      <div class="kpi"><div class="kpi-val" style="color:#f87171">${lossRate}%</div><div class="kpi-label">Défaites (${stats.losses})</div></div>
      <div class="kpi"><div class="kpi-val">${stats.goalsFor}</div><div class="kpi-label">Buts marqués</div></div>
      <div class="kpi"><div class="kpi-val">${stats.goalsAgainst}</div><div class="kpi-label">Buts encaissés</div></div>
      <div class="kpi highlight"><div class="kpi-val" style="color:#a78bfa">${serie.current}</div><div class="kpi-label">Série actuelle</div></div>
      <div class="kpi highlight"><div class="kpi-val" style="color:#a78bfa">${serie.record}</div><div class="kpi-label">Record</div></div>
    </div>
    <div style="text-align:center;margin-top:8px">
      <button class="btn-sm btn-primary" onclick="setTab('saison')" style="gap:6px">
        <i class="ti ti-trophy"></i> Top 5 joueurs de la saison
      </button>
    </div>`;

  // ── Séries ──
  const serieHtml = renderSerieBlock('Série en cours', serie.current, serie.currentMatches, 'actuelle') +
    (serie.record > serie.current ? renderSerieBlock('Record', serie.record, serie.recordMatches, 'record') : '');

  // ── Coaching IA ──
  var coachingHistory = loadCoachingHistory();
  var hasHistory = coachingHistory.length > 0;
  var lastDate = coachingHistory.length > 0
    ? new Date(coachingHistory[0].date).toLocaleDateString('fr-FR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })
    : null;

  const coachingHtml = `
    <div class="coaching-block">
      <div class="coaching-header">
        <div>
          <div class="coaching-title">🤖 Coaching IA</div>
          <div class="coaching-subtitle">Analyse ta performance et recommandations personnalisées</div>
          ${lastDate ? '<div style="font-size:10px;color:var(--muted);margin-top:2px">Dernier conseil : ' + lastDate + '</div>' : ''}
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          ${hasHistory ? '<button class="btn-sm btn-ghost" onclick="toggleCoachingHistory()" title="Historique"><i class="ti ti-history"></i></button>' : ''}
          ${hasHistory ? '<button class="btn-icon" onclick="clearCoachingHistory()" title="Effacer historique"><i class="ti ti-trash" style="font-size:12px"></i></button>' : ''}
          <button class="btn-sm btn-primary" onclick="generateCoaching()" id="btn-coaching">✨ Générer</button>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
        <button class="coaching-mode-btn ${_coachingMode==='general'?'active':''}" data-mode="general" onclick="setCoachingMode('general',this)">🌐 Général</button>
        <button class="coaching-mode-btn ${_coachingMode==='ligue_jcj'?'active':''}" data-mode="ligue_jcj" onclick="setCoachingMode('ligue_jcj',this)">🏆 Ligue JCJ</button>
        <button class="coaching-mode-btn ${_coachingMode==='event_ia'?'active':''}" data-mode="event_ia" onclick="setCoachingMode('event_ia',this)">🤖 Évènement IA</button>
        <button class="coaching-mode-btn ${_coachingMode==='my_league'?'active':''}" data-mode="my_league" onclick="setCoachingMode('my_league',this)">⚽ My League</button>
      </div>
      <div id="coaching-result">${coachingHistory.length > 0 && !_coachingResult ? renderCoachingText(coachingHistory[0].text) : ''}</div>
      ${hasHistory ? '<div id="coaching-history" class="hidden" style="margin-top:10px"><div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.6px">Conseils précédents</div></div>' : '<div id="coaching-history" class="hidden"></div>'}
    </div>
    <div class="coaching-block" style="border-color:#10b981">
      <div class="coaching-header" style="margin-bottom:8px">
        <div>
          <div class="coaching-title" style="color:#10b981">💬 Chat tactique</div>
          <div class="coaching-subtitle">Pose tes questions à Llama — il connaît tes stats</div>
        </div>
        <button class="btn-icon" onclick="clearGeminiChat()" title="Effacer la conversation"><i class="ti ti-trash" style="font-size:12px"></i></button>
      </div>
      <div id="gemini-messages" style="display:flex;flex-direction:column;gap:8px;max-height:320px;overflow-y:auto;margin-bottom:10px;padding:2px"></div>
      <div style="display:flex;gap:6px">
        <input type="text" id="gemini-input" class="form-input form-input-sm" placeholder="Ex: Pourquoi je perds en Ligue JCJ ?" style="flex:1" onkeydown="if(event.key==='Enter')sendChatMessage()">
        <button class="btn-sm btn-primary" onclick="sendChatMessage()" id="btn-gemini-send" style="background:#10b981;border-color:#10b981">Envoyer</button>
      </div>
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
  const byFormHtml = byForm.filter(f => f.formation !== 'Inconnue').length === 0 ? '' : `
    <div class="an-section">
      <div class="an-section-title"><i class="ti ti-layout-soccer-field"></i> Par formation</div>
      <div class="an-table">
        ${byForm.filter(f => f.formation !== 'Inconnue').map(f => `
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
  const byBuildFiltered = byBuild.filter(b => b.matchCount >= 1);
  const byBuildHtml = byBuild.length === 0 ? '' : `
    <div class="an-section">
      <div class="an-section-title"><i class="ti ti-sliders"></i> Performance par build <span style="font-size:10px;color:var(--muted);font-weight:400">(⚠ < 3 matchs = données insuffisantes)</span></div>
      <div class="an-table">
        ${byBuildFiltered.length === 0
          ? '<div style="font-size:12px;color:var(--muted);padding:8px">Aucun match enregistré avec un build</div>'
          : byBuildFiltered.slice(0, 10).map(b => {
          const build = Object.values(State.builds).flat().find(x => x.id === b.build_id);
          const card  = build ? Object.values(State.cards).flat().find(c => c.id === build.card_id) : null;
          const playerObj = card ? State.players.find(p => p.id === card.player_id) : null;
          const buildName  = build  ? build.name  : '—';
          const playerName = playerObj ? playerObj.name : '—';
          const lowData = b.matchCount < 3;
          return `
          <div class="an-row an-row-build" style="${lowData ? 'opacity:0.7' : ''}">
            <div class="an-row-build-info">
              <span class="an-row-label">${buildName}${lowData ? ' <span style="font-size:9px;color:var(--amber)">⚠ ' + b.matchCount + 'J</span>' : ''}</span>
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
          <div class="an-players-col-title">🧤 Top arrêts GK</div>
          ${[...byPlayer].sort((a,b) => b.saves - a.saves).filter(p => p.saves > 0).slice(0, 5).map((p, i) => {
            const player = State.players.find(x => x.id === p.player_id);
            const cards = State.cards[p.player_id] || [];
            const pos = cards[0]?.efhub_stats?.position || '';
            const isGK = pos === 'GK';
            return `<div class="an-player-row">
              <span class="an-player-rank">${i+1}</span>
              <span class="an-player-name">${player ? player.name : '?'}${isGK ? '' : ' <span style="font-size:9px;color:var(--muted)">('+pos+')</span>'}</span>
              <span class="an-player-val">🧤 ${p.saves}</span>
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

  // ── Comparaison de périodes ──
  const comparisonHtml = renderComparisonSection(matches);

  // ── Instructions individuelles ──
  const instrColors = {
    'Anchoring': '#60a5fa', 'Defensive': '#34d399', 'Attacking': '#f59e0b',
    'Tight Marking': '#a78bfa', 'Man Marking': '#f87171', 'Counter Target': '#fb923c',
    'Deep Line': '#38bdf8',
  };
  // ── Performance défensive ──
  const defHtml = byDef.length === 0 ? '' : `
    <div class="an-section">
      <div class="an-section-title"><i class="ti ti-shield"></i> Performance défensive <span style="font-size:10px;color:var(--muted);font-weight:400">(min. 3 matchs)</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;padding:6px 10px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;background:var(--surface3);border-radius:8px 8px 0 0">
        <span>Joueur</span>
        <span style="text-align:center">🧹 Clean sheets</span>
        <span style="text-align:center">🏆 Victoires</span>
      </div>
      <div class="an-table" style="border-radius:0 0 8px 8px;overflow:hidden">
        ${byDef.slice(0, 10).map(d => {
          const player = State.players.find(p => p.id === d.player_id);
          const cards = State.cards[d.player_id] || [];
          const card = cards[0];
          const pos = card?.efhub_stats?.position || '';
          const efhubId = player ? Efhub.parseId(player.efhub_url || '') : null;
          const imgUrl = efhubId ? Efhub.imgUrl(efhubId) : null;
          const csColor = d.cleanSheetRate >= 50 ? '#34d399' : d.cleanSheetRate >= 30 ? '#f59e0b' : 'var(--muted)';
          const wrColor = d.winRate >= 60 ? '#34d399' : d.winRate >= 40 ? '#f59e0b' : '#f87171';
          return `
          <div class="an-row" style="gap:8px">
            ${imgUrl ? `<img src="${imgUrl}" style="width:22px;height:28px;border-radius:3px;object-fit:cover;flex-shrink:0" onerror="this.style.display='none'">` : ''}
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:5px">
                <span style="font-size:10px;color:var(--accent);font-weight:700">${pos}</span>
                <span style="font-size:12px;font-weight:600">${player ? player.name : '?'}</span>
              </div>
              <div style="font-size:10px;color:var(--muted)">${d.matches} matchs · ${d.avgGoalsAgainst} buts enc./match · ★ ${d.avgRating || '—'}</div>
            </div>
            <div style="text-align:center;min-width:70px">
              <div style="font-size:14px;font-weight:700;color:${csColor}">${d.cleanSheetRate}%</div>
              <div style="font-size:10px;color:var(--muted)">${d.cleanSheets}/${d.matches}</div>
            </div>
            <div style="text-align:center;min-width:70px">
              <div style="font-size:14px;font-weight:700;color:${wrColor}">${d.winRate}%</div>
              <div style="font-size:10px;color:var(--muted)">${d.wins}/${d.matches}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

  const instrHtml = byInstr.length === 0 ? '' : `
    <div class="an-section">
      <div class="an-section-title"><i class="ti ti-list-details"></i> Instructions individuelles <span style="font-size:10px;color:var(--muted);font-weight:400">(min. 3 matchs)</span></div>
      <div class="an-table">
        ${byInstr.map(c => {
          const player = State.players.find(p => p.id === c.player_id);
          const cards = State.cards[c.player_id] || [];
          const card = cards[0];
          const pos = card?.efhub_stats?.position || '';
          const color = instrColors[c.instruction] || 'var(--accent)';
          const efhubId = player ? Efhub.parseId(player.efhub_url || '') : null;
          const imgUrl = efhubId ? Efhub.imgUrl(efhubId) : null;
          return `
          <div class="an-row" style="gap:8px">
            ${imgUrl ? `<img src="${imgUrl}" style="width:22px;height:28px;border-radius:3px;object-fit:cover;flex-shrink:0" onerror="this.style.display='none'">` : ''}
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <span style="font-size:10px;color:var(--accent);font-weight:700">${pos}</span>
                <span class="an-row-label">${player ? player.name : '?'}</span>
                <span style="font-size:10px;padding:1px 7px;border-radius:10px;background:${color}22;color:${color};font-weight:600">${c.instruction}</span>
              </div>
              <div style="font-size:10px;color:var(--muted);margin-top:2px">${c.total} matchs · ⚽ ${c.avgGoalsFor}/match · 🔒 ${c.avgGoalsAgainst}/match</div>
            </div>
            ${winBar(c.wins, c.total - c.wins - (c.total - c.wins), c.total - c.wins, c.total)}
            <span class="an-row-pct">${c.winRate}%</span>
          </div>`;
        }).join('')}
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
      ${comparisonHtml}
      ${defHtml}
      ${instrHtml}
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

function renderComparisonSection(matches) {
  if (matches.length < 2) return '';
  var q = String.fromCharCode(39);

  return `
    <div class="an-section" id="comparison-section">
      <div class="an-section-title"><i class="ti ti-arrows-diff"></i> Comparaison de périodes</div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <div style="flex:1;min-width:140px">
          <div style="font-size:10px;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Mode</div>
          <select id="comp-mode" class="form-input form-input-sm" onchange="updateComparison()">
            <option value="n_matchs">Derniers N matchs</option>
            <option value="par_date">Par date</option>
          </select>
        </div>
      </div>

      <div id="comp-n-matchs">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
          <label style="font-size:11px;color:var(--muted)">Comparer les derniers</label>
          <select id="comp-n" class="form-input form-input-sm" onchange="updateComparison()" style="width:80px">
            <option value="5">5</option>
            <option value="10" selected>10</option>
            <option value="15">15</option>
            <option value="20">20</option>
          </select>
          <label style="font-size:11px;color:var(--muted)">matchs vs les</label>
          <select id="comp-n" class="form-input form-input-sm" onchange="updateComparison()" style="width:80px;display:none"></select>
          <label style="font-size:11px;color:var(--muted)">précédents</label>
        </div>
      </div>

      <div id="comp-par-date" style="display:none">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <div style="flex:1;min-width:120px">
            <div style="font-size:10px;color:var(--muted);margin-bottom:4px">Période A — du</div>
            <div style="display:flex;gap:4px">
              <input type="date" id="comp-a-start" class="form-input form-input-sm" onchange="updateComparison()" style="flex:1">
              <input type="date" id="comp-a-end" class="form-input form-input-sm" onchange="updateComparison()" style="flex:1">
            </div>
          </div>
          <div style="flex:1;min-width:120px">
            <div style="font-size:10px;color:var(--muted);margin-bottom:4px">Période B — du</div>
            <div style="display:flex;gap:4px">
              <input type="date" id="comp-b-start" class="form-input form-input-sm" onchange="updateComparison()" style="flex:1">
              <input type="date" id="comp-b-end" class="form-input form-input-sm" onchange="updateComparison()" style="flex:1">
            </div>
          </div>
        </div>
      </div>

      <div id="comp-result"></div>
    </div>
  `;
}

function updateComparison() {
  var mode = document.getElementById('comp-mode')?.value || 'n_matchs';
  var nWrap = document.getElementById('comp-n-matchs');
  var dateWrap = document.getElementById('comp-par-date');
  if (nWrap) nWrap.style.display = mode === 'n_matchs' ? '' : 'none';
  if (dateWrap) dateWrap.style.display = mode === 'par_date' ? '' : 'none';

  var matches = filterStatsMatches(State.matches);
  var periodA, periodB, labelA, labelB;

  if (mode === 'n_matchs') {
    var n = parseInt(document.getElementById('comp-n')?.value) || 10;
    if (matches.length < n * 2) {
      document.getElementById('comp-result').innerHTML =
        '<div style="font-size:12px;color:var(--muted);padding:8px">Pas assez de matchs — il faut au moins ' + (n * 2) + ' matchs pour cette comparaison.</div>';
      return;
    }
    periodA = matches.slice(0, n);
    periodB = matches.slice(n, n * 2);
    labelA = 'Derniers ' + n + ' matchs';
    labelB = n + ' matchs précédents';
  } else {
    var aStart = document.getElementById('comp-a-start')?.value;
    var aEnd = document.getElementById('comp-a-end')?.value;
    var bStart = document.getElementById('comp-b-start')?.value;
    var bEnd = document.getElementById('comp-b-end')?.value;
    if (!aStart || !aEnd || !bStart || !bEnd) {
      document.getElementById('comp-result').innerHTML =
        '<div style="font-size:12px;color:var(--muted);padding:8px">Sélectionne les deux périodes.</div>';
      return;
    }
    periodA = matches.filter(function(m) {
      var d = m.match_date || m.played_at?.substring(0,10);
      return d >= aStart && d <= aEnd;
    });
    periodB = matches.filter(function(m) {
      var d = m.match_date || m.played_at?.substring(0,10);
      return d >= bStart && d <= bEnd;
    });
    labelA = 'Période A (' + aStart + ' → ' + aEnd + ')';
    labelB = 'Période B (' + bStart + ' → ' + bEnd + ')';
  }

  var sA = Analyse.globalStats(periodA);
  var sB = Analyse.globalStats(periodB);

  function diff(a, b) {
    var d = a - b;
    var color = d > 0 ? '#34d399' : d < 0 ? '#f87171' : 'var(--muted)';
    var sign = d > 0 ? '+' : '';
    return '<span style="font-size:10px;color:' + color + ';margin-left:4px">' + sign + d + '</span>';
  }

  var rows = [
    { label: 'Matchs', a: sA.total, b: sB.total, nodiff: true },
    { label: 'Victoires', a: sA.wins, b: sB.wins },
    { label: 'Nuls', a: sA.draws, b: sB.draws, invert: true },
    { label: 'Défaites', a: sA.losses, b: sB.losses, invert: true },
    { label: '% Victoires', a: sA.winRate + '%', b: sB.winRate + '%', da: sA.winRate, db: sB.winRate },
    { label: 'Buts marqués', a: sA.goalsFor, b: sB.goalsFor },
    { label: 'Buts encaissés', a: sA.goalsAgainst, b: sB.goalsAgainst, invert: true },
  ];

  var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">';
  html += '<div style="background:var(--surface3);border-radius:8px;padding:8px 10px;border-left:2px solid var(--accent)"><div style="font-size:11px;font-weight:700;color:var(--accent);margin-bottom:4px">📊 ' + labelA + '</div>';
  html += '<div style="font-size:20px;font-weight:800;color:#34d399">' + sA.winRate + '%</div><div style="font-size:10px;color:var(--muted)">' + sA.wins + 'V · ' + sA.draws + 'N · ' + sA.losses + 'D · ' + sA.total + ' matchs</div></div>';
  html += '<div style="background:var(--surface3);border-radius:8px;padding:8px 10px;border-left:2px solid #6366f1"><div style="font-size:11px;font-weight:700;color:#6366f1;margin-bottom:4px">📊 ' + labelB + '</div>';
  html += '<div style="font-size:20px;font-weight:800;color:#34d399">' + sB.winRate + '%</div><div style="font-size:10px;color:var(--muted)">' + sB.wins + 'V · ' + sB.draws + 'N · ' + sB.losses + 'D · ' + sB.total + ' matchs</div></div>';
  html += '</div>';

  html += '<div style="background:var(--surface3);border-radius:8px;overflow:hidden">';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;padding:6px 10px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid var(--border)">';
  html += '<span>Stat</span><span style="text-align:center;color:var(--accent)">' + labelA.split(' ')[0] + ' A</span><span style="text-align:center;color:#6366f1">' + labelB.split(' ')[0] + ' B</span></div>';
  rows.forEach(function(row) {
    var da = typeof row.da !== 'undefined' ? row.da : (typeof row.a === 'number' ? row.a : 0);
    var db = typeof row.db !== 'undefined' ? row.db : (typeof row.b === 'number' ? row.b : 0);
    var d = da - db;
    var color = row.nodiff ? 'var(--muted)' : (row.invert ? (d < 0 ? '#34d399' : d > 0 ? '#f87171' : 'var(--muted)') : (d > 0 ? '#34d399' : d < 0 ? '#f87171' : 'var(--muted)'));
    var sign = d > 0 ? '+' : '';
    var diffStr = row.nodiff ? '' : '<span style="font-size:10px;color:' + color + '">' + sign + d + '</span>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;padding:6px 10px;font-size:12px;border-bottom:0.5px solid var(--border)">';
    html += '<span style="color:var(--muted)">' + row.label + '</span>';
    html += '<span style="text-align:center;font-weight:600">' + row.a + ' ' + (d !== 0 && !row.nodiff ? diffStr : '') + '</span>';
    html += '<span style="text-align:center;font-weight:600">' + row.b + '</span>';
    html += '</div>';
  });
  html += '</div>';

  document.getElementById('comp-result').innerHTML = html;
}

// ── Onglet Matchs global ──────────────────────────────────────────────────────
var _matchsPage = 1;
var MATCHS_PER_PAGE = 50;

var _matchsFilters = {
  search: '', result: '', type: '', status: '', coach: '', formation: ''
};

function applyMatchsFilters() {
  _matchsPage = 1;
  var f = _matchsFilters;
  f.search   = (document.getElementById('mf-search')?.value || '').toLowerCase();
  f.result   = document.getElementById('mf-result')?.value || '';
  f.type     = document.getElementById('mf-type')?.value || '';
  f.status   = document.getElementById('mf-status')?.value || '';
  f.coach    = document.getElementById('mf-coach')?.value || '';
  f.formation= document.getElementById('mf-formation')?.value || '';

  var filtered = getFilteredMatchs();
  var container = document.getElementById('match-list-container');
  var countEl = document.getElementById('mf-count');
  var moreEl = document.getElementById('mf-more-wrap');
  if (!container) return;

  container.innerHTML = filtered.length === 0
    ? '<div class="empty-state"><p>Aucun match trouvé</p></div>'
    : filtered.slice(0, _matchsPage * MATCHS_PER_PAGE).map(function(m) { return renderMatchRow(m); }).join('');

  if (countEl) countEl.textContent = filtered.length + ' match' + (filtered.length > 1 ? 's' : '');
  if (moreEl) {
    var shown = Math.min(_matchsPage * MATCHS_PER_PAGE, filtered.length);
    if (shown < filtered.length) {
      moreEl.innerHTML = '<button class="btn-sm btn-ghost" onclick="loadMoreMatchs()" id="btn-load-more"><i class="ti ti-chevrons-down"></i> Voir plus (' + (filtered.length - shown) + ' restants)</button>';
    } else {
      moreEl.innerHTML = '';
    }
  }

  // Bouton reset
  var hasFilter = f.search || f.result || f.type || f.status || f.coach || f.formation;
  var resetBtn = document.getElementById('mf-reset');
  if (resetBtn) resetBtn.style.display = hasFilter ? '' : 'none';
}

function getFilteredMatchs() {
  var f = _matchsFilters;
  return State.matches.filter(function(m) {
    if (f.search && !(
      (m.opp_name || '').toLowerCase().includes(f.search) ||
      (m.formation || '').toLowerCase().includes(f.search)
    )) return false;
    if (f.result && m.result !== f.result) return false;
    if (f.type && m.match_type !== f.type) return false;
    if (f.status) {
      var ms = m.match_status || 'termine';
      if (ms !== f.status) return false;
    }
    if (f.coach && m.coach_id !== f.coach) return false;
    if (f.formation && (m.formation || '').toLowerCase() !== f.formation.toLowerCase()) return false;
    return true;
  });
}

function resetMatchsFilters() {
  _matchsFilters = { search:'', result:'', type:'', status:'', coach:'', formation:'' };
  ['mf-search','mf-result','mf-type','mf-status','mf-coach','mf-formation'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  applyMatchsFilters();
}

function renderMatchsGlobal() {
  var q = String.fromCharCode(39);
  var allMatches = State.matches;
  var total = allMatches.length;
  var filtered = getFilteredMatchs();
  var paginated = filtered.slice(0, _matchsPage * MATCHS_PER_PAGE);
  var hasMore = paginated.length < filtered.length;
  var hasFilter = _matchsFilters.search || _matchsFilters.result || _matchsFilters.type ||
    _matchsFilters.status || _matchsFilters.coach || _matchsFilters.formation;

  // Options coaches
  var coachOptions = '<option value="">Tous les coachs</option>' +
    State.coaches.map(function(c) {
      return '<option value="' + c.id + '"' + (_matchsFilters.coach === c.id ? ' selected' : '') + '>' + c.name + '</option>';
    }).join('');

  // Formations uniques
  var formations = [...new Set(State.matches.map(function(m) { return m.formation; }).filter(Boolean))].sort();
  var formationOptions = '<option value="">Toutes les formations</option>' +
    formations.map(function(f) {
      return '<option value="' + f + '"' + (_matchsFilters.formation === f ? ' selected' : '') + '>' + f + '</option>';
    }).join('');

  return `
    <div class="matchs-page">
      <div class="matchs-page-header">
        <span id="mf-count">${filtered.length} match${filtered.length > 1 ? 's' : ''}</span>
        <button class="btn-sm btn-primary" onclick="openModal('addMatch',null)">+ Enregistrer</button>
      </div>

      <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
        <div style="display:flex;gap:6px">
          <input type="text" id="mf-search" class="form-input form-input-sm" placeholder="🔍 Rechercher adversaire, formation..." value="${_matchsFilters.search}" oninput="applyMatchsFilters()" style="flex:1">
          <button id="mf-reset" class="btn-sm btn-ghost" onclick="resetMatchsFilters()" style="display:${hasFilter ? '' : 'none'}">✕ Reset</button>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <select id="mf-result" class="form-input form-input-sm" onchange="applyMatchsFilters()" style="flex:1;min-width:80px">
            <option value="">V/N/D</option>
            <option value="V" ${_matchsFilters.result==='V'?'selected':''}>✅ Victoire</option>
            <option value="N" ${_matchsFilters.result==='N'?'selected':''}>🟡 Nul</option>
            <option value="D" ${_matchsFilters.result==='D'?'selected':''}>❌ Défaite</option>
          </select>
          <select id="mf-type" class="form-input form-input-sm" onchange="applyMatchsFilters()" style="flex:1;min-width:110px">
            <option value="">Tous types</option>
            <option value="ligue_jcj_d1" ${_matchsFilters.type==='ligue_jcj_d1'?'selected':''}>🏆 JCJ D1</option>
            <option value="ligue_jcj_d2" ${_matchsFilters.type==='ligue_jcj_d2'?'selected':''}>🏆 JCJ D2</option>
            <option value="ligue_jcj_d3" ${_matchsFilters.type==='ligue_jcj_d3'?'selected':''}>🏆 JCJ D3</option>
            <option value="ligue_ia_d1" ${_matchsFilters.type==='ligue_ia_d1'?'selected':''}>🤖 IA D1</option>
            <option value="ligue_ia_d2" ${_matchsFilters.type==='ligue_ia_d2'?'selected':''}>🤖 IA D2</option>
            <option value="ligue_ia_d3" ${_matchsFilters.type==='ligue_ia_d3'?'selected':''}>🤖 IA D3</option>
            <option value="event_ia" ${_matchsFilters.type==='event_ia'?'selected':''}>🎯 Évènement IA</option>
            <option value="event_jcj" ${_matchsFilters.type==='event_jcj'?'selected':''}>🎯 Évènement JCJ</option>
            <option value="amical" ${_matchsFilters.type==='amical'?'selected':''}>🤝 Amical</option>
            <option value="my_league" ${_matchsFilters.type==='my_league'?'selected':''}>⚽ My League</option>
          </select>
          <select id="mf-status" class="form-input form-input-sm" onchange="applyMatchsFilters()" style="flex:1;min-width:110px">
            <option value="">Tous statuts</option>
            <option value="termine" ${_matchsFilters.status==='termine'?'selected':''}>✅ Terminé</option>
            <option value="abandon_adverse" ${_matchsFilters.status==='abandon_adverse'?'selected':''}>🚪 Abandon</option>
            <option value="interrompu_reseau" ${_matchsFilters.status==='interrompu_reseau'?'selected':''}>🔌 Interrompu</option>
          </select>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <select id="mf-coach" class="form-input form-input-sm" onchange="applyMatchsFilters()" style="flex:1">${coachOptions}</select>
          <select id="mf-formation" class="form-input form-input-sm" onchange="applyMatchsFilters()" style="flex:1">${formationOptions}</select>
        </div>
      </div>

      <div class="match-list" id="match-list-container">
        ${filtered.length === 0
          ? '<div class="empty-state"><p>Aucun match trouvé</p></div>'
          : paginated.map(m => renderMatchRow(m)).join('')}
      </div>
      <div id="mf-more-wrap" style="text-align:center;padding:12px 0">
        ${hasMore ? `<button class="btn-sm btn-ghost" onclick="loadMoreMatchs()" id="btn-load-more">
          <i class="ti ti-chevrons-down"></i> Voir plus (${filtered.length - paginated.length} restants)
        </button>` : ''}
      </div>
    </div>
  `;
}

function loadMoreMatchs() {
  _matchsPage++;
  var container = document.getElementById('match-list-container');
  var btn = document.getElementById('btn-load-more');
  if (!container) return;

  var filtered = getFilteredMatchs();
  var start = (_matchsPage - 1) * MATCHS_PER_PAGE;
  var newMatches = filtered.slice(start, _matchsPage * MATCHS_PER_PAGE);
  container.insertAdjacentHTML('beforeend', newMatches.map(function(m) { return renderMatchRow(m); }).join(''));

  var shown = Math.min(_matchsPage * MATCHS_PER_PAGE, filtered.length);
  var moreEl = document.getElementById('mf-more-wrap');
  if (moreEl) {
    if (shown < filtered.length) {
      moreEl.innerHTML = '<button class="btn-sm btn-ghost" onclick="loadMoreMatchs()" id="btn-load-more"><i class="ti ti-chevrons-down"></i> Voir plus (' + (filtered.length - shown) + ' restants)</button>';
    } else {
      moreEl.innerHTML = '';
    }
  }
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
    setTimeout(applyLastInstructions, 80);
  }
  if (type === 'editMatch')  container.innerHTML = renderModalEditMatch(id);
  if (type === 'addCoach')   container.innerHTML = renderModalAddCoach();
  if (type === 'editCoach')  container.innerHTML = renderModalEditCoach(id);
}

function closeModal() {
  clearMatchDraft();
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-container').classList.add('hidden');
  var mini = document.getElementById('match-modal-mini');
  if (mini) mini.remove();
}

function minimizeMatchModal() {
  // Cacher overlay + container
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-container').classList.add('hidden');

  // Créer mini barre flottante si pas déjà là
  if (document.getElementById('match-modal-mini')) return;
  var mini = document.createElement('div');
  mini.id = 'match-modal-mini';
  mini.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:9999;background:var(--surface2);border:1px solid var(--accent);border-radius:12px;padding:8px 14px;display:flex;align-items:center;gap:10px;box-shadow:0 4px 20px rgba(0,0,0,0.5);cursor:pointer';
  var result = document.getElementById('m-match-result') ? document.getElementById('m-match-result').value : '';
  var scoreFor = document.getElementById('m-score-for') ? document.getElementById('m-score-for').value : '0';
  var scoreAgainst = document.getElementById('m-score-against') ? document.getElementById('m-score-against').value : '0';
  var scoreLabel = scoreFor + ' – ' + scoreAgainst;
  mini.innerHTML =
    '<i class="ti ti-ball-football" style="color:var(--accent);font-size:16px"></i>' +
    '<span style="font-size:12px;font-weight:600;color:#fff">Match en cours — ' + scoreLabel + '</span>' +
    '<button class="btn-icon" onclick="restoreMatchModal()" title="Agrandir" style="margin-left:4px"><i class="ti ti-arrows-maximize"></i></button>';
  mini.onclick = function(e) { if (e.target.closest('button')) return; restoreMatchModal(); };
  document.body.appendChild(mini);
}

function restoreMatchModal() {
  var mini = document.getElementById('match-modal-mini');
  if (mini) mini.remove();
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-container').classList.remove('hidden');
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

function resolveBuildId(player_id, card_id, squad23BuildId) {
  // Priorité 1 : build sélectionné dans le Squad 23
  if (squad23BuildId) return squad23BuildId;
  // Priorité 2 : build actif dans State (sélectionné dans l'effectif)
  var builds = card_id ? (State.builds[card_id] || []) : [];
  if (builds.length > 0) return builds[0].id; // premier build par défaut
  return null;
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
        return { player_id: t.player_id, card_id: card_id, build_id: resolveBuildId(t.player_id, card_id, sq2 ? sq2.build_id : null) };
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
        return { player_id: t.player_id, card_id: card_id, build_id: resolveBuildId(t.player_id, card_id, sq2 ? sq2.build_id : null) };
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
      return { player_id: sel.player_id, card_id: sel.card_id, build_id: resolveBuildId(sel.player_id, sel.card_id, sq ? sq.build_id : null) };
    });
    _matchRemplacants = (saved.remplacants || []).filter(function(s) {
      return allPids2.includes(s.player_id);
    }).map(function(sel) {
      var sq = _squad23.find(function(s) { return s.player_id === sel.player_id; });
      return { player_id: sel.player_id, card_id: sel.card_id, build_id: resolveBuildId(sel.player_id, sel.card_id, sq ? sq.build_id : null) };
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

function saveCustomFormation(name, slots, notes) {
  try {
    var customs = loadCustomFormations();
    // Stocker comme layout plat : [{left, top, label}]
    customs[name] = { slots: slots, custom: true, notes: notes || '' };
    localStorage.setItem(CUSTOM_FORMATIONS_KEY, JSON.stringify(customs));
    // Injecter dans FORMATION_LAYOUTS pour utilisation immédiate
    injectCustomFormation(name, slots);
  } catch(e) {}
}

function deleteCustomFormation(name) {
  try {
    var customs = loadCustomFormations();
    delete customs[name];
    localStorage.setItem(CUSTOM_FORMATIONS_KEY, JSON.stringify(customs));
    delete FORMATION_LAYOUTS[name];
    delete POSITION_LABELS_BY_FORMATION[name];
  } catch(e) {}
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
  var customs = isCustom ? loadCustomFormations() : {};
  var customData = customs[name] || {};
  var notes = customData.notes || '';
  return '<div class="fmpicker-card" onclick="selectFormation(' + q + name.replace(/'/g,"\\'") + q + ')">' +
    miniSvg +
    '<div class="fmpicker-card-name">' + name + (isCustom ? ' <span class="badge-custom">Perso</span>' : '') + '</div>' +
    (notes ? '<div style="font-size:9px;color:var(--text-secondary);padding:2px 4px;line-height:1.3;max-height:36px;overflow:hidden">' + notes.substring(0, 80) + (notes.length > 80 ? '...' : '') + '</div>' : '') +
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
  showConfirm('Supprimer la formation "' + name + '" ?', function() {
    deleteCustomFormation(name);
    closeFmPicker();
    openFormationPicker();
  });
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
    showToast('Nom réservé — choisis un autre nom', 'warning', 4000);
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

var MATCH_DRAFT_KEY = 'efb_match_draft';
var _matchDraftInterval = null;
var _matchRestoringDraft = false;

function saveMatchDraft() {
  try {
    saveMatchFormState();
    var draft = {
      savedAt: new Date().toISOString(),
      formState: _matchFormState,
      summaryState: _matchSummaryState,
      playerStats: _matchPlayerStats,
      subs: _matchSubs,
      titulaires: _matchTitulaires,
      remplacants: _matchRemplacants,
      lastFormation: _matchLastFormation,
    };
    localStorage.setItem(MATCH_DRAFT_KEY, JSON.stringify(draft));
  } catch(e) {}
}

function loadMatchDraft() {
  try {
    var raw = localStorage.getItem(MATCH_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

function clearMatchDraft() {
  localStorage.removeItem(MATCH_DRAFT_KEY);
  if (_matchDraftInterval) { clearInterval(_matchDraftInterval); _matchDraftInterval = null; }
}

function startMatchDraftAutosave(keepExisting) {
  if (!keepExisting) clearMatchDraft();
  if (_matchDraftInterval) clearInterval(_matchDraftInterval);
  _matchDraftInterval = setInterval(saveMatchDraft, 5000);
}

function checkMatchDraftOnLoad() {
  var draft = loadMatchDraft();
  if (!draft) return;
  var savedAt = new Date(draft.savedAt);
  var date = savedAt.toLocaleDateString('fr-FR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
  var score = (draft.formState['m-score-for'] || '0') + '-' + (draft.formState['m-score-against'] || '0');
  var opp = draft.formState['m-opp-name'] || 'match sans nom';

  var banner = document.createElement('div');
  banner.id = 'draft-banner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#1e3a5f;border-bottom:2px solid var(--accent);padding:10px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px';
  banner.innerHTML =
    '<div style="font-size:12px;color:#fff"><strong>⚡ Match interrompu trouvé</strong> — ' + date + ' · Score : ' + score + ' vs ' + opp + '</div>' +
    '<div style="display:flex;gap:8px">' +
      '<button class="btn-sm btn-primary" onclick="restoreMatchDraft()">Reprendre</button>' +
      '<button class="btn-sm btn-ghost" onclick="dismissMatchDraft()">Ignorer</button>' +
    '</div>';
  document.body.prepend(banner);
}

function restoreMatchDraft() {
  var draft = loadMatchDraft();
  if (!draft) return;
  var banner = document.getElementById('draft-banner');
  if (banner) banner.remove();

  // Restaurer l'état
  _matchRestoringDraft = true;
  _matchFormState = draft.formState || {};
  _matchSummaryState = draft.summaryState || {};
  _matchPlayerStats = draft.playerStats || {};
  _matchSubs = draft.subs || [];
  _matchTitulaires = draft.titulaires || [];
  _matchRemplacants = draft.remplacants || [];
  _matchLastFormation = draft.lastFormation || '';
  _matchActiveTab = 'match';

  // Ouvrir le modal
  openModal('addMatch', null);
  setTimeout(function() {
    restoreMatchFormState();
    _matchRestoringDraft = false;
    startMatchDraftAutosave(true);
    saveMatchDraft();
    showToast('Match restauré !', 'success');
  }, 100);
}

function dismissMatchDraft() {
  clearMatchDraft();
  var banner = document.getElementById('draft-banner');
  if (banner) banner.remove();
}

function renderModalAddMatch(buildId) {
  if (!_matchRestoringDraft) {
    _matchPlayerStats = {};
    _matchSubs = [];
    _matchActiveTab = 'match';
    _matchFormState = {};
    _matchSummaryState = {};
    _pitchSelectedPid = null;
    _pitchSelectedSlot = null;
    _pitchSubMode = false;
    _pitchSubOutPid = null;
    loadSquad23IntoLineup();
    initMatchPlayerStatsFromLineup();
    setTimeout(applyLastInstructions, 80);
    startMatchDraftAutosave();
  }

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

  return '<div class="modal-match-fullscreen">' +
    '<div class="modal-header">' +
      '<h3>Enregistrer un match</h3>' +
      '<div style="display:flex;gap:4px">' +
        '<button class="btn-icon" onclick="minimizeMatchModal()" title="Réduire"><i class="ti ti-minus"></i></button>' +
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

function renderMatchTabContent() {
  if (_matchActiveTab === 'match')  return renderMatchTabMain();
  if (_matchActiveTab === 'resume') return renderMatchTabResume();
  return '';
}

var _matchFormState = {};
var _matchSummaryState = {};

function saveMatchFormState() {
  var ids = [
    'm-score-for','m-score-against','m-match-result','m-opp-name',
    'm-match-type','m-match-rank','m-formation','m-opp-formation',
    'm-coach-id','m-my-rank','m-opp-rank','m-match-date','m-match-time',
    'm-attack1-instruction','m-attack1-target','m-attack2-instruction','m-attack2-target',
    'm-defence1-instruction','m-defence1-target','m-defence2-instruction','m-defence2-target',
    'm-man-of-match','m-note'
  ];
  ids.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) _matchFormState[id] = el.type === 'checkbox' ? el.checked : el.value;
  });
  // Sauvegarder aussi la formation dans _matchLastFormation
  var fm = document.getElementById('m-formation');
  if (fm && fm.value) _matchLastFormation = fm.value;
}

function restoreMatchFormState() {
  Object.keys(_matchFormState).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      if (el.type === 'checkbox') el.checked = _matchFormState[id];
      else el.value = _matchFormState[id];
    }
  });
  // Restaurer le résultat visuel V/N/D
  var result = _matchFormState['m-match-result'];
  if (result) {
    document.querySelectorAll('.result-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.val === result);
    });
  }
  if (typeof autoUpdateResult === 'function') autoUpdateResult();
}

function saveMatchSummaryState() {
  ['m-man-of-match', 'm-note', 'm-match-status'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) _matchSummaryState[id] = el.value;
  });
  var rep = document.getElementById('m-repeated-opponent');
  if (rep) _matchSummaryState['m-repeated-opponent'] = rep.checked;
}

function restoreMatchSummaryState() {
  ['m-man-of-match', 'm-note', 'm-match-status'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el && _matchSummaryState[id] !== undefined) el.value = _matchSummaryState[id];
  });
  var rep = document.getElementById('m-repeated-opponent');
  if (rep && _matchSummaryState['m-repeated-opponent'] !== undefined) {
    rep.checked = _matchSummaryState['m-repeated-opponent'];
  }
}

function switchMatchTab(tab) {
  // Sauvegarder l'état avant de changer d'onglet
  if (_matchActiveTab === 'match') saveMatchFormState();
  if (_matchActiveTab === 'resume') saveMatchSummaryState();
  _matchActiveTab = tab;
  var el = document.getElementById('match-tab-content');
  if (el) el.innerHTML = renderMatchTabContent();
  document.querySelectorAll('.match-modal-tab').forEach(function(b) {
    b.classList.toggle('active', b.textContent.trim() === (tab === 'match' ? 'Match' : 'Résumé'));
  });
  if (tab === 'match') {
    setTimeout(function() {
      restoreMatchFormState();
      applyLastInstructions();
    }, 50);
  }
  if (tab === 'resume') {
    setTimeout(function() {
      restoreMatchSummaryState();
    }, 50);
  }
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
      '<input type="number" id="m-score-for" class="match-score-input" min="0" value="0" oninput="autoUpdateResult();saveMatchFormState()">' +
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
      '<input type="number" id="m-score-against" class="match-score-input" min="0" value="0" oninput="autoUpdateResult();saveMatchFormState()">' +
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
      '<div class="form-group" style="flex:1;display:none" id="m-rank-group"><label>Rang</label><select id="m-match-rank" class="form-input form-input-sm">' +
        EFB_RANKS.map(function(r) { return '<option value="' + r + '">' + r + '</option>'; }).join('') +
      '</select></div>' +
    '</div>' +
    '<div class="mic-row">' +
      '<div class="form-group" style="flex:1"><label>Notre formation</label>' +
        '<div style="display:flex;gap:4px">' +
          '<input type="text" id="m-formation" class="form-input form-input-sm" placeholder="4-3-3" value="' + savedFormation + '" oninput="onFormationInput(this.value)" style="flex:1">' +
          '<button class="btn-sm btn-ghost" onclick="openFormationPicker()" title="Choisir formation" style="padding:4px 8px;flex-shrink:0"><i class="ti ti-ball-football"></i></button>' +
          '<button class="btn-sm btn-ghost" onclick="matchLoadFormationFromFT()" title="Charger depuis onglet Formation" style="padding:4px 8px;flex-shrink:0"><i class="ti ti-download"></i></button>' +
          '<button class="btn-sm btn-ghost" onclick="matchSaveFormationAsDefault()" title="Sauvegarder comme formation par défaut" style="padding:4px 8px;flex-shrink:0"><i class="ti ti-device-floppy"></i></button>' +
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
    '<summary class="match-instructions-summary"><i class="ti ti-list-details"></i> Instructions individuelles' +
    '<button class="btn-sm btn-ghost" style="margin-left:auto;font-size:11px;padding:2px 8px" onclick="event.preventDefault();requestInstructionsIA()" id="btn-instructions-ia"><i class="ti ti-wand"></i> IA</button>' +
    '</summary>' +
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
              // Seulement les joueurs actuellement sur le terrain (titulaires remplacés par entrants)
              var onPitch = _matchTitulaires
                .filter(function(t){ return t && t.player_id; })
                .map(function(t) {
                  var sub = _matchSubs.find(function(s) { return s.out_player_id === t.player_id; });
                  return sub ? sub.in_player_id : t.player_id;
                })
                .filter(function(pid){ return !!pid; });
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

function matchLoadFormationFromFT() {
  // Charger la formation et la composition depuis l'onglet Formation
  try {
    var ftData = JSON.parse(localStorage.getItem(FT_STORAGE_KEY) || 'null');
    if (!ftData || !ftData.formation) {
      showToast('Aucune formation sauvegardée dans l' + String.fromCharCode(39) + 'onglet Formation', 'warning');
      return;
    }
    // Appliquer la formation
    var inp = document.getElementById('m-formation');
    if (inp) { inp.value = ftData.formation; onFormationInput(ftData.formation); }
    // Recharger la composition complète
    loadSquad23IntoLineup();
    refreshPitchStats();
    saveMatchFormState();
    saveMatchDraft();
    showToast('Formation ' + ftData.formation + ' chargée !', 'success');
  } catch(e) {
    showToast('Erreur : ' + e.message, 'error');
  }
}

function matchSaveFormationAsDefault() {
  // Sauvegarder la formation et composition du match comme formation par défaut
  var formation = document.getElementById('m-formation') ? document.getElementById('m-formation').value.trim() : _matchLastFormation;
  if (!formation) { showToast('Aucune formation à sauvegarder', 'warning'); return; }
  try {
    var existing = JSON.parse(localStorage.getItem(FT_STORAGE_KEY) || '{}');
    existing.formation = formation;
    existing.titulaires = _matchTitulaires;
    existing.remplacants = _matchRemplacants;
    localStorage.setItem(FT_STORAGE_KEY, JSON.stringify(existing));
    // Synchroniser aussi avec LINEUP_STORAGE_KEY
    localStorage.setItem(LINEUP_STORAGE_KEY, JSON.stringify({ titulaires: _matchTitulaires, remplacants: _matchRemplacants }));
    showToast('Formation ' + formation + ' sauvegardée comme défaut !', 'success');
  } catch(e) {
    showToast('Erreur : ' + e.message, 'error');
  }
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

    var nodeHtml = '<g class="match-pitch-node" data-slot="' + i + '" onclick="openQuickStatPopup(' + q + titu.player_id + q + ',' + q + activePid + q + ',' + i + ',' + cx + ',' + cy + ')" style="cursor:pointer">';
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

    // Label position — priorité à position_label du titulaire si défini
    var displayLabel = (titu && titu.position_label) ? titu.position_label : slot.label;
    nodeHtml += '<text x="' + cx + '" y="' + (cy+4) + '" text-anchor="middle" font-size="8" font-weight="700" fill="#fff">' + displayLabel + '</text>';

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
function openQuickStatPopup(outPid, activePid, slotIdx, cx, cy) {
  var existing = document.getElementById('quick-stat-popup');
  if (existing) { existing.remove(); if (existing._activePid === activePid) return; }

  var player = State.players.find(function(p){ return p.id === activePid; });
  if (!player) return;
  // S'assurer que les stats sont initialisées
  if (!_matchPlayerStats[activePid]) _matchPlayerStats[activePid] = { goals:0, assists:0, saves:0, yellow_card:false, red_card:false, rating:0 };
  var st = _matchPlayerStats[activePid];
  var titu = _matchTitulaires[slotIdx];
  var card = titu && titu.card_id ? (State.cards[titu.player_id] || []).find(function(c){ return c.id === titu.card_id; }) : null;
  var pos = card ? (card.efhub_stats && card.efhub_stats.position || '') : '';
  var isGK = pos === 'GK';
  var isSub = !!_matchSubs.find(function(s){ return s.out_player_id === outPid; });
  var q = String.fromCharCode(39);

  var posCompatible = {
    'GK':['GK'],'CB':['CB','LB','RB','DMF'],'LB':['LB','RB','CB','LMF'],'RB':['RB','LB','CB','RMF'],
    'DMF':['DMF','CMF','CB'],'CMF':['CMF','DMF','AMF'],'AMF':['AMF','CMF','LMF','RMF'],
    'LMF':['LMF','AMF','LWF'],'RMF':['RMF','AMF','RWF'],'LWF':['LWF','LMF','CF','SS'],
    'RWF':['RWF','RMF','CF','SS'],'CF':['CF','SS','LWF','RWF'],'SS':['SS','CF','AMF']
  };
  var compatible = posCompatible[pos] || [];
  var tituIds = _matchTitulaires.filter(function(t){ return t && t.player_id; }).map(function(t){ return t.player_id; });
  var remps = _matchRemplacants.filter(function(r){ return r && r.player_id && !tituIds.includes(r.player_id); });
  var rempsSorted = remps.slice().sort(function(a,b){
    var cA=(State.cards[a.player_id]||[])[0]; var cB=(State.cards[b.player_id]||[])[0];
    var pA=cA?(cA.efhub_stats&&cA.efhub_stats.position||''):''; var pB=cB?(cB.efhub_stats&&cB.efhub_stats.position||''):'';
    return (compatible.includes(pA)?0:1)-(compatible.includes(pB)?0:1);
  });

  var row1=[4,4.5,5,5.5,6,6.5]; var row2=[7,7.5,8,8.5,9,9.5,10];
  var popup=document.createElement('div');
  popup.id='quick-stat-popup'; popup._activePid=activePid;
  popup.style.cssText='position:fixed;z-index:200000;background:var(--surface);border:1px solid var(--accent);border-radius:10px;padding:10px;box-shadow:0 6px 24px rgba(0,0,0,0.7);min-width:220px;font-size:12px';

  var svgEl=document.querySelector('.match-pitch-svg');
  if(svgEl){
    var sr=svgEl.getBoundingClientRect();
    var px=sr.left+cx*(sr.width/180); var py=sr.top+cy*(sr.height/290);
    popup.style.left=Math.min(Math.max(px-110,8),window.innerWidth-240)+'px';
    popup.style.top=Math.min(py+20,window.innerHeight-300)+'px';
  } else { popup.style.left='50%'; popup.style.top='50%'; popup.style.transform='translate(-50%,-50%)'; }

  var h='';
  h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
  h+='<span style="font-weight:700;color:var(--text)">'+player.name+'</span>';
  h+='<span style="font-size:10px;color:var(--muted)">'+pos+(isSub?' ⇄':'')+'</span>';
  h+='<button onclick="document.getElementById('+q+'quick-stat-popup'+q+').remove()" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;padding:0 0 0 8px">✕</button>';
  h+='</div>';

  h+='<div style="display:flex;gap:8px;margin-bottom:8px">';
  if(isGK){
    h+='<div style="flex:1;text-align:center"><div style="font-size:10px;color:var(--muted)">🧤 Arrêts</div><div style="display:flex;align-items:center;justify-content:center;gap:6px">';
    h+='<button onclick="updateMatchStat('+q+activePid+q+','+q+'saves'+q+',-1)" style="width:26px;height:26px;border-radius:50%;border:1px solid var(--border);background:var(--surface2);cursor:pointer;font-size:16px">−</button>';
    h+='<span id="qsp-saves-'+activePid+'" style="font-weight:700;min-width:20px;text-align:center;font-size:16px">'+(st.saves||0)+'</span>';
    h+='<button onclick="updateMatchStat('+q+activePid+q+','+q+'saves'+q+',1)" style="width:26px;height:26px;border-radius:50%;border:1px solid var(--border);background:var(--surface2);cursor:pointer;font-size:16px">+</button>';
    h+='</div></div>';
  } else {
    h+='<div style="flex:1;text-align:center"><div style="font-size:10px;color:var(--muted)">⚽ Buts</div><div style="display:flex;align-items:center;justify-content:center;gap:6px">';
    h+='<button onclick="updateMatchStat('+q+activePid+q+','+q+'goals'+q+',-1)" style="width:26px;height:26px;border-radius:50%;border:1px solid var(--border);background:var(--surface2);cursor:pointer;font-size:16px">−</button>';
    h+='<span id="qsp-goals-'+activePid+'" style="font-weight:700;min-width:20px;text-align:center;font-size:16px">'+(st.goals||0)+'</span>';
    h+='<button onclick="updateMatchStat('+q+activePid+q+','+q+'goals'+q+',1)" style="width:26px;height:26px;border-radius:50%;border:1px solid var(--border);background:var(--surface2);cursor:pointer;font-size:16px">+</button>';
    h+='</div></div>';
    h+='<div style="flex:1;text-align:center"><div style="font-size:10px;color:var(--muted)">🎯 Passes</div><div style="display:flex;align-items:center;justify-content:center;gap:6px">';
    h+='<button onclick="updateMatchStat('+q+activePid+q+','+q+'assists'+q+',-1)" style="width:26px;height:26px;border-radius:50%;border:1px solid var(--border);background:var(--surface2);cursor:pointer;font-size:16px">−</button>';
    h+='<span id="qsp-assists-'+activePid+'" style="font-weight:700;min-width:20px;text-align:center;font-size:16px">'+(st.assists||0)+'</span>';
    h+='<button onclick="updateMatchStat('+q+activePid+q+','+q+'assists'+q+',1)" style="width:26px;height:26px;border-radius:50%;border:1px solid var(--border);background:var(--surface2);cursor:pointer;font-size:16px">+</button>';
    h+='</div></div>';
  }
  h+='</div>';

  h+='<div style="font-size:10px;color:var(--muted);margin-bottom:4px">⭐ Note</div>';
  var cr=st.rating||0;
  [row1,row2].forEach(function(row){
    h+='<div style="display:flex;gap:3px;margin-bottom:3px">';
    row.forEach(function(n){
      var a=cr===n;
      h+='<button onclick="quickSetRating('+q+activePid+q+','+n+')" style="flex:1;padding:3px 0;border-radius:4px;border:1px solid '+(a?'var(--accent)':'var(--border)')+';background:'+(a?'var(--accent)':'var(--surface2)')+';color:'+(a?'#fff':'var(--text)')+';cursor:pointer;font-size:10px;font-weight:'+(a?'700':'400')+'" id="qsp-note-'+activePid+'-'+(n+'').replace('.','_')+'">'+n+'</button>';
    });
    h+='</div>';
  });

  if(!isSub){
    h+='<div style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px">';
    h+='<div style="font-size:10px;color:var(--muted);margin-bottom:4px">🔄 Remplacer par</div>';
    if(rempsSorted.length===0){
      h+='<div style="font-size:11px;color:var(--muted)">Aucun remplaçant disponible</div>';
    } else {
      h+='<div style="max-height:100px;overflow-y:auto;display:flex;flex-direction:column;gap:3px">';
      rempsSorted.forEach(function(r){
        var rp=State.players.find(function(p){return p.id===r.player_id;});
        var rc=(State.cards[r.player_id]||[])[0];
        var rpos=rc?(rc.efhub_stats&&rc.efhub_stats.position||''):'';
        if(!rp)return;
        var isC=compatible.includes(rpos);
        h+='<button onclick="quickSub('+q+outPid+q+','+q+r.player_id+q+','+slotIdx+')" style="padding:4px 8px;border-radius:5px;border:1px solid '+(isC?'var(--accent)':'var(--border)')+';background:var(--surface2);color:var(--text);cursor:pointer;text-align:left;font-size:11px;display:flex;gap:6px">';
        h+='<span style="color:var(--muted);font-size:10px;min-width:28px">'+rpos+'</span>'+rp.name+'</button>';
      });
      h+='</div>';
      h+='<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:6px">';
      [45,50,55,60,65,70,75,80,85,90].forEach(function(m){
        h+='<button onclick="quickSetSubMinute('+m+')" id="qsp-min-'+m+'" style="flex:1;min-width:28px;padding:3px 0;border-radius:4px;border:1px solid var(--border);background:var(--surface2);color:var(--muted);cursor:pointer;font-size:10px">'+m+String.fromCharCode(39)+'</button>';
      });
      h+='</div>';
    }
    h+='</div>';
  }

  popup.innerHTML=h;
  document.body.appendChild(popup);
  setTimeout(function(){
    document.addEventListener('mousedown',function cp(e){
      var p=document.getElementById('quick-stat-popup');
      if(p&&!p.contains(e.target)){p.remove();document.removeEventListener('mousedown',cp);}
    });
  },100);
}

var _quickSubMinute=60;
function quickSetSubMinute(min){
  _quickSubMinute=min;
  [45,50,55,60,65,70,75,80,85,90].forEach(function(m){
    var b=document.getElementById('qsp-min-'+m);
    if(b){b.style.background=m===min?'var(--accent)':'var(--surface2)';b.style.color=m===min?'#fff':'var(--muted)';}
  });
}

function quickSetRating(pid,val){
  if(!_matchPlayerStats[pid])_matchPlayerStats[pid]={goals:0,assists:0,saves:0,yellow_card:false,red_card:false,rating:0};
  _matchPlayerStats[pid].rating=_matchPlayerStats[pid].rating===val?0:val;
  saveMatchDraft();
  [4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10].forEach(function(n){
    var b=document.getElementById('qsp-note-'+pid+'-'+(n+'').replace('.','_'));
    if(b){var a=_matchPlayerStats[pid].rating===n;b.style.background=a?'var(--accent)':'var(--surface2)';b.style.color=a?'#fff':'var(--text)';b.style.fontWeight=a?'700':'400';b.style.borderColor=a?'var(--accent)':'var(--border)';}
  });
}

function quickSub(outPid,inPid,slotIdx){
  var minute=_quickSubMinute||60;
  _matchSubs.push({out_player_id:outPid,in_player_id:inPid,minute:minute});
  if(!_matchPlayerStats[inPid])_matchPlayerStats[inPid]={goals:0,assists:0,saves:0,yellow_card:false,red_card:false,rating:0};
  _pitchSelectedSlot=null; _pitchSelectedPid=inPid;
  var p=document.getElementById('quick-stat-popup'); if(p)p.remove();
  refreshPitchStats(); saveMatchFormState(); saveMatchDraft();
}

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
  // slotIdx déclaré ici pour usage dans tous les boutons
  var slotIdx = _matchTitulaires.findIndex(function(t) {
    if (!t) return false;
    var sub = _matchSubs.find(function(s) { return s.out_player_id === t.player_id; });
    var activePid = sub ? sub.in_player_id : t.player_id;
    return activePid === pid || t.player_id === pid;
  });
  if (canReplace) {
    html += '<button class="btn-sm btn-ghost ppc-sub-btn" onclick="startPitchSubMode(' + q + pid + q + ')"><i class="ti ti-replace"></i> Remplacer</button>';
  }
  if (!isSub && slotIdx >= 0) {
    html += '<button class="btn-sm btn-ghost ppc-sub-btn" onclick="openSwapPlayerPicker(' + slotIdx + ',this)" title="Changer ce joueur" style="font-size:10px"><i class="ti ti-switch-3"></i></button>';
  }
  if (alreadySub) {
    html += '<button class="btn-sm btn-ghost ppc-sub-btn" style="color:var(--red)" onclick="cancelSub(' + q + pid + q + ')"><i class="ti ti-x"></i> Annuler</button>';
  }
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
  _matchPlayerStats[pid].rating = _matchPlayerStats[pid].rating === val ? 0 : val;
  refreshPitchStats();
  saveMatchDraft();
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

function openSwapPlayerPicker(slotIdx, btn) {
  var existing = document.getElementById('swap-player-picker');
  if (existing) { existing.remove(); return; }
  var rect = btn.getBoundingClientRect();
  var picker = document.createElement('div');
  picker.id = 'swap-player-picker';
  picker.style.cssText = 'position:fixed;z-index:100000;background:var(--surface);border:0.5px solid var(--accent);border-radius:8px;padding:6px;display:flex;flex-direction:column;gap:4px;box-shadow:0 4px 20px rgba(0,0,0,0.6);max-width:220px;max-height:300px;overflow-y:auto';
  picker.style.left = Math.min(rect.left, window.innerWidth - 230) + 'px';
  picker.style.top  = (rect.bottom + 4) + 'px';

  var title = document.createElement('div');
  title.style.cssText = 'font-size:10px;font-weight:700;color:var(--muted);padding:2px 4px;border-bottom:1px solid var(--border);margin-bottom:2px';
  title.textContent = 'Changer le titulaire';
  picker.appendChild(title);

  // Seulement les remplaçants du match actuel
  var tituIds = _matchTitulaires.filter(function(t){ return t && t.player_id; }).map(function(t){ return t.player_id; });
  var playerList = _matchRemplacants
    .filter(function(r){ return r && r.player_id && !tituIds.includes(r.player_id); })
    .map(function(r){
      return State.players.find(function(p){ return p.id === r.player_id; });
    })
    .filter(Boolean);

  if (playerList.length === 0) {
    var empty = document.createElement('div');
    empty.style.cssText = 'font-size:11px;color:var(--muted);padding:6px';
    empty.textContent = 'Aucun joueur disponible';
    picker.appendChild(empty);
  }

  playerList.forEach(function(p) {
    var cards = State.cards[p.id] || [];
    var card = cards[0];
    var pos = card ? (card.efhub_stats && card.efhub_stats.position || '?') : '?';
    var b = document.createElement('button');
    b.style.cssText = 'padding:5px 8px;border-radius:5px;border:0.5px solid var(--border);background:var(--surface3);color:var(--text);font-size:11px;cursor:pointer;text-align:left;display:flex;gap:6px;align-items:center';
    b.innerHTML = '<span style="font-size:9px;color:var(--muted);min-width:28px">' + pos + '</span><span>' + p.name + '</span>';
    b.onmouseenter = function() { b.style.background = 'var(--accent)'; b.style.color = '#fff'; };
    b.onmouseleave = function() { b.style.background = 'var(--surface3)'; b.style.color = 'var(--text)'; };
    b.onclick = function() {
      // Joueur exclu → passe dans les remplaçants
      var oldTitu = _matchTitulaires[slotIdx];
      if (oldTitu && oldTitu.player_id) {
        var oldInRemp = _matchRemplacants.some(function(r){ return r.player_id === oldTitu.player_id; });
        if (!oldInRemp) {
          _matchRemplacants.push({ player_id: oldTitu.player_id, card_id: oldTitu.card_id, build_id: oldTitu.build_id });
        }
      }
      // Nouveau joueur → passe en titulaire
      var newCard = (State.cards[p.id] || [])[0];
      _matchTitulaires[slotIdx] = { player_id: p.id, card_id: newCard ? newCard.id : null, build_id: resolveBuildId(p.id, newCard ? newCard.id : null, null), slot_idx: slotIdx };
      // Retirer le nouveau joueur des remplaçants
      _matchRemplacants = _matchRemplacants.filter(function(r){ return r.player_id !== p.id; });
      if (!_matchPlayerStats[p.id]) _matchPlayerStats[p.id] = { goals:0, assists:0, saves:0, yellow_card:false, red_card:false, rating:0 };
      _pitchSelectedPid = p.id;
      picker.remove();
      refreshPitchStats();
      saveMatchDraft();
    };
    picker.appendChild(b);
  });

  document.body.appendChild(picker);
  setTimeout(function() {
    document.addEventListener('mousedown', function close(e) {
      if (!picker.contains(e.target) && e.target !== btn) { picker.remove(); document.removeEventListener('mousedown', close); }
    });
  }, 100);
}

function openRolePicker(slotIdx, btn) {
  // Supprimer picker existant
  var existing = document.getElementById('role-picker');
  if (existing) { existing.remove(); return; }

  var rect = btn.getBoundingClientRect();
  var picker = document.createElement('div');
  picker.id = 'role-picker';
  picker.style.cssText = 'position:fixed;z-index:100000;background:var(--surface);border:0.5px solid var(--accent);border-radius:8px;padding:6px;display:flex;flex-wrap:wrap;gap:4px;box-shadow:0 4px 20px rgba(0,0,0,0.6);max-width:200px;';
  picker.style.left = Math.min(rect.left, window.innerWidth - 210) + 'px';
  picker.style.top  = (rect.bottom + 4) + 'px';

  ALL_POSITIONS.forEach(function(pos) {
    var b = document.createElement('button');
    b.textContent = pos;
    b.style.cssText = 'padding:4px 10px;border-radius:5px;border:0.5px solid var(--border);background:var(--surface3);color:var(--text);font-size:11px;font-weight:600;cursor:pointer;';
    b.onmouseenter = function() { b.style.background = 'var(--accent)'; b.style.color = '#fff'; };
    b.onmouseleave = function() { b.style.background = 'var(--surface3)'; b.style.color = 'var(--text)'; };
    b.onclick = function() {
      // Mettre à jour POSITION_LABELS_BY_FORMATION
      var currentFormation = (document.getElementById('m-formation') && document.getElementById('m-formation').value)
        ? document.getElementById('m-formation').value : _matchLastFormation;
      if (currentFormation) {
        if (!POSITION_LABELS_BY_FORMATION[currentFormation]) {
          var initSlots = buildPitchSlots(currentFormation);
          if (initSlots) POSITION_LABELS_BY_FORMATION[currentFormation] = initSlots.map(function(s){ return s.label; });
        }
        var labels = POSITION_LABELS_BY_FORMATION[currentFormation];
        if (labels && slotIdx < labels.length) labels[slotIdx] = pos;
      }
      // Mettre à jour position_label dans _matchTitulaires pour renderPitchSVG
      if (_matchTitulaires[slotIdx]) {
        _matchTitulaires[slotIdx].position_label = pos;
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
  '</div>' +
  '<div class="form-group">' +
    '<label>Statut du match</label>' +
    '<select id="m-match-status" class="form-input form-input-sm" onchange="onMatchStatusChange(this.value)">' +
      '<option value="termine">✅ Terminé</option>' +
      '<option value="abandon_adverse">🚪 Abandon adverse (victoire)</option>' +
      '<option value="interrompu_reseau">🔌 Interrompu réseau (exclu des stats)</option>' +
    '</select>' +
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

// ── Notifications & Confirmations ─────────────────────────────────────────────
function showToast(msg, type, duration) {
  duration = duration || 3000;
  var toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:99999;' +
    'padding:10px 18px;border-radius:10px;font-size:13px;font-weight:600;color:#fff;' +
    'box-shadow:0 4px 16px rgba(0,0,0,0.4);pointer-events:none;transition:opacity .3s;max-width:90vw;text-align:center;';
  if (type === 'error')   toast.style.background = '#ef4444';
  else if (type === 'warning') toast.style.background = '#f59e0b';
  else if (type === 'success') toast.style.background = '#10b981';
  else toast.style.background = '#6366f1';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(function() {
    toast.style.opacity = '0';
    setTimeout(function() { toast.remove(); }, 300);
  }, duration);
}

function showConfirm(msg, onConfirm) {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center';
  var box = document.createElement('div');
  box.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:20px 24px;max-width:340px;width:90vw;text-align:center';
  box.innerHTML =
    '<div style="font-size:14px;font-weight:600;color:#fff;margin-bottom:16px">' + msg + '</div>' +
    '<div style="display:flex;gap:10px;justify-content:center">' +
      '<button id="sc-cancel" class="btn-sm btn-ghost">Annuler</button>' +
      '<button id="sc-confirm" class="btn-sm btn-danger">Confirmer</button>' +
    '</div>';
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  box.querySelector('#sc-cancel').onclick = function() { overlay.remove(); };
  box.querySelector('#sc-confirm').onclick = function() { overlay.remove(); onConfirm(); };
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
}

function bindMatchPitchDrag() {
  var svg = document.querySelector('.match-pitch-col svg');
  if (!svg) return;
  var W = 180; var H = 290;

  svg.querySelectorAll('.match-pitch-node').forEach(function(node) {
    var idx = parseInt(node.getAttribute('data-slot'));
    var _startX = 0, _startY = 0, _moved = false;

    node.addEventListener('mousedown', onStart);
    node.addEventListener('touchstart', onStart, { passive: true });

    function onStart(e) {
      _startX = e.touches ? e.touches[0].clientX : e.clientX;
      _startY = e.touches ? e.touches[0].clientY : e.clientY;
      _moved = false;
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
        node.style.opacity = '0.6';
      }
      if (_moved) e.preventDefault();
    }

    function onEnd(e) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      node.style.opacity = '1';
      _moved = false;
    }
  });
}

function setTab(tab) {
  if (tab === 'matchs') _matchsPage = 1;
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
  // Mettre à jour le tableau général
  const el = document.getElementById('mps-' + stat + '-' + pid);
  if (el) el.textContent = _matchPlayerStats[pid][stat];
  // Mettre à jour le popup rapide si ouvert pour ce joueur
  var qspEl = document.getElementById('qsp-' + stat + '-' + pid);
  if (qspEl) qspEl.textContent = _matchPlayerStats[pid][stat];
  // Si le popup est ouvert pour un autre stat du même joueur, rafraîchir tous les compteurs
  var popup = document.getElementById('quick-stat-popup');
  if (popup && popup._activePid === pid) {
    ['goals','assists','saves'].forEach(function(s) {
      var el2 = document.getElementById('qsp-' + s + '-' + pid);
      if (el2) el2.textContent = _matchPlayerStats[pid][s] || 0;
    });
  }
  // Mettre à jour le score automatiquement quand un but est marqué
  if (stat === 'goals') {
    var scoreEl = document.getElementById('m-score-for');
    if (scoreEl) {
      scoreEl.value = Math.max(0, (parseInt(scoreEl.value) || 0) + delta);
      autoUpdateResult();
      saveMatchFormState();
    }
  }
  saveMatchDraft();
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
  selectResult(sf > sa ? 'V' : sf < sa ? 'D' : 'N');
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
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}

async function saveMatch() {
  // Toujours sauvegarder l'état des deux onglets avant de lire
  // (les champs DOM non visibles sont ignorés gracieusement)
  saveMatchFormState();
  saveMatchSummaryState();

  const buildId = document.getElementById('m-match-build')?.value;
  const result = _matchFormState['m-match-result'] || document.getElementById('m-match-result')?.value;
  if (!result) { showToast('Sélectionne un résultat', 'warning'); return; }

  const formation = _matchFormState['m-formation'] || _matchLastFormation || document.getElementById('m-formation')?.value?.trim();
  if (!formation) {
    showToast("Formation vide — entre ta formation avant d'enregistrer", 'warning');
    return;
  }

  // Vérifier les notes — obligatoires uniquement pour matchs terminés normalement
  var currentStatus = _matchSummaryState['m-match-status'] || document.getElementById('m-match-status')?.value || 'termine';
  if (currentStatus === 'termine') {
    var tituPids = _matchTitulaires.map(function(t) { return t.player_id; });
    var notesManquantes = tituPids.filter(function(pid) {
      return !_matchPlayerStats[pid] || !(_matchPlayerStats[pid].rating > 0);
    });
    if (notesManquantes.length > 0) {
      var names = notesManquantes.map(function(pid) {
        var p = State.players.find(function(x) { return x.id === pid; });
        return p ? p.name : pid;
      });
      showToast('Notes manquantes (titulaires) : ' + names.join(', '), 'warning', 5000);
      return;
    }
  }

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

  // Helper : lire depuis _matchFormState ou DOM
  function fs(id) { return _matchFormState[id] !== undefined ? _matchFormState[id] : (document.getElementById(id)?.value || null); }

  const data = {
    build_id: null,
    coach_id: fs('m-coach-id') || null,
    result,
    match_date: fs('m-match-date') || null,
    match_time: fs('m-match-time') || null,
    match_type: fs('m-match-type') || null,
    rank: fs('m-match-rank') || null,
    score_for: parseInt(fs('m-score-for')) || 0,
    score_against: parseInt(fs('m-score-against')) || 0,
    opp_name: (fs('m-opp-name') || '').trim() || null,
    formation: formation,
    opp_formation: (fs('m-opp-formation') || '').trim() || null,
    my_rank: parseInt(fs('m-my-rank')) || null,
    opp_rank: parseInt(fs('m-opp-rank')) || null,
    titulaires: _matchTitulaires,
    remplacants: _matchRemplacants,
    substitutions: _matchSubs,
    attack1_instruction: fs('m-attack1-instruction') || 'Off',
    attack1_target: fs('m-attack1-target') || null,
    attack2_instruction: fs('m-attack2-instruction') || 'Off',
    attack2_target: fs('m-attack2-target') || null,
    defence1_instruction: fs('m-defence1-instruction') || 'Off',
    defence1_target: fs('m-defence1-target') || null,
    defence2_instruction: fs('m-defence2-instruction') || 'Off',
    defence2_target: fs('m-defence2-target') || null,
    player_stats: playerStats,
    man_of_match: _matchSummaryState['m-man-of-match'] || fs('m-man-of-match') || null,
    note: parseInt(_matchSummaryState['m-note'] || fs('m-note')) || 3,
    repeated_opponent: _matchSummaryState['m-repeated-opponent'] !== undefined ? _matchSummaryState['m-repeated-opponent'] : (document.getElementById('m-repeated-opponent')?.checked || false),
    match_status: currentStatus,
    source: 'app',
  };
  try {
    var oldRecord = Analyse.series(State.matches).record;
    await Matches.create(data);
    State.matches = await Matches.getAll();
    var newSerie = Analyse.series(State.matches);
    if (newSerie.current > 0 && newSerie.current > oldRecord) {
      showToast('🏆 Nouveau record de série : ' + newSerie.current + ' victoires consécutives !', 'success', 5000);
    } else if (newSerie.current > 0) {
      showToast('Match enregistré ! Série : ' + newSerie.current + ' victoire' + (newSerie.current > 1 ? 's' : ''), 'success');
    } else {
      showToast('Match enregistré !', 'success');
    }
    _matchPlayerStats = {};
    clearMatchDraft();
    closeModal();
    render();
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
    showToast('Supprimé avec succès', 'success');
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


// ── Instructions IA ──────────────────────────────────────────────────────────
async function requestInstructionsIA() {
  var btn = document.getElementById('btn-instructions-ia');
  if (btn && btn.disabled) return;
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 1s linear infinite"></i>'; }

  try {
    // Titulaires actuels
    if (_matchTitulaires.length === 0) {
      showToast('Ajoute des titulaires d' + String.fromCharCode(39) + 'abord', 'warning');
      return;
    }

    // Coach actif
    var activeCoachId = getActiveCoachId();
    var activeCoach = activeCoachId ? State.coaches.find(function(c){ return c.id === activeCoachId; }) : null;
    var formation = document.getElementById('m-formation') ? document.getElementById('m-formation').value : (_matchLastFormation || '');

    // Construire le contexte des titulaires
    var nl = '\n';
    var tituDetails = _matchTitulaires.map(function(t, i) {
      var player = State.players.find(function(p){ return p.id === t.player_id; });
      var cards = State.cards[t.player_id] || [];
      var card = cards.find(function(c){ return c.id === t.card_id; }) || cards[0];
      var pos = card ? (card.efhub_stats.position || '?') : '?';
      var style = card ? (card.efhub_stats.playingStyle || '?') : '?';
      var name = player ? player.name : 'Joueur';

      // Stats de performance du joueur
      var matches = filterStatsMatches(State.matches);
      var playerMatches = matches.filter(function(m) {
        return m.player_stats && m.player_stats.some(function(ps){ return ps.player_id === t.player_id; });
      });
      var goals = 0, assists = 0, ratings = [];
      playerMatches.forEach(function(m) {
        var ps = (m.player_stats || []).find(function(p){ return p.player_id === t.player_id; });
        if (ps) { goals += ps.goals||0; assists += ps.assists||0; if(ps.rating) ratings.push(ps.rating); }
      });
      var avgRating = ratings.length > 0 ? (ratings.reduce(function(a,b){return a+b;},0)/ratings.length).toFixed(1) : 'N/A';
      var winRate = playerMatches.length > 0 ? Math.round(playerMatches.filter(function(m){return m.result==='V';}).length/playerMatches.length*100) : 0;

      return (i+1) + '. ' + name + ' [' + pos + '] style:' + style + ' — ' + playerMatches.length + ' matchs, ' + winRate + '% V, ' + goals + ' buts, ' + assists + ' passes, note:' + avgRating;
    }).join(nl);

    // Instructions gagnantes depuis l'historique
    var instrWinRates = {};
    try {
      var instrStats = Analyse.byIndividualInstruction(filterStatsMatches(State.matches), State.players, State.cards);
      if (instrStats && instrStats.length > 0) {
        instrStats.slice(0, 5).forEach(function(s) {
          instrWinRates[s.playerName + '+' + s.instruction] = s.winRate + '%';
        });
      }
    } catch(e) {}
    var instrHistorique = Object.entries(instrWinRates).map(function(e){ return e[0] + ': ' + e[1]; }).join(', ') || 'Aucune donnée';

    var prompt = 'Tu es un expert eFootball Mobile. Propose les meilleures instructions individuelles pour ce match afin de maximiser les victoires.' + nl + nl +
      (activeCoach ? 'COACH: ' + activeCoach.name + ' · Style: ' + (activeCoach.style||'—') + ' · Formation: ' + (activeCoach.formation||formation||'—') + nl + nl : '') +
      'TITULAIRES (stats de performance réelles):' + nl + tituDetails + nl + nl +
      'INSTRUCTIONS GAGNANTES (historique — combinaisons joueur+instruction avec meilleur win rate): ' + instrHistorique + nl + nl +
      'RÈGLES STRICTES:' + nl +
      '- Attack 1 & 2 : UNIQUEMENT parmi: Off, Defensive, Attacking, Anchoring' + nl +
      '- Defence 1 & 2 : UNIQUEMENT parmi: Off, Tight Marking, Man Marking, Counter Target, Deep Line' + nl +
      '- ATTENTION: Counter Target = DEFENCE uniquement. Attacking/Defensive/Anchoring = ATTACK uniquement.' + nl +
      '- RÈGLES PAR POSITION pour Attack:' + nl +
      '  * GK : Off uniquement' + nl +
      '  * CB/LB/RB : Off ou Defensive' + nl +
      '  * DMF : Off, Defensive ou Anchoring' + nl +
      '  * CMF/LMF/RMF : Off, Defensive ou Attacking' + nl +
      '  * AMF : Off, Attacking ou Anchoring' + nl +
      '  * LWF/RWF/CF/SS : Off ou Defensive (Attacking interdit)' + nl +
      '- RÈGLES PAR POSITION pour Defence:' + nl +
      '  * GK : Off uniquement' + nl +
      '  * CB : Off, Tight Marking ou Man Marking' + nl +
      '  * LB/RB : Off, Tight Marking, Man Marking ou Counter Target' + nl +
      '  * DMF/CMF : Off, Tight Marking ou Man Marking' + nl +
      '  * AMF/LMF/RMF : Off, Man Marking ou Counter Target' + nl +
      '  * LWF/RWF/CF/SS : Off ou Counter Target' + nl + nl +
      'LOGIQUE DE SÉLECTION:' + nl +
      '- Priorité aux combinaisons gagnantes dans l' + String.fromCharCode(39) + 'historique' + nl +
      '- Joueur avec beaucoup de buts → Counter Target (exploite sa vitesse en contre)' + nl +
      '- Joueur avec beaucoup de passes → Attacking (libéré pour créer)' + nl +
      '- Milieu défensif avec bon win rate → Anchoring (protège la défense)' + nl +
      '- Quick Counter → Counter Target sur l' + String.fromCharCode(39) + 'attaquant le plus rapide' + nl +
      '- Possession Game → Attacking sur le meneur de jeu' + nl + nl +
      '- Le Targeted Player = le joueur de TON équipe qui exécute ce rôle' + nl +
      '- Target vide ("") si instruction = Off' + nl + nl +
      'Réponds UNIQUEMENT avec un JSON valide sans texte avant ou après:' + nl +
      '{' + nl +
      '  "attack1":"Attacking", "attack1_target":"Bellingham",' + nl +
      '  "attack2":"Defensive", "attack2_target":"Valverde",' + nl +
      '  "defence1":"Man Marking", "defence1_target":"Tchouameni",' + nl +
      '  "defence2":"Counter Target", "defence2_target":"Mbappe",' + nl +
      '  "justification":"Explication citant les stats des joueurs et l' + String.fromCharCode(39) + 'historique gagnant"' + nl +
      '}';

    var data = await fetchCoachingWithRetry({ model: 'claude-sonnet-4-6', max_tokens: 600, messages: [{ role: 'user', content: prompt }] });
    var text = (data.content || []).map(function(b){ return b.text||''; }).join('');

    // Parser JSON
    var jsonStart = text.indexOf('{');
    var depth = 0, jsonEnd = -1;
    for (var ci = jsonStart; ci < text.length; ci++) {
      if (text[ci]==='{') depth++;
      else if (text[ci]==='}') { depth--; if(depth===0){jsonEnd=ci;break;} }
    }
    var parsed = JSON.parse(text.slice(jsonStart, jsonEnd+1));

    // Valider que les instructions sont dans le bon groupe
    var validAttack = ['Off', 'Defensive', 'Attacking', 'Anchoring'];
    var validDefence = ['Off', 'Tight Marking', 'Man Marking', 'Counter Target', 'Deep Line'];

    function fixInstr(val, validList) {
      if (!val) return 'Off';
      var exact = validList.find(function(v){ return v.toLowerCase() === val.toLowerCase(); });
      if (exact) return exact;
      var partial = validList.find(function(v){ return v.toLowerCase().includes(val.toLowerCase()) || val.toLowerCase().includes(v.toLowerCase()); });
      return partial || 'Off';
    }

    // Règles d'instructions valides par position
    var validAttackByPos = {
      'GK':  ['Off'],
      'CB':  ['Off','Defensive'], 'LB': ['Off','Defensive'], 'RB': ['Off','Defensive'],
      'DMF': ['Off','Defensive','Anchoring'],
      'CMF': ['Off','Defensive','Attacking'], 'LMF': ['Off','Defensive','Attacking'], 'RMF': ['Off','Defensive','Attacking'],
      'AMF': ['Off','Attacking','Anchoring'],
      'LWF': ['Off','Defensive'], 'RWF': ['Off','Defensive'], 'CF': ['Off','Defensive'], 'SS': ['Off','Defensive']
    };
    var validDefenceByPos = {
      'GK':  ['Off'],
      'CB':  ['Off','Tight Marking','Man Marking'],
      'LB':  ['Off','Tight Marking','Man Marking','Counter Target'],
      'RB':  ['Off','Tight Marking','Man Marking','Counter Target'],
      'DMF': ['Off','Tight Marking','Man Marking'], 'CMF': ['Off','Tight Marking','Man Marking'],
      'AMF': ['Off','Man Marking','Counter Target'], 'LMF': ['Off','Man Marking','Counter Target'], 'RMF': ['Off','Man Marking','Counter Target'],
      'LWF': ['Off','Counter Target'], 'RWF': ['Off','Counter Target'],
      'CF':  ['Off','Counter Target'], 'SS': ['Off','Counter Target']
    };

    // Appliquer par position des joueurs ciblés
    function getTargetPos(targetName) {
      if (!targetName) return null;
      var p = State.players.find(function(pl){
        return pl.name.toLowerCase() === targetName.toLowerCase() ||
               pl.name.toLowerCase().includes(targetName.toLowerCase());
      });
      if (!p) return null;
      var titu = _matchTitulaires.find(function(t){ return t.player_id === p.id; });
      if (!titu) return null;
      var cards = State.cards[p.id] || [];
      var card = cards.find(function(c){ return c.id === titu.card_id; }) || cards[0];
      return card ? (card.efhub_stats.position || null) : null;
    }

    function fixInstrByPos(val, targetName, validList, byPosMap) {
      var pos = getTargetPos(targetName);
      var allowed = pos && byPosMap[pos] ? byPosMap[pos] : validList;
      return fixInstr(val, allowed);
    }

    parsed.attack1  = fixInstrByPos(parsed.attack1,  parsed.attack1_target,  validAttack, validAttackByPos);
    parsed.attack2  = fixInstrByPos(parsed.attack2,  parsed.attack2_target,  validAttack, validAttackByPos);
    parsed.defence1 = fixInstrByPos(parsed.defence1, parsed.defence1_target, validDefence, validDefenceByPos);
    parsed.defence2 = fixInstrByPos(parsed.defence2, parsed.defence2_target, validDefence, validDefenceByPos);

    // Ouvrir le details d'abord
    var details = document.querySelector('.match-instructions-details');
    if (details) details.open = true;

    // Appliquer dans _matchFormState — instructions
    if (parsed.attack1) _matchFormState['m-attack1-instruction'] = parsed.attack1;
    if (parsed.attack2) _matchFormState['m-attack2-instruction'] = parsed.attack2;
    if (parsed.defence1) _matchFormState['m-defence1-instruction'] = parsed.defence1;
    if (parsed.defence2) _matchFormState['m-defence2-instruction'] = parsed.defence2;

    // Résoudre les targets (nom → player_id)
    function resolveTarget(name) {
      if (!name) return '';
      var p = State.players.find(function(pl) {
        return pl.name.toLowerCase() === name.toLowerCase() ||
               pl.name.toLowerCase().includes(name.toLowerCase());
      });
      return p ? p.id : '';
    }
    // Si instruction Off → pas de target
    var a1t = parsed.attack1  !== 'Off' ? resolveTarget(parsed.attack1_target)  : '';
    var a2t = parsed.attack2  !== 'Off' ? resolveTarget(parsed.attack2_target)  : '';
    var d1t = parsed.defence1 !== 'Off' ? resolveTarget(parsed.defence1_target) : '';
    var d2t = parsed.defence2 !== 'Off' ? resolveTarget(parsed.defence2_target) : '';

    if (a1t) _matchFormState['m-attack1-target'] = a1t;
    if (a2t) _matchFormState['m-attack2-target'] = a2t;
    if (d1t) _matchFormState['m-defence1-target'] = d1t;
    if (d2t) _matchFormState['m-defence2-target'] = d2t;

    // Remplir directement les selects DOM — instructions
    var instrMap = {
      'm-attack1-instruction': parsed.attack1,
      'm-attack2-instruction': parsed.attack2,
      'm-defence1-instruction': parsed.defence1,
      'm-defence2-instruction': parsed.defence2
    };
    Object.keys(instrMap).forEach(function(id) {
      var val = instrMap[id];
      if (!val) return;
      var el = document.getElementById(id);
      if (el) {
        var found = false;
        for (var oi = 0; oi < el.options.length; oi++) {
          if (el.options[oi].value.toLowerCase() === val.toLowerCase()) {
            el.selectedIndex = oi; found = true; break;
          }
        }
        if (!found) el.value = val;
      }
    });

    // Remplir les selects target DOM
    var targetMap = {
      'm-attack1-target': a1t,
      'm-attack2-target': a2t,
      'm-defence1-target': d1t,
      'm-defence2-target': d2t
    };
    Object.keys(targetMap).forEach(function(id) {
      var val = targetMap[id];
      if (!val) return;
      var el = document.getElementById(id);
      if (el) el.value = val;
    });

    restoreMatchFormState();
    saveLastInstructions();

    if (parsed.justification) showToast('🤖 ' + parsed.justification, 'info', 5000);

  } catch(e) {
    showToast('Erreur IA instructions : ' + e.message, 'error');
  }

  var btn2 = document.getElementById('btn-instructions-ia');
  if (btn2) { btn2.disabled = false; btn2.innerHTML = '<i class="ti ti-wand"></i> IA'; }
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

  var newEntry3 = { player_id: pid, card_id: cardId, build_id: resolveBuildId(pid, cardId, null) };
  _squad23.push(newEntry3);
  saveSquad23();
  syncNewPlayerToLineups(newEntry3);
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
  var newEntry = { player_id: pid, card_id: card.id, build_id: buildId };
  _squad23.push(newEntry);
  saveSquad23();
  syncNewPlayerToLineups(newEntry);

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
  var newEntry2 = { player_id: pid, card_id: cid, build_id: defaultBuild };
  _squad23.push(newEntry2);
  saveSquad23();
  syncNewPlayerToLineups(newEntry2);
  // Re-render la section
  var el = document.getElementById('squad23-container');
  if (el) el.innerHTML = renderSquad23Section();
}

function syncNewPlayerToLineups(entry) {
  if (!entry || !entry.player_id) return;
  var pid = entry.player_id;
  var resolvedBuild = resolveBuildId(pid, entry.card_id, entry.build_id);
  var newTitu = { player_id: pid, card_id: entry.card_id, build_id: resolvedBuild };

  // Charger la formation depuis localStorage si nécessaire
  try {
    var ftData = JSON.parse(localStorage.getItem(FT_STORAGE_KEY) || 'null');
    if (ftData) {
      if (!_ftTitulaires || _ftTitulaires.length === 0) _ftTitulaires = ftData.titulaires || [];
      if (!_ftRemplacants || _ftRemplacants.length === 0) _ftRemplacants = ftData.remplacants || [];
    }
  } catch(e) {}

  // Trouver les slots vides dans _ftTitulaires
  var emptyFtSlots = _ftTitulaires.map(function(t, i){ return (!t || !t.player_id) ? i : -1; }).filter(function(i){ return i >= 0; });

  if (emptyFtSlots.length > 0) {
    // Prendre un slot vide au hasard si plusieurs, sinon le seul disponible
    var slotIdx = emptyFtSlots[Math.floor(Math.random() * emptyFtSlots.length)];
    _ftTitulaires[slotIdx] = Object.assign({ slot_idx: slotIdx }, newTitu);
    ftSave();
  } else {
    // Pas de slot vide → mettre au banc
    var inFt = _ftRemplacants.some(function(r){ return r && r.player_id === pid; });
    if (!inFt) { _ftRemplacants.push(newTitu); ftSave(); }
  }

  // Même logique pour le modal match
  var emptyMatchSlots = _matchTitulaires.map(function(t, i){ return (!t || !t.player_id) ? i : -1; }).filter(function(i){ return i >= 0; });

  if (emptyMatchSlots.length > 0) {
    var matchSlotIdx = emptyMatchSlots[Math.floor(Math.random() * emptyMatchSlots.length)];
    _matchTitulaires[matchSlotIdx] = Object.assign({ slot_idx: matchSlotIdx }, newTitu);
    if (!_matchPlayerStats[pid]) _matchPlayerStats[pid] = { goals:0, assists:0, saves:0, yellow_card:false, red_card:false, rating:0 };
    saveMatchDraft();
    var pitchCol = document.querySelector('.match-pitch-col');
    if (pitchCol) refreshPitchStats();
  } else {
    var inMatch = _matchTitulaires.some(function(t){ return t && t.player_id === pid; }) ||
                  _matchRemplacants.some(function(r){ return r && r.player_id === pid; });
    if (!inMatch) {
      _matchRemplacants.push(newTitu);
      saveMatchDraft();
    }
  }

  // Persister dans LINEUP_STORAGE_KEY
  try {
    var lineup = JSON.parse(localStorage.getItem(LINEUP_STORAGE_KEY) || '{}');
    lineup.titulaires = _matchTitulaires;
    lineup.remplacants = _matchRemplacants;
    localStorage.setItem(LINEUP_STORAGE_KEY, JSON.stringify(lineup));
  } catch(e) {}
}

function removeFromSquad23(idx) {
  var removed = _squad23[idx];
  _squad23.splice(idx, 1);
  saveSquad23();

  if (removed && removed.player_id) {
    var pid = removed.player_id;

    // Retirer de _ftTitulaires → slot vide
    _ftTitulaires.forEach(function(t, i) {
      if (t && t.player_id === pid) _ftTitulaires[i] = { slot_idx: i, player_id: null };
    });
    // Retirer de _ftRemplacants
    _ftRemplacants = _ftRemplacants.filter(function(r) { return r && r.player_id !== pid; });
    ftSave();

    // Retirer de _matchTitulaires → slot vide
    _matchTitulaires.forEach(function(t, i) {
      if (t && t.player_id === pid) _matchTitulaires[i] = null;
    });
    // Retirer de _matchRemplacants
    _matchRemplacants = _matchRemplacants.filter(function(r) { return r && r.player_id !== pid; });
    saveMatchDraft();

    // Nettoyer LINEUP_STORAGE_KEY
    try {
      var lineup = JSON.parse(localStorage.getItem(LINEUP_STORAGE_KEY) || '{}');
      if (lineup.titulaires) lineup.titulaires = lineup.titulaires.map(function(t) {
        return (t && t.player_id === pid) ? null : t;
      });
      if (lineup.remplacants) lineup.remplacants = lineup.remplacants.filter(function(r) {
        return r && r.player_id !== pid;
      });
      localStorage.setItem(LINEUP_STORAGE_KEY, JSON.stringify(lineup));
    } catch(e) {}
  }

  var el = document.getElementById('squad23-container');
  if (el) el.innerHTML = renderSquad23Section();
}

function updateSquad23Build(idx, buildId) {
  if (!_squad23[idx]) return;
  _squad23[idx].build_id = buildId || null;
  saveSquad23();

  // Mettre à jour le build dans _ftTitulaires si ce joueur est titulaire
  var pid = _squad23[idx].player_id;
  var cardId = _squad23[idx].card_id;
  var resolvedBuild = resolveBuildId(pid, cardId, buildId || null);

  // Sync modal Formation
  var ftTitu = _ftTitulaires.findIndex(function(t){ return t && t.player_id === pid; });
  if (ftTitu >= 0) {
    _ftTitulaires[ftTitu].build_id = resolvedBuild;
    ftSave();
  }
  var ftRemp = _ftRemplacants.findIndex(function(r){ return r && r.player_id === pid; });
  if (ftRemp >= 0) {
    _ftRemplacants[ftRemp].build_id = resolvedBuild;
    ftSave();
  }

  // Sync modal Match si ouvert
  var matchTitu = _matchTitulaires.findIndex(function(t){ return t && t.player_id === pid; });
  if (matchTitu >= 0) {
    _matchTitulaires[matchTitu].build_id = resolvedBuild;
    saveMatchDraft();
  }
  var matchRemp = _matchRemplacants.findIndex(function(r){ return r && r.player_id === pid; });
  if (matchRemp >= 0) {
    _matchRemplacants[matchRemp].build_id = resolvedBuild;
    saveMatchDraft();
  }

  // Sync LINEUP_STORAGE_KEY pour le prochain chargement
  try {
    var lineup = JSON.parse(localStorage.getItem(LINEUP_STORAGE_KEY) || '{}');
    if (lineup.titulaires) {
      lineup.titulaires.forEach(function(t) {
        if (t && t.player_id === pid) t.build_id = resolvedBuild;
      });
    }
    if (lineup.remplacants) {
      lineup.remplacants.forEach(function(r) {
        if (r && r.player_id === pid) r.build_id = resolvedBuild;
      });
    }
    localStorage.setItem(LINEUP_STORAGE_KEY, JSON.stringify(lineup));
  } catch(e) {}
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

// ══════════════════════════════════════════════════════════════════════════════
// MODIFIER MATCH
// ══════════════════════════════════════════════════════════════════════════════
// ── État modal édition match ──────────────────────────────────────────────────
var _editMatchId = null;
var _editMatchPlayerStats = {};  // {pid: {goals, assists, saves, yellow_card, red_card, rating}}
var _editMatchSubs = [];         // [{out_player_id, in_player_id, minute}]
var _editMatchTitulaires = [];
var _editMatchRemplacants = [];

function renderModalEditMatch(matchId) {
  var match = State.matches.find(function(m) { return m.id === matchId; });
  if (!match) return '';
  var q = String.fromCharCode(39);

  // Initialiser l'état édition depuis les données du match
  _editMatchId = matchId;
  _editMatchSubs = JSON.parse(JSON.stringify(match.substitutions || []));
  _editMatchTitulaires = JSON.parse(JSON.stringify(match.titulaires || []));
  _editMatchRemplacants = JSON.parse(JSON.stringify(match.remplacants || []));

  // Reconstruire _editMatchPlayerStats depuis player_stats du match
  _editMatchPlayerStats = {};
  (match.player_stats || []).forEach(function(ps) {
    _editMatchPlayerStats[ps.player_id] = {
      goals: ps.goals || 0,
      assists: ps.assists || 0,
      saves: ps.saves || 0,
      yellow_card: ps.yellow_card || false,
      red_card: ps.red_card || false,
      rating: ps.rating || 0,
      build_id: ps.build_id || null,
    };
  });

  var typeLabels = {
    ligue_jcj_d1:'🏆 Ligue JCJ D1', ligue_jcj_d2:'🏆 Ligue JCJ D2', ligue_jcj_d3:'🏆 Ligue JCJ D3',
    ligue_ia_d1:'🤖 Ligue IA D1', ligue_ia_d2:'🤖 Ligue IA D2', ligue_ia_d3:'🤖 Ligue IA D3',
    event_jcj:'🎯 Évènement JCJ', event_ia:'🎯 Évènement IA', amical:'🤝 Amical', my_league:'⚽ My League',
  };

  var html = '<div class="modal-match-fullscreen" id="modal-edit-match-fs">';
  html += '<div class="modal-header" style="background:var(--surface2)">';
  html += '<h3>✏️ Modifier le match vs ' + (match.opp_name || 'Adversaire') + '</h3>';
  html += '<button class="btn-icon" onclick="closeModal()"><i class="ti ti-x"></i></button>';
  html += '</div>';

  html += '<div style="overflow-y:auto;flex:1;padding:14px 16px;display:flex;flex-direction:column;gap:12px">';

  // ── Infos générales ──
  html += '<div style="background:var(--surface3);border-radius:10px;padding:12px">';
  html += '<div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">Infos générales</div>';

  // Score + résultat
  html += '<div class="match-score-block" style="margin-bottom:10px">';
  html += '<div class="match-score-team"><div class="match-score-team-name">Real Madrid</div><input type="number" id="em-score-for" class="match-score-input" min="0" value="' + (match.score_for || 0) + '" oninput="emAutoResult()"></div>';
  html += '<div class="match-score-mid"><input type="text" id="em-opp" class="match-opp-input" placeholder="Adversaire..." value="' + (match.opp_name || '') + '">';
  html += '<div class="result-selector" style="margin-top:6px">';
  ['V','N','D'].forEach(function(v) {
    html += '<button class="result-btn' + (match.result === v ? ' active' : '') + '" data-val="' + v + '" onclick="selectResult(' + q + v + q + ')">' + (v === 'V' ? 'V' : v === 'N' ? 'N' : 'D') + '</button>';
  });
  html += '</div></div>';
  html += '<div class="match-score-team"><div class="match-score-team-name">Adversaire</div><input type="number" id="em-score-against" class="match-score-input" min="0" value="' + (match.score_against || 0) + '" oninput="emAutoResult()"></div>';
  html += '</div>';
  html += '<input type="hidden" id="m-match-result" value="' + (match.result || '') + '">';

  // Infos compactes
  html += '<div class="match-infos-compact">';
  // Types où le rang Professionnel/Superstar/Légende est disponible
  var EM_RANK_TYPES = ['event_ia', 'my_league'];
  var showRank = EM_RANK_TYPES.includes(match.match_type);
  html += '<div class="mic-row">';
  html += '<div class="form-group" style="flex:1"><label>Type</label><select id="em-type" class="form-input form-input-sm" onchange="emOnTypeChange(this.value)">';
  Object.entries(typeLabels).forEach(function(e) {
    html += '<option value="' + e[0] + '"' + (match.match_type === e[0] ? ' selected' : '') + '>' + e[1] + '</option>';
  });
  html += '</select></div>';
  html += '<div class="form-group" id="em-rank-group" style="flex:1' + (showRank ? '' : ';display:none') + '"><label>' + (match.match_type === 'my_league' ? 'Niveau My League' : 'Difficulté IA') + '</label><select id="em-rank" class="form-input form-input-sm"><option value="">— Sans rang —</option>';
  EFB_RANKS.forEach(function(r) { html += '<option value="' + r + '"' + (match.rank === r ? ' selected' : '') + '>' + r + '</option>'; });
  html += '</select></div>';
  html += '</div>';
  html += '<div class="mic-row">';
  html += '<div class="form-group" style="flex:2"><label><i class="ti ti-whistle" style="font-size:11px"></i> Coach utilisé</label><select id="em-coach" class="form-input form-input-sm"><option value="">— Sans coach —</option>';
  State.coaches.forEach(function(c) { html += '<option value="' + c.id + '"' + (match.coach_id === c.id ? ' selected' : '') + '>' + c.name + (c.style ? ' · ' + c.style : '') + '</option>'; });
  html += '</select></div>';
  html += '</div>';
  html += '<div class="mic-row">';
  html += '<div class="form-group" style="flex:1"><label>Notre formation</label><div style="display:flex;gap:4px"><input type="text" id="em-formation" class="form-input form-input-sm" value="' + (match.formation || '') + '" placeholder="4-3-3" style="flex:1"><button class="btn-sm btn-ghost" onclick="openEmFormationPicker()" style="padding:4px 8px;flex-shrink:0"><i class="ti ti-ball-football"></i></button></div></div>';
  html += '<div class="form-group" style="flex:1"><label>Formation adv.</label><input type="text" id="em-opp-formation" class="form-input form-input-sm" value="' + (match.opp_formation || '') + '" placeholder="4-4-2"></div>';
  html += '</div>';
  html += '<div class="mic-row">';
  html += '<div class="form-group" style="flex:1"><label>Date</label><input type="date" id="em-date" class="form-input form-input-sm" value="' + (match.match_date || '') + '"></div>';
  html += '<div class="form-group" style="flex:1"><label>Heure</label><input type="time" id="em-time" class="form-input form-input-sm" value="' + (match.match_time || '') + '"></div>';
  html += '</div>';
  html += '<div class="mic-row">';
  html += '<div class="form-group" style="flex:1"><label>Mon rang pts</label><input type="number" id="em-my-rank" class="form-input form-input-sm" value="' + (match.my_rank || '') + '" placeholder="1250"></div>';
  html += '<div class="form-group" style="flex:1"><label>Rang adv. pts</label><input type="number" id="em-opp-rank" class="form-input form-input-sm" value="' + (match.opp_rank || '') + '" placeholder="1380"></div>';
  html += '</div>';
  html += '</div>';
  html += '</div>'; // infos générales

  // ── Instructions ──
  html += '<details style="background:var(--surface3);border-radius:10px;padding:10px 12px">';
  html += '<summary style="font-size:12px;font-weight:600;cursor:pointer;list-style:none;display:flex;align-items:center;gap:6px"><i class="ti ti-list-details"></i> Instructions individuelles</summary>';
  html += '<div class="instructions-grid" style="margin-top:8px">';
  var instrSlots = [
    { key: 'attack1', label: 'Attack 1', options: EFB_ATTACK_INSTRUCTIONS },
    { key: 'attack2', label: 'Attack 2', options: EFB_ATTACK_INSTRUCTIONS },
    { key: 'defence1', label: 'Defence 1', options: EFB_DEFENCE_INSTRUCTIONS },
    { key: 'defence2', label: 'Defence 2', options: EFB_DEFENCE_INSTRUCTIONS },
  ];
  instrSlots.forEach(function(sl) {
    var savedInstr = match[sl.key + '_instruction'] || 'Off';
    var savedTarget = match[sl.key + '_target'] || '';
    html += '<div class="instruction-slot">';
    html += '<div class="instruction-slot-title">' + sl.label + '</div>';
    html += '<select id="em-' + sl.key + '-instruction" class="form-input form-input-sm">';
    sl.options.forEach(function(o) { html += '<option value="' + o + '"' + (savedInstr === o ? ' selected' : '') + '>' + o + '</option>'; });
    html += '</select>';
    html += '<select id="em-' + sl.key + '-target" class="form-input form-input-sm"><option value="">Targeted Player</option>';
    State.players.forEach(function(p) { html += '<option value="' + p.id + '"' + (savedTarget === p.id ? ' selected' : '') + '>' + p.name + '</option>'; });
    html += '</select></div>';
  });
  html += '</div></details>';

  // ── Substitutions ──
  html += '<div style="background:var(--surface3);border-radius:10px;padding:10px 12px">';
  html += '<div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">Substitutions</div>';
  html += '<div id="em-subs-list">' + renderEditMatchSubsList() + '</div>';
  html += '<button class="btn-sm btn-ghost" style="margin-top:6px;width:100%" onclick="emAddSub()"><i class="ti ti-plus"></i> Ajouter une substitution</button>';
  html += '</div>';

  // ── Stats joueurs ──
  html += '<div style="background:var(--surface3);border-radius:10px;padding:10px 12px">';
  html += '<div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">Stats joueurs</div>';
  html += '<div id="em-player-stats">' + renderEditMatchPlayerStats() + '</div>';
  html += '</div>';

  // ── Résumé final ──
  html += '<div style="background:var(--surface3);border-radius:10px;padding:10px 12px">';
  html += '<div class="form-row">';
  html += '<div class="form-group"><label>🏅 Homme du match</label><select id="em-motm" class="form-input"><option value="">— Aucun —</option>';
  State.players.forEach(function(p) { html += '<option value="' + p.id + '"' + (match.man_of_match === p.id ? ' selected' : '') + '>' + p.name + '</option>'; });
  html += '</select></div>';
  html += '<div class="form-group"><label>Note globale (1-5)</label><select id="em-note" class="form-input">';
  [1,2,3,4,5].forEach(function(n) { html += '<option value="' + n + '"' + (match.note === n ? ' selected' : '') + '>' + n + '</option>'; });
  html += '</select></div>';
  html += '</div>';
  html += '<div class="form-group"><label class="checkbox-label"><input type="checkbox" id="em-repeated"' + (match.repeated_opponent ? ' checked' : '') + '> Adversaire répétitif</label></div>';
  html += '<div class="form-group"><label>Statut du match</label><select id="em-match-status" class="form-input form-input-sm">';
  html += '<option value="termine"' + ((!match.match_status || match.match_status === 'termine') ? ' selected' : '') + '>✅ Terminé</option>';
  html += '<option value="abandon_adverse"' + (match.match_status === 'abandon_adverse' ? ' selected' : '') + '>🚪 Abandon adverse (victoire)</option>';
  html += '<option value="interrompu_reseau"' + (match.match_status === 'interrompu_reseau' ? ' selected' : '') + '>🔌 Interrompu réseau (exclu des stats)</option>';
  html += '</select></div>';
  html += '</div>';

  html += '</div>'; // scrollable body

  html += '<div class="modal-footer">';
  html += '<button class="btn-sm btn-ghost" onclick="closeModal()">Annuler</button>';
  html += '<button class="btn-sm btn-primary" onclick="saveEditMatch(' + q + matchId + q + ')"><i class="ti ti-device-floppy"></i> Sauvegarder</button>';
  html += '</div>';
  html += '</div>';
  return html;
}

function emAutoResult() {
  var sf = parseInt(document.getElementById('em-score-for')?.value) || 0;
  var sa = parseInt(document.getElementById('em-score-against')?.value) || 0;
  selectResult(sf > sa ? 'V' : sf < sa ? 'D' : 'N');
}

function emOnTypeChange(type) {
  var rankTypes = ['event_ia', 'my_league'];
  var group = document.getElementById('em-rank-group');
  if (!group) return;
  group.style.display = rankTypes.includes(type) ? '' : 'none';
  if (!rankTypes.includes(type)) {
    var rankSel = document.getElementById('em-rank');
    if (rankSel) rankSel.value = '';
  }
  // Changer le label selon le type
  var label = group.querySelector('label');
  if (label) {
    label.textContent = type === 'my_league' ? 'Niveau My League' : 'Difficulté IA';
  }
}

function openEmFormationPicker() {
  loadAllCustomFormations();
  var customs = loadCustomFormations();
  var customNames = Object.keys(customs);
  var builtinNames = Object.keys(FORMATION_LAYOUTS).filter(function(k) { return !FORMATION_LAYOUTS[k]._custom_slots; });
  var q = String.fromCharCode(39);

  var root = document.createElement('div');
  root.id = 'fmpicker-root';
  root.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center';
  root.onclick = function(e) { if (e.target === root) closeFmPicker(); };

  var panel = document.createElement('div');
  panel.style.cssText = 'background:var(--surface);border:0.5px solid var(--border);border-radius:14px;width:680px;max-width:96vw;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;position:relative;z-index:10000';

  var header = '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:0.5px solid var(--border);flex-shrink:0">' +
    '<span style="font-size:14px;font-weight:600;color:#fff">Choisir une formation</span>' +
    '<button class="btn-icon" onclick="closeFmPicker()"><i class="ti ti-x"></i></button>' +
    '</div>';

  var body = '<div style="overflow-y:auto;padding:12px 16px;flex:1">' +
    (customNames.length > 0 ? '<div class="fmpicker-group-title">Mes formations</div><div class="fmpicker-grid">' + customNames.map(function(n) { return renderEmFormationCard(n, true); }).join('') + '</div>' : '') +
    '<div class="fmpicker-group-title">Formations standard</div>' +
    '<div class="fmpicker-grid">' + builtinNames.map(function(n) { return renderEmFormationCard(n, false); }).join('') + '</div>' +
    '</div>';

  panel.innerHTML = header + body;
  root.appendChild(panel);
  document.body.appendChild(root);
}

function renderEmFormationCard(name, isCustom) {
  var q = String.fromCharCode(39);
  var slots = buildPitchSlots(name);
  if (!slots) return '';
  var miniSvg = renderMiniPitchSVG(slots);
  return '<div class="fmpicker-card" onclick="emSelectFormation(' + q + name.replace(/'/g, "\\'") + q + ')">' +
    miniSvg +
    '<div class="fmpicker-card-name">' + name + (isCustom ? ' <span class="badge-custom">Perso</span>' : '') + '</div>' +
  '</div>';
}

function emSelectFormation(name) {
  var el = document.getElementById('em-formation');
  if (el) el.value = name;
  closeFmPicker();
}

function onMatchStatusChange(status) {
  // Abandon adverse → forcer résultat V
  if (status === 'abandon_adverse') {
    document.getElementById('m-match-result').value = 'V';
    document.querySelectorAll('.result-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.val === 'V');
    });
    showToast('Résultat forcé à Victoire (abandon adverse)', 'success');
  }
  // Interrompu réseau → avertissement
  if (status === 'interrompu_reseau') {
    showToast('Match exclu des stats (interrompu réseau)', 'warning', 4000);
  }
}

// Filtre les matchs interrompus réseau des calculs de stats
function filterStatsMatches(matches) {
  return matches.filter(function(m) { return m.match_status !== 'interrompu_reseau'; });
}

function onMatchTypeChange(type) {
  var rankTypes = ['event_ia', 'my_league'];
  var group = document.getElementById('m-rank-group');
  if (!group) return;
  group.style.display = rankTypes.includes(type) ? '' : 'none';
  if (!rankTypes.includes(type)) {
    var rankSel = document.getElementById('m-match-rank');
    if (rankSel) rankSel.value = '';
  }
  // Changer le label selon le type
  var label = group.querySelector('label');
  if (label) {
    label.textContent = type === 'my_league' ? 'Niveau My League' : 'Difficulté IA';
  }
}

function renderEditMatchSubsList() {
  var q = String.fromCharCode(39);
  if (_editMatchSubs.length === 0) return '<div style="font-size:11px;color:var(--muted)">Aucune substitution</div>';
  return _editMatchSubs.map(function(s, i) {
    var pOut = State.players.find(function(p) { return p.id === s.out_player_id; });
    var pIn  = State.players.find(function(p) { return p.id === s.in_player_id; });
    return '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:0.5px solid var(--border);font-size:12px">' +
      '<span style="color:var(--red)">↓ ' + (pOut ? pOut.name : '?') + '</span>' +
      '<span style="color:var(--green)">↑ ' + (pIn ? pIn.name : '?') + '</span>' +
      '<input type="number" value="' + (s.minute || 60) + '" min="1" max="120" style="width:50px;padding:2px 4px;font-size:11px;text-align:center;background:var(--surface);border:0.5px solid var(--border);border-radius:4px;color:var(--text)" onchange="emUpdateSubMin(' + i + ',this.value)">' +
      '<span style="font-size:10px;color:var(--muted)">\'</span>' +
      '<button class="btn-icon danger" onclick="emRemoveSub(' + i + ')"><i class="ti ti-x"></i></button>' +
    '</div>';
  }).join('');
}

function emUpdateSubMin(idx, val) {
  if (_editMatchSubs[idx]) _editMatchSubs[idx].minute = parseInt(val) || 60;
}

function emRemoveSub(idx) {
  _editMatchSubs.splice(idx, 1);
  var el = document.getElementById('em-subs-list');
  if (el) el.innerHTML = renderEditMatchSubsList();
}

function emAddSub() {
  var q = String.fromCharCode(39);
  var container = document.getElementById('em-subs-list');
  var formId = 'em-sub-form-new';
  if (document.getElementById(formId)) return;

  var usedOut = _editMatchSubs.map(function(s) { return s.out_player_id; });
  var usedIn  = _editMatchSubs.map(function(s) { return s.in_player_id; });
  var canOut = _editMatchTitulaires.filter(function(t) { return !usedOut.includes(t.player_id); });
  var canIn  = _editMatchRemplacants.filter(function(r) { return !usedIn.includes(r.player_id); });

  if (!canOut.length || !canIn.length) return;

  var div = document.createElement('div');
  div.id = formId;
  div.style.cssText = 'display:flex;gap:6px;align-items:center;margin-top:6px;flex-wrap:wrap';
  div.innerHTML = '<select id="em-sub-out" class="form-input form-input-sm" style="flex:1"><option value="">Qui sort...</option>' +
    canOut.map(function(t) { var p = State.players.find(function(x) { return x.id === t.player_id; }); return '<option value="' + t.player_id + '">' + (p ? p.name : '?') + '</option>'; }).join('') +
    '</select>' +
    '<select id="em-sub-in" class="form-input form-input-sm" style="flex:1"><option value="">Qui entre...</option>' +
    canIn.map(function(r) { var p = State.players.find(function(x) { return x.id === r.player_id; }); return '<option value="' + r.player_id + '">' + (p ? p.name : '?') + '</option>'; }).join('') +
    '</select>' +
    '<input type="number" id="em-sub-min" class="form-input form-input-sm" placeholder="min" style="width:60px" min="1" max="120">' +
    '<button class="btn-sm btn-primary" onclick="emConfirmSub()">✅</button>';
  container.appendChild(div);
}

function emConfirmSub() {
  var outPid = document.getElementById('em-sub-out')?.value;
  var inPid  = document.getElementById('em-sub-in')?.value;
  var min    = parseInt(document.getElementById('em-sub-min')?.value) || 60;
  if (!outPid || !inPid) return;
  _editMatchSubs.push({ out_player_id: outPid, in_player_id: inPid, minute: min });
  var el = document.getElementById('em-subs-list');
  if (el) el.innerHTML = renderEditMatchSubsList();
  var form = document.getElementById('em-sub-form-new');
  if (form) form.remove();
}

function renderEditMatchPlayerStats() {
  var q = String.fromCharCode(39);
  var pids = Object.keys(_editMatchPlayerStats);
  if (pids.length === 0) return '<div style="font-size:11px;color:var(--muted)">Aucune stat enregistrée</div>';

  return pids.map(function(pid) {
    var st = _editMatchPlayerStats[pid];
    var player = State.players.find(function(p) { return p.id === pid; });
    var cards = State.cards[pid] || [];
    var card = cards[0];
    var isGK = card && card.efhub_stats && card.efhub_stats.position === 'GK';
    var efhubId = player ? Efhub.parseId(player.efhub_url || '') : null;
    var imgUrl = efhubId ? Efhub.imgUrl(efhubId) : null;
    var pos = card && card.efhub_stats ? (card.efhub_stats.position || '') : '';

    var html = '<div style="background:var(--surface2);border-radius:8px;padding:8px 10px;margin-bottom:6px" id="emps-' + pid + '">';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
    if (imgUrl) html += '<img src="' + imgUrl + '" style="width:24px;height:30px;border-radius:3px;object-fit:cover">';
    html += '<span style="font-size:11px;color:var(--accent);font-weight:700;width:26px">' + pos + '</span>';
    html += '<span style="font-size:12px;font-weight:600;flex:1">' + (player ? player.name : '?') + '</span>';
    html += '</div>';

    // Stats buts/passes/arrêts
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">';
    html += '<div class="ppc-stat-chip"><span>⚽</span><button class="btn-click" onclick="emUpdateStat(' + q + pid + q + ',' + q + 'goals' + q + ',-1)">−</button><span id="emst-goals-' + pid + '">' + st.goals + '</span><button class="btn-click" onclick="emUpdateStat(' + q + pid + q + ',' + q + 'goals' + q + ',1)">+</button></div>';
    html += '<div class="ppc-stat-chip"><span>🎯</span><button class="btn-click" onclick="emUpdateStat(' + q + pid + q + ',' + q + 'assists' + q + ',-1)">−</button><span id="emst-assists-' + pid + '">' + st.assists + '</span><button class="btn-click" onclick="emUpdateStat(' + q + pid + q + ',' + q + 'assists' + q + ',1)">+</button></div>';
    if (isGK) html += '<div class="ppc-stat-chip"><span>🧤</span><button class="btn-click" onclick="emUpdateStat(' + q + pid + q + ',' + q + 'saves' + q + ',-1)">−</button><span id="emst-saves-' + pid + '">' + st.saves + '</span><button class="btn-click" onclick="emUpdateStat(' + q + pid + q + ',' + q + 'saves' + q + ',1)">+</button></div>';
    html += '<button class="card-btn-small ' + (st.yellow_card ? 'active-yellow' : '') + '" onclick="emToggleCard(' + q + pid + q + ',' + q + 'yellow' + q + ')">🟡</button>';
    html += '<button class="card-btn-small ' + (st.red_card ? 'active-red' : '') + '" onclick="emToggleCard(' + q + pid + q + ',' + q + 'red' + q + ')">🔴</button>';
    html += '</div>';

    // Note
    html += '<div style="display:flex;gap:2px;flex-wrap:wrap">';
    [3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10].forEach(function(n) {
      html += '<button class="rating-mini-btn ' + (st.rating === n ? 'active' : '') + '" id="emrt-' + pid + '-' + n + '" onclick="emSetRating(' + q + pid + q + ',' + n + ')">' + n + '</button>';
    });
    html += '</div>';
    html += '</div>';
    return html;
  }).join('');
}

function emUpdateStat(pid, stat, delta) {
  if (!_editMatchPlayerStats[pid]) return;
  _editMatchPlayerStats[pid][stat] = Math.max(0, (_editMatchPlayerStats[pid][stat] || 0) + delta);
  var el = document.getElementById('emst-' + stat + '-' + pid);
  if (el) el.textContent = _editMatchPlayerStats[pid][stat];
}

function emToggleCard(pid, type) {
  if (!_editMatchPlayerStats[pid]) return;
  _editMatchPlayerStats[pid][type + '_card'] = !_editMatchPlayerStats[pid][type + '_card'];
  // Re-render la ligne du joueur
  var row = document.getElementById('emps-' + pid);
  if (row) {
    var tmp = document.createElement('div');
    tmp.innerHTML = renderEditMatchPlayerStats();
    var newRow = tmp.querySelector('#emps-' + pid);
    if (newRow) row.replaceWith(newRow);
  }
}

function emSetRating(pid, val) {
  if (!_editMatchPlayerStats[pid]) return;
  _editMatchPlayerStats[pid].rating = _editMatchPlayerStats[pid].rating === val ? 0 : val;
  // Mettre à jour les boutons de note
  [3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10].forEach(function(n) {
    var btn = document.getElementById('emrt-' + pid + '-' + n);
    if (btn) btn.classList.toggle('active', n === _editMatchPlayerStats[pid].rating);
  });
}

async function saveEditMatch(matchId) {
  var result = document.getElementById('m-match-result')?.value;
  if (!result) { showToast('Sélectionne un résultat', 'warning'); return; }

  // Reconstruire player_stats
  var playerStats = Object.entries(_editMatchPlayerStats).map(function(entry) {
    var pid = entry[0]; var st = entry[1];
    return {
      player_id: pid,
      build_id: st.build_id || null,
      goals: st.goals || 0,
      assists: st.assists || 0,
      saves: st.saves || 0,
      yellow_card: st.yellow_card || false,
      red_card: st.red_card || false,
      rating: st.rating || 0,
    };
  });

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
    formation: document.getElementById('em-formation')?.value?.trim() || null,
    opp_formation: document.getElementById('em-opp-formation')?.value?.trim() || null,
    my_rank: parseInt(document.getElementById('em-my-rank')?.value) || null,
    opp_rank: parseInt(document.getElementById('em-opp-rank')?.value) || null,
    attack1_instruction: document.getElementById('em-attack1-instruction')?.value || 'Off',
    attack1_target: document.getElementById('em-attack1-target')?.value || null,
    attack2_instruction: document.getElementById('em-attack2-instruction')?.value || 'Off',
    attack2_target: document.getElementById('em-attack2-target')?.value || null,
    defence1_instruction: document.getElementById('em-defence1-instruction')?.value || 'Off',
    defence1_target: document.getElementById('em-defence1-target')?.value || null,
    defence2_instruction: document.getElementById('em-defence2-instruction')?.value || 'Off',
    defence2_target: document.getElementById('em-defence2-target')?.value || null,
    substitutions: _editMatchSubs,
    player_stats: playerStats,
    man_of_match: document.getElementById('em-motm')?.value || null,
    note: parseInt(document.getElementById('em-note')?.value) || 3,
    repeated_opponent: document.getElementById('em-repeated')?.checked || false,
    match_status: document.getElementById('em-match-status')?.value || 'termine',
  };

  try {
    await Matches.update(matchId, data);
    State.matches = await Matches.getAll();
    closeModal();
    render();
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

var _saisonTab = 'resume';

function setSaisonTab(tab) {
  _saisonTab = tab;
  var el = document.getElementById('saison-content');
  if (el) el.innerHTML = renderSaisonContent();
  document.querySelectorAll('.saison-tab-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
}

function renderSaison() {
  var matches = filterStatsMatches(State.matches);
  if (matches.length === 0) {
    return '<div class="saison-page"><div class="empty-state"><i class="ti ti-trophy" style="font-size:36px;color:var(--border)"></i><p>Aucun match enregistré</p></div></div>';
  }
  var q = String.fromCharCode(39);
  var html = '<div class="saison-page"><style>';
  html += '.saison-page{padding:0 14px 12px;height:calc(100vh - 60px);overflow-y:hidden;display:flex;flex-direction:column}';
  html += '.saison-tabs{display:flex;border-bottom:1px solid var(--border);margin-bottom:0;flex-shrink:0}';
  html += '.saison-tab-btn{flex:1;padding:10px 0;font-size:12px;font-weight:600;color:var(--muted);background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;transition:all .15s}';
  html += '.saison-tab-btn.active{color:var(--accent);border-bottom-color:var(--accent)}';
  html += '.saison-content{flex:1;overflow-y:auto;padding:14px 0}';
  html += '.saison-player-card{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px 12px}';
  html += '.saison-card-header{display:flex;gap:10px;align-items:flex-start;margin-bottom:8px}';
  html += '.saison-card-info{flex:1;min-width:0}';
  html += '.saison-build-row{background:var(--surface3);border-radius:6px;padding:6px 8px}';
  html += '</style>';
  html += '<div class="saison-tabs">';
  html += '<button class="saison-tab-btn' + (_saisonTab==='resume'?' active':'') + '" data-tab="resume" onclick="setSaisonTab(' + q + 'resume' + q + ')">📊 Résumé</button>';
  html += '<button class="saison-tab-btn' + (_saisonTab==='awards'?' active':'') + '" data-tab="awards" onclick="setSaisonTab(' + q + 'awards' + q + ')">🏅 Awards</button>';
  html += '<button class="saison-tab-btn' + (_saisonTab==='top5'?' active':'') + '" data-tab="top5" onclick="setSaisonTab(' + q + 'top5' + q + ')">👥 Top 5</button>';
  html += '</div>';
  html += '<div class="saison-content" id="saison-content">' + renderSaisonContent() + '</div>';
  html += '</div>';
  return html;
}

function renderSaisonContent() {
  var matches = filterStatsMatches(State.matches);
  var gs = Analyse.globalStats(matches);
  var serie = Analyse.series(matches);
  var byPlayer = Analyse.byPlayer(matches);

  var playerData = {};
  matches.forEach(function(m) {
    var isCleanSheet = (m.score_against || 0) === 0;
    (m.player_stats || []).forEach(function(ps) {
      if (!ps.player_id) return;
      if (!playerData[ps.player_id]) playerData[ps.player_id] = {
        player_id: ps.player_id, matches: 0, wins: 0, goals: 0, assists: 0,
        saves: 0, ratings: [], cleanSheets: 0, build_ids: {}
      };
      var pd = playerData[ps.player_id];
      pd.matches++;
      if (m.result === 'V') pd.wins++;
      pd.goals += ps.goals || 0;
      pd.assists += ps.assists || 0;
      pd.saves += ps.saves || 0;
      if (ps.rating > 0) pd.ratings.push(ps.rating);
      if (isCleanSheet) pd.cleanSheets++;
      if (ps.build_id) pd.build_ids[ps.build_id] = (pd.build_ids[ps.build_id] || 0) + 1;
    });
  });

  var ranked = Object.values(playerData).filter(function(p) { return p.matches >= 1; }).map(function(p) {
    var avgRating = p.ratings.length > 0 ? p.ratings.reduce(function(a,b){return a+b;},0)/p.ratings.length : 0;
    var winRate = p.matches > 0 ? p.wins/p.matches*100 : 0;
    var csRate = p.matches > 0 ? p.cleanSheets/p.matches*100 : 0;
    var cards = State.cards[p.player_id] || [];
    var card = cards[0];
    var pos = card && card.efhub_stats ? (card.efhub_stats.position || '') : '';
    var score = compositeScore(avgRating, winRate, p.goals/p.matches, p.assists/p.matches, csRate, pos, p.saves/p.matches);
    var topBuildId = Object.entries(p.build_ids).sort(function(a,b){return b[1]-a[1];})[0]?.[0] || null;
    return Object.assign({}, p, { avgRating: avgRating.toFixed(1), winRate: Math.round(winRate), csRate: Math.round(csRate), score: Math.round(score*10)/10, topBuildId, position: pos });
  }).sort(function(a,b){ return b.score - a.score; });

  function getBestBuildForStat(playerId, stat) {
    var buildStats = {};
    matches.forEach(function(m) {
      (m.player_stats || []).forEach(function(ps) {
        if (ps.player_id !== playerId || !ps.build_id) return;
        if (!buildStats[ps.build_id]) buildStats[ps.build_id] = 0;
        buildStats[ps.build_id] += ps[stat] || 0;
      });
    });
    return Object.entries(buildStats).sort(function(a,b){return b[1]-a[1];})[0]?.[0] || null;
  }

  function buildCardHtml(playerId, buildId, extraInfo) {
    var player = State.players.find(function(x) { return x.id === playerId; });
    var cards = State.cards[playerId] || [];
    var card = cards[0];
    var allBuilds = cards.flatMap(function(c) { return State.builds[c.id] || []; });
    var build = allBuilds.find(function(b) { return b.id === buildId; }) || allBuilds[0];
    var pos = card?.efhub_stats?.position || '';
    var cardType = card?.card_type || '';
    var efhubId = player ? Efhub.parseId(player.efhub_url || '') : null;
    var imgUrl = efhubId ? Efhub.imgUrl(efhubId) : null;
    var sliders = build ? (build.sliders || {}) : {};
    var ptsUsed = build ? Progression.totalPoints(sliders) : 0;
    var ptsMax = card?.points_max || 0;
    var activeSliders = SLIDERS_CONFIG.filter(function(s) { return (sliders[s.key]||0) > 0; });
    var cardColors = { 'Legendary':'#f59e0b','Iconic Moment':'#a78bfa','Iconic':'#6366f1','Epic':'#ec4899','Featured':'#3b82f6','Standard':'#6b7280','Trending':'#10b981' };
    var cardColor = cardColors[cardType] || 'var(--accent)';
    var h = '<div class="saison-player-card">';
    h += '<div class="saison-card-header">';
    if (imgUrl) h += '<img src="' + imgUrl + '" style="width:44px;height:56px;border-radius:6px;object-fit:cover;border:2px solid ' + cardColor + '" onerror="this.style.display=\'none\'">';
    h += '<div class="saison-card-info">';
    h += '<div style="font-size:13px;font-weight:800;color:#fff">' + (player ? player.name.toUpperCase() : '?') + '</div>';
    h += '<div style="font-size:10px;color:' + cardColor + ';font-weight:700">' + pos + ' · ' + cardType + '</div>';
    h += '<div style="font-size:11px;color:var(--muted);margin-top:2px">' + extraInfo + '</div>';
    h += '</div></div>';
    if (build) {
      h += '<div class="saison-build-row">';
      h += '<span style="font-size:10px;color:var(--muted)">' + build.name + ' · ' + ptsUsed + '/' + ptsMax + ' pts</span>';
      h += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px">';
      activeSliders.forEach(function(s) {
        h += '<div style="display:flex;flex-direction:column;align-items:center;gap:1px">';
        h += '<div style="color:var(--accent);font-size:14px">' + s.icon + '</div>';
        h += '<span style="font-size:11px;font-weight:700;color:#fff">' + (sliders[s.key]||0) + '</span>';
        h += '</div>';
      });
      if (activeSliders.length === 0) h += '<span style="font-size:10px;color:var(--muted)">Aucun clic</span>';
      h += '</div></div>';
    }
    h += '</div>';
    return h;
  }

  // ── Résumé ──
  if (_saisonTab === 'resume') {
    var bestMatch = matches.filter(function(m){return m.result==='V';}).sort(function(a,b){return (b.score_for-b.score_against)-(a.score_for-a.score_against);})[0];
    var worstMatch = matches.filter(function(m){return m.result==='D';}).sort(function(a,b){return (a.score_for-a.score_against)-(b.score_for-b.score_against);})[0];
    // Calcul clean sheets équipe
    var csCount = matches.filter(function(m){ return m.result === 'V' && (m.score_against === 0 || m.score_against === '0'); }).length;
    var csCountAll = matches.filter(function(m){ return m.score_against === 0 || m.score_against === '0'; }).length;
    var csRate = gs.total > 0 ? Math.round(csCountAll / gs.total * 100) : 0;

    var html = '<div style="display:flex;flex-direction:column;gap:12px">';
    html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">';
    html += '<div style="background:var(--surface2);border-radius:10px;padding:14px;text-align:center;border-left:3px solid #34d399"><div style="font-size:24px;font-weight:800;color:#34d399">' + gs.winRate + '%</div><div style="font-size:11px;color:var(--muted)">Taux de victoire</div><div style="font-size:11px;color:var(--muted)">' + gs.wins + 'V · ' + gs.draws + 'N · ' + gs.losses + 'D</div></div>';
    html += '<div style="background:var(--surface2);border-radius:10px;padding:14px;text-align:center;border-left:3px solid #a78bfa"><div style="font-size:24px;font-weight:800;color:#a78bfa">' + serie.record + '</div><div style="font-size:11px;color:var(--muted)">Série record</div><div style="font-size:11px;color:var(--muted)">Actuelle : ' + serie.current + '</div></div>';
    html += '<div style="background:var(--surface2);border-radius:10px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800">' + gs.goalsFor + '</div><div style="font-size:11px;color:var(--muted)">Buts marqués</div><div style="font-size:11px;color:var(--muted)">' + (gs.total > 0 ? (gs.goalsFor/gs.total).toFixed(1) : 0) + '/match</div></div>';
    html += '<div style="background:var(--surface2);border-radius:10px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800">' + gs.total + '</div><div style="font-size:11px;color:var(--muted)">Matchs joués</div><div style="font-size:11px;color:var(--muted)">' + gs.goalsAgainst + ' buts enc.</div></div>';
    html += '<div style="background:var(--surface2);border-radius:10px;padding:14px;text-align:center;border-left:3px solid #2dd4bf"><div style="font-size:24px;font-weight:800;color:#2dd4bf">' + csCountAll + '</div><div style="font-size:11px;color:var(--muted)">Clean Sheets</div><div style="font-size:11px;color:var(--muted)">' + csRate + '% des matchs</div></div>';
    html += '<div style="background:var(--surface2);border-radius:10px;padding:14px;text-align:center;border-left:3px solid #f59e0b"><div style="font-size:24px;font-weight:800;color:#f59e0b">' + csCount + '</div><div style="font-size:11px;color:var(--muted)">CS en victoire</div><div style="font-size:11px;color:var(--muted)">' + (gs.wins > 0 ? Math.round(csCount/gs.wins*100) : 0) + '% des victoires</div></div>';
    html += '</div>';
    if (bestMatch) html += '<div style="background:var(--surface2);border-radius:10px;padding:12px;border-left:3px solid #34d399"><div style="font-size:10px;color:var(--muted);margin-bottom:4px">🏅 Meilleur match</div><div style="font-size:14px;font-weight:700">' + (bestMatch.score_for||0) + ' – ' + (bestMatch.score_against||0) + ' <span style="font-size:12px;color:var(--muted)">vs ' + (bestMatch.opp_name||'?') + '</span></div></div>';
    if (worstMatch) html += '<div style="background:var(--surface2);border-radius:10px;padding:12px;border-left:3px solid #f87171"><div style="font-size:10px;color:var(--muted);margin-bottom:4px">💔 Match le plus difficile</div><div style="font-size:14px;font-weight:700">' + (worstMatch.score_for||0) + ' – ' + (worstMatch.score_against||0) + ' <span style="font-size:12px;color:var(--muted)">vs ' + (worstMatch.opp_name||'?') + '</span></div></div>';
    html += '</div>';
    return html;
  }

  // ── Awards ──
  if (_saisonTab === 'awards') {
    var topScorer = [...byPlayer].sort(function(a,b){return b.goals-a.goals;})[0];
    var topAssist = [...byPlayer].sort(function(a,b){return b.assists-a.assists;})[0];
    var topRating = [...byPlayer].filter(function(p){return p.avgRating>0;}).sort(function(a,b){return b.avgRating-a.avgRating;})[0];
    var topSaves  = [...byPlayer].sort(function(a,b){return b.saves-a.saves;})[0];
    var topCS = ranked.filter(function(p){return p.matches>=3;}).sort(function(a,b){return b.csRate-a.csRate;})[0];
    var awardsData = [
      { emoji:'🏆', label:'Joueur de la saison', player:ranked[0], info:ranked[0]?'Score: '+ranked[0].score+' · '+ranked[0].winRate+'% victoires':'', buildId:ranked[0]?ranked[0].topBuildId:null },
      { emoji:'⚽', label:'Meilleur buteur', player:topScorer, info:topScorer?topScorer.goals+' buts':'', buildId:topScorer?getBestBuildForStat(topScorer.player_id,'goals'):null },
      { emoji:'🎯', label:'Meilleur passeur', player:topAssist, info:topAssist?topAssist.assists+' passes':'', buildId:topAssist?getBestBuildForStat(topAssist.player_id,'assists'):null },
      { emoji:'★',  label:'Meilleure note', player:topRating, info:topRating?'★ '+topRating.avgRating+'/10':'', buildId:topRating?getBestBuildForStat(topRating.player_id,'rating'):null },
      { emoji:'🧤', label:'Meilleur GK', player:topSaves, info:topSaves&&topSaves.saves>0?topSaves.saves+' arrêts':'', buildId:topSaves?getBestBuildForStat(topSaves.player_id,'saves'):null },
      { emoji:'🛡️', label:'Meilleur défenseur', player:topCS, info:topCS?topCS.csRate+'% clean sheets':'', buildId:topCS?topCS.topBuildId:null },
    ].filter(function(a){return a.player;});
    var ahtml = '<div style="display:flex;flex-direction:column;gap:12px">';
    awardsData.forEach(function(award) {
      ahtml += '<div><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font-size:20px">' + award.emoji + '</span><span style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">' + award.label + '</span></div>';
      ahtml += buildCardHtml(award.player.player_id, award.buildId||award.player.topBuildId, award.info) + '</div>';
    });
    ahtml += '</div>';
    return ahtml;
  }

  // ── Top 5 ──
  if (_saisonTab === 'top5') {
    var medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
    var thtml = '<div style="display:flex;flex-direction:column;gap:12px">';
    ranked.slice(0,5).forEach(function(p, idx) {
      var info = 'Score: '+p.score+' · ★ '+p.avgRating+' · '+p.winRate+'% V · ⚽'+p.goals+' · 🎯'+p.assists;
      thtml += '<div style="position:relative"><div style="position:absolute;top:8px;left:8px;font-size:18px;z-index:1">' + medals[idx] + '</div><div style="padding-left:34px">' + buildCardHtml(p.player_id, p.topBuildId, info) + '</div></div>';
    });
    if (ranked.length === 0) thtml += '<div style="text-align:center;color:var(--muted);padding:20px">Pas assez de données</div>';
    thtml += '</div>';
    return thtml;
  }
  return '';
}

function renderCoachs() {
  var q = String.fromCharCode(39);
  var activeCoachId = getActiveCoachId();
  var coaches = State.coaches;

  var html = '<div class="coachs-page">';
  html += '<style>';
  html += '.coachs-page{padding:10px 14px;height:calc(100vh - 80px);overflow-y:auto}';
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
  html += '.an-bar-wrap{flex:1;height:6px;border-radius:3px;background:var(--surface);overflow:hidden;display:flex;min-width:60px}';
  html += '.an-seg-w{background:#34d399;height:100%}.an-seg-d{background:#f59e0b;height:100%}.an-seg-l{background:#f87171;height:100%}';
  html += '</style>';

  html += '<div class="coachs-header">';
  html += '<span class="coachs-title"><i class="ti ti-whistle"></i> Coachs (' + coaches.length + ')</span>';
  html += '<button class="btn-sm btn-primary" onclick="openModal(' + q + 'addCoach' + q + ')"><i class="ti ti-plus"></i> Ajouter</button>';
  html += '</div>';

  if (coaches.length === 0) {
    html += '<div class="empty-state"><i class="ti ti-whistle" style="font-size:36px;color:var(--border)"></i><p>Aucun coach enregistré</p><button class="btn-sm btn-primary" onclick="openModal(' + q + 'addCoach' + q + ')">+ Ajouter un coach</button></div>';
  } else {

    // ── Dashboard coach ──────────────────────────────────────────────────────
    var coachesWithMatches = coaches.filter(function(c) {
      return State.matches.some(function(m) { return m.coach_id === c.id; });
    });

    if (coachesWithMatches.length > 0) {
      html += '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px 14px;margin-bottom:12px">';
      html += '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px"><i class="ti ti-chart-bar"></i> Taux de victoire par coach</div>';

      // Graphique barres SVG
      var chartCoaches = coachesWithMatches.map(function(c) {
        var cm = State.matches.filter(function(m) { return m.coach_id === c.id; });
        var st = Analyse.globalStats(cm);
        return { name: c.name, style: c.style || '', winRate: st.winRate, wins: st.wins, total: st.total, draws: st.draws, losses: st.losses };
      }).sort(function(a, b) { return b.winRate - a.winRate; });

      var barH = 18;
      var gap = 5;
      var labelW = 100;
      var chartW = 220;
      var svgH = chartCoaches.length * (barH + gap) + 4;

      html += '<div style="overflow-x:auto">';
      html += '<svg width="100%" viewBox="0 0 ' + (labelW + chartW + 60) + ' ' + svgH + '" style="max-height:120px;overflow:visible">';
      chartCoaches.forEach(function(c, i) {
        var y = i * (barH + gap);
        var wW = Math.round(c.wins / c.total * chartW);
        var dW = Math.round(c.draws / c.total * chartW);
        var lW = chartW - wW - dW;
        var isActive = coachesWithMatches.find(function(x) { return x.name === c.name; })?.id === activeCoachId;

        // Label
        html += '<text x="' + (labelW - 6) + '" y="' + (y + barH/2 + 4) + '" text-anchor="end" font-size="11" fill="' + (isActive ? 'var(--accent)' : '#ccc') + '" font-weight="' + (isActive ? '700' : '400') + '">' + c.name.substring(0, 14) + '</text>';
        // Barre W
        html += '<rect x="' + labelW + '" y="' + y + '" width="' + wW + '" height="' + barH + '" rx="3" fill="#34d399"/>';
        // Barre D
        html += '<rect x="' + (labelW + wW) + '" y="' + y + '" width="' + dW + '" height="' + barH + '" fill="#f59e0b"/>';
        // Barre L
        html += '<rect x="' + (labelW + wW + dW) + '" y="' + y + '" width="' + lW + '" height="' + barH + '" rx="3" fill="#f87171" transform="translate(' + lW + ',0) scale(-1,1) translate(-' + lW + ',0)" style="transform-origin:' + (labelW + wW + dW + lW/2) + 'px ' + (y + barH/2) + 'px"/>';
        // % label
        html += '<text x="' + (labelW + chartW + 6) + '" y="' + (y + barH/2 + 4) + '" font-size="11" fill="#34d399" font-weight="700">' + c.winRate + '%</text>';
        // Matchs
        html += '<text x="' + (labelW + chartW + 38) + '" y="' + (y + barH/2 + 4) + '" font-size="10" fill="var(--muted)">' + c.total + 'J</text>';
      });
      html += '</svg>';
      html += '</div>';

      // Légende
      html += '<div style="display:flex;gap:12px;margin-top:8px;font-size:10px;color:var(--muted)">';
      html += '<span><span style="display:inline-block;width:10px;height:10px;background:#34d399;border-radius:2px;margin-right:3px"></span>Victoire</span>';
      html += '<span><span style="display:inline-block;width:10px;height:10px;background:#f59e0b;border-radius:2px;margin-right:3px"></span>Nul</span>';
      html += '<span><span style="display:inline-block;width:10px;height:10px;background:#f87171;border-radius:2px;margin-right:3px"></span>Défaite</span>';
      html += '</div>';
      html += '</div>';
    }

    // ── Liste des coachs ─────────────────────────────────────────────────────
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
        html += '<span class="coach-stat win">' + stats.winRate + '% victoires</span>';
        html += '<span class="coach-stat">' + stats.goalsFor + ' buts</span>';
        html += '<span class="coach-stat serie">⚡ Série record: ' + serie.record + '</span>';
        if (serie.current > 0) html += '<span class="coach-stat serie-current">→ Actuelle: ' + serie.current + '</span>';
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
      showToast('Coach supprimé', 'success');
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
    '<div class="modal-body">' +

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
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}

async function updateCoach(coachId) {
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
    await Coaches.update(coachId, data);
    State.coaches = await Coaches.getAll();
    closeModal();
    render();
  } catch(e) { showToast('Erreur : ' + e.message, 'error'); }
}
