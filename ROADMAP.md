# eFootball Tracker — Roadmap & Documentation

## État actuel du projet (v1.0)

### Stack technique
- **Frontend** : HTML / CSS / JavaScript vanilla (3 fichiers)
- **Base de données** : Supabase (PostgreSQL) — projet `hxrepxhtxksrxtjskkon`
- **Worker** : Cloudflare Workers `efhub-proxy` v11 — proxy efhub.com + API Anthropic
- **Edge Function** : Supabase `coaching` — proxy API Anthropic Claude
- **Icônes** : Tabler Icons (webfont CDN)
- **Repo** : `velonaina/efootball-tracker` (private)

### Fichiers du projet
| Fichier | Rôle |
|---|---|
| `efb-app.html` | App principale PC — HTML + CSS |
| `efb-data.js` | Couche données — Supabase CRUD + logique métier + SLIDERS_CONFIG + EFB_STATS_ORDER |
| `efb-ui.js` | Interface — rendu + interactions (~2500 lignes) |
| `efb-live.html` | App mobile légère — saisie live pendant le match |
| `efb_schema_v2.sql` | Schéma Supabase v2 |
| `efhub-proxy-worker-v11.js` | Cloudflare Worker — proxy efhub + Anthropic |
| `supabase/functions/coaching/index.ts` | Supabase Edge Function — coaching IA |

---

## Fonctionnalités implémentées ✅

### Gestion des joueurs
- Import automatique depuis efhub.com (stats, style, type de carte, skills, level cap)
- Détection automatique Trending (level_cap = 1) — carte figée, non développable
- Photo automatique via efimg.com
- Sidebar avec liste des joueurs + photo + badge card type + playing style
- CRUD complet (ajouter, modifier, supprimer)

### Types de cartes supportés
- Standard, Featured, Epic, Iconic, Iconic Moment, Legendary, Trending
- Détection via `playerType` dans le payload efhub, ciblé par `playerId`
- Trending = `level_cap === 1` (override automatique)

### Builds
- 10 sliders de progression avec règle de clic eFootball
  - Clics 1-4 = 1pt, 5-8 = 2pts, 9-12 = 3pts...
  - Points max selon level_cap : {22:42, 25:48, 28:54, 30:58, 33:64, 35:68, 40:78}
- Mapping sliders → stats efhub :
  - Shooting → finishing, setPieceTaking, curl
  - Passing → lowPass, loftedPass
  - Dribbling → ballControl, dribbling, tightPossession
  - Dexterity → offensiveAwareness, acceleration, balance
  - Lower Body → speed, kickingPower, stamina
  - Aerial → heading, jump, physicalContact
  - Defending → defensiveAwareness, trackingBack, ballWinning, aggression
  - GK 1 → gkAwareness, jump
  - GK 2 → gkClearing, gkReach
  - GK 3 → gkCatching, gkReflexes
- Présentation style efhub (icônes compactes + nombre de clics)
- Expand/collapse pour stats finales + additional skills (max 5, bloqué pour Trending)
- Bouton "Ajouter à la sélection" (Squad 23) directement sur chaque build card
- Modifier un build existant (sliders + nom)
- Cartes Trending : pas de sliders, skills figés

### Squad 23
- Présélection de 23 joueurs avec leur build actif dans l'onglet Effectif
- Build actif choisi par joueur (modifiable à chaque match)
- Sauvegardé automatiquement en localStorage
- Alimente directement les listpickers titulaires/remplaçants dans le modal match

### Enregistrement des matchs (efb-app.html)
- Titulaires (11) + remplaçants (12) depuis la Squad 23
- Exclusion mutuelle titulaires/remplaçants dans les listpickers
- Case "A joué" pour les remplaçants non utilisés
- Substitutions avec minute d'entrée/sortie
- Instructions individuelles 4 slots (Attack 1/2, Defence 1/2 + Targeted Player)
- Instructions mémorisées automatiquement (localStorage) entre les matchs
- Stats individuelles par joueur :
  - Buts, passes décisives, arrêts (GK seulement)
  - Cartons jaune/rouge
  - Note /10 eFootball (3.0 à 10.0)
  - Auto-ajout depuis la composition (collapse par défaut, expand pour noter)
- Homme du match (sélection manuelle)
- Note globale match 1-5
- Adversaire répétitif (checkbox)
- Date et heure (pré-remplies avec maintenant)
- Formation + formation adverse
- Rang + rangs joueurs
- `build_id` sauvegardé par joueur dans `player_stats`
- `source: 'app'` ou `'live'`
- Modifier un match enregistré

### App live mobile (efb-live.html)
- 3 écrans : Préparation → Live → Post-match
- Score en temps réel (+ / -)
- Stats live par joueur (buts, passes, arrêts GK, cartons)
- Remplacements avec minute
- Notes /10 après match
- Homme du match
- Synchronisation Supabase (même tables que efb-app)
- `source: 'live'`

