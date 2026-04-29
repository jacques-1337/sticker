// ═══════════════════════════════════════════════
//  PROFILE — Avatar-Upload, Bio, Profil-Sektion
// ═══════════════════════════════════════════════

// ── Avatar Upload ─────────────────────────────
async function uploadAvatar(file) {
  if (!file || !useSupabase || !currentUser) return null;
  try {
    const ext      = file.name.split('.').pop().toLowerCase() || 'jpg';
    const filename = `avatar_${currentUser.id}.${ext}`;
    const { error } = await db.storage
      .from('avatars')
      .upload(filename, file, { contentType: file.type, upsert: true });
    if (error) throw error;
    const { data } = db.storage.from('avatars').getPublicUrl(filename);
    return data.publicUrl + '?t=' + Date.now(); // cache-bust
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
      const col = error.message?.includes('column') || error.message?.includes('does not exist');
      if (col) {
        toast('⚙️ SQL-Migration nötig — fix-challenge-grant.sql im Supabase-Dashboard ausführen', 'error');
      }
      throw error;
    }
    if (field === 'avatar_url') currentUser.avatar_url = value;
    if (field === 'bio')        currentUser.bio        = value;
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
  const bio       = currentUser.bio || '';
  const initial   = (currentUser.username || '?')[0].toUpperCase();

  el.innerHTML = `
    <!-- Avatar -->
    <div class="profile-avatar-wrap">
      <div class="profile-avatar" id="profile-avatar-display">
        ${avatarSrc
          ? `<img src="${escHtml(avatarSrc)}" onerror="this.style.display='none';this.nextSibling.style.display='flex'">`
          : ''}
        <span class="profile-avatar-fallback" style="${avatarSrc ? 'display:none' : ''}">${initial}</span>
      </div>
      <div class="profile-avatar-actions">
        <label class="profile-avatar-btn" for="avatar-file-input">📷 Foto ändern</label>
        <input type="file" id="avatar-file-input" accept="image/*" style="display:none"
               onchange="onAvatarFileSelected(event)">
        ${avatarSrc ? `<button class="profile-avatar-btn ghost" onclick="removeAvatar()">Entfernen</button>` : ''}
      </div>
    </div>

    <!-- Bio -->
    <div class="profile-bio-wrap">
      <label class="profile-bio-label">Über mich</label>
      <textarea id="profile-bio-input" class="profile-bio-input" maxlength="150"
                placeholder="Kurze Beschreibung (max. 150 Zeichen)…">${escHtml(bio)}</textarea>
      <div class="profile-bio-actions">
        <span class="profile-bio-count" id="bio-char-count">${bio.length}/150</span>
        <button class="ch-btn" onclick="saveBio()">Speichern</button>
      </div>
    </div>
  `;

  // Live char count
  const textarea = $id('profile-bio-input');
  if (textarea) {
    textarea.addEventListener('input', () => {
      const cnt = $id('bio-char-count');
      if (cnt) cnt.textContent = `${textarea.value.length}/150`;
    });
  }
}

async function onAvatarFileSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) { toast('Bild zu groß (max. 3 MB)', 'error'); return; }

  toast('Lade hoch…');
  const url = await uploadAvatar(file);
  if (!url) {
    // Fallback: base64 in DB (kein Storage)
    const reader = new FileReader();
    reader.onload = async (e) => {
      const b64 = e.target.result;
      const ok = await saveProfileField('avatar_url', b64);
      if (ok) { renderProfileSection(); toast('✅ Profilbild gespeichert', 'success'); }
      else    { toast('Fehler beim Speichern', 'error'); }
    };
    reader.readAsDataURL(file);
    return;
  }
  const ok = await saveProfileField('avatar_url', url);
  if (ok) { renderProfileSection(); toast('✅ Profilbild gespeichert', 'success'); }
  else    { toast('Fehler beim Speichern', 'error'); }
}

async function removeAvatar() {
  const ok = await saveProfileField('avatar_url', null);
  if (ok) { renderProfileSection(); toast('Profilbild entfernt'); }
}

async function saveBio() {
  const input = $id('profile-bio-input');
  if (!input) return;
  const ok = await saveProfileField('bio', input.value.trim());
  if (ok) toast('✅ Gespeichert', 'success');
  else    toast('Fehler beim Speichern', 'error');
}

// ── Avatar-HTML-Helper (für Freundeslisten etc.) ──────────────
function avatarHtml(user, size = 36) {
  if (!user) return `<div class="social-avatar" style="width:${size}px;height:${size}px">?</div>`;
  const initial = (user.username || '?')[0].toUpperCase();
  if (user.avatar_url) {
    return `<img src="${escHtml(user.avatar_url)}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0" onerror="this.outerHTML='<div class=\\'social-avatar\\'>${initial}</div>'">`;
  }
  return `<div class="social-avatar" style="width:${size}px;height:${size}px">${initial}</div>`;
}
