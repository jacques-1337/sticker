// ═══════════════════════════════════════════════
//  SUPABASE CLIENT — Initialisierung
//  Benötigt: config.js (SUPABASE_URL, SUPABASE_ANON_KEY)
// ═══════════════════════════════════════════════

let db = null;
let useSupabase = false;

try {
  const { createClient } = supabase;
  db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  useSupabase = true;
} catch(e) {
  console.warn('Supabase init failed:', e);
  const notice = document.getElementById('config-notice');
  if (notice) notice.classList.add('show');
}
