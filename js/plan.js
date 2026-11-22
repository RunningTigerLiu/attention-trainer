/* plan.js — 每日计划、热身、训练流程编排、家长观察评分 */
(function () {
  'use strict';
  var App = window.App, U = App.util, E = App.engine;

  /* 每日计划：不预先排固定模板，而是每天从各个能力维度各随机挑 1 个任务。
     保证：1) 尽量每天覆盖所有维度；2) 同一天内计划稳定（刷新不变）；3) 隔天换题、尽量不重复。
     维度比每天任务数多时（现在是 6 个维度、每天 5 项），按日期轮换起点，
     保证每个维度隔几天都会轮到，而不是永远砍掉最后一个。*/
  var DOMAINS = ['wm', 'inhibit', 'sustained', 'selective', 'flex', 'lang'];

  App.plan = {
    domains: DOMAINS,
    /* 今天要练的任务 id（每个维度各 1 个）*/
    today: function () {
      var n = U.clamp(App.store.settings().tasksPerDay, 3, 5);
      var m = App.store.data.meta, d = U.today();
      if (m.dailyPlan && m.dailyPlan.date === d && m.dailyPlan.ids && m.dailyPlan.ids.length >= n) {
        return m.dailyPlan.ids.slice(0, n);
      }
      var prev = (m.dailyPlan && m.dailyPlan.date !== d) ? m.dailyPlan.ids : null;
      var ids = App.plan.generate(n, prev);
      m.dailyPlan = { date: d, ids: ids };
      App.store.save();
      return ids.slice(0, n);
    },
    /* 按维度随机挑任务，尽量避开昨天挑过的那个 */
    generate: function (n, yesterday) {
      var avoid = {};
      (yesterday || []).forEach(function (id) { avoid[id] = true; });
      var out = [];
      var dayNo = Math.floor(U.parseDate(U.today()).getTime() / 86400000);
      var start = dayNo % DOMAINS.length;
      var ordered = DOMAINS.slice(start).concat(DOMAINS.slice(0, start));
      ordered.forEach(function (dom) {
        if (out.length >= n) return;
        var pool = App.tasks.byDomain(dom).filter(function (t) { return !avoid[t.id]; });
        if (!pool.length) pool = App.tasks.byDomain(dom);
        if (pool.length) out.push(U.pick(pool).id);
      });
      return out.slice(0, n);
    },
    /* 今天已完成的任务（含快速练习）*/
    doneToday: function () {
      var d = U.today(), done = {};
      App.store.data.sessions.forEach(function (s) {
        if (s.date === d) s.results.forEach(function (r) { done[r.taskId] = true; });
      });
      return done;
    },
    todaySession: function () {
      var d = U.today();
      var list = App.store.data.sessions.filter(function (s) { return s.date === d && s.kind === 'daily'; });
      return list.length ? list[list.length - 1] : null;
    },
    /* 估算时长（分钟）：热身 1 + 结算观察 0.5 + 每项约 2.4 + 项间休息约 0.3 */
    estForCount: function (n) {
      return Math.round((App.store.settings().warmup ? 1 : 0) + 0.5 + n * 2.4 + (n > 1 ? (n - 1) * 0.3 : 0));
    },
    estMinutes: function (ids) { return App.plan.estForCount(ids.length); }
  };

  /* ================= 热身：1 分钟呼吸聚焦 ================= */
  App.plan.warmup = function (done) {
    var root = App.stage.open({ title: '热身 · 呼吸聚焦', sub: '把身体先安静下来，再开始练', onQuit: function () { App.stage.close(); } });
    E.screen(root, {
      title: '先做 1 分钟呼吸',
      intro: '<p>坐直，双脚踩地，眼睛轻轻看着圆圈。</p>',
      tips: ['圆圈<b>变大</b>的时候：用鼻子<b>慢慢吸气</b>（4 秒）。',
        '圆圈<b>变小</b>的时候：用嘴<b>慢慢呼气</b>（6 秒）。',
        '脑子里跑掉了没关系，发现了就把注意力<b>带回圆圈</b>。',
        '正念呼吸本身也是 ADHD 干预中有研究支持的一环。'],
      btn: '开始呼吸', onStart: run
    });
    function run() {
      var r = App.stage.clear();
      var pad = U.el('div', 'stagePad');
      var c = U.el('div', 'breathCircle', '吸气');
      var cnt = U.el('div', 'muted', '还剩 60 秒');
      var skip = U.el('button', 'btn small', '跳过热身');
      skip.addEventListener('click', function () { E.clearTimers(); done(); });
      pad.appendChild(c); pad.appendChild(cnt); pad.appendChild(skip);
      r.appendChild(pad);
      var left = 60, phase = 0;
      (function cycle() {
        if (left <= 0) { App.sound.win(); done(); return; }
        var inhale = phase % 2 === 0;
        c.textContent = inhale ? '吸 气' : '呼 气';
        c.style.transitionDuration = (inhale ? 4 : 6) + 's';
        c.style.transform = inhale ? 'scale(1.35)' : 'scale(0.78)';
        App.sound.beep(inhale ? 520 : 390, 0.12, 0.06);
        var dur = inhale ? 4 : 6;
        phase++; left -= dur;
        cnt.textContent = '还剩 ' + Math.max(0, left) + ' 秒';
        App.stage.setProgress((60 - left) / 60, '');
        E.T(cycle, dur * 1000);
      })();
    }
  };

  /* ================= 训练流程 ================= */
  /* kind: 'daily' | 'practice' */
  App.session = {
    run: function (taskIds, kind, onEnd) {
      kind = kind || 'daily';
      var sess = App.store.newSession(kind, taskIds);
      var i = 0, quitting = false;
      App.stage.startClock();

      function quit() {
        if (sess.results.length === 0) {
          // 没做完任何任务，删掉空会话
          var k = App.store.data.sessions.indexOf(sess);
          if (k >= 0) App.store.data.sessions.splice(k, 1);
          App.store.save();
          App.stage.close(); if (onEnd) onEnd(sess);
          return;
        }
        quitting = true;
        E.clearTimers(); App.speech.cancel();
        summary();
      }

      function nextTask() {
        if (quitting) return;
        if (i >= taskIds.length) return summary();
        var id = taskIds[i], t = App.tasks.get(id);
        var level = App.store.level(id);
        App.stage.open({
          title: (i + 1) + '/' + taskIds.length + ' · ' + t.icon + ' ' + t.name,
          sub: '第 ' + level + ' 关：' + t.levelName(level),
          progress: i / taskIds.length,
          onQuit: confirmQuit
        });
        var root = App.stage.clear();
        t.mount(root, {
          taskId: id, level: level, startedAtMs: Date.now(),
          onFinish: function (res) {
            App.store.pushResult(sess, res);
            i++;
            if (i >= taskIds.length) summary();
            else breakScreen();
          }
        });
      }

      function confirmQuit() {
        var root = App.stage.clear();
        E.screen(root, {
          title: '要结束今天的训练吗？',
          intro: '<p>已完成 ' + sess.results.length + ' / ' + taskIds.length + ' 项。已完成的会被保存。</p>',
          tips: ['如果孩子已经明显烦躁或撑不住了，<b>停下来是对的</b>——宁可每天少做一点，也不要把训练变成痛苦的事。'],
          extra: (function () {
            var d = U.el('div', 'flexline');
            d.style.marginTop = '12px';
            var a = U.el('button', 'btn btn-danger', '结束并保存');
            a.addEventListener('click', quit);
            var b = U.el('button', 'btn btn-primary', '继续训练');
            b.addEventListener('click', function () { if (i < taskIds.length) nextTask(); else summary(); });
            d.appendChild(b); d.appendChild(a);
            return d;
          })()
        });
      }

      function breakScreen() {
        App.stage.open({
          title: '休息一下', sub: '喝口水，动一动，' + (taskIds.length - i) + ' 项还没做',
          progress: i / taskIds.length, onQuit: confirmQuit
        });
        var root = App.stage.clear();
        var pad = U.el('div', 'stagePad');
        pad.appendChild(U.el('div', 'stimBig', '🥤'));
        var tip = U.pick([
          '站起来伸个懒腰，转转脖子。', '看看窗外最远的地方，让眼睛休息 10 秒。',
          '深呼吸三次。', '喝两口水。', '甩甩手，踮踮脚。'
        ]);
        pad.appendChild(U.el('div', null, tip));
        // 超时时温和提示：短而频繁 ＞ 长而硬撑
        var budget = App.plan.estForCount(taskIds.length) * 60;
        if (App.stage.elapsedSec() > budget) {
          pad.appendChild(U.html('div', 'small muted',
            '⏱ 今天已经练得挺久啦。如果状态开始下滑，点右上角「退出」保存后明天再继续，也是很棒的选择。'));
        }
        var cd = U.el('div', 'pill', '20');
        pad.appendChild(cd);
        var b = U.el('button', 'btn btn-primary btn-big', '继续下一项');
        b.addEventListener('click', function () { E.clearTimers(); nextTask(); });
        pad.appendChild(b);
        root.appendChild(pad);
        var left = 20;
        (function tk() {
          left--; cd.textContent = String(left);
          if (left <= 0) { E.clearTimers(); nextTask(); return; }
          E.T(tk, 1000);
        })();
      }

      function summary() {
        sess.endedAt = new Date().toISOString();
        App.store.save();
        App.stage.open({ title: '今天练完啦', sub: '', progress: 1, onQuit: function () { finishAll(); } });
        var root = App.stage.clear();
        var pad = U.el('div', 'stagePad');
        var stars = sess.results.reduce(function (a, r) { return a + r.stars; }, 0);
        pad.appendChild(U.el('div', 'stimBig', '🏅'));
        pad.appendChild(U.el('h3', null, '完成 ' + sess.results.length + ' 项 · 获得 ' + sess.points + ' 分 · ' + stars + ' 颗星'));

        var box = U.el('div', 'howto');
        var tb = U.el('table');
        tb.appendChild(U.html('tr', null, '<th>项目</th><th>关卡</th><th>得分</th><th></th>'));
        sess.results.forEach(function (r) {
          var t = App.tasks.get(r.taskId);
          tb.appendChild(U.html('tr', null,
            '<td>' + t.icon + ' ' + t.name + '</td><td>第' + r.level + '关</td><td><b>' + r.score + '</b></td>' +
            '<td>' + ('⭐'.repeat(r.stars) || '—') + (r.levelChanged > 0 ? ' <span class="pill g">升关</span>' : r.levelChanged < 0 ? ' <span class="pill y">降关</span>' : '') + '</td>'));
        });
        box.appendChild(tb);
        var st = App.store.streak();
        box.appendChild(U.html('p', 'small', '连续训练 <b>' + st + '</b> 天 · 累计 <b>' + App.store.totalPoints() + '</b> 分'));
        box.appendChild(U.html('p', 'small muted', '💡 练完<b>马上</b>做一件真实的事（听写两个词 / 写两行字），迁移效果最好。'));
        pad.appendChild(box);

        var b = U.el('button', 'btn btn-primary btn-big', '记录今天的表现 →');
        b.addEventListener('click', function () { rating(sess, finishAll); });
        pad.appendChild(b);
        var b2 = U.el('button', 'btn btn-ghost small', '跳过记录，直接结束');
        b2.addEventListener('click', finishAll);
        pad.appendChild(b2);
        root.appendChild(pad);
        App.sound.win();
      }

      function finishAll() {
        App.stage.close();
        if (onEnd) onEnd(sess);
      }

      /* 开始 */
      if (kind === 'daily' && App.store.settings().warmup) App.plan.warmup(nextTask);
      else nextTask();
    },

    single: function (taskId, onEnd) { App.session.run([taskId], 'practice', onEnd); }
  };

  /* ================= 家长观察评分 ================= */
  function rating(sess, done) {
    var root = App.stage.clear();
    var vals = { focusClass: null, focusHw: null, mood: null, hwMinutes: '', note: '' };
    var pad = U.el('div', 'stagePad');
    var box = U.el('div', 'howto');
    box.appendChild(U.el('h3', null, '家长观察（30 秒）'));
    box.appendChild(U.html('p', 'small muted', '这几项是<b>真实生活里的表现</b>。只有把它和训练成绩放在一起看，才知道训练有没有真的帮上忙。可以留空。'));

    [['focusClass', '今天上课专注', '1=几乎一直走神　5=基本能跟住'],
    ['focusHw', '今天作业专注', '1=一直要人盯　5=能自己坐下来做'],
    ['mood', '今天情绪状态', '1=很烦躁易炸　5=平稳愉快']].forEach(function (it) {
      var row = U.el('div', 'rateRow');
      row.appendChild(U.el('div', 'lbl', it[1]));
      var bs = U.el('div', 'rateBtns');
      [1, 2, 3, 4, 5].forEach(function (v) {
        var b = U.el('button', null, String(v));
        b.addEventListener('click', function () {
          vals[it[0]] = v;
          U.$$('button', bs).forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on');
        });
        bs.appendChild(b);
      });
      row.appendChild(bs);
      row.appendChild(U.el('div', 'small muted', it[2]));
      box.appendChild(row);
    });

    var f1 = U.html('label', 'field', '今天写作业总共用了多少分钟？<input type="number" min="0" max="400" placeholder="例如 45">');
    box.appendChild(f1);
    var f2 = U.html('label', 'field', '备注（听写错几个字、今天发生了什么、吃药情况…）<textarea rows="2" placeholder="选填"></textarea>');
    box.appendChild(f2);
    pad.appendChild(box);

    var b = U.el('button', 'btn btn-primary btn-big', '保存并结束');
    b.addEventListener('click', function () {
      vals.hwMinutes = U.$('input', f1).value ? +U.$('input', f1).value : null;
      vals.note = U.$('textarea', f2).value.trim();
      sess.rating = vals;
      App.store.save();
      U.toast('已保存今天的记录');
      done();
    });
    pad.appendChild(b);
    root.appendChild(pad);
  }
  App.plan.rating = rating;
})();
