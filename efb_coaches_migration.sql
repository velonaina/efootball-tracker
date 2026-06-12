-- ─────────────────────────────────────────────────────────────────────────────
-- eFootball Tracker — Migration Coachs
-- À exécuter dans Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Table efb_coaches ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS efb_coaches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  nationality text,
  style text,           -- ex: Possession, Counter Attack, Long Ball, Out Wide, Quick Counter
  formation text,       -- formation favorite du coach ex: 4-3-3
  notes text,           -- notes libres
  created_at timestamptz DEFAULT now()
);

-- ── Ajout coach_id dans efb_matches ──────────────────────────────────────────
ALTER TABLE efb_matches
  ADD COLUMN IF NOT EXISTS coach_id uuid REFERENCES efb_coaches(id) ON DELETE SET NULL;

-- ── Index pour les jointures ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_efb_matches_coach_id ON efb_matches(coach_id);
