// ═══════════════════════════════════════════════
//  POINTS — Zentrales Punkte-System (Phase 7)
//  Alle Regeln an einem Ort. Immer diese Datei
//  verwenden, nie verteilt in anderen Modulen.
// ═══════════════════════════════════════════════

// ── Basis-Werte ───────────────────────────────
const PTS_STICKER_BASE   = 10; // Basis für jeden Sticker
const PTS_NEW_COUNTRY    = 10; // Erstmals in neuem Land
const PTS_CAPITAL        = 3;  // Hauptstadt
const PTS_PHOTO          = 5;  // Foto beigefügt

// ── Distanz-Staffel ───────────────────────────
//   Abstand vom Heimatort (Stahnsdorf)
const DIST_RULES = [
  { min: 8000, pts: 10 },
  { min: 5000, pts:  8 },
  { min: 2000, pts:  6 },
  { min:  500, pts:  4 },
  { min:   50, pts:  2 },
  { min:    1, pts:  1 },
  { min:    0, pts:  0 },
];

// ── Sticker of the Month ──────────────────────
const PTS_SOTM_WINNER = 50; // monatlicher Gewinner

// ── Challenge-Limits ──────────────────────────
const CHALLENGE_MAX_PTS_PER_DAY  = 10; // max Gewinn pro Tag
const CHALLENGE_MAX_WINS_PER_DAY =  1; // max 1 bezahlte Challenge/Tag

// ── Game-Limits ───────────────────────────────
const GAME_MAX_PLAYS_PER_DAY = 3; // pro Spiel & Spieler

// ── Distanz-Punkte berechnen ──────────────────
function getDistancePoints(km) {
  for (const rule of DIST_RULES) {
    if (km >= rule.min) return rule.pts;
  }
  return 0;
}

// ── Sticker-Punkte berechnen ──────────────────
// city          : { lat, lng, cc, cap }
// hasPhoto      : boolean
// existingCodes : string[] — bereits besuchte Ländercodes
// Returns: { total, base, dist, photo, capital, newCountry, km }
function calcPoints(city, hasPhoto, existingCodes) {
  const km         = haversine(HOME_LAT, HOME_LNG, city.lat, city.lng);
  const isNew      = !existingCodes.includes(city.cc);

  const base       = PTS_STICKER_BASE;
  const dist       = getDistancePoints(km);
  const photo      = hasPhoto ? PTS_PHOTO      : 0;
  const capital    = city.cap ? PTS_CAPITAL    : 0;
  const newCountry = isNew    ? PTS_NEW_COUNTRY : 0;

  return {
    total:      base + dist + photo + capital + newCountry,
    km:         Math.round(km),
    base,
    dist,
    photo,
    capital,
    newCountry,
  };
}

// ── Challenge-Punkte validieren ───────────────
// wonTodayPts: bereits gewonnene Punkte heute
// stake: Einsatz dieser Challenge
// Returns: effektiv erlaubter Gewinn (max bis CHALLENGE_MAX_PTS_PER_DAY)
function calcChallengeGain(wonTodayPts, stake) {
  const remaining = Math.max(0, CHALLENGE_MAX_PTS_PER_DAY - wonTodayPts);
  return Math.min(stake, remaining);
}

// ── Haversine ─────────────────────────────────
// (Kopie aus stickers.js — muss ohne Abhängigkeit funktionieren)
function haversine(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat/2)**2
             + Math.cos(lat1*Math.PI/180)
             * Math.cos(lat2*Math.PI/180)
             * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


// ═══════════════════════════════════════════════
//  FEATURE FLAGS
//  Standard: alles OFF — Admin schaltet über
//  das Admin-Panel ein (gespeichert in Supabase)
// ═══════════════════════════════════════════════

const FEATURE_FLAGS = {
  challenges_active: false, // Challenges + Punkte für alle User
  games_active:      false, // Mini-Games + Punkte für alle User
};

async function loadFeatureFlags() {
  if (typeof useSupabase === 'undefined' || !useSupabase || !db) return;
  try {
    const { data } = await db.from('app_settings').select('key, value');
    (data || []).forEach(row => {
      if (row.key in FEATURE_FLAGS) {
        FEATURE_FLAGS[row.key] = row.value === 'true';
      }
    });
  } catch(e) { /* Tabelle existiert noch nicht — Defaults bleiben */ }
  applyFeatureFlags();
}

async function setFeatureFlag(key, value) {
  FEATURE_FLAGS[key] = value;
  if (typeof useSupabase !== 'undefined' && useSupabase && db) {
    try {
      await db.from('app_settings').upsert({ key, value: String(value) }, { onConflict: 'key' });
    } catch(e) { logInternal?.('flags/set', e); }
  }
  applyFeatureFlags();
}

function applyFeatureFlags() {
  const adminActive = typeof isAdmin !== 'undefined' && isAdmin;

  // Challenges-Sektion
  const chSec = document.getElementById('challenges-section');
  if (chSec) {
    if (FEATURE_FLAGS.challenges_active || adminActive) {
      chSec.style.display = '';
    } else {
      chSec.innerHTML = _featureLockedHtml('⚔️ Challenges', 'Bald verfügbar — wird vom Admin freigeschaltet.');
    }
  }

  // Mini-Game Monats-Challenge
  const mgcSec = document.getElementById('mgc-section');
  if (mgcSec) {
    if (FEATURE_FLAGS.games_active || adminActive) {
      mgcSec.style.display = '';
    } else {
      mgcSec.innerHTML = _featureLockedHtml('🎮 Mini-Game Challenge', 'Bald verfügbar — wird vom Admin freigeschaltet.');
    }
  }

  // Challenge-Buttons in Freundesliste
  document.querySelectorAll('.ch-friend-btn').forEach(btn => {
    btn.style.display = FEATURE_FLAGS.challenges_active || adminActive ? '' : 'none';
  });

  // Admin-Toggles aktualisieren
  if (adminActive && typeof renderAdminFeatureToggles === 'function') renderAdminFeatureToggles();
}

function _featureLockedHtml(title, msg) {
  return `
    <div class="social-section-header">
      <span class="social-section-title">${title}</span>
      <span class="social-section-badge" style="background:var(--text3);opacity:0.6">Beta</span>
    </div>
    <div class="muted-empty" style="padding:18px 12px">
      🔒 ${msg}
    </div>`;
}
