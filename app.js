'use strict';

/* =========================================================
 *  777Player — 網易雲音樂網頁播放器（純前端）
 * ========================================================= */

const API_BASE = 'https://api.chksz.com/api/';
const DAILY_LIMIT = 400;
const LEVELS = [
  ['standard', '標準'],
  ['exhigh', '極高 320k（推薦）'],
  ['lossless', '無損 FLAC'],
  ['hires', 'Hi-Res'],
  ['jymaster', '超清母帶'],
  ['sky', '沉浸環繞聲'],
  ['jyeffect', '高清環繞聲'],
];
const LEVEL_TAG = { standard: '標準', exhigh: 'HQ', lossless: 'SQ', hires: 'Hi-Res', jymaster: '母帶', sky: '環繞', jyeffect: '環繞' };
const MODES = { loop: '列表循環', one: '單曲循環', shuffle: '隨機播放' };
const MODE_ICON = { loop: 'repeat', one: 'repeat1', shuffle: 'shuffle' };

/* ---------- 小工具 ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = sec => {
  if (!isFinite(sec) || sec < 0) sec = 0;
  return Math.floor(sec / 60) + ':' + String(Math.floor(sec % 60)).padStart(2, '0');
};
const img = (url, size) => url ? url.replace(/^http:/, 'https:') + (url.includes('?') ? '&' : '?') + `param=${size}y${size}` : '';
const bg = (url, size) => url ? `background-image:url('${esc(img(url, size))}')` : '';

const ICONS = {
  play: '<path class="f" d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/>',
  pause: '<rect class="f" x="6" y="4.5" width="4" height="15" rx="1.2"/><rect class="f" x="14" y="4.5" width="4" height="15" rx="1.2"/>',
  prev: '<rect class="f" x="5" y="5" width="2.4" height="14" rx="1"/><path class="f" d="M19 6.2v11.6a1 1 0 0 1-1.55.83L9.3 13.2a1.4 1.4 0 0 1 0-2.4l8.15-5.43A1 1 0 0 1 19 6.2z"/>',
  next: '<rect class="f" x="16.6" y="5" width="2.4" height="14" rx="1"/><path class="f" d="M5 6.2v11.6a1 1 0 0 0 1.55.83l8.15-5.43a1.4 1.4 0 0 0 0-2.4L6.55 5.37A1 1 0 0 0 5 6.2z"/>',
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  repeat1: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/><path d="M11 10.5l1.5-1v5" stroke-width="1.8"/>',
  shuffle: '<path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  heartFill: '<path class="f" d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" stroke-width="3"/>',
  volume: '<path class="f" d="M11 5L6 9H2.5v6H6l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9.5 9.5 0 0 1 0 13"/>',
  mute: '<path class="f" d="M11 5L6 9H2.5v6H6l5 4z"/><path d="M22 9l-6 6M16 9l6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  refresh: '<path d="M23 4v6h-6"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/>',
  lyric: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  home: '<path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
};
const ic = name => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
const eqBars = '<span class="eq-bars"><i></i><i></i><i></i></span>';

/* ---------- 本機儲存 ---------- */
const store = {
  get(k, d) {
    try { const v = localStorage.getItem('777p:' + k); return v == null ? d : JSON.parse(v); } catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem('777p:' + k, JSON.stringify(v)); } catch (e) { console.warn('儲存失敗', e); }
    if (store.onChange) store.onChange(k);
  },
  onChange: null, // sync.js 會掛上來，用來偵測要同步的變動
};

