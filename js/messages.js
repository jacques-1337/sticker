// ═══════════════════════════════════════════════
//  MESSAGES — Chat zwischen Freunden
//  Benötigt: auth.js, friends.js, ui.js, supabaseClient.js
// ═══════════════════════════════════════════════

let activeChatFriend = null;
let chatPollTimer    = null;
let unreadCounts     = {};

function messageFriend(friendId, username) {
  if (!currentUser) { toast('🔒 Bitte einloggen', 'error'); return; }
  openChat(friendId, username);
}

function openChat(friendId, username) {
  activeChatFriend = { id: friendId, username };
  document.getElementById('chat-overlay').classList.add('open');
  document.getElementById('chat-username').textContent = username;
  document.getElementById('chat-avatar').textContent   = (username[0]||'?').toUpperCase();
  document.getElementById('chat-status').textContent   = 'wird geladen…';
  document.getElementById('chat-messages').innerHTML   = '<div class="chat-empty">Lade Nachrichten…</div>';
  document.getElementById('chat-input').value = '';
  document.getElementById('chat-input').focus();
  loadChatMessages(true);
  startChatPolling();
}

function closeChat() {
  document.getElementById('chat-overlay').classList.remove('open');
  activeChatFriend = null;
  stopChatPolling();
}

function startChatPolling() {
  stopChatPolling();
  chatPollTimer = setInterval(() => loadChatMessages(false), 5000);
}
function stopChatPolling() {
  if (chatPollTimer) { clearInterval(chatPollTimer); chatPollTimer = null; }
}

async function loadMessages(isInitial = true) {
  if (!activeChatFriend || !currentUser) return;
  const a = currentUser.id, b = activeChatFriend.id;
  try {
    const { data, error } = await db.from('messages')
      .select('id, from_user, to_user, text, created_at, read_at')
      .or(`and(from_user.eq.${a},to_user.eq.${b}),and(from_user.eq.${b},to_user.eq.${a})`)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) throw error;
    renderChatMessages(data || []);

    const unreadIds = (data||[]).filter(m => m.to_user===a && !m.read_at).map(m=>m.id);
    if (unreadIds.length) {
      await db.from('messages').update({ read_at: new Date().toISOString() }).in('id', unreadIds);
      unreadCounts[b] = 0;
      renderFriendsList();
      updateSocialBadgeFromState();
    }
    const status = $id('chat-status');
    if (status) status.textContent = `${(data||[]).length} Nachrichten`;
  } catch (e) {
    logInternal('msg/load', e);
    if (isInitial) {
      const missing = /does not exist|schema cache/.test(e.message||'');
      setHTML('chat-messages', `<div class="chat-empty" style="color:var(--red)">
        ⚠️ ${missing ? '<strong>messages-Tabelle fehlt</strong> – bitte SQL ausführen' : 'Nachrichten konnten nicht geladen werden'}
      </div>`);
    }
  }
}
const loadChatMessages = loadMessages;

function renderChatMessages(msgs) {
  const el = document.getElementById('chat-messages');
  if (!msgs.length) {
    el.innerHTML = `<div class="chat-empty">💬 Noch keine Nachrichten.<br>Schreibe die erste!</div>`;
    return;
  }
  let html = '', lastDate = '';
  msgs.forEach(m => {
    const isOut  = m.from_user === currentUser.id;
    const d      = new Date(m.created_at);
    const dateStr= d.toLocaleDateString('de');
    const timeStr= d.toLocaleTimeString('de', { hour:'2-digit', minute:'2-digit' });
    if (dateStr !== lastDate) {
      html += `<div style="text-align:center;color:var(--text2);font-size:11px;margin:8px 0">${dateStr}</div>`;
      lastDate = dateStr;
    }
    html += `<div class="chat-msg ${isOut?'out':'in'}">${escHtml(m.text)}</div>
             <div class="chat-meta ${isOut?'out-meta':''}">${timeStr}${isOut&&m.read_at?' ✓✓':isOut?' ✓':''}</div>`;
  });
  el.innerHTML = html;
  el.scrollTop = el.scrollHeight;
}

