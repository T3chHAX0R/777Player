'use strict';

/* =========================================================
 *  777Player Android App 轉接層
 *
 *  在 App 裡（window.AndroidPlayer 存在）時，建立一個「假的 <audio>」，
 *  把播放交給 Android 原生播放器（Media3 / ExoPlayer）。
 *  app.js 照常操作 audio.src / play() / currentTime…，不需要知道差別。
 *  原生端負責：通知列、耳機與藍芽按鍵、來電後恢復、背景不被回收。
 *  在一般瀏覽器裡這個檔案什麼都不做。
 * ========================================================= */

window.NativeAudio = (function () {
  const N = window.AndroidPlayer;
  if (!N) return null;
  document.documentElement.classList.add('in-app');

  const events = new EventTarget();
  const emit = type => events.dispatchEvent(new Event(type));

  let src = '';
  let paused = true;
  let time = 0;
  let duration = NaN;
  let loaded = false;     // 這個 src 已經交給原生端
  let pendingSeek = 0;    // 交給原生端之前設定的起始位置
  let pendingPlay = false;
  let endedSent = false;
  let loadScheduled = false;

  function songMeta() {
    const s = typeof current === 'function' ? current() : null;
    if (!s) return {};
    return { id: String(s.id), title: s.name || '', artist: s.artist || '', album: s.album || '', art: s.pic ? img(s.pic, 512) : '' };
  }

  // src、currentTime、play() 通常在同一段程式裡連續設定，等它們都設好再一次交給原生端
  function scheduleLoad() {
    if (loadScheduled) return;
    loadScheduled = true;
    queueMicrotask(flushLoad);
  }
  function flushLoad() {
    loadScheduled = false;
    if (loaded || !src) return;
    loaded = true;
    N.load(JSON.stringify({ url: src, startMs: Math.round(pendingSeek * 1000), play: pendingPlay, ...songMeta() }));
  }

  const audio = {
    error: null,
    volume: 1,       // 原生播放器固定 100%，只用系統音量
    muted: false,
    playbackRate: 1,

    get src() { return src; },
    set src(v) {
      src = String(v || '');
      loaded = false; pendingSeek = 0; pendingPlay = false; endedSent = false;
      time = 0; duration = NaN; this.error = null;
      if (src) scheduleLoad();
    },
    getAttribute(name) { return name === 'src' && src ? src : null; },
    removeAttribute(name) {
      if (name !== 'src') return;
      src = ''; loaded = false; time = 0; duration = NaN;
      if (!paused) { paused = true; emit('pause'); }
      N.stop();
    },
    load() {},

    get paused() { return paused; },
    get duration() { return duration; },
    get currentTime() { return time; },
    set currentTime(t) {
      time = Math.max(0, +t || 0);
      endedSent = false;
      if (loaded) N.seekTo(time * 1000);
      else pendingSeek = time;
    },

    play() {
      if (!src) return Promise.reject(new DOMException('沒有音源', 'NotSupportedError'));
      if (paused) { paused = false; emit('play'); }
      endedSent = false;
      if (!loaded) { pendingPlay = true; flushLoad(); }
      else N.play();
      return Promise.resolve();
    },
    pause() {
      if (loaded) N.pause();
      pendingPlay = false;
      if (!paused) { paused = true; emit('pause'); }
    },

    addEventListener: (type, fn, opts) => events.addEventListener(type, fn, opts),
    removeEventListener: (type, fn, opts) => events.removeEventListener(type, fn, opts),
  };

  /* ----- 原生端傳來的事件 ----- */
  const STATE_BUFFERING = 2, STATE_READY = 3, STATE_ENDED = 4;
  window.__nativePlayer = {
    emit(type, d) {
      d = d || {};
      if (typeof d.pos === 'number') time = d.pos;
      if (typeof d.dur === 'number' && d.dur > 0 && duration !== d.dur) {
        const first = !(duration > 0);
        duration = d.dur;
        if (first) { emit('loadedmetadata'); emit('durationchange'); }
      }
      switch (type) {
        case 'state': {
          // 耳機、通知列、來電等「外部」造成的播放／暫停也要同步回網頁
          if (d.pwr && paused && d.st !== STATE_ENDED) { paused = false; emit('play'); }
          if (!d.pwr && !paused) { paused = true; emit('pause'); }
          if (d.st === STATE_BUFFERING && d.pwr) emit('waiting');
          if (d.st === STATE_READY) emit('canplay');
          if (d.playing) emit('playing');
          if (d.st === STATE_ENDED && !endedSent && src) {
            endedSent = true;
            paused = true;
            emit('pause');
            emit('ended');
          }
          emit('timeupdate');
          break;
        }
        case 'time': emit('timeupdate'); break;
        case 'seeked': emit('seeked'); emit('timeupdate'); break;
        case 'error':
          audio.error = { code: d.code || 2, message: d.message || '' };
          paused = true;
          emit('error');
          break;
        case 'command':
          if (d.cmd === 'next' && typeof next === 'function') next();
          else if (d.cmd === 'prev' && typeof prev === 'function') prev();
          break;
      }
    },
  };

  return audio;
})();

// Android 返回鍵：先關對話框／歌詞畫面／回首頁，都沒有才讓 App 退到背景（不停止播放）
window.__nativeBack = function () {
  const dlg = document.querySelector('dialog[open]');
  if (dlg) { dlg.close('cancel'); return true; }
  if (typeof npOpen !== 'undefined' && npOpen) { closeNp(); return true; }
  if (typeof state !== 'undefined' && state.view !== 'home') { showView('home'); return true; }
  return false;
};
