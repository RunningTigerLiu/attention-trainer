/* engine.js — 任务注册表、全屏舞台、通用任务 runner（反应时 / 记忆广度）*/
(function () {
  'use strict';
  var App = window.App, U = App.util;

  /* ================= 任务注册表 ================= */
  var reg = {}, order = [];
  App.tasks = {
    register: function (t) { reg[t.id] = t; order.push(t.id); },
    get: function (id) { return reg[id]; },
    all: function () { return order.map(function (id) { return reg[id]; }); },
    byDomain: function (d) { return App.tasks.all().filter(function (t) { return t.domain === d; }); }
  };
  App.domains = {
    sustained: { name: '持续注意', desc: '长时间盯住一件事不走神' },
    selective: { name: '选择性注意', desc: '从一堆信息里快速找到目标' },
    wm: { name: '工作记忆', desc: '把信息"端在手里"同时加工（听写/背书的核心）' },
    inhibit: { name: '抑制控制', desc: '忍住冲动、先想再做' },
    flex: { name: '认知灵活性', desc: '在两套规则之间来回切换' },
    lang: { name: '语言', desc: '拼音拼读与语音意识' }
  };

  /* ================= 定时器托管（退出时统一清理） ================= */
  var timers = [];
  function T(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  /* 所有任务统一按时间结算：每个任务做 2 分钟，时间到自动结束。
     这样答错不会减少题目数量，各任务时长也稳定。 */
  var TASK_MS = 120000;
  function leftText(limit, started) {
    var left = Math.max(0, Math.ceil((limit - (performance.now() - started)) / 1000));
    return '剩余 ' + left + 's';
  }
  App.engine = { T: T, clearTimers: clearTimers, TASK_MS: TASK_MS, leftText: leftText };

  /* ================= 全屏舞台 ================= */
  var stage = {
    root: null, onQuit: null,
    open: function (opts) {
      opts = opts || {};
      U.$('#overlay').classList.remove('hidden');
      document.body.classList.add('noscroll');
      stage.setHead(opts.title || '', opts.sub || '');
      stage.setProgress(opts.progress || 0, opts.progressText || '');
      stage.onQuit = opts.onQuit || null;
      App.sound.unlock();
      var s = U.$('#stage'); s.innerHTML = '';
      stage.root = s;
      return s;
    },
    setHead: function (t, sub) { U.$('#stageTitle').textContent = t; U.$('#stageSub').textContent = sub || ''; },
    setProgress: function (p, text) {
      U.$('#stageProgress').style.width = U.clamp(p * 100, 0, 100) + '%';
      U.$('#stageProgressText').textContent = text || '';
    },
    clear: function () { var s = U.$('#stage'); s.innerHTML = ''; return s; },
    /* 训练用时钟：在舞台顶部显示已用时间 */
    clock: { started: null, tid: null, el: null },
    startClock: function () {
      stage.clock.el = stage.clock.el || U.$('#stageClock');
      stage.clock.started = performance.now();
      clearInterval(stage.clock.tid);
      stage.clock.tid = setInterval(function () {
        var s = Math.round((performance.now() - stage.clock.started) / 1000);
        var mm = Math.floor(s / 60), ss = s % 60;
        if (stage.clock.el) stage.clock.el.textContent = '⏱ ' + mm + ':' + String(ss).padStart(2, '0');
      }, 500);
    },
    stopClock: function () {
      clearInterval(stage.clock.tid); stage.clock.tid = null;
      if (stage.clock.el) stage.clock.el.textContent = '';
    },
    elapsedSec: function () {
      return stage.clock.started ? (performance.now() - stage.clock.started) / 1000 : 0;
    },
    close: function () {
      clearTimers(); App.speech.cancel();
      stage.stopClock();
      U.$('#overlay').classList.add('hidden');
      document.body.classList.remove('noscroll');
      U.$('#stage').innerHTML = '';
      stage.onQuit = null;
    }
  };
  App.stage = stage;
  document.addEventListener('DOMContentLoaded', function () {
    U.$('#stageQuit').addEventListener('click', function () {
      if (stage.onQuit) stage.onQuit();
      else stage.close();
    });
  });

  /* ================= 通用屏：说明 / 结果 ================= */
  /* opts: {title, intro(html), tips:[...], btn, onStart, extra(el)} */
  App.engine.screen = function (root, opts) {
    root.innerHTML = '';
    var pad = U.el('div', 'stagePad');
    var box = U.el('div', 'howto');
    if (opts.title) box.appendChild(U.el('h3', null, opts.title));
    if (opts.intro) box.appendChild(U.html('div', null, opts.intro));
    if (opts.tips && opts.tips.length) {
      var ul = U.el('ul');
      opts.tips.forEach(function (t) { ul.appendChild(U.html('li', null, t)); });
      box.appendChild(ul);
    }
    if (opts.extra) box.appendChild(opts.extra);
    pad.appendChild(box);
    if (opts.btn) {
      var b = U.el('button', 'btn btn-primary btn-big', opts.btn);
      b.addEventListener('click', function () { b.disabled = true; opts.onStart(); });
      pad.appendChild(b);
      T(function () { b.focus(); }, 60);
    }
    root.appendChild(pad);
    return pad;
  };

  /* 倒数 3-2-1 */
  App.engine.countdown = function (root, done, n) {
    n = n || 3;
    root.innerHTML = '';
    var pad = U.el('div', 'stagePad');
    var big = U.el('div', 'stimBig', String(n));
    pad.appendChild(U.el('div', 'muted', '准备好…'));
    pad.appendChild(big);
    root.appendChild(pad);
    var i = n;
    (function step() {
      big.textContent = i > 0 ? String(i) : '开始！';
      if (i > 0) App.sound.tick(); else App.sound.beep(760, 0.14);
      if (i < 0) { done(); return; }
      i--; T(step, 700);
    })();
  };

  /* ================= 反应时任务 runner（Go/No-Go、Flanker、Stroop、N-back）=================
     opts:
       trials:    [{ kind, go(bool), expected(key|null), render(box) }]
       buttons:   [{ key, label, cls }]            底部按钮
       keymap:    { 'ArrowLeft':'left', ' ':'go' }  键盘映射
       stimMs:    刺激显示时长（之后清屏，仍可作答）
       deadlineMs:作答窗口（从刺激出现算起）
       itiMs:     试次间隔
       feedback:  是否即时反馈
       onDone(rows)
  ================================================================================ */
  App.engine.rtTask = function (root, opts) {
    var trials = opts.trials || [], rows = [], i = 0, answered = false, t0 = 0, cur = null;
    var hideTid = null, deadTid = null;
    var LIMIT = opts.timeLimitMs || 0, startedAt = performance.now();
    // 自适应时限：答对且快→收紧（更难）；答错/漏按→放宽（更易），像阶梯一样逐步逼近
    var dl = opts.deadlineMs || 2000;
    var dlMin = Math.round(dl * (opts.dlMin || 0.7));
    var dlMax = Math.round(dl * (opts.dlMax || 1.35));
    var dlStep = opts.dlStep || 50;

    root.innerHTML = '';
    var pad = U.el('div', 'stagePad');
    var box = U.el('div', 'stimBox');
    var fb = U.el('div', 'fbMark');
    var padEl = U.el('div', 'pad');
    (opts.buttons || []).forEach(function (b) {
      var btn = U.el('button', 'padbtn ' + (b.cls || ''), b.label);
      if (b.color) btn.style.color = b.color;
      btn.addEventListener('click', function () { respond(b.key); });
      padEl.appendChild(btn);
    });
    pad.appendChild(box); pad.appendChild(fb); pad.appendChild(padEl);
    root.appendChild(pad);

    function onKey(e) {
      var k = opts.keymap && opts.keymap[e.key];
      if (k) { e.preventDefault(); respond(k); }
    }
    document.addEventListener('keydown', onKey);

    function clean() {
      document.removeEventListener('keydown', onKey);
      clearTimeout(hideTid); clearTimeout(deadTid);
    }

    function next() {
      if (LIMIT && performance.now() - startedAt >= LIMIT) { clean(); opts.onDone(rows); return; }
      if (i >= trials.length) {
        if (opts.makeTrial) trials.push(opts.makeTrial());
        else { clean(); opts.onDone(rows); return; }
      }
      cur = trials[i]; answered = false;
      box.innerHTML = ''; fb.textContent = ''; fb.className = 'fbMark';
      if (LIMIT) App.stage.setProgress((performance.now() - startedAt) / LIMIT, leftText(LIMIT, startedAt));
      else App.stage.setProgress(i / trials.length, (i + 1) + ' / ' + trials.length);
      cur.render(box);
      t0 = performance.now();
      if (opts.stimMs) hideTid = setTimeout(function () { if (!opts.keepStim) box.innerHTML = ''; }, opts.stimMs);
      deadTid = setTimeout(function () { if (!answered) record(null, null); }, dl);
    }

    function respond(key) {
      if (answered || !cur) return;
      answered = true;
      clearTimeout(deadTid);
      record(key, performance.now() - t0);
    }

    function record(key, rt) {
      answered = true;
      var exp = cur.expected;                  // null = 不该按
      var correct = (key === null && exp === null) || (key !== null && key === exp);
      // 阶梯调整时限：答对且明显快于时限→收紧；答错或漏按→放宽
      if (correct && key !== null && rt != null && rt < dl * 0.6) dl = Math.max(dlMin, dl - dlStep);
      else if (!correct) dl = Math.min(dlMax, dl + dlStep);
      rows.push({
        i: i, kind: cur.kind, go: !!cur.go, expected: exp, got: key,
        rt: key === null ? null : Math.round(rt), correct: correct, meta: cur.meta || null
      });
      // feedback: true=每次都反馈；'errors'=只在出错时提示（保持节奏，适合 Go/No-Go）
      var fbMode = opts.feedback;
      if (fbMode === true && correct) {
        fb.textContent = '✓'; fb.className = 'fbMark ok';
        if (key !== null) App.sound.ok();
      } else if (fbMode && !correct) {
        fb.textContent = key === null ? '…错过了' : (cur.go === false ? '✗ 这个不能按' : '✗');
        fb.className = 'fbMark bad'; App.sound.bad();
      }
      box.innerHTML = '';
      i++;
      T(next, opts.itiMs || 700);
    }

    next();
  };

  /* ================= 记忆广度 runner（Corsi、听数字、汉字闪记）=================
     阶梯法（1 上 1 下）：答对→长度 +1；答错→长度 −1（回退一格，有下限），
     练满 maxTrials 题后结束，按"最长记住的长度"计分。难度像上楼梯一样逐步加，
     错了就退回上一级，不会一下摔到底。
     opts: {startLen, minLen, maxLen, maxTrials, gen(len), present(seq, done), collect(seq, done(ans)), equal(seq, ans), onDone(data)}
  ================================================================================ */
  App.engine.spanTask = function (root, opts) {
    var minLen = opts.minLen || opts.startLen || 2;
    var len = opts.startLen || 2, maxLen = opts.maxLen || 9, maxTrials = opts.maxTrials || 999;
    var LIMIT = opts.timeLimitMs || 0, startedAt = performance.now();
    var trials = [], maxSpan = 0, n = 0;

    function runTrial() {
      if (LIMIT && performance.now() - startedAt >= LIMIT) return finish();
      if (n >= maxTrials) return finish();
      n++;
      if (LIMIT) App.stage.setProgress((performance.now() - startedAt) / LIMIT, '第 ' + n + ' 题 · 长度 ' + len);
      else App.stage.setProgress(n / maxTrials, '第 ' + n + ' / ' + maxTrials + ' 题 · 长度 ' + len);
      var seq = opts.gen(len);
      root.innerHTML = '';
      opts.present(root, seq, function () {
        opts.collect(root, seq, function (ans) {
          var ok = opts.equal(seq, ans);
          trials.push({ len: len, correct: ok, seq: seq.slice(), ans: ans });
          if (ok) {
            maxSpan = Math.max(maxSpan, len);
            App.sound.ok();
            feedback(true, function () { len = Math.min(maxLen, len + 1); runTrial(); });
          } else {
            App.sound.bad();
            feedback(false, function () { len = Math.max(minLen, len - 1); runTrial(); });
          }
        });
      });
    }

    function feedback(ok, done) {
      root.innerHTML = '';
      var pad = U.el('div', 'stagePad');
      pad.appendChild(U.el('div', 'stimBig', ok ? '✓' : '✗'));
      pad.appendChild(U.el('div', ok ? 'pill g' : 'pill y', ok ? '对了！下一题加长一点' : '没关系，退一步再来'));
      root.appendChild(pad);
      T(done, 900);
    }

    function finish() {
      opts.onDone({
        maxSpan: maxSpan, trials: trials,
        correctCount: trials.filter(function (t) { return t.correct; }).length,
        totalTrials: trials.length
      });
    }

    runTrial();
  };

  /* ================= 结果打包 / 自适应 ================= */
  /* score: 0-100；thresholds：up 升级线、down 降级线 */
  App.engine.finishTask = function (ctx, payload) {
    var t = App.tasks.get(ctx.taskId);
    var score = U.clamp(Math.round(payload.score), 0, 100);
    var stars = score >= 85 ? 3 : score >= 65 ? 2 : score >= 40 ? 1 : 0;
    var next = ctx.level, changed = 0;
    if (App.store.settings().adaptive) {
      if (score >= (t.up || 85) && ctx.level < t.levels) { next = ctx.level + 1; changed = 1; }
      else if (score <= (t.down || 45) && ctx.level > 1) { next = ctx.level - 1; changed = -1; }
    }
    var result = {
      taskId: ctx.taskId, taskName: t.name, domain: t.domain,
      level: ctx.level, at: new Date().toISOString(),
      durationMs: Date.now() - ctx.startedAtMs,
      metrics: payload.metrics || {},
      score: score, stars: stars,
      points: 6 + stars * 6 + ctx.level,
      nextLevel: next, levelChanged: changed
    };
    App.store.setLevel(ctx.taskId, next);
    return result;
  };

  /* 结果屏 */
  App.engine.resultScreen = function (root, result, onNext, nextLabel) {
    var t = App.tasks.get(result.taskId);
    App.stage.setProgress(1, '');
    root.innerHTML = '';
    var pad = U.el('div', 'stagePad');
    pad.appendChild(U.el('div', 'stimBig', '⭐'.repeat(result.stars) || '🙂'));
    pad.appendChild(U.el('h3', null, t.name + ' 完成'));

    var box = U.el('div', 'howto');
    var g = U.el('div', 'grid3');
    (t.report ? t.report(result) : []).forEach(function (kv) {
      var s = U.el('div', 'stat');
      s.appendChild(U.el('div', 'v', kv[1]));
      s.appendChild(U.el('div', 'k', kv[0]));
      g.appendChild(s);
    });
    box.appendChild(g);
    var msg = result.levelChanged > 0 ? '🎉 太棒了，下次升到第 ' + result.nextLevel + ' 关！'
      : result.levelChanged < 0 ? '这一关有点难，下次退回第 ' + result.nextLevel + ' 关稳一稳。'
        : '保持在第 ' + result.level + ' 关继续练。';
    box.appendChild(U.html('p', 'small', '<b>本次得分 ' + result.score + '</b> · ' + msg));
    if (t.transfer) box.appendChild(U.html('p', 'small muted', '💡 ' + t.transfer));
    pad.appendChild(box);

    var b = U.el('button', 'btn btn-primary btn-big', nextLabel || '继续');
    b.addEventListener('click', onNext);
    pad.appendChild(b);
    root.appendChild(pad);
    if (result.stars === 3) App.sound.win(); else App.sound.ok();
  };

  /* 反应时任务的标准指标：正确率、漏报、误按、平均反应时、反应时变异 */
  App.engine.rtMetrics = function (rows) {
    var goRows = rows.filter(function (r) { return r.go; });
    var noRows = rows.filter(function (r) { return !r.go; });
    var hits = goRows.filter(function (r) { return r.correct && r.got !== null; });
    var omissions = goRows.filter(function (r) { return r.got === null; }).length;
    var commissions = noRows.filter(function (r) { return r.got !== null; }).length;
    var wrongKey = goRows.filter(function (r) { return r.got !== null && !r.correct; }).length;
    var rts = rows.filter(function (r) { return r.correct && r.rt != null; }).map(function (r) { return r.rt; });
    var correct = rows.filter(function (r) { return r.correct; }).length;
    return {
      total: rows.length, correct: correct,
      acc: rows.length ? correct / rows.length : null,
      goTotal: goRows.length, hits: hits.length,
      goAcc: goRows.length ? hits.length / goRows.length : null,
      nogoTotal: noRows.length, commissions: commissions,
      inhibAcc: noRows.length ? 1 - commissions / noRows.length : null,
      omissions: omissions, wrongKey: wrongKey,
      rt: U.r0(U.mean(rts)), rtSD: U.r0(U.sd(rts)), cv: U.r1(U.cv(rts) == null ? null : U.cv(rts) * 100),
      cvRaw: U.cv(rts)
    };
  };

  /* 速度分：rt 越小越好，target 为"满分"参考值 */
  App.engine.speedScore = function (rt, target, worst) {
    if (rt == null) return 0;
    return U.clamp(100 * (worst - rt) / (worst - target), 0, 100);
  };
  /* 稳定性分：变异系数越小越好 */
  App.engine.steadyScore = function (cv) {
    if (cv == null) return 50;
    return U.clamp(100 * (0.45 - cv) / (0.45 - 0.12), 0, 100);
  };
})();
