// ═══════════════════════════════════════════════
//  MAP — Leaflet-Karte, Marker, GPS, Pin-Screen
//  Benötigt: config.js, stickers.js, friends.js, ui.js
// ═══════════════════════════════════════════════

let map = null;
let markersLayer = null;
let currentMapFilter = 'all';
let mapMode = 'profile'; // 'profile' | 'cluster'
let userAvatarCache = {}; // userId → avatarUrl

// ── Karte initialisieren ─────────────────────────────────────
function initMap() {
  map = L.map('map', {
    center: [30, 10], zoom: 2,
    zoomControl: false, attributionControl: false
  });
  L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap'
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
}

// ── Karten-Modus umschalten ──────────────────────────────────
function switchMapMode(mode) {
  mapMode = mode;
  document.querySelectorAll('.map-mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  renderMarkers();
}

// ── Filter ───────────────────────────────────────────────────
function filterStickersForMap() {
  if (currentMapFilter === 'own') {
    if (!currentUser) return [];
    return stickers.filter(s => s.owner_id === currentUser.id);
  }
  if (currentMapFilter === 'friends') {
    if (!currentUser) return [];
    const friendIds = friendsCache.map(f => f.id);
    return stickers.filter(s =>
      s.owner_id === currentUser.id || friendIds.includes(s.owner_id));
  }
  return stickers;
}

function switchMapFilter(mode) {
  if ((mode === 'own' || mode === 'friends') && !currentUser) {
    toast('🔒 Einloggen um diesen Filter zu nutzen', 'error');
    showAuthOverlay();
    return;
  }
  currentMapFilter = mode;
  document.querySelectorAll('.map-filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === mode);
  });
  if (mode === 'friends' && currentUser && !friendsCache.length) {
    loadFriendsList().then(() => renderMarkers());
  } else {
    renderMarkers();
  }
  if (typeof renderStickerList === 'function') renderStickerList();
}

function updateMapFilterCounters() {
  const all = stickers.length;
  let own = 0, fr = 0;
  if (currentUser) {
    own = stickers.filter(s => s.owner_id === currentUser.id).length;
    const friendIds = friendsCache.map(f => f.id);
    fr  = stickers.filter(s =>
      s.owner_id === currentUser.id || friendIds.includes(s.owner_id)).length;
  }
  const a = document.getElementById('mf-count-all');
  const o = document.getElementById('mf-count-own');
  const f = document.getElementById('mf-count-friends');
  if (a) a.textContent = all;
  if (o) o.textContent = own;
  if (f) f.textContent = fr;
  document.querySelectorAll('.map-filter-btn').forEach(b => {
    const mode = b.dataset.filter;
    b.disabled = (mode === 'own' || mode === 'friends') && !currentUser;
  });
}

function updateMapFilterEmptyState(visibleCount) {
  const el = document.getElementById('map-filter-empty');
  if (!el) return;
  if (visibleCount > 0 || currentMapFilter === 'all') { el.classList.remove('show'); return; }
  if (currentMapFilter === 'own')     el.innerHTML = '🤷 Noch keine eigenen Sticker. Setze deinen ersten!';
  else if (currentMapFilter === 'friends') el.innerHTML = '👥 Du oder deine Freunde haben noch keine Sticker hier.';
  el.classList.add('show');
}

function updateMapStats(visible) {
  const list = visible || filterStickersForMap();
  document.getElementById('stat-pins').textContent = list.length;
  const countries = new Set(list.map(s => s.country_code || s.countryCode || s.cc)).size;
  document.getElementById('stat-countries').textContent = countries;
}

// ── User-Avatare für Marker laden ────────────────────────────
async function loadUserAvatars() {
  if (!useSupabase || !stickers.length) return;
  const ownerIds = [...new Set(stickers.filter(s => s.owner_id).map(s => s.owner_id))];
  if (!ownerIds.length) return;
  try {
    const { data } = await db.from('users').select('id, avatar_url').in('id', ownerIds);
    let changed = false;
    (data || []).forEach(u => {
      if (u.avatar_url && userAvatarCache[u.id] !== u.avatar_url) {
        userAvatarCache[u.id] = u.avatar_url;
        changed = true;
      }
    });
    if (changed) renderMarkers();
  } catch(e) { /* Avatare sind optional */ }
}

