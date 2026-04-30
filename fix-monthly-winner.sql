-- ═══════════════════════════════════════════════════════════════
--  FIX: evaluate_monthly_winner — Gewinner bekommt 50 Punkte
--  In Supabase SQL-Editor ausführen
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.evaluate_monthly_winner(target_month text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_winner_sticker_id bigint;
  v_winner_user_id    uuid;
  v_vote_count        integer;
  v_reward            integer := 50; -- Sticker of the Month: +50 Punkte
BEGIN
  -- Sticker mit den meisten Stimmen im Zielmonat finden
  SELECT
    sv.sticker_id,
    s.owner_id,
    COUNT(*)::integer
  INTO
    v_winner_sticker_id,
    v_winner_user_id,
    v_vote_count
  FROM public.sticker_votes sv
  JOIN public.stickers s ON s.id = sv.sticker_id
  WHERE sv.month = target_month
    AND s.owner_id IS NOT NULL
  GROUP BY sv.sticker_id, s.owner_id
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  IF v_winner_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'reason', 'no_votes');
  END IF;

  -- Gewinner-Punkte vergeben
  UPDATE public.users
  SET points = COALESCE(points, 0) + v_reward
  WHERE id = v_winner_user_id;

  -- Ergebnis in sticker_month_winners speichern
  INSERT INTO public.sticker_month_winners (month, sticker_id, user_id, vote_count, reward_pts)
  VALUES (target_month, v_winner_sticker_id, v_winner_user_id, v_vote_count, v_reward)
  ON CONFLICT (month) DO UPDATE
    SET sticker_id = EXCLUDED.sticker_id,
        user_id    = EXCLUDED.user_id,
        vote_count = EXCLUDED.vote_count,
        reward_pts = EXCLUDED.reward_pts;

  RETURN json_build_object(
    'success',    true,
    'month',      target_month,
    'user_id',    v_winner_user_id,
    'sticker_id', v_winner_sticker_id,
    'votes',      v_vote_count,
    'reward',     v_reward
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_monthly_winner(text) TO anon;
GRANT EXECUTE ON FUNCTION public.evaluate_monthly_winner(text) TO authenticated;

-- Sicherstellen dass sticker_month_winners reward_pts hat
ALTER TABLE public.sticker_month_winners
  ADD COLUMN IF NOT EXISTS reward_pts integer DEFAULT 50;