/* ---------- 家人設定連結（網址 #setup=...，不會送到任何伺服器） ---------- */
const SITE_URL = 'https://t3chhax0r.github.io/777Player/';
const b64urlEncode = obj => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlDecode = s => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))));
// 套用設定連結的內容；成功回傳 true（呼叫端負責重新整理頁面）
function applySetupString(text) {
  const m = String(text || '').match(/#setup=([A-Za-z0-9_-]+)/);
  if (!m) { alert('這不是 777Player 的設定連結'); return false; }
  let cfg;
  try { cfg = b64urlDecode(m[1]); } catch { alert('這個設定連結格式不正確'); return false; }
  const items = [cfg.k && 'chksz API Key', cfg.g && `雲端同步（${cfg.p || '預設'}）`].filter(Boolean);
  if (!items.length) return false;
  if (!confirm(`要套用這個設定連結嗎？\n\n會設定：${items.join('、')}`)) return false;
  if (cfg.k) store.set('apiKey', cfg.k);
  if (cfg.g) {
    store.set('ghToken', cfg.g);
    store.set('syncProfile', cfg.p || '');
    localStorage.removeItem('777p:syncMeta'); // 視為第一次連結，與雲端合併
  }
  sessionStorage.setItem('777p:setupDone', '1');
  return true;
}
(function applySetupLinkFromUrl() {
  if (!/^#setup=/.test(location.hash)) return;
  const hash = location.hash;
  // 先把設定從網址列清掉，避免被截圖或留在瀏覽紀錄
  window.history.replaceState(null, '', location.pathname);
  applySetupString(hash);
})();

const state = {
  apiKey: store.get('apiKey', '') || (window.APP_CONFIG && window.APP_CONFIG.apiKey) || '',
  authToken: store.get('authToken', '') || (window.APP_CONFIG && window.APP_CONFIG.authToken) || '',
  tokenBad: false,
  level: store.get('level', 'exhigh'),
  source: store.get('source', 'auto'),
  volume: store.get('volume', 0.8),
  mode: store.get('mode', 'loop'),
  queue: store.get('queue', []),
  index: store.get('index', -1),
  lastTime: store.get('lastTime', 0),
  favorites: store.get('favorites', []),
  playlists: store.get('playlists', []),
  view: 'home',
  search: { keyword: '', songs: [], total: 0, loading: false, error: '' },
};
if (state.index >= state.queue.length) state.index = state.queue.length ? 0 : -1;

function persistQueue() {
  store.set('queue', state.queue);
  store.set('index', state.index);
}

/* ---------- 提示訊息 ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* =========================================================
 *  API 與額度
 * ========================================================= */
// 額度在北京時間 (UTC+8) 午夜重置，日期格式與官方一致：2026-11-23
const todayKey = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

// 本機計數：每次呼叫 +1；有登入 Token 時會被官方數字校正
function quotaInfo() {
  const q = store.get('quota', {});
  const fresh = q.date === todayKey();
  return {
    used: fresh ? q.count || 0 : 0,
    limit: (fresh && q.limit) || DAILY_LIMIT,
    official: fresh && !!q.official,
  };
}
const quotaUsed = () => quotaInfo().used;
function bumpQuota() {
  const q = quotaInfo();
  store.set('quota', { date: todayKey(), count: q.used + 1, limit: q.limit, official: false });
  renderQuota();
  scheduleUsageRefresh();
}
function renderQuota() {
  const { used, limit, official } = quotaInfo();
  const left = Math.max(0, limit - used);
  const el = $('#quota');
  el.textContent = `今日剩餘 ${left} / ${limit}${official ? '' : '（估算）'}`;
  const tk = tokenInfo();
  el.title = (official ? '官方即時用量' : '本機估算的用量') +
    (tk.exp ? `\n登入 Token 有效至 ${tk.expText}（剩 ${tk.daysLeft} 天）` : '\n在設定填入登入 Token 可顯示官方用量');
  el.classList.toggle('warn', used >= limit * 0.75 && used < limit * 0.9);
  el.classList.toggle('danger', used >= limit * 0.9);
}

/* ----- 官方用量（需網站登入 Token，查詢不消耗額度） ----- */
function tokenInfo(token = state.authToken) {
  if (!token) return {};
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(decodeURIComponent(escape(atob(b64))));
    if (!payload.exp) return { valid: true };
    const exp = payload.exp * 1000;
    const d = new Date(exp);
    return {
      exp,
      valid: exp > Date.now(),
      daysLeft: Math.max(0, Math.ceil((exp - Date.now()) / 86400_000)),
      expText: `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`,
    };
  } catch {
    return { valid: true }; // 不是 JWT 格式就直接試試看
  }
}

let usageTimer;
function scheduleUsageRefresh(delay = 1500) {
  clearTimeout(usageTimer);
  usageTimer = setTimeout(refreshUsage, delay);
}
async function refreshUsage() {
  if (!state.authToken || state.tokenBad || !tokenInfo().valid) return;
  try {
    const res = await fetch(API_BASE + 'auth/usage', { headers: { Authorization: 'Bearer ' + state.authToken } });
    const j = await res.json();
    if (j.code === 401) {
      state.tokenBad = true;
      toast('登入 Token 已失效，請到設定更新（目前改用本機估算）');
      renderQuota();
      return;
    }
    if (j.code !== 200 || !j.data) return;
    const d = j.data;
    store.set('quota', {
      date: d.date || todayKey(),
      count: d.freeUsed ?? (d.freeLimit - d.freeRemaining),
      limit: d.freeLimit || DAILY_LIMIT,
      official: true,
    });
    renderQuota();
    if (state.view === 'home') renderView();
  } catch { /* 網路問題就沿用本機估算 */ }
}
function warnTokenExpiry() {
  const tk = tokenInfo();
  if (!tk.exp) return;
  if (!tk.valid) toast('登入 Token 已過期，請到設定更新（目前改用本機估算）');
  else if (tk.daysLeft <= 3) toast(`登入 Token 將在 ${tk.daysLeft} 天後過期（${tk.expText}），記得更新`);
}

async function api(name, params) {
  if (!state.apiKey) {
    openSettings();
    throw new Error('請先在設定中填入 API Key');
  }
  const url = new URL(API_BASE + name);
  for (const [k, v] of Object.entries({ ...params, apikey: state.apiKey })) url.searchParams.set(k, v);
  bumpQuota();
  let res, json;
  try {
    res = await fetch(url);
  } catch {
    throw new Error('網路錯誤，無法連線到 API');
  }
  try {
    json = await res.json();
  } catch {
    throw new Error(`API 回傳格式錯誤（HTTP ${res.status}）`);
  }
  if (json.code !== 200) throw new Error(json.msg || `API 錯誤（${json.code}）`);
  return json.data;
}

/* ----- bugpk：免費無限次，但伺服器會快取 2 小時，可能回傳已過期的網址 ----- */
const BUGPK_URL = 'https://api.bugpk.com/api/163_music';
async function bugpk(params, timeout = 20000) {
  const url = new URL(BUGPK_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    const j = await res.json();
    const code = j.code ?? j.status;
    if (code !== 200) throw new Error(j.msg || `bugpk 錯誤（${code}）`);
    return j;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`bugpk 超過 ${timeout / 1000} 秒沒回應`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// 來源策略：auto = 先問 bugpk，超過 headStart 毫秒還沒回應（或失敗）才同時問 chksz，誰先成功用誰
const useBugpk = () => state.source !== 'chksz';
const canFallbackToChksz = () => state.source === 'auto' && !!state.apiKey;
async function withFallback(label, bugFn, chkFn, headStart = 3000) {
  if (!useBugpk()) return chkFn();
  if (!canFallbackToChksz()) return bugFn();
  const bug = bugFn();
  let timer;
  const waited = new Promise(r => { timer = setTimeout(r, headStart); });
  const first = await Promise.race([bug.then(v => ({ v }), e => ({ e })), waited.then(() => null)]);
  clearTimeout(timer);
  if (first && !first.e) return first.v;
  if (first) {
    console.warn(`[bugpk] ${label}失敗，改用 chksz：${first.e.message}`);
    return chkFn();
  }
  console.warn(`[bugpk] ${label}超過 ${headStart / 1000} 秒，同時改問 chksz`);
  return Promise.any([bug, chkFn()]).catch(agg => { throw agg.errors[1] || agg.errors[0]; });
}

/* ----- 歌曲網址（有效期約 25 分鐘，期間內重複使用不耗額度） ----- */
const urlCache = new Map();
function urlTime(url) {
  // 網址內含北京時間的到期時間，例如 /20261123001838/
  const m = /\/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\//.exec(url || '');
  return m ? Date.UTC(+m[1], m[2] - 1, +m[3], m[4] - 8, +m[5], +m[6]) : null;
}
function urlExpiry(url) {
  const t = urlTime(url);
  return t && t > Date.now() ? t - 60_000 : Date.now() + 10 * 60_000;
}
function checkPlayableUrl(url) {
  if (!url) throw new Error('沒有播放連結');
  if (/\/song\/media\/outer\/url/.test(url)) throw new Error('只拿到外鏈佔位網址（多半無版權）');
  const t = urlTime(url);
  if (t && t < Date.now() + 2 * 60_000) throw new Error('拿到的是已過期的快取網址');
}
const LEVEL_ZH = [['超清母带', 'jymaster'], ['沉浸', 'sky'], ['环绕', 'jyeffect'], ['Hi-Res', 'hires'], ['无损', 'lossless'], ['极高', 'exhigh'], ['标准', 'standard']];
const levelFromZh = s => (LEVEL_ZH.find(([k]) => String(s || '').includes(k)) || [])[1] || state.level;

async function bugpkSong(song) {
  const j = await bugpk({ ids: song.id, level: state.level, type: 'json' });
  checkPlayableUrl(j.url);
  if (!song.pic && j.pic) song.pic = j.pic;
  // 回應已附歌詞，順便存起來，之後開歌詞不用再呼叫
  if (typeof j.lyric === 'string' && !lyricMem.has(song.id)) saveLyric(song.id, buildLyric(j.lyric, j.tlyric));
  return { url: j.url, level: levelFromZh(j.level), source: 'bugpk' };
}

// 在目前歌曲最後 2 分鐘，用免費的 bugpk 預先解析下一首（不消耗 chksz 額度）
let prefetchedKey = null;
function maybePrefetch() {
  if (!useBugpk() || state.mode === 'one' || !audio.duration) return;
  if (audio.duration - audio.currentTime > 120) return;
  const i = peekNextIndex();
  if (i < 0 || i === state.index) return;
  const song = state.queue[i];
  const key = song.id + '|' + state.level;
  if (prefetchedKey === key) return;
  prefetchedKey = key;
  const hit = urlCache.get(key);
  if (hit && hit.exp > Date.now() + 5 * 60_000) return;
  bugpkSong(song)
    .then(info => { info.exp = urlExpiry(info.url); urlCache.set(key, info); })
    .catch(e => console.warn(`[預載] ${song.name}：${e.message}`));
}

async function getSongUrl(song, force = false) {
  const key = song.id + '|' + state.level;
  const hit = urlCache.get(key);
  if (!force && hit && hit.exp > Date.now()) return hit;
  const info = await withFallback('解析',
    async () => {
      // 重試時 bugpk 只會回同一個快取網址，直接改用 chksz
      if (force && canFallbackToChksz()) throw new Error('重試');
      return bugpkSong(song);
    },
    async () => {
      const d = await api('163_music', { id: song.id, level: state.level });
      if (!d || !d.url) throw new Error(`「${song.name}」無法播放（可能無版權）`);
      if (!song.pic && d.picUrl) song.pic = d.picUrl;
      return { url: d.url, level: d.level || state.level, source: 'chksz' };
    });
  info.exp = urlExpiry(info.url);
  urlCache.set(key, info);
  return info;
}

/* ----- 歌詞（永久快取在本機） ----- */
const lyricMem = new Map();
function parseLrc(text) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('{')) {
      // 網易雲部分作詞作曲資訊是 JSON 格式：{"t":0,"c":[{"tx":"作词: "},{"tx":"xxx"}]}
      try {
        const j = JSON.parse(line);
        const txt = (j.c || []).map(c => c.tx).join('').trim();
        if (txt) out.push({ t: (j.t || 0) / 1000, text: txt });
      } catch { /* 忽略 */ }
      continue;
    }
    const tags = [...line.matchAll(/\[(\d+):(\d+(?:[.:]\d+)?)\]/g)];
    if (!tags.length) continue;
    const content = line.replace(/\[[^\]]*\]/g, '').trim();
    if (!content) continue;
    for (const t of tags) out.push({ t: +t[1] * 60 + parseFloat(t[2].replace(':', '.')), text: content });
  }
  return out.sort((a, b) => a.t - b.t);
}
function buildLyric(lrc, tlrc) {
  const main = parseLrc(lrc);
  const trMap = new Map(parseLrc(tlrc).map(l => [Math.round(l.t * 10), l.text]));
  for (const l of main) {
    const tr = trMap.get(Math.round(l.t * 10));
    if (tr && tr !== l.text) l.tr = tr;
  }
  return main;
}
async function getLyric(id) {
  if (lyricMem.has(id)) return lyricMem.get(id);
  const cached = store.get('lrc:' + id, null);
  if (cached) { lyricMem.set(id, cached); return cached; }
  const lines = await withFallback('歌詞',
    async () => { const j = await bugpk({ id, type: 'lyric' }); return buildLyric(j.data?.lrc, j.data?.tlyric); },
    async () => { const d = await api('163_lyric', { id }); return buildLyric(d.lrc, d.tlyric); },
    6000);
  saveLyric(id, lines);
  return lines;
}
function saveLyric(id, lines) {
  lyricMem.set(id, lines);
  try {
    localStorage.setItem('777p:lrc:' + id, JSON.stringify(lines));
  } catch {
    // 空間滿了：清掉一半舊歌詞再試
    const keys = Object.keys(localStorage).filter(k => k.startsWith('777p:lrc:'));
    keys.slice(0, Math.ceil(keys.length / 2)).forEach(k => localStorage.removeItem(k));
    try { localStorage.setItem('777p:lrc:' + id, JSON.stringify(lines)); } catch { /* 放棄 */ }
  }
  return lines;
}

