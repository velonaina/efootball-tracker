// ─────────────────────────────────────────────────────────────────────────────
// efb-ui.js — eFootball Tracker · Couche interface
// ─────────────────────────────────────────────────────────────────────────────

// ── État global ───────────────────────────────────────────────────────────────
const State = {
  players: [],
  cards: {},       // { playerId: [cards] }
  builds: {},      // { cardId: [builds] }
  matches: [],
  selectedPlayerId: null,
  selectedCardId: null,
  selectedBuildId: null,
  activeTab: 'effectif', // effectif | analyse | matchs
  activePlayerTab: 'stats', // stats | builds | matchs
  loading: false,
};

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  renderSkeleton();
  try {
    State.players = await Players.getAll();
    State.matches = await Matches.getAll();
    // Charger les cartes de TOUS les joueurs pour la sidebar
    const allCards = await Cards.getAll();
    allCards.forEach(c => {
      if (!State.cards[c.player_id]) State.cards[c.player_id] = [];
      if (!State.cards[c.player_id].find(x => x.id === c.id)) {
        State.cards[c.player_id].push(c);
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

// ── Render principal ──────────────────────────────────────────────────────────
function render() {
  document.getElementById('app').innerHTML = `
    ${renderTopbar()}
    ${renderNav()}
    <div class="app-body">
      ${State.activeTab === 'effectif' ? renderEffectif() : ''}
      ${State.activeTab === 'analyse'  ? renderAnalyse() : ''}
      ${State.activeTab === 'matchs'   ? renderMatchsGlobal() : ''}
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
      <span class="topbar-squad">Real Madrid</span>
    </header>
  `;
}

// ── Navigation ────────────────────────────────────────────────────────────────
function renderNav() {
  const tabs = [
    { id: 'effectif', label: 'Effectif', icon: 'ti-users' },
    { id: 'analyse',  label: 'Analyse',  icon: 'ti-chart-bar' },
    { id: 'matchs',   label: 'Matchs',   icon: 'ti-ball-football' },
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
              <div class="build-slider-svg">${s.icon}</div>
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
  // Bouton edit ajouté dans le rendu
  const resultClass = match.result === 'V' ? 'win' : match.result === 'N' ? 'draw' : 'loss';
  const resultLabel = match.result === 'V' ? 'V' : match.result === 'N' ? 'N' : 'D';
  const buildName = match.efb_builds?.name || '—';
  const date = new Date(match.played_at).toLocaleDateString('fr-FR');

  return `
    <div class="match-row">
      <div class="match-result ${resultClass}">${resultLabel}</div>
      <div class="match-info">
        <span class="match-score">${match.score_for} – ${match.score_against}</span>
        <span class="match-meta">${buildName} · ${date}</span>
      </div>
      <span class="match-rank">${match.rank || '—'}</span>
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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
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
  const stats = Analyse.globalStats(State.matches);
  const serie = Analyse.series(State.matches);
  const byRank = Analyse.byRank(State.matches);

  return `
    <div class="analyse-page">
      <div class="kpi-grid">
        <div class="kpi">
          <div class="kpi-val">${stats.total}</div>
          <div class="kpi-label">Matchs joués</div>
        </div>
        <div class="kpi">
          <div class="kpi-val" style="color:#34d399">${stats.winRate}%</div>
          <div class="kpi-label">Taux de victoire</div>
        </div>
        <div class="kpi highlight">
          <div class="kpi-val" style="color:#a78bfa">${serie.current}</div>
          <div class="kpi-label">Série actuelle</div>
        </div>
        <div class="kpi highlight">
          <div class="kpi-val" style="color:#a78bfa">${serie.record}</div>
          <div class="kpi-label">Meilleur record</div>
        </div>
      </div>

      ${renderSerieBlock('Série en cours', serie.current, serie.currentMatches, 'actuelle')}
      ${serie.record > serie.current ? renderSerieBlock('Record', serie.record, serie.recordMatches, 'record') : ''}

      <!-- Bouton coaching IA -->
      <div class="coaching-block">
        <div class="coaching-header">
          <div>
            <div class="coaching-title">🤖 Coaching IA</div>
            <div class="coaching-subtitle">Analyse ta performance et recommandations personnalisées</div>
          </div>
          <button class="btn-sm btn-primary" onclick="generateCoaching()" id="btn-coaching">
            ✨ Générer
          </button>
        </div>
        <div id="coaching-result"></div>
      </div>

      <div class="analyse-section-title">Performance par rang</div>
      <div class="rank-block">
        ${byRank.length === 0
          ? `<div class="empty-state"><p>Aucune donnée</p></div>`
          : byRank.map(r => `
            <div class="rank-row">
              <span class="rank-name">${r.rank}</span>
              <div class="rank-bar-wrap">
                <div class="rank-seg-w" style="width:${r.wins/r.total*100}%"></div>
                <div class="rank-seg-d" style="width:${r.draws/r.total*100}%"></div>
                <div class="rank-seg-l" style="width:${r.losses/r.total*100}%"></div>
              </div>
              <span class="rank-pct">${r.winRate}%</span>
              <span class="rank-serie">Série: ${r.serie.record}</span>
            </div>
          `).join('')}
      </div>
    </div>
  `;
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
function renderMatchsGlobal() {
  return `
    <div class="matchs-page">
      <div class="matchs-page-header">
        <span class="matchs-count">${State.matches.length} match${State.matches.length > 1 ? 's' : ''}</span>
        <button class="btn-sm btn-primary" onclick="openModal('addMatch',null)">
          + Enregistrer
        </button>
      </div>
      <div class="match-list">
        ${State.matches.length === 0
          ? `<div class="empty-state"><p>Aucun match enregistré</p></div>`
          : State.matches.map(m => renderMatchRow(m)).join('')}
      </div>
    </div>
  `;
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
                <div class="build-slider-svg-icon">${s.icon}</div>
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

// Clé localStorage pour mémoriser la dernière composition
var LINEUP_STORAGE_KEY = 'efb_last_lineup';

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
  // Les 12 premiers vont en titulaires (par défaut), le reste en remplaçants
  // L'utilisateur peut les déplacer dans le modal
  // On respecte la composition sauvegardée si elle existe
  var saved = null;
  try {
    var s = localStorage.getItem(LINEUP_STORAGE_KEY);
    if (s) saved = JSON.parse(s);
  } catch(e) {}

  if (saved && saved.titulaires && saved.titulaires.length > 0) {
    // Utiliser la dernière composition connue
    var allPids = State.players.map(function(p) { return p.id; });
    var allCids = Object.values(State.cards).flat().map(function(c) { return c.id; });
    _matchTitulaires = (saved.titulaires || []).filter(function(s) {
      return allPids.includes(s.player_id) && allCids.includes(s.card_id);
    });
    _matchRemplacants = (saved.remplacants || []).filter(function(s) {
      return allPids.includes(s.player_id) && allCids.includes(s.card_id);
    });
    // Mettre à jour les build_id depuis Squad 23
    _matchTitulaires = _matchTitulaires.map(function(sel) {
      var sq = _squad23.find(function(s) { return s.player_id === sel.player_id; });
      return { player_id: sel.player_id, card_id: sel.card_id, build_id: sq ? sq.build_id : null };
    });
    _matchRemplacants = _matchRemplacants.map(function(sel) {
      var sq = _squad23.find(function(s) { return s.player_id === sel.player_id; });
      return { player_id: sel.player_id, card_id: sel.card_id, build_id: sq ? sq.build_id : null };
    });
  } else if (_squad23.length > 0) {
    // Première fois — répartir depuis Squad 23
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

function renderModalAddMatch(buildId) {
  const allBuilds = Object.values(State.builds).flat();
  const allPlayers = State.players;
  _matchPlayerStats = {};
  _matchSubs = [];
  // Charger la Squad 23 dans titulaires/remplaçants
  loadSquad23IntoLineup();
  // Auto-init stats + instructions
  initMatchPlayerStatsFromLineup();
  setTimeout(applyLastInstructions, 80);

  const now = new Date();
  const todayDate = now.toISOString().split('T')[0];
  const nowTime = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');

  return `
    <div class="modal modal-lg">
      <div class="modal-header">
        <h3>Enregistrer un match</h3>
        <button class="btn-icon" onclick="closeModal()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">

        <!-- Infos générales -->
        <div class="form-row">
          <div class="form-group">
            <label>Adversaire</label>
            <input type="text" id="m-opp-name" class="form-input" placeholder="ex: FC Barcelona">
          </div>
          <div class="form-group">
            <label>Type de match</label>
            <select id="m-match-type" class="form-input">
              <option value="ligue_jcj_d1">🏆 Ligue JCJ D1</option>
              <option value="ligue_jcj_d2">🏆 Ligue JCJ D2</option>
              <option value="ligue_jcj_d3">🏆 Ligue JCJ D3</option>
              <option value="ligue_ia_d1">🤖 Ligue IA D1</option>
              <option value="ligue_ia_d2">🤖 Ligue IA D2</option>
              <option value="ligue_ia_d3">🤖 Ligue IA D3</option>
              <option value="event_jcj">🎯 Évènement JCJ</option>
              <option value="event_ia">🎯 Évènement IA</option>
              <option value="amical">🤝 Amical</option>
              <option value="my_league">⚽ My League</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Rang</label>
            <select id="m-match-rank" class="form-input">
              ${EFB_RANKS.map(r => `<option value="${r}">${r}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Date</label>
            <input type="date" id="m-match-date" class="form-input" value="${todayDate}">
          </div>
          <div class="form-group">
            <label>Heure</label>
            <input type="time" id="m-match-time" class="form-input" value="${nowTime}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Notre formation</label>
            <input type="text" id="m-formation" class="form-input" placeholder="ex: 4-3-3">
          </div>
          <div class="form-group">
            <label>Formation adverse</label>
            <input type="text" id="m-opp-formation" class="form-input" placeholder="ex: 4-4-2">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Mon rang</label>
            <input type="number" id="m-my-rank" class="form-input" placeholder="ex: 1250">
          </div>
          <div class="form-group">
            <label>Rang adverse</label>
            <input type="number" id="m-opp-rank" class="form-input" placeholder="ex: 1380">
          </div>
        </div>

        <!-- Résultat -->
        <div class="form-section-title">Résultat</div>
        <div class="form-row">
          <div class="form-group">
            <label>Résultat</label>
            <div class="result-selector">
              <button class="result-btn" data-val="V" onclick="selectResult('V')">Victoire</button>
              <button class="result-btn" data-val="N" onclick="selectResult('N')">Nul</button>
              <button class="result-btn" data-val="D" onclick="selectResult('D')">Défaite</button>
            </div>
            <input type="hidden" id="m-match-result" value="">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Buts marqués</label>
            <input type="number" id="m-score-for" class="form-input" min="0" value="0">
          </div>
          <div class="form-group">
            <label>Buts encaissés</label>
            <input type="number" id="m-score-against" class="form-input" min="0" value="0">
          </div>
        </div>

        <!-- Titulaires -->
        <div class="form-section-title">🟢 Titulaires (11)</div>
        <div id="m-titu-list">${renderMatchGroupList(_matchTitulaires, true)}</div>

        <!-- Remplaçants -->
        <div class="form-section-title">🔄 Remplaçants</div>
        <div id="m-rempl-list">${renderMatchGroupList(_matchRemplacants, false)}</div>

        <!-- Substitutions -->
        <div class="form-section-title">🔄 Substitutions</div>
        <div id="m-subs-list">${renderMatchSubsList()}</div>
        <button class="btn-sm btn-ghost" style="width:100%;margin-bottom:8px" onclick="addMatchSub()">
          + Ajouter substitution
        </button>

        <!-- Instructions -->
        <div class="form-section-title">Instructions individuelles</div>
        <div class="instructions-grid">
          ${['attack1','attack2','defence1','defence2'].map(slot => {
            const isAttack = slot.startsWith('attack');
            const options = isAttack ? EFB_ATTACK_INSTRUCTIONS : EFB_DEFENCE_INSTRUCTIONS;
            const label = slot === 'attack1' ? 'Attack 1' : slot === 'attack2' ? 'Attack 2'
                        : slot === 'defence1' ? 'Defence 1' : 'Defence 2';
            return `
              <div class="instruction-slot">
                <div class="instruction-slot-title">${label}</div>
                <select id="m-${slot}-instruction" class="form-input form-input-sm">
                  ${options.map(o => `<option value="${o}">${o}</option>`).join('')}
                </select>
                <select id="m-${slot}-target" class="form-input form-input-sm">
                  <option value="">Targeted Player</option>
                  ${allPlayers.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                </select>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Stats joueurs -->
        <div class="form-section-title">Stats individuelles par joueur</div>
        <div id="match-player-stats-list">${renderMatchPlayerStatsListV2()}</div>
        <button class="btn-sm btn-ghost" style="width:100%;margin-bottom:8px" onclick="addMatchPlayerStat()">
          + Ajouter un joueur
        </button>

        <!-- Homme du match + note -->
        <div class="form-row">
          <div class="form-group">
            <label>🏅 Homme du match</label>
            <select id="m-man-of-match" class="form-input">
              <option value="">— Aucun —</option>
              ${allPlayers.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Note globale (1-5)</label>
            <select id="m-note" class="form-input">
              <option value="3">3 — Moyen</option>
              <option value="1">1 — Très mauvais</option>
              <option value="2">2 — Mauvais</option>
              <option value="4">4 — Bon</option>
              <option value="5">5 — Excellent</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="m-repeated-opponent">
            Adversaire répétitif
          </label>
        </div>

      </div>
      <div class="modal-footer">
        <button class="btn-sm btn-ghost" onclick="closeModal()">Annuler</button>
        <button class="btn-sm btn-primary" onclick="saveMatch()">Enregistrer</button>
      </div>
    </div>
  `;
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
            ${[3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10].map(n => `
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
  const el = document.getElementById('mps-' + stat + '-' + pid);
  if (el) el.textContent = _matchPlayerStats[pid][stat];
}

function toggleMatchCard(pid, type) {
  if (!_matchPlayerStats[pid]) return;
  _matchPlayerStats[pid][type + '_card'] = !_matchPlayerStats[pid][type + '_card'];
  document.getElementById('match-player-stats-list').innerHTML = renderMatchPlayerStatsList();
}

function setMatchPlayerRating(pid, val) {
  if (!_matchPlayerStats[pid]) return;
  _matchPlayerStats[pid].rating = val;
  document.getElementById('match-player-stats-list').innerHTML = renderMatchPlayerStatsList();
}

function selectResult(val) {
  document.getElementById('m-match-result').value = val;
  document.querySelectorAll('.result-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.val === val);
  });
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
  } catch(e) { alert('Erreur : ' + e.message); }
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
  } catch(e) { alert('Erreur : ' + e.message); }
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
  } catch(e) { alert('Erreur : ' + e.message); }
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
  if (!result) { alert('Sélectionne un résultat'); return; }
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
  } catch(e) { alert('Erreur : ' + e.message); }
}

async function confirmDelete(type, id) {
  if (!confirm('Supprimer définitivement ?')) return;
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
  } catch(e) { alert('Erreur : ' + e.message); }
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
    var fields = [
      ['m-attack1-instruction', d.a1], ['m-attack1-target', d.a1t],
      ['m-attack2-instruction', d.a2], ['m-attack2-target', d.a2t],
      ['m-defence1-instruction', d.d1], ['m-defence1-target', d.d1t],
      ['m-defence2-instruction', d.d2], ['m-defence2-target', d.d2t],
    ];
    fields.forEach(function(f) {
      var el = document.getElementById(f[0]);
      if (el && f[1]) el.value = f[1];
    });
  } catch(e) {}
}

function toggleMatchPlayerCollapse(pid) {
  if (_matchPlayerStats[pid]) {
    _matchPlayerStats[pid]._collapsed = !_matchPlayerStats[pid]._collapsed;
    document.getElementById('match-player-stats-list').innerHTML = renderMatchPlayerStatsListV2();
  }
}

// 2. Nouveau rendu stats avec collapse
function renderMatchPlayerStatsListV2() {
  var q = String.fromCharCode(39);
  var pids = Object.keys(_matchPlayerStats);
  if (pids.length === 0) {
    return '<div style="color:var(--muted);font-size:11px;padding:6px 0">Aucun joueur — ajoute des titulaires</div>';
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
      [3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10].forEach(function(n) {
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
var SQUAD_STORAGE_KEY = 'efb_squad_23';
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
    alert('La sélection est déjà complète (23 joueurs)');
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
  if (!confirm('Effacer toute la composition ?')) return;
  _squad23 = [];
  saveSquad23();
  var el = document.getElementById('squad23-container');
  if (el) el.innerHTML = renderSquad23Section();
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
  } catch(e) { alert('Erreur : ' + e.message); }
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
      '<div class="form-group"><label>Rang</label><select id="em-rank" class="form-input">' +
        EFB_RANKS.map(function(r) { return '<option value="' + r + '"' + (match.rank === r ? ' selected' : '') + '>' + r + '</option>'; }).join('') +
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
  if (!result) { alert('Sélectionne un résultat'); return; }
  var data = {
    opp_name: document.getElementById('em-opp')?.value?.trim() || null,
    rank: document.getElementById('em-rank')?.value,
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
  } catch(e) { alert('Erreur : ' + e.message); }
}
