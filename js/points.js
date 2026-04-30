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

// ── Daily-Login-Milestones ─────────────────────
const LOGIN_DAILY     =   1; // jeden Tag
const LOGIN_STREAK_7  =  20; // nach 7 Tagen (einmalig)
const LOGIN_STREAK_14 =  50;
const LOGIN_STREAK_30 = 100;
const LOGIN_STREAK_100= 500;

// ── Challenge-Limits ──────────────────────────
const CHALLENGE_MAX_PTS_PER_DAY = 10; // max Gewinn pro Tag
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

// ── Login-Bonus berechnen ─────────────────────
// streak: Anzahl aufeinanderfolgender Tage
// Returns: { daily, milestone, total }
function calcLoginBonus(streak) {
  let milestone = 0;
  if      (streak === 100) milestone = LOGIN_STREAK_100;
  else if (streak === 30)  milestone = LOGIN_STREAK_30;
  else if (streak === 14)  milestone = LOGIN_STREAK_14;
  else if (streak === 7)   milestone = LOGIN_STREAK_7;

  return { daily: LOGIN_DAILY, milestone, total: LOGIN_DAILY + milestone };
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
