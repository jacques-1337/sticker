// ═══════════════════════════════════════════════
//  INIT — App-Start, Auth-Check, Event-Handler
//  Muss als letztes Script geladen werden
// ═══════════════════════════════════════════════

let myUserId = null;

// Supabase Auth: nur Session prüfen — kein anonymous Sign-In
// (App verwendet eigenes Username/Passwort-System)
async function ensureAuth() {
  if (!useSupabase) return;
  try {
    const { data: { session } } = await db.auth.getSession();
    if (session) { myUserId = session.user.id; }
    // Kein signInAnonymously() — wird in Supabase nicht aktiviert
  } catch(e) {
    console.warn('Auth-Session check failed:', e.message);
  }
}

async function init() {
  injectLogos();
  await ensureAuth();
  initMap();

  await restoreSession();

  stickers = await loadStickers();
  renderMarkers();
  loadUserAvatars(); // Avatare nachladen, Marker danach neu rendern
  updateScore();
  updateAccountInfoBox();

  if (currentUser) loadFriendsTab();

  // iOS Safari: Viewport-Resize für Karten
  const onViewportResize = () => {
    map?.invalidateSize();
    pinMap?.invalidateSize();
  };
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onViewportResize);
  }
  window.addEventListener('orientationchange', () => setTimeout(onViewportResize, 400));
  window.addEventListener('resize', onViewportResize);

  setTimeout(() => {
    document.getElementById('loading-overlay').classList.add('hidden');
  }, 800);
}

init();
