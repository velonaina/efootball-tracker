# eFootball Tracker — Roadmap & Documentation

## État actuel du projet (v2.0)

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
| `efb-app.html` | App principale PC — HTML + CSS (~700 lignes) |
| `efb-data.js` | Couche données — Supabase CRUD + logique métier + SLIDERS_CONFIG + EFB_STATS_ORDER + Analyse |
| `efb-ui.js` | Interface — rendu + interactions (~5100 lignes) |
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
- Cartes Trending : bouton "Ajouter à la sélection" directement sans build

### Types de cartes supportés
- Standard, Featured, Epic, Iconic, Iconic Moment, Legendary, Trending
- Détection via `playerType` dans le payload efhub, ciblé par `playerId`
- Trending = `level_cap === 1` (override automatique)

### Builds
- 10 sliders de progression avec règle de clic eFootball
- Mapping sliders → stats efhub (Shooting, Passing, Dribbling, Dexterity, Lower Body, Aerial, Defending, GK 1/2/3)
- Présentation style efhub (icônes compactes + nombre de clics)
- Expand/collapse pour stats finales + additional skills (max 5, bloqué pour Trending)
- Bouton "Ajouter à la sélection" (Squad 23) sur chaque build card
- Modifier un build existant (sliders + nom)
- **Tous les builds chargés au démarrage** (plus de dropdown vide)

### Squad 23
- Présélection de 23 joueurs avec leur build actif dans l'onglet Effectif
- Build actif choisi par joueur — **source de vérité unique** pour Formation, Match et Analyse
- Sauvegardé automatiquement en localStorage
- Alimente directement la Formation et le modal match

### Onglet Formation (nouveau) ✨
- **Terrain interactif** avec positions selon la formation
- **Picker de formation** : 20 formations standard + formations personnalisées
- **Éditeur de formation custom** : drag & drop des nœuds sur terrain SVG, labels éditables, sauvegarde localStorage
- **Interdiction de nommer** une formation custom comme une formation standard
- **Swap de joueurs** : clic → clic pour échanger deux positions
- **Détection automatique de rôle** au drag (termes efhub : GK, CB, LB, RB, DMF, CMF, AMF, LMF, RMF, LWF, RWF, SS, CF)
- **Séparateurs redimensionnables** : vertical (terrain/droite) + horizontal (assignation/banc)
- Mode Terrain + mode Liste
- Sauvegarde → synchronisation automatique vers modal match (LINEUP_STORAGE_KEY + FT_STORAGE_KEY)
- Échange banc/terrain : swap automatique des places

### Modal match redesign (nouveau) ✨
- **2 onglets** : Match + Résumé
- **Layout plein écran** (95vw) avec terrain permanent à gauche
- **Terrain interactif** :
  - Swap de joueurs : clic → clic pour échanger deux positions
  - Surbrillance orange + halos pointillés pour les cibles d'échange
  - Bouton changer de rôle dans la fiche joueur (picker GK/CB/LB/RB/DMF/CMF/AMF/LMF/RMF/LWF/RWF/SS/CF)
- **Banc toujours visible** sous le terrain (remplaçants disponibles + déjà entrés)
- **Fiche joueur** toujours visible en bas à droite au clic
- **Séparateurs redimensionnables** : vertical (terrain/infos) + horizontal (infos/fiche joueur)
- Composition pré-remplie depuis l'onglet Formation
- Formation mémorisée entre les matchs
- **Substitutions** : depuis le banc visible, minute éditable inline, bouton Annuler
- **Instructions individuelles** :
  - Auto-sauvegarde dès modification (localStorage)
  - Targeted Player limité aux joueurs sur le terrain
- **Notes joueurs** : échelle 1 à 10 par pas de 0.5 (0 = non noté)
- Onglet Résumé : liste des builds utilisés par joueur avant enregistrement

### Enregistrement des matchs
- Titulaires (11) + remplaçants (12) depuis Formation/Squad 23
- Substitutions avec minute modifiable
- Instructions individuelles 4 slots (Attack 1/2, Defence 1/2 + Targeted Player)
- Stats individuelles : buts, passes (icône shoe), arrêts GK, cartons jaune/rouge, note 1-10
- Homme du match, note globale 1-5, adversaire répétitif
- `build_id` sauvegardé par joueur dans `player_stats` (depuis Squad 23)
- Formation, formation adverse, rang, rangs pts, date, heure, type de match

### Recherche globale (nouveau) ✨
- Barre de recherche dans le header — accessible depuis tous les onglets
- Overlay avec résultats groupés : Joueurs, Builds, Matchs
- Navigation directe au clic (sélectionne le joueur, le build ou scroll vers le match)
- Fermeture Escape ou clic extérieur