// ── Marker rendern ───────────────────────────────────────────
function renderMarkers() {
  if (!map) return;

  // Alten Layer entfernen und neuen passend zum Modus erstellen
  if (markersLayer && map.hasLayer(markersLayer)) map.removeLayer(markersLayer);

  const useCluster = mapMode === 'cluster' && typeof L.markerClusterGroup === 'function';

  if (useCluster) {
    markersLayer = L.markerClusterGroup({
      maxClusterRadius: 70,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      animate: true,
      iconCreateFunction(cluster) {
        const n    = cluster.getChildCount();
        const size = n > 99 ? 54 : n > 9 ? 44 : 36;
        return L.divIcon({
          html:     `<div class="map-cluster" style="width:${size}px;height:${size}px;font-size:${Math.round(size*0.34)}px">${n}</div>`,
          className: '', iconSize: [size, size], iconAnchor: [size/2, size/2]
        });
      }
    });
  } else {
    markersLayer = L.layerGroup();
  }
  markersLayer.addTo(map);

  const visible = filterStickersForMap();

  visible.forEach(s => {
    const lat = s.lat || s.city_lat;
    const lng = s.lng || s.city_lng;
    if (!lat || !lng) return;

    const pts = s.points || s.pts || 0;
    const isOwn    = currentUser && s.owner_id === currentUser.id;
    const isFriend = currentUser && !isOwn && friendsCache.some(f => f.id === s.owner_id);

    let extraClass = isOwn ? ' map-marker-own' : isFriend ? ' map-marker-friend' : '';

    let icon;
    if (useCluster) {
      // Cluster-Modus: einfache farbige Kreise mit Punktzahl
      const size = pts >= 20 ? 34 : pts >= 10 ? 28 : 24;
      const capitalBadge = s.is_capital ? '<span class="map-marker-capital">★</span>' : '';
      icon = L.divIcon({
        className: '',
        html: `<div class="map-marker${extraClass}" style="width:${size}px;height:${size}px;font-size:${Math.round(size*0.38)}px">${pts}${capitalBadge}</div>`,
        iconSize: [size, size], iconAnchor: [size/2, size/2]
      });
    } else {
      // Profil-Modus: Avatar wenn vorhanden
      const avatarUrl = s.owner_id ? userAvatarCache[s.owner_id] : null;
      const size = avatarUrl ? 38 : (pts >= 20 ? 36 : pts >= 10 ? 30 : pts >= 5 ? 26 : 22);
      const capitalBadge = s.is_capital && !avatarUrl ? '<span class="map-marker-capital">★</span>' : '';
      const inner = avatarUrl
        ? `<img src="${avatarUrl}" class="map-marker-img" onerror="this.style.display='none';this.nextSibling.style.display='flex'"><span class="map-marker-fallback" style="display:none">${pts}</span>`
        : `${pts}${capitalBadge}`;
      icon = L.divIcon({
        className: '',
        html: `<div class="map-marker${extraClass}${avatarUrl?' map-marker-has-avatar':''}" style="width:${size}px;height:${size}px;font-size:${Math.round(size*0.38)}px">${inner}</div>`,
        iconSize: [size, size], iconAnchor: [size/2, size/2]
      });
    }

    // Popup-Inhalt (beide Modi)
    let ownerLabel = '';
    if (isOwn) {
      const avUrl = userAvatarCache[s.owner_id];
      const avHtml = avUrl
        ? `<img src="${avUrl}" style="width:20px;height:20px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:4px">`
        : '';
      ownerLabel = `<div style="font-size:11px;color:#e8c84a;font-weight:700;margin-top:2px">${avHtml}👤 von dir</div>`;
    } else if (s.owner_id) {
      const friend  = friendsCache.find(f => f.id === s.owner_id);
      const avUrl   = userAvatarCache[s.owner_id];
      const avHtml  = avUrl ? `<img src="${avUrl}" style="width:20px;height:20px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:4px">` : '';
      if (friend)          ownerLabel = `<div style="font-size:11px;color:#8aa9e8;font-weight:700;margin-top:2px">${avHtml}👥 ${escHtml(friend.username)}</div>`;
      else if (s.username) ownerLabel = `<div style="font-size:11px;color:#8888aa;margin-top:2px">${avHtml}von ${escHtml(s.username)}</div>`;
    } else if (s.username) {
      ownerLabel = `<div style="font-size:11px;color:#8888aa;margin-top:2px">von ${escHtml(s.username)}</div>`;
    }

    const capitalNote = s.is_capital ? `<div style="font-size:11px;color:#e8c84a;margin-top:2px">🏛 Hauptstadt +3 Pkt</div>` : '';

    const marker = L.marker([lat, lng], { icon });
    marker.bindPopup(`
      <div style="min-width:160px">
        <div style="font-size:24px;margin-bottom:4px">${s.flag||'📍'}</div>
        <div style="font-weight:700;font-size:15px;color:#f0f0f8">${escHtml(s.city||'')}</div>
        <div style="font-size:12px;color:#8888aa;margin-bottom:6px">${escHtml(s.country||'')}</div>
        ${s.photo_url ? `<img src="${s.photo_url}" style="width:100%;border-radius:8px;margin-bottom:8px;aspect-ratio:1/1;max-height:160px;object-fit:contain;object-position:center;background:#0a0a0a" onerror="this.style.display='none'">` : ''}
        <div style="font-size:20px;font-weight:800;color:#e8c84a">${pts} Punkte</div>
        ${capitalNote}${ownerLabel}
        ${s.note ? `<div style="font-size:12px;color:#8888aa;margin-top:4px">${escHtml(s.note)}</div>` : ''}
      </div>
    `);
    markersLayer.addLayer(marker);
  });

  updateMapStats(visible);
  updateMapFilterCounters();
  updateMapFilterEmptyState(visible.length);
}