/* ---------- 資料格式統一 ---------- */
const joinArtists = a => Array.isArray(a) ? a.map(x => x.name || x).join(' / ') : (a || '');
const normSearch = s => ({
  id: s.id, name: s.name, artist: joinArtists(s.artists), album: s.album?.name ?? s.album ?? '',
  pic: s.picUrl || '', duration: s.duration || 0,
});
const normTrack = t => ({
  id: t.id, name: t.name, artist: joinArtists(t.ar), album: t.al?.name || '',
  pic: t.al?.picUrl || '', duration: t.dt || 0,
});
const cloneSong = s => ({ id: s.id, name: s.name, artist: s.artist, album: s.album, pic: s.pic, duration: s.duration });

/* =========================================================
 *  播放器核心
 * ========================================================= */
// 在 Android App 裡改用原生播放器（native.js），一般瀏覽器用 <audio>
const audio = window.NativeAudio || $('#audio');
let playToken = 0;
let failStreak = 0;
let errRetryFor = null;
let playHistory = [];

const current = () => state.queue[state.index];
const isCurrent = s => !!s && !!current() && current().id === s.id;

async function playAt(i, { startAt = 0, fromHistory = false, auto = false, force = false } = {}) {
  if (i < 0 || i >= state.queue.length) return;
  if (!auto) failStreak = 0;
  if (!fromHistory && state.index >= 0 && state.index !== i && current()) {
    playHistory.push(current().id);
    if (playHistory.length > 200) playHistory.shift();
  }
  const changed = state.index !== i;
  state.index = i;
  state.lastTime = startAt;
  persistQueue();
  store.set('lastTime', startAt);

  const song = current();
  const token = ++playToken;
  if (changed) errRetryFor = null;
  updateNowPlaying();
  markPlaying();
  setLoading(true);
  if (npOpen) ensureLyrics();

  try {
    const info = await getSongUrl(song, force);
    if (token !== playToken) return;
    audio.src = info.url;
    renderLevelTag(info);
    if (startAt > 0) audio.currentTime = startAt;
    await audio.play();
  } catch (e) {
    if (token !== playToken) return;
    if (e.name === 'AbortError') return;
    setLoading(false);
    if (e.name === 'NotAllowedError') { setPlayingUI(false); return; }
    // 音源載入失敗（多半是網址過期或格式不支援）交給 audio 的 error 事件處理
    if (e.name === 'NotSupportedError') return;
    toast(e.message);
    failStreak++;
    // 自動跳下一首，但連續失敗 3 次就停，避免浪費額度
    if (failStreak < 3 && state.queue.length > 1) {
      setTimeout(() => { if (token === playToken) next(true); }, 1500);
    }
  }
}

function togglePlay() {
  if (!current()) {
    toast('播放佇列是空的，先搜尋或選一個歌單吧');
    return;
  }
  if (!audio.getAttribute('src')) {
    playAt(state.index, { startAt: state.lastTime, fromHistory: true });
    return;
  }
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
}

// 隨機模式先決定好下一首，才能預先解析
let shuffleNext = -1;
function peekNextIndex() {
  const n = state.queue.length;
  if (!n) return -1;
  if (state.mode === 'shuffle' && n > 1) {
    if (shuffleNext < 0 || shuffleNext >= n || shuffleNext === state.index) {
      do { shuffleNext = Math.floor(Math.random() * n); } while (shuffleNext === state.index);
    }
    return shuffleNext;
  }
  return (state.index + 1) % n;
}

function next(auto = false) {
  const i = peekNextIndex();
  if (i < 0) return;
  shuffleNext = -1;
  playAt(i, { auto });
}

function prev() {
  const n = state.queue.length;
  if (!n) return;
  if (audio.currentTime > 5) { audio.currentTime = 0; return; }
  if (state.mode === 'shuffle') {
    while (playHistory.length) {
      const i = state.queue.findIndex(s => s.id === playHistory.pop());
      if (i >= 0) return playAt(i, { fromHistory: true });
    }
  }
  playAt((state.index - 1 + n) % n, { fromHistory: true });
}

function stopAudio() {
  playToken++;
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  setLoading(false);
  setPlayingUI(false);
  $('#levelTag').textContent = '';
}

