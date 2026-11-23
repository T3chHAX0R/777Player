'use strict';

/* =========================================================
 *  777Player 雲端同步（GitHub Gist，不需要自己的伺服器）
 *
 *  - 資料分 4 個檔案存在一個 secret gist，各自有時間戳，誰新用誰
 *  - 新裝置第一次連結時，我的最愛／歌單會「合併」而不是覆蓋
 *  - 正在播放的裝置擁有播放進度，不會被別台的同步打斷
 *  - API Key、登入 Token、GitHub Token 都不會上傳
 * ========================================================= */

const SYNC_SECTIONS = {
  favorites: ['favorites'],
  playlists: ['playlists'],
  playback: ['queue', 'index', 'lastTime', 'mode'],
  settings: ['level', 'source'],
};
// 同步名稱：家人共用同一個 GitHub Token 時，用不同名稱分開存（各自一個 gist）
const cleanProfile = p => String(p || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20);
const syncProfile = () => cleanProfile(store.get('syncProfile', ''));
const SYNC_FILE = sec => { const p = syncProfile(); return p ? `777player-${p}-${sec}.json` : `777player-${sec}.json`; };
const SYNC_DESC = '777Player sync data (auto-generated)';
const GH_API = localStorage.getItem('777p:syncApiBase') || 'https://api.github.com'; // 前者僅供測試用

const keyToSection = {};
for (const [sec, keys] of Object.entries(SYNC_SECTIONS)) for (const k of keys) keyToSection[k] = sec;

const sync = {
  token: store.get('ghToken', ''),
  meta: Object.assign({ gistId: '', linked: false, t: {}, dirty: {} }, store.get('syncMeta', {})),
  applying: false,
  running: null,
  again: false,
  timer: null,
  lastPull: 0,
  status: '',
  lastOk: 0,
};
const saveMeta = () => localStorage.setItem('777p:syncMeta', JSON.stringify(sync.meta));

/* ---------- 偵測本機變動 ---------- */
store.onChange = key => {
  const sec = keyToSection[key];
  if (!sec || sync.applying) return;
  sync.meta.t[sec] = Date.now();
  sync.meta.dirty[sec] = true;
  saveMeta();
  // 播放進度每 3 秒就存一次，不必每次都上傳；暫停、換歌、離開頁面時才推
  if (key !== 'lastTime') scheduleSync(3000);
};

function scheduleSync(delay = 3000) {
  if (!sync.token) return;
  clearTimeout(sync.timer);
  sync.timer = setTimeout(() => syncNow(), delay);
}

