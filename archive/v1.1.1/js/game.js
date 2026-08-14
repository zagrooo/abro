/* ═══════════════════════════════════════════════
   آبرو — منطق بازی و حلقه‌ی اصلی
   ═══════════════════════════════════════════════ */
(function (A) {
  'use strict';

  var U = A.util, D = A.data, St = A.state, Sc = A.scene, UI = A.ui, AU = A.audio;
  var $ = U.$, fa = U.fa, money = U.money, clamp = U.clamp, rnd = U.rnd;

  var disp = 0, heat = 0, evTimer = 55, goal = null, goalTimer = 40;
  var lastFrame = performance.now(), coinTimer = 0, saveTimer = 0, hudTimer = 0;
  var rcNet = 0, rcUsedAd = false, hiddenAt = 0, booted = false;

  function S() { return St.S; }
  function M() { return St.M; }

  var MODALS = ['shiftVeil', 'evVeil', 'rcVeil', 'actVeil', 'enVeil', 'intro'];
  function anyModal() {
    for (var i = 0; i < MODALS.length; i++) {
      var el = $(MODALS[i]);
      if (el && !el.hidden) return true;
    }
    return false;
  }

  /* ═════════ خرید و کنش ═════════ */
  function buyStation(id, mult, btn) {
    var s = D.STATIONS.find(function (x) { return x.id === id; });
    if (!s) return;
    if (S().tier < s.tier) { AU.sfx.no(); return; }
    var p = St.buyPlan(s, mult);
    if (p.full) { AU.sfx.no(); U.toast('جا نداری. باید بزرگ‌تر شوی.', 'bad'); return; }
    if (S().money < p.c || p.n <= 0) { AU.sfx.no(); return; }
    var first = !S().lvl[s.id];
    S().money -= p.c; disp = S().money;
    S().lvl[s.id] += p.n;
    AU.sfx.buy(); U.buzz(10); U.flyCoins(btn, 4);
    if (first) {
      U.toast(s.name + ' راه افتاد.', 'good');
      Sc.burst(500, 380, 12, '#ffd68f');
      Sc.punch(.55);
      maybeCoach(3);
    }
    afterChange();
  }

  function hire(btn) {
    var c = St.hireCost();
    if (S().money < c) { AU.sfx.no(); return; }
    S().money -= c; disp = S().money;
    S().hired++;
    AU.sfx.buy(); U.buzz(10); U.flyCoins(btn, 4);
    U.toast('یک نفر اضافه شد. بگذارش روی یک ایستگاه.', 'good');
    afterChange();
  }

  function assignCrew(id, d) {
    if (St.IDS.indexOf(id) < 0) return;
    if (d > 0 && (St.crewFree() <= 0 || S().crew[id] >= St.crewNeed(id))) { AU.sfx.no(); return; }
    if (d < 0 && S().crew[id] <= 0) return;
    S().crew[id] += d;
    AU.sfx.open(); U.buzz(6);
    afterChange();
  }

  function upgradeTier() {
    var t = St.tier(), cost = St.tierCost();
    if (!t.next || S().money < cost) { AU.sfx.no(); return; }
    S().money -= cost; disp = S().money;
    S().tier++;
    Sc.reset();
    Sc.setTier(S().tier);
    Sc.punch(1);
    UI.closeSheet();
    var unlocked = D.STATIONS.filter(function (s) { return s.tier === S().tier; })
      .map(function (s) { return s.name; }).join('، ');
    UI.showAct(S().tier, unlocked);
    afterChange();
    if (St.isLast() && !S().ended) setTimeout(triggerEnding, 3600);
  }

  function buyBook(id) {
    var n = D.BOOK.find(function (x) { return x.id === id; });
    if (!n) return;
    var lv = St.book(id);
    if (lv >= n.max) { AU.sfx.no(); return; }
    var c = n.cost(lv);
    if (M().abroo < c) { AU.sfx.no(); U.toast('آبرو کم داری. باید واگذار کنی.', 'bad'); return; }
    M().abroo -= c;
    M().book[id] = lv + 1;
    AU.sfx.badge(); U.buzz([8, 30, 8]);
    U.toast(n.name + ' یک پله بالا رفت.', 'good');
    afterChange();
  }

  function prestige() {
    var g = St.doPrestige();
    disp = S().money;
    heat = 0; goal = null; goalTimer = 40; evTimer = 55;
    Sc.reset(); Sc.setTier(0); Sc.snapCamera();
    UI.closeSheet();
    UI.setGoal(null);
    UI.showAct(0, null);
    U.toast('شهر تازه. +' + fa(g) + ' آبرو با تو آمد.', 'good');
    afterChange();
  }

  function hardReset() {
    St.wipe();
    disp = 0; heat = 0; goal = null; goalTimer = 40; evTimer = 55;
    Sc.reset(); Sc.setTier(0); Sc.snapCamera();
    UI.setGoal(null);
    UI.buildSheet();
    U.toast('از اول.');
    afterChange();
  }

  function afterChange() {
    var got = St.checkBadges({ heat: heat });
    if (got.length) {
      got.forEach(function (b, i) {
        setTimeout(function () {
          U.toast('نشان گرفتی: ' + b.name + ' (+' + fa(b.r) + ' آبرو)', 'good');
          AU.sfx.badge();
        }, i * 900);
      });
    }
    UI.syncHUD(disp, heat);
    St.save();
  }

  /* ═════════ سرو ═════════ */
  function serve(fromScene, wx, wy) {
    if (anyModal()) return;
    var v = St.tapValue(heat);
    S().money += v; S().total += v;
    S().served = (S().served || 0) + 1;
    heat = clamp(heat + .13, 0, 1);
    goalProgress('serve', 1);
    goalProgress('earn', v);
    AU.sfx.tap(heat); U.buzz(5);
    Sc.spawnCoin(v);
    if (fromScene) Sc.burst(wx, wy, 7, '#ffd68f');
    var f = $('serveBtn');
    f.classList.remove('hit'); void f.offsetWidth; f.classList.add('hit');
    if (heat > .97) St.checkBadges({ heat: heat });
    UI.syncHUD(disp, heat);
  }

  /* ═════════ سفارش ویژه ═════════ */
  function newGoal() {
    var g = U.pick(D.GOALS);
    var n = Math.round(rnd(g.n[0], g.n[1]));
    var r = Math.max(St.rate(), 200);
    var need = g.type === 'earn' ? Math.round(r * n) : n;
    goal = {
      type: g.type, need: need, have: 0, left: g.t, done: false,
      txt: g.txt(n, need),
      reward: Math.max(1e4, g.type === 'earn' ? need * 1.15 : r * 40)
    };
    UI.setGoal(goal);
  }
  function goalProgress(kind, amount) {
    if (!goal || goal.done || goal.type !== kind) return;
    goal.have += amount;
  }
  function goalTick(dt, r) {
    if (!goal) {
      goalTimer -= dt;
      if (goalTimer <= 0 && St.spaceUsed() > 0) newGoal();
      return;
    }
    if (goal.done) return;
    if (goal.type === 'earn') goal.have += r * dt;
    goal.left -= dt;
    if (goal.have >= goal.need) {
      goal.done = true;
      AU.sfx.win(); U.buzz([12, 40, 12]);
    } else if (goal.left <= 0) {
      goal = null;
      UI.setGoal(null);
      goalTimer = rnd(50, 85);
    }
  }
  function claimGoal() {
    if (!goal || !goal.done) { AU.sfx.no(); return; }
    S().money += goal.reward; S().total += goal.reward;
    S().goalsDone = (S().goalsDone || 0) + 1;
    St.applyInteg(1);
    U.toast('سفارش ویژه رسید. +' + money(goal.reward) + ' تومان', 'good');
    AU.sfx.coin();
    Sc.spawnCoin(goal.reward, true);
    U.flyCoins($('goalClaim'), 6);
    goal = null;
    UI.setGoal(null);
    goalTimer = rnd(60, 100);
    afterChange();
  }

  /* ═════════ رویدادها ═════════ */
  function pickEvent() {
    var pool = D.EVENTS.filter(function (e) { return (e.minTier || 0) <= S().tier; });
    if (St.perkOn('bazres')) {
      pool = pool.filter(function (e) { return e.k !== 'دردسر' || Math.random() < .45; });
    }
    if (!pool.length) pool = D.EVENTS;
    return U.pick(pool);
  }
  function fireEvent(ev) {
    if (anyModal() || !St.spaceUsed()) return;
    ev = ev || pickEvent();
    AU.sfx.event(); U.buzz(20);
    if (ev.rain) Sc.rainFor(18000);
    UI.showEvent(ev, S().day + 1, function (o) {
      var base = Math.max(St.rate() * 900, 30e3);
      var luckMul = 1 + .15 * St.book('luck');
      var dm = Math.round(base * o.m * (o.m > 0 ? luckMul : (St.perkOn('raqib') && ev.who === 'raqib' ? .5 : 2 - luckMul)));
      S().money = Math.max(0, S().money + dm);
      if (dm > 0) S().total += dm; else disp = S().money;
      St.applyInteg(o.i);
      St.shiftPeople(o.p);
      UI.hideEvent();
      if (dm > 0) { AU.sfx.coin(); Sc.spawnCoin(dm, true); }
      else if (dm < 0) { AU.sfx.no(); Sc.shake(5); U.buzz([25, 40, 25]); }
      U.toast(o.b + ' — ' + (dm >= 0 ? '+' : '−') + money(Math.abs(dm)) +
        ' · اصالت ' + (o.i >= 0 ? '+' : '−') + fa(Math.abs(o.i)), dm >= 0 ? 'good' : 'bad');
      afterChange();
    });
  }

  /* ═════════ شیفت ═════════ */
  function buildShiftOptions() {
    $('ingOpts').innerHTML = Object.keys(D.ING).map(function (k) {
      return '<label class="opt"><input type="radio" name="ing" value="' + k + '">' +
        '<span><b>' + D.ING[k].label + '</b><i>' + D.ING[k].note + '</i></span></label>';
    }).join('');
    $('riskOpts').innerHTML = Object.keys(D.RISK).map(function (k) {
      return '<label class="opt"><input type="radio" name="risk" value="' + k + '">' +
        '<span><b>' + D.RISK[k].label + '</b><i>' + D.RISK[k].note + '</i></span></label>';
    }).join('');
    $('ingOpts').addEventListener('change', updateForecast);
    $('riskOpts').addEventListener('change', updateForecast);
  }
  function readShiftPick() {
    var i = document.querySelector('input[name=ing]:checked');
    var r = document.querySelector('input[name=risk]:checked');
    return {
      ing: i && D.ING[i.value] ? i.value : S().ing,
      risk: r && D.RISK[r.value] ? r.value : S().risk
    };
  }
  function updateForecast() {
    var p = readShiftPick();
    var ing = D.ING[p.ing];
    var gross = St.rate() * 3600 * 8 * .62 * ing.out;
    var net = Math.max(0, gross - gross * ing.cost - S().hired * St.wage());
    $('fcNet').textContent = money(net);
    $('fcInteg').textContent = (ing.integ >= 0 ? '+' : '−') + fa(Math.abs(ing.integ));
  }
  function openShift() {
    if (anyModal()) return;
    if (!St.spaceUsed()) { AU.sfx.no(); U.toast('اول یک ایستگاه راه بینداز.', 'bad'); return; }
    UI.closeSheet();
    var i = document.querySelector('input[name=ing][value="' + S().ing + '"]');
    if (i) i.checked = true;
    var r = document.querySelector('input[name=risk][value="' + S().risk + '"]');
    if (r) r.checked = true;
    updateForecast();
    $('shiftVeil').hidden = false;
  }
  function confirmShift() {
    var p = readShiftPick();
    S().ing = p.ing; S().risk = p.risk;
    $('shiftVeil').hidden = true;
    runShift(8, true);
  }

  function runShift(hours, manual) {
    hours = clamp(Number(hours) || 0, 0, 14);
    if (hours <= 0 || !St.spaceUsed()) return;
    var ing = D.ING[S().ing], rk = D.RISK[S().risk];
    var luck = manual ? (rk.lo + Math.random() * (rk.hi - rk.lo)) : 1;
    var eff = manual ? .62 : .5 * (1 + .2 * St.book('night'));
    var gross = St.rate() * 3600 * hours * eff * ing.out * luck;
    var ingCost = gross * ing.cost;
    var wages = S().hired * St.wage() * (hours / 8);
    var net = Math.max(0, gross - ingCost - wages);
    var note = U.pick(D.NIGHT);

    S().day++;
    S().money += net; S().total += net;
    St.applyInteg(manual ? ing.integ : ing.integ * .4);
    S().lastNote = note;

    rcNet = net; rcUsedAd = false;
    UI.showReceipt({
      manual: manual, day: S().day, tierName: St.tier().name, ing: S().ing,
      gross: gross, ingCost: ingCost, wages: wages, net: net, luck: luck,
      hired: S().hired, note: note, awayHours: manual ? 0 : hours
    }, onAd, onReceiptOk, onCopy);
    AU.sfx.print();
    afterChange();
  }
  function onAd() {
    if (rcUsedAd) return;
    rcUsedAd = true;
    S().money += rcNet; S().total += rcNet;
    rcNet *= 2;
    UI.setReceiptNet(rcNet, true);
    AU.sfx.coin(); U.buzz(15);
    U.flyCoins($('rcAd'), 7);
    afterChange();
  }
  function onReceiptOk() { UI.hideReceipt(); }
  function onCopy() {
    var t = 'آبرو | شب ' + fa(S().day) + ' — ' + St.tier().name + '\n' +
      S().lastNote + '\nخالص شب: ' + money(rcNet) + ' تومان\n' +
      'اصالت: ' + fa(Math.round(S().integ)) + ' از ۱۰۰';
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).then(
          function () { U.toast('کپی شد. بفرست.', 'good'); },
          function () { U.toast('کپی نشد.', 'bad'); }
        );
      } else U.toast('مرورگر اجازه‌ی کپی نمی‌دهد.', 'bad');
    } catch (e) { U.toast('کپی نشد.', 'bad'); }
  }

  /* ═════════ پایان ═════════ */
  function triggerEnding() {
    if (S().ended) return;
    S().ended = 1;
    var kind = S().integ >= 50 ? 'kept' : 'lost';
    var stats = [
      ['شب‌ها', fa(S().day)],
      ['کل درآمد', money(S().total)],
      ['اصالت', fa(Math.round(S().integ)) + ' از ۱۰۰'],
      ['مشتری سرو شده', fa(S().served || 0)],
      ['نشان‌ها', fa(M().badges.length) + ' از ' + fa(D.BADGES.length)]
    ];
    UI.showEnding(kind, stats, function () {
      $('enVeil').hidden = true;
      U.toast('می‌توانی واگذار کنی و از شهر بعد شروع کنی.');
    });
    St.save();
  }

  /* ═════════ راهنمای اول ═════════ */
  function maybeCoach(step) {
    if (M().coached & (1 << step)) return;
    M().coached |= (1 << step);
    St.save();
    if (step === 1) {
      UI.coach('این دکمه را بزن. هر بار یک مشتری سرو می‌کنی و پول می‌آید. تند بزنی، گرم می‌شود و بیشتر می‌دهد.',
        $('serveBtn'), 'down', function () { });
    } else if (step === 2) {
      UI.coach('پول جمع شد. برو توی «ایستگاه‌ها» و اجاق را راه بینداز تا بدون تو هم درآمد بیاید.',
        $('tabShop'), 'down');
    } else if (step === 3) {
      setTimeout(function () {
        UI.coach('وقتی می‌خواهی بروی، «بستن» را بزن. شیفت را می‌چینی و صبح گزارشش را می‌بینی.',
          $('shiftBtn'), 'up');
      }, 1200);
    }
  }

  /* ═════════ حلقه ═════════ */
  function loop(now) {
    var dt = clamp((now - lastFrame) / 1000, 0, .25);
    lastFrame = now;
    var T = now / 1000;
    var open = !anyModal();

    heat = Math.max(0, heat - dt * .3);

    var r = St.rate();
    if (open) {
      S().money += r * dt;
      S().total += r * dt;
      St.applyInteg(D.ING[S().ing].integ * .02 * dt);

      evTimer -= dt;
      if (evTimer <= 0) { evTimer = 55 + Math.random() * 45; fireEvent(); }

      if (r > 0 && !U.reduceMotion) {
        coinTimer -= dt;
        if (coinTimer <= 0) { coinTimer = 1.6 + Math.random() * 1.8; Sc.spawnCoin(r * (1.4 + Math.random())); }
      }
      goalTick(dt, r);

      if (!S().ended && St.isLast() && S().total > D.TIERS[10].cost * 1.4) triggerEnding();
    }

    disp += (S().money - disp) * Math.min(1, dt * 6);
    if (Math.abs(S().money - disp) < 1) disp = S().money;

    var W = {
      rate: r, tier: clamp(S().tier | 0, 0, D.TIERS.length - 1),
      lvl: S().lvl, crew: St.crewUsed(), heat: heat,
      brandLit: S().lvl.brand > 0 || S().tier >= 3
    };
    Sc.update(dt, T, W);
    Sc.render(T, W);

    hudTimer -= dt;
    if (hudTimer <= 0) {
      hudTimer = .16;
      UI.syncHUD(disp, heat);
      UI.syncGoal();
    }

    saveTimer -= dt;
    if (saveTimer <= 0) { saveTimer = 8; St.save(); }

    if (booted && !M().coached && S().money > 900 && St.spaceUsed() === 0) maybeCoach(2);

    requestAnimationFrame(loop);
  }

  /* ═════════ غیبت ═════════ */
  function onVisible() {
    if (document.hidden) { hiddenAt = Date.now(); St.save(); return; }
    lastFrame = performance.now();
    if (!hiddenAt) return;
    var away = clamp((Date.now() - hiddenAt) / 1000, 0, 14 * 3600);
    hiddenAt = 0;
    if (away < 20 || !St.spaceUsed()) return;
    if (away < 300) {
      var g = St.rate() * away * .5 * (1 + .2 * St.book('night'));
      S().money += g; S().total += g;
      U.toast('در نبودت ' + money(g) + ' تومان جمع شد.', 'good');
      afterChange();
    } else if (!anyModal()) {
      runShift(away / 3600, false);
    }
  }

  /* ═════════ راه‌اندازی ═════════ */
  function bindInputs() {
    $('serveBtn').addEventListener('click', function () { serve(false); });
    $('tapZone').addEventListener('pointerdown', function (e) {
      var w = Sc.toWorld(e.clientX, e.clientY);
      serve(true, w.x, w.y);
    });
    window.addEventListener('keydown', function (e) {
      if (e.code === 'Space' && !anyModal() && !UI.isSheetOpen()) { e.preventDefault(); serve(false); }
      if (e.code === 'Escape') UI.closeSheet();
    });

    $('shiftBtn').addEventListener('click', openShift);
    $('shiftGo').addEventListener('click', confirmShift);
    $('shiftCancel').addEventListener('click', function () { $('shiftVeil').hidden = true; });

    $('sndBtn').addEventListener('click', function () {
      var on = AU.toggle();
      M().sound = on ? 1 : 0;
      $('sndBtn').classList.toggle('on', on);
      $('sndIco').innerHTML = on
        ? '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>'
        : '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M16 9l5 6M21 9l-5 6"/>';
      St.save();
    });

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', St.save);
    window.addEventListener('resize', Sc.resize);
    if (window.ResizeObserver) new ResizeObserver(Sc.resize).observe($('device'));
    document.addEventListener('pointerdown', function once() {
      AU.resume();
      if (M().sound) AU.startMusic();
      document.removeEventListener('pointerdown', once);
    });
  }

  function start() {
    Sc.init($('stage'));
    UI.init();
    bindInputs();
    buildShiftOptions();

    var had = St.load();
    Sc.setQuality(M().gfx == null ? 2 : M().gfx);
    if (!M().sound) AU.setOn(false);
    $('sndBtn').classList.toggle('on', !!M().sound);
    disp = S().money;
    Sc.setTier(S().tier);
    Sc.snapCamera();
    UI.syncHUD(disp, 0);
    UI.setGoal(null);

    var away = had ? clamp((Date.now() - (S().ts || Date.now())) / 1000, 0, 14 * 3600) : 0;

    /* نمای فرود همان لحظه تصمیم گرفته می‌شود، نه با تایمر */
    var freshPlayer = !M().seenIntro;
    function showIntro() {
      var el = $('intro');
      if (!el || M().seenIntro) return;
      el.hidden = false;
      el.removeAttribute('hidden');
      $('introGo').onclick = function () {
        el.hidden = true;
        el.setAttribute('hidden', '');
        M().seenIntro = 1;
        St.save();
        AU.resume();
        if (M().sound) AU.startMusic();
        maybeCoach(1);
      };
    }
    if (freshPlayer) showIntro();

    setTimeout(function () {
      $('boot').classList.add('gone');
      booted = true;
      if (freshPlayer) showIntro();   /* اگر چیزی سر راه بود، اینجا جبران می‌شود */
    }, U.reduceMotion ? 200 : 1500);

    if (!freshPlayer) {
      setTimeout(function () {
        if (away > 120 && St.spaceUsed()) runShift(away / 3600, false);
        else U.toast('برگشتی. مغازه باز است.');
      }, U.reduceMotion ? 300 : 1800);
    }

    requestAnimationFrame(loop);
  }

  A.game = {
    start: start,
    buyStation: buyStation, hire: hire, assignCrew: assignCrew,
    upgradeTier: upgradeTier, buyBook: buyBook, prestige: prestige, hardReset: hardReset,
    serve: serve, claimGoal: claimGoal, fireEvent: fireEvent, runShift: runShift,
    openShift: openShift, triggerEnding: triggerEnding,
    /* برای تست */
    debug: {
      grant: function (v) { S().money += v; S().total += v; disp = S().money; afterChange(); },
      setTier: function (i) {
        S().tier = clamp(i | 0, 0, D.TIERS.length - 1);
        Sc.reset(); Sc.setTier(S().tier); Sc.snapCamera(); afterChange();
      },
      state: function () { return S(); }, meta: function () { return M(); },
      heat: function (v) { heat = v; },
      goal: function () { newGoal(); return goal; },
      booted: function () { return booted; }
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window.ABRO);