/* ----- 佇列操作 ----- */
function playList(songs, i) {
  if (!songs.length) return;
  state.queue = songs.map(cloneSong);
  state.index = -1;
  playHistory = [];
  playAt(i);
  renderSidebar();
}
function insertNextAndPlay(song) {
  let i = state.queue.findIndex(s => s.id === song.id);
  if (i < 0) {
    i = state.index + 1;
    state.queue.splice(i, 0, cloneSong(song));
  }
  playAt(i);
  renderSidebar();
}
function addToQueue(song) {
  if (state.queue.some(s => s.id === song.id)) { toast('已經在播放佇列中'); return; }
  state.queue.push(cloneSong(song));
  if (state.index < 0) { state.index = 0; state.lastTime = 0; store.set('lastTime', 0); }
  persistQueue();
  renderSidebar();
  if (state.queue.length === 1) updateNowPlaying();
  toast(`已加入佇列：${song.name}`);
}
function removeFromQueue(i) {
  const wasCurrent = i === state.index;
  state.queue.splice(i, 1);
  if (i < state.index) state.index--;
  if (wasCurrent) {
    stopAudio();
    state.index = state.queue.length ? Math.min(i, state.queue.length - 1) : -1;
    state.lastTime = 0;
    store.set('lastTime', 0);
    updateNowPlaying();
    resetProgress();
  }
  persistQueue();
  renderSidebar();
  renderView();
}
function clearQueue() {
  stopAudio();
  state.queue = [];
  state.index = -1;
  state.lastTime = 0;
  store.set('lastTime', 0);
  playHistory = [];
  persistQueue();
  updateNowPlaying();
  resetProgress();
  renderSidebar();
  renderView();
}

/* ----- 我的最愛 ----- */
const isFav = s => !!s && state.favorites.some(f => f.id === s.id);
function toggleFav(song) {
  if (!song) return;
  const i = state.favorites.findIndex(f => f.id === song.id);
  if (i >= 0) {
    state.favorites.splice(i, 1);
    toast('已從我的最愛移除');
  } else {
    state.favorites.unshift(cloneSong(song));
    toast('已加入我的最愛');
  }
  store.set('favorites', state.favorites);
  renderSidebar();
  renderView();
  renderFavBtn();
}

/* =========================================================
 *  播放列 UI
 * ========================================================= */
const seekEl = $('#seek');
const volEl = $('#volume');
let seeking = false;
let lastSave = 0;

const setFill = (el, pct) => el.style.setProperty('--p', pct + '%');

function renderLevelTag(info) {
  const el = $('#levelTag');
  el.textContent = LEVEL_TAG[info.level] || '';
  el.dataset.src = info.source;
  el.title = info.source === 'chksz' ? '來源：chksz（消耗 1 次額度）' : '來源：bugpk（免費）';
}
function setLoading(on) { $('#playBtn').classList.toggle('loading', on); }
function setPlayingUI(playing) {
  $('#playBtn').innerHTML = ic(playing ? 'pause' : 'play');
  document.body.classList.toggle('is-playing', playing);
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
}
function resetProgress() {
  seekEl.value = 0;
  setFill(seekEl, 0);
  $('#curTime').textContent = '0:00';
  $('#durTime').textContent = '0:00';
}
function renderFavBtn() {
  const b = $('#pFav');
  const fav = isFav(current());
  b.innerHTML = ic(fav ? 'heartFill' : 'heart');
  b.classList.toggle('on', fav);
}
function renderModeBtn() {
  const b = $('#modeBtn');
  b.innerHTML = ic(MODE_ICON[state.mode]);
  b.title = MODES[state.mode];
  b.classList.toggle('on', state.mode !== 'loop');
}
function renderVolume() {
  const v = audio.muted ? 0 : audio.volume * 100;
  volEl.value = v;
  setFill(volEl, v);
  $('#muteBtn').innerHTML = ic(audio.muted || audio.volume === 0 ? 'mute' : 'volume');
}

function updateNowPlaying() {
  const s = current();
  const cover = $('#pCover');
  $('#pTitle').textContent = s ? s.name : '尚未播放';
  $('#pArtist').textContent = s ? s.artist : '搜尋或匯入歌單開始聽歌';
  cover.style.cssText = s && s.pic ? bg(s.pic, 120) : '';
  cover.classList.toggle('has-img', !!(s && s.pic));
  $('#npCover').style.cssText = s && s.pic ? bg(s.pic, 600) : '';
  $('#npBg').style.cssText = s && s.pic ? bg(s.pic, 200) : '';
  $('#npTitle').textContent = s ? s.name : '';
  $('#npArtist').textContent = s ? [s.artist, s.album].filter(Boolean).join(' — ') : '';
  document.title = s ? `${s.name} - ${s.artist} | 777Player` : '777Player';
  if (s && s.duration && !audio.duration) $('#durTime').textContent = fmt(s.duration / 1000);
  renderFavBtn();

  if ('mediaSession' in navigator && s && window.MediaMetadata) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: s.name, artist: s.artist, album: s.album,
      artwork: s.pic ? [{ src: img(s.pic, 512), sizes: '512x512', type: 'image/jpeg' }] : [],
    });
  }
}

/* ----- audio 事件 ----- */
audio.addEventListener('play', () => setPlayingUI(true));
audio.addEventListener('pause', () => { setPlayingUI(false); store.set('lastTime', audio.currentTime); });
audio.addEventListener('playing', () => { setLoading(false); errRetryFor = null; failStreak = 0; });
audio.addEventListener('waiting', () => setLoading(true));
audio.addEventListener('canplay', () => setLoading(false));
audio.addEventListener('loadedmetadata', () => { $('#durTime').textContent = fmt(audio.duration); });
audio.addEventListener('timeupdate', () => {
  const d = audio.duration || 0;
  const t = audio.currentTime;
  if (!seeking && d) {
    const pct = (t / d) * 100;
    seekEl.value = Math.round(pct * 10);
    setFill(seekEl, pct);
    $('#curTime').textContent = fmt(t);
  }
  state.lastTime = t;
  if (Date.now() - lastSave > 3000) { lastSave = Date.now(); store.set('lastTime', t); }
  syncLyrics();
  maybePrefetch();
});
audio.addEventListener('ended', () => {
  if (state.mode === 'one') { audio.currentTime = 0; audio.play().catch(() => {}); }
  else next(true);
});
audio.addEventListener('error', () => {
  const s = current();
  if (!s || !audio.getAttribute('src')) return;
  // 多半是網址過期：重新解析一次並從原位置接著播（每首只重試一次，避免浪費額度）
  if (errRetryFor !== s.id) {
    errRetryFor = s.id;
    playAt(state.index, { startAt: audio.currentTime || state.lastTime, fromHistory: true, force: true, auto: true });
  } else {
    setLoading(false);
    setPlayingUI(false);
    const unsupported = audio.error && audio.error.code === 4;
    toast(unsupported ? '瀏覽器無法播放此音訊，請在設定改用「極高 320k」' : '播放失敗，請稍後再試');
  }
});

/* ----- 控制項 ----- */
$('#playBtn').addEventListener('click', togglePlay);
$('#nextBtn').addEventListener('click', () => next());
$('#prevBtn').addEventListener('click', prev);
$('#modeBtn').addEventListener('click', () => {
  const order = ['loop', 'one', 'shuffle'];
  state.mode = order[(order.indexOf(state.mode) + 1) % order.length];
  store.set('mode', state.mode);
  renderModeBtn();
  toast(MODES[state.mode]);
});
$('#pFav').addEventListener('click', () => toggleFav(current()));
$('#queueBtn').addEventListener('click', () => { closeNp(); showView('queue'); });
$('#lyricBtn').addEventListener('click', toggleNp);
$('#pCover').addEventListener('click', toggleNp);
$('#pMeta').addEventListener('click', toggleNp);