/* ---------- GitHub API ---------- */
async function gh(path, opts = {}) {
  const res = await fetch(GH_API + path, {
    cache: 'no-store',
    ...opts,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + sync.token,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (res.status === 401) throw new Error('GitHub Token 無效或已過期');
  if (res.status === 403 || res.status === 404) {
    const j = await res.json().catch(() => ({}));
    if (res.status === 404 && path.startsWith('/gists/')) { const e = new Error('找不到同步用的 gist'); e.gone = true; throw e; }
    throw new Error(`GitHub 拒絕存取（${res.status}）：${j.message || '請確認 Token 有 gist 權限'}`);
  }
  if (!res.ok) throw new Error(`GitHub 錯誤（${res.status}）`);
  return res.status === 204 ? null : res.json();
}

async function findOrCreateGist() {
  if (sync.meta.gistId) return sync.meta.gistId;
  // 另一台裝置可能已經建立過：找有 777player 檔案的 gist
  for (let page = 1; page <= 5; page++) {
    const list = await gh(`/gists?per_page=100&page=${page}`);
    const hit = list.find(g => g.files && g.files[SYNC_FILE('favorites')]);
    if (hit) { sync.meta.gistId = hit.id; saveMeta(); return hit.id; }
    if (list.length < 100) break;
  }
  return null; // 交給 syncNow 建立
}

async function readRemote(gistId) {
  const g = await gh(`/gists/${gistId}`);
  const out = {};
  for (const sec of Object.keys(SYNC_SECTIONS)) {
    const f = g.files[SYNC_FILE(sec)];
    if (!f) continue;
    let text = f.content;
    if (f.truncated && f.raw_url) text = await (await fetch(f.raw_url, { cache: 'no-store' })).text();
    try { out[sec] = JSON.parse(text); } catch { /* 壞掉的檔案就當作沒有 */ }
  }
  return out;
}

/* ---------- 合併與套用 ---------- */
const isPlayingHere = () => !!audio.getAttribute('src') && !audio.paused;

function sectionData(sec) {
  return Object.fromEntries(SYNC_SECTIONS[sec].map(k => [k, store.get(k, null)]));
}

function unionById(local = [], remote = []) {
  const seen = new Set(remote.map(x => String(x.id)));
  return [...remote, ...local.filter(x => !seen.has(String(x.id)))];
}

function applySection(sec, data) {
  sync.applying = true;
  try {
    for (const [k, v] of Object.entries(data || {})) if (v !== null && v !== undefined) store.set(k, v);
  } finally {
    sync.applying = false;
  }
  if (sec === 'favorites') state.favorites = store.get('favorites', []);
  if (sec === 'playlists') state.playlists = store.get('playlists', []);
  if (sec === 'settings') {
    state.level = store.get('level', state.level);
    state.source = store.get('source', state.source);
  }
  if (sec === 'playback') {
    const before = current();
    state.queue = store.get('queue', []);
    state.index = Math.min(store.get('index', -1), state.queue.length - 1);
    state.lastTime = store.get('lastTime', 0);
    state.mode = store.get('mode', state.mode);
    const now = current();
    if (audio.getAttribute('src')) {
      if (before && now && before.id === now.id) audio.currentTime = state.lastTime;
      else stopAudio();
    }
    updateNowPlaying();
    renderModeBtn();
    const d = (now && now.duration / 1000) || audio.duration || 0;
    $('#curTime').textContent = fmt(state.lastTime);
    if (d) { const pct = Math.min(100, (state.lastTime / d) * 100); seekEl.value = pct * 10; setFill(seekEl, pct); }
  }
}

async function syncNow({ silent = true } = {}) {
  if (!sync.token) return;
  if (sync.running) { sync.again = true; return sync.running; }
  sync.running = (async () => {
    setSyncStatus('syncing');
    try {
      let gistId = await findOrCreateGist();
      let remote = {};
      if (gistId) {
        try { remote = await readRemote(gistId); }
        catch (e) {
          if (!e.gone) throw e;
          sync.meta.gistId = ''; gistId = null; // gist 被刪了，重建
        }
      }
      const firstLink = !sync.meta.linked;
      const push = {};
      const changed = [];

      for (const sec of Object.keys(SYNC_SECTIONS)) {
        const r = remote[sec];
        const lt = sync.meta.t[sec] || 0;
        const local = sectionData(sec);

        if (!r) { push[sec] = true; continue; }

        // 新裝置第一次連結：清單類資料合併，其餘以雲端為準
        if (firstLink && (sec === 'favorites' || sec === 'playlists')) {
          const merged = { [sec]: unionById(local[sec] || [], r.data[sec] || []) };
          applySection(sec, merged);
          changed.push(sec);
          if (merged[sec].length !== (r.data[sec] || []).length) push[sec] = true;
          else sync.meta.t[sec] = r.t;
          continue;
        }
        if (firstLink && !(sec === 'playback' && isPlayingHere())) {
          applySection(sec, r.data);
          sync.meta.t[sec] = r.t;
          delete sync.meta.dirty[sec];
          changed.push(sec);
          continue;
        }

        if (r.t > lt) {
          // 正在播的裝置優先：蓋掉雲端，並把時間戳更新成現在，避免兩台互相覆蓋
          if (sec === 'playback' && isPlayingHere()) { sync.meta.t[sec] = Date.now(); push[sec] = true; continue; }
          applySection(sec, r.data);
          sync.meta.t[sec] = r.t;
          delete sync.meta.dirty[sec];
          changed.push(sec);
        } else if (r.t < lt || sync.meta.dirty[sec]) {
          push[sec] = true;
        }
      }

      const toPush = Object.keys(push);
      if (toPush.length) {
        const now = Date.now();
        const files = {};
        for (const sec of toPush) {
          // 從沒改過的區塊、或第一次連結時合併過的清單，用現在時間當版本
          const merged = firstLink && (sec === 'favorites' || sec === 'playlists');
          if (!sync.meta.t[sec] || merged) sync.meta.t[sec] = now;
          files[SYNC_FILE(sec)] = { content: JSON.stringify({ t: sync.meta.t[sec], data: sectionData(sec) }) };
        }
        if (gistId) {
          await gh(`/gists/${gistId}`, { method: 'PATCH', body: JSON.stringify({ files }) });
        } else {
          // 第一次：建立 gist（四個檔案都要有）
          for (const sec of Object.keys(SYNC_SECTIONS)) {
            if (!files[SYNC_FILE(sec)]) files[SYNC_FILE(sec)] = { content: JSON.stringify({ t: sync.meta.t[sec] || now, data: sectionData(sec) }) };
          }
          const g = await gh('/gists', { method: 'POST', body: JSON.stringify({ description: SYNC_DESC, public: false, files }) });
          sync.meta.gistId = g.id;
        }
        for (const sec of toPush) delete sync.meta.dirty[sec];
      }

      sync.meta.linked = true;
      saveMeta();
      sync.lastPull = Date.now();
      sync.lastOk = Date.now();
      setSyncStatus('ok');
      if (changed.length) {
        renderSidebar();
        renderView();
        if (!silent) toast('已從雲端同步：' + changed.map(s => ({ favorites: '我的最愛', playlists: '歌單', playback: '播放進度', settings: '設定' }[s])).join('、'));
      }
      return { changed, pushed: toPush };
    } catch (e) {
      console.warn('[同步]', e);
      setSyncStatus('error', e.message);
      if (!silent) toast('同步失敗：' + e.message);
      throw e;
    } finally {
      sync.running = null;
      if (sync.again) { sync.again = false; scheduleSync(500); }
    }
  })();
  return sync.running.catch(() => {});
}

// 離開頁面／切到背景時，把有變動的小檔案用 keepalive 送出（避免請求被瀏覽器中斷）
function flushOnHide() {
  if (!sync.token || !sync.meta.gistId) return;
  const dirty = Object.keys(sync.meta.dirty).filter(s => sync.meta.dirty[s]);
  if (!dirty.length) return;
  const files = {};
  for (const sec of dirty) files[SYNC_FILE(sec)] = { content: JSON.stringify({ t: sync.meta.t[sec], data: sectionData(sec) }) };
  const body = JSON.stringify({ files });
  fetch(`${GH_API}/gists/${sync.meta.gistId}`, {
    method: 'PATCH',
    keepalive: body.length < 60000,
    headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + sync.token, 'Content-Type': 'application/json' },
    body,
  }).then(r => { if (r.ok) { for (const s of dirty) delete sync.meta.dirty[s]; saveMeta(); } }).catch(() => {});
}

/* ---------- 狀態顯示 ---------- */
function setSyncStatus(kind, msg = '') {
  sync.status = kind;
  const el = $('#syncStatus');
  if (!el) return;
  const hm = d => new Date(d).toTimeString().slice(0, 5);
  el.dataset.kind = kind;
  el.textContent = !sync.token ? '' :
    kind === 'syncing' ? '☁ 同步中…' :
    kind === 'error' ? '☁ 同步失敗' :
    kind === 'ok' ? `☁ 已同步 ${hm(sync.lastOk)}` : '☁ 已連結';
  if (sync.token && syncProfile()) el.textContent += `（${syncProfile()}）`;
  el.title = kind === 'error' ? msg : '點一下立即同步';
  const s = $('#syncHint');
  if (s) s.textContent = !sync.token
    ? '選填。在 GitHub 建立只勾 gist 權限的 Token，每台裝置貼一次就會自動同步我的最愛、歌單、播放進度。'
    : kind === 'error' ? `⚠ ${msg}` : `✓ 已連結${sync.meta.gistId ? `（gist ${sync.meta.gistId.slice(0, 7)}…）` : ''}${sync.lastOk ? `，上次同步 ${hm(sync.lastOk)}` : ''}`;
}

/* ---------- 事件 ---------- */
audio.addEventListener('pause', () => scheduleSync(2000));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) flushOnHide();
  else if (Date.now() - sync.lastPull > 10_000) syncNow();
});
window.addEventListener('pagehide', flushOnHide);
setInterval(() => { if (!document.hidden) syncNow(); }, 2 * 60_000);

