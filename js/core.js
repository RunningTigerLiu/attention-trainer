/* core.js — 基础设施：工具函数、本地存储、统计、音效、语音 */
(function () {
  'use strict';
  var App = window.App = window.App || {};
  var KEY = 'attn_trainer_v1';

  /* ================= 工具 ================= */
  var U = App.util = {
    $: function (s, r) { return (r || document).querySelector(s); },
    $$: function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); },
    el: function (tag, cls, text) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    },
    html: function (tag, cls, h) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (h != null) e.innerHTML = h;
      return e;
    },
    clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
    rnd: function (n) { return Math.floor(Math.random() * n); },
    pick: function (a) { return a[Math.floor(Math.random() * a.length)]; },
    shuffle: function (a) {
      a = a.slice();
      for (var i = a.length - 1; i > 0; i--) { var j = U.rnd(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; }
      return a;
    },
    range: function (n, from) { var a = [], i; from = from || 0; for (i = 0; i < n; i++) a.push(i + from); return a; },
    uid: function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },
    today: function () { return U.dateStr(new Date()); },
    dateStr: function (d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },
    parseDate: function (s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); },
    addDays: function (d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; },
    daysBetween: function (a, b) { return Math.round((U.parseDate(b) - U.parseDate(a)) / 86400000); },
    weekdayCN: function (d) { return '日一二三四五六'[d.getDay()]; },
    mean: function (a) { if (!a || !a.length) return null; var s = 0, i; for (i = 0; i < a.length; i++) s += a[i]; return s / a.length; },
    sd: function (a) {
      if (!a || a.length < 2) return null;
      var m = U.mean(a), s = 0, i;
      for (i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m);
      return Math.sqrt(s / (a.length - 1));
    },
    cv: function (a) { var m = U.mean(a), s = U.sd(a); return (m && s != null && m > 0) ? s / m : null; },
    r1: function (v) { return v == null ? null : Math.round(v * 10) / 10; },
    r0: function (v) { return v == null ? null : Math.round(v); },
    pct: function (v) { return v == null ? '—' : Math.round(v * 100) + '%'; },
    ms: function (v) { return v == null ? '—' : Math.round(v) + 'ms'; },
    sec: function (v) { return v == null ? '—' : (Math.round(v * 10) / 10) + 's'; },
    sleep: function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); },
    // 简单线性回归斜率（x = 0..n-1）
    slope: function (ys) {
      var n = ys.length, i, sx = 0, sy = 0, sxy = 0, sxx = 0;
      if (n < 3) return null;
      for (i = 0; i < n; i++) { sx += i; sy += ys[i]; sxy += i * ys[i]; sxx += i * i; }
      var d = n * sxx - sx * sx;
      return d === 0 ? null : (n * sxy - sx * sy) / d;
    },
    download: function (filename, text, mime) {
      var blob = new Blob([text], { type: (mime || 'application/json') + ';charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    },
    toast: function (msg, ms) {
      var t = U.$('#toast');
      t.textContent = msg; t.classList.remove('hidden');
      clearTimeout(U._tt);
      U._tt = setTimeout(function () { t.classList.add('hidden'); }, ms || 2200);
    }
  };

  /* ================= 存储 ================= */
  function defaults() {
    return {
      version: 1,
      profile: { name: '宝贝', grade: '二年级', createdAt: new Date().toISOString() },
      settings: {
        tasksPerDay: 5, sound: true, speech: true, speechRate: 0.8, voice: '',
        adaptive: true, warmup: true, feedback: true
      },
      levels: {},          // taskId -> 当前难度等级
      sessions: [],        // 训练会话
      meta: { lastBackupAt: null, planCursor: 0 }
    };
  }

  var S = App.store = {
    data: null,
    load: function () {
      var raw = null;
      try { raw = localStorage.getItem(KEY); } catch (e) { }
      // Electron 下优先从本地文件恢复（清缓存、更新程序、重装都不丢）
      var src = raw, fromFile = null;
      if (window.__fileStore && typeof window.__fileStore.load === 'function') {
        try { fromFile = window.__fileStore.load(); } catch (e) { }
      }
      if (fromFile) {
        try {
          var localObj = raw ? JSON.parse(raw) : null;
          var fileObj = JSON.parse(fromFile);
          var lc = localObj && Array.isArray(localObj.sessions) ? localObj.sessions.length : -1;
          var fc = fileObj && Array.isArray(fileObj.sessions) ? fileObj.sessions.length : -1;
          if (fc >= lc) src = fromFile;   // 文件与本地同时存在时，取记录更多的那个
        } catch (e) { }
      }
      try { S.data = src ? JSON.parse(src) : defaults(); } catch (e) { S.data = defaults(); }
      S.data = S.merge(defaults(), S.data);
      if (src === fromFile) { try { localStorage.setItem(KEY, JSON.stringify(S.data)); } catch (e) { } }
      return S.data;
    },
    merge: function (d, got) {
      // 补齐缺失字段，保证旧存档可用
      Object.keys(d).forEach(function (k) {
        if (got[k] == null) got[k] = d[k];
        else if (typeof d[k] === 'object' && !Array.isArray(d[k])) got[k] = S.merge(d[k], got[k]);
      });
      return got;
    },
    save: function () {
      try { localStorage.setItem(KEY, JSON.stringify(S.data)); }
      catch (e) { U.toast('⚠️ 本地保存失败，请到"数据管理"导出备份'); }
      // Electron 下实时镜像到本地文件（并做每日轮换备份）
      if (window.__fileStore && typeof window.__fileStore.save === 'function') {
        try { window.__fileStore.save(JSON.stringify(S.data)); } catch (e) { }
      }
    },
    settings: function () { return S.data.settings; },
    level: function (taskId) {
      var t = App.tasks.get(taskId);
      var l = S.data.levels[taskId];
      if (l == null) l = t && t.startLevel ? t.startLevel : 1;
      return U.clamp(l, 1, t ? t.levels : 6);
    },
    setLevel: function (taskId, l) {
      var t = App.tasks.get(taskId);
      S.data.levels[taskId] = U.clamp(l, 1, t ? t.levels : 6);
      S.save();
    },
    /* 会话 */
    newSession: function (kind, planIds) {
      var s = {
        id: U.uid(), date: U.today(), kind: kind || 'daily',
        startedAt: new Date().toISOString(), endedAt: null,
        plan: planIds || [], results: [], rating: null, points: 0
      };
      S.data.sessions.push(s); S.save();
      return s;
    },
    pushResult: function (session, result) {
      session.results.push(result);
      session.points += result.points || 0;
      session.endedAt = new Date().toISOString();
      S.save();
    },
    allResults: function () {
      var out = [];
      S.data.sessions.forEach(function (s) {
        s.results.forEach(function (r) { out.push(Object.assign({}, r, { date: s.date, sessionId: s.id, kind: s.kind })); });
      });
      return out.sort(function (a, b) { return (a.at || '') < (b.at || '') ? -1 : 1; });
    },
    resultsOf: function (taskId) {
      return S.allResults().filter(function (r) { return r.taskId === taskId; });
    },
    activeDays: function () {
      var set = {};
      S.data.sessions.forEach(function (s) { if (s.results.length) set[s.date] = true; });
      return Object.keys(set).sort();
    },
    streak: function () {
      var days = S.activeDays(); if (!days.length) return 0;
      var map = {}; days.forEach(function (d) { map[d] = 1; });
      var n = 0, d = new Date();
      if (!map[U.dateStr(d)]) d = U.addDays(d, -1);   // 今天还没练，从昨天起算
      while (map[U.dateStr(d)]) { n++; d = U.addDays(d, -1); }
      return n;
    },
    totalPoints: function () {
      return S.data.sessions.reduce(function (a, s) { return a + (s.points || 0); }, 0);
    },
    reset: function () { S.data = defaults(); S.save(); },
    exportObj: function () {
      return {
        app: '专注力训练营', version: 1, exportedAt: new Date().toISOString(), data: S.data
      };
    },
    importObj: function (obj) {
      var d = obj && obj.data ? obj.data : obj;
      if (!d || !Array.isArray(d.sessions)) throw new Error('文件格式不对：缺少 sessions');
      S.data = S.merge(defaults(), d);
      S.save();
    },
    mergeObj: function (obj) {
      // 合并导入：按 session.id 去重
      var d = obj && obj.data ? obj.data : obj;
      if (!d || !Array.isArray(d.sessions)) throw new Error('文件格式不对：缺少 sessions');
      var have = {}; S.data.sessions.forEach(function (s) { have[s.id] = true; });
      var added = 0;
      d.sessions.forEach(function (s) { if (!have[s.id]) { S.data.sessions.push(s); added++; } });
      S.data.sessions.sort(function (a, b) { return (a.startedAt || '') < (b.startedAt || '') ? -1 : 1; });
      // 难度取较高者
      Object.keys(d.levels || {}).forEach(function (k) {
        S.data.levels[k] = Math.max(S.data.levels[k] || 0, d.levels[k] || 0);
      });
      S.save();
      return added;
    }
  };

  /* ================= 音效（WebAudio，温和） ================= */
  var AC = null;
  function ac() {
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } }
    if (AC && AC.state === 'suspended') AC.resume();
    return AC;
  }
  App.sound = {
    beep: function (freq, dur, vol) {
      if (!S.data || !S.data.settings.sound) return;
      var c = ac(); if (!c) return;
      var o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0, c.currentTime);
      g.gain.linearRampToValueAtTime(vol || 0.12, c.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + (dur || 0.12));
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + (dur || 0.12) + 0.02);
    },
    ok: function () { App.sound.beep(880, 0.1); },
    bad: function () { App.sound.beep(220, 0.18, 0.1); },
    tick: function () { App.sound.beep(660, 0.05, 0.07); },
    win: function () {
      [523, 659, 784].forEach(function (f, i) { setTimeout(function () { App.sound.beep(f, 0.14); }, i * 110); });
    },
    unlock: function () { ac(); }
  };

  /* ================= 语音（中文 TTS） ================= */
  var voices = [], zhVoice = null;
  /* macOS 自带的"趣味/无障碍"音色（Eddy、Grandma、Rocko 等）中文非常机械，
     默认不该用；优先自然音色，其次才是普通话。 */
  var NOVELTY = /^(Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley|Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox)\b/i;
  function voiceScore(v) {
    var s = 0;
    if (/Premium|Enhanced|增强|加强|Neural|Siri/i.test(v.name)) s += 100;  // 增强/高级音色最自然
    if (/^zh[-_]?(CN|Hans)/i.test(v.lang)) s += 20;                        // 普通话优先
    if (/Ting|Tingting|婷婷/i.test(v.name)) s += 10;                       // 系统标准普通话女声
    if (v.localService) s += 1;
    return s;
  }
  function loadVoices() {
    if (!('speechSynthesis' in window)) return;
    voices = window.speechSynthesis.getVoices() || [];
    var zh = voices.filter(function (v) { return /^zh/i.test(v.lang); });
    var saved = S.data && S.data.settings ? S.data.settings.voice : '';
    zhVoice = null;
    if (saved) zhVoice = zh.filter(function (v) { return v.name === saved; })[0] || null;
    if (!zhVoice) {
      var good = zh.filter(function (v) { return !NOVELTY.test(v.name); });
      zhVoice = good.sort(function (a, b) { return voiceScore(b) - voiceScore(a); })[0] || zh[0] ||
        voices.filter(function (v) { return /Chinese|中文|普通话/i.test(v.name); })[0] || null;
    }
  }
  if ('speechSynthesis' in window) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
  App.speech = {
    available: function () { return ('speechSynthesis' in window); },
    hasChinese: function () { loadVoices(); return !!zhVoice; },
    voiceName: function () { return zhVoice ? (zhVoice.name + ' / ' + zhVoice.lang) : '（未找到中文语音）'; },
    /* 可选的中文语音（已排除趣味音色） */
    list: function () {
      loadVoices();
      var zh = voices.filter(function (v) { return /^zh/i.test(v.lang); });
      var good = zh.filter(function (v) { return !NOVELTY.test(v.name); });
      return (good.length ? good : zh).sort(function (a, b) { return voiceScore(b) - voiceScore(a); });
    },
    cancel: function () { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); },
    /* 朗读一段文字；done 在读完后回调 */
    say: function (text, done, rateOverride) {
      if (!App.speech.available() || !S.data.settings.speech) { if (done) setTimeout(done, 300); return false; }
      try {
        loadVoices();
        var u = new SpeechSynthesisUtterance(String(text));
        u.lang = 'zh-CN';
        u.rate = rateOverride || S.data.settings.speechRate || 0.8;
        if (zhVoice) u.voice = zhVoice;
        var fired = false;
        u.onend = function () { if (!fired) { fired = true; if (done) done(); } };
        u.onerror = function () { if (!fired) { fired = true; if (done) done(); } };
        window.speechSynthesis.speak(u);
        // 兜底：某些浏览器 onend 不触发
        setTimeout(function () { if (!fired) { fired = true; if (done) done(); } }, 1200 + String(text).length * 420);
        return true;
      } catch (e) { if (done) setTimeout(done, 300); return false; }
    },
    /* 逐项朗读（数字/词语/指令步骤），每项间隔 gap 毫秒；rate 可选 */
    sayList: function (items, gap, done, onItem, rate) {
      var i = 0;
      function step() {
        if (i >= items.length) { if (done) done(); return; }
        if (onItem) onItem(items[i], i);
        var cur = items[i]; i++;
        App.speech.say(cur, function () { setTimeout(step, gap); }, rate);
      }
      step();
    }
  };

  App.store.load();
})();
