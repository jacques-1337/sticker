-- ═══════════════════════════════════════════════════════════════
--  FIX: finish_challenge — Punkte dürfen negativ werden (echter Abzug)
--  Displayed Score = sticker_score + users.points (challenge bonus/malus)
--  In Supabase SQL-Editor ausführen
-- ═══════════════════════════════════════════════════════════════

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
  SET status = 'finished', winner_id = p_winner_id,
      completed_at = now(), updated_at = now()
  WHERE id = p_challenge_id;

  IF p_winner_id IS NOT NULL AND v_amount > 0 THEN
    v_loser_id := CASE
      WHEN p_winner_id = v_ch.challenger_id THEN v_ch.opponent_id
      ELSE v_ch.challenger_id
    END;

    -- Verlierer: Abzug ohne Boden (kann negativ werden → echter Malus)
    UPDATE public.users
    SET points = COALESCE(points, 0) - v_amount
    WHERE id = v_loser_id;

    -- Gewinner: Bonus addieren
    UPDATE public.users
    SET points = COALESCE(points, 0) + v_amount
    WHERE id = p_winner_id;
  END IF;

  RETURN json_build_object(
    'success', true, 'winner_id', p_winner_id,
    'stake', v_amount, 'status', 'finished'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finish_challenge(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_challenge(uuid, uuid) TO anon;
