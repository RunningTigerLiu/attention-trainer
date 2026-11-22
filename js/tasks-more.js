/* tasks-more.js — 新增任务：
   14. 拼音拼读（语音意识，语言维度）
   15. 视觉搜索（特征/联合搜索，选择性注意）
   16. 规则切换（DCCS 变式，认知灵活性）
   全部按 2 分钟结算。 */
(function () {
  'use strict';
  var App = window.App, U = App.util, E = App.engine;

  /* ======================================================================
     14. 拼音拼读（声母 + 韵母 → 音节；听音选拼音）
     ====================================================================== */
  var PY_RAW = [
    ['b', 'ā', '八'], ['b', 'á', '拔'], ['b', 'ǎ', '把'], ['b', 'à', '爸'],
    ['p', 'ā', '趴'], ['p', 'á', '爬'], ['p', 'à', '怕'],
    ['m', 'ā', '妈'], ['m', 'á', '麻'], ['m', 'ǎ', '马'], ['m', 'à', '骂'],
    ['f', 'ā', '发'], ['f', 'á', '罚'],
    ['d', 'ā', '搭'], ['d', 'á', '达'], ['d', 'ǎ', '打'], ['d', 'à', '大'],
    ['t', 'ā', '他'], ['t', 'ǎ', '塔'], ['t', 'à', '踏'],
    ['n', 'á', '拿'], ['n', 'ǎ', '哪'], ['n', 'à', '那'],
    ['l', 'ā', '拉'], ['l', 'à', '辣'],
    ['g', 'ē', '哥'], ['g', 'é', '格'], ['g', 'è', '个'],
    ['k', 'ē', '科'], ['k', 'ě', '渴'], ['k', 'è', '课'],
    ['h', 'ē', '喝'], ['h', 'é', '河'], ['h', 'è', '贺'],
    ['j', 'ī', '鸡'], ['j', 'í', '急'], ['j', 'ǐ', '几'], ['j', 'ì', '记'],
    ['q', 'ī', '七'], ['q', 'í', '骑'], ['q', 'ǐ', '起'], ['q', 'ì', '气'],
    ['x', 'ī', '西'], ['x', 'í', '习'], ['x', 'ǐ', '洗'], ['x', 'ì', '戏'],
    ['zh', 'ī', '知'], ['zh', 'í', '直'], ['zh', 'ǐ', '纸'], ['zh', 'ì', '志'],
    ['ch', 'ī', '吃'], ['ch', 'í', '迟'], ['ch', 'ǐ', '尺'], ['ch', 'ì', '翅'],
    ['sh', 'ī', '师'], ['sh', 'í', '十'], ['sh', 'ǐ', '使'], ['sh', 'ì', '是'],
    ['r', 'ì', '日'],
    ['z', 'ī', '资'], ['z', 'ǐ', '子'], ['z', 'ì', '字'],
    ['c', 'ì', '次'],
    ['s', 'ī', '丝'], ['s', 'ǐ', '死'], ['s', 'ì', '四'],
    ['b', 'ō', '波'], ['b', 'ó', '伯'], ['p', 'ō', '坡'], ['p', 'ó', '婆'], ['p', 'ò', '破'],
    ['m', 'ō', '摸'], ['m', 'ó', '魔'], ['m', 'ò', '墨'],
    ['d', 'é', '德'], ['t', 'è', '特'],
    ['g', 'ū', '姑'], ['g', 'ǔ', '骨'], ['g', 'ù', '故'],
    ['k', 'ū', '哭'], ['k', 'ǔ', '苦'], ['k', 'ù', '裤'],
    ['h', 'ū', '呼'], ['h', 'ú', '湖'], ['h', 'ǔ', '虎'], ['h', 'ù', '户'],
    ['j', 'ū', '居'], ['j', 'ú', '橘'], ['j', 'ǔ', '举'], ['j', 'ù', '句'],
    ['q', 'ū', '区'], ['q', 'ú', '渠'], ['q', 'ǔ', '取'], ['q', 'ù', '去'],
    ['x', 'ū', '需'], ['x', 'ú', '徐'], ['x', 'ǔ', '许'], ['x', 'ù', '续'],
    ['zh', 'ū', '猪'], ['zh', 'ú', '竹'], ['zh', 'ǔ', '煮'], ['zh', 'ù', '住'],
    ['ch', 'ū', '出'], ['ch', 'ú', '除'], ['ch', 'ǔ', '楚'], ['ch', 'ù', '处'],
    ['sh', 'ū', '书'], ['sh', 'ú', '熟'], ['sh', 'ǔ', '鼠'], ['sh', 'ù', '树'],
    ['r', 'ú', '如'], ['r', 'ǔ', '乳'], ['r', 'ù', '入'],
    ['z', 'ū', '租'], ['z', 'ú', '足'], ['z', 'ǔ', '组'],
    ['c', 'ū', '粗'], ['c', 'ù', '醋'],
    ['s', 'ū', '苏'], ['s', 'ú', '俗'], ['s', 'ù', '速']
  ];
  var TONE_BASE = {
    'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
    'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
    'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
    'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
    'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
    'ǖ': 'v', 'ǘ': 'v', 'ǚ': 'v', 'ǜ': 'v'
  };
  var CONF_INIT = {
    b: ['p', 'm', 'f'], p: ['b', 'm', 'f'], m: ['b', 'p', 'f'], f: ['b', 'p'],
    d: ['t', 'n', 'l'], t: ['d', 'n', 'l'], n: ['l', 'd', 't'], l: ['n', 'd'],
    g: ['k', 'h'], k: ['g', 'h'], h: ['g', 'k'],
    j: ['q', 'x'], q: ['j', 'x'], x: ['j', 'q'],
    zh: ['ch', 'sh', 'z'], ch: ['zh', 'sh', 'c'], sh: ['zh', 'ch', 's'],
    z: ['c', 's', 'zh'], c: ['z', 's', 'ch'], s: ['z', 'c', 'sh'], r: ['l']
  };
  var PY = [];
  (function () {
    var seen = {};
    PY_RAW.forEach(function (x) {
      var all = x[0] + x[1];
      if (seen[all]) return;
      seen[all] = 1;
      PY.push({ i: x[0], f: x[1], ch: x[2], all: all, base: TONE_BASE[x[1]] || x[1] });
    });
  })();

  var PYL = [
    { opts: 3, mode: 'diff' }, { opts: 4, mode: 'initial' }, { opts: 4, mode: 'confuse' },
    { opts: 4, mode: 'final' }, { opts: 4, mode: 'tone' }, { opts: 5, mode: 'mix' }
  ];

  function pyCandidates(target, mode) {
    var out = PY.filter(function (x) { return x.all !== target.all; });
    function by(fn) { return out.filter(fn); }
    if (mode === 'diff') return by(function (x) { return x.i !== target.i && x.base !== target.base; });
    if (mode === 'initial') return by(function (x) { return x.i !== target.i && x.base === target.base && x.f === target.f; });
    if (mode === 'confuse') return by(function (x) { return (CONF_INIT[target.i] || []).indexOf(x.i) >= 0 && x.base === target.base; });
    if (mode === 'final') return by(function (x) { return x.i === target.i && x.base !== target.base; });
    if (mode === 'tone') return by(function (x) { return x.i === target.i && x.base === target.base; });
    return out;
  }
  function pyOptions(target, cfg) {
    var pool = pyCandidates(target, cfg.mode);
    if (pool.length < cfg.opts - 1) pool = pyCandidates(target, 'mix');
    pool = U.shuffle(pool).slice(0, cfg.opts - 1);
    return U.shuffle([target].concat(pool));
  }

  App.tasks.register({
    id: 'pinyin', name: '拼音拼读', icon: '🔤', domain: 'lang',
    levels: 6, startLevel: 1, up: 86, down: 40, dur: '约 2 分钟',
    why: '听一个字的读音，选出它的声母和韵母。练的是语音意识——把"听到的音"拆成部件，这是拼音拼读和认字的底层能力。',
    origin: '语音意识训练（phonological awareness）+ 汉语拼音两拼法，是阅读习得研究里预测力最强的基础能力之一。',
    transfer: '拼读不敢开口的孩子，常常是"听得出、拆不开"。练完可以拿他的名字或熟悉的词练两拼：先慢后快，不急着纠正发音。',
    levelName: function (l) {
      var m = { diff: '选项差别大', initial: '换声母', confuse: '形近声母', final: '换韵母', tone: '辨声调', mix: '混合干扰' };
      return PYL[l - 1].opts + ' 选 1 · ' + m[PYL[l - 1].mode];
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
      var cfg = PYL[ctx.level - 1];
      var LIMIT = E.TASK_MS, startedAt = 0, pi = 0, answered = 0, correct = 0, rts = [], finished = false;
      var canSpeak = App.speech.available() && App.store.settings().speech;

      E.screen(root, {
        title: '拼音拼读',
        intro: canSpeak
          ? '<p>听一个字的读音，选出它对应的 <b>声母 + 韵母</b>。</p>'
          : '<p><b>（本机没有中文语音，改为看字选拼音）</b></p>',
        tips: [
          '例如听到「八」，就选 <b>b + ā</b>。',
          '注意<b>声调</b>：ā á ǎ à 是四个不同的音。',
          '不确定可以点「再听一次」。',
          '一共做 <b>2 分钟</b>，时间到自动结束。'
        ],
        btn: '开始', onStart: function () {
          E.countdown(App.stage.clear(), function () { startedAt = performance.now(); runTrial(); });
        }
      });

      function sayTarget(ch) {
        App.speech.cancel();
        App.speech.say(ch, null, 0.65);
      }

      function runTrial() {
        if (finished) return;
        if (pi > 0 && performance.now() - startedAt >= LIMIT) return finish();
        pi++;
        var target = U.pick(PY);
        var options = pyOptions(target, cfg);

        var r = App.stage.clear();
        var pad = U.el('div', 'stagePad');
        var head = U.el('div', 'pill y', canSpeak ? '听一听，这个音是谁？' : '这个字怎么拼？');
        var charBox = U.el('div', 'pyChar', canSpeak ? '🔊' : target.ch);
        var again = U.el('button', 'btn small', canSpeak ? '🔊 再听一次' : '看字选拼音');
        var tip = U.el('div', 'muted small', '');
        var opts = U.el('div', 'pyOpts');
        pad.appendChild(head); pad.appendChild(charBox);
        if (canSpeak) pad.appendChild(again);
        pad.appendChild(opts); pad.appendChild(tip);
        r.appendChild(pad);
        App.stage.setProgress((performance.now() - startedAt) / LIMIT, '第 ' + pi + ' 题 · ' + E.leftText(LIMIT, startedAt));
        E.T(function () { finish(); }, Math.max(300, LIMIT - (performance.now() - startedAt)));

        if (canSpeak) sayTarget(target.ch);
        again.addEventListener('click', function () { if (canSpeak) sayTarget(target.ch); });

        var t0 = performance.now(), locked = false;
        var btns = options.map(function (o) {
          var b = U.el('button', null, o.i + ' + ' + o.f);
          b.addEventListener('click', function () { answer(o, b); });
          opts.appendChild(b);
          return b;
        });

        function answer(o, el) {
          if (locked || finished) return;
          locked = true;
          var rt = Math.round(performance.now() - t0);
          rts.push(rt); answered++;
          var ok = o.all === target.all;
          if (ok) { correct++; el.classList.add('ok'); tip.textContent = '✓ 对了'; App.sound.ok(); }
          else {
            el.classList.add('bad'); tip.textContent = '✗ 正确答案是 ' + target.i + ' + ' + target.f; App.sound.bad();
            btns.forEach(function (b) { if (b.textContent === target.i + ' + ' + target.f) b.classList.add('ok'); });
          }
          btns.forEach(function (b) { b.disabled = true; });
          E.T(runTrial, ok ? 800 : 1400);
        }
      }

      function finish() {
        if (finished) return;
        finished = true;
        var n = Math.max(1, answered);
        var acc = correct / n;
        var chance = 1 / cfg.opts;
        var score = U.clamp(Math.round(100 * (acc - chance) / (1 - chance)), 0, 100);
        var res = E.finishTask(ctx, {
          score: score,
          metrics: {
            correct: correct, trials: answered, acc: Math.round(acc * 100),
            rt: U.r0(U.mean(rts)), options: cfg.opts, mode: cfg.mode,
            modality: canSpeak ? 'auditory' : 'visual'
          }
        });
        E.resultScreen(App.stage.clear(), res, function () { ctx.onFinish(res); });
      }
    }
  });

  /* ======================================================================
     15. 视觉搜索（特征搜索 / 联合搜索）
     ====================================================================== */
  var VSL = [
    { n: 8, conj: false, size: 56 }, { n: 12, conj: false, size: 52 },
    { n: 16, conj: true, size: 50 }, { n: 20, conj: true, size: 46 },
    { n: 24, conj: true, size: 42 }, { n: 30, conj: true, size: 38 }
  ];

  App.tasks.register({
    id: 'vsearch', name: '视觉搜索', icon: '🔎', domain: 'selective',
    levels: 6, startLevel: 1, up: 86, down: 42, dur: '约 2 分钟',
    why: '在一堆相似图形里快速锁定目标。特征搜索考"一眼看到"，联合搜索考"逐个排除"，两条通路都要练。',
    origin: '特征搜索与联合搜索范式（Treisman & Gelade, 1980），视觉注意研究中最经典的搜索任务。',
    transfer: '做题漏字、抄题串行、找东西慢，都和视觉搜索有关。练完可以用"手指点着、一行一行扫"的方法检查作业。',
    levelName: function (l) {
      var c = VSL[l - 1];
      return c.n + ' 个图形 · ' + (c.conj ? '联合搜索' : '特征搜索');
    },
    metricDefs: [
      { key: 'avgSec', name: '每题用时(秒)', better: 'low' },
      { key: 'errors', name: '点错次数', better: 'low' },
      { key: 'rounds', name: '完成题数', better: 'high' }
    ],
    report: function (r) {
      var m = r.metrics;
      return [['完成', m.rounds + ' 题'], ['每题用时', U.sec(m.avgSec)], ['点错', m.errors + ' 次']];
    },
    mount: function (root, ctx) {
      var cfg = VSL[ctx.level - 1];
      var LIMIT = E.TASK_MS, startedAt = 0, finished = false;
      var round = 0, errors = 0, roundTimes = [], roundT0 = 0;
      var CS = [App.COLORS[0], App.COLORS[2]];       // 红 / 蓝
      var SS = [App.SHAPES[0], App.SHAPES[1]];       // 圆形 / 正方形

      E.screen(root, {
        title: '视觉搜索',
        intro: '<p>屏幕上会有一个<b>目标图形</b>混在别的图形里，尽快把它点出来。</p>',
        tips: [
          '上面会写要找什么，例如「红色的圆形」。',
          '低关卡目标很显眼；高关卡会有<b>颜色和形状各像一半</b>的干扰项。',
          '点错了会抖一下，继续找。',
          '一共做 <b>2 分钟</b>，时间到自动结束。'
        ],
        btn: '开始', onStart: function () {
          E.countdown(App.stage.clear(), function () {
            startedAt = performance.now();
            (function tick() {
              if (finished) return;
              App.stage.setProgress((performance.now() - startedAt) / LIMIT, E.leftText(LIMIT, startedAt));
              E.T(tick, 500);
            })();
            runRound();
          });
        }
      });

      function makeBoard(target) {
        var items = [{ shape: target.shape, color: target.color, hit: true }];
        var otherC = CS.filter(function (x) { return x.key !== target.color.key; });
        var otherS = SS.filter(function (x) { return x.key !== target.shape.key; });
        /* 特征搜索：只在一个维度上突出（全是蓝圆找红圆，或全是红方找红圆） */
        var featureByColor = Math.random() < 0.5;
        for (var i = 1; i < cfg.n; i++) {
          var s, c;
          if (!cfg.conj) {
            if (featureByColor) { s = target.shape; c = U.pick(otherC); }
            else { s = U.pick(otherS); c = target.color; }
          } else {
            /* 联合搜索：一半共享颜色、一半共享形状，必须逐个比对 */
            if (Math.random() < 0.5) { s = target.shape; c = U.pick(otherC); }
            else { s = U.pick(otherS); c = target.color; }
          }
          items.push({ shape: s, color: c, hit: false });
        }
        return U.shuffle(items);
      }

      function runRound() {
        if (finished) return;
        if (round > 0 && performance.now() - startedAt >= LIMIT) return finish();
        round++;
        var target = { shape: U.pick(SS), color: U.pick(CS) };
        var items = makeBoard(target);

        var r = App.stage.clear();
        var pad = U.el('div', 'stagePad');
        var bar = U.el('div', 'flexline');
        var lbl = U.html('div', 'pill y', '找 ' + target.color.name + '的' + target.shape.name);
        var clock = U.el('span', 'muted small', '');
        bar.appendChild(lbl); bar.appendChild(clock);
        pad.appendChild(bar);

        var board = U.el('div', 'vsearchBoard');
        board.style.width = 'min(92vw, 620px)';
        pad.appendChild(board);
        r.appendChild(pad);
        App.stage.setProgress((performance.now() - startedAt) / LIMIT, E.leftText(LIMIT, startedAt));

        /* 布点：随机位置 + 最小间距（百分比） */
        var pts = [], tries = 0;
        var minD = Math.max(7, (cfg.size + 8) / 6.2);
        while (pts.length < items.length && tries < 4000) {
          tries++;
          var p = { x: 4 + Math.random() * 92, y: 4 + Math.random() * 92 };
          var ok = pts.every(function (q) { return Math.hypot(q.x - p.x, q.y - p.y) > minD; });
          if (ok) pts.push(p);
        }
        while (pts.length < items.length) pts.push({ x: 4 + Math.random() * 92, y: 4 + Math.random() * 92 });

        roundT0 = performance.now();
        clock.textContent = E.leftText(LIMIT, startedAt);
        E.T(function () { finish(); }, Math.max(300, LIMIT - (performance.now() - startedAt)));

        items.forEach(function (it, k) {
          var d = U.html('div', 'vsearchItem', App.shapeSVG(it.shape, it.color.hex, cfg.size));
          d.style.left = pts[k].x + '%'; d.style.top = pts[k].y + '%';
          d.addEventListener('click', function () {
            if (finished) return;
            if (it.hit) {
              roundTimes.push((performance.now() - roundT0) / 1000);
              App.sound.ok();
              d.classList.add('found');
              E.T(function () { if (!finished) runRound(); }, 380);
            } else {
              errors++; App.sound.bad();
              d.classList.add('shake');
              E.T(function () { d.classList.remove('shake'); }, 340);
            }
          });
          board.appendChild(d);
        });
      }

      function finish() {
        if (finished) return;
        finished = true;
        var avg = U.mean(roundTimes);
        var score = avg == null ? 0 : E.speedScore(avg, 2.0, 6.0) - errors * 3;
        var res = E.finishTask(ctx, {
          score: U.clamp(score, 0, 100),
          metrics: {
            rounds: roundTimes.length, avgSec: U.r1(avg), errors: errors,
            items: cfg.n, conj: cfg.conj ? 1 : 0
          }
        });
        E.resultScreen(App.stage.clear(), res, function () { ctx.onFinish(res); });
      }
    }
  });

  /* ======================================================================
     16. 规则切换（DCCS：按颜色 / 按形状，规则会变）
     ====================================================================== */
  var SWL = [
    { block: 999 }, { block: 6 }, { block: 4 }, { block: 3 }, { block: 2 }, { block: 1 }
  ];
  var SW_CARDS = [
    { s: 'circle', c: 0 }, { s: 'circle', c: 2 },
    { s: 'square', c: 0 }, { s: 'square', c: 2 }
  ];

  App.tasks.register({
    id: 'switch', name: '规则切换', icon: '🔀', domain: 'flex',
    levels: 6, startLevel: 1, up: 86, down: 42, dur: '约 2 分钟',
    why: '先按一个规则分卡片，规则一变就要换一套判断方式。练的是"停下来、换规则、再行动"。',
    origin: '维度变化卡片分类任务（Dimensional Change Card Sort, DCCS），测认知灵活性的标准范式。',
    transfer: '切换弱的孩子换科目、换题型会卡住。练完在作业切换时给一句明确提示："现在开始做数学了"，帮他把规则切过来。',
    levelName: function (l) {
      var b = SWL[l - 1].block;
      return b >= 999 ? '一直按颜色' : (b === 1 ? '每题换规则' : '每 ' + b + ' 题换规则');
    },
    metricDefs: [
      { key: 'acc', name: '正确率(%)', better: 'high' },
      { key: 'switchEffect', name: '切换代价(ms)', better: 'low' }
    ],
    report: function (r) {
      var m = r.metrics;
      return [['正确率', m.acc + '%'], ['切换代价', U.ms(m.switchEffect)], ['题数', m.trials]];
    },
    mount: function (root, ctx) {
      var cfg = SWL[ctx.level - 1];
      var LIMIT = E.TASK_MS, startedAt = 0, pi = 0, answered = 0, correct = 0, finished = false;
      var rule = 'color';      // color | shape
      var rows = [];

      E.screen(root, {
        title: '规则切换',
        intro: '<p>卡片要按<b>上面的规则</b>放进两个筐里，规则会突然变。</p>',
        tips: [
          '规则写在上方：<b>按颜色分</b> 或 <b>按形状分</b>。',
          '按颜色分：红色放红筐、蓝色放蓝筐。',
          '按形状分：圆形放圆筐、正方形放方筐。',
          '规则变了会提示，<b>别按上一题的规则接着做</b>。',
          '一共做 <b>2 分钟</b>，时间到自动结束。'
        ],
        btn: '开始', onStart: function () {
          E.countdown(App.stage.clear(), function () { startedAt = performance.now(); runTrial(); });
        }
      });

      function runTrial() {
        if (finished) return;
        if (pi > 0 && performance.now() - startedAt >= LIMIT) return finish();
        var isSwitch = pi > 0 && pi % cfg.block === 0;
        if (isSwitch) rule = rule === 'color' ? 'shape' : 'color';
        pi++;

        var card = U.pick(SW_CARDS);
        var r = App.stage.clear();
        var pad = U.el('div', 'stagePad');
        var head = U.html('div', 'pill ' + (rule === 'color' ? 'y' : 'n'),
          rule === 'color' ? '按颜色分' : '按形状分');
        if (isSwitch) head.classList.add('switched');
        var cardBox = U.html('div', 'switchCard',
          App.shapeSVG(App.SHAPES[card.s === 'circle' ? 0 : 1], App.COLORS[card.c].hex, 110));
        var tip = U.el('div', 'muted small', '');
        var bins = U.el('div', 'switchBins');
        pad.appendChild(head); pad.appendChild(cardBox); pad.appendChild(bins); pad.appendChild(tip);
        r.appendChild(pad);
        App.stage.setProgress((performance.now() - startedAt) / LIMIT, '第 ' + pi + ' 题 · ' + E.leftText(LIMIT, startedAt));
        E.T(function () { finish(); }, Math.max(300, LIMIT - (performance.now() - startedAt)));

        /* 两个筐：颜色规则用红/蓝方块，形状规则用圆/方块（灰色） */
        var binDefs = rule === 'color'
          ? [
            { label: '红色', svg: App.shapeSVG(App.SHAPES[1], App.COLORS[0].hex, 54), key: 'red' },
            { label: '蓝色', svg: App.shapeSVG(App.SHAPES[1], App.COLORS[2].hex, 54), key: 'blue' }
          ]
          : [
            { label: '圆形', svg: App.shapeSVG(App.SHAPES[0], '#8a97a3', 54), key: 'circle' },
            { label: '正方形', svg: App.shapeSVG(App.SHAPES[1], '#8a97a3', 54), key: 'square' }
          ];
        var want = rule === 'color'
          ? (card.c === 0 ? 0 : 1)
          : (card.s === 'circle' ? 0 : 1);

        var t0 = performance.now(), locked = false;
        var binEls = binDefs.map(function (bd, idx) {
          var b = U.html('button', 'switchBin', bd.svg + '<span>' + bd.label + '</span>');
          b.addEventListener('click', function () { answer(idx, b); });
          bins.appendChild(b);
          return b;
        });

        function answer(idx, el) {
          if (locked || finished) return;
          locked = true;
          var rt = Math.round(performance.now() - t0);
          rows.push({ correct: idx === want, rt: rt, isSwitch: isSwitch });
          answered++;
          var ok = idx === want;
          if (ok) { correct++; el.classList.add('ok'); tip.textContent = '✓ 对了'; App.sound.ok(); }
          else { el.classList.add('bad'); binEls[want].classList.add('ok'); tip.textContent = '✗ 应该放这边'; App.sound.bad(); }
          binEls.forEach(function (b) { b.disabled = true; });
          E.T(runTrial, ok ? 750 : 1300);
        }
      }

      function finish() {
        if (finished) return;
        finished = true;
        var n = Math.max(1, answered);
        var acc = correct / n;
        function meanRT(f) {
          var a = rows.filter(f).map(function (x) { return x.rt; });
          return a.length ? U.mean(a) : null;
        }
        var rs = meanRT(function (r) { return r.isSwitch; });
        var rr = meanRT(function (r) { return !r.isSwitch; });
        var eff = (rs != null && rr != null) ? rs - rr : null;
        var switchScore = eff == null ? 60 : U.clamp((700 - eff) / 600 * 100, 0, 100);
        var score = U.clamp(0.75 * acc * 100 + 0.25 * switchScore, 0, 100);
        var res = E.finishTask(ctx, {
          score: score,
          metrics: {
            correct: correct, trials: answered, acc: Math.round(acc * 100),
            switchEffect: U.r0(eff), rt: U.r0(U.mean(rows.map(function (x) { return x.rt; })))
          }
        });
        E.resultScreen(App.stage.clear(), res, function () { ctx.onFinish(res); });
      }
    }
  });
})();
