# eFootball Tracker — Roadmap & Documentation

## État actuel du projet (v3.5)

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
| `efb-ui.js` | Interface — rendu + interactions (~8500 lignes) |
| `efb-live.html` | App mobile légère — saisie live pendant le match |
| `efhub-proxy-worker-v13.js` | Cloudflare Worker v13.2 — proxy efhub + Anthropic + Groq |
| `supabase/functions/coaching/index.ts` | Supabase Edge Function — coaching IA Claude Sonnet 4.6 |

---

## Fonctionnalités implémentées ✅

### Gestion des joueurs
- Import automatique depuis efhub.com (stats, style, type de carte, skills, level cap)
- Détection automatique Trending (level_cap = 1) — carte figée, non développable
- Photo automatique via efimg.com
- Sidebar avec liste des joueurs + photo + badge card type + playing style
- CRUD complet (ajouter, modifier, supprimer)
- Fiche joueur avec onglet Matchs — filtre par `player_stats.player_id` + `build_id` global
- **Comparaison de builds** — bouton ⇄ sur chaque build card → modal côte à côte avec sliders, stats finales et taux de victoire
- **GK Awareness** ajouté dans `EFB_STATS_ORDER` section Goalkeeping (bug fix)

### Build IA ✅ (nouveau — v3.5)
- **Onglet dédié "Build IA"** dans la fiche joueur (4ème onglet après Stats/Builds/Matchs)
- **Bouton "Suggérer un build optimal"** → Claude Sonnet 4.6 analyse le joueur et propose un build
- Contexte enrichi envoyé à Claude :
  - Stats de base efhub + projections par slider (options 2/4/6/8/10/12 clics avec coût exact pré-calculé)
  - Performance du joueur (matchs, win rate, buts, passes, note moy)
  - Coach actif + style + formation
  - Builds existants avec win rate
  - Règles de priorité par position (13 positions), style de jeu (14 styles), style de coach (5 styles)
  - Règle de distribution : 60-70% sur sliders prioritaires, éviter de surbooster >90
- **Affichage visuel** style build card — photo joueur, icônes sliders, stats finales avec barres delta
- **Validation JS du budget** — si Claude dépasse le budget, correction automatique en réduisant les sliders les moins prioritaires
- Badge `⚠ budget ajusté` si correction appliquée
- **Bouton "Enregistrer ce build"** → nom pré-rempli avec date, sauvegarde en Supabase comme build normal
- **Chat conversationnel** sous le build suggéré :
  - Interface bulles style WhatsApp
  - Claude reçoit le contexte complet du joueur + build actuel suggéré
  - Rappel automatique des points restants à chaque message
  - Si Claude propose un nouveau build via `<build>{...}</build>` → mise à jour visuelle automatique
  - Bouton poubelle pour effacer la conversation
- Modèle : **claude-sonnet-4-6** (plus précis que haiku pour les calculs)
- Limite : 12 clics max par slider

### Build cards — Stats enrichies ✅ (nouveau — v3.5)
- Lookup corrigé : `player_stats[].build_id` au lieu de `m.build_id` (bug fix)
- Affichage par build : 🎮 matchs · % V · ⭐ note moy · ⚽ buts · 🎯 passes · 🛡️ CS% · Série
- GK : arrêts + 🧤 CS% à la place des buts/passes

### Modal match ✅
- 2 onglets : Match + Résumé avec sauvegarde d'état (`_matchFormState` + `_matchSummaryState`)
- Layout plein écran avec terrain interactif
- Substitutions avec minute éditable inline
- Instructions individuelles 4 slots
- Notes joueurs 1-10 — obligatoires uniquement pour titulaires en match **Terminé**
- Sélecteur coach pré-rempli avec coach actif
- **Statut du match** : Terminé / Abandon adverse (→ V forcé) / Interrompu réseau (→ exclu stats, notes optionnelles)
- **Auto-sauvegarde brouillon** toutes les 15s (`efb_match_draft`) — bannière de récupération au rechargement
- **Instructions individuelles IA** ✅ (nouveau — v3.5) :
  - Bouton `🪄 IA` dans le header "Instructions individuelles"
  - Claude Sonnet 4.6 analyse les 11 titulaires (position, style, stats) + coach actif
  - Remplit automatiquement Attack 1&2 / Defence 1&2 + Targeted Player
  - Règles strictes par position : CF/SS/LWF/RWF → pas d'Attacking ; GK → Off uniquement
  - Validation JS : `fixInstrByPos()` corrige les instructions invalides par position
  - Toast avec justification tactique

