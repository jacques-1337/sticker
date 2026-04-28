-- ═══════════════════════════════════════════════════════════════
--  32er Worldwide — challenges Tabelle + RLS + finish_challenge RPC
--  In Supabase SQL-Editor ausführen: Dashboard → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════

-- 1. users.points Spalte sicherstellen
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0;

-- 2. challenges Tabelle erstellen
CREATE TABLE IF NOT EXISTS public.challenges (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  challenger_id uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  opponent_id   uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  game_type     text        NOT NULL DEFAULT 'connect4',
  points_stake  integer     NOT NULL DEFAULT 0 CHECK (points_stake >= 0),
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','active','declined','finished','cancelled')),
  winner_id     uuid        REFERENCES public.users(id),
  game_state    jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  accepted_at   timestamptz,
  completed_at  timestamptz
);

-- 3. Indizes für schnelle User-Abfragen
CREATE INDEX IF NOT EXISTS challenges_challenger_idx ON public.challenges(challenger_id);
CREATE INDEX IF NOT EXISTS challenges_opponent_idx   ON public.challenges(opponent_id);
CREATE INDEX IF NOT EXISTS challenges_status_idx     ON public.challenges(status);

-- 4. Row-Level Security aktivieren
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (DROP IF EXISTS für idempotentes Ausführen)
DROP POLICY IF EXISTS "challenges_select_own"      ON public.challenges;
DROP POLICY IF EXISTS "challenges_insert_own"      ON public.challenges;
DROP POLICY IF EXISTS "challenges_update_own"      ON public.challenges;
DROP POLICY IF EXISTS "challenges_delete_pending"  ON public.challenges;

-- Nur Challenger oder Opponent darf lesen
CREATE POLICY "challenges_select_own" ON public.challenges
  FOR SELECT USING (
    challenger_id = auth.uid() OR opponent_id = auth.uid()
  );

-- Eingeloggter User darf Challenge erstellen (nur als Challenger)
CREATE POLICY "challenges_insert_own" ON public.challenges
  FOR INSERT WITH CHECK (
    challenger_id = auth.uid()
  );

-- Beide Parteien dürfen updaten (Status-Änderung, game_state)
CREATE POLICY "challenges_update_own" ON public.challenges
  FOR UPDATE USING (
    challenger_id = auth.uid() OR opponent_id = auth.uid()
  );

-- Nur Challenger darf pending Challenge löschen (zurückziehen)
CREATE POLICY "challenges_delete_pending" ON public.challenges
  FOR DELETE USING (
    challenger_id = auth.uid() AND status = 'pending'
  );

-- 6. finish_challenge RPC — atomarer Punkte-Transfer + Status-Update
CREATE OR REPLACE FUNCTION public.finish_challenge(
  p_challenge_id uuid,
  p_winner_id    uuid   -- NULL = Unentschieden, kein Punkte-Transfer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ch        public.challenges%ROWTYPE;
  v_loser_id  uuid;
  v_amount    integer;
  v_loser_pts integer := 0;
BEGIN
  -- Challenge laden und sperren (verhindert Race-Conditions)
  SELECT * INTO v_ch FROM public.challenges
  WHERE id = p_challenge_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge % nicht gefunden', p_challenge_id;
  END IF;

  IF v_ch.status NOT IN ('active', 'pending') THEN
    RAISE EXCEPTION 'Challenge % ist bereits abgeschlossen (status: %)',
      p_challenge_id, v_ch.status;
  END IF;

  v_amount := v_ch.points_stake;

  -- Status auf 'finished' setzen
  UPDATE public.challenges
  SET
    status       = 'finished',
    winner_id    = p_winner_id,
    completed_at = now(),
    updated_at   = now()
  WHERE id = p_challenge_id;

  -- Punkte-Transfer: nur wenn kein Unentschieden und Einsatz > 0
  IF p_winner_id IS NOT NULL AND v_amount > 0 THEN
    -- Verlierer bestimmen
    v_loser_id := CASE
      WHEN p_winner_id = v_ch.challenger_id THEN v_ch.opponent_id
      ELSE v_ch.challenger_id
    END;

    -- Aktuelle Punkte des Verlierers
    SELECT COALESCE(points, 0) INTO v_loser_pts
    FROM public.users WHERE id = v_loser_id;

    -- Vom Verlierer abziehen (mindestens 0)
    UPDATE public.users
    SET points = GREATEST(0, v_loser_pts - v_amount)
    WHERE id = v_loser_id;

    -- Beim Gewinner addieren
    UPDATE public.users
    SET points = COALESCE(points, 0) + v_amount
    WHERE id = p_winner_id;
  END IF;

  RETURN json_build_object(
    'success',   true,
    'winner_id', p_winner_id,
    'stake',     v_amount,
    'status',    'finished'
  );
END;
$$;

-- Ausführ-Recht für eingeloggte User
GRANT EXECUTE ON FUNCTION public.finish_challenge(uuid, uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
--  OPTIONAL: Realtime für challenges aktivieren
--  (Supabase Dashboard → Database → Replication → challenges)
-- ═══════════════════════════════════════════════════════════════
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.challenges;