// ── Geocoding-Helfer ─────────────────────────────────────────
function findNearestCity(lat, lng) {
  let best = null, bestDist = Infinity;
  CITIES.forEach(c => {
    const d = haversine(lat, lng, c.lat, c.lng);
    if (d < bestDist) { bestDist = d; best = c; }
  });
  return { city: best, dist: bestDist };
}

function cityByCc(cc) {
  if (!cc) return null;
  return CITIES.find(c => c.cc === cc.toUpperCase()) || null;
}

function ccToFlag(cc) {
  if (!cc || cc.length !== 2) return '🌍';
  const up   = cc.toUpperCase();
  const base = 0x1F1E6;
  return String.fromCodePoint(base + up.charCodeAt(0) - 65) +
         String.fromCodePoint(base + up.charCodeAt(1) - 65);
}

let reverseGeocodeController = null;
async function reverseGeocode(lat, lng) {
  if (reverseGeocodeController) reverseGeocodeController.abort();
  reverseGeocodeController = new AbortController();
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&accept-language=de`;
    const res = await fetch(url, {
      signal: reverseGeocodeController.signal,
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const a    = data.address || {};
    const place   = a.city || a.town || a.village || a.hamlet || a.municipality ||
                    a.suburb || a.county || a.state || a.region || a.natural || a.tourism || '';
    const country = a.country || '';
    const cc      = (a.country_code || '').toUpperCase();

    if (!cc) {
      return { n: place||'Ozean', c:'Internationale Gewässer', cc:'', f:'🌊', cont:'OC', cap:false, lat, lng, source:'ocean' };
    }

    const ref  = cityByCc(cc);
    const cont = ref ? ref.cont : 'OC';
    let isCap  = false;
    if (ref && ref.cap) {
      const d = haversine(lat, lng, ref.lat, ref.lng);
      if (d < 15) isCap = true;
    }

    return { n: place||(country||'Unbekannt'), c: country||'–', cc, f: ccToFlag(cc), cont, cap: isCap, lat, lng, source:'nominatim' };
  } catch (e) {
    if (e.name === 'AbortError') return null;
    console.warn('Reverse-Geocode fail:', e);
    return null;
  }
}

function buildFallbackLocation(lat, lng) {
  const { city: nearest, dist } = findNearestCity(lat, lng);
  if (!nearest) {
    return { n:'Unbekannter Ort', c:'–', cc:'', f:'🌍', cont:'OC', cap:false, lat, lng, source:'fallback' };
  }
  return {
    n:    dist < 15 ? nearest.n : `Nähe ${nearest.n}`,
    c:    nearest.c, cc: nearest.cc, f: nearest.f, cont: nearest.cont,
    cap:  dist < 15 ? (nearest.cap||false) : false,
    lat, lng, source: 'fallback'
  };
}

// ── Pin-Screen (Schritt 1) ───────────────────────────────────
let pinSearchTimeout;
let pinMap = null;
let pinReverseTimeout;
let suppressAutoLocate = false;
let pinResolveSeq = 0;

document.getElementById('pin-city-input').addEventListener('input', function() {
  clearTimeout(pinSearchTimeout);
  pinSearchTimeout = setTimeout(() => doPinSearch(this.value.trim()), 200);
});
document.getElementById('pin-city-input').addEventListener('blur', function() {
  setTimeout(() => document.getElementById('pin-suggestions').classList.remove('open'), 200);
});

function doPinSearch(q) {
  const sug = document.getElementById('pin-suggestions');
  if (q.length < 2) { sug.classList.remove('open'); return; }
  const ql = q.toLowerCase()
    .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');

  const results = CITIES.filter(c => {
    const cn = c.n.toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
    const cc = c.c.toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
    // Priorität: starts-with schlägt contains
    return cn.startsWith(ql) || c.n.toLowerCase().startsWith(ql) ||
           cn.includes(ql)   || c.n.toLowerCase().includes(ql)   ||
           cc.includes(ql)   || c.c.toLowerCase().includes(ql);
  })
  // Sortierung: starts-with zuerst, dann alphabetisch
  .sort((a, b) => {
    const an = a.n.toLowerCase(), bn = b.n.toLowerCase();
    const aStart = an.startsWith(ql) ? 0 : 1;
    const bStart = bn.startsWith(ql) ? 0 : 1;
    if (aStart !== bStart) return aStart - bStart;
    return an.localeCompare(bn, 'de');
  })
  .slice(0, 10);
  if (!results.length) {
    // Kein lokaler Treffer → Nominatim-Suche als Fallback
    sug.innerHTML = '<div class="suggestion-item" style="color:var(--text2);font-size:12px">🔍 Suche online…</div>';
    sug.classList.add('open');
    searchNominatim(q);
    return;
  }
  sug.innerHTML = results.map(c => {
    const km = Math.round(haversine(HOME_LAT, HOME_LNG, c.lat, c.lng));
    return `<div class="suggestion-item" onclick="selectPinCity(${CITIES.indexOf(c)})">
      <span class="flag">${c.f}</span>
      <span style="flex:1;padding:0 8px">
        <strong>${c.n}</strong>
        <span style="color:var(--text2);font-size:12px;display:block">${c.c}${c.cap?' 🏛':''}</span>
      </span>
      <span class="pop">${km > 1000 ? Math.round(km/100)/10+'k' : km} km</span>
    </div>`;
  }).join('');
  sug.classList.add('open');
}

// Nominatim-Freitext-Suche für Orte außerhalb der lokalen DB
let nominatimSearchTimer = null;
function searchNominatim(q) {
  clearTimeout(nominatimSearchTimer);
  nominatimSearchTimer = setTimeout(async () => {
    const sug = document.getElementById('pin-suggestions');
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=8&accept-language=de`;
      const res  = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!data.length) {
        sug.innerHTML = '<div class="suggestion-item" style="color:var(--text2);font-size:12px">Kein Ort gefunden</div>';
        return;
      }
      sug.innerHTML = data.map((r, i) => {
        const lat  = parseFloat(r.lat);
        const lng  = parseFloat(r.lon);
        const km   = Math.round(haversine(HOME_LAT, HOME_LNG, lat, lng));
        const name = r.name || r.display_name.split(',')[0];
        const sub  = r.display_name.split(',').slice(1,3).join(',').trim();
        const cc   = (r.address?.country_code || '').toUpperCase();
        const flag = cc ? ccToFlag(cc) : '📍';
        return `<div class="suggestion-item" onclick="selectNominatimResult(${i})" data-nom-idx="${i}">
          <span class="flag">${flag}</span>
          <span style="flex:1;padding:0 8px">
            <strong>${escHtml(name)}</strong>
            <span style="color:var(--text2);font-size:12px;display:block">${escHtml(sub)}</span>
          </span>
          <span class="pop">${km > 1000 ? Math.round(km/100)/10+'k' : km} km</span>
        </div>`;
      }).join('');
      // Ergebnisse für Auswahl cachen
      window._nominatimResults = data;
    } catch(e) {
      sug.innerHTML = '<div class="suggestion-item" style="color:var(--text2);font-size:12px">⚠️ Online-Suche fehlgeschlagen</div>';
    }
  }, 400);
}