### Enregistrement des matchs ✅
- Score V/N/D auto-calculé
- Formation obligatoire
- `match_status` sauvegardé en Supabase
- Tags statut dans liste : 🔌 Interrompu / 🚪 Abandon

### Onglet Matchs ✅
- Pagination 50/page + bouton "Voir plus"
- Filtres avancés : résultat, type, statut, coach, formation, recherche texte
- Bouton reset visible seulement si filtre actif
- Clic sur match → détail lecture seule

### Analyse ✅
- KPIs globaux : Matchs, Victoires%, Nuls%, Défaites% (avec nombre entre parenthèses), Buts marqués, Buts encaissés, Série actuelle, Record
- Bouton 🏆 "Top 5 joueurs de la saison" → navigue vers onglet Saison
- **Coaching IA** (Claude Sonnet 4.6 via Supabase Edge Function) :
  - 4 modes : Général / Ligue JCJ / Évènement IA / My League
  - Contexte enrichi : dernier match, coach actif, stats par coach, builds avec stats individuelles (buts, passes, notes, CS)
  - Historique 5 derniers conseils en localStorage `efb_coaching_history`
  - Bug fix : lookup builds via `player_stats[].build_id`
- **Chat tactique Llama** 💬 (Groq) :
  - Interface bulles de conversation style WhatsApp
  - Contexte enrichi au premier message
  - Modèle : `llama-3.1-8b-instant` via Cloudflare Worker `/chat` → Groq
- Performance par type de match, rang, formation, build, coach
- **Performance défensive** par joueur : clean sheets%, buts encaissés/match, taux victoire
- **Instructions individuelles** : joueur + instruction → taux de victoire, buts
- **Comparaison de périodes** : N derniers vs N précédents OU par plage de dates
- **Dashboard coach** — graphique SVG barres V/N/D
- **Top arrêts GK** — colonne dédiée dans classements

### Onglet Formation ✅ (enrichi — v3.5)
- Terrain SVG interactif drag & drop
- Vue Liste avec nom du build affiché sous chaque joueur (titulaires + remplaçants)
- Tooltip au survol sur le terrain : `Nom — Build`
- **Formation IA** ✅ (nouveau — v3.5) :
  - Bouton `🪄 IA` dans la toolbar
  - Claude Sonnet 4.6 analyse le Squad 23 avec builds et stats développées par slider
  - Priorité : stats builds → style coach → position → historique victoires
  - Formations strictement limitées à la liste officielle eFootball (20 formations)
  - Positions depuis `POSITION_LABELS_BY_FORMATION` — jamais inventées par Claude
  - Déduplication du Squad 23 — un joueur = un slot maximum
  - Remplaçants auto-remplis avec les joueurs non titulaires
  - Panel d'analyse affiché sous le terrain :
    - 📐 Pourquoi cette formation
    - ⚡ Atouts clés
    - 🎯 Instructions pour gagner
  - Panel sauvegardé en localStorage `efb_ft_ia_analysis` — persiste entre sessions
  - Bouton 📋 dans toolbar pour toggle masquer/afficher le panel
- **Bouton 💾** dans toolbar → enregistre la formation comme formation personnalisée avec notes IA incluses
- Formations personnalisées affichent les notes IA (80 premiers caractères) dans le picker

### Onglet Saison ✅
- 3 sous-onglets : **📊 Résumé** / **🏅 Awards** / **👥 Top 5**
- Awards avec score composite adapté par position
- Top 5 avec médailles 🥇🥈🥉

