# eFootball Tracker — Roadmap & Documentation

## État actuel du projet (v3.4)

### Stack technique
- **Frontend** : HTML / CSS / JavaScript vanilla (3 fichiers)
- **Base de données** : Supabase (PostgreSQL) — projet `hxrepxhtxksrxtjskkon`
- **Worker** : Cloudflare Workers `efhub-proxy` v13.2 — proxy efhub.com + Anthropic + Groq
- **Coaching IA** : Supabase Edge Function `coaching` — proxy API Anthropic Claude
- **Chat tactique** : Cloudflare Worker `/chat` → Groq (Llama 3.1 8b Instant)
- **Icônes** : Tabler Icons (webfont CDN)
- **Repo** : `velonaina/efootball-tracker` (public — protégé par RLS)

### Fichiers du projet
| Fichier | Rôle |
|---|---|
| `efb-app.html` | App principale PC — HTML + CSS |
| `efb-data.js` | Couche données — Supabase CRUD + logique métier + Analyse + EFB_COACHES_DB |
| `efb-ui.js` | Interface — rendu + interactions (~7500 lignes) |
| `efb-live.html` | App mobile légère — saisie live pendant le match |
| `efhub-proxy-worker-v13.js` | Cloudflare Worker v13.2 — proxy efhub + Anthropic + Groq |
| `supabase/functions/coaching/index.ts` | Supabase Edge Function — coaching IA Claude |

---

## Fonctionnalités implémentées ✅

### Gestion des joueurs
- Import automatique depuis efhub.com (stats, style, type de carte, skills, level cap)
- Détection automatique Trending (level_cap = 1) — carte figée, non développable
- Photo automatique via efimg.com
- Sidebar avec liste des joueurs + photo + badge card type + playing style
- CRUD complet (ajouter, modifier, supprimer)
- Fiche joueur avec onglet Matchs — filtre par `player_stats.player_id` (nouveau) + `build_id` global (ancien)
- **Comparaison de builds** — bouton ⇄ sur chaque build card → modal côte à côte avec sliders, stats finales et taux de victoire

### Modal match ✅
- 2 onglets : Match + Résumé avec sauvegarde d'état (`_matchFormState` + `_matchSummaryState`)
- Layout plein écran avec terrain interactif
- Substitutions avec minute éditable inline
- Instructions individuelles 4 slots
- Notes joueurs 1-10 — obligatoires uniquement pour titulaires en match **Terminé**
- Sélecteur coach pré-rempli avec coach actif
- **Statut du match** : Terminé / Abandon adverse (→ V forcé) / Interrompu réseau (→ exclu stats, notes optionnelles)
- **Auto-sauvegarde brouillon** toutes les 15s (`efb_match_draft`) — bannière de récupération au rechargement
- Data objet lit depuis `_matchFormState` en priorité — score, adversaire, coach, formation correctement sauvegardés depuis l'onglet Résumé
- Onglet Résumé scrollable (`.modal-match-body { overflow-y: auto }`)

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
- **Coaching IA** (Claude via Supabase Edge Function) :
  - 4 modes : Général / Ligue JCJ / Évènement IA / My League
  - Contexte enrichi : dernier match, coach actif, stats par coach
  - Historique 5 derniers conseils en localStorage `efb_coaching_history`
- **Chat tactique Llama** 💬 (Groq) :
  - Interface bulles de conversation style WhatsApp
  - Contexte enrichi au premier message : effectif complet (nom + position + style + builds), Squad 23, stats globales, coach actif, stats par joueur (15 joueurs), 5 derniers matchs
  - Règle stricte : Llama ne cite que les joueurs listés
  - Modèle : `llama-3.1-8b-instant` via Cloudflare Worker `/chat` → Groq
  - Clé Groq via **Secrets Store** binding (`await env.GROQ_API_KEY.get()`)
  - Quota gratuit : 14 400 tokens/minute, pas de limite journalière stricte
- Performance par type de match, rang, formation, build, coach
- **Performance défensive** par joueur : clean sheets%, buts encaissés/match, taux victoire (min 3 matchs)
- **Instructions individuelles** : joueur + instruction → taux de victoire, buts (min 3 matchs)
- **Comparaison de périodes** : N derniers vs N précédents OU par plage de dates
- **Dashboard coach** — graphique SVG barres V/N/D
- **Top arrêts GK** — colonne dédiée dans classements
- Builds avec 1+ match affichés (badge ⚠ si < 3 matchs)
- Matchs `interrompu_reseau` exclus de tous les calculs

