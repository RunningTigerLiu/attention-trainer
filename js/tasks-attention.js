/* tasks-attention.js — 注意力/抑制类任务：舒尔特方格、划消找字、红绿灯(Go/No-Go)、
   树叶方向(Flanker)、颜色字(Stroop) */
(function () {
  'use strict';
  var App = window.App, U = App.util, E = App.engine;

  /* ======================================================================
     1. 舒尔特方格（Schulte Table）
     ====================================================================== */
  var SCH = [
    { n: 3, rev: false }, { n: 4, rev: false }, { n: 4, rev: true },
    { n: 5, rev: false }, { n: 5, rev: true }, { n: 6, rev: false }
  ];
  App.tasks.register({
    id: 'schulte', name: '舒尔特方格', icon: '🔢', domain: 'selective',
    levels: 6, startLevel: 1, up: 85, down: 40, dur: '约 2 分钟',
    why: '训练视觉搜索范围和注视点转移速度，是"扫视 → 锁定目标"这条通路的基础练习。',
    origin: '源自德国 Schulte 方格表，国内外注意力评估与训练中最常用的视觉搜索工具。',
    transfer: '做题漏字、抄题抄错行，常常是视觉搜索太慢。练完可以让孩子用同样的"一行一行扫"的方法检查作业。',
    levelName: function (l) { var c = SCH[l - 1]; return c.n + '×' + c.n + (c.rev ? ' 倒序' : ' 顺序') + ' · 2 分钟'; },
    metricDefs: [
      { key: 'secPerCell', name: '每格用时(秒)', better: 'low' },
      { key: 'timeSec', name: '单格用时合计(秒)', better: 'low' },
      { key: 'errors', name: '点错次数', better: 'low' }
    ],
    report: function (r) {
      var m = r.metrics;
      return [['平均用时', U.sec(m.timeSec)], ['每格用时', U.sec(m.secPerCell)], ['点错', m.errors + ' 次']];
    },
    mount: function (root, ctx) {
      var cfg = SCH[ctx.level - 1], total = cfg.n * cfg.n;
      var LIMIT = E.TASK_MS, gi = 0, times = [], errors = 0, startedAt = null, finished = false;

      E.screen(root, {
        title: '舒尔特方格 · ' + cfg.n + '×' + cfg.n + (cfg.rev ? '（倒序）' : '（顺序）'),
        intro: '<p>格子里有 <b>1 到 ' + total + '</b>，位置是乱的。</p>',
        tips: [
          cfg.rev ? '请从 <b>' + total + ' 倒着点到 1</b>。' : '请从 <b>1 顺着点到 ' + total + '</b>。',
          '眼睛尽量不要乱飘，<b>一行一行地扫</b>，找到就点。',
          '点错不会扣命，但会计次数，所以<b>看准再点</b>。',
          '一共做 <b>2 分钟</b>，时间到自动结束，能做几张做几张。'
        ],
        btn: '开始', onStart: runGrid
      });

      function runGrid() {
        if (finished) return;
        if (startedAt === null) startedAt = performance.now();
        var r = App.stage.clear();
        // 时间到就立刻收尾（哪怕当前这张表还没点完）
        E.T(function () { if (!finished) { finished = true; finish(); } },
          Math.max(200, LIMIT - (performance.now() - startedAt)));
        var nums = U.shuffle(U.range(total, 1));
        var expect = cfg.rev ? total : 1;
        var t0 = null;

        var pad = U.el('div', 'stagePad');
        var info = U.el('div', 'flexline');
        var nextLbl = U.el('div', 'pill', '下一个：' + expect);
        info.appendChild(U.el('span', 'muted small', '第 ' + (gi + 1) + ' 张'));
        info.appendChild(nextLbl);
        var timeLbl = U.el('span', 'muted small', '0.0s');
        info.appendChild(timeLbl);
        pad.appendChild(info);

        var g = U.el('div', 'sgrid');
        g.style.gridTemplateColumns = 'repeat(' + cfg.n + ',1fr)';
        g.style.width = 'min(92vw, ' + (cfg.n * 76) + 'px)';
        nums.forEach(function (v) {
          var b = U.el('button', null, String(v));
          b.addEventListener('click', function () {
            if (t0 === null) { t0 = performance.now(); tick(); }
            if (v === expect) {
              b.classList.add('hit'); b.disabled = true;
              App.sound.tick();
              expect += cfg.rev ? -1 : 1;
              nextLbl.textContent = '下一个：' + ((cfg.rev && expect < 1) || (!cfg.rev && expect > total) ? '完成' : expect);
              if ((cfg.rev && expect < 1) || (!cfg.rev && expect > total)) done();
            } else {
              errors++; b.classList.add('shake'); App.sound.bad();
              E.T(function () { b.classList.remove('shake'); }, 340);
            }
          });
          g.appendChild(b);
        });
        pad.appendChild(g);
        r.appendChild(pad);
        App.stage.setProgress((performance.now() - startedAt) / LIMIT, E.leftText(LIMIT, startedAt));

        var tid = null;
        function tick() {
          timeLbl.textContent = ((performance.now() - t0) / 1000).toFixed(1) + 's';
          if (startedAt !== null) App.stage.setProgress((performance.now() - startedAt) / LIMIT, E.leftText(LIMIT, startedAt));
          tid = E.T(tick, 100);
        }
        function done() {
          clearTimeout(tid);
          times.push((performance.now() - t0) / 1000);
          App.sound.ok();
          gi++;
          if (finished) return;
          if (performance.now() - startedAt < LIMIT - 2500) E.T(runGrid, 700);
          else E.T(function () { if (!finished) { finished = true; finish(); } }, 500);
        }
      }

      function finish() {
        if (!times.length) times.push(LIMIT / 1000);   // 一张都没点完时兜底
        var avg = U.mean(times), spc = avg / total;
        // 二年级参考：0.9s/格 ≈ 很好，2.6s/格 ≈ 偏慢
        var score = E.speedScore(spc, 0.9, 2.6) - errors * 4;
        var res = E.finishTask(ctx, {
          score: U.clamp(score, 0, 100),
          metrics: {
            timeSec: U.r1(avg), secPerCell: Math.round(spc * 100) / 100,
            errors: errors, cells: total, times: times.map(function (t) { return U.r1(t); })
          }
        });
        E.resultScreen(App.stage.clear(), res, function () { ctx.onFinish(res); });
      }
    }
  });

  /* ======================================================================
     2. 划消找字（字母/符号划消测验的汉字版，近似 d2 注意力测验）
     ====================================================================== */
  var CAN = [
    { cols: 7, rows: 6, sec: 50 }, { cols: 8, rows: 7, sec: 60 }, { cols: 9, rows: 8, sec: 70 },
    { cols: 10, rows: 8, sec: 80 }, { cols: 11, rows: 9, sec: 90 }, { cols: 12, rows: 10, sec: 100 }
  ];
  App.tasks.register({
    id: 'cancel', name: '划消找字', icon: '🔍', domain: 'sustained',
    levels: 6, startLevel: 2, up: 88, down: 45, dur: '约 2 分钟',
    why: '在限定时间里持续从形近字中挑出目标字，同时练持续注意、选择性注意和字形辨别。',
    origin: '源自经典划消测验（Letter Cancellation / d2 注意力测验），临床上用来测注意力的持续性与稳定性。',
    transfer: '这里用的全是二年级易混字（清/请/晴/睛、日/曰/目）。练完可以请孩子用同样的办法回头检查听写本上的错字。',
    levelName: function (l) { return CAN[l - 1].cols + '×' + CAN[l - 1].rows + ' · 2 分钟'; },
    metricDefs: [
      { key: 'hitRate', name: '目标找到率', better: 'high' },
      { key: 'commissions', name: '划错(误划)', better: 'low' },
      { key: 'omissions', name: '漏掉', better: 'low' }
    ],
    report: function (r) {
      var m = r.metrics;
      return [['找到', m.hits + '/' + m.targets], ['漏掉', m.omissions + ' 个'], ['划错', m.commissions + ' 个']];
    },
    mount: function (root, ctx) {
      var cfg = CAN[ctx.level - 1], n = cfg.cols * cfg.rows;
      var SEC = Math.round(E.TASK_MS / 1000);
      var group = U.pick(App.CONFUSE);
      var target = group[0], distract = group.slice(1);
      if (ctx.level >= 5) {  // 高关卡再掺一组干扰字
        var g2 = U.pick(App.CONFUSE.filter(function (g) { return g[0] !== target; }));
        distract = distract.concat(g2.slice(0, 2));
      }
      var cells = [], targetsIdx = [];
      var tCount = Math.round(n * 0.25);
      var idx = U.shuffle(U.range(n));
      targetsIdx = idx.slice(0, tCount);
      for (var i = 0; i < n; i++) cells.push(targetsIdx.indexOf(i) >= 0 ? target : U.pick(distract));
      var marked = {};

      E.screen(root, {
        title: '划消找字',
        intro: '<p>下面的格子里混着很多<b>长得很像</b>的字。你的任务是把所有的 <b style="font-size:26px">' + target + '</b> 找出来点一下。</p>',
        tips: [
          '干扰字是：<b style="font-size:20px">' + distract.join(' ') + '</b>',
          '点一下变成蓝色＝已划掉，点错了可以再点一下取消。',
          '限时 <b>' + SEC + ' 秒</b>，从第一行开始<b>按顺序扫</b>，别跳着找。',
          '宁可慢一点，也不要划错。'
        ],
        btn: '开始', onStart: run
      });

      function run() {
        var r = App.stage.clear();
        var pad = U.el('div', 'stagePad');
        var bar = U.el('div', 'flexline');
        var tl = U.el('div', 'pill y', '剩余 ' + SEC + 's');
        var cl = U.el('span', 'muted small', '已划 0 个');
        bar.appendChild(U.html('span', null, '找出所有 <b style="font-size:20px">' + target + '</b>'));
        bar.appendChild(tl); bar.appendChild(cl);
        pad.appendChild(bar);

        var g = U.el('div', 'cgrid');
        g.style.gridTemplateColumns = 'repeat(' + cfg.cols + ',1fr)';
        g.style.width = 'min(96vw, ' + (cfg.cols * 52) + 'px)';
        var btns = cells.map(function (ch, k) {
          var b = U.el('button', null, ch);
          b.addEventListener('click', function () {
            if (marked[k]) { delete marked[k]; b.classList.remove('marked'); }
            else { marked[k] = 1; b.classList.add('marked'); App.sound.tick(); }
            cl.textContent = '已划 ' + Object.keys(marked).length + ' 个';
          });
          g.appendChild(b);
          return b;
        });
        pad.appendChild(g);
        var stop = U.el('button', 'btn', '我划完了');
        stop.addEventListener('click', function () { finish(btns); });
        pad.appendChild(stop);
        r.appendChild(pad);

        var left = SEC, t0 = performance.now();
        (function tick() {
          left = SEC - (performance.now() - t0) / 1000;
          tl.textContent = '剩余 ' + Math.max(0, left).toFixed(0) + 's';
          App.stage.setProgress(1 - left / SEC, '');
          if (left <= 0) { App.sound.beep(440, 0.3); finish(btns); return; }
          E.T(tick, 200);
        })();
        var finished = false;
        function finish(btns) {
          if (finished) return; finished = true;
          E.clearTimers();
          var hits = 0, fa = 0;
          Object.keys(marked).forEach(function (k) {
            if (cells[k] === target) hits++; else { fa++; btns[k].classList.add('showFa'); }
          });
          targetsIdx.forEach(function (k) { if (!marked[k]) btns[k].classList.add('showMiss'); });
          var omissions = tCount - hits;
          var usedSec = Math.min(SEC, (performance.now() - t0) / 1000);
          // 得分：找到率为主，误划重罚，再按用时给一点效率加成
          var hitRate = hits / tCount;
          var base = 100 * hitRate - fa * (100 / tCount) * 1.5;
          var effBonus = hitRate > 0.9 ? U.clamp((SEC - usedSec) / SEC * 12, 0, 12) : 0;
          var res = E.finishTask(ctx, {
            score: U.clamp(base + effBonus, 0, 100),
            metrics: {
              hits: hits, targets: tCount, omissions: omissions, commissions: fa,
              hitRate: U.r1(hitRate * 100), usedSec: U.r1(usedSec), cells: n,
              targetChar: target
            }
          });
          E.T(function () {
            E.resultScreen(App.stage.clear(), res, function () { ctx.onFinish(res); });
          }, 1600);
          U.toast('虚线框=漏掉的，红色=划错的');
        }
      }
    }
  });

  /* ======================================================================
     3. 红绿灯（Go/No-Go，含 SART 式持续注意成分）
     ====================================================================== */
  var GNG = [
    { n: 36, nogo: .25, stim: 700, iti: 1100, dl: 1500 },
    { n: 44, nogo: .27, stim: 620, iti: 1000, dl: 1400 },
    { n: 52, nogo: .30, stim: 550, iti: 900, dl: 1300 },
    { n: 60, nogo: .30, stim: 480, iti: 820, dl: 1200 },
    { n: 70, nogo: .33, stim: 430, iti: 750, dl: 1100 },
    { n: 80, nogo: .35, stim: 380, iti: 680, dl: 1000 }
  ];
  App.tasks.register({
    id: 'gonogo', name: '红绿灯', icon: '🚦', domain: 'inhibit',
    levels: 6, startLevel: 1, up: 88, down: 45, dur: '约 2 分钟',
    why: '绿灯要快按、红灯必须忍住。练的是反应抑制（忍住冲动）和长时间维持警觉。',
    origin: 'Go/No-Go 范式 + SART 持续注意任务，是 ADHD 研究里最核心的两个实验任务。',
    transfer: '"误按红灯"多＝容易冲动、想到就说；"漏按绿灯"多＝走神。两类错误要用不同办法应对（见分析页建议）。',
    levelName: function (l) { return '红灯 ' + Math.round(GNG[l - 1].nogo * 100) + '% · 2 分钟'; },
    metricDefs: [
      { key: 'goAcc', name: '绿灯按对率', better: 'high' },
      { key: 'commissions', name: '误按红灯(冲动)', better: 'low' },
      { key: 'omissions', name: '漏按绿灯(走神)', better: 'low' },
      { key: 'rt', name: '平均反应时(ms)', better: 'low' },
      { key: 'cv', name: '反应时波动(%)', better: 'low' }
    ],
    report: function (r) {
      var m = r.metrics;
      return [['绿灯按对', Math.round(m.goAcc) + '%'], ['误按红灯', m.commissions + ' 次'],
      ['漏按绿灯', m.omissions + ' 次'], ['反应时', U.ms(m.rt)], ['波动', m.cv + '%'], ['得分', r.score]];
    },
    mount: function (root, ctx) {
      var cfg = GNG[ctx.level - 1];
      var recent = [];
      /* 按时间出题：时间到就停，答错不影响题目数量 */
      function makeTrial() {
        var isNo = Math.random() < cfg.nogo;
        if (isNo && recent[recent.length - 1] === 'nogo' && recent[recent.length - 2] === 'nogo') isNo = false;
        var k = isNo ? 'nogo' : 'go';
        recent.push(k);
        if (recent.length > 4) recent.shift();
        return {
          kind: k, go: !isNo, expected: isNo ? null : 'go',
          render: function (box) { box.appendChild(U.el('div', isNo ? 'dotNo' : 'dotGo')); }
        };
      }

      E.screen(root, {
        title: '红绿灯',
        intro: '<p>屏幕上会出现<b style="color:#3f9b6d">绿色圆</b>或<b style="color:#c05a41">红色圆</b>。</p>',
        tips: [
          '看到 <b style="color:#3f9b6d">绿色</b>：<b>马上按</b>下面的大按钮（或按空格键）。',
          '看到 <b style="color:#c05a41">红色</b>：<b>千万别按</b>，手停住。',
          '要又快又准——但<b>宁可慢半拍，也不要按错红灯</b>。',
          '一共做 <b>2 分钟</b>，时间到自动结束。'
        ],
        btn: '开始', onStart: function () {
          E.countdown(App.stage.clear(), function () {
            E.rtTask(App.stage.clear(), {
              trials: [], makeTrial: makeTrial, timeLimitMs: E.TASK_MS,
              stimMs: cfg.stim, itiMs: cfg.iti, deadlineMs: cfg.dl,
              feedback: App.store.settings().feedback ? 'errors' : false,
              buttons: [{ key: 'go', label: '按！', cls: 'wide' }],
              keymap: { ' ': 'go', 'Enter': 'go' },
              onDone: finish
            });
          });
        }
      });

      function finish(rows) {
        var m = E.rtMetrics(rows);
        var goAcc = m.goAcc || 0, inhib = m.inhibAcc == null ? 1 : m.inhibAcc;
        var speed = E.speedScore(m.rt, 380, 900) / 100;
        var steady = E.steadyScore(m.cvRaw) / 100;
        var score = 100 * (0.28 * goAcc + 0.37 * inhib + 0.20 * steady + 0.15 * speed);
        var res = E.finishTask(ctx, {
          score: score,
          metrics: {
            goAcc: U.r1(goAcc * 100), inhibAcc: U.r1(inhib * 100),
            commissions: m.commissions, omissions: m.omissions,
            rt: m.rt, rtSD: m.rtSD, cv: m.cv, acc: U.r1((m.acc || 0) * 100),
            trials: m.total
          }
        });
        E.resultScreen(App.stage.clear(), res, function () { ctx.onFinish(res); });
      }
    }
  });

  /* ======================================================================
     4. 树叶方向（Eriksen Flanker 的树叶版）
     ====================================================================== */
  var FLK = [
    { n: 32, dl: 2500, inc: .33, iti: 800 }, { n: 40, dl: 2200, inc: .40, iti: 750 },
    { n: 48, dl: 1900, inc: .45, iti: 700 }, { n: 56, dl: 1700, inc: .50, iti: 650 },
    { n: 64, dl: 1500, inc: .50, iti: 600 }, { n: 72, dl: 1300, inc: .50, iti: 550 }
  ];
  App.tasks.register({
    id: 'flanker', name: '树叶方向', icon: '🍃', domain: 'inhibit',
    levels: 6, startLevel: 1, up: 88, down: 45, dur: '约 2 分钟',
    why: '只看中间那片叶子、忽略两边朝别的方向的叶子。练的是抗干扰能力（选择性注意 + 冲突控制）。',
    origin: 'Eriksen Flanker 任务（ANT 注意网络测验里"执行控制"成分的核心）；儿研所注意力训练中有同类的树叶方向任务。',
    transfer: '抗干扰弱的孩子，写作业时旁边有人说话就停笔。练完可以配合"书桌只留当前一科"的环境调整。',
    levelName: function (l) { return '限时 ' + FLK[l - 1].dl + 'ms · 2 分钟'; },
    metricDefs: [
      { key: 'acc', name: '正确率(%)', better: 'high' },
      { key: 'rt', name: '平均反应时(ms)', better: 'low' },
      { key: 'cv', name: '反应时波动(%)', better: 'low' },
      { key: 'flankerEffect', name: '干扰代价(ms)', better: 'low' }
    ],
    report: function (r) {
      var m = r.metrics;
      return [['正确率', m.acc + '%'], ['反应时', U.ms(m.rt)], ['干扰代价', U.ms(m.flankerEffect)],
      ['波动', m.cv + '%'], ['得分', r.score]];
    },
    mount: function (root, ctx) {
      var cfg = FLK[ctx.level - 1];
      var DIRS = ['up', 'down', 'left', 'right'];
      var ANG = { up: 0, right: 90, down: 180, left: 270 };

      /* 一片叶子，叶尖默认朝上，靠旋转指向四个方向 */
      function leafSVG(dir, size) {
        return '<svg viewBox="0 0 100 100" width="' + size + '" height="' + size + '"' +
          ' style="transform:rotate(' + ANG[dir] + 'deg);display:inline-block;vertical-align:middle">' +
          /* 叶尖在上、叶柄在下：叶尖是尖的，叶基是圆的，叶柄很明显 */
          '<path d="M50 5C77 22 84 55 57 80Q50 86 43 80C16 55 23 22 50 5Z" fill="#3f9b6d"/>' +
          '<path d="M50 12V78" stroke="#2c7d57" stroke-width="3" fill="none"/>' +
          '<path d="M50 38L63 29M50 52L63 43M50 38L37 29M50 52L37 43" stroke="#2c7d57" stroke-width="2" fill="none" opacity=".65"/>' +
          '<path d="M50 84v13" stroke="#8a6a3a" stroke-width="5" stroke-linecap="round"/>' +
          '</svg>';
      }
      /* 中性干扰：没有方向的圆点 */
      function dotSVG(size) {
        return '<svg viewBox="0 0 100 100" width="' + size + '" height="' + size + '"' +
          ' style="display:inline-block;vertical-align:middle">' +
          '<circle cx="50" cy="50" r="30" fill="#9fb8ab"/></svg>';
      }
      function rowHTML(centerDir, flankDir) {
        var f = flankDir ? leafSVG(flankDir, 76) : dotSVG(76);
        return f + f + leafSVG(centerDir, 76) + f + f;
      }

      function makeTrial() {
        var r = Math.random();
        var ty = r < cfg.inc ? 'inc' : (r < cfg.inc + 0.15 ? 'neu' : 'con');
        var dir = U.pick(DIRS);
        var fdir = ty === 'con' ? dir : (ty === 'inc' ? U.pick(DIRS.filter(function (d) { return d !== dir; })) : null);
        var html = rowHTML(dir, fdir);
        return {
          kind: ty, go: true, expected: dir, meta: ty,
          render: function (box) { box.appendChild(U.html('div', 'leafRow', html)); }
        };
      }

      E.screen(root, {
        title: '树叶方向',
        intro: '<p>屏幕上会出现 5 片叶子，例如：</p><div class="leafRow">' +
          leafSVG('left', 52) + leafSVG('left', 52) + leafSVG('right', 52) + leafSVG('left', 52) + leafSVG('left', 52) + '</div>',
        tips: [
          '只看 <b>最中间那一片</b> 叶子的叶尖朝哪边，两边的都是来捣乱的。',
          '叶尖朝上 → 键盘 <b>↑</b>；朝下 → <b>↓</b>；朝左 → <b>←</b>；朝右 → <b>→</b>。',
          '上面这个例子里，中间的叶子叶尖朝右，所以按 <b>→</b>。',
          '一共做 <b>2 分钟</b>，要快，但先看清中间。'
        ],
        btn: '开始', onStart: function () {
          E.countdown(App.stage.clear(), function () {
            E.rtTask(App.stage.clear(), {
              trials: [], makeTrial: makeTrial, timeLimitMs: E.TASK_MS,
              stimMs: cfg.dl, keepStim: true, itiMs: cfg.iti, deadlineMs: cfg.dl,
              feedback: App.store.settings().feedback ? true : false,
              buttons: [
                { key: 'up', label: '▲ 上' }, { key: 'down', label: '▼ 下' },
                { key: 'left', label: '◀ 左' }, { key: 'right', label: '右 ▶' }
              ],
              keymap: { 'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right' },
              onDone: finish
            });
          });
        }
      });

      function finish(rows) {
        var m = E.rtMetrics(rows);
        function rtOf(ty) {
          var a = rows.filter(function (r) { return r.meta === ty && r.correct && r.rt != null; })
            .map(function (r) { return r.rt; });
          return U.mean(a);
        }
        var rc = rtOf('con'), ri = rtOf('inc');
        var fe = (rc != null && ri != null) ? ri - rc : null;
        var acc = m.acc || 0;
        var speed = E.speedScore(m.rt, 500, 1400) / 100;
        var steady = E.steadyScore(m.cvRaw) / 100;
        var ctrl = fe == null ? .5 : U.clamp((220 - fe) / 180, 0, 1);
        var score = 100 * (0.45 * acc + 0.22 * speed + 0.18 * steady + 0.15 * ctrl);
        var res = E.finishTask(ctx, {
          score: score,
          metrics: {
            acc: U.r1(acc * 100), rt: m.rt, rtSD: m.rtSD, cv: m.cv,
            omissions: m.omissions, wrongKey: m.wrongKey,
            rtCon: U.r0(rc), rtInc: U.r0(ri), flankerEffect: U.r0(fe), trials: m.total
          }
        });
        E.resultScreen(App.stage.clear(), res, function () { ctx.onFinish(res); });
      }
    }
  });

  /* ======================================================================
     5. 颜色字（Stroop）
     ====================================================================== */
  var STR = [
    { n: 24, dl: 3000, inc: .33, iti: 800 }, { n: 32, dl: 2600, inc: .40, iti: 750 },
    { n: 40, dl: 2300, inc: .45, iti: 700 }, { n: 48, dl: 2000, inc: .50, iti: 650 },
    { n: 54, dl: 1800, inc: .50, iti: 600 }, { n: 60, dl: 1600, inc: .55, iti: 560 }
  ];
  var SC = [
    { name: '红', hex: '#d2503c', key: 'red' }, { name: '黄', hex: '#d9a227', key: 'yellow' },
    { name: '蓝', hex: '#3a76c4', key: 'blue' }, { name: '绿', hex: '#3f9b6d', key: 'green' }
  ];
  App.tasks.register({
    id: 'stroop', name: '颜色字', icon: '🎨', domain: 'inhibit',
    levels: 6, startLevel: 1, up: 88, down: 45, dur: '约 2 分钟',
    why: '字义和字的颜色打架时，要压住"自动读字"的本能，只报颜色。这是抑制控制最经典的测法。',
    origin: 'Stroop 色词干扰任务（1935），心理学史上最著名的执行功能任务之一。',
    transfer: '抑制控制好，孩子才压得住"写到一半想起别的事"。训练同时也在强化字形—读音的分离加工。',
    levelName: function (l) { return '冲突 ' + Math.round(STR[l - 1].inc * 100) + '% · 2 分钟'; },
    metricDefs: [
      { key: 'acc', name: '正确率(%)', better: 'high' },
      { key: 'rt', name: '平均反应时(ms)', better: 'low' },
      { key: 'stroopEffect', name: '干扰代价(ms)', better: 'low' }
    ],
    report: function (r) {
      var m = r.metrics;
      return [['正确率', m.acc + '%'], ['反应时', U.ms(m.rt)], ['干扰代价', U.ms(m.stroopEffect)], ['得分', r.score]];
    },
    mount: function (root, ctx) {
      var cfg = STR[ctx.level - 1];
      function makeTrial() {
        var ty = Math.random() < cfg.inc ? 'inc' : 'con';
        var ink = U.pick(SC);
        var word = ty === 'con' ? ink : U.pick(SC.filter(function (c) { return c.key !== ink.key; }));
        return {
          kind: ty, go: true, expected: ink.key, meta: ty,
          render: function (box) {
            var d = U.el('div', 'stimBig', word.name);
            d.style.color = ink.hex;
            box.appendChild(d);
          }
        };
      }

      E.screen(root, {
        title: '颜色字',
        intro: '<p>屏幕会出现一个字，比如 <b style="color:#3a76c4;font-size:34px">红</b>。</p>',
        tips: [
          '<b>不要读这个字是什么，只看它是什么颜色。</b>',
          '上面的例子里，字是「红」，但<b>颜色是蓝的</b>，所以要按<b>蓝</b>。',
          '下面四个按钮就是四种颜色，也可以按键盘 <b>1 2 3 4</b>。',
          '一共做 <b>2 分钟</b>，时间到自动结束。会觉得别扭——那就对了，忍住本能才是在练。'
        ],
        btn: '开始', onStart: function () {
          E.countdown(App.stage.clear(), function () {
            E.rtTask(App.stage.clear(), {
              trials: [], makeTrial: makeTrial, timeLimitMs: E.TASK_MS,
              stimMs: cfg.dl, keepStim: true, itiMs: cfg.iti, deadlineMs: cfg.dl,
              feedback: App.store.settings().feedback ? true : false,
              buttons: SC.map(function (c, i) {
                return { key: c.key, label: '■\n' + (i + 1), color: c.hex };
              }),
              keymap: { '1': 'red', '2': 'yellow', '3': 'blue', '4': 'green' },
              onDone: finish
            });
          });
        }
      });

      function finish(rows) {
        var m = E.rtMetrics(rows);
        function rtOf(ty) {
          var a = rows.filter(function (r) { return r.meta === ty && r.correct && r.rt != null; })
            .map(function (r) { return r.rt; });
          return U.mean(a);
        }
        var rc = rtOf('con'), ri = rtOf('inc');
        var se = (rc != null && ri != null) ? ri - rc : null;
        var acc = m.acc || 0;
        var speed = E.speedScore(m.rt, 700, 1900) / 100;
        var ctrl = se == null ? .5 : U.clamp((300 - se) / 250, 0, 1);
        var steady = E.steadyScore(m.cvRaw) / 100;
        var score = 100 * (0.45 * acc + 0.20 * speed + 0.20 * ctrl + 0.15 * steady);
        var res = E.finishTask(ctx, {
          score: score,
          metrics: {
            acc: U.r1(acc * 100), rt: m.rt, rtSD: m.rtSD, cv: m.cv,
            rtCon: U.r0(rc), rtInc: U.r0(ri), stroopEffect: U.r0(se),
            omissions: m.omissions, wrongKey: m.wrongKey, trials: m.total
          }
        });
        E.resultScreen(App.stage.clear(), res, function () { ctx.onFinish(res); });
      }
    }
  });
})();
