/* app.js — 页面渲染与交互 */
(function () {
  'use strict';
  var App = window.App, U = App.util;
  var cur = 'home';

  /* ================= 路由 ================= */
  function show(v) {
    cur = v;
    ['home', 'library', 'analysis', 'data', 'help'].forEach(function (k) {
      U.$('#view-' + k).classList.toggle('hidden', k !== v);
    });
    U.$$('.tab').forEach(function (b) { b.classList.toggle('active', b.dataset.view === v); });
    render();
    window.scrollTo(0, 0);
  }
  function render() {
    if (cur === 'home') renderHome();
    else if (cur === 'library') renderLibrary();
    else if (cur === 'analysis') renderAnalysis();
    else if (cur === 'data') renderData();
    else if (cur === 'help') renderHelp();
    U.$('#whoName').textContent = App.store.data.profile.name + ' · 连续 ' + App.store.streak() + ' 天 · ' + App.store.totalPoints() + ' 分';
    banner();
  }
  App.render = render;

  function banner() {
    var b = U.$('#banner'), msgs = [];
    try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); }
    catch (e) { msgs.push('⚠️ 这个浏览器不允许本地保存，数据<b>关掉页面就会丢</b>。请改用 Chrome/Edge 打开，或每次练完到「设置与数据」导出备份。'); }
    var lb = App.store.data.meta.lastBackupAt;
    var n = App.store.data.sessions.length;
    if (!msgs.length && n >= 3) {
      var days = lb ? U.daysBetween(lb.slice(0, 10), U.today()) : 999;
      if (days >= 7) msgs.push('📦 已经 ' + (lb ? days + ' 天' : '一直') + '没有导出备份了。<b>浏览器清缓存会清掉训练记录</b>，建议现在到「设置与数据」导出一份。');
    }
    if (window.__fileStore && n === 0) {
      msgs.push('👋 第一次用？如果之前用浏览器练过，请先到旧浏览器的网页版「设置与数据」导出备份，再回到这里「导入备份」即可无缝迁移。');
    }
    b.classList.toggle('hidden', !msgs.length);
    b.innerHTML = msgs.join('<br>');
  }

  /* ================= 今日训练 ================= */
  function renderHome() {
    var v = U.$('#view-home'), s = App.store;
    var plan = App.plan.today(), done = App.plan.doneToday();
    var left = plan.filter(function (id) { return !done[id]; });
    var h = '';

    var hour = new Date().getHours();
    var greet = hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
    h += '<div class="card"><div class="spread">' +
      '<div><h2 style="margin:0">' + greet + '，' + esc(s.data.profile.name) + '</h2>' +
      '<div class="muted small">' + U.today() + ' 星期' + U.weekdayCN(new Date()) +
      ' · 今天随机安排 ' + plan.length + ' 项，约 ' + App.plan.estMinutes(plan) + ' 分钟</div></div>' +
      '<div class="flexline">' +
      stat(s.streak() + ' 天', '连续训练') + stat(s.totalPoints(), '累计积分') +
      stat(s.activeDays().length + ' 天', '累计练了') + '</div></div></div>';

    h += '<div class="card"><h3>今日计划</h3>' +
      '<p class="small muted">每天自动按 ' + App.plan.domains.length + ' 个能力维度随机换题，无需手动安排。</p>';
    plan.forEach(function (id, i) {
      var t = App.tasks.get(id), lv = s.level(id), ok = done[id];
      h += '<div class="planItem' + (ok ? ' done' : '') + '">' +
        '<div class="planNum">' + (ok ? '✓' : i + 1) + '</div>' +
        '<div class="planBody"><div class="t">' + t.icon + ' ' + t.name +
        ' <span class="pill n">' + App.domains[t.domain].name + '</span></div>' +
        '<div class="d">第 ' + lv + ' 关 · ' + t.levelName(lv) + ' · ' + t.dur + '</div></div>' +
        '<button class="btn small" data-practice="' + id + '">' + (ok ? '再练一次' : '单独练') + '</button>' +
        '</div>';
    });
    if (left.length) {
      h += '<div class="flexline" style="margin-top:14px">' +
        '<button class="btn btn-primary btn-big" id="startToday">' +
        (left.length === plan.length ? '▶ 开始今日训练' : '▶ 继续今日训练（还剩 ' + left.length + ' 项）') + '</button>' +
        '<span class="muted small">' + (s.settings().warmup ? '含 1 分钟呼吸热身 · ' : '') + '中间会自动安排休息</span></div>';
    } else {
      h += '<div class="flexline" style="margin-top:14px">' +
        '<span class="pill g">🎉 今天的计划已全部完成！</span>' +
        '<button class="btn" id="againToday">再加练一轮</button></div>';
    }
    h += '</div>';

    h += '<div class="card"><h3>今天练完以后，顺手做这一件事</h3>' +
      '<p class="small">认知训练本身的"远迁移"效果有限，<b>真正起作用的是练完马上用</b>。挑一条做 3 分钟：</p>' +
      '<ul class="small" style="margin:0;padding-left:1.2em">' +
      '<li><b>听写</b>：你念一个 4 字词语，让他<b>先复述一遍再写</b>（复述就是在用刚练的听觉工作记忆）。</li>' +
      '<li><b>写汉字</b>：写前先问"这个字分成几块？"（如"请"＝言＋青），拆成部件再写，比整体照抄省记忆力。</li>' +
      '<li><b>背书</b>：背完<b>合上书自己说一遍</b>（检索练习），比再读五遍有效得多。</li>' +
      '<li><b>检查作业</b>：用"划消找字"的办法，手指点着一个字一个字扫过去。</li>' +
      '</ul></div>';

    v.innerHTML = h;
    var st = U.$('#startToday');
    if (st) st.onclick = function () { App.session.run(left, 'daily', function () { render(); }); };
    var ag = U.$('#againToday');
    if (ag) ag.onclick = function () { App.session.run(plan, 'practice', function () { render(); }); };
    U.$$('[data-practice]', v).forEach(function (b) {
      b.onclick = function () { App.session.single(b.dataset.practice, function () { render(); }); };
    });
  }

  function stat(v, k) { return '<div class="stat"><div class="v">' + v + '</div><div class="k">' + k + '</div></div>'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  /* ================= 任务库 ================= */
  function renderLibrary() {
    var v = U.$('#view-library'), h = '';
    h += '<div class="card"><h2>任务库</h2><p class="small muted">' + App.tasks.all().length + ' 个任务覆盖 ' + Object.keys(App.domains).length + ' 个能力维度，全部来自国际上有发表研究支持的实验范式。' +
      '可以单独练任意一项；难度默认自动调整，也可以手动指定关卡。</p></div>';
    Object.keys(App.domains).forEach(function (d) {
      var list = App.tasks.byDomain(d);
      if (!list.length) return;
      h += '<div class="card"><h3>' + App.domains[d].name + ' <span class="muted small" style="font-weight:400">— ' + App.domains[d].desc + '</span></h3><div class="grid2">';
      list.forEach(function (t) {
        var lv = App.store.level(t.id), rs = App.store.resultsOf(t.id);
        var last = rs.length ? rs[rs.length - 1] : null;
        h += '<div class="taskCard"><h4>' + t.icon + ' ' + t.name + ' <span class="pill">第 ' + lv + '/' + t.levels + ' 关</span></h4>' +
          '<p class="small">' + t.why + '</p>' +
          '<div class="flexline small muted">当前：' + t.levelName(lv) + ' · ' + t.dur + '</div>' +
          '<div class="flexline" style="margin-top:9px">' +
          '<button class="btn small" data-go="' + t.id + '">开始练习</button>' +
          '<select data-lv="' + t.id + '" style="padding:7px 9px;border:1px solid var(--line);border-radius:8px;font:inherit">' +
          U.range(t.levels, 1).map(function (n) {
            return '<option value="' + n + '"' + (n === lv ? ' selected' : '') + '>第 ' + n + ' 关：' + t.levelName(n) + '</option>';
          }).join('') + '</select>' +
          '</div>' +
          (last ? '<div class="small muted" style="margin-top:7px">上次：' + last.date + ' · ' + last.score + ' 分 · 练过 ' + rs.length + ' 次</div>'
            : '<div class="small muted" style="margin-top:7px">还没练过</div>') +
          '<div class="ev"><b>方法来源：</b>' + t.origin + '<br><b>和学习的关系：</b>' + t.transfer + '</div>' +
          '</div>';
      });
      h += '</div></div>';
    });
    v.innerHTML = h;
    U.$$('[data-go]', v).forEach(function (b) {
      b.onclick = function () { App.session.single(b.dataset.go, function () { render(); }); };
    });
    U.$$('[data-lv]', v).forEach(function (sel) {
      sel.onchange = function () { App.store.setLevel(sel.dataset.lv, +sel.value); U.toast('已设为第 ' + sel.value + ' 关'); render(); };
    });
  }

  /* ================= 记录与分析 ================= */
  var trendTask = null;
  function renderAnalysis() {
    var v = U.$('#view-analysis'), all = App.store.allResults(), h = '';
    if (!all.length) {
      v.innerHTML = '<div class="card"><h2>记录与分析</h2><p>还没有任何训练记录。先到「今日训练」做一轮，这里就会出现趋势图和自动解读。</p></div>';
      return;
    }
    var totalMin = Math.round(all.reduce(function (a, r) { return a + (r.durationMs || 0); }, 0) / 60000);
    h += '<div class="card"><div class="spread"><h2 style="margin:0">记录与分析</h2>' +
      '<div class="flexline"><button class="btn small" id="csv">导出 CSV（给医生/老师看）</button></div></div>' +
      '<div class="grid3" style="margin-top:12px">' +
      stat(App.store.activeDays().length, '训练天数') + stat(all.length, '完成项目数') +
      stat(totalMin + ' 分', '累计训练时长') + stat(App.store.streak(), '当前连续天数') +
      '</div></div>';

    /* 热力图 */
    h += '<div class="card"><h3>训练日历（最近 10 周）</h3>' + App.chart.heat(10) + '</div>';

    /* 雷达 */
    var axes = [], recentVals = [], baseVals = [];
    Object.keys(App.domains).forEach(function (d) {
      var list = all.filter(function (r) { return r.domain === d; });
      axes.push(App.domains[d].name);
      recentVals.push(list.length ? U.mean(list.slice(-4).map(function (r) { return r.score; })) : 0);
      baseVals.push(list.length >= 6 ? U.mean(list.slice(0, 4).map(function (r) { return r.score; })) : null);
    });
    var series = [];
    if (baseVals.some(function (x) { return x != null; })) series.push({ name: '最早 4 次', vals: baseVals.map(function (x) { return x || 0; }), color: '#b6c2cc' });
    series.push({ name: '最近 4 次', vals: recentVals, color: '#2f6f8f' });
    h += '<div class="card"><h3>各项能力对比</h3>' +
      '<p class="small muted">每一项是该维度下所有任务得分的平均（0–100，已按关卡难度折算）。看<b>形状</b>比看单点更有用：明显凹进去的那一块就是当前最弱环节。</p>' +
      App.chart.radar(axes, series) + '</div>';

    /* 自动解读 */
    h += '<div class="card"><h3>自动解读</h3>';
    App.analysis.insights().forEach(function (i) {
      h += '<div class="insight ' + i.kind + '">' + i.text + '</div>';
    });
    h += '<p class="small muted" style="margin-top:10px">⚠️ 以上是基于你本机数据的规则化提示，<b>不是诊断</b>。单次成绩波动很正常，请看两周以上的趋势。</p></div>';

    /* 趋势 */
    var withData = App.tasks.all().filter(function (t) { return App.store.resultsOf(t.id).length >= 2; });
    if (!trendTask || !withData.some(function (t) { return t.id === trendTask; })) trendTask = withData.length ? withData[0].id : null;
    if (trendTask) {
      var t = App.tasks.get(trendTask), rs = App.store.resultsOf(trendTask);
      var labels = rs.map(function (r) { return r.date.slice(5); });
      h += '<div class="card"><div class="spread"><h3 style="margin:0">单项趋势</h3>' +
        '<select id="trendSel" style="padding:8px 10px;border:1px solid var(--line);border-radius:8px;font:inherit">' +
        withData.map(function (x) {
          return '<option value="' + x.id + '"' + (x.id === trendTask ? ' selected' : '') + '>' + x.icon + ' ' + x.name + '（' + App.store.resultsOf(x.id).length + ' 次）</option>';
        }).join('') + '</select></div>';
      h += '<h4 style="margin-top:14px">综合得分（越高越好）</h4>' +
        App.chart.line([{ name: '得分', pts: rs.map(function (r) { return r.score; }) }], labels, { yMin: 0, yMax: 100, trend: true });
      h += '<h4 style="margin-top:14px">关卡（难度）</h4>' +
        App.chart.line([{ name: '关卡', pts: rs.map(function (r) { return r.level; }), color: '#8259b3' }], labels, { yMin: 1, yMax: t.levels, h: 150 });
      (t.metricDefs || []).forEach(function (md) {
        var pts = rs.map(function (r) { return r.metrics[md.key] == null ? null : +r.metrics[md.key]; });
        if (!pts.some(function (p) { return p != null; })) return;
        h += '<h4 style="margin-top:14px">' + md.name + '（' + (md.better === 'low' ? '越低越好 ↓' : '越高越好 ↑') + '）</h4>' +
          App.chart.line([{ name: md.name, pts: pts, color: md.better === 'low' ? '#c07a2c' : '#3f9b6d' }], labels, { h: 160, trend: true, zeroBase: md.better === 'high' });
      });
      h += '<p class="small muted">⚠️ 注意：<b>关卡会自动升降</b>。得分持平但关卡在往上走，其实是进步了；反之要小心。</p></div>';
    }

    /* 家长观察趋势 */
    var rated = App.store.data.sessions.filter(function (s) { return s.rating; });
    if (rated.length >= 2) {
      var lb = rated.map(function (s) { return s.date.slice(5); });
      h += '<div class="card"><h3>真实生活表现（你的观察）</h3>' +
        App.chart.line([
          { name: '上课专注', pts: rated.map(function (s) { return s.rating.focusClass; }) },
          { name: '作业专注', pts: rated.map(function (s) { return s.rating.focusHw; }) },
          { name: '情绪', pts: rated.map(function (s) { return s.rating.mood; }) }
        ], lb, { yMin: 1, yMax: 5, h: 185, trend: true });
      var mins = rated.map(function (s) { return s.rating.hwMinutes; });
      if (mins.some(function (m) { return m != null; })) {
        h += '<h4 style="margin-top:14px">作业时长（分钟，越低越好 ↓）</h4>' +
          App.chart.line([{ name: '作业分钟', pts: mins, color: '#c07a2c' }], lb, { h: 160, trend: true, zeroBase: true });
      }
      var notes = rated.filter(function (s) { return s.rating.note; }).slice(-8).reverse();
      if (notes.length) {
        h += '<h4 style="margin-top:14px">备注</h4><div class="tableWrap"><table><tr><th>日期</th><th>备注</th></tr>' +
          notes.map(function (s) { return '<tr><td>' + s.date + '</td><td style="white-space:normal">' + esc(s.rating.note) + '</td></tr>'; }).join('') +
          '</table></div>';
      }
      h += '</div>';
    }

    /* 明细 */
    h += '<div class="card"><h3>最近 60 条明细</h3><div class="tableWrap"><table>' +
      '<tr><th>日期</th><th>任务</th><th>维度</th><th>关</th><th>得分</th><th>关键指标</th></tr>';
    all.slice(-60).reverse().forEach(function (r) {
      var t = App.tasks.get(r.taskId);
      var key = (t && t.report ? t.report(r) : []).slice(0, 3).map(function (kv) { return kv[0] + ' ' + kv[1]; }).join(' · ');
      h += '<tr><td>' + r.date + '</td><td>' + (t ? t.icon + ' ' + t.name : r.taskId) + '</td>' +
        '<td>' + (App.domains[r.domain] ? App.domains[r.domain].name : '') + '</td><td>' + r.level + '</td>' +
        '<td><b>' + r.score + '</b></td><td style="white-space:normal">' + key + '</td></tr>';
    });
    h += '</table></div></div>';

    v.innerHTML = h;
    U.$('#csv').onclick = function () {
      U.download('专注力训练_明细_' + U.today() + '.csv', App.analysis.csv(), 'text/csv');
      U.toast('CSV 已导出');
    };
    var ts = U.$('#trendSel');
    if (ts) ts.onchange = function () { trendTask = ts.value; renderAnalysis(); };
  }

  /* ================= 设置与数据 ================= */
  function renderData() {
    var v = U.$('#view-data'), s = App.store, st = s.settings();
    var size = 0;
    try { size = (localStorage.getItem('attn_trainer_v1') || '').length; } catch (e) { }
    var h = '';

    h += '<div class="card"><h2>设置</h2><div class="grid2">';
    h += '<div>' +
      '<label class="field">孩子的名字（只存在本机）<input id="sName" value="' + esc(s.data.profile.name) + '"></label>' +
      '<label class="field">每天练几项（建议 5 项，约 15 分钟）<select id="sN">' +
      [3, 4, 5].map(function (n) { return '<option value="' + n + '"' + (n === st.tasksPerDay ? ' selected' : '') + '>' + n + ' 项（约 ' + App.plan.estForCount(n) + ' 分钟）</option>'; }).join('') +
      '</select></label>' +
      '<label class="field">语速（听数字/听指令）<input id="sRate" type="range" min="0.5" max="1.2" step="0.05" value="' + st.speechRate + '">' +
      '<span class="small muted" id="rateV">' + st.speechRate + ' 倍</span></label>' +
      '</div>';
    h += '<div>' +
      chk('sWarm', '每次训练前做 1 分钟呼吸热身', st.warmup) +
      chk('sSound', '开启提示音', st.sound) +
      chk('sSpeech', '开启中文语音朗读', st.speech) +
      chk('sFb', '答题时即时对错反馈（ADHD 孩子建议开）', st.feedback) +
      chk('sAd', '难度自动升降（关掉后由你在任务库手动指定）', st.adaptive) +
      '<label class="field">朗读声音（听数字 / 听指令）<select id="sVoice">' +
      '<option value="">自动（推荐）</option>' +
      App.speech.list().map(function (v) {
        return '<option value="' + esc(v.name) + '"' + (st.voice === v.name ? ' selected' : '') + '>' +
          esc(v.name) + ' · ' + esc(v.lang) + '</option>';
      }).join('') +
      '</select></label>' +
      '<button class="btn small" id="testVoice" type="button">试听这个声音</button>' +
      '<p class="small muted">语音状态：' + (App.speech.available() ? (App.speech.hasChinese() ? '✅ ' + esc(App.speech.voiceName()) : '⚠️ 没找到中文语音，听觉任务会自动改成屏幕显示') : '❌ 本浏览器不支持语音') + '</p>' +
      '</div></div>' +
      '<button class="btn btn-primary" id="saveSet">保存设置</button></div>';

    h += '<div class="card"><h2>数据管理</h2>' +
      '<p class="small">记录保存在这台电脑上（当前约 ' + Math.round(size / 1024) + ' KB，' + s.data.sessions.length + ' 次会话）。' +
      (window.__fileStore
        ? '<b>桌面 App 会把数据实时写成本地文件，并每天自动留一份备份</b>，清缓存、更新程序、重装都不丢。'
        : '<b>清理浏览器缓存、换浏览器、换电脑都会丢。</b>') + '请定期导出备份。</p>' +
      '<div class="flexline">' +
      '<button class="btn btn-primary" id="exp">⬇ 导出备份（JSON）</button>' +
      '<button class="btn" id="expCsv">⬇ 导出 CSV</button>' +
      '<label class="btn" style="display:inline-block">⬆ 导入备份<input type="file" id="imp" accept=".json,application/json" style="display:none"></label>' +
      (window.__fileStore ? '<button class="btn" id="openFolder">📁 打开数据文件夹</button>' : '') +
      '</div>' +
      '<p class="small muted" style="margin-top:10px">导入时会问你是「合并」还是「覆盖」。合并＝把另一台电脑/另一份备份里的记录并进来（按会话去重），适合多设备使用。</p>' +
      '<hr><button class="btn btn-danger" id="reset">清空所有数据</button>' +
      ' <span class="small muted">（不可恢复，请先导出备份）</span></div>';

    v.innerHTML = h;
    U.$('#sRate').oninput = function () { U.$('#rateV').textContent = this.value + ' 倍'; };
    U.$('#saveSet').onclick = function () {
      s.data.profile.name = U.$('#sName').value.trim() || '宝贝';
      st.tasksPerDay = +U.$('#sN').value;
      st.speechRate = +U.$('#sRate').value;
      st.warmup = U.$('#sWarm').checked; st.sound = U.$('#sSound').checked;
      st.speech = U.$('#sSpeech').checked; st.feedback = U.$('#sFb').checked;
      st.adaptive = U.$('#sAd').checked;
      st.voice = U.$('#sVoice').value;
      s.save(); U.toast('设置已保存'); render();
    };
    U.$('#testVoice').onclick = function () {
      var sel = U.$('#sVoice'), prev = st.voice;
      st.voice = sel.value;          // 试听时先临时用下拉框里选的声音
      App.speech.cancel();
      App.speech.say('你好，我们来玩一个听指令的游戏。先点红色的圆形，再点蓝色的五角星。', null, Math.min(st.speechRate, 0.7));
      st.voice = prev;
    };
    U.$('#exp').onclick = function () {
      U.download('专注力训练_备份_' + U.today() + '.json', JSON.stringify(s.exportObj(), null, 2));
      s.data.meta.lastBackupAt = new Date().toISOString(); s.save();
      U.toast('备份已导出'); banner();
    };
    U.$('#expCsv').onclick = function () {
      U.download('专注力训练_明细_' + U.today() + '.csv', App.analysis.csv(), 'text/csv');
    };
    U.$('#imp').onchange = function () {
      var f = this.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        var obj;
        try { obj = JSON.parse(rd.result); }
        catch (e) { U.toast('读不出来：这个文件不是有效的 JSON'); return; }
        var mode = window.prompt('导入方式：\n输入 1 = 合并（保留现有记录，并入新的）\n输入 2 = 覆盖（丢掉现有记录，完全用这份备份）', '1');
        if (mode === null) return;
        try {
          if (mode.trim() === '2') { s.importObj(obj); U.toast('已覆盖导入'); }
          else { var n = s.mergeObj(obj); U.toast('已合并，新增 ' + n + ' 次会话'); }
          render();
        } catch (e) { U.toast('导入失败：' + e.message); }
      };
      rd.readAsText(f);
      this.value = '';
    };
    var of = U.$('#openFolder');
    if (of) of.onclick = function () { window.__fileStore.openFolder(); U.toast('已打开数据文件夹（数据会自动保存成文件）'); };
    U.$('#reset').onclick = function () {
      if (!window.confirm('确定清空所有训练记录和设置吗？这一步不能撤销。')) return;
      if (!window.confirm('再确认一次：所有历史数据都会消失。确定？')) return;
      s.reset(); U.toast('已清空'); render();
    };
  }
  function chk(id, label, on) {
    return '<label class="field" style="font-weight:400"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') +
      ' style="width:auto;display:inline-block;margin-right:7px"> ' + label + '</label>';
  }

  /* ================= 使用说明 ================= */
  function renderHelp() {
    U.$('#view-help').innerHTML = [
      '<div class="card"><h2>给家长的使用说明</h2>',
      '<h3>怎么用</h3>',
      '<ol class="small">',
      '<li><b>每天固定时间练一次</b>，建议放学后、写作业<em>之前</em>（当成"热机"），不要放在睡前。</li>',
      '<li>打开「今日训练」点"开始今日训练"，程序会按 ' + App.plan.domains.length + ' 个能力维度<b>随机安排 5 项</b>（每天轮换，每个维度隔几天都会轮到）＋呼吸热身＋中间休息，约 15 分钟。</li>',
      '<li>练完花 30 秒填「家长观察」——这是整套记录里<b>最重要</b>的一块。</li>',
      '<li>每周到「记录与分析」看一次趋势；<b>每周导出一次备份</b>。</li>',
      '<li>连续练 5 周以上再评估效果。少于 3 周的数据基本看不出东西。</li>',
      '</ol>',
      '<h3>几条重要原则</h3>',
      '<ul class="small">',
      '<li><b>短而频繁 ＞ 长而偶尔。</b>每天 12 分钟连续 5 周，远胜周末一次练 1 小时。</li>',
      '<li><b>孩子烦了就停。</b>训练一旦变成亲子冲突，就起反作用了。随时可以点"退出"，已完成的部分会保存。</li>',
      '<li><b>只夸努力和策略，不夸分数。</b>"你刚才一行一行扫的办法很聪明"比"你好厉害"有用。</li>',
      '<li><b>难度会自动升降，而且是在"题里"逐步调。</b>记忆类任务答对就加长、答错就退回一步；反应类任务答对就加快、答错就放慢。整轮结束还会按得分上下调整关卡。总让孩子停在"稍微有点难但能做到"的地方，这是训练有效的前提。</li>',
      '<li><b>安静型 ADHD 的重点是"漏"而不是"冲"。</b>注意分析页里"漏按绿灯"这条指标，它比平均反应速度更能反映走神。</li>',
      '</ul></div>',

      '<div class="card"><h3>这套程序用了哪些方法</h3>',
      '<p class="small">每个任务都对应一个在国际文献里被反复使用的实验范式：</p>',
      '<div class="tableWrap"><table><tr><th>任务</th><th>维度</th><th>来源范式</th></tr>',
      App.tasks.all().map(function (t) {
        return '<tr><td>' + t.icon + ' ' + t.name + '</td><td>' + App.domains[t.domain].name + '</td><td style="white-space:normal">' + t.origin + '</td></tr>';
      }).join(''),
      '</table></div>',
      '<p class="small muted" style="margin-top:10px">热身部分的正念呼吸，参考的是正念训练用于 ADHD 的研究路线。</p></div>',

      '<div class="card"><h3>⚠️ 关于效果，必须说清楚</h3>',
      '<p class="small">这是一个<b>辅助工具</b>，不是治疗。关于认知训练，目前证据大致是：</p>',
      '<ul class="small">',
      '<li><b>近迁移是可靠的</b>：练什么，什么就会变好（练了数字广度，数字广度会提高）。</li>',
      '<li><b>远迁移有限且不一致</b>：工作记忆训练（如 Cogmed 一类）能提高被训练的任务，但<b>对课堂表现、学业成绩的改善，多项荟萃分析结论并不乐观</b>。任何宣称"练了注意力就能提高成绩"的说法都要打折扣。</li>',
      '<li>所以本程序特意在每天练完后安排了"<b>马上用在真实任务上</b>"的环节——迁移不会自动发生，要主动搭桥。</li>',
      '</ul>',
      '<p class="small">对 ADHD（尤其是安静型/注意缺陷为主型），<b>证据更强的干预</b>是：行为管理与家长训练、学校端的支持与调整（座位、任务拆分、书面提示）、规律作息与运动，以及在医生评估下的必要药物治疗。这些是主线，本程序是配菜。</p>',
      '<p class="small"><b>请不要把这里的任何数字当作诊断依据。</b>导出的 CSV 可以作为"家庭观察记录"给医生或老师参考，但它不是标准化测验，没有常模，不能算分数等级。如果还没有做过正式评估，建议先到正规医院儿童保健科/发育行为儿科或儿童心理科就诊。</p>',
      '</div>',

      '<div class="card"><h3>针对听写 / 写汉字 / 背书的具体做法</h3>',
      '<p class="small">这三件事痛苦的根源通常是<b>工作记忆容量小</b>，而不是态度问题。对应的办法是"减少要端住的东西"：</p>',
      '<h4>听写</h4><ul class="small">',
      '<li>念之前先说"听完<b>先复述</b>再写"。复述一遍能把听觉信息转成更稳的形式。</li>',
      '<li>一次只念一个词，<b>不要连着念三个</b>。等他写完再念下一个。</li>',
      '<li>错的字不要罚抄十遍。<b>只抄 2 遍，但要说出它由哪几个部件组成</b>。</li>',
      '</ul>',
      '<h4>写汉字</h4><ul class="small">',
      '<li>写前拆部件："请＝言＋青"，"睛＝目＋青"。部件化之后要记的"块"从十几笔变成 2 块。</li>',
      '<li>把形近字<b>成组学</b>（清/请/晴/睛/情），并各配一个短语。程序里的"划消找字"和"汉字闪记"用的就是这些字组。</li>',
      '<li>田字格里先标<b>关键笔画的位置</b>再写，减少边看边写的来回切换。</li>',
      '</ul>',
      '<h4>背书</h4><ul class="small">',
      '<li><b>分段</b>：一次只背 2 句，背熟再加。别整段硬来。</li>',
      '<li><b>检索练习</b>：合上书自己说，卡住了再看一眼。这比反复朗读有效得多（这是学习科学里证据最强的方法之一）。</li>',
      '<li><b>间隔</b>：今天背、明天再回忆一次、三天后再一次。比今天连背一小时强。</li>',
      '</ul>',
      '<h4>写作业的环境</h4><ul class="small">',
      '<li>桌面只留<b>当前这一科</b>的东西，其余收走（对抗干扰能力弱的直接补偿）。</li>',
      '<li>用可视计时器，<b>10–15 分钟一段</b>，到点必须休息 2 分钟。</li>',
      '<li>作业清单写在纸上贴着，做完一项划一项（把工作记忆的负担挪到纸上）。</li>',
      '</ul></div>',

      '<div class="card"><h3>数据安全</h3><ul class="small">',
      '<li>所有数据只存在这台电脑的浏览器本地，<b>不会上传到任何服务器</b>，程序也不需要联网。</li>',
      '<li>清理浏览器缓存/换浏览器会丢数据，所以请<b>每周导出一次 JSON 备份</b>，放到网盘或其它文件夹。</li>',
      '<li>换电脑或想合并多台设备的记录：在新电脑上用"导入备份→合并"。</li>',
      '</ul></div>'
    ].join('');
  }

  /* ================= 启动 ================= */
  document.addEventListener('DOMContentLoaded', function () {
    U.$$('.tab').forEach(function (b) { b.onclick = function () { show(b.dataset.view); }; });
    document.addEventListener('click', function () { App.sound.unlock(); }, { once: true });
    show('home');
  });
})();