$('#syncStatus').addEventListener('click', () => syncNow({ silent: false }).then(() => {
  if (sync.status === 'ok') toast('同步完成');
}));

// 設定對話框：GitHub Token 欄位
const settingsDlgEl = $('#settingsDlg');
$('#settingsBtn').addEventListener('click', () => {
  $('#setGhToken').value = sync.token;
  $('#setProfile').value = syncProfile();
  setSyncStatus(sync.status);
});
settingsDlgEl.addEventListener('close', () => {
  if (settingsDlgEl.returnValue !== 'ok') return;
  const t = $('#setGhToken').value.trim();
  const p = cleanProfile($('#setProfile').value);
  if (t === sync.token && p === syncProfile()) return;
  sync.token = t;
  store.set('ghToken', t);
  store.set('syncProfile', p);
  // 換帳號或移除 Token：重置連結狀態，下次連結時重新合併
  sync.meta = { gistId: '', linked: false, t: sync.meta.t, dirty: {} };
  saveMeta();
  setSyncStatus('');
  if (t) syncNow({ silent: false }).then(() => { if (sync.status === 'ok') toast('雲端同步已開啟'); });
});
$('#syncNowBtn').addEventListener('click', () => syncNow({ silent: false }).then(() => {
  if (sync.status === 'ok') toast('同步完成');
}));

$('#setGhToken').value = sync.token;
$('#setProfile').value = syncProfile();
setSyncStatus(sync.token ? 'idle' : '');
if (sync.token) syncNow({ silent: false });
