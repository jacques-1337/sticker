-- ═══════════════════════════════════════════════════════════════
--  FIX: finish_challenge + Profil-Spalten + Storage
--  In Supabase SQL-Editor ausführen
-- ═══════════════════════════════════════════════════════════════

-- 1. finish_challenge neu deployen:
--    - Punkte-Abzug darf negativ werden (kein GREATEST(0,...) mehr)
--    - Für anon UND authenticated freigeben
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

    -- Verlierer: darf ins Negative (kein GREATEST/CLAMP)
    UPDATE public.users
    SET points = v_loser_pts - v_amount
    WHERE id = v_loser_id;

    -- Gewinner: addieren
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

GRANT EXECUTE ON FUNCTION public.finish_challenge(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.finish_challenge(uuid, uuid) TO authenticated;

-- 2. challenges.completed_at sicherstellen
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- 3. Profil-Spalten
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio       text DEFAULT '';

-- 4. Storage-Bucket avatars (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 5. Storage RLS: jeder darf lesen und schreiben
DROP POLICY IF EXISTS "avatars_insert_all" ON storage.objects;
CREATE POLICY "avatars_insert_all" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_select_all" ON storage.objects;
CREATE POLICY "avatars_select_all" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_update_all" ON storage.objects;
CREATE POLICY "avatars_update_all" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_delete_all" ON storage.objects;
CREATE POLICY "avatars_delete_all" ON storage.objects
  FOR DELETE USING (bucket_id = 'avatars');
