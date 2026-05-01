-- ═══════════════════════════════════════════════════════════════
--  32er Worldwide — VOLLSTÄNDIGE SETUP-SQL
--  Einmalig im Supabase SQL-Editor ausführen.
--  Idempotent: kann mehrfach ausgeführt werden ohne Fehler.
--  Stand: 2026-04-30
-- ═══════════════════════════════════════════════════════════════


-- ╔══════════════════════════════════════════════╗
-- ║  1. USERS-TABELLE                            ║
-- ╚══════════════════════════════════════════════╝

-- users wird von der App selbst verwaltet (kein Supabase Auth)
-- Sicherstellen dass alle nötigen Spalten existieren
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS points      integer NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url  text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio         text DEFAULT '';


-- ╔══════════════════════════════════════════════╗
-- ║  2. CHALLENGES-TABELLE                       ║
-- ╚══════════════════════════════════════════════╝

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

CREATE INDEX IF NOT EXISTS challenges_challenger_idx ON public.challenges(challenger_id);
CREATE INDEX IF NOT EXISTS challenges_opponent_idx   ON public.challenges(opponent_id);
CREATE INDEX IF NOT EXISTS challenges_status_idx     ON public.challenges(status);

-- RLS: permissiv (App hat kein Supabase Auth → auth.uid() = NULL)
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "challenges_select_own"     ON public.challenges;
DROP POLICY IF EXISTS "challenges_insert_own"     ON public.challenges;
DROP POLICY IF EXISTS "challenges_update_own"     ON public.challenges;
DROP POLICY IF EXISTS "challenges_delete_pending" ON public.challenges;
DROP POLICY IF EXISTS "challenges_all"            ON public.challenges;
CREATE POLICY "challenges_all" ON public.challenges
  FOR ALL USING (true) WITH CHECK (true);


-- ╔══════════════════════════════════════════════╗
-- ║  3. MINI-GAME TABELLEN (Phase 9)             ║
-- ╚══════════════════════════════════════════════╝

