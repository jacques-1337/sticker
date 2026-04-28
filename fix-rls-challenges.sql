-- ═══════════════════════════════════════════════════════════════
--  FIX: challenges RLS — App nutzt eigenes Auth-System (kein Supabase Auth)
--  auth.uid() ist immer NULL → restriktive Policies blockieren alles
--  Lösung: permissive Policies (wie bei friends, messages, sticker_votes)
--  In Supabase SQL-Editor ausführen
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "challenges_select_own"     ON public.challenges;
DROP POLICY IF EXISTS "challenges_insert_own"     ON public.challenges;
DROP POLICY IF EXISTS "challenges_update_own"     ON public.challenges;
DROP POLICY IF EXISTS "challenges_delete_pending" ON public.challenges;
DROP POLICY IF EXISTS "challenges_all"            ON public.challenges;

CREATE POLICY "challenges_all" ON public.challenges
  FOR ALL USING (true) WITH CHECK (true);