async function selectNominatimResult(idx) {
  const r    = window._nominatimResults?.[idx];
  if (!r) return;
  const lat  = parseFloat(r.lat);
  const lng  = parseFloat(r.lon);
  const name = r.name || r.display_name.split(',')[0];
  const cc   = (r.address?.country_code || '').toUpperCase();

  document.getElementById('pin-city-input').value = name;
  document.getElementById('pin-suggestions').classList.remove('open');

  // Reverse-Geocode für vollständige Metadaten
  let loc = await reverseGeocode(lat, lng);
  if (!loc) loc = buildFallbackLocation(lat, lng);
  loc.n   = name;
  loc.lat = lat;
  loc.lng = lng;

  if (pinMap) pinMap.setView([lat, lng], 13, { animate: true });
  updatePinLocationBarLoose(loc);
}

function selectPinCity(idx) {
  const city = CITIES[idx];
  document.getElementById('pin-city-input').value = city.n;
  document.getElementById('pin-suggestions').classList.remove('open');
  if (pinMap) { pinMap.setView([city.lat, city.lng], 13, { animate: true }); updatePinLocationBar(city); }
}

function updatePinLocationBar(city) {
  if (!city) {
    document.getElementById('pin-loc-city').textContent = 'Karte verschieben oder Stadt suchen';
    document.getElementById('pin-loc-sub').textContent  = 'Tippe auf deinen Sticker-Spot';
    document.getElementById('pin-loc-pts').style.display= 'none';
    document.getElementById('pin-loc-flag').textContent = '🌍';
    document.getElementById('pin-confirm-btn').disabled = true;
    selectedLocation = null;
    return;
  }
  const existingCountries = stickers.map(s => s.country_code || s.countryCode || s.cc);
  const pts = calcPoints(city, !!photoData, existingCountries);
  selectedLocation = { ...city, pts };

  document.getElementById('pin-loc-flag').textContent  = city.f || '📍';
  document.getElementById('pin-loc-city').textContent  = `${city.n}, ${city.c}`;
  document.getElementById('pin-loc-sub').textContent   = `${pts.km.toLocaleString('de')} km von Stahnsdorf${city.cap?' · 🏛 Hauptstadt':''}`;
  document.getElementById('pin-pts-val').textContent   = pts.total;
  document.getElementById('pin-loc-pts').style.display = 'block';
  document.getElementById('pin-confirm-btn').disabled  = false;
}