-- Spielversuche pro User pro Tag (max. 3)
CREATE TABLE IF NOT EXISTS public.minigame_attempts (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  game_key   text        NOT NULL,
  played_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mg_attempts_user_idx ON public.minigame_attempts(user_id, game_key, played_at);

-- Monatliche Highscores
CREATE TABLE IF NOT EXISTS public.minigame_scores (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  game_key   text        NOT NULL,
  score      integer     NOT NULL DEFAULT 0,
  month      text        NOT NULL, -- Format: 'YYYY-MM'
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS mg_scores_unique ON public.minigame_scores(user_id, game_key, month);
CREATE INDEX IF NOT EXISTS mg_scores_month_idx    ON public.minigame_scores(game_key, month, score DESC);

-- RLS permissiv
ALTER TABLE public.minigame_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minigame_scores   ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mga_all" ON public.minigame_attempts;
DROP POLICY IF EXISTS "mgs_all" ON public.minigame_scores;
CREATE POLICY "mga_all" ON public.minigame_attempts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "mgs_all" ON public.minigame_scores   FOR ALL USING (true) WITH CHECK (true);


-- ╔══════════════════════════════════════════════╗
-- ║  4. APP_SETTINGS (Feature Flags)             ║
-- ╚══════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.app_settings (
  key        text PRIMARY KEY,
  value      text NOT NULL DEFAULT 'false',
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.app_settings (key, value) VALUES
  ('challenges_active', 'false'),
  ('games_active',      'false')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_read_all"  ON public.app_settings;
DROP POLICY IF EXISTS "settings_write_all" ON public.app_settings;
CREATE POLICY "settings_read_all"  ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "settings_write_all" ON public.app_settings FOR ALL    USING (true) WITH CHECK (true);


-- ╔══════════════════════════════════════════════╗
-- ║  5. STORAGE — Avatare                        ║
-- ╚══════════════════════════════════════════════╝

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "avatars_insert_all" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select_all" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_all" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_all" ON storage.objects;
CREATE POLICY "avatars_insert_all" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "avatars_select_all" ON storage.objects FOR SELECT USING  (bucket_id = 'avatars');
CREATE POLICY "avatars_update_all" ON storage.objects FOR UPDATE USING  (bucket_id = 'avatars');
CREATE POLICY "avatars_delete_all" ON storage.objects FOR DELETE USING  (bucket_id = 'avatars');


-- ╔══════════════════════════════════════════════╗
-- ║  6. finish_challenge RPC                     ║
-- ╚══════════════════════════════════════════════╝
-- Punkte-Abzug beim Verlierer darf ins Negative (kein CLAMP).
-- SECURITY DEFINER → läuft als Superuser, kein RLS-Problem.

CREATE OR REPLACE FUNCTION public.finish_challenge(
  p_challenge_id uuid,
  p_winner_id    uuid
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
  SELECT * INTO v_ch FROM public.challenges
  WHERE id = p_challenge_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge % nicht gefunden', p_challenge_id;
  END IF;

  IF v_ch.status NOT IN ('active', 'pending') THEN
    RAISE EXCEPTION 'Challenge % bereits abgeschlossen (status: %)',
      p_challenge_id, v_ch.status;
  END IF;

  v_amount := v_ch.points_stake;

  UPDATE public.challenges
  SET status       = 'finished',
      winner_id    = p_winner_id,
      completed_at = now(),
      updated_at   = now()
  WHERE id = p_challenge_id;

  IF p_winner_id IS NOT NULL AND v_amount > 0 THEN
    v_loser_id := CASE
      WHEN p_winner_id = v_ch.challenger_id THEN v_ch.opponent_id
      ELSE v_ch.challenger_id
    END;

    SELECT COALESCE(points, 0) INTO v_loser_pts
    FROM public.users WHERE id = v_loser_id;

    -- Verlierer: darf negativ werden
    UPDATE public.users SET points = v_loser_pts - v_amount WHERE id = v_loser_id;
    -- Gewinner: addieren
    UPDATE public.users SET points = COALESCE(points, 0) + v_amount WHERE id = p_winner_id;
  END IF;

  RETURN json_build_object(
    'success',   true,
    'winner_id', p_winner_id,
    'stake',     v_amount,
    'status',    'finished'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finish_challenge(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.finish_challenge(uuid, uuid) TO authenticated;


-- ╔══════════════════════════════════════════════╗
-- ║  7. evaluate_monthly_winner RPC              ║
-- ╚══════════════════════════════════════════════╝
-- Sticker of the Month: Gewinner bekommt 50 Punkte.

CREATE TABLE IF NOT EXISTS public.sticker_month_winners (
  month      text PRIMARY KEY,
  sticker_id bigint,
  user_id    uuid REFERENCES public.users(id),
  vote_count integer,
  reward_pts integer DEFAULT 50
);

ALTER TABLE public.sticker_month_winners
  ADD COLUMN IF NOT EXISTS reward_pts integer DEFAULT 50;

CREATE OR REPLACE FUNCTION public.evaluate_monthly_winner(target_month text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sticker_id bigint;
  v_user_id    uuid;
  v_votes      integer;
  v_reward     integer := 50;
BEGIN
  SELECT sv.sticker_id, s.owner_id, COUNT(*)::integer
  INTO   v_sticker_id, v_user_id, v_votes
  FROM   public.sticker_votes sv
  JOIN   public.stickers s ON s.id = sv.sticker_id
  WHERE  sv.month = target_month AND s.owner_id IS NOT NULL
  GROUP  BY sv.sticker_id, s.owner_id
  ORDER  BY COUNT(*) DESC
  LIMIT  1;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'reason', 'no_votes');
  END IF;

  UPDATE public.users SET points = COALESCE(points, 0) + v_reward WHERE id = v_user_id;

  INSERT INTO public.sticker_month_winners (month, sticker_id, user_id, vote_count, reward_pts)
  VALUES (target_month, v_sticker_id, v_user_id, v_votes, v_reward)
  ON CONFLICT (month) DO UPDATE
    SET sticker_id = EXCLUDED.sticker_id,
        user_id    = EXCLUDED.user_id,
        vote_count = EXCLUDED.vote_count,
        reward_pts = EXCLUDED.reward_pts;

  RETURN json_build_object(
    'success', true, 'month', target_month,
    'user_id', v_user_id, 'votes', v_votes, 'reward', v_reward
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_monthly_winner(text) TO anon;
GRANT EXECUTE ON FUNCTION public.evaluate_monthly_winner(text) TO authenticated;


-- ╔══════════════════════════════════════════════╗
-- ║  8. CRON — Monatliche Auswertung (Phase 11)  ║
-- ╚══════════════════════════════════════════════╝
-- Erst ausführen wenn pg_cron aktiviert ist:
-- Supabase Dashboard → Extensions → pg_cron aktivieren

-- SELECT cron.schedule(
--   'sticker_monthly_winner',
--   '5 0 1 * *',
--   $$ SELECT evaluate_monthly_winner(
--        to_char((now() AT TIME ZONE 'utc') - interval '1 day', 'YYYY-MM')
--      ); $$
-- );


-- ╔══════════════════════════════════════════════╗
-- ║  9. REALTIME aktivieren                      ║
-- ╚══════════════════════════════════════════════╝
-- Im Supabase Dashboard: Database → Replication
-- Folgende Tabellen zur Publication hinzufügen:
--   messages, challenges, minigame_scores

-- ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.challenges;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.minigame_scores;


-- ═══════════════════════════════════════════════
--  FERTIG ✅
--  Alle Tabellen, Funktionen und Policies sind
--  jetzt eingerichtet.
-- ═══════════════════════════════════════════════