### Onglet Saison ✅ (nouveau)
- 3 sous-onglets : **📊 Résumé** / **🏅 Awards** / **👥 Top 5**
- **Résumé** : 4 KPIs (victoires%, série record, buts, matchs), meilleur match, match le plus difficile
- **Awards** : 🏆 Joueur saison, ⚽ Meilleur buteur, 🎯 Meilleur passeur, ★ Meilleure note, 🧤 Meilleur GK, 🛡️ Meilleur défenseur — chaque award affiche la carte build style Effectif avec icônes sliders
- **Top 5** : classement par score composite avec médailles 🥇🥈🥉, carte build complète
- **Score composite adapté par position** :
  - GK : Note 30% + Victoires 20% + Clean sheets 35% + Arrêts/match 15%
  - CB/LB/RB : Note 35% + Victoires 25% + CS 30% + Buts 5% + Passes 5%
  - DMF/CMF : Note 35% + Victoires 25% + Buts 15% + Passes 15% + CS 10%
  - AMF/LMF/RMF : Note 35% + Victoires 25% + Buts 20% + Passes 10% + CS 10%
  - LWF/RWF/SS/CF : Note 40% + Victoires 25% + Buts 20% + Passes 10% + CS 5%
- Chaque award utilise `getBestBuildForStat()` — affiche le build ayant le plus contribué à la stat

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
| `efb_custom_formations` | Formations personnalisées |
| `efb_active_coach` | ID du coach actif |
| `efb_coaching_history` | Historique des 5 derniers conseils IA |
| `efb_match_draft` | Brouillon match en cours (auto-sauvegarde 15s) |
| `efb_auth` | Token d'authentification locale |

---

## Bugs connus 🐛

| Bug | Fichier | Statut |
|---|---|---|
| Coach non affiché dans `renderMatchRow` (jointure Supabase `efb_coaches`) | efb-data.js | À surveiller |
| Variables Cloudflare Secret/Text inaccessibles dans Worker — utiliser Secrets Store binding | efhub-proxy | Contourné |

---

## Fonctionnalités en attente ⏳

### Priorité haute
- **Export PDF/CSV** — exporter les stats pour partage ou archivage
- **Pousser tous les fichiers sur GitHub** — s'assurer que tout est à jour

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
- **Découpage modulaire de `efb-ui.js`** — fichier dépasse 7500 lignes, découper en modules :
  - `efb-ui-match.js` — modal match, sauvegarde, terrain
  - `efb-ui-analyse.js` — renderAnalyse, coaching, chat Llama
  - `efb-ui-saison.js` — renderSaison, renderSaisonContent, compositeScore
  - `efb-ui-effectif.js` — renderEffectif, builds, comparaison
  - `efb-ui-core.js` — init, State, navigation, utilitaires partagés

### Nettoyage
- Supprimer `GEMINI_API_KEY_TEST` et `GROQ_API_KEY_TEXT` de Cloudflare (variables obsolètes)
- Supprimer la fonction `openTop5Modal()` si le modal n'est plus utilisé (remplacé par onglet Saison)

---

## Règles importantes à ne pas oublier

### eFootball
- Level cap 1 = carte Trending (figée, non développable)
- Points max par level cap : 22→42, 25→48, 28→54, 30→58, 33→64, 35→68, 40→78
- Règle de clic : clics 1-4=1pt, 5-8=2pts, 9-12=3pts...
- Notes eFootball : de 1.0 à 10.0 (par pas de 0.5) — 0 = non noté
- Additional skills : max 5 par carte (sauf Trending = 0)
- Rang/Difficulté visible uniquement pour `event_ia` et `my_league`
- Instructions Attack : Off / Defensive / Attacking / Anchoring
- Instructions Defence : Off / Tight Marking / Man Marking / Counter Target / Deep Line

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
- Picker formation modal édition : `openEmFormationPicker()` z-index 9999
- `MATCH_DRAFT_KEY = 'efb_match_draft'` — auto-sauvegarde toutes les 15s
- `_saisonTab` + `setSaisonTab()` + `renderSaisonContent()` — gestion sous-onglets Saison
- `compositeScore(avgRating, winRate, goalsPerMatch, assistsPerMatch, csRate, position, savesPerMatch)` — centralisé

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