seekEl.addEventListener('input', () => {
  seeking = true;
  const d = audio.duration || 0;
  setFill(seekEl, seekEl.value / 10);
  $('#curTime').textContent = fmt((seekEl.value / 1000) * d);
});
seekEl.addEventListener('change', () => {
  if (audio.duration) audio.currentTime = (seekEl.value / 1000) * audio.duration;
  seeking = false;
});

volEl.addEventListener('input', () => {
  audio.volume = volEl.value / 100;
  audio.muted = false;
  store.set('volume', audio.volume);
  renderVolume();
});
$('#muteBtn').addEventListener('click', () => { audio.muted = !audio.muted; renderVolume(); });

function seekBy(sec) {
  if (!audio.duration) return;
  audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + sec));
}

document.addEventListener('keydown', e => {
  if (e.target.matches('input:not([type=range]), textarea, select') || $('dialog[open]')) return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); e.ctrlKey ? next() : seekBy(5); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); e.ctrlKey ? prev() : seekBy(-5); }
  else if (e.key === 'ArrowUp' && e.ctrlKey) { e.preventDefault(); audio.volume = Math.min(1, audio.volume + 0.05); store.set('volume', audio.volume); renderVolume(); }
  else if (e.key === 'ArrowDown' && e.ctrlKey) { e.preventDefault(); audio.volume = Math.max(0, audio.volume - 0.05); store.set('volume', audio.volume); renderVolume(); }
  else if (e.key === 'Escape' && npOpen) closeNp();
  else if (e.key === '/') { e.preventDefault(); closeNp(); $('#searchInput').focus(); }
  else if (e.key.toLowerCase() === 'l' && !e.ctrlKey && !e.metaKey && !e.altKey) toggleNp();
});

if ('mediaSession' in navigator) {
  const ms = navigator.mediaSession;
  const set = (a, fn) => { try { ms.setActionHandler(a, fn); } catch { /* 不支援 */ } };
  // 耳機／通知列的「播放」「暫停」要明確對應，不能用切換（狀態沒對上時會反過來）
  set('play', () => {
    if (!audio.getAttribute('src')) togglePlay(); // 還沒載入音訊（例如剛打開網頁）就先解析
    else audio.play().catch(() => {});
  });
  set('pause', () => audio.pause());
  set('stop', () => audio.pause());
  set('previoustrack', prev);
  set('nexttrack', () => next());
  set('seekbackward', d => seekBy(-(d.seekOffset || 10)));
  set('seekforward', d => seekBy(d.seekOffset || 10));
  set('seekto', d => {
    if (!audio.duration) return;
    if (d.fastSeek && 'fastSeek' in audio) audio.fastSeek(d.seekTime);
    else audio.currentTime = d.seekTime;
    updatePositionState();
  });

  // 把進度回報給系統，通知列／鎖屏才會有可拖動的進度條
  ['loadedmetadata', 'playing', 'pause', 'seeked', 'ratechange'].forEach(ev => audio.addEventListener(ev, updatePositionState));
}
function updatePositionState() {
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
  const d = audio.duration;
  if (!isFinite(d) || d <= 0) return;
  try {
    navigator.mediaSession.setPositionState({ duration: d, playbackRate: audio.playbackRate || 1, position: Math.min(audio.currentTime, d) });
  } catch { /* 不支援 */ }
}

window.addEventListener('pagehide', () => store.set('lastTime', state.lastTime));

/* =========================================================
 *  正在播放 / 歌詞
 * ========================================================= */
let npOpen = false;
let lyric = { id: null, lines: null, msg: '' };
let activeLine = -1;
let userScrollUntil = 0;
const lrcBox = $('#npLyrics');

function openNp() {
  if (!current()) { toast('還沒有正在播放的歌曲'); return; }
  npOpen = true;
  $('#np').classList.add('open');
  $('#np').setAttribute('aria-hidden', 'false');
  $('#lyricBtn').classList.add('on');
  ensureLyrics();
  requestAnimationFrame(() => syncLyrics(true));
}
function closeNp() {
  npOpen = false;
  $('#np').classList.remove('open');
  $('#np').setAttribute('aria-hidden', 'true');
  $('#lyricBtn').classList.remove('on');
}
function toggleNp() { if (npOpen) closeNp(); else openNp(); }
$('#npClose').addEventListener('click', closeNp);

// 只在打開歌詞畫面時才載入歌詞，節省 API 額度
function ensureLyrics() {
  const s = current();
  if (!s || lyric.id === s.id) return;
  lyric = { id: s.id, lines: null, msg: '載入歌詞中…' };
  renderLyrics();
  getLyric(s.id)
    .then(lines => { if (lyric.id === s.id) { lyric.lines = lines; renderLyrics(); } })
    .catch(e => {
      if (lyric.id !== s.id) return;
      lyric = { id: null, lines: null, msg: e.message };
      renderLyrics(true);
    });
}
function renderLyrics(withRetry = false) {
  activeLine = -1;
  if (!lyric.lines) {
    lrcBox.innerHTML = `<div class="lrc-msg">${esc(lyric.msg)}${withRetry ? '<button class="btn ghost" data-lrc-retry>重試</button>' : ''}</div>`;
    return;
  }
  if (!lyric.lines.length) {
    lrcBox.innerHTML = '<div class="lrc-msg">純音樂，請欣賞</div>';
    return;
  }
  lrcBox.innerHTML = '<div class="lrc-pad"></div>' + lyric.lines.map((l, i) =>
    `<p class="lrc-line" data-i="${i}">${esc(l.text)}${l.tr ? `<span class="tr">${esc(l.tr)}</span>` : ''}</p>`
  ).join('') + '<div class="lrc-pad"></div>';
  syncLyrics(true);
}
function syncLyrics(force = false) {
  const lines = lyric.lines;
  if (!npOpen || !lines || !lines.length || !current() || lyric.id !== current().id) return;
  const t = audio.currentTime + 0.25;
  let i = -1;
  for (let k = 0; k < lines.length; k++) { if (lines[k].t <= t) i = k; else break; }
  if (i === activeLine && !force) return;
  const els = lrcBox.querySelectorAll('.lrc-line');
  if (els[activeLine]) els[activeLine].classList.remove('active');
  activeLine = i;
  const el = els[Math.max(i, 0)];
  if (i >= 0 && el) el.classList.add('active');
  if (el && Date.now() > userScrollUntil) {
    lrcBox.scrollTo({
      top: el.offsetTop - lrcBox.clientHeight / 2 + el.offsetHeight / 2,
      behavior: force ? 'auto' : 'smooth',
    });
  }
}
lrcBox.addEventListener('click', e => {
  if (e.target.closest('[data-lrc-retry]')) { ensureLyrics(); return; }
  const p = e.target.closest('.lrc-line');
  if (!p || !lyric.lines) return;
  const t = lyric.lines[+p.dataset.i].t;
  if (audio.getAttribute('src')) {
    audio.currentTime = t;
    if (audio.paused) audio.play().catch(() => {});
  }
  userScrollUntil = 0;
});
['wheel', 'touchmove'].forEach(ev =>
  lrcBox.addEventListener(ev, () => { userScrollUntil = Date.now() + 3000; }, { passive: true }));

