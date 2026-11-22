/* analysis.js — 图表、自动解读、CSV 导出 */
(function () {
  'use strict';
  var App = window.App, U = App.util;
  var PAL = ['#2f6f8f', '#3f9b6d', '#c07a2c', '#8259b3', '#c0564a', '#4a8fa8'];

  /* ================= SVG 折线图 ================= */
  /* series: [{name,color,pts:[number|null]}]，xLabels: [string] */
  App.chart = {};
  App.chart.line = function (series, xLabels, opt) {
    opt = opt || {};
    var W = 760, H = opt.h || 200, PL = 48, PR = 16, PT = 14, PB = 30;
    var n = xLabels.length;
    var vals = [];
    series.forEach(function (s) { s.pts.forEach(function (v) { if (v != null && isFinite(v)) vals.push(v); }); });
    if (!vals.length) return '<p class="muted small">还没有数据。</p>';
    var lo = opt.yMin != null ? opt.yMin : Math.min.apply(null, vals);
    var hi = opt.yMax != null ? opt.yMax : Math.max.apply(null, vals);
    if (hi === lo) { hi = lo + 1; lo = Math.max(0, lo - 1); }
    var padY = (hi - lo) * 0.12; lo = opt.yMin != null ? lo : lo - padY; hi = opt.yMax != null ? hi : hi + padY;
    if (opt.zeroBase && lo > 0) lo = 0;
    function X(i) { return PL + (W - PL - PR) * (n <= 1 ? 0.5 : i / (n - 1)); }
    function Y(v) { return H - PB - (v - lo) / (hi - lo) * (H - PT - PB); }

    var out = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '">';
    var k, gy;
    for (k = 0; k <= 4; k++) {
      gy = PT + (H - PT - PB) * k / 4;
      var gv = hi - (hi - lo) * k / 4;
      out += '<line class="gl" x1="' + PL + '" y1="' + gy.toFixed(1) + '" x2="' + (W - PR) + '" y2="' + gy.toFixed(1) + '"/>';
      out += '<text x="' + (PL - 7) + '" y="' + (gy + 4).toFixed(1) + '" text-anchor="end">' + (Math.round(gv * 10) / 10) + '</text>';
    }
    out += '<line class="axis" x1="' + PL + '" y1="' + (H - PB) + '" x2="' + (W - PR) + '" y2="' + (H - PB) + '"/>';
    var step = Math.max(1, Math.ceil(n / 8));
    for (k = 0; k < n; k += step) {
      out += '<text x="' + X(k).toFixed(1) + '" y="' + (H - PB + 16) + '" text-anchor="middle">' + xLabels[k] + '</text>';
    }
    series.forEach(function (s, si) {
      var col = s.color || PAL[si % PAL.length], d = '', open = false;
      s.pts.forEach(function (v, i) {
        if (v == null || !isFinite(v)) { open = false; return; }
        d += (open ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1) + ' ';
        open = true;
      });
      out += '<path class="ln" d="' + d + '" stroke="' + col + '"/>';
      s.pts.forEach(function (v, i) {
        if (v == null || !isFinite(v)) return;
        out += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="3" fill="' + col + '"/>';
      });
      // 趋势线
      var ys = s.pts.filter(function (v) { return v != null && isFinite(v); });
      if (opt.trend && ys.length >= 4) {
        var sl = U.slope(ys), m = U.mean(ys);
        var y0 = m - sl * (ys.length - 1) / 2, y1 = m + sl * (ys.length - 1) / 2;
        out += '<line x1="' + X(0).toFixed(1) + '" y1="' + Y(y0).toFixed(1) + '" x2="' + X(n - 1).toFixed(1) +
          '" y2="' + Y(y1).toFixed(1) + '" stroke="' + col + '" stroke-width="1" stroke-dasharray="5 4" opacity=".55"/>';
      }
    });
    out += '</svg>';
    var leg = '<div class="legend">' + series.map(function (s, si) {
      return '<span><i style="background:' + (s.color || PAL[si % PAL.length]) + '"></i>' + s.name + '</span>';
    }).join('') + (opt.trend ? '<span class="muted">虚线＝趋势</span>' : '') + '</div>';
    return '<div class="chartBox">' + out + '</div>' + leg;
  };

  /* ================= 雷达图 ================= */
  App.chart.radar = function (axes, series) {
    var S = 300, C = S / 2, R = 104;
    var n = axes.length, out = '<svg class="chart" viewBox="0 0 ' + S + ' ' + (S + 10) + '" style="min-width:300px;max-width:360px;margin:0 auto">';
    function pt(i, f) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / n;
      return [C + Math.cos(a) * R * f, C + Math.sin(a) * R * f];
    }
    [0.25, 0.5, 0.75, 1].forEach(function (f) {
      var p = U.range(n).map(function (i) { return pt(i, f).map(function (v) { return v.toFixed(1); }).join(','); }).join(' ');
      out += '<polygon points="' + p + '" fill="none" stroke="#e3e7eb"/>';
    });
    U.range(n).forEach(function (i) {
      var e = pt(i, 1);
      out += '<line x1="' + C + '" y1="' + C + '" x2="' + e[0].toFixed(1) + '" y2="' + e[1].toFixed(1) + '" stroke="#e3e7eb"/>';
      var l = pt(i, 1.26);
      out += '<text x="' + l[0].toFixed(1) + '" y="' + (l[1] + 4).toFixed(1) + '" text-anchor="middle" font-size="11">' + axes[i] + '</text>';
    });
    series.forEach(function (s, si) {
      var col = s.color || PAL[si], p = s.vals.map(function (v, i) {
        return pt(i, U.clamp((v == null ? 0 : v) / 100, 0, 1)).map(function (x) { return x.toFixed(1); }).join(',');
      }).join(' ');
      out += '<polygon points="' + p + '" fill="' + col + '" fill-opacity="' + (si === 0 ? '.10' : '.20') + '" stroke="' + col + '" stroke-width="2"/>';
    });
    out += '</svg>';
    var leg = '<div class="legend" style="justify-content:center">' + series.map(function (s, si) {
      return '<span><i style="background:' + (s.color || PAL[si]) + '"></i>' + s.name + '</span>';
    }).join('') + '</div>';
    return out + leg;
  };

  /* ================= 热力图（最近 N 周） ================= */
  App.chart.heat = function (weeks) {
    var byDate = {};
    App.store.data.sessions.forEach(function (s) {
      if (!s.results.length) return;
      byDate[s.date] = (byDate[s.date] || 0) + s.results.length;
    });
    var end = new Date(); end.setHours(0, 0, 0, 0);
    // 回到本周周日
    var endSun = U.addDays(end, 6 - end.getDay());
    var start = U.addDays(endSun, -(weeks * 7 - 1));
    var html = '<div class="heat">';
    for (var w = 0; w < weeks; w++) {
      html += '<div class="col">';
      for (var d = 0; d < 7; d++) {
        var dt = U.addDays(start, w * 7 + d), ds = U.dateStr(dt);
        var c = byDate[ds] || 0;
        var lv = c === 0 ? '' : c <= 1 ? 'l1' : c <= 2 ? 'l2' : c <= 4 ? 'l3' : 'l4';
        var future = dt > end;
        html += '<div class="hc ' + lv + '" title="' + ds + '：' + c + ' 项"' +
          (future ? ' style="opacity:.25"' : '') + '></div>';
      }
      html += '</div>';
    }
    html += '</div><div class="legend"><span class="muted">左→右＝' + weeks + ' 周前到本周，上→下＝周日到周六；颜色越深＝当天做的项目越多</span></div>';
    return html;
  };

  /* ================= 领域分数 ================= */
  function domainAvg(results) {
    var acc = {};
    Object.keys(App.domains).forEach(function (d) { acc[d] = []; });
    results.forEach(function (r) { if (acc[r.domain]) acc[r.domain].push(r.score); });
    var out = {};
    Object.keys(acc).forEach(function (d) { out[d] = acc[d].length ? U.mean(acc[d]) : null; });
    return out;
  }

  /* ================= 自动解读 ================= */
  App.analysis = {};
  App.analysis.insights = function () {
    var all = App.store.allResults(), ins = [];
    function add(kind, text) { ins.push({ kind: kind, text: text }); }
    if (all.length < 3) {
      add('', '数据还太少。<b>建议先连续练 5–7 天</b>，再来看这一页的趋势——单次成绩受睡眠、情绪影响很大，看一次没有意义。');
      return ins;
    }

    /* 1. 频率 */
    var days = App.store.activeDays(), today = U.today();
    var last14 = days.filter(function (d) { return U.daysBetween(d, today) <= 13; }).length;
    var st = App.store.streak();
    if (last14 >= 10) add('g', '近两周练了 <b>' + last14 + ' 天</b>，频率很好（当前连续 ' + st + ' 天）。认知训练的效果高度依赖频率，这一点你做到了。');
    else if (last14 >= 6) add('', '近两周练了 <b>' + last14 + ' 天</b>。研究里有效的方案基本是<b>每周 5 天以上、持续 5 周以上</b>，再往上提一点会更好。');
    else add('y', '近两周只练了 <b>' + last14 + ' 天</b>。频率偏低，很可能看不到任何变化。<b>宁可每天只做 2 项 8 分钟，也要尽量每天都做。</b>');

    /* 2. 各领域趋势 */
    var byDomain = {};
    all.forEach(function (r) { (byDomain[r.domain] = byDomain[r.domain] || []).push(r); });
    Object.keys(App.domains).forEach(function (d) {
      var list = byDomain[d] || [];
      if (list.length < 6) return;
      var recent = list.slice(-4), early = list.slice(0, 4);
      var rm = U.mean(recent.map(function (r) { return r.score; }));
      var em = U.mean(early.map(function (r) { return r.score; }));
      var diff = rm - em, nm = App.domains[d].name;
      if (diff >= 8) add('g', '<b>' + nm + '</b>：最近 4 次平均 ' + Math.round(rm) + ' 分，比最早 4 次（' + Math.round(em) + '）<b>提高了 ' + Math.round(diff) + ' 分</b>。');
      else if (diff <= -8) add('r', '<b>' + nm + '</b>：最近 4 次平均 ' + Math.round(rm) + ' 分，比最早 4 次<b>下降 ' + Math.round(-diff) + ' 分</b>。先排查睡眠、训练时段（别在太累的时候练）和难度是否跳太快。');
      else add('', '<b>' + nm + '</b>：基本持平（' + Math.round(em) + ' → ' + Math.round(rm) + ' 分）。注意成绩持平不等于没进步——难度关卡可能已经上去了。');
    });

    /* 3. 走神型 vs 冲动型（Go/No-Go） */
    var gg = App.store.resultsOf('gonogo').slice(-5);
    if (gg.length >= 2) {
      var om = U.mean(gg.map(function (r) { return r.metrics.omissions || 0; }));
      var co = U.mean(gg.map(function (r) { return r.metrics.commissions || 0; }));
      if (om > co * 1.6 && om >= 2)
        add('y', '红绿灯里<b>漏按绿灯（' + U.r1(om) + ' 次）明显多于误按红灯（' + U.r1(co) + ' 次）</b>，这是典型的<b>走神型</b>模式，和安静型 ADHD 吻合。对策：缩短单次任务时长、把作业切成 10 分钟一段、用计时器做外部提醒。');
      else if (co > om * 1.6 && co >= 2)
        add('y', '红绿灯里<b>误按红灯（' + U.r1(co) + ' 次）多于漏按（' + U.r1(om) + ' 次）</b>，偏<b>冲动/抢答型</b>。对策：练习前明确说"宁可慢一点"，做题时要求先把题读完再动笔。');
      else add('', '红绿灯里漏按与误按比较均衡（' + U.r1(om) + ' / ' + U.r1(co) + ' 次）。');
    }

    /* 4. 反应时稳定性（ADHD 的关键指标） */
    var cvSrc = [].concat(App.store.resultsOf('gonogo'), App.store.resultsOf('flanker'))
      .filter(function (r) { return r.metrics.cv != null; })
      .sort(function (a, b) { return a.at < b.at ? -1 : 1; });
    if (cvSrc.length >= 6) {
      var cvs = cvSrc.map(function (r) { return r.metrics.cv; });
      var sl = U.slope(cvs);
      var early = U.mean(cvs.slice(0, 3)), late = U.mean(cvs.slice(-3));
      if (sl != null && late < early - 2)
        add('g', '<b>反应时波动在下降</b>（' + U.r1(early) + '% → ' + U.r1(late) + '%）。反应忽快忽慢是 ADHD 最稳定的客观指标之一，它下降说明<b>注意力的"稳定性"在改善</b>，这比平均速度变快更有意义。');
      else if (sl != null && late > early + 2)
        add('y', '反应时波动在上升（' + U.r1(early) + '% → ' + U.r1(late) + '%），说明状态越来越不稳。检查一下：是不是练的时间太晚、单次做太多项、或难度升得太快。');
      else add('', '反应时波动基本稳定在 ' + U.r1(late) + '% 左右。（越小越好，说明每次反应速度都差不多）');
    }

    /* 5. 工作记忆广度 */
    ['digitspan', 'corsi', 'hanzi'].forEach(function (id) {
      var rs = App.store.resultsOf(id);
      if (rs.length < 4) return;
      var sp = rs.map(function (r) { return r.metrics.maxSpan; });
      var e = Math.max.apply(null, sp.slice(0, Math.ceil(sp.length / 2)));
      var l = Math.max.apply(null, sp.slice(-Math.ceil(sp.length / 2)));
      var nm = App.tasks.get(id).name;
      if (l > e) add('g', '<b>' + nm + '</b>：最长记住从 ' + e + ' 个提升到 <b>' + l + ' 个</b>。');
      else if (l < e) add('', '<b>' + nm + '</b>：最长 ' + l + ' 个，比之前的 ' + e + ' 个略降。广度本来就会上下浮动 1 个，看两周以上的最高值更准。');
      else add('', '<b>' + nm + '</b>：稳定在 ' + l + ' 个。想往上走，<b>必须教策略</b>（分组、复述、编故事），单纯重复练很容易卡住。');
    });

    /* 6. 听指令要重复几次 */
    var li = App.store.resultsOf('listen');
    if (li.length >= 4) {
      var rp = li.map(function (r) { return r.metrics.replays || 0; });
      var e2 = U.mean(rp.slice(0, Math.ceil(rp.length / 2))), l2 = U.mean(rp.slice(-Math.ceil(rp.length / 2)));
      if (l2 < e2 - 0.4) add('g', '<b>听指令</b>的"重听次数"从平均 ' + U.r1(e2) + ' 次降到 ' + U.r1(l2) + ' 次，一次就能听住的能力在变好——这项和听写最相关。');
      else if (l2 > 1.2) add('y', '<b>听指令</b>平均还要重听 ' + U.r1(l2) + ' 次。在家交代事情时请主动<b>一步一句</b>，并让孩子复述一遍再去做。');
    }

    /* 7. 切换成本（连点 B − A） */
    var ta = App.store.resultsOf('trails');
    var A = ta.filter(function (r) { return r.metrics.trailType === 'A'; }).slice(-3);
    var B = ta.filter(function (r) { return r.metrics.trailType === 'B'; }).slice(-3);
    if (A.length && B.length) {
      var am = U.mean(A.map(function (r) { return r.metrics.secPerItem; }));
      var bm = U.mean(B.map(function (r) { return r.metrics.secPerItem; }));
      var cost = (bm - am) / am * 100;
      add(cost > 110 ? 'y' : '', '<b>规则切换成本</b>：B 型每点用时比 A 型多 <b>' + Math.round(cost) + '%</b>' +
        (cost > 110 ? '，偏高。表现在生活里就是"换一件事就要缓很久"。换科目时给他 1 分钟过渡，别催。' : '，在合理范围。'));
    }

    /* 8. 家长观察 */
    var rated = App.store.data.sessions.filter(function (s) { return s.rating && s.rating.focusHw; });
    if (rated.length >= 5) {
      var hw = rated.map(function (s) { return s.rating.focusHw; });
      var mins = rated.filter(function (s) { return s.rating.hwMinutes; }).map(function (s) { return s.rating.hwMinutes; });
      var sh = U.slope(hw);
      if (sh != null && sh > 0.05) add('g', '你给的<b>作业专注评分在上升</b>（' + U.r1(U.mean(hw.slice(0, 3))) + ' → ' + U.r1(U.mean(hw.slice(-3))) + ' 分）。这是最值得看的一条——训练成绩提高但真实表现没变，意义就有限。');
      else if (sh != null && sh < -0.05) add('y', '你给的作业专注评分在下降。训练成绩和真实表现脱节时，优先调整<b>环境和作业拆分</b>，而不是加大训练量。');
      if (mins.length >= 5) {
        var m1 = U.mean(mins.slice(0, 3)), m2 = U.mean(mins.slice(-3));
        if (m2 < m1 * 0.85) add('g', '作业时长从约 ' + Math.round(m1) + ' 分钟降到 ' + Math.round(m2) + ' 分钟。');
        else if (m2 > m1 * 1.15) add('y', '作业时长从约 ' + Math.round(m1) + ' 分钟升到 ' + Math.round(m2) + ' 分钟，注意是不是作业量本身变了。');
      }
    } else {
      add('', '家长观察记录还不够（已记 ' + rated.length + ' 次）。<b>这一项比训练分数更重要</b>，每次练完花 30 秒填一下。');
    }

    /* 9. 长期卡关 / 没练过 */
    App.tasks.all().forEach(function (t) {
      var rs = App.store.resultsOf(t.id);
      if (rs.length === 0) { add('', '<b>' + t.name + '</b> 还没练过（' + App.domains[t.domain].name + '）。'); return; }
      if (rs.length >= 6) {
        var lv = rs.slice(-6).map(function (r) { return r.level; });
        if (Math.max.apply(null, lv) === Math.min.apply(null, lv) && U.mean(rs.slice(-4).map(function (r) { return r.score; })) < 65)
          add('y', '<b>' + t.name + '</b> 连续 6 次停在第 ' + lv[0] + ' 关且得分不高。这一关可能卡住了：重新把规则讲一遍，或到"设置"里关掉自适应手动降一关做几次建立信心。');
      }
    });

    return ins;
  };

  /* ================= CSV 导出 ================= */
  App.analysis.csv = function () {
    var all = App.store.allResults();
    var mkeys = {};
    all.forEach(function (r) { Object.keys(r.metrics || {}).forEach(function (k) { if (typeof r.metrics[k] !== 'object') mkeys[k] = 1; }); });
    var mk = Object.keys(mkeys).sort();
    var head = ['日期', '时间', '类型', '任务', '领域', '关卡', '得分', '星', '用时秒'].concat(mk);
    var rows = [head];
    var ratingByDate = {};
    App.store.data.sessions.forEach(function (s) { if (s.rating) ratingByDate[s.date] = s.rating; });
    all.forEach(function (r) {
      var row = [r.date, (r.at || '').slice(11, 19), r.kind === 'daily' ? '每日' : '练习',
        r.taskName, App.domains[r.domain] ? App.domains[r.domain].name : r.domain,
      r.level, r.score, r.stars, Math.round((r.durationMs || 0) / 1000)];
      mk.forEach(function (k) { row.push(r.metrics && r.metrics[k] != null ? r.metrics[k] : ''); });
      rows.push(row);
    });
    rows.push([]);
    rows.push(['家长观察记录']);
    rows.push(['日期', '上课专注', '作业专注', '情绪', '作业分钟', '备注']);
    App.store.data.sessions.forEach(function (s) {
      if (!s.rating) return;
      var g = s.rating;
      rows.push([s.date, g.focusClass || '', g.focusHw || '', g.mood || '', g.hwMinutes || '', (g.note || '').replace(/[\r\n]+/g, ' ')]);
    });
    return '﻿' + rows.map(function (r) {
      return r.map(function (c) {
        c = c == null ? '' : String(c);
        return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c;
      }).join(',');
    }).join('\n');
  };

  App.analysis.domainAvg = domainAvg;
})();
