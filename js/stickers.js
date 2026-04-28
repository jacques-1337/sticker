// ═══════════════════════════════════════════════
//  STICKERS — Punkte, Storage, Submit, Photo
//  Benötigt: config.js, supabaseClient.js, ui.js
// ═══════════════════════════════════════════════

let stickers = [];
let selectedLocation = null;
let photoData = null;

// ── Punkte-Berechnung ────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2-lat1)*Math.PI/180;
  const dLng = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function getDistancePoints(km) {
  if (km >= 10000) return 25;
  if (km >= 5000)  return 10;
  if (km >= 2000)  return 5;
  return 1;
}

function calcPoints(city, hasPhoto, existingCountries) {
  const km  = haversine(HOME_LAT, HOME_LNG, city.lat, city.lng);
  let pts   = getDistancePoints(km);
  if (hasPhoto) pts += 5;
  if (city.cap) pts += 3;
  if (!existingCountries.includes(city.cc)) pts += 10;
  return {
    total:      pts,
    km:         Math.round(km),
    dist:       getDistancePoints(km),
    photo:      hasPhoto ? 5 : 0,
    capital:    city.cap ? 3 : 0,
    newCountry: !existingCountries.includes(city.cc) ? 10 : 0
  };
}

function getContinent(city) {
  const map = { EU:'Europa', NA:'Nordamerika', SA:'Südamerika', AS:'Asien', AF:'Afrika', OC:'Ozeanien' };
  return map[city.cont] || '?';
}

// ── Anonymisierung + EXIF-Strip ──────────────────────────────
function anonymize(lat, lng, opts = {}) {
  if (opts.isLive) return { lat, lng };
  const fuzz = 0.008;
  return {
    lat: lat + (Math.random()-0.5)*fuzz*2,
    lng: lng + (Math.random()-0.5)*fuzz*2
  };
}

async function stripExif(file) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const img    = new Image();
    const url    = URL.createObjectURL(file);
    img.onload = () => {
      canvas.width  = Math.min(img.width, 1600);
      canvas.height = Math.round(img.height * (canvas.width/img.width));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(resolve, 'image/jpeg', 0.85);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

// ── Storage ──────────────────────────────────────────────────
async function loadStickers() {
  if (useSupabase) {
    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 5000));
      const fetch = db.from('stickers').select('*').order('created_at', { ascending: false });
      const { data, error } = await Promise.race([fetch, timeout]);
      if (error) throw error;
      return data || [];
    } catch(e) {
      console.error('Load error:', e);
      if (e.message !== 'timeout') toast('Ladefehler – zeige lokale Daten', 'error');
      return loadLocal();
    }
  }
  return loadLocal();
}

function loadLocal() {
  try { return JSON.parse(localStorage.getItem('32er_stickers') || '[]'); }
  catch { return []; }
}

function saveLocal(s) {
  try { localStorage.setItem('32er_stickers', JSON.stringify(s)); } catch {}
}

async function saveSticker(sticker) {
  if (useSupabase) {
    try {
      let photoUrl = null;
      if (sticker.photoData) {
        const blob = await (await fetch(sticker.photoData)).blob();
        const filename = `sticker_${Date.now()}.jpg`;
        const { data, error } = await db.storage
          .from('sticker-photos')
          .upload(filename, blob, { contentType: 'image/jpeg' });
        if (!error) {
          const { data: urlData } = db.storage.from('sticker-photos').getPublicUrl(filename);
          photoUrl = urlData.publicUrl;
        }
      }
      const row = {
        city:         sticker.city,
        country:      sticker.country,
        country_code: sticker.countryCode,
        flag:         sticker.flag,
        lat:          sticker.lat,
        lng:          sticker.lng,
        points:       sticker.points,
        distance_km:  sticker.distanceKm,
        is_capital:   sticker.isCapital || false,
        continent:    sticker.continent,
        note:         sticker.note || null,
        photo_url:    photoUrl,
        pts_breakdown:sticker.breakdown,
        username:     sticker.username || null,
        session_id:   sticker.session_id || null,
        owner_id:     sticker.owner_id || null
      };
      const { data, error } = await db.from('stickers').insert([row]).select().single();
      if (error) throw error;
      return data;
    } catch(e) {
      console.error('Save error:', e);
      toast('Speicherfehler – lokal gespeichert', 'error');
      return saveLocalFallback(sticker);
    }
  }
  return saveLocalFallback(sticker);
}

function saveLocalFallback(sticker) {
  const local = loadLocal();
  const s = { ...sticker, id: Date.now(), created_at: new Date().toISOString() };
  local.unshift(s);
  saveLocal(local);
  return s;
}

function renderStickerList() {} // no-op (Tab entfernt)

