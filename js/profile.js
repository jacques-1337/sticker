// ═══════════════════════════════════════════════
//  PROFILE — Avatar-Upload, Bio, Profil-Sektion
// ═══════════════════════════════════════════════

// ── Avatar Upload ─────────────────────────────
async function uploadAvatar(file) {
  if (!file || !useSupabase || !currentUser) return null;
  try {
    const ext      = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const filename = `avatar_${currentUser.id}.${ext}`;
    const { error } = await db.storage
      .from('avatars')
      .upload(filename, file, { contentType: file.type, upsert: true });
    if (error) throw error;
    const { data } = db.storage.from('avatars').getPublicUrl(filename);
    return data.publicUrl + '?t=' + Date.now();
  } catch(e) {
    logInternal('profile/avatar', e);
    return null;
  }
}

async function saveProfileField(field, value) {
  if (!currentUser || !useSupabase) return false;
  try {
    const { error } = await db.from('users')
      .update({ [field]: value })
      .eq('id', currentUser.id);
    if (error) {
      if (error.message?.includes('column') || error.message?.includes('does not exist')) {
        toast('⚙️ SQL-Migration fehlt — fix-challenge-grant.sql im Supabase-Dashboard ausführen', 'error');
      }
      throw error;
    }
    if (field === 'avatar_url') {
      currentUser.avatar_url = value;
      if (value && typeof userAvatarCache !== 'undefined') userAvatarCache[currentUser.id] = value;
    }
    if (field === 'bio') currentUser.bio = value;
    return true;
  } catch(e) {
    logInternal('profile/save', e);
    return false;
  }
}

// ── Profil-Sektion rendern ────────────────────
function renderProfileSection() {
  const el = $id('profile-section-inner');
  if (!el || !currentUser) return;

  const avatarSrc = currentUser.avatar_url || '';
  const bio       = escHtml(currentUser.bio || '');
  const initial   = (currentUser.username || '?')[0].toUpperCase();

  el.innerHTML = `
    <div class="profile-card">

      <!-- Avatar -->
      <div class="pf-avatar-row">
        <div class="pf-avatar" id="pf-avatar-display">
          ${avatarSrc
            ? `<img src="${avatarSrc}" class="pf-avatar-img" onerror="this.style.display='none';document.getElementById('pf-avatar-fallback').style.display='flex'">`
            : ''}
          <span class="pf-avatar-fallback" id="pf-avatar-fallback"
                style="${avatarSrc ? 'display:none' : ''}">${initial}</span>
        </div>
        <div class="pf-avatar-info">
          <div class="pf-username">${escHtml(currentUser.username)}</div>
          <label class="pf-upload-btn" for="avatar-file-input">
            <span>📷</span> Foto ändern
          </label>
          <input type="file" id="avatar-file-input" accept="image/*"
                 style="display:none" onchange="onAvatarFileSelected(event)">
          ${avatarSrc
            ? `<button class="pf-remove-btn" onclick="removeAvatar()">Entfernen</button>`
            : ''}
        </div>
      </div>

      <!-- Vorschau nach Auswahl -->
      <div class="pf-preview-wrap" id="pf-preview-wrap" style="display:none">
        <img id="pf-preview-img" class="pf-preview-img" src="" alt="Vorschau">
        <div class="pf-preview-actions">
          <button class="pf-save-avatar-btn" onclick="confirmAvatarUpload()">✓ Hochladen</button>
          <button class="pf-cancel-btn" onclick="cancelAvatarPreview()">Abbrechen</button>
        </div>
      </div>

      <!-- Bio -->
      <div class="pf-bio-section">
        <label class="pf-label">Über mich <span class="pf-bio-count" id="bio-char-count">${(currentUser.bio||'').length}/150</span></label>
        <textarea id="profile-bio-input" class="pf-bio-input" maxlength="150"
                  placeholder="Kurze Beschreibung…">${bio}</textarea>
        <button class="pf-save-bio-btn" onclick="saveBio()">Speichern</button>
      </div>
    </div>
  `;

  const ta = $id('profile-bio-input');
  if (ta) ta.addEventListener('input', () => {
    const c = $id('bio-char-count');
    if (c) c.textContent = `${ta.value.length}/150`;
  });
}

// ── Datei-Auswahl: Vorschau anzeigen ─────────
let _pendingAvatarFile = null;

function onAvatarFileSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 4 * 1024 * 1024) { toast('Bild zu groß (max. 4 MB)', 'error'); return; }
  _pendingAvatarFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    const wrap = $id('pf-preview-wrap');
    const img  = $id('pf-preview-img');
    if (!wrap || !img) return;
    img.src = e.target.result;
    wrap.style.display = '';
  };
  reader.readAsDataURL(file);
}

async function confirmAvatarUpload() {
  if (!_pendingAvatarFile) return;
  const btn = document.querySelector('.pf-save-avatar-btn');
  if (btn) { btn.textContent = '⏳ Lädt…'; btn.disabled = true; }

  let url = await uploadAvatar(_pendingAvatarFile);

  if (!url) {
    // Fallback: base64 direkt in DB
    const reader = new FileReader();
    url = await new Promise(res => {
      reader.onload = e => res(e.target.result);
      reader.readAsDataURL(_pendingAvatarFile);
    });
  }

  const ok = await saveProfileField('avatar_url', url);
  _pendingAvatarFile = null;

  if (ok) {
    renderProfileSection();
    renderMarkers?.();
    toast('✅ Profilbild gespeichert', 'success');
  } else {
    toast('Fehler beim Speichern', 'error');
    if (btn) { btn.textContent = '✓ Hochladen'; btn.disabled = false; }
  }
}

function cancelAvatarPreview() {
  _pendingAvatarFile = null;
  const wrap = $id('pf-preview-wrap');
  if (wrap) wrap.style.display = 'none';
  const inp = $id('avatar-file-input');
  if (inp) inp.value = '';
}

async function removeAvatar() {
  const ok = await saveProfileField('avatar_url', null);
  if (ok) { renderProfileSection(); renderMarkers?.(); toast('Profilbild entfernt'); }
}

async function saveBio() {
  const input = $id('profile-bio-input');
  if (!input) return;
  const btn = document.querySelector('.pf-save-bio-btn');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  const ok = await saveProfileField('bio', input.value.trim());
  if (btn) { btn.disabled = false; btn.textContent = 'Speichern'; }
  if (ok) toast('✅ Gespeichert', 'success');
  else    toast('Fehler beim Speichern', 'error');
}

// ── Avatar-HTML-Helper ────────────────────────
function avatarHtml(user, size = 36) {
  if (!user) return `<div class="social-avatar" style="width:${size}px;height:${size}px">?</div>`;
  const initial = (user.username || '?')[0].toUpperCase();
  const url     = user.avatar_url || (typeof userAvatarCache !== 'undefined' ? userAvatarCache[user.id] : null);
  if (url) {
    return `<img src="${url}" class="user-avatar-img" style="width:${size}px;height:${size}px" `
         + `onerror="this.outerHTML='<div class=\\'social-avatar\\'>${initial}</div>'">`;
  }
  return `<div class="social-avatar" style="width:${size}px;height:${size}px">${initial}</div>`;
}
