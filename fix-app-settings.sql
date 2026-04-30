-- ═══════════════════════════════════════════════════════════════
--  app_settings — Feature-Flags für Admin-Toggle
--  In Supabase SQL-Editor ausführen
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.app_settings (
  key        text PRIMARY KEY,
  value      text NOT NULL DEFAULT 'false',
  updated_at timestamptz DEFAULT now()
);

-- Standard-Werte: alles deaktiviert
INSERT INTO public.app_settings (key, value) VALUES
  ('challenges_active', 'false'),
  ('games_active',      'false')
ON CONFLICT (key) DO NOTHING;

-- RLS: alle lesen, nur Admin schreiben
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_read_all"   ON public.app_settings;
DROP POLICY IF EXISTS "settings_write_all"  ON public.app_settings;

CREATE POLICY "settings_read_all"  ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "settings_write_all" ON public.app_settings FOR ALL    USING (true) WITH CHECK (true);