function showPinLocationLoading() {
  document.getElementById('pin-loc-city').textContent = '🔍 Ort wird gesucht…';
  document.getElementById('pin-loc-sub').textContent  = 'Moment bitte';
  document.getElementById('pin-loc-pts').style.display= 'none';
  document.getElementById('pin-loc-flag').textContent = '⏳';
  document.getElementById('pin-confirm-btn').disabled = true;
}

function updatePinLocationBarLoose(loc) {
  if (!loc) {
    document.getElementById('pin-loc-city').textContent = 'Weiter zoomen für Ortsauflösung';
    document.getElementById('pin-loc-sub').textContent  = 'Mindestens Zoom 3';
    document.getElementById('pin-loc-pts').style.display= 'none';
    document.getElementById('pin-loc-flag').textContent = '🌍';
    document.getElementById('pin-confirm-btn').disabled = true;
    selectedLocation = null;
    return;
  }
  const existingCountries = stickers.map(s => s.country_code || s.countryCode || s.cc);
  const pts = calcPoints(loc, !!photoData, existingCountries);
  selectedLocation = { ...loc, pts };

  document.getElementById('pin-loc-flag').textContent  = loc.f || '📍';
  const cityLine = loc.c && loc.c !== '–' ? `${loc.n}, ${loc.c}` : loc.n;
  document.getElementById('pin-loc-city').textContent  = cityLine;
  const sourceTag = loc.source === 'fallback' ? ' · 📚 Lokal'
                  : loc.source === 'ocean'    ? ' · 🌊' : '';
  document.getElementById('pin-loc-sub').textContent   =
    `${pts.km.toLocaleString('de')} km von Stahnsdorf${loc.cap?' · 🏛 Hauptstadt':''}${sourceTag}`;
  document.getElementById('pin-pts-val').textContent   = pts.total;
  document.getElementById('pin-loc-pts').style.display = 'block';
  document.getElementById('pin-confirm-btn').disabled  = false;
}

