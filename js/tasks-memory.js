/* tasks-memory.js — 工作记忆与认知灵活性：位置记忆(N-back)、方块闪现(Corsi)、
   听数字(听觉广度)、汉字闪记、听指令、连点测验(Trail Making) */
(function () {
  'use strict';
  var App = window.App, U = App.util, E = App.engine;

  function gridEl(n, cls) {
    var g = U.el('div', 'bgrid' + (cls ? ' ' + cls : ''));
    g.style.gridTemplateColumns = 'repeat(' + n + ',1fr)';
    g.style.width = 'min(84vw, ' + (n * 86) + 'px)';
    return g;
  }

  /* ======================================================================
     6. 位置记忆（N-back）
     ====================================================================== */
  var NB = [
    { n: 1, trials: 20, isi: 2600, stim: 700 }, { n: 1, trials: 24, isi: 2200, stim: 650 },
    { n: 2, trials: 24, isi: 2800, stim: 700 }, { n: 2, trials: 28, isi: 2400, stim: 650 },
    { n: 2, trials: 32, isi: 2000, stim: 600 }, { n: 3, trials: 32, isi: 2600, stim: 650 }
  ];
  App.tasks.register({
    id: 'nback', name: '位置记忆', icon: '🧠', domain: 'wm',
    levels: 6, startLevel: 1, up: 85, down: 42, dur: '约 2 分钟',
    why: '要一边看新位置、一边在脑子里不停更新前几个位置。这是工作记忆"刷新"功能最直接的训练。',
    origin: 'N-back 任务；Jaeggi 等人（2008）用它做工作记忆训练研究，是这一领域最被反复验证的范式。',
    transfer: '背书、心算、听长句子都依赖这个"脑内便签"。注意：N-back 练的是容量本身，提升慢但基础，别指望一周见效。',
    levelName: function (l) { return NB[l - 1].n + '-back · 2 分钟'; },
    metricDefs: [
      { key: 'hitRate', name: '抓到率(%)', better: 'high' },
      { key: 'faRate', name: '误报率(%)', better: 'low' },
      { key: 'nLevel', name: 'n 等级', better: 'high' }
    ],
    report: function (r) {
      var m = r.metrics;
      return [['抓到', m.hits + '/' + m.targets], ['误报', m.fa + ' 次'], ['n 等级', m.nLevel], ['得分', r.score]];
    },
    mount: function (root, ctx) {
      var cfg = NB[ctx.level - 1], N = cfg.n, GN = 3;
      // 先备足题目；实际按 2 分钟时间结算，时间到就停
      var MAX_TRIALS = 400;
      var seq = [], i, k;
      for (i = 0; i < MAX_TRIALS; i++) {
        if (i >= N && Math.random() < 0.3) seq.push(seq[i - N]);
        else {
          do { k = U.rnd(GN * GN); } while (i >= N && k === seq[i - N]);
          seq.push(k);
        }
      }
      var isTarget = seq.map(function (v, idx) { return idx >= N && v === seq[idx - N]; });

      E.screen(root, {
        title: '位置记忆 · ' + N + '-back',
        intro: '<p>九宫格里会一个一个地亮方块。</p>',
        tips: [
          '如果<b>现在亮的位置</b>和<b>前 ' + N + ' 个</b>亮的位置<b>一样</b>，就按「一样！」（或空格键）。',
          '不一样就什么都别做，等下一个。',
          N === 1 ? '也就是：和<b>上一个</b>位置相同就按。' : '需要在心里一直记着最近 ' + N + ' 个位置，像传送带一样往前推。',
          '一共做 <b>2 分钟</b>，时间到自动结束。前 ' + N + ' 次不用按。'
        ],
        btn: '开始', onStart: function () { E.countdown(App.stage.clear(), run); }
      });

      function run() {
        var r = App.stage.clear();
        var pad = U.el('div', 'stagePad');
        var g = gridEl(GN, 'locked');
        var blks = [];
        for (i = 0; i < GN * GN; i++) { var b = U.el('div', 'blk'); g.appendChild(b); blks.push(b); }
        var fb = U.el('div', 'fbMark');
        var btn = U.el('button', 'padbtn wide', '一样！');
        var padw = U.el('div', 'pad'); padw.appendChild(btn);
        pad.appendChild(U.el('div', 'muted small', '和前 ' + N + ' 个位置相同就按'));
        pad.appendChild(g); pad.appendChild(fb); pad.appendChild(padw);
        r.appendChild(pad);

        var idx = -1, answered = false, t0 = 0, rows = [], startedAt = performance.now();
        btn.addEventListener('click', respond);
        function onKey(e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); respond(); } }
        document.addEventListener('keydown', onKey);

        function respond() {
          if (answered || idx < 0) return;
          answered = true;
          record('match', performance.now() - t0);
        }
        function record(got, rt) {
          var want = isTarget[idx];
          var correct = want ? got === 'match' : got === null;
          rows.push({ i: idx, go: want, expected: want ? 'match' : null, got: got, rt: got ? Math.round(rt) : null, correct: correct });
          if (App.store.settings().feedback) {
            if (got === 'match' && correct) { fb.textContent = '✓ 抓到了'; fb.className = 'fbMark ok'; App.sound.ok(); }
            else if (got === 'match' && !correct) { fb.textContent = '✗ 不是同一个位置'; fb.className = 'fbMark bad'; App.sound.bad(); }
            else if (got === null && !correct) { fb.textContent = '…漏掉一个'; fb.className = 'fbMark bad'; App.sound.bad(); }
            else { fb.textContent = ''; }
          }
        }
        function step() {
          if (idx >= 0 && !answered) record(null, null);
          idx++;
          if (idx >= seq.length || performance.now() - startedAt >= E.TASK_MS) {
            document.removeEventListener('keydown', onKey);
            return finish(rows);
          }
          answered = false;
          App.stage.setProgress((performance.now() - startedAt) / E.TASK_MS, (idx + 1) + ' 次 · ' + E.leftText(E.TASK_MS, startedAt));
          blks.forEach(function (b) { b.classList.remove('on'); });
          blks[seq[idx]].classList.add('on');
          t0 = performance.now();
          E.T(function () { blks[seq[idx]].classList.remove('on'); }, cfg.stim);
          E.T(function () { fb.textContent = ''; }, cfg.isi - 300);
          E.T(step, cfg.isi);
        }
        E.T(step, 500);
      }

      function finish(rows) {
        var tg = rows.filter(function (r) { return r.go; });
        var nt = rows.filter(function (r) { return !r.go && r.i >= N; });
        var hits = tg.filter(function (r) { return r.got === 'match'; }).length;
        var fa = nt.filter(function (r) { return r.got === 'match'; }).length;
        var hitRate = tg.length ? hits / tg.length : 0;
        var faRate = nt.length ? fa / nt.length : 0;
        var rts = rows.filter(function (r) { return r.go && r.rt != null; }).map(function (r) { return r.rt; });
        var score = 100 * U.clamp(0.55 * hitRate + 0.45 * (1 - faRate), 0, 1);
        var res = E.finishTask(ctx, {
          score: score,
          metrics: {
            nLevel: N, hits: hits, targets: tg.length, fa: fa, nonTargets: nt.length,
            hitRate: U.r1(hitRate * 100), faRate: U.r1(faRate * 100),
            rt: U.r0(U.mean(rts)), trials: rows.length
          }
        });
        E.resultScreen(App.stage.clear(), res, function () { ctx.onFinish(res); });
      }
    }
  });

  /* ======================================================================
     7. 方块闪现（Corsi Block-Tapping，含倒序）
     ====================================================================== */
  var CB = [
    { gn: 3, rev: false, on: 650, off: 350, start: 2 }, { gn: 3, rev: false, on: 560, off: 300, start: 3 },
    { gn: 4, rev: false, on: 560, off: 300, start: 3 }, { gn: 4, rev: true, on: 650, off: 350, start: 2 },
    { gn: 4, rev: true, on: 560, off: 300, start: 3 }, { gn: 4, rev: true, on: 480, off: 260, start: 3 }
  ];
  App.tasks.register({
    id: 'corsi', name: '方块闪现', icon: '🟦', domain: 'wm',
    levels: 6, startLevel: 1, up: 86, down: 40, dur: '约 2 分钟',
    why: '记住一串亮过的位置再按顺序复现（高关卡要倒着来）。测的是视觉空间工作记忆的容量。',
    origin: 'Corsi 方块敲击测验，WISC/WMS 等标准化量表里视觉空间广度的经典做法。',
    transfer: '写汉字时"笔画在格子里的位置"、抄黑板时"看一眼记一串"都靠这个。倒序版额外练心里"反着排"的加工能力。',
    levelName: function (l) { var c = CB[l - 1]; return c.gn + '×' + c.gn + (c.rev ? ' 倒序' : ' 顺序'); },
    metricDefs: [{ key: 'maxSpan', name: '最长记住几个', better: 'high' }],
    report: function (r) {
      var m = r.metrics;
      return [['最长记住', m.maxSpan + ' 个'], ['答对', m.correctCount + '/' + m.totalTrials], ['得分', r.score]];
    },
    mount: function (root, ctx) {
      var cfg = CB[ctx.level - 1], total = cfg.gn * cfg.gn;

      E.screen(root, {
        title: '方块闪现 · ' + (cfg.rev ? '倒序' : '顺序'),
        intro: '<p>格子会一个一个地闪蓝光。</p>',
        tips: [
          cfg.rev ? '等它闪完，请<b>倒着点回去</b>（最后闪的先点）。' : '等它闪完，请<b>按闪过的顺序</b>一个个点出来。',
          '答对就加长，答错就退一步，总能回到你能做到的难度。',
          '小技巧：可以在心里<b>把位置连成一条线</b>来记。'
        ],
        btn: '开始', onStart: run
      });

      function run() {
        E.spanTask(App.stage.clear(), {
          startLen: cfg.start, maxLen: total > 9 ? 9 : 7, maxTrials: 400, timeLimitMs: E.TASK_MS,
          gen: function (len) { return U.shuffle(U.range(total)).slice(0, len); },
          present: function (r, seq, done) {
            var pad = U.el('div', 'stagePad');
            pad.appendChild(U.el('div', 'muted', '看好闪的顺序…'));
            var g = gridEl(cfg.gn, 'locked'), blks = [];
            for (var i = 0; i < total; i++) { var b = U.el('div', 'blk'); g.appendChild(b); blks.push(b); }
            pad.appendChild(g); r.appendChild(pad);
            var k = 0;
            E.T(function flash() {
              if (k >= seq.length) { E.T(done, 400); return; }
              var b = blks[seq[k]];
              b.classList.add('on'); App.sound.tick();
              E.T(function () { b.classList.remove('on'); }, cfg.on);
              k++;
              E.T(flash, cfg.on + cfg.off);
            }, 600);
          },
          collect: function (r, seq, done) {
            r.innerHTML = '';
            var ans = [];
            var pad = U.el('div', 'stagePad');
            pad.appendChild(U.el('div', 'muted', cfg.rev ? '请倒着点（共 ' + seq.length + ' 个）' : '请按顺序点（共 ' + seq.length + ' 个）'));
            var cnt = U.el('div', 'pill', '0 / ' + seq.length);
            pad.appendChild(cnt);
            var g = gridEl(cfg.gn), blks = [];
            for (var i = 0; i < total; i++) {
              (function (i) {
                var b = U.el('div', 'blk');
                b.addEventListener('click', function () {
                  if (ans.length >= seq.length) return;
                  ans.push(i); b.classList.add('pick'); App.sound.tick();
                  b.textContent = String(ans.length);
                  cnt.textContent = ans.length + ' / ' + seq.length;
                  if (ans.length === seq.length) E.T(function () { done(ans); }, 350);
                });
                g.appendChild(b); blks.push(b);
              })(i);
            }
            pad.appendChild(g);
            var undo = U.el('button', 'btn small', '撤销上一个');
            undo.addEventListener('click', function () {
              var last = ans.pop();
              if (last != null) { blks[last].classList.remove('pick'); blks[last].textContent = ''; cnt.textContent = ans.length + ' / ' + seq.length; }
            });
            pad.appendChild(undo);
            r.appendChild(pad);
          },
          equal: function (seq, ans) {
            var want = cfg.rev ? seq.slice().reverse() : seq;
            return want.length === ans.length && want.every(function (v, i) { return v === ans[i]; });
          },
          onDone: function (d) {
            var exp = cfg.rev ? 3.2 : 4.5;
            var score = U.clamp(100 * (d.maxSpan - exp + 1.6) / 3.2, 0, 100);
            var res = E.finishTask(ctx, {
              score: score,
              metrics: {
                maxSpan: d.maxSpan, correctCount: d.correctCount, totalTrials: d.totalTrials,
                reverse: cfg.rev ? 1 : 0, gridN: cfg.gn
              }
            });
            E.resultScreen(App.stage.clear(), res, function () { ctx.onFinish(res); });
          }
        });
      }
    }
  });

  /* ======================================================================
     8. 听数字（听觉工作记忆广度，正序/倒序）
     ====================================================================== */
  var DS = [
    { rev: false, start: 3, gap: 1100 }, { rev: false, start: 4, gap: 1000 }, { rev: false, start: 4, gap: 850 },
    { rev: true, start: 2, gap: 1100 }, { rev: true, start: 3, gap: 1000 }, { rev: true, start: 3, gap: 850 }
  ];
  App.tasks.register({
    id: 'digitspan', name: '听数字', icon: '👂', domain: 'wm',
    levels: 6, startLevel: 1, up: 86, down: 40, dur: '约 2 分钟',
    why: '只靠耳朵接收一串数字再复述（高关卡要倒着说）。这是听觉工作记忆，和听写几乎是同一条通路。',
    origin: '数字广度测验（Digit Span，正序/倒序），WISC 智力量表工作记忆指数的核心分测验。',
    transfer: '这是最接近听写的一项。孩子听写丢字，往往不是不会写，而是<b>没端住</b>老师读的那句话。练的时候明确教"分组记"：7-2-5-9 记成"72-59"。',
    levelName: function (l) { return (DS[l - 1].rev ? '倒序' : '正序') + ' · 起始 ' + DS[l - 1].start + ' 位'; },
    metricDefs: [{ key: 'maxSpan', name: '最长记住几位', better: 'high' }],
    report: function (r) {
      var m = r.metrics;
      return [['最长记住', m.maxSpan + ' 位'], ['答对', m.correctCount + '/' + m.totalTrials],
      [m.reverse ? '模式' : '模式', m.reverse ? '倒序' : '正序'], ['得分', r.score]];
    },
    mount: function (root, ctx) {
      var cfg = DS[ctx.level - 1];
      var canSpeak = App.speech.available() && App.store.settings().speech;

      E.screen(root, {
        title: '听数字 · ' + (cfg.rev ? '倒序' : '正序'),
        intro: canSpeak
          ? '<p>电脑会<b>念</b>一串数字，念完后请用数字键盘打出来。</p>'
          : '<p><b>（本机没有中文语音，改为屏幕一个一个闪数字）</b>请看完后用键盘打出来。</p>',
        tips: [
          cfg.rev ? '请<b>倒着</b>打：听到 3-7-2，就打 2-7-3。' : '请<b>按原顺序</b>打出来。',
          '只听一遍，所以要<b>一边听一边在心里默念</b>。',
          '小技巧：两个两个一组记，比一个一个记能多记两位。',
          '答对就加长，答错就退一步，总能回到你能做到的难度。'
        ],
        btn: '开始', onStart: run
      });

      function run() {
        E.spanTask(App.stage.clear(), {
          startLen: cfg.start, maxLen: 9, maxTrials: 400, timeLimitMs: E.TASK_MS,
          gen: function (len) {
            var s = [], last = -1, d;
            for (var i = 0; i < len; i++) { do { d = 1 + U.rnd(9); } while (d === last); s.push(d); last = d; }
            return s;
          },
          present: function (r, seq, done) {
            var pad = U.el('div', 'stagePad');
            pad.appendChild(U.el('div', 'muted', canSpeak ? '仔细听…' : '看好…'));
            var show = U.el('div', 'stimBig', '🎧');
            pad.appendChild(show);
            pad.appendChild(U.el('div', 'pill n', '共 ' + seq.length + ' 位'));
            r.appendChild(pad);
            if (canSpeak) {
              App.speech.sayList(seq.map(App.numToCN), cfg.gap - 500,
                function () { show.textContent = '🎧'; E.T(done, 350); },
                function (item) { show.textContent = '●'; E.T(function () { show.textContent = '🎧'; }, 300); });
            } else {
              var k = 0;
              E.T(function flash() {
                if (k >= seq.length) { show.textContent = '…'; E.T(done, 350); return; }
                show.textContent = String(seq[k]); App.sound.tick();
                E.T(function () { show.textContent = ''; }, cfg.gap * 0.55);
                k++; E.T(flash, cfg.gap);
              }, 500);
            }
          },
          collect: function (r, seq, done) {
            r.innerHTML = '';
            var ans = [];
            var pad = U.el('div', 'stagePad');
            pad.appendChild(U.el('div', 'muted', cfg.rev ? '倒着打出来（' + seq.length + ' 位）' : '按顺序打出来（' + seq.length + ' 位）'));
            var box = U.el('div', 'answerBox', '');
            pad.appendChild(box);
            var np = U.el('div', 'numpad');
            [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach(function (d) {
              var b = U.el('button', null, String(d));
              b.addEventListener('click', function () { add(d); });
              np.appendChild(b);
            });
            var bk = U.el('button', null, '⌫'); bk.addEventListener('click', back); np.appendChild(bk);
            var zero = U.el('button', null, '清空'); zero.style.fontSize = '15px';
            zero.addEventListener('click', function () { ans = []; render(); }); np.appendChild(zero);
            var ok = U.el('button', null, '确定'); ok.style.fontSize = '15px';
            ok.addEventListener('click', submit); np.appendChild(ok);
            pad.appendChild(np);
            r.appendChild(pad);

            function render() { box.textContent = ans.join(' '); }
            function add(d) { if (ans.length >= seq.length) return; ans.push(d); App.sound.tick(); render(); if (ans.length === seq.length) E.T(submit, 450); }
            function back() { ans.pop(); render(); }
            var sent = false;
            function submit() { if (sent) return; sent = true; document.removeEventListener('keydown', key); done(ans); }
            function key(e) {
              if (/^[1-9]$/.test(e.key)) { e.preventDefault(); add(+e.key); }
              else if (e.key === 'Backspace') { e.preventDefault(); back(); }
              else if (e.key === 'Enter') { e.preventDefault(); submit(); }
            }
            document.addEventListener('keydown', key);
          },
          equal: function (seq, ans) {
            var want = cfg.rev ? seq.slice().reverse() : seq;
            return want.length === ans.length && want.every(function (v, i) { return v === ans[i]; });
          },
          onDone: function (d) {
            var exp = cfg.rev ? 3.0 : 4.5;
            var score = U.clamp(100 * (d.maxSpan - exp + 1.6) / 3.2, 0, 100);
            var res = E.finishTask(ctx, {
              score: score,
              metrics: {
                maxSpan: d.maxSpan, correctCount: d.correctCount, totalTrials: d.totalTrials,
                reverse: cfg.rev ? 1 : 0, modality: canSpeak ? 'auditory' : 'visual'
              }
            });
            E.resultScreen(App.stage.clear(), res, function () { ctx.onFinish(res); });
          }
        });
      }
    }
  });

  /* ======================================================================
     9. 汉字闪记（正字法工作记忆）
     ====================================================================== */
  var HF = [
    { exp: 2600, extra: 4 }, { exp: 2100, extra: 5 }, { exp: 1700, extra: 6 },
    { exp: 1400, extra: 7 }, { exp: 1100, extra: 8 }, { exp: 900, extra: 9 }
  ];
  App.tasks.register({
    id: 'hanzi', name: '汉字闪记', icon: '汉', domain: 'wm',
    levels: 6, startLevel: 1, up: 86, down: 40, dur: '约 2 分钟',
    why: '几个汉字只闪一两秒，然后要从一堆形近字里按顺序找回来。练的是字形的瞬时记忆与辨别。',
    origin: '基于正字法工作记忆（orthographic working memory）范式，针对中文书写的改编版。',
    transfer: '这是最贴近"看一眼就能照着写下来"的能力。孩子抄写要一笔一笔对照，往往就是字形记忆容量太小。',
    levelName: function (l) { return '闪 ' + (HF[l - 1].exp / 1000).toFixed(1) + 's · 干扰 ' + HF[l - 1].extra + ' 个'; },
    metricDefs: [{ key: 'maxSpan', name: '最长记住几个字', better: 'high' }],
    report: function (r) {
      var m = r.metrics;
      return [['最长记住', m.maxSpan + ' 个字'], ['答对', m.correctCount + '/' + m.totalTrials], ['得分', r.score]];
    },
    mount: function (root, ctx) {
      var cfg = HF[ctx.level - 1];
      var POOL = App.HZ.filter(function (c, i) { return App.HZ.indexOf(c) === i; });

      E.screen(root, {
        title: '汉字闪记',
        intro: '<p>几个汉字会闪一下就消失（约 ' + (cfg.exp / 1000).toFixed(1) + ' 秒）。</p>',
        tips: [
          '消失后，请从下面的字里<b>按原来的顺序</b>把它们点出来。',
          '底下会混进<b>长得很像的字</b>，要看清偏旁再点。',
          '小技巧：可以把几个字<b>连成一句话</b>来记，比死记好用。',
          '答对就加长，答错就退一步，总能回到你能做到的难度。'
        ],
        btn: '开始', onStart: run
      });

      function distractorsFor(targets) {
        var out = [];
        targets.forEach(function (ch) {
          var grp = App.CONFUSE.filter(function (g) { return g.indexOf(ch) >= 0; })[0];
          if (grp) grp.forEach(function (c) { if (c !== ch && targets.indexOf(c) < 0 && out.indexOf(c) < 0) out.push(c); });
        });
        out = U.shuffle(out).slice(0, cfg.extra);
        while (out.length < cfg.extra) {
          var c = U.pick(POOL);
          if (targets.indexOf(c) < 0 && out.indexOf(c) < 0) out.push(c);
        }
        return out;
      }

      function run() {
        E.spanTask(App.stage.clear(), {
          startLen: 2, maxLen: 6, maxTrials: 400, timeLimitMs: E.TASK_MS,
          gen: function (len) {
            var s = [];
            while (s.length < len) { var c = U.pick(POOL); if (s.indexOf(c) < 0) s.push(c); }
            return s;
          },
          present: function (r, seq, done) {
            var pad = U.el('div', 'stagePad');
            var tip = U.el('div', 'muted', '看好…');
            var row = U.el('div', 'hzFlash');
            pad.appendChild(tip); pad.appendChild(row); r.appendChild(pad);
            E.T(function () {
              seq.forEach(function (c) { row.appendChild(U.el('span', null, c)); });
              App.sound.tick();
              E.T(function () { row.innerHTML = ''; tip.textContent = '记住了吗？'; E.T(done, 400); }, cfg.exp);
            }, 600);
          },
          collect: function (r, seq, done) {
            r.innerHTML = '';
            var ans = [], pool = U.shuffle(seq.concat(distractorsFor(seq)));
            var pad = U.el('div', 'stagePad');
            pad.appendChild(U.el('div', 'muted', '按原来的顺序点出 ' + seq.length + ' 个字'));
            var picked = U.el('div', 'hzPicked', '');
            pad.appendChild(picked);
            var pl = U.el('div', 'hzPool');
            pool.forEach(function (c) {
              var b = U.el('button', null, c);
              b.addEventListener('click', function () {
                if (b.classList.contains('used') || ans.length >= seq.length) return;
                b.classList.add('used'); ans.push(c); App.sound.tick();
                picked.textContent = ans.join('');
                if (ans.length === seq.length) E.T(function () { done(ans); }, 400);
              });
              pl.appendChild(b);
            });
            pad.appendChild(pl);
            var undo = U.el('button', 'btn small', '撤销上一个');
            undo.addEventListener('click', function () {
              var last = ans.pop();
              if (last == null) return;
              picked.textContent = ans.join('');
              U.$$('button', pl).some(function (b) {
                if (b.textContent === last && b.classList.contains('used')) { b.classList.remove('used'); return true; }
                return false;
              });
            });
            pad.appendChild(undo);
            r.appendChild(pad);
          },
          equal: function (seq, ans) {
            return seq.length === ans.length && seq.every(function (v, i) { return v === ans[i]; });
          },
          onDone: function (d) {
            var score = U.clamp(100 * (d.maxSpan - 3.4 + 1.6) / 3.2, 0, 100);
            var res = E.finishTask(ctx, {
              score: score,
              metrics: { maxSpan: d.maxSpan, correctCount: d.correctCount, totalTrials: d.totalTrials }
            });
            E.resultScreen(App.stage.clear(), res, function () { ctx.onFinish(res); });
          }
        });
      }
    }
  });

  /* ======================================================================
     10. 听指令（听觉工作记忆 + 多步执行）
     ====================================================================== */
  var LI = [
    { steps: 2, shapes: 4, replay: 2 }, { steps: 2, shapes: 6, replay: 2 }, { steps: 3, shapes: 6, replay: 1 },
    { steps: 3, shapes: 9, replay: 1 }, { steps: 4, shapes: 9, replay: 1 }, { steps: 5, shapes: 9, replay: 0 }
  ];
  App.tasks.register({
    id: 'listen', name: '听指令', icon: '🗣️', domain: 'wm',
    levels: 6, startLevel: 1, up: 86, down: 40, dur: '约 2 分钟',
    why: '听一句含好几步的话，记住全部内容再按顺序执行。这是课堂上"老师说一遍就要做到"的能力。',
    origin: '参考 Token Test / 听觉理解与多步指令执行范式，也是工作记忆训练中迁移性较好的一类。',
    transfer: '"要听几遍才动"是很有用的指标。如果重听次数一直很多，在家交代事情就要主动拆成一步一句，并让孩子复述一遍。',
    levelName: function (l) { return LI[l - 1].steps + ' 步 · ' + LI[l - 1].shapes + ' 个图形'; },
    metricDefs: [
      { key: 'acc', name: '完全做对率(%)', better: 'high' },
      { key: 'replays', name: '重听次数', better: 'low' }
    ],
    report: function (r) {
      var m = r.metrics;
      return [['完全做对', m.correct + '/' + m.trials], ['步骤正确率', m.stepAcc + '%'], ['重听', m.replays + ' 次'], ['得分', r.score]];
    },
    mount: function (root, ctx) {
      var cfg = LI[ctx.level - 1], MAX_TRIALS = 40, startedAt = 0;
      var canSpeak = App.speech.available() && App.store.settings().speech;
      var items = [];  // 屏上的图形
      (function build() {
        var combos = [];
        App.SHAPES.forEach(function (s) { App.COLORS.forEach(function (c) { combos.push({ s: s, c: c }); }); });
        items = U.shuffle(combos).slice(0, cfg.shapes);
      })();

      var trialNo = 0, results = [], replays = 0;

      E.screen(root, {
        title: '听指令',
        intro: canSpeak
          ? '<p>电脑会说一句话，比如「先点红色的圆形，再点蓝色的三角形」。</p>'
          : '<p><b>（本机没有中文语音，改为文字显示几秒后消失）</b></p>',
        tips: [
          '听完以后，<b>按它说的顺序</b>把图形点出来。',
          '一共做 <b>2 分钟</b>，能做几句做几句。每句 ' + cfg.steps + ' 步。',
          cfg.replay > 0 ? '每句可以<b>重听 ' + cfg.replay + ' 次</b>，但重听会记录下来。' : '这一关<b>不能重听</b>，要一次记住。',
          '小技巧：听的时候在心里<b>小声跟着念一遍</b>。'
        ],
        btn: '开始', onStart: function () { startedAt = performance.now(); runTrial(); }
      });

      function runTrial() {
        if (trialNo >= MAX_TRIALS) return finish();
        if (trialNo > 0 && performance.now() - startedAt >= E.TASK_MS) return finish();
        trialNo++;
        App.stage.setProgress(Math.min(1, (performance.now() - startedAt) / E.TASK_MS), '第 ' + trialNo + ' 句 · ' + E.leftText(E.TASK_MS, startedAt));
        var seq = U.shuffle(items).slice(0, cfg.steps);
        var words = ['先点', '再点', '然后点', '接着点', '最后点'];
        var sentence = seq.map(function (it, i) {
          return (words[Math.min(i, words.length - 1)]) + it.c.name + '的' + it.s.name;
        }).join('，') + '。';

        var r = App.stage.clear();
        var pad = U.el('div', 'stagePad');
        var tip = U.el('div', 'pill y', canSpeak ? '🔊 仔细听…' : '📖 看好…');
        pad.appendChild(tip);
        var textBox = U.el('div', null, '');
        textBox.style.minHeight = '34px'; textBox.style.fontSize = '18px'; textBox.style.fontWeight = '600';
        pad.appendChild(textBox);

        var area = U.el('div', 'shapeArea');
        var picked = [], locked = true, used = 0;
        var cells = items.map(function (it) {
          var d = U.html('div', 'shp', App.shapeSVG(it.s, it.c.hex, 80));
          d.addEventListener('click', function () {
            if (locked || picked.length >= cfg.steps) return;
            picked.push(it); d.classList.add('hit'); App.sound.tick();
            E.T(function () { d.classList.remove('hit'); }, 320);
            if (picked.length === cfg.steps) { locked = true; E.T(judge, 400); }
          });
          area.appendChild(d);
          return d;
        });
        pad.appendChild(area);

        var bar = U.el('div', 'flexline');
        var again = U.el('button', 'btn small', '再听一次 (' + (cfg.replay - used) + ')');
        again.addEventListener('click', function () {
          if (used >= cfg.replay) return;
          used++; replays++; again.textContent = '再听一次 (' + (cfg.replay - used) + ')';
          if (used >= cfg.replay) again.disabled = true;
          speak();
        });
        if (cfg.replay > 0) bar.appendChild(again);
        var undo = U.el('button', 'btn small', '撤销上一个');
        undo.addEventListener('click', function () { picked.pop(); });
        bar.appendChild(undo);
        pad.appendChild(bar);
        r.appendChild(pad);

        function speak() {
          locked = true;
          tip.textContent = canSpeak ? '🔊 仔细听…' : '📖 看好…';
          if (canSpeak) {
            /* 一步一句地念，句与句之间留半秒，比一口气念整句清楚得多 */
            var parts = sentence.replace(/。$/, '').split('，');
            var rate = Math.min(App.store.settings().speechRate || 0.8, 0.7);
            App.speech.sayList(parts, 520, function () { tip.textContent = '👆 按顺序点出来'; locked = false; }, null, rate);
          } else {
            textBox.textContent = sentence;
            E.T(function () { textBox.textContent = ''; tip.textContent = '👆 按顺序点出来'; locked = false; }, 1500 + cfg.steps * 1500);
          }
        }
        E.T(speak, 500);

        function judge() {
          var stepOk = 0;
          for (var i = 0; i < seq.length; i++) {
            if (picked[i] && picked[i].s.key === seq[i].s.key && picked[i].c.key === seq[i].c.key) stepOk++;
          }
          var all = stepOk === seq.length;
          results.push({ steps: seq.length, stepOk: stepOk, correct: all });
          if (all) App.sound.ok(); else App.sound.bad();
          var r2 = App.stage.clear();
          var p2 = U.el('div', 'stagePad');
          p2.appendChild(U.el('div', 'stimBig', all ? '✓' : '✗'));
          p2.appendChild(U.el('div', all ? 'pill g' : 'pill y',
            all ? '全对！' : '对了 ' + stepOk + ' / ' + seq.length + ' 步'));
          if (!all) p2.appendChild(U.html('div', 'small muted', '正确答案：' + sentence));
          r2.appendChild(p2);
          E.T(runTrial, all ? 900 : 2100);
        }
      }

      function finish() {
        var correct = results.filter(function (r) { return r.correct; }).length;
        var stepTotal = results.reduce(function (a, r) { return a + r.steps; }, 0);
        var stepOk = results.reduce(function (a, r) { return a + r.stepOk; }, 0);
        var acc = results.length ? correct / results.length : 0;
        var stepAcc = stepTotal ? stepOk / stepTotal : 0;
        var score = U.clamp(100 * (0.6 * acc + 0.4 * stepAcc) - replays * 3, 0, 100);
        var res = E.finishTask(ctx, {
          score: score,
          metrics: {
            correct: correct, trials: results.length, acc: U.r1(acc * 100),
            stepAcc: U.r1(stepAcc * 100), replays: replays, steps: cfg.steps,
            modality: canSpeak ? 'auditory' : 'visual'
          }
        });
        E.resultScreen(App.stage.clear(), res, function () { ctx.onFinish(res); });
      }
    }
  });

  /* ======================================================================
     11. 连点测验（Trail Making Test A / B）
     ====================================================================== */
  var TM = [
    { type: 'A', n: 10 }, { type: 'A', n: 15 }, { type: 'A', n: 20 },
    { type: 'B', n: 10 }, { type: 'B', n: 16 }, { type: 'B', n: 20 }
  ];
  App.tasks.register({
    id: 'trails', name: '连点测验', icon: '🔗', domain: 'flex',
    levels: 6, startLevel: 1, up: 86, down: 42, dur: '约 2 分钟',
    why: 'A 关只按数字连；B 关要在"数字"和"汉字数字"两套规则之间来回切换。练的是注意转移与认知灵活性。',
    origin: 'Trail Making Test（连线测验 A/B），神经心理评估中测执行功能与加工速度的标准工具。',
    transfer: '切换能力弱 → 换科目、换题型就卡住，"一直停在上一题"。B 关的用时减 A 关用时，就是纯切换成本。',
    levelName: function (l) { return TM[l - 1].type + ' 型 · ' + TM[l - 1].n + ' 个点 · 2 分钟'; },
    metricDefs: [
      { key: 'secPerItem', name: '每点用时(秒)', better: 'low' },
      { key: 'timeSec', name: '总用时(秒)', better: 'low' },
      { key: 'errors', name: '点错次数', better: 'low' }
    ],
    report: function (r) {
      var m = r.metrics;
      return [['总用时', U.sec(m.timeSec)], ['每点用时', U.sec(m.secPerItem)], ['点错', m.errors + ' 次'], ['得分', r.score]];
    },
    mount: function (root, ctx) {
      var cfg = TM[ctx.level - 1];
      var labels = [];
      if (cfg.type === 'A') labels = U.range(cfg.n, 1).map(String);
      else {
        for (var i = 0; i < cfg.n; i++) {
          labels.push(i % 2 === 0 ? String(i / 2 + 1) : App.CN_SEQ[(i - 1) / 2]);
        }
      }
      var LIMIT = E.TASK_MS, startedAt = 0;
      var allSec = 0, itemsTotal = 0, errors = 0, rounds = 0, finished = false;

      E.screen(root, {
        title: '连点测验 · ' + cfg.type + ' 型',
        intro: cfg.type === 'A'
          ? '<p>圆圈里是 <b>1 到 ' + cfg.n + '</b>，请<b>按数字从小到大</b>一个一个点。</p>'
          : '<p>圆圈里有<b>阿拉伯数字</b>和<b>汉字数字</b>，要<b>交替着点</b>：</p>',
        tips: cfg.type === 'A'
          ? ['点错会抖一下，但要继续找对的那个。', '要快，也要准。', '一共做 <b>2 分钟</b>，点完一张会马上出下一张。']
          : ['顺序是：<b>1 → 一 → 2 → 二 → 3 → 三 →</b> …一直到 ' + (cfg.n / 2),
            '也就是<b>数字和汉字轮着来</b>，每次都要在两套顺序之间切换。',
            '点错会抖一下，继续找对的那个。',
            '一共做 <b>2 分钟</b>，点完一张会马上出下一张。'],
        btn: '开始', onStart: function () { startedAt = performance.now(); run(); }
      });

      function run() {
        if (finished) return;
        if (rounds > 0 && performance.now() - startedAt >= LIMIT) return finish();
        // 时间到立刻收尾（哪怕这一张还没点完）
        E.T(function () { if (!finished) { finished = true; finish(); } },
          Math.max(300, LIMIT - (performance.now() - startedAt)));
        var r = App.stage.clear();
        var pad = U.el('div', 'stagePad');
        var bar = U.el('div', 'flexline');
        var nextLbl = U.el('div', 'pill', '下一个：' + labels[0]);
        var timeLbl = U.el('span', 'muted small', '0.0s');
        bar.appendChild(nextLbl); bar.appendChild(timeLbl);
        pad.appendChild(bar);

        var area = U.el('div', 'trailArea');
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('preserveAspectRatio', 'none');
        area.appendChild(svg);

        // 随机布点，保持最小间距
        var pts = [], tries = 0;
        while (pts.length < labels.length && tries < 6000) {
          tries++;
          var p = { x: 7 + Math.random() * 86, y: 7 + Math.random() * 86 };
          var okp = pts.every(function (q) {
            return Math.hypot(q.x - p.x, q.y - p.y) > (labels.length > 16 ? 15 : 19);
          });
          if (okp) pts.push(p);
        }
        while (pts.length < labels.length) pts.push({ x: 7 + Math.random() * 86, y: 7 + Math.random() * 86 });

        var idx = 0, t0 = null, tid = null;
        var dots = labels.map(function (lab, i) {
          var d = U.el('div', 'dot', lab);
          d.style.left = pts[i].x + '%'; d.style.top = pts[i].y + '%';
          d.addEventListener('click', function () {
            if (t0 === null) { t0 = performance.now(); tick(); }
            if (i === idx) {
              d.classList.add('hit'); App.sound.tick();
              if (idx > 0) line(pts[idx - 1], pts[idx]);
              idx++;
              App.stage.setProgress((performance.now() - startedAt) / LIMIT, E.leftText(LIMIT, startedAt));
              nextLbl.textContent = idx < labels.length ? '下一个：' + labels[idx] : '完成！';
              if (idx >= labels.length) done();
            } else {
              errors++; d.classList.add('bad'); App.sound.bad();
              E.T(function () { d.classList.remove('bad'); }, 340);
            }
          });
          area.appendChild(d);
          return d;
        });
        pad.appendChild(area);
        r.appendChild(pad);

        function line(a, b) {
          var l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          l.setAttribute('x1', a.x); l.setAttribute('y1', a.y);
          l.setAttribute('x2', b.x); l.setAttribute('y2', b.y);
          l.setAttribute('stroke', '#3f9b6d'); l.setAttribute('stroke-width', '0.6');
          l.setAttribute('vector-effect', 'non-scaling-stroke');
          svg.appendChild(l);
        }
        function tick() {
          timeLbl.textContent = ((performance.now() - t0) / 1000).toFixed(1) + 's';
          App.stage.setProgress((performance.now() - startedAt) / LIMIT, E.leftText(LIMIT, startedAt));
          tid = E.T(tick, 100);
        }
        function done() {
          clearTimeout(tid);
          var sec = (performance.now() - t0) / 1000;
          allSec += sec;
          itemsTotal += labels.length;
          rounds++;
          App.sound.ok();
          if (finished) return;
          if (performance.now() - startedAt < LIMIT - 2500) E.T(run, 600);
          else E.T(function () { if (!finished) { finished = true; finish(); } }, 400);
        }
      }

      function finish() {
        if (!itemsTotal) { itemsTotal = labels.length; allSec = LIMIT / 1000; }
        var spi = allSec / Math.max(1, itemsTotal);
        var target = cfg.type === 'A' ? 1.1 : 2.2, worst = cfg.type === 'A' ? 3.2 : 5.5;
        var score = E.speedScore(spi, target, worst) - errors * 4;
        var res = E.finishTask(ctx, {
          score: U.clamp(score, 0, 100),
          metrics: {
            timeSec: U.r1(allSec), secPerItem: Math.round(spi * 100) / 100,
            errors: errors, items: itemsTotal, rounds: rounds, trailType: cfg.type
          }
        });
        E.resultScreen(App.stage.clear(), res, function () { ctx.onFinish(res); });
      }
    }
  });
})();