// ── Photo-Upload ─────────────────────────────────────────────
document.getElementById('photo-input').addEventListener('change', async function(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5*1024*1024) { toast('Foto zu groß (max 5 MB)', 'error'); return; }

  toast('📷 Verarbeite Foto…');
  const clean = await stripExif(file);
  const reader = new FileReader();
  reader.onload = (ev) => {
    photoData = ev.target.result;
    document.getElementById('photo-preview').src = photoData;
    document.getElementById('photo-preview').style.display = 'block';
    document.getElementById('photo-upload-btn').style.display = 'none';
    if (selectedLocation) {
      const existing = stickers.map(s => s.country_code || s.countryCode || s.cc);
      const pts = calcPoints(selectedLocation, true, existing);
      selectedLocation.pts = pts;
      document.getElementById('confirm-pts').textContent = pts.total;
      document.getElementById('pin-pts-val').textContent = pts.total;
      document.getElementById('bd-dist').textContent = `+${pts.dist}`;
      document.getElementById('bd-photo-row').style.display = 'flex';
      document.getElementById('bd-total').textContent = `${pts.total} Pkt`;
    }
    toast('📷 Foto hinzugefügt!', 'success');
  };
  reader.readAsDataURL(clean);
});

// ── Details-Overlay (Schritt 2) ──────────────────────────────
function openDetailsOverlay() {
  const city = selectedLocation;
  const existingCountries = stickers.map(s => s.country_code || s.countryCode || s.cc);
  const pts = calcPoints(city, !!photoData, existingCountries);
  selectedLocation = { ...city, pts };

  document.getElementById('confirm-flag').textContent    = city.f || '📍';
  document.getElementById('confirm-city').textContent    = `${city.n}, ${city.c}`;
  document.getElementById('confirm-country').textContent = `${pts.km.toLocaleString('de')} km von Stahnsdorf`;
  document.getElementById('confirm-pts').textContent     = pts.total;

  const badges = [];
  if (city.cap) badges.push('<span class="badge badge-capital">🏛 Hauptstadt</span>');
  if (!existingCountries.includes(city.cc)) badges.push('<span class="badge badge-newcountry">🌍 Neues Land!</span>');
  document.getElementById('confirm-badges').innerHTML = badges.join('');

  document.getElementById('bd-dist').textContent                = `+${pts.dist}`;
  document.getElementById('bd-capital-row').style.display       = pts.capital   ? '' : 'none';
  document.getElementById('bd-newcountry-row').style.display    = pts.newCountry? '' : 'none';
  document.getElementById('bd-photo-row').style.display         = pts.photo     ? '' : 'none';
  document.getElementById('bd-total').textContent               = `${pts.total} Pkt`;
  document.getElementById('pts-breakdown').classList.add('show');

  showScreen('map');
  setTimeout(() => {
    document.getElementById('add-overlay').classList.add('open');
    document.getElementById('overlay-dimmer').classList.add('show');
  }, 100);
}

// ── Sticker speichern ────────────────────────────────────────
async function submitSticker() {
  if (!selectedLocation) return;
  const btn = document.getElementById('submit-btn');
  btn.disabled = true; btn.textContent = 'Speichere…';

  const anon     = anonymize(selectedLocation.lat, selectedLocation.lng, { isLive: !!selectedLocation.isLive });
  const existing = stickers.map(s => s.country_code || s.countryCode || s.cc);
  const ptsData  = calcPoints(selectedLocation, !!photoData, existing);

  const sticker = {
    city:        selectedLocation.n,
    country:     selectedLocation.c,
    countryCode: selectedLocation.cc,
    cc:          selectedLocation.cc,
    flag:        selectedLocation.f,
    lat:         anon.lat, lng: anon.lng,
    city_lat:    anon.lat, city_lng: anon.lng,
    points:      ptsData.total,
    pts:         ptsData.total,
    distanceKm:  ptsData.km,
    isCapital:   selectedLocation.cap || false,
    continent:   selectedLocation.cont,
    note:        document.getElementById('note-input').value.trim(),
    photoData:   photoData,
    breakdown:   ptsData,
    username:    myUsername || null,
    session_id:  mySessionId,
    user_id:     myUserId || null,
    owner_id:    currentUser ? currentUser.id : null
  };

  try {
    const saved = await saveSticker(sticker);
    stickers.unshift({ ...sticker, ...saved });
    renderMarkers();
    renderStickerList();
    updateScore();
    updateAccountInfoBox();

    selectedLocation = null;
    photoData        = null;
    document.getElementById('note-input').value = '';
    document.getElementById('photo-input').value = '';
    document.getElementById('photo-preview').style.display = 'none';
    document.getElementById('photo-upload-btn').style.display = 'block';
    btn.textContent = '🎯 Sticker speichern';

    toast(`🎉 +${ptsData.total} Punkte! Sticker gesetzt in ${sticker.city}`, 'success');
    closeAddOverlay();
    showScreen('map');
    setTimeout(() => { map.setView([anon.lat, anon.lng], 10, { animate: true }); }, 500);
  } catch(e) {
    console.error('Submit error:', e);
    toast('Fehler beim Speichern – bitte nochmal versuchen', 'error');
    btn.disabled = false; btn.textContent = '🎯 Sticker speichern';
  }
}