async function onPinMapMove() {
  document.getElementById('pin-crosshair').classList.remove('dragging');
  if (suppressAutoLocate) return;
  const center = pinMap.getCenter();
  const zoom   = pinMap.getZoom();
  if (zoom < 3) { updatePinLocationBarLoose(null); return; }

  clearTimeout(pinReverseTimeout);
  showPinLocationLoading();

  pinReverseTimeout = setTimeout(async () => {
    const mySeq = ++pinResolveSeq;
    const lat = center.lat, lng = center.lng;
    let loc = await reverseGeocode(lat, lng);
    if (!loc) loc = buildFallbackLocation(lat, lng);
    if (mySeq !== pinResolveSeq) return;
    updatePinLocationBarLoose(loc);
  }, 500);
}

function openPinScreen(keepLocation = false) {
  document.getElementById('pin-screen').classList.add('open');
  document.getElementById('pin-city-input').value = '';
  if (!keepLocation) updatePinLocationBar(null);

  setTimeout(() => {
    if (!pinMap) {
      pinMap = L.map('pin-map-leaflet', {
        center: map ? map.getCenter() : [30, 10],
        zoom:   map ? Math.max(map.getZoom(), 4) : 3,
        zoomControl: false, attributionControl: false
      });
      L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© OpenStreetMap'
      }).addTo(pinMap);

      pinMap.on('moveend',   onPinMapMove);
      pinMap.on('movestart', () => document.getElementById('pin-crosshair').classList.add('dragging'));
      pinMap.on('move',      () => clearTimeout(pinReverseTimeout));

      if (keepLocation && selectedLocation) {
        pinMap.setView([selectedLocation.lat, selectedLocation.lng], 12);
        updatePinLocationBar(selectedLocation);
      }
    } else {
      pinMap.invalidateSize();
      if (selectedLocation) pinMap.setView([selectedLocation.lat, selectedLocation.lng], 10);
    }
  }, 100);
}

function closePinScreen(abort = true) {
  document.getElementById('pin-screen').classList.remove('open');
  if (abort) selectedLocation = null;
}

function confirmPinLocation() {
  if (!selectedLocation) return;
  closePinScreen(false);
  openDetailsOverlay();
}

function goBackToMap() {
  closeAddOverlay();
  const savedLoc = selectedLocation;
  openPinScreen(true);
  if (savedLoc) {
    setTimeout(() => {
      if (pinMap) pinMap.setView([savedLoc.lat, savedLoc.lng], 10, { animate: true });
      updatePinLocationBar(savedLoc);
    }, 250);
  }
}