### Onglet Coachs ✅
- Dashboard avec graphique barres V/N/D par coach
- Stats par coach, bouton Activer, CRUD complet
- Base intégrée de 64 coachs

### UX global ✅
- `showToast()` pour toutes les notifications
- `showConfirm()` pour toutes les suppressions
- `compositeScore()` — fonction centralisée pour le score composite adapté par position

### Sécurité ✅
- RLS activé sur toutes les tables Supabase
- Repo public — clé `anon` protégée par RLS
- Clé Groq via Secrets Store Cloudflare (jamais exposée)
- Clé Anthropic via Supabase Edge Function (jamais exposée côté client)

### App live mobile (efb-live.html) ✅
- Coach actif pré-rempli depuis `efb_active_coach`
- `coach_id` sauvegardé dans Supabase

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
| `efb_app_state` | Sync globale |

### Colonnes ajoutées manuellement
```sql
ALTER TABLE efb_matches ADD COLUMN IF NOT EXISTS match_status TEXT DEFAULT 'termine';
```

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
| `efb_coaching_history` | Historique des 5 derniers conseils IA |
| `efb_match_draft` | Brouillon match en cours (auto-sauvegarde 15s) |
| `efb_auth` | Token d'authentification locale |
| `efb_ft_ia_analysis` | Dernière analyse IA de formation (persistée) |

---

## Modèles IA utilisés

| Fonction | Modèle | Route |
|---|---|---|
| Build IA — suggestion | claude-sonnet-4-6 | Supabase Edge Function `/coaching` |
| Build IA — chat | claude-sonnet-4-6 | Supabase Edge Function `/coaching` |
| Coaching IA général | claude-sonnet-4-6 | Supabase Edge Function `/coaching` |
| Formation IA | claude-sonnet-4-6 | Supabase Edge Function `/coaching` |
| Instructions IA | claude-sonnet-4-6 | Supabase Edge Function `/coaching` |
| Chat tactique | llama-3.1-8b-instant | Cloudflare Worker `/chat` → Groq |

---

## Bugs connus 🐛

| Bug | Fichier | Statut |
|---|---|---|
| Coach non affiché dans `renderMatchRow` (jointure Supabase `efb_coaches`) | efb-data.js | À surveiller |
| Variables Cloudflare Secret/Text inaccessibles dans Worker — utiliser Secrets Store binding | efhub-proxy | Contourné |

---

## Fonctionnalités en attente ⏳

### Priorité haute
- **Export PDF/CSV** — exporter les stats pour partage ou archivage (peu urgent si données dans Supabase)

### Priorité moyenne
- **Historique des builds** — voir l'évolution d'un build dans le temps
- **Base coachs** — mise à jour depuis amine250.github.io/efootball-managers
- **Mémoire conversation Llama** — sauvegarder l'historique entre sessions (localStorage)
- **Enrichir contexte Llama** — ajouter formations utilisées + taux de victoire par formation

### Priorité basse
- **Mode sombre/clair** — toggle thème
- **Multi-équipes** — supporter d'autres équipes que Real Madrid
- **Raccourcis clavier** — pour les actions fréquentes
- **Lazy loading photos** — améliorer les performances au chargement
- **Découpage modulaire de `efb-ui.js`** — fichier dépasse 8500 lignes, découper en modules :
  - `efb-ui-match.js` — modal match, sauvegarde, terrain
  - `efb-ui-analyse.js` — renderAnalyse, coaching, chat Llama
  - `efb-ui-saison.js` — renderSaison, renderSaisonContent, compositeScore
  - `efb-ui-effectif.js` — renderEffectif, builds, comparaison, Build IA
  - `efb-ui-formation.js` — Formation IA, terrain, picker
  - `efb-ui-core.js` — init, State, navigation, utilitaires partagés

### Nettoyage
- Supprimer `GEMINI_API_KEY_TEST` et `GROQ_API_KEY_TEXT` de Cloudflare (variables obsolètes)
- Supprimer la fonction `openTop5Modal()` si le modal n'est plus utilisé (remplacé par onglet Saison)

---

## Règles importantes à ne pas oublier