### Analyse étendue (nouveau) ✨
- KPIs globaux (matchs, victoires, buts marqués/encaissés, taux de victoire, série)
- Série actuelle + record avec timeline
- Coaching IA (Claude API via Supabase Edge Function)
- **Performance par type de match** (Ligue JCJ D1/D2/D3, IA, Évènement, Amical...)
- **Performance par rang**
- **Performance par formation** (taux de victoire par formation utilisée)
- **Performance par build** (taux de victoire + buts + passes + note moyenne par build)
- **Meilleur XI** : 11 joueurs avec le meilleur taux de victoire (min 3 matchs)
- **Top joueurs** : buteurs, passeurs, meilleures notes moyennes

### App live mobile (efb-live.html)
- 3 écrans : Préparation → Live → Post-match
- Score en temps réel, stats live, remplacements, notes, homme du match
- Synchronisation Supabase — `source: 'live'`
- ⚠️ **À mettre à jour** — désynchronisé avec les nouvelles structures

### Technique
- Cloudflare Worker v11 : proxy efhub
- Supabase Edge Function `coaching` : proxy API Anthropic
- `ANTHROPIC_API_KEY` stockée dans Supabase Secrets
- Clé Supabase `anon` dans les fichiers (repo privé)
- **Tous les builds chargés au démarrage** via `Builds.getAll()`

---

## Fonctionnalités en attente ⏳

### Priorité haute
- **Mettre à jour efb-live.html** — désynchronisé avec les nouvelles structures (Formation, modal match, builds)
- **Import automatique E1** — importer les données depuis efhub directement
- **Onglet Matchs** — filtres avancés (rang, résultat, date, formation, type)

### Priorité moyenne
- **Export PDF/CSV** — exporter les stats pour partage
- **Notifications de série** — alerte quand tu bats ton record de victoires
- **Comparaison de builds** — comparer 2 builds côte à côte
- **Historique des builds** — voir l'évolution d'un build dans le temps
- **Récapitulatif automatique** dans l'onglet Résumé (buteurs, MOTM généré depuis les stats)

### Priorité basse
- **Mode sombre/clair** — toggle thème (actuellement dark only)
- **Multi-équipes** — supporter d'autres équipes que Real Madrid
- **Partage de builds** — exporter un build pour partager
- **Statistiques avancées** — xG, possession, pressing...

---

## Améliorations recommandées

### Performance
- Paginer les matchs (actuellement on charge tout)
- Mettre en cache les données efhub (éviter les appels répétés)
- Lazy loading des photos de joueurs
- efb-ui.js dépasse 5000 lignes — envisager un découpage modulaire

### UX
- Toast notification après sauvegarde (au lieu d'alert)
- Raccourcis clavier pour les actions fréquentes
- Swipe pour naviguer entre les onglets sur mobile

### Données
- Ajouter `opp_style` (style de jeu adverse) dans les matchs
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

## localStorage keys

| Clé | Contenu |
|---|---|
| `efb_squad_23` | Squad 23 — [{player_id, card_id, build_id}] |
| `efb_last_lineup` | Dernière composition match — {titulaires, remplacants} |
| `efb_ft_lineup` | Composition Formation — {formation, titulaires, remplacants} |
| `efb_last_instructions` | Dernières instructions individuelles |
| `efb_custom_formations` | Formations personnalisées — {name: {slots, custom}} |

---

## Formations supportées (20)

`4-3-3` · `4-3-3 ATT` · `4-3-3 DEF` · `4-4-2` · `4-4-2 FLAT` · `4-2-3-1` · `4-1-4-1` · `4-3-1-2` · `4-3-2-1` · `4-4-1-1` · `4-5-1` · `3-5-2` · `3-4-3` · `3-4-2-1` · `3-3-3-1` · `5-3-2` · `5-4-1` · `5-2-3` · `5-2-2-1` · `4-6-0`

Positions efhub : `GK` · `CB` · `LB` · `RB` · `DMF` · `CMF` · `AMF` · `LMF` · `RMF` · `LWF` · `RWF` · `SS` · `CF`

---

## Règles importantes à ne pas oublier

### eFootball
- Level cap 1 = carte Trending (figée, non développable)
- Points max par level cap : 22→42, 25→48, 28→54, 30→58, 33→64, 35→68, 40→78
- Règle de clic : clics 1-4=1pt, 5-8=2pts, 9-12=3pts...
- Notes eFootball : de 1.0 à 10.0 (par pas de 0.5) — 0 = non noté
- Additional skills : max 5 par carte (sauf Trending = 0)

### Développement
- Toujours valider la syntaxe JS avec `node --check fichier.js`
- Ne jamais utiliser de backticks imbriqués dans les template strings
- Utiliser `String.fromCharCode(39)` pour les guillemets simples dans les strings JS générées
- Après chaque session : push sur GitHub + incrémenter version dans les commentaires
- efb-data.js contient toute la logique métier
- efb-ui.js contient tout le rendu et les interactions
- Ne jamais nommer une formation custom avec le même nom qu'une formation standard
- `LINEUP_STORAGE_KEY` et `SQUAD_STORAGE_KEY` déclarés en haut de efb-ui.js (avant ftSave)
- Builds chargés au démarrage via `Builds.getAll()` dans `init()`
