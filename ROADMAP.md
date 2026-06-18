# eFootball Tracker — Roadmap & Documentation

## État actuel du projet (v3.6)

### Stack technique
- **Frontend** : HTML / CSS / JavaScript vanilla (3 fichiers)
- **Base de données** : Supabase (PostgreSQL) — projet `hxrepxhtxksrxtjskkon`
- **Worker** : Cloudflare Workers `efhub-proxy` v13.2 — proxy efhub.com + Anthropic + Groq
- **Coaching IA** : Supabase Edge Function `coaching` — proxy API Anthropic Claude Sonnet 4.6
- **Chat tactique** : Cloudflare Worker `/chat` → Groq (Llama 3.1 8b Instant)
- **Icônes** : Tabler Icons (webfont CDN)
- **Repo** : `velonaina/efootball-tracker` (public — protégé par RLS)

### Fichiers du projet
| Fichier | Rôle |
|---|---|
| `efb-app.html` | App principale PC — HTML + CSS |
| `efb-data.js` | Couche données — Supabase CRUD + logique métier + Analyse + EFB_COACHES_DB |
| `efb-ui.js` | Interface — rendu + interactions (~9500 lignes) |
| `efb-live.html` | App mobile légère — saisie live pendant le match |
| `efhub-proxy-worker-v13.js` | Cloudflare Worker v13.2 — proxy efhub + Anthropic + Groq |
| `supabase/functions/coaching/index.ts` | Supabase Edge Function — coaching IA Claude Sonnet 4.6 |

---

## Fonctionnalités implémentées ✅

### Gestion des joueurs
- Import automatique depuis efhub.com (stats, style, type de carte, skills, level cap)
- Détection automatique Trending (level_cap = 1) — carte figée, non développable
- Photo automatique via efimg.com
- **Sidebar triée** par win rate → note moyenne → position tactique (`getSortedPlayers()`)
- **Indicateur de forme** — 5 derniers matchs en dots colorés V/N/D dans la sidebar
- **Build recommandé** — badge vert dans le header joueur avec meilleur win rate (min 3 matchs)
- CRUD complet (ajouter, modifier, supprimer)
- Fiche joueur avec onglet Matchs
- **Comparaison de builds** — bouton ⇄ sur chaque build card
- **GK Awareness** ajouté dans `EFB_STATS_ORDER` section Goalkeeping (bug fix)

### Système de points builds ✅ (v3.6)
- `calcBuildScore()` — score V/N/D avec bonus/malus :
  - Victoire = +3pts, Nul = +1pt, Défaite = 0pt
  - Malus note < 6/10 = -0.5pt
  - Bonus buts/passes par match
  - Bonus clean sheet %
- Fiabilité selon matchs : <3→40%, 3-9→70%, 10-19→90%, ≥20→100%
- Affichage ⭐ sur 5 + score /100 sur chaque build card
- Couleur : vert ≥4⭐, amber 3⭐, rouge <3⭐

### Build IA ✅ (v3.5)
- **Onglet dédié "Build IA"** dans la fiche joueur (4ème onglet)
- Suggestion build optimal via Claude Sonnet 4.6
- Contexte enrichi : stats efhub + projections sliders + coach + performance
- Règles priorité par position (13 pos), style de jeu (14 styles), style coach (5 styles)
- Validation JS budget — correction automatique si dépassement
- Badge `⚠ budget ajusté` si correction
- **Bouton "Enregistrer ce build"** → sauvegarde en Supabase
- **Chat conversationnel** avec rappel automatique points restants
- Mise à jour visuelle automatique via `<build>{...}</build>`
- Modèle : **claude-sonnet-4-6** — max 12 clics par slider
- Retry automatique via `fetchCoachingWithRetry()` (2 tentatives, 1.5s délai)

### Build cards — Stats enrichies ✅ (v3.5)
- Lookup via `player_stats[].build_id` (bug fix)
- 🎮 matchs · % V · ⭐ note moy · ⚽ buts · 🎯 passes · 🛡️ CS% · Série
- GK : arrêts + 🧤 CS% à la place buts/passes
- Score ⭐ V/N/D affiché sur chaque card

### Modal match ✅ (v3.6)
- 2 onglets : Match + Résumé
- **Popup rapide stats** — clic sur joueur terrain → popup draggable :
  - ⚽ Buts / 🎯 Passes (ou 🧤 Arrêts GK) avec `+/-` synchronisés
  - ⭐ Notes deux rangées `[4][4.5][5][5.5][6][6.5]` / `[7][7.5][8][8.5][9][9.5][10]`
  - 🔄 Remplacer — liste remplaçants triés par position compatible + minutes `45'→90'` par 5
  - Drag & drop sur le header du popup
  - Sync temps réel avec tableau général ET badge SVG terrain