/* =========================================================
 *  搜尋 / 歌單
 * ========================================================= */
let searchToken = 0;
async function doSearch(keyword, more = false) {
  const s = state.search;
  keyword = keyword.trim();
  if (!keyword) return;
  if (!more) {
    if (keyword === s.keyword && s.songs.length) { showView('search'); return; }
    Object.assign(s, { keyword, songs: [], total: 0, error: '' });
  }
  const token = ++searchToken;
  s.loading = true;
  if (more) renderView(); else showView('search');
  try {
    const params = { limit: 50, offset: s.songs.length };
    const d = await withFallback('搜尋',
      async () => {
        const d = (await bugpk({ type: 'search', s: keyword, ...params })).data;
        // bugpk 偶爾會回「成功」但 0 筆，當作失敗交給 chksz 確認
        if (!d || !d.songs || (!d.songs.length && !params.offset)) throw new Error('bugpk 搜尋回傳 0 筆');
        return d;
      },
      () => api('163_search', { keyword, ...params }));
    if (token !== searchToken) return;
    const seen = new Set(s.songs.map(x => x.id));
    s.songs.push(...(d.songs || []).map(normSearch).filter(x => !seen.has(x.id)));
    s.total = d.total || s.songs.length;
  } catch (e) {
    if (token !== searchToken) return;
    s.error = e.message;
    toast(e.message);
  } finally {
    if (token === searchToken) {
      s.loading = false;
      if (state.view === 'search') renderView();
    }
  }
}
$('#searchForm').addEventListener('submit', e => {
  e.preventDefault();
  $('#searchInput').blur();
  closeNp();
  doSearch($('#searchInput').value);
});

function parsePlaylistId(input) {
  input = String(input || '').trim();
  if (/^\d+$/.test(input)) return input;
  const m = input.match(/playlist\/(\d+)/) || input.match(/[?&]id=(\d+)/);
  return m ? m[1] : null;
}
async function importPlaylist(id, silent = false) {
  if (!silent) toast(useBugpk() ? '正在匯入歌單…（bugpk 較慢，請稍候）' : '正在匯入歌單…');
  const d = await withFallback('歌單',
    async () => {
      const d = (await bugpk({ type: 'playlist', id }, 30000)).data;
      if (!d || !d.tracks || !d.tracks.length) throw new Error('bugpk 歌單回傳 0 首');
      return d;
    },
    () => api('163_playlist', { id }),
    15000);
  const pl = {
    id: String(d.id || id),
    name: d.name || '未命名歌單',
    cover: d.coverImgUrl || '',
    creator: typeof d.creator === 'string' ? d.creator : d.creator?.nickname || '',
    trackCount: d.trackCount || (d.tracks || []).length,
    tracks: (d.tracks || []).map(t => (t.ar ? normTrack(t) : normSearch(t))),
    updated: Date.now(),
  };
  const i = state.playlists.findIndex(p => p.id === pl.id);
  if (i >= 0) state.playlists[i] = pl; else state.playlists.push(pl);
  store.set('playlists', state.playlists);
  renderSidebar();
  return pl;
}
function deletePlaylist(id) {
  const pl = state.playlists.find(p => p.id === id);
  if (!pl || !confirm(`確定要移除歌單「${pl.name}」嗎？`)) return;
  state.playlists = state.playlists.filter(p => p.id !== id);
  store.set('playlists', state.playlists);
  renderSidebar();
  showView('home');
}

/* =========================================================
 *  畫面渲染
 * ========================================================= */
const main = $('#main');
let viewSongs = [];
let viewCtx = '';

function showView(v) {
  const changed = state.view !== v;
  state.view = v;
  renderView();
  renderSidebar();
  if (changed) main.scrollTop = 0;
}

function songRows(songs, ctx) {
  viewSongs = songs;
  viewCtx = ctx;
  return '<div class="songs">' + songs.map((s, i) => {
    const fav = isFav(s);
    const playing = ctx === 'queue' ? i === state.index : isCurrent(s);
    return `<div class="row${playing ? ' playing' : ''}" data-i="${i}">
      <div class="c-idx"><span class="num">${i + 1}</span><span class="eq">${eqBars}</span></div>
      <div class="c-cover" style="${bg(s.pic, 88)}"></div>
      <div class="c-title"><div class="t" title="${esc(s.name)}">${esc(s.name)}</div><div class="a">${esc(s.artist)}</div></div>
      <div class="c-album" title="${esc(s.album)}">${esc(s.album)}</div>
      <div class="c-dur">${s.duration ? fmt(s.duration / 1000) : ''}</div>
      <div class="c-act">
        <button class="icon-btn${fav ? ' on' : ''}" data-act="fav" title="${fav ? '取消最愛' : '加入最愛'}">${ic(fav ? 'heartFill' : 'heart')}</button>
        ${ctx === 'queue'
          ? `<button class="icon-btn" data-act="remove" title="從佇列移除">${ic('x')}</button>`
          : `<button class="icon-btn" data-act="add" title="加入播放佇列">${ic('plus')}</button>`}
      </div>
    </div>`;
  }).join('') + '</div>';
}

function head({ kicker, title, sub, cover, actions = '' }) {
  return `<div class="view-head">
    ${cover !== undefined ? `<div class="view-cover" style="${bg(cover, 300)}"></div>` : ''}
    <div class="view-info">
      <div class="view-kicker">${esc(kicker)}</div>
      <div class="view-title">${esc(title)}</div>
      ${sub ? `<div class="view-sub">${sub}</div>` : ''}
      ${actions ? `<div class="view-actions">${actions}</div>` : ''}
    </div>
  </div>`;
}
const playAllBtn = `<button class="btn primary" data-act="playall">${ic('play')}播放全部</button>`;

