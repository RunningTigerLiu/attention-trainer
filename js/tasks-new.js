/* tasks-new.js — 新增任务：
   12. 绿球追踪（多目标追踪 MOT，持续注意）
   13. 图片辨认（视觉短时记忆再认，工作记忆）
   两个都参考了儿研所注意力训练里的同类任务，范式本身来自公开研究。 */
(function () {
  'use strict';
  var App = window.App, U = App.util, E = App.engine;

  /* ======================================================================
     12. 绿球追踪（Multiple Object Tracking）
     规则：先亮出几个绿球 → 全部变灰 → 球互相碰撞移动 → 停下后，
     点出"原本是绿色"的那几个。球的数量随关卡和轮次逐步增多。
     ====================================================================== */
  var MOT = [
    { speed: 80 }, { speed: 95 }, { speed: 110 },
    { speed: 125 }, { speed: 140 }, { speed: 155 }
  ];
  App.tasks.register({
    id: 'mot', name: '绿球追踪', icon: '🟢', domain: 'sustained',
    levels: 6, startLevel: 1, up: 85, down: 40, dur: '约 2 分钟',
    why: '盯住几个会移动的目标，同时忽略其他的球。练的是把注意力"分给几个目标并持续跟住"，不是只看一个点。',
    origin: '多目标追踪（Multiple Object Tracking，Pylyshyn & Storm 1988），注意研究中用来测量同时追踪容量的经典范式；儿研所注意力训练中有同类"绿球"任务。',
    transfer: '上课既要看板书、又要跟老师讲的进度，用的就是这种"同时盯住几件事"。练完可以让孩子复述"老师刚才讲了几件事"。',
    levelName: function (l) { return '从 2 个绿球开始 · 球速 ' + MOT[l - 1].speed + ' · 2 分钟'; },
    metricDefs: [
      { key: 'maxSpan', name: '最多记住几个绿球', better: 'high' },
      { key: 'hitRate', name: '绿球找到率(%)', better: 'high' },
      { key: 'falseClicks', name: '误点次数', better: 'low' }
    ],
    report: function (r) {
      var m = r.metrics;
      return [['最多记住', m.maxSpan + ' 个绿球'], ['找到率', m.hitRate + '%'], ['误点', m.falseClicks + ' 次']];
    },
    mount: function (root, ctx) {
      var cfg = MOT[ctx.level - 1];
      var RAD = 21;
      /* 阶梯：从 2 个绿球开始，全部找对就加一个，答错退回一个。
         按 2 分钟结算，答错不会减少题量。 */
      var LIMIT = E.TASK_MS, startedAt = 0;
      var t = 2, maxT = 2, trialNo = 0, finished = false;
      var hits = 0, falsePicks = 0, targetsTotal = 0;

      E.screen(root, {
        title: '绿球追踪',
        intro: '<p>一开始有 <b>2 个绿球</b>，其余球是灰色的。</p>',
        tips: [
          '绿球先亮一下，然后<b>全部变成灰色</b>，球会互相碰撞、到处移动。',
          '球停住以后，<b>点出刚才那几个绿球</b>（点满就自动判定）。',
          '全部找对，下一轮<b>多一个绿球</b>；答错，下一轮<b>退回一个</b>。',
          '一共做 <b>2 分钟</b>，时间到自动结束。',
          '小提示：眼睛不要追着一个球跑，试着用"余光"把几个球一起框住。'
        ],
        btn: '开始', onStart: function () {
          E.countdown(App.stage.clear(), function () { startedAt = performance.now(); runTrial(); });
        }
      });

      function runTrial() {
        if (finished) return;
        if (trialNo > 0 && performance.now() - startedAt >= LIMIT) return finish();
        trialNo++;
        var nT = t;
        var nd = Math.min(10, t + 1);
        var n = nT + nd;
        var moveSec = Math.min(9, 4 + (t - 2) * 0.8);

        var r = App.stage.clear();
        var pad = U.el('div', 'stagePad');
        var head = U.el('div', 'pill y', '先记住 ' + nT + ' 个绿球');
        var wrap = U.el('div', 'motWrap');
        var cv = U.el('canvas', 'motCanvas');
        var tip = U.el('div', 'muted small', '');
        var btnRow = U.el('div', 'flexline');
        var reset = U.el('button', 'btn small', '重选');
        reset.disabled = true;
        btnRow.appendChild(reset);
        pad.appendChild(head); wrap.appendChild(cv); pad.appendChild(wrap);
        pad.appendChild(tip); pad.appendChild(btnRow);
        r.appendChild(pad);
        App.stage.setProgress((performance.now() - startedAt) / LIMIT, E.leftText(LIMIT, startedAt));

        var dpr = window.devicePixelRatio || 1;
        var w = Math.min(760, Math.max(300, r.clientWidth - 30));
        var h = Math.round(Math.min(430, Math.max(260, w * 0.6)));
        cv.style.width = w + 'px'; cv.style.height = h + 'px';
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
        var c2d = cv.getContext('2d');
        c2d.setTransform(dpr, 0, 0, dpr, 0, 0);

        /* 生成球：目标球先放，然后放干扰球 */
        var balls = [], i, j, tries;
        for (i = 0; i < n; i++) {
          var p = null;
          for (tries = 0; tries < 500; tries++) {
            p = { x: RAD + 12 + Math.random() * (w - 2 * RAD - 24),
                  y: RAD + 12 + Math.random() * (h - 2 * RAD - 24) };
            var ok = true;
            for (j = 0; j < balls.length; j++) {
              var dx = balls[j].x - p.x, dy = balls[j].y - p.y;
              if (dx * dx + dy * dy < (2.4 * RAD) * (2.4 * RAD)) { ok = false; break; }
            }
            if (ok) break;
          }
          var ang = Math.random() * Math.PI * 2;
          var sp = cfg.speed * (0.85 + Math.random() * 0.3);
          balls.push({ x: p.x, y: p.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
                       target: i < nT, sel: false });
        }

        var phase = 'mark';     // mark → move → select → judge
        var alive = true, raf = null, last = performance.now(), selectedCount = 0;

        function draw() {
          c2d.clearRect(0, 0, w, h);
          balls.forEach(function (b) {
            var col = '#5d6b7a';
            if (phase === 'mark' && b.target) col = '#3f9b6d';
            if (phase === 'judge') {
              if (b.target && b.sel) col = '#3f9b6d';
              else if (b.target) col = '#8cc3aa';        // 漏掉的，浅绿
              else if (b.sel) col = '#c0564a';           // 点错的，红色
            }
            c2d.beginPath();
            c2d.arc(b.x, b.y, RAD, 0, Math.PI * 2);
            c2d.fillStyle = col;
            c2d.fill();
            /* 选中/答案标记外圈 */
            if ((phase === 'select' || phase === 'judge') && b.sel) {
              c2d.beginPath();
              c2d.arc(b.x, b.y, RAD + 4, 0, Math.PI * 2);
              c2d.strokeStyle = phase === 'judge' ? (b.target ? '#2c7d57' : '#a33f30') : '#2f6f8f';
              c2d.lineWidth = 3;
              c2d.stroke();
            }
          });
        }

        function stepCollisions(dt) {
          balls.forEach(function (b) {
            b.x += b.vx * dt; b.y += b.vy * dt;
            if (b.x < RAD) { b.x = RAD; b.vx = Math.abs(b.vx); }
            if (b.x > w - RAD) { b.x = w - RAD; b.vx = -Math.abs(b.vx); }
            if (b.y < RAD) { b.y = RAD; b.vy = Math.abs(b.vy); }
            if (b.y > h - RAD) { b.y = h - RAD; b.vy = -Math.abs(b.vy); }
          });
          for (var a = 0; a < balls.length; a++) {
            for (var b2 = a + 1; b2 < balls.length; b2++) {
              var A = balls[a], B = balls[b2];
              var dx = B.x - A.x, dy = B.y - A.y;
              var d2 = dx * dx + dy * dy, minD = 2 * RAD;
              if (d2 > 0 && d2 < minD * minD) {
                var d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
                var overlap = (minD - d) / 2;
                A.x -= nx * overlap; A.y -= ny * overlap;
                B.x += nx * overlap; B.y += ny * overlap;
                var pImp = (A.vx - B.vx) * nx + (A.vy - B.vy) * ny;
                if (pImp > 0) {
                  A.vx -= pImp * nx; A.vy -= pImp * ny;
                  B.vx += pImp * nx; B.vy += pImp * ny;
                }
              }
            }
          }
          /* 保持速度基本恒定，避免碰撞后整体慢下来 */
          balls.forEach(function (b) {
            var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
            var want = cfg.speed;
            b.vx = b.vx / sp * want; b.vy = b.vy / sp * want;
          });
        }

        function frame(ts) {
          if (!alive || !document.body.contains(cv)) { alive = false; return; }
          if (phase === 'move') {
            var dt = Math.min(0.05, Math.max(0, (ts - last) / 1000));
            last = ts;
            stepCollisions(dt);
          }
          draw();
          raf = requestAnimationFrame(frame);
        }

        reset.addEventListener('click', function () {
          if (phase !== 'select') return;
          balls.forEach(function (b) { b.sel = false; });
          selectedCount = 0;
          reset.disabled = true;
          tip.textContent = '重新选：点出刚才那几个绿球';
          draw();
        });

        cv.addEventListener('click', function (ev) {
          if (phase !== 'select') return;
          var rect = cv.getBoundingClientRect();
          var x = ev.clientX - rect.left, y = ev.clientY - rect.top;
          var best = null, bestD = 1e9;
          balls.forEach(function (b) {
            var dx = b.x - x, dy = b.y - y, d2 = dx * dx + dy * dy;
            if (d2 < (RAD + 8) * (RAD + 8) && d2 < bestD) { best = b; bestD = d2; }
          });
          if (!best || best.sel) return;
          best.sel = true; selectedCount++;
          App.sound.tick();
          reset.disabled = false;
          tip.textContent = '已选 ' + selectedCount + ' / ' + nT + ' 个';
          draw();
          if (selectedCount >= nT) { phase = 'judging'; E.T(judge, 250); }
        });

        function judge() {
          if (finished) return;
          phase = 'judge';
          var hh = 0, fp = 0;
          balls.forEach(function (b) {
            if (b.target && b.sel) hh++;
            if (!b.target && b.sel) fp++;
          });
          hits += hh; falsePicks += fp; targetsTotal += nT;
          maxT = Math.max(maxT, nT);
          var allRight = hh === nT && fp === 0;
          if (allRight) { t = Math.min(6, t + 1); tip.textContent = '✓ 全部找对！下一轮加一个'; App.sound.ok(); }
          else { t = Math.max(2, t - 1); tip.textContent = '找到 ' + hh + ' / ' + nT + '，点错 ' + fp + ' 个'; App.sound.bad(); }
          draw();
          E.T(function () {
            if (performance.now() - startedAt >= LIMIT) finish(); else runTrial();
          }, 1600);
        }

        draw();
        raf = requestAnimationFrame(frame);
        E.T(function () {
          phase = 'move'; last = performance.now();
          head.textContent = '球在移动，盯住刚才的绿球…';
          tip.textContent = '球停下前先不要点';
        }, 1900);
        E.T(function () {
          if (finished) return;
          phase = 'select';
          head.textContent = '停！点出刚才那几个绿球';
          tip.textContent = '点满 ' + nT + ' 个自动判定 · 点错可以重选';
          App.sound.beep(660, 0.12);
          // 到 2 分钟就收尾，避免卡在等着点球
          E.T(function () { finish(); }, Math.max(300, LIMIT - (performance.now() - startedAt)));
        }, 1900 + moveSec * 1000);
      }

      function finish() {
        if (finished) return;
        finished = true;
        var spanScore = U.clamp((maxT - 1) / 5 * 100, 0, 100);   // 2 个 → 20 分，6 个 → 100 分
        var acc = targetsTotal ? Math.max(0, (hits - falsePicks) / targetsTotal) : 0;
        var score = Math.round(0.65 * spanScore + 0.35 * acc * 100);
        var res = E.finishTask(ctx, {
          score: U.clamp(score, 0, 100),
          metrics: {
            maxSpan: maxT, hits: hits, targets: targetsTotal, falseClicks: falsePicks,
            hitRate: targetsTotal ? Math.round(100 * hits / targetsTotal) : 0,
            trials: trialNo, levelSpeed: cfg.speed
          }
        });
        E.resultScreen(App.stage.clear(), res, function () { ctx.onFinish(res); });
      }
    }
  });

  /* ======================================================================
     13. 图片辨认（视觉短时记忆再认）
     规则：先看一张图（几秒后消失），然后出现几个选项，
     判断刚才那张图在不在选项里——在就点它，不在就点「都没有」。
     ====================================================================== */
  var PIC_POOL = [
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵',
    '🐔', '🐧', '🐦', '🦉', '🐴', '🦄', '🐝', '🦋', '🐢', '🐠', '🐙', '🦀', '🍎', '🍌', '🍇',
    '🍓', '🍉', '🍊', '🥕', '🌻', '🌈', '⚽', '🚗', '🚲', '🚀', '🎈', '🎁', '📚', '✏️', '🎨',
    '🍭', '🌵', '🌞', '🧩', '🪁'
  ];
  var PIC = [
    { opts: 3, exp: 2000 }, { opts: 4, exp: 1700 }, { opts: 4, exp: 1400 },
    { opts: 5, exp: 1100 }, { opts: 5, exp: 900 }, { opts: 6, exp: 700 }
  ];
  App.tasks.register({
    id: 'picrec', name: '图片辨认', icon: '🖼️', domain: 'wm',
    levels: 6, startLevel: 1, up: 86, down: 40, dur: '约 2 分钟',
    why: '看一眼就要把图记住，再从选项里认出它。这是"看一眼记一笔"的视觉短时记忆，抄写和照着画都靠它。',
    origin: '视觉短时记忆的再认测验（Sternberg 记忆扫描范式路线），与儿研所注意力训练中"对比图片是否在选项中"的任务同类。',
    transfer: '孩子抄写要一笔一笔回头看，往往就是"看一眼能存住的东西"太少。练完可以让他看一眼词、合上书、再默写。',
    levelName: function (l) {
      var c = PIC[l - 1];
      return c.opts + ' 个选项 · 看图 ' + (c.exp / 1000).toFixed(1) + ' 秒';
    },
    metricDefs: [
      { key: 'acc', name: '正确率(%)', better: 'high' },
      { key: 'rt', name: '判断用时(ms)', better: 'low' }
    ],
    report: function (r) {
      var m = r.metrics;
      return [['答对', m.correct + '/' + m.trials], ['正确率', m.acc + '%'], ['平均用时', m.rt + 'ms']];
    },
    mount: function (root, ctx) {
      var cfg = PIC[ctx.level - 1];
      var LIMIT = E.TASK_MS, startedAt = 0;
      var pi = 0, answered = 0, correct = 0, rts = [], finished = false;

      E.screen(root, {
        title: '图片辨认',
        intro: '<p>先给你看<b>一张图</b>，过一会儿它会消失。</p>',
        tips: [
          '然后下面会出现 <b>' + cfg.opts + ' 个选项</b>。',
          '刚才那张图<b>在选项里</b>，就把它点出来；<b>不在</b>，就点「都没有」。',
          '有一半的时候它是不在的，所以<b>不要每次都硬找一个</b>。',
          '小技巧：记图的时候在心里说出它的名字（"这是小狗"），会记得更牢。',
          '一共做 <b>2 分钟</b>，时间到自动结束。'
        ],
        btn: '开始', onStart: function () {
          E.countdown(App.stage.clear(), function () { startedAt = performance.now(); runTrial(); });
        }
      });

      function runTrial() {
        if (finished) return;
        if (pi > 0 && performance.now() - startedAt >= LIMIT) return finish();
        pi++;
        var present = Math.random() < 0.5;
        var target = U.pick(PIC_POOL);
        var others = U.shuffle(PIC_POOL.filter(function (x) { return x !== target; }));
        var options;
        if (present) options = U.shuffle([target].concat(others.slice(0, cfg.opts - 1)));
        else options = others.slice(0, cfg.opts);

        var r = App.stage.clear();
        var pad = U.el('div', 'stagePad');
        var head = U.el('div', 'pill y', '记住这张图');
        var area = U.el('div', 'picArea');
        var tip = U.el('div', 'muted small', '');
        pad.appendChild(head); pad.appendChild(area); pad.appendChild(tip);
        r.appendChild(pad);
        App.stage.setProgress((performance.now() - startedAt) / LIMIT, '第 ' + pi + ' 张 · ' + E.leftText(LIMIT, startedAt));
        // 时间到就收尾（哪怕这题还没答）
        E.T(function () { finish(); }, Math.max(300, LIMIT - (performance.now() - startedAt)));

        /* ---- 记图阶段 ---- */
        var big = U.el('div', 'picTarget', target);
        area.appendChild(big);
        var ticksDone = false;
        var left = Math.ceil(cfg.exp / 1000);
        tip.textContent = '还有 ' + left + ' 秒';
        var tickTid = null;
        (function tickLeft() {
          left--;
          if (left >= 0) tip.textContent = '还有 ' + left + ' 秒';
          if (left > 0) tickTid = E.T(tickLeft, 1000);
        })();

        E.T(showOptions, cfg.exp);

        /* ---- 选项阶段 ---- */
        function showOptions() {
          clearTimeout(tickTid);
          area.innerHTML = '';
          head.textContent = '刚才那张图在里面吗？';
          tip.textContent = present ? '在的话就点它' : '不在的话点「都没有」';
          var t0 = performance.now();

          var g = U.el('div', 'picOpts');
          var btns = options.map(function (pic) {
            var b = U.el('button', null, pic);
            b.addEventListener('click', function () { answer(pic, b); });
            g.appendChild(b);
            return b;
          });
          var none = U.el('button', 'btn btn-big', '都没有');
          none.style.marginTop = '14px';
          area.appendChild(g);
          area.appendChild(none);
          none.addEventListener('click', function () { answer(null, none); });

          function answer(pic, el) {
            if (ticksDone) return;
            ticksDone = true;
            var rt = Math.round(performance.now() - t0);
            rts.push(rt);
            answered++;
            var ok = present ? (pic === target) : (pic === null);
            if (ok) correct++;
            /* 锁定所有按钮 */
            btns.forEach(function (b) { b.disabled = true; });
            none.disabled = true;
            if (pic === target) { el.classList.add('ok'); }
            else if (pic !== null) { el.classList.add('bad'); }
            /* 把正确答案标出来 */
            btns.forEach(function (b) {
              if (present && b.textContent === target) b.classList.add('ok');
            });
            if (ok) { tip.textContent = '✓ 答对了'; App.sound.ok(); }
            else { tip.textContent = '✗ 刚才那张是 ' + target + (present ? '' : '，它不在选项里'); App.sound.bad(); }
            E.T(runTrial, 1200);
          }
        }
      }

      function finish() {
        if (finished) return;
        finished = true;
        var n = Math.max(1, answered);
        var acc = correct / n;
        var chance = 1 / (cfg.opts + 1);
        var score = U.clamp(Math.round(100 * (acc - chance) / (1 - chance)), 0, 100);
        var res = E.finishTask(ctx, {
          score: score,
          metrics: {
            correct: correct, trials: answered, acc: Math.round(acc * 100),
            rt: U.r0(U.mean(rts)), options: cfg.opts, chance: Math.round(chance * 100)
          }
        });
        E.resultScreen(App.stage.clear(), res, function () { ctx.onFinish(res); });
      }
    }
  });
})();