- **Score adverse `+/-`** — boutons rapides sans saisie clavier
- **Swap titulaire** `⇄` — changer un joueur depuis le panneau stats (remplaçants seulement)
- **Changer de rôle** — picker position avec z-index 100000 (au-dessus modal)
- `displayLabel` — position_label prioritaire sur slot.label dans SVG
- Instructions individuelles 4 slots
- Notes joueurs 1-10 obligatoires pour titulaires statut `termine`
- **Instructions IA** — bouton `🪄 IA` rempli Attack/Defence + Targeted Player
  - Règles strictes par position (CF/SS/LWF/RWF : pas Attacking)
  - Target = joueurs sur terrain uniquement
  - Historique gagnant via `Analyse.byIndividualInstruction()`
- **Auto-sauvegarde brouillon** toutes les 5s (`efb_match_draft`)
- **Restauration draft** sans réinitialisation (`_matchRestoringDraft` flag)
- Save immédiat sur buts, notes, cartons

### Enregistrement des matchs ✅
- Score V/N/D auto-calculé
- Formation obligatoire
- `match_status` sauvegardé en Supabase
- Tags : 🔌 Interrompu / 🚪 Abandon

### Onglet Matchs ✅
- Pagination 50/page + "Voir plus"
- Filtres avancés : résultat, type, statut, coach, formation, recherche texte

### Analyse ✅
- KPIs globaux : Matchs, V%, N%, D%, Buts, Série, Record
- **Coaching IA** Claude Sonnet 4.6 — 4 modes, builds enrichis (buts/passes/notes/CS)
- Bug fix : lookup builds via `player_stats[].build_id`
- **Chat tactique Llama** 💬 (Groq) — interface WhatsApp

### Onglet Formation ✅ (v3.5-3.6)
- Terrain SVG drag & drop
- **Stats par slot** — win rate % affiché en vert sous chaque joueur (min 3 matchs)
- Vue Liste avec build affiché sous chaque joueur
- Tooltip survol terrain : `Nom — Build`
- **Formation IA** Claude Sonnet 4.6 :
  - Formations gagnantes (>60% V, min 5 matchs) priorisées
  - Joueurs rapides (speed/accel ≥80) identifiés pour Quick Counter
  - Priorité : stats builds → formations gagnantes → style coach → position
  - Panel analyse : 📐 Formation / ⚡ Atouts / 🎯 Instructions pour gagner
  - Panel sauvegardé `efb_ft_ia_analysis` — persiste entre sessions
  - Bouton 📋 toggle panel
- **Bouton 💾** → enregistrer comme formation personnalisée avec notes IA
- Formations perso affichent notes IA dans le picker
- **Bouton 📥 Charger** depuis Formation dans modal match
- **Bouton 💾 Sauvegarder** formation match comme défaut

### Onglet Saison ✅ (v3.6)
- 3 sous-onglets : Résumé / Awards / Top 5
- **KPIs résumé** : V%, Série record, Buts, Matchs joués
- **Clean Sheets équipe** : total CS + % matchs + CS en victoire
- Awards par position avec score composite

### Onglet Coachs ✅
- Dashboard graphique V/N/D
- CRUD complet, 64 coachs intégrés

### Synchronisation Squad 23 ✅ (v3.6)
- `resolveBuildId(player_id, card_id, squad23BuildId)` — fallback automatique premier build
- `syncNewPlayerToLineups(entry)` — nouveau joueur → slot vide ou banc (formation + match)
- `removeFromSquad23` → retire aussi de `_ftTitulaires`, `_ftRemplacants`, `_matchTitulaires`
- `updateSquad23Build` → sync immédiate formation + match + LINEUP_STORAGE_KEY
- Tri intelligent remplaçants par position compatible dans popup swap

### Backup Supabase ✅ (v3.6)
- `backupLocalStorageToSupabase()` — sauvegarde clés critiques dans `efb_app_state`
- `restoreLocalStorageFromSupabase()` — restauration au démarrage si localStorage vide
- Backup auto toutes les 5 minutes + immédiat après modif Squad 23
- Clés sauvegardées : squad_23, ft_lineup, last_lineup, custom_formations, active_coach, last_instructions, ft_ia_analysis

### Sécurité ✅
- RLS Supabase, clé `anon` publique protégée
- Clé Groq via Secrets Store Cloudflare
- Clé Anthropic via Supabase Edge Function

---

## Schéma Supabase v3

### Tables
| Table | Description |
|---|---|
| `efb_players` | Joueurs |
| `efb_cards` | Cartes — efhub_stats (json), level_cap, card_type, skills |
| `efb_builds` | Builds — sliders (json), additional_skills (json) |
| `efb_coaches` | Coachs — name, style, formation, notes |
| `efb_matches` | Matchs — player_stats (json) + coach_id + match_status |
| `efb_config` | Configuration |
| `efb_formations` | Formations personnalisées |
| `efb_app_state` | Sync globale + backup localStorage |