### eFootball
- Level cap 1 = carte Trending (figée, non développable)
- Points max par level cap : 22→42, 25→48, 28→54, 30→58, 33→64, 35→68, 40→78
- Règle de clic : clics 1-4=1pt, 5-8=2pts, 9-12=3pts... (max 12 clics par slider)
- Notes eFootball : de 1.0 à 10.0 (par pas de 0.5) — 0 = non noté
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
  - LWF/RWF/CF/SS : Off, Defensive (pas Attacking)
- Instructions Defence par position :
  - GK : Off uniquement
  - CB : Off, Tight Marking, Man Marking
  - LB/RB : Off, Tight Marking, Man Marking, Counter Target
  - DMF/CMF : Off, Tight Marking, Man Marking
  - AMF/LMF/RMF : Off, Man Marking, Counter Target
  - LWF/RWF/CF/SS : Off, Counter Target

### Développement
- Toujours valider la syntaxe JS avec `node --check fichier.js`
- Ne jamais utiliser de backticks imbriqués dans les template strings
- Utiliser `String.fromCharCode(39)` pour les guillemets simples dans les strings JS générées
- `efb-data.js` : logique métier + `EFB_COACHES_DB` (64 coachs) + `Analyse.byIndividualInstruction()` + `Analyse.byDefensive()`
- `efb-ui.js` : tout le rendu et les interactions + `compositeScore()` (score adapté par position)
- `_matchFormState` + `_matchSummaryState` — toujours lire depuis ces objets en priorité dans `saveMatch()`
- `saveMatchFormState()` appelée à chaque changement de score et changement d'onglet
- Notes obligatoires uniquement pour titulaires en statut `termine`
- Matchs `interrompu_reseau` exclus via `filterStatsMatches()`
- `showToast()` + `showConfirm()` définis dans `efb-ui.js`
- Builds lookup : toujours via `player_stats[].build_id` — jamais `m.build_id` directement
- `MATCH_DRAFT_KEY = 'efb_match_draft'` — auto-sauvegarde toutes les 15s
- `_saisonTab` + `setSaisonTab()` + `renderSaisonContent()` — gestion sous-onglets Saison
- `compositeScore(avgRating, winRate, goalsPerMatch, assistsPerMatch, csRate, position, savesPerMatch)` — centralisé
- `getBuildPriorityRules(pos, playingStyle, coachStyle)` — règles priorité sliders pour Build IA
- `FT_IA_ANALYSIS_KEY = 'efb_ft_ia_analysis'` — analyse formation IA persistée
- `loadFtIAPanel()` appelé au render de l'onglet Formation pour restaurer le panel

### Architecture CSS
- `efb-app.html` : CSS global
- `.matchs-page { height: calc(100vh - 60px); overflow-y: auto; padding: 10px 14px }` — scroll matchs
- `.matchs-page-header { flex-shrink: 0 }` — header fixe
- `.modal-match-body { overflow-y: auto }` — scroll onglet Résumé
- `.coachs-page { height: calc(100vh - 80px); overflow-y: auto }`
- `.saison-page { height: calc(100vh - 60px); overflow-y: hidden; display: flex; flex-direction: column }`
- `.saison-content { flex: 1; overflow-y: auto }` — scroll contenu sous-onglet
- `.coaching-mode-btn` + `.coaching-mode-btn.active` — boutons mode coaching

### Cloudflare Worker v13.2
- Route `/coaching` → Anthropic API (`env.ANTHROPIC_API_KEY` — Secret classique)
- Route `/chat` → Groq API (`await env.GROQ_API_KEY.get()` — Secrets Store binding)
- Route `/` → efhub proxy
- Modèle Groq : `llama-3.1-8b-instant`
- **RÈGLE** : Variables Text/Secret classiques inaccessibles → utiliser Secrets Store binding avec `env` passé en paramètre
- Signature : `async fetch(request, env)` → `handleGroqChat(request, env)` → `await env.GROQ_API_KEY.get()`

### Sécurité Supabase
- RLS activé sur toutes les tables avec policy `anon ALL` + `using (true)` + `with check (true)`
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
