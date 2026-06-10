# eFootball Tracker

Application de suivi de performance pour eFootball Mobile — Real Madrid squad.

## Stack technique

- **Frontend** : HTML / CSS / JavaScript vanilla
- **Base de données** : Supabase (PostgreSQL)
- **Images** : efhub.com via Cloudflare Worker proxy
- **Hébergement** : Local (Live Server) ou GitHub Pages

## Fichiers

| Fichier | Description |
|---|---|
| `efb-app.html` | Application principale (PC/desktop) |
| `efb-ui.js` | Interface utilisateur — rendu et interactions |
| `efb-data.js` | Couche données — Supabase CRUD + logique métier |
| `efb-live.html` | App mobile légère — saisie live pendant le match |
| `efb_schema_v2.sql` | Schéma Supabase — à exécuter pour initialiser la base |
| `worker/efhub-proxy-worker-v10.js` | Cloudflare Worker — proxy efhub.com |

## Installation

### 1. Supabase
- Créer un projet sur [supabase.com](https://supabase.com)
- Exécuter `efb_schema_v2.sql` dans le SQL Editor
- Copier l'URL et la clé `anon` dans `efb-data.js` et `efb-live.html`

### 2. Cloudflare Worker
- Créer un Worker sur [dash.cloudflare.com](https://dash.cloudflare.com)
- Coller le contenu de `worker/efhub-proxy-worker-v10.js`
- Déployer et noter l'URL du Worker
- Mettre à jour `EFB_WORKER_URL` dans `efb-data.js`

### 3. Lancer l'app
- Ouvrir le dossier dans VS Code
- Lancer Live Server sur `efb-app.html`
- Sur Android : ouvrir `efb-live.html` dans le navigateur

## Fonctionnalités

- ✅ Import automatique depuis efhub.com (stats, style, type de carte, skills)
- ✅ Gestion des joueurs et cartes (Standard, Featured, Epic, Iconic, Trending...)
- ✅ Builds avec 10 sliders de progression + règle de clic eFootball
- ✅ Composition match — 23 joueurs avec builds actifs
- ✅ Enregistrement des matchs avec XI, remplaçants, substitutions
- ✅ Stats individuelles par joueur (buts, passes, arrêts, cartons, note /10)
- ✅ Instructions individuelles (Attack 1/2, Defence 1/2) mémorisées
- ✅ Analyse — KPIs, séries de victoires, performance par rang
- ✅ Coaching IA — recommandations personnalisées via Claude API
- ✅ App live mobile — saisie en temps réel pendant le match
- ✅ Synchronisation Supabase entre app PC et app mobile

## Sécurité

La clé `anon` Supabase est publique par conception (Row Level Security désactivé pour usage personnel). Ne pas partager ce repo publiquement sans retirer les clés.

## Versions

- **Worker v10** — Détection cardType via playerId, playingStyle corrigé, Trending via level_cap
- **Schema v2** — Tables efb_players, efb_cards, efb_builds, efb_matches, efb_config