---

## localStorage keys

| Clé | Contenu |
|---|---|
| `efb_squad_23` | Squad 23 |
| `efb_last_lineup` | Dernière composition match |
| `efb_ft_lineup` | Composition Formation |
| `efb_last_instructions` | Dernières instructions individuelles |
| `efb_custom_formations` | Formations personnalisées (avec notes IA) |
| `efb_active_coach` | ID du coach actif |
| `efb_coaching_history` | Historique 5 derniers conseils IA |
| `efb_match_draft` | Brouillon match (auto-save 5s) |
| `efb_auth` | Token auth locale |
| `efb_ft_ia_analysis` | Dernière analyse IA formation |

---

## Modèles IA

| Fonction | Modèle | Route |
|---|---|---|
| Build IA — suggestion | claude-sonnet-4-6 | Supabase Edge `/coaching` |
| Build IA — chat | claude-sonnet-4-6 | Supabase Edge `/coaching` |
| Coaching IA général | claude-sonnet-4-6 | Supabase Edge `/coaching` |
| Formation IA | claude-sonnet-4-6 | Supabase Edge `/coaching` |
| Instructions IA | claude-sonnet-4-6 | Supabase Edge `/coaching` |
| Chat tactique | llama-3.1-8b-instant | Cloudflare Worker `/chat` → Groq |

---

## Bugs connus 🐛

| Bug | Fichier | Statut |
|---|---|---|
| Coach non affiché dans `renderMatchRow` | efb-data.js | À surveiller |
| Variables Cloudflare Secret/Text inaccessibles → Secrets Store | efhub-proxy | Contourné |

---

## Fonctionnalités en attente ⏳

### Priorité haute
- **Export PDF/CSV** — exporter les stats (peu urgent, données dans Supabase)

### Priorité moyenne
- **Historique des builds** — voir évolution d'un build dans le temps
- **Base coachs** — mise à jour depuis amine250.github.io/efootball-managers
- **Mémoire conversation Llama** — sauvegarder historique entre sessions
- **Enrichir contexte Llama** — formations utilisées + win rate par formation

### Priorité basse
- **Mode sombre/clair** — toggle thème
- **Multi-équipes** — supporter d'autres équipes
- **Raccourcis clavier** — `N` nouveau match, `S` sauvegarder, `Échap` fermer
- **Lazy loading photos** — performances chargement
- **Calendrier événements eFootball** — tracker événements en cours
- **Prédiction résultat** — Claude analyse avant match
- **Découpage modulaire `efb-ui.js`** (~9500 lignes) :
  - `efb-ui-match.js` — modal match, popup rapide, terrain
  - `efb-ui-analyse.js` — analyse, coaching, chat Llama
  - `efb-ui-saison.js` — saison, awards, top 5
  - `efb-ui-effectif.js` — effectif, builds, Build IA
  - `efb-ui-formation.js` — Formation IA, terrain, picker
  - `efb-ui-core.js` — init, State, navigation, utilitaires

### Nettoyage
- Supprimer `GEMINI_API_KEY_TEST` et `GROQ_API_KEY_TEXT` de Cloudflare
- Supprimer `openTop5Modal()` si non utilisé

---

## Règles importantes

### eFootball
- Level cap 1 = carte Trending (figée, non développable)
- Points max par level cap : 22→42, 25→48, 28→54, 30→58, 33→64, 35→68, 40→78
- Règle de clic : clics 1-4=1pt, 5-8=2pts, 9-12=3pts — max 12 clics par slider
- Notes eFootball : 1.0 à 10.0 par pas de 0.5 — 0 = non noté
- Additional skills : max 5 par carte (sauf Trending = 0)
- Rang/Difficulté visible uniquement pour `event_ia` et `my_league`
- Instructions Attack : Off / Defensive / Attacking / Anchoring
- Instructions Defence : Off / Tight Marking / Man Marking / Counter Target / Deep Line
- Instructions Attack par position :
  - GK : Off uniquement
  - CB/LB/RB : Off, Defensive
  - DMF : Off, Defensive, Anchoring
  - CMF/LMF/RMF : Off, Defensive, Attacking
  - AMF : Off, Attacking, Anchoring
  - LWF/RWF/CF/SS : Off, Defensive (Attacking interdit)
- Instructions Defence par position :
  - GK : Off uniquement
  - CB : Off, Tight Marking, Man Marking
  - LB/RB : Off, Tight Marking, Man Marking, Counter Target
  - DMF/CMF : Off, Tight Marking, Man Marking
  - AMF/LMF/RMF : Off, Man Marking, Counter Target
  - LWF/RWF/CF/SS : Off, Counter Target