// ── GPS ──────────────────────────────────────────────────────
async function getAccuratePosition({ samples = 3, sampleDelayMs = 600 } = {}) {
  if (!navigator.geolocation) throw new Error('GPS nicht verfügbar');
  const opts = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };
  function single() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy||9999 }),
        e => reject(e), opts);
    });
  }
  const results = [];
  for (let i = 0; i < samples; i++) {
    try {
      const r = await single(); results.push(r);
    } catch (e) { if (i === 0) throw e; }
    if (i < samples - 1) await new Promise(r => setTimeout(r, sampleDelayMs));
  }
  if (results.length === 1) return results[0];
  const best     = Math.min(...results.map(r => r.acc));
  const accepted = results.filter(r => r.acc <= best * 2);
  let wSum=0, latSum=0, lngSum=0;
  accepted.forEach(r => { const w=1/Math.max(r.acc,1); wSum+=w; latSum+=r.lat*w; lngSum+=r.lng*w; });
  return { lat: latSum/wSum, lng: lngSum/wSum, acc: Math.min(...accepted.map(r=>r.acc)) };
}

async function pinAtMyLocation() {
  if (!navigator.geolocation) { toast('GPS nicht verfügbar', 'error'); return; }
  const btn = document.getElementById('pin-locate-btn');
  btn.classList.add('locating'); btn.textContent = '⏳';
  toast('📍 Hochgenaue Position wird ermittelt…');
  try {
    const fix = await getAccuratePosition({ samples: 3, sampleDelayMs: 500 });
    await onGpsFix(fix.lat, fix.lng, fix.acc, btn);
  } catch (err) {
    btn.classList.remove('locating'); btn.textContent = '📍';
    const msgs = { 1:'GPS-Zugriff verweigert.', 2:'Standort nicht verfügbar', 3:'Zeitüberschreitung' };
    toast(msgs[err.code] || 'GPS-Fehler', 'error');
  }
}

async function onGpsFix(lat, lng, acc, btn) {
  let loc = await reverseGeocode(lat, lng);
  if (!loc) loc = buildFallbackLocation(lat, lng);
  loc.isLive = true; loc.lat = lat; loc.lng = lng; loc.accuracy = acc;

  const existingCountries = stickers.map(s => s.country_code || s.countryCode || s.cc);
  const pts = calcPoints(loc, !!photoData, existingCountries);
  selectedLocation = { ...loc, pts };

  suppressAutoLocate = true;
  if (pinMap) pinMap.setView([lat, lng], 16, { animate: true });

  document.getElementById('pin-loc-flag').textContent  = loc.f;
  const cityLine = loc.c && loc.c !== '–' ? `${loc.n}, ${loc.c}` : loc.n;
  document.getElementById('pin-loc-city').textContent  = cityLine;
  const accStr = acc ? ` · ±${Math.round(acc)}m` : '';
  document.getElementById('pin-loc-sub').textContent   =
    `${pts.km.toLocaleString('de')} km von Stahnsdorf · 📡 Live-GPS${accStr}`;
  document.getElementById('pin-pts-val').textContent   = pts.total;
  document.getElementById('pin-loc-pts').style.display = 'block';
  document.getElementById('pin-confirm-btn').disabled  = false;

  if (btn) { btn.classList.remove('locating'); btn.textContent = '📍'; }
  toast(`✅ Standort: ${loc.n}${acc ? ` (±${Math.round(acc)}m)` : ''}`, 'success');
  setTimeout(() => { suppressAutoLocate = false; }, 2000);
}

// ── Add-Overlay ───────────────────────────────────────────────
function openAddOverlay() {
  if (!currentUser) {
    toast('Zum Sticker-Setzen bitte anmelden', 'error');
    switchAuthTab('login');
    showAuthOverlay();
    return;
  }
  openPinScreen();
}

function closeAddOverlay() {
  document.getElementById('add-overlay').classList.remove('open');
  document.getElementById('overlay-dimmer').classList.remove('show');
}