function renderView() {
  const v = state.view;
  viewSongs = [];
  viewCtx = '';

  if (v === 'search') {
    const s = state.search;
    let html = head({
      kicker: '搜尋結果',
      title: s.keyword ? `「${s.keyword}」` : '搜尋',
      sub: s.songs.length ? `共 ${s.total} 首，已顯示 ${s.songs.length} 首　·　點一下歌曲即播放` : '',
      actions: s.songs.length ? playAllBtn : '',
    });
    if (s.songs.length) html += songRows(s.songs, 'search');
    if (s.loading) html += '<div class="spinner"></div>';
    else if (!s.keyword) html += '<div class="empty">在左上角輸入關鍵字搜尋</div>';
    else if (!s.songs.length) html += `<div class="empty">${esc(s.error || '找不到相關歌曲')}</div>`;
    else if (s.songs.length < s.total) html += `<div class="load-more"><button class="btn ghost" data-act="more">載入更多（消耗 1 次額度）</button></div>`;
    main.innerHTML = html;
    return;
  }

  if (v === 'favorites') {
    const f = state.favorites;
    main.innerHTML = head({
      kicker: '收藏', title: '我的最愛', sub: `${f.length} 首歌曲`,
      actions: f.length ? playAllBtn : '',
    }) + (f.length ? songRows(f, 'favorites') : '<div class="empty">還沒有收藏的歌曲<br>點歌曲旁的愛心即可加入</div>');
    return;
  }

  if (v === 'queue') {
    const q = state.queue;
    main.innerHTML = head({
      kicker: '播放佇列', title: '接下來播放',
      sub: `${q.length} 首歌曲　·　${MODES[state.mode]}`,
      actions: q.length ? `<button class="btn ghost" data-act="clear-queue">${ic('trash')}清空佇列</button>` : '',
    }) + (q.length ? songRows(q, 'queue') : '<div class="empty">佇列是空的</div>');
    return;
  }

  if (v.startsWith('pl:')) {
    const pl = state.playlists.find(p => 'pl:' + p.id === v);
    if (!pl) { state.view = 'home'; renderView(); return; }
    const partial = pl.trackCount > pl.tracks.length ? `（歌單共 ${pl.trackCount} 首，API 回傳 ${pl.tracks.length} 首）` : '';
    main.innerHTML = head({
      kicker: '歌單', title: pl.name, cover: pl.cover,
      sub: `${esc(pl.creator)}${pl.creator ? '　·　' : ''}${pl.tracks.length} 首${partial}`,
      actions: (pl.tracks.length ? playAllBtn : '') +
        `<button class="btn ghost" data-act="refresh-pl" title="重新抓取歌單（消耗 1 次額度）">${ic('refresh')}重新整理</button>` +
        `<button class="btn ghost" data-act="delete-pl">${ic('trash')}移除</button>`,
    }) + (pl.tracks.length ? songRows(pl.tracks, 'playlist') : '<div class="empty">這個歌單沒有歌曲</div>');
    return;
  }

  // 首頁
  const qi = quotaInfo();
  const left = Math.max(0, qi.limit - qi.used);
  let html = `<div class="hero">
    <h1>今天想聽什麼？</h1>
    <p>今日 API 額度剩${qi.official ? '' : '約'} <b>${left}</b> 次，約可再播放 <b>${Math.floor(left / 2)}～${left}</b> 首新歌（開歌詞每首多 1 次，聽過的歌詞不再消耗）。</p>
  </div>`;
  if (state.playlists.length) {
    html += '<div class="h2">我的歌單</div><div class="cards" style="margin-bottom:36px">' +
      state.playlists.map(p => `<div class="card" data-pl="${esc(p.id)}">
        <div class="cv" style="${bg(p.cover, 300)}"></div>
        <div class="nm">${esc(p.name)}</div><div class="ds">${p.tracks.length} 首</div></div>`).join('') +
      `<div class="card" data-act="import"><div class="cv" style="display:flex;align-items:center;justify-content:center;color:var(--dim)">${ic('plus')}</div><div class="nm">匯入歌單</div><div class="ds">貼上歌單 ID 或連結</div></div>` +
      '</div>';
  }
  html += `<div class="h2">使用說明</div><div class="tips">
    <div class="tip"><b>搜尋</b>按 <kbd>/</kbd> 聚焦搜尋框，點歌曲立即播放；按 ＋ 加到佇列尾端。</div>
    <div class="tip"><b>匯入歌單</b>左側「我的歌單」旁的 ＋，貼上網易雲歌單 ID 或分享連結。</div>
    <div class="tip"><b>快捷鍵</b><kbd>空白</kbd> 播放/暫停　<kbd>←</kbd><kbd>→</kbd> 快退/快進 5 秒<br><kbd>Ctrl</kbd>+<kbd>←</kbd><kbd>→</kbd> 上/下一首　<kbd>L</kbd> 歌詞</div>
    <div class="tip"><b>省額度</b>預設優先用免費的 bugpk，失敗才用 chksz 額度（播放列音質標籤變藍色）。解析過的歌 25 分鐘內重播不消耗。</div>
  </div>`;
  if (!state.playlists.length) {
    html += `<div class="h2">開始</div><div class="view-actions"><button class="btn primary" data-act="import">${ic('plus')}匯入第一個歌單</button></div>`;
  }
  main.innerHTML = html;
}

function markPlaying() {
  $$('.row', main).forEach(r => {
    const i = +r.dataset.i;
    const on = viewCtx === 'queue' ? i === state.index : isCurrent(viewSongs[i]);
    r.classList.toggle('playing', on);
  });
}

main.addEventListener('click', async e => {
  const card = e.target.closest('[data-pl]');
  if (card) { showView('pl:' + card.dataset.pl); return; }

  const btn = e.target.closest('[data-act]');
  const row = e.target.closest('.row');
  if (btn) {
    const i = row ? +row.dataset.i : -1;
    const song = viewSongs[i];
    switch (btn.dataset.act) {
      case 'fav': toggleFav(song); break;
      case 'add': addToQueue(song); break;
      case 'remove': removeFromQueue(i); break;
      case 'playall': playList(viewSongs, 0); break;
      case 'more': doSearch(state.search.keyword, true); break;
      case 'clear-queue': if (confirm('確定清空播放佇列？')) clearQueue(); break;
      case 'import': openImport(); break;
      case 'delete-pl': deletePlaylist(state.view.slice(3)); break;
      case 'refresh-pl': {
        btn.disabled = true;
        try { await importPlaylist(state.view.slice(3)); renderView(); toast('歌單已更新'); }
        catch (err) { toast(err.message); btn.disabled = false; }
        break;
      }
    }
    return;
  }
  if (row) {
    const i = +row.dataset.i;
    if (viewCtx === 'search') insertNextAndPlay(viewSongs[i]);
    else if (viewCtx === 'queue') playAt(i);
    else playList(viewSongs, i);
  }
});

