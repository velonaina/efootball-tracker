-- ─────────────────────────────────────────────────────────────────────────────
-- eFootball Tracker — Schema v2
-- Compatible efb-app.html + efb-live.html
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop old tables
DROP TABLE IF EXISTS efb_matches CASCADE;
DROP TABLE IF EXISTS efb_builds CASCADE;
DROP TABLE IF EXISTS efb_cards CASCADE;
DROP TABLE IF EXISTS efb_players CASCADE;
DROP TABLE IF EXISTS efb_config CASCADE;

-- ── Players ──────────────────────────────────────────────────────────────────
CREATE TABLE efb_players (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  efhub_url text,
  created_at timestamptz DEFAULT now()
);

-- ── Cards ─────────────────────────────────────────────────────────────────────
CREATE TABLE efb_cards (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id uuid REFERENCES efb_players(id) ON DELETE CASCADE,
  efhub_stats jsonb DEFAULT '{}',
  level_cap integer DEFAULT 0,
  points_max integer DEFAULT 0,
  playing_style text,
  card_type text,
  booster_native text,
  booster_extra text,
  skills jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- ── Builds ────────────────────────────────────────────────────────────────────
CREATE TABLE efb_builds (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id uuid REFERENCES efb_cards(id) ON DELETE CASCADE,
  name text NOT NULL,
  sliders jsonb DEFAULT '{}',
  points_used integer DEFAULT 0,
  additional_skills jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- ── Matches ───────────────────────────────────────────────────────────────────
CREATE TABLE efb_matches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Infos générales
  played_at timestamptz DEFAULT now(),
  match_date date,
  match_time text,
  match_type text,                    -- ligue_jcj_d1, event_jcj, amical...
  match_level text,                   -- professionnel, superstar, legende
  rank text,                          -- Professionnel, Superstar, Légende

  -- Résultat
  result text CHECK (result IN ('V','N','D')),
  score_for integer DEFAULT 0,
  score_against integer DEFAULT 0,

  -- Équipe
  build_id uuid REFERENCES efb_builds(id) ON DELETE SET NULL,
  formation text,
  opp_formation text,
  opp_name text,
  opp_style text,
  opp_level text,                     -- faible, moyen, fort, elite

  -- Classement
  my_rank integer,
  opp_rank integer,
  my_strength integer,
  opp_strength integer,

  -- Instructions individuelles (4 slots)
  attack1_instruction text DEFAULT 'Off',
  attack1_target uuid REFERENCES efb_players(id),
  attack2_instruction text DEFAULT 'Off',
  attack2_target uuid REFERENCES efb_players(id),
  defence1_instruction text DEFAULT 'Off',
  defence1_target uuid REFERENCES efb_players(id),
  defence2_instruction text DEFAULT 'Off',
  defence2_target uuid REFERENCES efb_players(id),

  -- Titulaires et remplaçants (JSON)
  titulaires jsonb DEFAULT '[]',      -- [{player_id, card_id}]
  remplacants jsonb DEFAULT '[]',     -- [{player_id, card_id}]
  substitutions jsonb DEFAULT '[]',   -- [{out_player_id, in_player_id, minute}]

  -- Stats individuelles par joueur (JSON)
  player_stats jsonb DEFAULT '[]',
  -- Format: [{
  --   player_id, card_id,
  --   goals, assists, saves,
  --   yellow_card, red_card,
  --   rating (note /10 eFootball),
  --   statut (titulaire/remplacant),
  --   entry_minute, minutes_played
  -- }]

  -- Homme du match
  man_of_match uuid REFERENCES efb_players(id),

  -- Infos complémentaires
  note integer CHECK (note BETWEEN 1 AND 5),
  repeated_opponent boolean DEFAULT false,
  source text DEFAULT 'app',          -- 'app' ou 'live'

  created_at timestamptz DEFAULT now()
);

-- ── Config ────────────────────────────────────────────────────────────────────
CREATE TABLE efb_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text UNIQUE NOT NULL,
  value jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- Config par défaut
INSERT INTO efb_config (key, value) VALUES
  ('match_types', '["ligue_jcj_d1","ligue_jcj_d2","ligue_jcj_d3","ligue_ia_d1","ligue_ia_d2","ligue_ia_d3","event_jcj","event_ia","amical","my_league"]'),
  ('ranks', '["Professionnel","Superstar","Légende"]'),
  ('opp_levels', '["faible","moyen","fort","elite"]');

-- ── Formations personnalisées ─────────────────────────────────────────────────
CREATE TABLE efb_formations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slots JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE efb_formations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON efb_formations FOR ALL USING (true) WITH CHECK (true);
