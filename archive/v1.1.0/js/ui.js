/* ═══════════════════════════════════════════════
   آبرو — رابط کاربری
   ═══════════════════════════════════════════════ */
(function (A) {
  'use strict';

  var U = A.util, D = A.data, St = A.state;
  var $ = U.$, fa = U.fa, money = U.money, clamp = U.clamp;

  var tab = 'shop', sheetOn = false, mult = '1';
  var armPrestige = null, armReset = null;
  var goal = null, heatRef = 0;

  var TAB_TITLE = {
    shop: 'ایستگاه‌ها', crew: 'نیرو و جا', grow: 'رشد و واگذاری',
    book: 'دفترچه‌ی پدر', more: 'دفتر'
  };

  /* ═════════ تب و شیت ═════════ */
  function openTab(t) {
    if (sheetOn && tab === t) { closeSheet(); return; }
    tab = t; sheetOn = true;
    document.querySelectorAll('.tab').forEach(function (b) {
      b.classList.toggle('sel', b.dataset.tab === t);
    });
    $('shTitle').textContent = TAB_TITLE[t];
    $('multSeg').hidden = t !== 'shop';
    $('sheet').classList.add('on');
    $('scrim').classList.add('on');
    buildSheet();
    A.audio.sfx.open();
  }
  function closeSheet() {
    if (!sheetOn) return;
    sheetOn = false;
    $('sheet').classList.remove('on');
    $('scrim').classList.remove('on');
    document.querySelectorAll('.tab').forEach(function (b) { b.classList.remove('sel'); });
    A.audio.sfx.close();
  }
  function isSheetOpen() { return sheetOn; }

  /* ═════════ ساخت محتوای شیت ═════════ */
  function svg(path, cls) {
    return '<svg viewBox="0 0 24 24"' + (cls ? ' class="' + cls + '"' : '') + '>' + path + '</svg>';
  }

  function buildSheet() {
    var body = $('shBody');
    body.scrollTop = 0;
    if (tab === 'shop') body.innerHTML = htmlShop();
    else if (tab === 'crew') body.innerHTML = htmlCrew();
    else if (tab === 'grow') body.innerHTML = htmlGrow();
    else if (tab === 'book') body.innerHTML = htmlBook();
    else body.innerHTML = htmlMore();
    if (tab === 'more') paintAvatars();
    syncSheet();
  }

  function htmlShop() {
    return D.STATIONS.map(function (s) {
      return '<div class="card" data-card="' + s.id + '">' +
        '<div class="c-ico">' + svg(s.icon) + '<span class="lv" data-lv>۰</span></div>' +
        '<div class="c-mid"><div class="c-name">' + s.name + '</div>' +
        '<div class="c-meta" data-meta>—</div>' +
        '<div class="c-bar"><i data-share style="width:0%"></i></div></div>' +
        '<button class="buy" data-up="' + s.id + '"><span data-t>ارتقا</span><span class="c" data-cost>—</span></button>' +
        '</div>';
    }).join('') + '<div class="note" id="spaceNote">—</div>';
  }

  function htmlCrew() {
    return '<div class="card" id="hireCard">' +
      '<div class="c-ico">' + svg('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M18 8v6M15 11h6"/>') +
      '<span class="lv" id="hiredLv">۰</span></div>' +
      '<div class="c-mid"><div class="c-name">استخدام</div><div class="c-meta" id="hireMeta">—</div></div>' +
      '<button class="buy" id="hireBtn">استخدام<span class="c" id="hireCost">—</span></button></div>' +
      '<div class="note" id="crewNote">—</div>' +
      '<div class="sechead">چه کسی کجا بایستد</div>' +
      D.STATIONS.map(function (s) {
        return '<div class="card" data-crewcard="' + s.id + '">' +
          '<div class="c-ico">' + svg(s.icon) + '</div>' +
          '<div class="c-mid"><div class="c-name">' + s.name + '</div>' +
          '<div class="c-meta" data-cmeta>—</div>' +
          '<div class="crewrow">' +
          '<button class="cbtn" data-crew="-1" data-id="' + s.id + '">−</button>' +
          '<span class="dots" data-dots></span>' +
          '<button class="cbtn" data-crew="1" data-id="' + s.id + '">+</button>' +
          '</div></div></div>';
      }).join('');
  }

  function htmlGrow() {
    return '<div class="card" id="tierCard">' +
      '<div class="c-ico">' + svg('<path d="M3 21V10l9-6 9 6v11"/><path d="M9 21v-6h6v6"/>') + '</div>' +
      '<div class="c-mid"><div class="c-name" id="tierName">—</div><div class="c-meta" id="tierMeta">—</div>' +
      '<div class="c-bar"><i id="tierBar" style="width:0%"></i></div></div>' +
      '<button class="buy" id="tierBtn">ارتقا<span class="c" id="tierCost">—</span></button></div>' +
      '<div class="note" id="tierNote">—</div>' +
      '<div class="sechead">واگذاری</div>' +
      '<div class="card" id="prestigeCard">' +
      '<div class="c-ico">' + svg('<path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.4l6-.8z"/>') + '</div>' +
      '<div class="c-mid"><div class="c-name">بسپار و برو شهر بعد</div>' +
      '<div class="c-meta">همه‌چیز صفر می‌شود. فقط آبرو با تو می‌آید.</div></div>' +
      '<button class="buy" id="prestigeBtn">واگذاری<span class="c" id="prestigeGain">—</span></button></div>' +
      '<div class="note" id="growNote">—</div>' +
      '<div class="sechead">مسیر</div>' +
      '<div class="note" id="roadmap">—</div>';
  }

  function htmlBook() {
    return '<div class="note" id="bookHead">—</div>' +
      D.BOOK.map(function (n) {
        return '<div class="node" data-node="' + n.id + '">' +
          '<div class="n-ic">' + svg(n.icon) + '</div>' +
          '<div class="n-mid"><div class="n-name">' + n.name + '</div>' +
          '<div class="n-desc" data-desc>—</div>' +
          '<div class="n-pips" data-pips></div></div>' +
          '<button class="n-buy" data-buy="' + n.id + '"><span data-t>ارتقا</span><span class="c" data-cost>—</span></button>' +
          '</div>';
      }).join('');
  }

  function htmlMore() {
    var people = D.PEOPLE.map(function (p) {
      return '<div class="person" data-person="' + p.id + '">' +
        '<div class="p-av"><canvas width="92" height="92"></canvas></div>' +
        '<div class="p-mid"><div class="p-nm">' + p.name + '</div>' +
        '<div class="p-rl">' + p.role + '</div>' +
        '<div class="p-bar"><i data-bar style="width:0%"></i></div>' +
        '<div class="p-perk" data-perk>' + p.perk + '</div></div></div>';
    }).join('');

    var badges = D.BADGES.map(function (b) {
      return '<div class="bg" data-badge="' + b.id + '">' +
        '<div class="bi">' + svg(b.icon) + '</div>' +
        '<div class="bn">' + b.name + '</div>' +
        '<div class="bd">' + b.d + '</div></div>';
    }).join('');

    return '<div class="sechead">دیشب</div>' +
      '<div class="note" id="ledger">—</div>' +
      '<div class="sechead">آدم‌ها</div>' + people +
      '<div class="sechead">نشان‌ها</div>' +
      '<div class="badges">' + badges + '</div>' +
      '<div class="sechead">آمار</div>' +
      '<div class="kv">' +
      '<div><span>شب‌ها</span><b id="kDay">۰</b></div>' +
      '<div><span>کل درآمد این دور</span><b id="kTotal">۰</b></div>' +
      '<div><span>واگذاری‌ها</span><b id="kRuns">۰</b></div>' +
      '<div><span>مشتری سرو شده</span><b id="kServed">۰</b></div>' +
      '<div><span>سفارش ویژه</span><b id="kGoals">۰</b></div>' +
      '<div><span>بهترین دور</span><b id="kBest">۰</b></div>' +
      '</div>' +
      '<div class="sechead">تصویر</div>' +
      '<div class="card" style="padding:11px">' +
      '<div class="c-mid"><div class="c-name">کیفیت تصویر</div>' +
      '<div class="c-meta" id="gfxMeta">—</div></div>' +
      '<div class="seg" id="gfxSeg">' +
      '<button data-q="2">کامل</button><button data-q="1">متوسط</button><button data-q="0">سبک</button>' +
      '</div></div>' +
      '<div class="note">«کامل» بلوم، بازتاب آسفالت و بوکه دارد. اگر گوشی داغ کرد بیاور پایین — ' +
      'بازی خودش هم وقتی کند شود پایین می‌آورد.</div>' +
      '<div class="sechead">تنظیمات</div>' +
      '<button class="dangerbtn" id="resetBtn">پاک کردن همه‌چیز و شروع از صفر</button>' +
      '<div class="note" style="margin-top:8px;text-align:center;border-style:solid;opacity:.7">' +
      'آبرو — نسخه‌ی ' + fa(A.VERSION) + '</div>';
  }

  function paintAvatars() {
    D.PEOPLE.forEach(function (p) {
      var el = document.querySelector('[data-person="' + p.id + '"] canvas');
      if (el) A.scene.drawAvatar(el, p.look, St.stand(p.id));
    });
  }

  /* ═════════ هم‌گام‌سازی شیت ═════════ */
  function dotsHTML(n, f) {
    if (!n) return '<span class="dotsnone">این ایستگاه نیرو نمی‌خواهد</span>';
    var s = '';
    for (var i = 0; i < n; i++) s += '<span class="dot' + (i < f ? ' f' : '') + '"></span>';
    return s;
  }

  function syncSheet() {
    if (!sheetOn) return;
    var S = St.S, M = St.M;
    var r = St.rate(), used = St.spaceUsed(), cap = St.spaceCap(), free = St.crewFree();

    if (tab === 'shop') {
      D.STATIONS.forEach(function (s) {
        var el = document.querySelector('[data-card="' + s.id + '"]');
        if (!el) return;
        var locked = S.tier < s.tier, lvl = S.lvl[s.id], p = St.buyPlan(s, mult);
        var afford = !locked && !p.full && S.money >= p.c;
        el.classList.toggle('locked', locked);
        el.classList.toggle('ready', afford);
        el.querySelector('[data-lv]').textContent = fa(lvl);
        var meta = el.querySelector('[data-meta]');
        var sr = St.stationRate(s);
        if (locked) meta.textContent = 'در پرده‌ی ' + fa(s.tier + 1) + ' باز می‌شود';
        else if (!lvl) meta.textContent = s.desc;
        else meta.textContent = money(sr) + ' در ثانیه';
        el.querySelector('[data-share]').style.width = (r > 0 ? clamp(sr / r * 100, 0, 100) : 0) + '%';
        var b = el.querySelector('[data-up]');
        b.disabled = locked || p.full || p.n <= 0;
        b.classList.toggle('can', afford);
        b.querySelector('[data-t]').textContent = (lvl ? 'ارتقا' : 'راه‌اندازی') + (p.n > 1 ? ' ×' + fa(p.n) : '');
        b.querySelector('[data-cost]').textContent = p.full ? 'جا نیست' : money(p.c);
      });
      var n = $('spaceNote');
      if (n) n.innerHTML = 'فضا: <b>' + fa(used) + ' از ' + fa(cap) + '</b> — هر سطح یک جا می‌گیرد. ' +
        'بزرگ کردن یک شاخه یعنی بزرگ نکردن شاخه‌ی دیگر.';

    } else if (tab === 'crew') {
      var c = St.hireCost(), hb = $('hireBtn');
      if (hb) {
        $('hiredLv').textContent = fa(S.hired);
        $('hireCost').textContent = money(c);
        $('hireMeta').textContent = 'دستمزد هر نفر ' + money(St.wage()) + ' در هر شیفت';
        hb.classList.toggle('can', S.money >= c);
      }
      var cn = $('crewNote');
      if (cn) cn.innerHTML = 'نیروی بیکار: <b>' + fa(free) + '</b> از ' + fa(S.hired) +
        ' — ایستگاه بدون نیرو فقط ۴۵٪ کار می‌کند.';
      D.STATIONS.forEach(function (s) {
        var el = document.querySelector('[data-crewcard="' + s.id + '"]');
        if (!el) return;
        var lvl = S.lvl[s.id], nd = St.crewNeed(s.id);
        el.classList.toggle('locked', !lvl);
        el.querySelector('[data-dots]').innerHTML = dotsHTML(nd, S.crew[s.id]);
        el.querySelector('[data-cmeta]').textContent = lvl
          ? ('کارایی ' + U.pct((.45 + .55 * (nd ? Math.min(1, S.crew[s.id] / nd) : 1)) * 100))
          : 'هنوز راه نیفتاده';
        var btns = el.querySelectorAll('.cbtn');
        btns[0].disabled = S.crew[s.id] <= 0;
        btns[1].disabled = free <= 0 || S.crew[s.id] >= nd || !lvl;
      });

    } else if (tab === 'grow') {
      var t = St.tier(), tb = $('tierBtn'), cost = St.tierCost();
      if (tb) {
        if (t.next) {
          $('tierName').textContent = t.next;
          $('tierMeta').textContent = t.nextMeta;
          $('tierCost').textContent = money(cost);
          $('tierBar').style.width = clamp(S.money / cost * 100, 0, 100) + '%';
          tb.disabled = false;
          tb.classList.toggle('can', S.money >= cost);
        } else {
          $('tierName').textContent = 'بالاتر از این نیست';
          $('tierMeta').textContent = 'آخرین پرده. حالا فقط یک راه مانده.';
          $('tierCost').textContent = '—';
          $('tierBar').style.width = '100%';
          tb.disabled = true; tb.classList.remove('can');
        }
      }
      var tn = $('tierNote');
      if (tn) tn.innerHTML = 'پرده‌ی <b>' + fa(S.tier + 1) + ' از ' + fa(D.TIERS.length) + '</b> — ' + t.name +
        '. ضریب درآمد این پرده <b>×' + fa(t.mult) + '</b>.';
      var pc = $('prestigeCard'), pb = $('prestigeBtn');
      var ok = St.canPrestige();
      if (pc) pc.classList.toggle('locked', !ok);
      if (pb) {
        pb.disabled = !ok;
        pb.classList.toggle('can', ok);
        if (!armPrestige) {
          $('prestigeGain').textContent = ok ? '+' + fa(St.abrooGain()) + ' آبرو' : 'هنوز نه';
        }
      }
      var gn = $('growNote');
      if (gn) gn.innerHTML = 'هر آبرو <b>۹٪</b> به درآمد اضافه می‌کند. ضریب فعلی <b>×' +
        fa(St.abrooMult().toFixed(2)) + '</b>. آبرو خرج‌شدنی هم هست — در دفترچه‌ی پدر.';
      var rm = $('roadmap');
      if (rm) {
        rm.innerHTML = D.TIERS.map(function (x, i) {
          var mark = i < S.tier ? '✓' : (i === S.tier ? '◆' : '·');
          var cls = i <= S.tier ? 'style="color:var(--gold)"' : '';
          return '<span ' + cls + '>' + mark + ' ' + x.name + '</span>';
        }).join('<br>');
      }

    } else if (tab === 'book') {
      var bh = $('bookHead');
      if (bh) bh.innerHTML = 'آبرو خرج‌کردنی: <b>' + fa(M.abroo) + '</b> — این ارتقاها هیچ‌وقت پاک نمی‌شوند، ' +
        'حتی بعد از واگذاری.';
      D.BOOK.forEach(function (nd) {
        var el = document.querySelector('[data-node="' + nd.id + '"]');
        if (!el) return;
        var lv = St.book(nd.id), maxed = lv >= nd.max, cost = nd.cost(lv);
        el.classList.toggle('max', maxed);
        el.querySelector('[data-desc]').textContent = maxed
          ? ('کامل — ' + nd.desc(lv - 1))
          : nd.desc(lv);
        var pips = '';
        for (var i = 0; i < nd.max; i++) pips += '<span class="pip' + (i < lv ? ' f' : '') + '"></span>';
        el.querySelector('[data-pips]').innerHTML = pips;
        var b = el.querySelector('[data-buy]');
        b.disabled = maxed || M.abroo < cost;
        b.classList.toggle('can', !maxed && M.abroo >= cost);
        b.querySelector('[data-t]').textContent = maxed ? 'کامل' : 'ارتقا';
        b.querySelector('[data-cost]').textContent = maxed ? '—' : fa(cost) + ' آبرو';
      });

    } else {
      var l = $('ledger');
      if (l) l.innerHTML = S.day ? ('شب <b>' + fa(S.day) + '</b>: ' + S.lastNote) : 'هنوز شبی را نبسته‌ای.';
      D.PEOPLE.forEach(function (p) {
        var el = document.querySelector('[data-person="' + p.id + '"]');
        if (!el) return;
        var v = St.stand(p.id), on = v >= p.at;
        var bar = el.querySelector('[data-bar]');
        bar.style.width = v + '%';
        bar.style.background = on
          ? 'linear-gradient(90deg,#3f8a4c,#7fd894)'
          : 'linear-gradient(90deg,#7a4636,#d99a52)';
        var pk = el.querySelector('[data-perk]');
        pk.classList.toggle('on', on);
        pk.textContent = (on ? '✓ ' : '') + p.perk + ' — الان ' + fa(Math.round(v));
      });
      D.BADGES.forEach(function (b) {
        var el = document.querySelector('[data-badge="' + b.id + '"]');
        if (el) el.classList.toggle('got', St.hasBadge(b.id));
      });
      var set = function (id, v) { var e = $(id); if (e) e.textContent = v; };
      set('kDay', fa(S.day));
      set('kTotal', money(S.total));
      set('kRuns', fa(M.runs));
      set('kServed', fa(S.served || 0));
      set('kGoals', fa(S.goalsDone || 0));
      set('kBest', money(M.bestTotal || 0));
      var st = A.scene.stats();
      var gm = $('gfxMeta');
      if (gm) gm.textContent = fa(st.ms) + ' میلی‌ثانیه در هر فریم';
      document.querySelectorAll('#gfxSeg button').forEach(function (b) {
        b.classList.toggle('on', +b.dataset.q === st.quality);
      });
    }
  }

  /* ═════════ HUD ═════════ */
  var lastMoneyText = '';
  function syncHUD(disp, heat) {
    var S = St.S, M = St.M, t = St.tier();
    var r = St.rate();
    heatRef = heat;

    var mt = money(disp);
    if (mt !== lastMoneyText) { $('money').textContent = mt; lastMoneyText = mt; }
    $('abroo').textContent = fa(M.abroo);
    $('rateBadge').textContent = r > 0 ? money(r) + ' تومان در ثانیه' : 'هنوز چیزی نمی‌آید';
    $('shopName').textContent = t.name;
    $('actLbl').textContent = 'پرده‌ی ' + fa(S.tier + 1) + '/' + fa(D.TIERS.length);
    $('integVal').textContent = fa(Math.round(S.integ));
    $('integProg').style.width = S.integ + '%';
    $('integTrack').classList.toggle('low', S.integ < 30);

    var cost = St.tierCost();
    var prog = t.next ? clamp(S.money / cost * 100, 0, 100) : 100;
    $('actProg').style.width = prog + '%';
    $('actTrack').classList.toggle('shine', prog >= 100);

    $('fabSub').textContent = heat > .08 ? '×' + fa((1 + heat * 1.5).toFixed(1)) : 'مشتری';
    var fab = $('serveBtn');
    fab.style.setProperty('--heat', (heat * 360).toFixed(0) + 'deg');
    fab.classList.toggle('hot', heat > .6);

    /* نشان‌های تب */
    var used = St.spaceUsed(), cap = St.spaceCap();
    var bShop = false;
    if (used < cap) {
      for (var i = 0; i < D.STATIONS.length; i++) {
        var s = D.STATIONS[i];
        if (S.tier >= s.tier && S.money >= St.upCost(s)) { bShop = true; break; }
      }
    }
    $('bShop').hidden = !bShop;
    $('bCrew').hidden = !(S.money >= St.hireCost() || St.crewFree() > 0);
    $('bGrow').hidden = !((t.next && S.money >= cost) || (St.canPrestige() && St.abrooGain() > 0 && S.tier >= 4));
    var bBook = D.BOOK.some(function (n) {
      var lv = St.book(n.id);
      return lv < n.max && M.abroo >= n.cost(lv);
    });
    $('bBook').hidden = !bBook;
    syncSheet();
  }

  /* ═════════ سفارش ویژه ═════════ */
  function setGoal(g) { goal = g; syncGoal(); }
  function syncGoal() {
    var box = $('goalBox');
    if (!goal) { box.hidden = true; return; }
    box.hidden = false;
    $('goalText').textContent = goal.txt;
    $('goalProg').style.width = clamp(goal.have / goal.need * 100, 0, 100) + '%';
    var b = $('goalClaim');
    b.classList.toggle('ready', !!goal.done);
    b.textContent = goal.done ? 'بگیر' : (goal.left > 0 ? fa(Math.ceil(goal.left)) + 'ث' : '—');
  }

  /* ═════════ رویداد ═════════ */
  function showEvent(ev, night, onPick) {
    $('evKind').textContent = ev.k;
    $('evNight').textContent = 'شب ' + fa(night);
    $('evTitle').textContent = ev.t;
    $('evText').textContent = ev.x;
    $('evVeil').hidden = false;
    var art = $('evArt');
    art.width = Math.round((art.clientWidth || 380) * 2);
    art.height = Math.round((art.clientHeight || 96) * 2);
    A.scene.drawEventArt(art, ev.art || '', 0);

    var pick = $('evPick');
    pick.replaceChildren();
    ['a', 'c'].forEach(function (key) {
      var o = ev[key];
      var b = document.createElement('button');
      var chips = '';
      if (o.m) chips += '<span class="fxchip ' + (o.m > 0 ? 'pos' : 'neg') + '">پول ' + (o.m > 0 ? '+' : '−') + '</span>';
      if (o.i) chips += '<span class="fxchip ' + (o.i > 0 ? 'pos' : 'neg') + '">اصالت ' + (o.i > 0 ? '+' : '−') + fa(Math.abs(o.i)) + '</span>';
      if (o.p) {
        for (var k in o.p) {
          var per = D.PEOPLE.find(function (x) { return x.id === k; });
          if (per) chips += '<span class="fxchip ' + (o.p[k] > 0 ? 'pos' : 'neg') + '">' + per.name + '</span>';
        }
      }
      b.innerHTML = '<b>' + o.b + '</b><span class="why">' + o.s + '</span><span class="fx">' + chips + '</span>';
      b.addEventListener('click', function () { onPick(o); });
      pick.appendChild(b);
    });
  }
  function hideEvent() { $('evVeil').hidden = true; }

  /* ═════════ فاکتور ═════════ */
  function showReceipt(d, onAd, onOk, onCopy) {
    $('rcTitle').textContent = d.manual ? 'گزارش شیفت' : 'گزارش غیبت';
    $('rcSub').textContent = 'شب ' + fa(d.day) + ' — ' + d.tierName;
    var rows = [
      ['فروش ناخالص', d.gross, 'pos'],
      ['مواد اولیه (' + D.ING[d.ing].label + ')', -d.ingCost, 'neg'],
      ['دستمزد ' + fa(d.hired) + ' نفر', -d.wages, 'neg']
    ];
    if (d.manual && Math.abs(d.luck - 1) > .12) {
      rows.push([d.luck > 1 ? 'شب بهتر از انتظار' : 'شب کساد', 0, d.luck > 1 ? 'pos' : 'neg']);
    }
    if (d.awayHours) rows.push(['مدت غیبت', 0, '']);
    $('rcRows').innerHTML = rows.map(function (row, i) {
      var val = row[1] ? ((row[1] < 0 ? '−' : '+') + money(Math.abs(row[1]))) :
        (row[0] === 'مدت غیبت' ? U.timeAgo(d.awayHours * 3600) : '—');
      return '<div class="r-row ' + row[2] + '" style="animation-delay:' + (i * 90 + 130) + 'ms">' +
        '<span class="k">' + row[0] + '</span><span class="num">' + val + '</span></div>';
    }).join('');
    $('rcNote').textContent = d.note;
    $('rcNet').textContent = money(d.net);
    $('rcAd').disabled = false;
    $('rcAd').textContent = 'تماشای تبلیغ: خالص شب دو برابر';
    $('rcVeil').hidden = false;
    $('rcAd').onclick = onAd;
    $('rcOk').onclick = onOk;
    $('rcCopy').onclick = onCopy;
  }
  function setReceiptNet(v, done) {
    $('rcNet').textContent = money(v);
    if (done) { $('rcAd').disabled = true; $('rcAd').textContent = 'دو برابر شد'; }
  }
  function hideReceipt() { $('rcVeil').hidden = true; }

  /* ═════════ کارت پرده ═════════ */
  var actTimer = null;
  function showAct(tierIndex, unlocked) {
    var t = D.TIERS[tierIndex];
    $('actNo').textContent = 'پرده‌ی ' + fa(tierIndex + 1) + ' — ' + t.place;
    $('actNm').textContent = t.name;
    $('actTx').textContent = t.intro;
    $('actUnlock').textContent = unlocked ? ('باز شد: ' + unlocked) : '';
    $('actVeil').hidden = false;
    A.audio.sfx.act();
    clearTimeout(actTimer);
    actTimer = setTimeout(function () { $('actVeil').hidden = true; }, U.reduceMotion ? 600 : 3400);
  }

  /* ═════════ پایان ═════════ */
  function showEnding(kind, stats, onClose) {
    var e = D.ENDINGS[kind];
    $('enT').textContent = e.t;
    $('enH').textContent = e.h;
    $('enP').innerHTML = e.p.map(function (p) { return '<p>' + p + '</p>'; }).join('');
    $('enStats').innerHTML = stats.map(function (s) {
      return '<div class="stat"><span>' + s[0] + '</span><b>' + s[1] + '</b></div>';
    }).join('');
    $('enVeil').hidden = false;
    $('enOk').onclick = onClose;
  }

  /* ═════════ راهنما ═════════ */
  var coachEl = null;
  function coach(text, anchorEl, dir, onDone) {
    hideCoach();
    var el = document.createElement('div');
    el.className = 'coach ' + (dir || 'down');
    el.innerHTML = '<b>راهنما</b>' + text + '<button class="ok">باشد</button>';
    $('device').appendChild(el);
    coachEl = el;
    var a = anchorEl.getBoundingClientRect(), d = $('device').getBoundingClientRect();
    el.style.left = clamp(a.left - d.left + a.width / 2 - el.offsetWidth / 2, 8, d.width - el.offsetWidth - 8) + 'px';
    el.style.top = (dir === 'up' ? a.bottom - d.top + 10 : a.top - d.top - el.offsetHeight - 10) + 'px';
    el.querySelector('.ok').addEventListener('click', function () {
      hideCoach();
      if (onDone) onDone();
    });
  }
  function hideCoach() {
    if (coachEl) { coachEl.remove(); coachEl = null; }
  }

  /* ═════════ اتصال ═════════ */
  function init() {
    document.querySelectorAll('.tab').forEach(function (b) {
      b.addEventListener('click', function () { openTab(b.dataset.tab); });
    });
    $('scrim').addEventListener('click', closeSheet);

    document.querySelectorAll('#multSeg button').forEach(function (b) {
      b.addEventListener('click', function () {
        mult = b.dataset.m;
        document.querySelectorAll('#multSeg button').forEach(function (x) { x.classList.toggle('on', x === b); });
        syncSheet();
        A.audio.sfx.open();
      });
    });

    /* کشیدن شیت به پایین */
    (function () {
      var y0 = null;
      var sh = $('sheet');
      sh.addEventListener('touchstart', function (e) { y0 = e.touches[0].clientY; }, { passive: true });
      sh.addEventListener('touchmove', function (e) {
        if (y0 === null) return;
        var dy = e.touches[0].clientY - y0;
        if (dy > 66 && $('shBody').scrollTop <= 0) { closeSheet(); y0 = null; }
      }, { passive: true });
      sh.addEventListener('touchend', function () { y0 = null; });
    })();

    /* کلیک‌های داخل شیت */
    $('shBody').addEventListener('click', function (e) {
      var G = A.game;
      var up = e.target.closest('[data-up]');
      if (up) { G.buyStation(up.dataset.up, mult, up); return; }
      var cw = e.target.closest('[data-crew]');
      if (cw) { G.assignCrew(cw.dataset.id, +cw.dataset.crew); return; }
      if (e.target.closest('#hireBtn')) { G.hire(e.target.closest('#hireBtn')); return; }
      if (e.target.closest('#tierBtn')) { G.upgradeTier(); return; }
      if (e.target.closest('#prestigeBtn')) { clickPrestige(); return; }
      var nb = e.target.closest('[data-buy]');
      if (nb) { G.buyBook(nb.dataset.buy); return; }
      if (e.target.closest('#resetBtn')) { clickReset(); return; }
      var q = e.target.closest('[data-q]');
      if (q) {
        A.scene.setQuality(+q.dataset.q);
        St.M.gfx = +q.dataset.q;
        St.save();
        A.audio.sfx.open();
        syncSheet();
        return;
      }
    });

    $('goalClaim').addEventListener('click', function () { A.game.claimGoal(); });
  }

  function clickPrestige() {
    if (!St.canPrestige()) { A.audio.sfx.no(); return; }
    if (!armPrestige) {
      armPrestige = setTimeout(function () { armPrestige = null; syncSheet(); }, 4200);
      var el = $('prestigeGain');
      if (el) el.textContent = 'مطمئنی؟';
      U.toast('همه‌چیز صفر می‌شود. ' + fa(St.abrooGain()) + ' آبرو با تو می‌آید. دوباره بزن.');
      return;
    }
    clearTimeout(armPrestige); armPrestige = null;
    A.game.prestige();
  }
  function clickReset() {
    var b = $('resetBtn');
    if (!armReset) {
      armReset = setTimeout(function () {
        armReset = null;
        var x = $('resetBtn');
        if (x) x.textContent = 'پاک کردن همه‌چیز و شروع از صفر';
      }, 4200);
      if (b) b.textContent = 'مطمئنی؟ دوباره بزن — همه‌چیز می‌رود';
      return;
    }
    clearTimeout(armReset); armReset = null;
    A.game.hardReset();
  }

  A.ui = {
    init: init, openTab: openTab, closeSheet: closeSheet, isSheetOpen: isSheetOpen,
    buildSheet: buildSheet, syncSheet: syncSheet, syncHUD: syncHUD,
    setGoal: setGoal, syncGoal: syncGoal,
    showEvent: showEvent, hideEvent: hideEvent,
    showReceipt: showReceipt, setReceiptNet: setReceiptNet, hideReceipt: hideReceipt,
    showAct: showAct, showEnding: showEnding,
    coach: coach, hideCoach: hideCoach,
    paintAvatars: paintAvatars,
    getMult: function () { return mult; }
  };
})(window.ABRO);