function renderSidebar() {
  $$('#nav .nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
  $('#favCount').textContent = state.favorites.length || '';
  $('#queueCount').textContent = state.queue.length || '';
  const nav = $('#playlistNav');
  nav.innerHTML = state.playlists.length
    ? state.playlists.map(p => `<button class="pl-item${state.view === 'pl:' + p.id ? ' active' : ''}" data-pl="${esc(p.id)}" title="${esc(p.name)}">
        <span class="thumb" style="${bg(p.cover, 80)}"></span><span class="name">${esc(p.name)}</span></button>`).join('')
    : '<div class="pl-empty">按上方 ＋ 匯入網易雲歌單</div>';
}
$('#nav').addEventListener('click', e => {
  const b = e.target.closest('[data-view]');
  if (b) { closeNp(); showView(b.dataset.view); }
});
$('#playlistNav').addEventListener('click', e => {
  const b = e.target.closest('[data-pl]');
  if (b) { closeNp(); showView('pl:' + b.dataset.pl); }
});

/* =========================================================
 *  對話框
 * ========================================================= */
const settingsDlg = $('#settingsDlg');
const importDlg = $('#importDlg');

function openSettings() {
  if (settingsDlg.open) return;
  $('#setKey').value = state.apiKey;
  $('#setToken').value = state.authToken;
  renderTokenHint();
  $('#setSource').value = state.source;
  $('#setLevel').innerHTML = LEVELS.map(([v, n]) => `<option value="${v}"${v === state.level ? ' selected' : ''}>${n}</option>`).join('');
  const lrcCount = Object.keys(localStorage).filter(k => k.startsWith('777p:lrc:')).length;
  const qi = quotaInfo();
  $('#setQuota').textContent = `今日已用 ${qi.used} / ${qi.limit} 次（${qi.official ? '官方數據' : '本機估算'}）。已快取 ${lrcCount} 首歌詞。`;
  settingsDlg.returnValue = '';
  settingsDlg.showModal();
}
settingsDlg.addEventListener('close', () => {
  if (settingsDlg.returnValue !== 'ok') return;
  state.apiKey = $('#setKey').value.trim();
  store.set('apiKey', state.apiKey);
  const token = $('#setToken').value.trim().replace(/^Bearer\s+/i, '');
  if (token !== state.authToken) {
    state.authToken = token;
    state.tokenBad = false;
    store.set('authToken', token);
    if (token) { scheduleUsageRefresh(0); warnTokenExpiry(); }
    else { const q = quotaInfo(); store.set('quota', { date: todayKey(), count: q.used, limit: q.limit, official: false }); }
    renderQuota();
  }
  const src = $('#setSource').value;
  if (src !== state.source) {
    state.source = src;
    store.set('source', src);
    urlCache.clear();
  }
  const lv = $('#setLevel').value;
  if (lv !== state.level) {
    state.level = lv;
    store.set('level', lv);
    toast('音質已變更，下一首開始生效');
  }
});
$('#settingsBtn').addEventListener('click', openSettings);
function renderTokenHint() {
  const raw = $('#setToken').value.trim().replace(/^Bearer\s+/i, '');
  const tk = tokenInfo(raw);
  const el = $('#tokenHint');
  if (!raw) el.textContent = '選填。登入 chksz.com 後，從 F12 → Network → usage 請求的 Authorization 複製（不含 Bearer 也可以）。查用量不消耗額度。';
  else if (!tk.exp) el.textContent = '無法讀取到期日，儲存後會直接嘗試使用。';
  else if (!tk.valid) el.textContent = `⚠ 這個 Token 已在 ${tk.expText} 過期，請重新登入取得。`;
  else el.textContent = (state.tokenBad && raw === state.authToken ? '⚠ 伺服器回報此 Token 已失效。' : '✓ ') + `有效至 ${tk.expText}（剩 ${tk.daysLeft} 天）`;
}
$('#setToken').addEventListener('input', renderTokenHint);
$$('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close('cancel')));
$('#clearLrcBtn').addEventListener('click', () => {
  Object.keys(localStorage).filter(k => k.startsWith('777p:lrc:')).forEach(k => localStorage.removeItem(k));
  lyricMem.clear();
  lyric = { id: null, lines: null, msg: '' };
  toast('已清除歌詞快取');
  settingsDlg.close();
});

function openImport() {
  $('#importInput').value = '';
  importDlg.returnValue = '';
  importDlg.showModal();
}
$('#importBtn').addEventListener('click', openImport);
$('#mImportBtn').addEventListener('click', openImport);

/* ----- 產生家人設定連結 ----- */
const familyDlg = $('#familyDlg');
$('#familyBtn').addEventListener('click', () => {
  settingsDlg.close();
  $('#famKey').value = '';
  $('#famGh').value = store.get('ghToken', '');
  $('#famOut').value = '';
  $('#famResult').hidden = true;
  familyDlg.showModal();
});
$('#famGen').addEventListener('click', () => {
  const p = $('#famProfile').value.trim().toLowerCase();
  const k = $('#famKey').value.trim();
  const g = $('#famGh').value.trim();
  if (!/^[a-z0-9_-]{1,20}$/.test(p)) { toast('同步名稱請用英文小寫或數字，例如 mom'); return; }
  if (g && p === (store.get('syncProfile', '') || '')) { toast('這是你自己正在用的同步名稱，請換一個，不然資料會混在一起'); return; }
  if (!k && !g) { toast('至少要填 API Key 或 GitHub Token'); return; }
  const base = location.protocol.startsWith('http') ? location.origin + location.pathname : SITE_URL;
  const cfg = { p };
  if (k) cfg.k = k;
  if (g) cfg.g = g;
  // openExternalBrowser=1：從 LINE 點開時改用手機的預設瀏覽器（不然設定會存進 LINE 內建瀏覽器）
  $('#famOut').value = `${base}?openExternalBrowser=1#setup=${b64urlEncode(cfg)}`;
  $('#famResult').hidden = false;
});
async function copyText(text, fallbackEl) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* 改用舊方法 */ }
  const el = fallbackEl || Object.assign(document.createElement('textarea'), { value: text });
  if (!fallbackEl) document.body.appendChild(el);
  el.select();
  const ok = document.execCommand('copy');
  if (!fallbackEl) el.remove();
  return ok;
}
$('#famCopy').addEventListener('click', async () => {
  await copyText($('#famOut').value, $('#famOut'));
  toast('已複製，用私訊傳給對方');
});

/* ----- 貼上設定連結（App 裡用：LINE 的連結會開到瀏覽器，不會開進 App） ----- */
$('#setupApplyBtn').addEventListener('click', () => {
  const v = $('#setupPaste').value.trim();
  if (!v) { toast('先貼上設定連結'); return; }
  if (applySetupString(v)) location.reload();
});
// 給自己的新裝置（例如手機 App）用的設定連結：內容是這台裝置目前的設定
$('#selfLinkBtn').addEventListener('click', async () => {
  const cfg = { p: store.get('syncProfile', '') || '' };
  if (state.apiKey) cfg.k = state.apiKey;
  const g = store.get('ghToken', '');
  if (g) cfg.g = g;
  if (!cfg.k && !cfg.g) { toast('這台裝置還沒有設定 API Key 或同步'); return; }
  const base = location.protocol.startsWith('http') ? location.origin + location.pathname : SITE_URL;
  await copyText(`${base}?openExternalBrowser=1#setup=${b64urlEncode(cfg)}`);
  toast('已複製這台裝置的設定連結（等同密碼，別外流）');
});
$('#mSettingsBtn').addEventListener('click', () => $('#settingsBtn').click());
importDlg.addEventListener('close', async () => {
  if (importDlg.returnValue !== 'ok') return;
  const id = parsePlaylistId($('#importInput').value);
  if (!id) { toast('看不懂這個歌單 ID / 連結'); return; }
  try {
    const pl = await importPlaylist(id);
    closeNp();
    showView('pl:' + pl.id);
    toast(`已匯入「${pl.name}」（${pl.tracks.length} 首）`);
  } catch (e) {
    toast(e.message);
  }
});

/* =========================================================
 *  初始化
 * ========================================================= */
function init() {
  $$('[data-icon]').forEach(el => { el.innerHTML = ic(el.dataset.icon); });
  // 手機沒有音量滑桿，跟原生 App 一樣固定 100%，只用系統音量控制
  const isTouch = matchMedia('(pointer: coarse)').matches;
  audio.volume = isTouch ? 1 : state.volume;
  renderVolume();
  renderModeBtn();
  setPlayingUI(false);
  renderQuota();
  updateNowPlaying();
  if (current() && state.lastTime > 0) {
    $('#curTime').textContent = fmt(state.lastTime);
    const d = current().duration / 1000;
    if (d) { const pct = Math.min(100, (state.lastTime / d) * 100); seekEl.value = pct * 10; setFill(seekEl, pct); }
  }
  showView('home');
  if (sessionStorage.getItem('777p:setupDone')) {
    sessionStorage.removeItem('777p:setupDone');
    setTimeout(() => toast('設定完成！可以開始聽歌了'), 300);
  } else if (!state.apiKey) openSettings();
  refreshUsage();
  warnTokenExpiry();
  // 跨日時更新額度顯示；每 5 分鐘向官方同步一次（不消耗額度）
  setInterval(renderQuota, 60_000);
  setInterval(() => { if (!document.hidden) refreshUsage(); }, 5 * 60_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleUsageRefresh(500); });
}
init();