### Développement
- Toujours valider JS avec `node --check fichier.js`
- Ne jamais utiliser backticks imbriqués dans template strings
- Utiliser `String.fromCharCode(39)` pour guillemets simples dans strings JS générées
- `efb-data.js` : logique métier + `EFB_COACHES_DB` + `Analyse.byIndividualInstruction()` + `Analyse.byDefensive()`
- `efb-ui.js` : tout le rendu + interactions + `compositeScore()` + `calcBuildScore()`
- `_matchFormState` + `_matchSummaryState` — lire en priorité dans `saveMatch()`
- `saveMatchFormState()` à chaque changement score/onglet
- Notes obligatoires uniquement pour titulaires en statut `termine`
- Matchs `interrompu_reseau` exclus via `filterStatsMatches()`
- Builds lookup : toujours via `player_stats[].build_id` — jamais `m.build_id`
- `resolveBuildId(player_id, card_id, squad23BuildId)` — à utiliser partout pour build_id
- `syncNewPlayerToLineups(entry)` — appelé à chaque ajout Squad 23
- `MATCH_DRAFT_KEY = 'efb_match_draft'` — autosave 5s
- `_matchRestoringDraft` flag — empêche réinit lors restauration draft
- `fetchCoachingWithRetry(body, maxRetries)` — tous les appels Claude passent par là
- `getSortedPlayers()` — tri sidebar win rate → note → position
- `calcBuildScore(matches, avgRating, csRate, goalsPerMatch, assistsPerMatch)` — score ⭐ builds
- `getBuildPriorityRules(pos, playingStyle, coachStyle)` — règles priorité Build IA
- `FT_IA_ANALYSIS_KEY = 'efb_ft_ia_analysis'` — analyse formation IA persistée
- `loadFtIAPanel()` — appelé au render onglet Formation
- `openQuickStatPopup(outPid, activePid, slotIdx, cx, cy)` — popup rapide terrain match
- `quickSub(outPid, inPid, slotIdx)` — substitution depuis popup
- `quickSetRating(pid, val)` — note depuis popup
- `adjustScoreAgainst(delta)` — score adverse +/-
- `backupLocalStorageToSupabase()` / `restoreLocalStorageFromSupabase()` — backup Supabase
- `BACKUP_KEYS` — liste clés localStorage sauvegardées

### Architecture CSS
- `.matchs-page { height: calc(100vh - 60px); overflow-y: auto; padding: 10px 14px }`
- `.modal-match-body { overflow-y: auto }` — scroll onglet Résumé
- `.fmpicker-overlay { z-index: 100000 }` — au-dessus modal match
- `.saison-page { height: calc(100vh - 60px); overflow-y: hidden; display: flex; flex-direction: column }`
- `.coaching-mode-btn` + `.coaching-mode-btn.active`
- `quick-stat-popup` z-index: 200000

### Cloudflare Worker v13.2
- Route `/coaching` → Anthropic API (`env.ANTHROPIC_API_KEY`)
- Route `/chat` → Groq API (`await env.GROQ_API_KEY.get()` — Secrets Store)
- Route `/` → efhub proxy
- Modèle Groq : `llama-3.1-8b-instant`

### Sécurité Supabase
- RLS activé sur toutes les tables
- Repo public — clé `anon` protégée par RLS

### Score composite par position (`compositeScore`)
| Position | Note | Victoires | Buts | Passes | CS | Arrêts |
|---|---|---|---|---|---|---|
| GK | 30% | 20% | 0% | 0% | 35% | 15% |
| CB/LB/RB | 35% | 25% | 5% | 5% | 30% | — |
| DMF/CMF | 35% | 25% | 15% | 15% | 10% | — |
| AMF/LMF/RMF | 35% | 25% | 20% | 10% | 10% | — |
| LWF/RWF/SS/CF | 40% | 25% | 20% | 10% | 5% | — |

### Styles de jeu coach
| Style adverse | Style recommandé |
|---|---|
| Possession Game | Quick Counter |
| Quick Counter | Long Ball Counter, Long Ball |
| Long Ball Counter | Possession Game, Out Wide |
| Out Wide | Quick Counter, Possession Game |
| Long Ball | Possession Game, Out Wide, Long Ball Counter |

## Formations supportées (20)
`4-3-3` · `4-3-3 ATT` · `4-3-3 DEF` · `4-4-2` · `4-4-2 FLAT` · `4-2-3-1` · `4-1-4-1` · `4-3-1-2` · `4-3-2-1` · `4-4-1-1` · `4-5-1` · `3-5-2` · `3-4-3` · `3-4-2-1` · `3-3-3-1` · `5-3-2` · `5-4-1` · `5-2-3` · `5-2-2-1` · `4-6-0`

## Positions efhub
`GK` · `CB` · `LB` · `RB` · `DMF` · `CMF` · `AMF` · `LMF` · `RMF` · `LWF` · `RWF` · `SS` · `CF`