### Analyse
- KPIs globaux (matchs, victoires, nuls, défaites, taux de victoire)
- Série actuelle + record de victoires
- Performance par rang
- Coaching IA (bouton "Générer") :
  - Analyse builds + joueurs + combinaisons XI
  - Recommandations personnalisées via Claude API
  - Via Supabase Edge Function (pas de CORS)

### Technique
- Cloudflare Worker v11 : proxy efhub + route `/coaching` désactivée (remplacée par Edge Function)
- Supabase Edge Function `coaching` : proxy API Anthropic
- `ANTHROPIC_API_KEY` stockée dans Supabase Secrets (sécurisé)
- Clé Supabase `anon` dans les fichiers (repo privé)

---

## Fonctionnalités en attente ⏳

### Priorité haute
- **Recherche globale** — chercher un joueur, un build, un match dans l'app
- **Onglet Matchs global** — liste de tous les matchs avec filtres (rang, résultat, date)
- **Analyse par build** — taux de victoire, série, notes joueurs par build utilisé
- **Analyse par joueur** — performance individuelle sur la durée

### Priorité moyenne
- **Import automatique E1** — importer les données depuis efhub directement (roadmap v3 Phase E)
- **Export PDF/CSV** — exporter les stats pour partage
- **Notifications de série** — alerte quand tu bats ton record de victoires
- **Comparaison de builds** — comparer 2 builds côte à côte
- **Historique des builds** — voir l'évolution d'un build dans le temps

### Priorité basse
- **Mode sombre/clair** — toggle thème (actuellement dark only)
- **Multi-équipes** — supporter d'autres équipes que Real Madrid
- **Partage de builds** — exporter un build pour partager avec d'autres joueurs
- **Statistiques avancées** — xG, possession, pressing...

---

## Améliorations recommandées

### Performance
- Paginer les matchs (actuellement on charge tout)
- Mettre en cache les données efhub (éviter les appels répétés)
- Lazy loading des photos de joueurs

### UX
- Confirmation visuelle après sauvegarde (toast notification au lieu d'alert)
- Raccourcis clavier pour les actions fréquentes
- Drag & drop pour réorganiser la Squad 23
- Swipe pour naviguer entre les onglets sur mobile

### Données
- Ajouter `opp_style` (style de jeu adverse) dans les matchs
- Ajouter `weather` / `mood` pour contextualiser les performances
- Tracker les blessures et suspensions

### Sécurité
- Activer Row Level Security (RLS) sur Supabase
- Authentification utilisateur (si usage multi-joueurs)
- Rotation des clés API

---

## Schéma Supabase v2

### Tables
| Table | Description |
|---|---|
| `efb_players` | Joueurs — id, name, efhub_url, created_at |
| `efb_cards` | Cartes — player_id, efhub_stats (json), level_cap, points_max, playing_style, card_type, skills (json) |
| `efb_builds` | Builds — card_id, name, sliders (json), points_used, additional_skills (json) |
| `efb_matches` | Matchs — tous les champs match + player_stats (json) + titulaires/remplaçants (json) |
| `efb_config` | Configuration — match_types, ranks, opp_levels |

### Format player_stats (dans efb_matches)
```json
[{
  "player_id": "uuid",
  "card_id": "uuid",
  "build_id": "uuid",
  "goals": 2,
  "assists": 1,
  "saves": 0,
  "yellow_card": false,
  "red_card": false,
  "rating": 8.5,
  "statut": "titulaire",
  "entry_minute": null,
  "minutes_played": 90
}]
```

---

## Règles importantes à ne pas oublier

### eFootball
- Level cap 1 = carte Trending (figée, non développable)
- Points max par level cap : 22→42, 25→48, 28→54, 30→58, 33→64, 35→68, 40→78
- Règle de clic : clics 1-4=1pt, 5-8=2pts, 9-12=3pts...
- Notes eFootball : de 3.0 à 10.0 (par pas de 0.5)
- Additional skills : max 5 par carte (sauf Trending = 0)

### Développement
- Toujours valider la syntaxe JS avec `node --check fichier.js`
- Ne jamais utiliser de backticks imbriqués dans les template strings
- Utiliser `String.fromCharCode(39)` pour les guillemets simples dans les strings JS générées
- Après chaque session : push sur GitHub + incrémenter version dans les commentaires
- efb-data.js contient toute la logique métier (SLIDERS_CONFIG, EFB_STATS_ORDER, Progression, Analyse)
- efb-ui.js contient tout le rendu et les interactions
- Les 2 fichiers ne doivent pas dépasser ~3000 lignes chacun