async function sendMessage() {
  const input = $id('chat-input');
  if (!input || !activeChatFriend || !currentUser) return;
  const text = input.value.trim();
  if (!text) return;
  const btn = $id('chat-send-btn');
  if (btn) btn.disabled = true;

  const tempId    = 'tmp-' + Date.now();
  const optimistic= { id:tempId, from_user:currentUser.id, to_user:activeChatFriend.id,
                       text, created_at:new Date().toISOString(), read_at:null, _pending:true };
  appendChatMessage(optimistic);
  input.value = '';

  try {
    const { data, error } = await db.from('messages')
      .insert({ from_user: currentUser.id, to_user: activeChatFriend.id, text })
      .select('id, from_user, to_user, text, created_at, read_at')
      .single();
    if (error) throw error;
    replaceOptimisticMessage(tempId, data);
  } catch (e) {
    logInternal('msg/send', e);
    removeOptimisticMessage(tempId);
    const missing = /does not exist|schema cache/.test(e.message||'');
    toast(missing ? '⚠️ messages-Tabelle fehlt – SQL ausführen' : 'Senden fehlgeschlagen', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}
const sendChatMessage = sendMessage;

// ── Realtime ─────────────────────────────────────────────────
let messageChannel = null;

function subscribeToMessages() {
  if (!currentUser || !db?.channel) return null;
  if (messageChannel) return messageChannel;
  messageChannel = db
    .channel(`messages:user:${currentUser.id}`)
    .on('postgres_changes',
      { event:'INSERT', schema:'public', table:'messages', filter:`to_user=eq.${currentUser.id}` },
      payload => handleIncomingMessage(payload.new))
    .on('postgres_changes',
      { event:'INSERT', schema:'public', table:'messages', filter:`from_user=eq.${currentUser.id}` },
      payload => handleOutgoingEcho(payload.new))
    .subscribe(status => { if (status === 'SUBSCRIBED') console.info('[msg] realtime aktiv'); });
  return messageChannel;
}

function ensureMessageSubscription() { if (!messageChannel) subscribeToMessages(); }

function unsubscribeFromMessages() {
  if (messageChannel && db?.removeChannel) { db.removeChannel(messageChannel); messageChannel = null; }
}

function handleIncomingMessage(m) {
  if (activeChatFriend && m.from_user === activeChatFriend.id) {
    appendChatMessage(m);
    db.from('messages').update({ read_at: new Date().toISOString() }).eq('id', m.id);
  } else {
    unreadCounts[m.from_user] = (unreadCounts[m.from_user]||0) + 1;
    if ($id('screen-social')?.classList.contains('active')) renderSocialConversations();
    updateSocialBadgeFromState();
    toast('💬 Neue Nachricht', 'info');
  }
}

function handleOutgoingEcho(m) {
  if (activeChatFriend && m.to_user === activeChatFriend.id &&
      !document.querySelector(`[data-msg-id="${m.id}"]`)) {
    appendChatMessage(m);
  }
}

function appendChatMessage(m) {
  const el = $id('chat-messages'); if (!el) return;
  const empty = el.querySelector('.chat-empty');
  if (empty) empty.remove();
  const isOut = m.from_user === currentUser.id;
  const t     = new Date(m.created_at).toLocaleTimeString('de', { hour:'2-digit', minute:'2-digit' });
  const wrap  = document.createElement('div');
  wrap.dataset.msgId = m.id;
  wrap.innerHTML =
    `<div class="chat-msg ${isOut?'out':'in'}${m._pending?' pending':''}">${escHtml(m.text)}</div>
     <div class="chat-meta ${isOut?'out-meta':''}">${t}${isOut&&m.read_at?' ✓✓':isOut?' ✓':''}</div>`;
  el.appendChild(wrap);
  el.scrollTop = el.scrollHeight;
}

function replaceOptimisticMessage(tempId, real) {
  const node = document.querySelector(`[data-msg-id="${tempId}"]`);
  if (!node) return;
  node.dataset.msgId = real.id;
  const bubble = node.querySelector('.chat-msg');
  if (bubble) bubble.classList.remove('pending');
}

function removeOptimisticMessage(tempId) {
  const node = document.querySelector(`[data-msg-id="${tempId}"]`);
  if (node) node.remove();
}

async function refreshUnreadCounts() {
  if (!currentUser || !useSupabase) return;
  try {
    const { data, error } = await db.from('messages')
      .select('from_user')
      .eq('to_user', currentUser.id)
      .is('read_at', null);
    if (error) throw error;
    unreadCounts = {};
    (data||[]).forEach(m => { unreadCounts[m.from_user] = (unreadCounts[m.from_user]||0)+1; });
  } catch(e) {
    unreadCounts = {};
  }
}
