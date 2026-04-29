-- ═══════════════════════════════════════════════════════════════
--  FIX: finish_challenge + Profil-Spalten
--  App nutzt eigenes Auth-System (anon-Rolle, kein Supabase Auth)
--  In Supabase SQL-Editor ausführen
-- ═══════════════════════════════════════════════════════════════

-- 1. finish_challenge für anon-Verbindungen freigeben
GRANT EXECUTE ON FUNCTION public.finish_challenge(uuid, uuid) TO anon;

-- 2. Challenges-Tabelle: completed_at sicherstellen
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- 3. Profil-Spalten hinzufügen
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio       text DEFAULT '';

-- 4. Storage-Bucket avatars erstellen (einmalig)
--    Danach im Supabase-Dashboard: Storage → avatars → Make Public
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage-Policy: jeder darf hochladen (anon, kein Supabase Auth)
DROP POLICY IF EXISTS "avatars_insert_all" ON storage.objects;
CREATE POLICY "avatars_insert_all" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_select_all" ON storage.objects;
CREATE POLICY "avatars_select_all" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_update_all" ON storage.objects;
CREATE POLICY "avatars_update_all" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars');
