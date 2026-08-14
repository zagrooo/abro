/* ═══════════════════════════════════════════════
   آبرو — منطق بازی و حلقه‌ی اصلی
   ═══════════════════════════════════════════════ */
(function (A) {
  'use strict';

  var U = A.util, D = A.data, St = A.state, Sc = A.scene, UI = A.ui, AU = A.audio;
  var $ = U.$, fa = U.fa, money = U.money, clamp = U.clamp, rnd = U.rnd;
  var E = D.ECON;

  var disp = 0, heat = 0, evTimer = 65, goal = null, goalTimer = 45;
  var lastFrame = performance.now(), coinTimer = 0, saveTimer = 0, hudTimer = 0, sheetTick = false;
  var rcNet = 0, rcHours = 0, rcUsedAd = false, hiddenAt = 0, booted = false;

  function S() { return St.S; }
  function M() { return St.M; }

  var MODALS = ['shiftVeil', 'evVeil', 'rcVeil', 'actVeil', 'enVeil', 'intro', 'buyVeil', 'giftVeil'];
  function anyModal() {
    for (var i = 0; i < MODALS.length; i++) {
      var el = $(MODALS[i]);
      if (el && !el.hidden) return true;
    }
    return false;
  }

  /* ═════════ خرید و کنش ═════════ */
  function buyStation(id, mult, btn) {
    if (St.isClosed()) { AU.sfx.no(); U.toast('مغازه بسته است.', 'bad'); return; }
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

  function autoCrew() {
    var n = St.autoAssign();
    if (!n) { AU.sfx.no(); return; }
    AU.sfx.buy(); U.buzz(10);
    U.toast(fa(n) + ' نفر سرِ جایشان رفتند.', 'good');
    afterChange();
  }

  function upgradeTier() {
    var blocked = St.tierBlocked();
    if (blocked) {
      AU.sfx.no();
      if (blocked === 'levels') {
        U.toast('برای این پرده حداقل ' + fa(St.tierReq()) + ' سطح ایستگاه لازم داری. الان ' +
          fa(St.spaceUsed()) + ' داری.', 'bad');
      } else if (blocked === 'money') {
        U.toast('هنوز ' + money(St.tierCost() - S().money) + ' تومان کم داری.', 'bad');
      }
      return;
    }
    S().money -= St.tierCost(); disp = S().money;
    S().tier++;
    St.addGems(3);
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
    heat = 0; goal = null; goalTimer = 45; evTimer = 65;
    Sc.reset(); Sc.setTier(0); Sc.snapCamera();
    UI.closeSheet();
    UI.setGoal(null);
    UI.showAct(0, null);
    U.toast('شهر تازه. +' + fa(g) + ' آبرو با تو آمد.', 'good');
    afterChange();
  }

  function hardReset() {
    St.wipe();
    disp = 0; heat = 0; goal = null; goalTimer = 45; evTimer = 65;
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
          U.toast('نشان گرفتی: ' + b.name + ' (+' + fa(b.r) + ' آبرو، +۱ الماس)', 'good');
          AU.sfx.badge();
        }, i * 900);
      });
    }
    UI.syncHUD(disp, heat);
    St.save();
  }

  /* ═════════ فروشگاه ═════════ */

  /* هر بسته چه چیزهایی می‌دهد — به زبان آدمیزاد، برای کارت تأیید */
  function packContents(item) {
    var g = item.give || (item.gems ? { gems: item.gems } : {});
    var out = [];
    if (g.gems) out.push({ icon: 'gem', text: fa(g.gems) + ' فیروزه' });
    if (g.gemsPerDay) out.push({ icon: 'gem', text: 'روزی ' + fa(g.gemsPerDay) + ' فیروزه، ' + fa(g.days) + ' روز' });
    if (g.incomeHours) out.push({ icon: 'coin', text: fa(g.incomeHours) + ' ساعت درآمد (' + money(St.rate() * 3600 * g.incomeHours) + ')' });
    if (g.staff) out.push({ icon: 'crew', text: fa(g.staff) + ' نیروی ' + (g.staffGrade || 'عادی') });
    if (g.space) out.push({ icon: 'space', text: fa(g.space) + ' جای دائمی' });
    if (g.abroo) out.push({ icon: 'abroo', text: fa(g.abroo) + ' آبرو' });
    if (g.noAds) out.push({ icon: 'noads', text: 'حذف همیشگی تبلیغ اجباری' });
    return out;
  }

  /* رساندن محتویات بسته */
  function grantPack(item) {
    var g = item.give || (item.gems ? { gems: item.gems } : {});
    var lines = [];

    if (g.gems) { St.addGems(g.gems); lines.push('+' + fa(g.gems) + ' فیروزه'); }
    if (g.incomeHours) {
      var cash = Math.max(5000, St.rate() * 3600 * g.incomeHours);
      S().money += cash; S().total += cash; disp = S().money;
      Sc.spawnCoin(cash, true);
      lines.push('+' + money(cash));
    }
    if (g.staff) { S().hired += g.staff; lines.push('+' + fa(g.staff) + ' نیرو'); }
    if (g.space) { M().spaceBonus = (M().spaceBonus || 0) + g.space; lines.push('+' + fa(g.space) + ' جا'); }
    if (g.abroo) { M().abroo += g.abroo; M().abrooTotal += g.abroo; lines.push('+' + fa(g.abroo) + ' آبرو'); }
    if (g.noAds) { M().noAds = 1; lines.push('تبلیغ حذف شد'); }
    if (g.days) {
      /* اشتراک: از الان به مدت n روز */
      var base = Math.max(Date.now(), M().subUntil || 0);
      M().subUntil = base + g.days * 86400e3;
      M().subDay = '';   /* همان روز اول هم بتواند بگیرد */
      lines.push(fa(g.days) + ' روز صندوق روزانه');
    }

    if (item.once || item.sub) St.recordPurchase(item.id);

    AU.sfx.win(); U.buzz([14, 40, 14, 40, 14]);
    Sc.punch(.8);
    U.toast('رسید: ' + lines.join(' · '), 'good');
    afterChange();
  }

  /* خرید — از لایه‌ی پرداخت رد می‌شود تا روز وصل کردن بازار
     فقط billing.js عوض شود */
  function buyPack(id) {
    var item = D.GEM_PACKS.find(function (x) { return x.id === id; }) ||
      D.BUNDLES.find(function (x) { return x.id === id; });
    if (!item) return;
    if (item.once && St.hasPurchase(item.id)) {
      AU.sfx.no(); U.toast('این بسته را قبلاً گرفته‌ای.', 'bad'); return;
    }
    A.billing.buy(item, function () {
      grantPack(item);
    }, function (why) {
      if (why) { AU.sfx.no(); U.toast(why, 'bad'); }
    });
  }

  /* صندوق روزانه‌ی اشتراک */
  function claimSubChest() {
    var n = St.claimSubChest();
    if (!n) { AU.sfx.no(); return; }
    AU.sfx.win(); U.buzz([12, 30, 12]);
    U.flyCoins($('subChestBtn'), 6);
    U.toast('صندوق امروز: +' + fa(n) + ' فیروزه', 'good');
    afterChange();
  }

  function watchAdForGems() {
    /* اگر تبلیغ را خریده حذف کند، جایزه‌اش را رایگان می‌گیرد */
    if (St.adsDisabled()) {
      if (!St.useAd()) {
        U.toast('سهمیه‌ی امروز تمام شد. فردا دوباره پر می‌شود.', 'bad');
        AU.sfx.no();
        return;
      }
      St.addGems(2);
      AU.sfx.win(); U.buzz([10, 30, 10]);
      U.toast('+۲ فیروزه (بدون تبلیغ)', 'good');
      afterChange();
      return;
    }
    if (!St.useAd()) {
      U.toast('سهمیه‌ی امروز تمام شد. فردا دوباره پر می‌شود.', 'bad');
      AU.sfx.no();
      return;
    }
    St.addGems(2);
    AU.sfx.win(); U.buzz([10, 30, 10]);
    U.toast('+۲ الماس', 'good');
    afterChange();
  }

  /* اجناسی که واقعاً پیاده‌سازی شده‌اند. اگر جنسی به data اضافه شود
     و اینجا جا بماند، بدون این نگهبان الماس بازیکن دود می‌شد. */
  var ITEM_HANDLERS = ['cash1', 'boost', 'crew', 'abroo', 'space', 'integ', 'sleep'];

  function buyItem(id, btn) {
    var it = D.SHOP_ITEMS.find(function (x) { return x.id === id; });
    if (!it) return;
    if (ITEM_HANDLERS.indexOf(id) < 0) {
      AU.sfx.no();
      U.toast('این جنس هنوز آماده نیست.', 'bad');
      return;
    }
    /* تقویت وقتی مغازه بسته است می‌سوزد — نرخ شب قفل شده و
       درآمد جاری هم وجود ندارد */
    if (id === 'boost' && St.isClosed()) {
      AU.sfx.no();
      U.toast('مغازه بسته است؛ تقویت الکی می‌سوزد. اول باز کن.', 'bad');
      return;
    }
    /* اگر همین حالا سرِ اوج است، خریدنش پول دور ریختن است */
    if (id === 'sleep' && S().hour >= 17 && S().hour < 24) {
      AU.sfx.no();
      U.toast('همین الان سرِ شب است. لازم نیست.', 'bad');
      return;
    }
    if (!St.spendGems(it.gems)) {
      AU.sfx.no();
      U.toast('الماس کافی نداری.', 'bad');
      return;
    }
    switch (id) {
      case 'cash1': {
        var g = Math.max(1000, St.rate() * 3600);
        S().money += g; S().total += g; disp = S().money;
        Sc.spawnCoin(g, true); U.flyCoins(btn, 8);
        U.toast('+' + money(g) + ' تومان', 'good');
        break;
      }
      case 'boost':
        S().boostUntil = Math.max(Date.now(), S().boostUntil) + 30 * 60 * 1000;
        U.toast('نیم ساعت درآمد دو برابر شد.', 'good');
        Sc.punch(.7);
        break;
      case 'crew':
        S().hired++;
        U.toast('یک نیروی تازه آمد.', 'good');
        break;
      case 'abroo':
        M().abroo += 3; M().abrooTotal += 3;
        U.toast('+۳ آبرو', 'good');
        break;
      case 'space':
        M().spaceBonus = (M().spaceBonus || 0) + 5;
        U.toast('پنج جای دائمی اضافه شد.', 'good');
        break;
      case 'sleep':
        S().hour = 18;
        Sc.punch(.6);
        U.toast('خوابیدی و بیدار شدی. غروب است.', 'good');
        break;
      case 'integ':
        St.applyInteg(20);
        D.PEOPLE.forEach(function (p) { S().people[p.id] = clamp(S().people[p.id] + 8, 0, 100); });
        U.toast('کوچه راضی شد.', 'good');
        break;
    }
    AU.sfx.buy(); U.buzz(12);
    afterChange();
  }

  /* ═════════ کادو ═════════ */
  var pendingGift = null;

  /* جایزه متناسب با جایی که بازیکن در بازی هست */
  function giftReward() {
    var r = St.rate();
    var tier = S().tier;
    /* از پرده‌ی پنجم به بعد گاهی به جای سکه، آبرو می‌دهد */
    if (tier >= 4 && Math.random() < .22) {
      return { type: 'abroo', amount: 1 + Math.floor(tier / 4) };
    }
    var coins = Math.max(300 * (1 + tier * 2), r * 150);
    return { type: 'money', amount: Math.round(coins) };
  }

  function tapGift(wx, wy) {
    if (anyModal() || St.isClosed()) return false;
    var carrier = Sc.hitGift(wx, wy);
    if (!carrier) return false;
    Sc.takeGift(carrier);
    pendingGift = giftReward();
    AU.sfx.win(); U.buzz([12, 40, 12]);
    UI.showGift(pendingGift, claimGift, claimGiftTripled);
    return true;
  }

  function grantGift(g, mul) {
    if (!g) return;
    var amount = Math.round(g.amount * mul);
    if (g.type === 'abroo') {
      M().abroo += amount; M().abrooTotal += amount;
      U.toast('کادو باز شد: +' + fa(amount) + ' آبرو', 'good');
    } else {
      S().money += amount; S().total += amount;
      disp = S().money;
      Sc.spawnCoin(amount, true);
      U.flyCoins($('giftTake'), 8);
      U.toast('کادو باز شد: +' + money(amount) + ' تومان', 'good');
    }
    AU.sfx.coin();
    afterChange();
  }
  /* جایزه را قبل از بستن کادر می‌دهیم؛ وگرنه سکه‌ها از یک عنصر
     پنهان پرواز می‌کردند، یعنی از گوشه‌ی صفحه. */
  function claimGift() {
    grantGift(pendingGift, 1);
    pendingGift = null;
    UI.hideGift();
  }
  function claimGiftTripled() {
    /* عمداً از سهمیه‌ی تبلیغ فروشگاه کم نمی‌شود — دو چیز جدا هستند */
    grantGift(pendingGift, 3);
    pendingGift = null;
    UI.hideGift();
  }

  /* ═════════ سرو ═════════ */
  function serve(fromScene, wx, wy) {
    if (anyModal()) return;
    if (St.isClosed()) {
      if (!fromScene) openShop();
      return;
    }
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
    /* نشان «دستِ داغ» قبلاً بی‌صدا داده می‌شد: نه پیامی، نه ذخیره‌ای */
    if (heat > .97 && !St.hasBadge('combo')) afterChange();
    else UI.syncHUD(disp, heat);
  }

  /* ═════════ سفارش ویژه ═════════ */
  function newGoal() {
    var g = U.pick(D.GOALS);
    var n = Math.round(rnd(g.n[0], g.n[1]));
    var r = Math.max(St.rate(), 60);
    var need = g.type === 'earn' ? Math.round(r * n) : n;
    goal = {
      type: g.type, need: need, have: 0, left: g.t, done: false,
      txt: g.txt(n, need),
      reward: Math.max(2000, g.type === 'earn' ? need * 1.1 : r * E.goalWindow)
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
      goalTimer = rnd(55, 90);
    }
  }
  function claimGoal() {
    if (!goal || !goal.done) { AU.sfx.no(); return; }
    /* جایزه با نرخ لحظه‌ی گرفتن حساب می‌شود، نه لحظه‌ی ساخته شدن.
       وگرنه اگر بازیکن وسط سفارش رشد می‌کرد، جایزه بی‌ارزش می‌شد. */
    goal.reward = Math.max(goal.reward, St.rate() * E.goalWindow);
    S().money += goal.reward; S().total += goal.reward;
    S().goalsDone = (S().goalsDone || 0) + 1;
    St.applyInteg(1);
    U.toast('سفارش ویژه رسید. +' + money(goal.reward) + ' تومان', 'good');
    AU.sfx.coin();
    Sc.spawnCoin(goal.reward, true);
    U.flyCoins($('goalClaim'), 6);
    goal = null;
    UI.setGoal(null);
    goalTimer = rnd(65, 110);
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
    if (anyModal() || !St.spaceUsed() || St.isClosed()) return;
    ev = ev || pickEvent();
    AU.sfx.event(); U.buzz(20);
    if (ev.rain) Sc.rainFor(18000);
    UI.showEvent(ev, S().day + 1, function (o) {
      var base = Math.max(St.rate() * E.eventWindow, 8e3);
      var mult = o.m;
      if (mult > 0) mult *= 1 + .15 * St.book('luck');
      else if (St.perkOn('raqib') && ev.who === 'raqib') mult *= .5;
      else mult *= 1 - .15 * St.book('luck');
      var dm = Math.round(base * mult);
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

  /* ═════════ بستن و باز کردن مغازه ═════════ */
  function buildShiftOptions() {
    $('ingOpts').innerHTML = Object.keys(D.ING).map(function (k) {
      var g = D.ING[k];
      return '<label class="opt"><input type="radio" name="ing" value="' + k + '">' +
        '<span><b>' + g.label + '</b><i>' + g.note +
        '<br>اصالت می‌نشیند روی ' + fa(g.target) + '</i></span></label>';
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
    /* پیش‌بینی برای هشت ساعت آینده، با میانگین تقاضای همان بازه */
    var demand = A.clock.demandOver(S().hour, 8);
    var base = St.rawRate() * St.boostMult() * demand;
    var perHour = base * 3600 * E.closedRate * ing.out * (1 + .18 * St.book('night'));
    var netHour = Math.max(0, perHour - perHour * ing.cost - S().hired * St.wage() / 8);
    $('fcNet').textContent = money(netHour);
    /* «اصالت −۱» به بازیکن هیچ نمی‌گفت. حالا می‌گوید کجا می‌نشیند. */
    $('fcInteg').textContent = 'می‌نشیند روی ' + fa(ing.target);
    /* هوای امشب — روی انتخاب مواد اثر دارد */
    var wx = St.weather(), fw = $('fcWx');
    if (fw && wx) {
      fw.querySelector('svg').innerHTML = wx.icon;
      fw.querySelector('b').textContent = wx.name;
      fw.querySelector('i').textContent = wx.note;
    }
  }
  function openShiftPlan() {
    if (anyModal()) return;
    if (!St.spaceUsed()) { AU.sfx.no(); U.toast('اول یک ایستگاه راه بینداز.', 'bad'); return; }
    if (St.isClosed()) { openShop(); return; }
    UI.closeSheet();
    var i = document.querySelector('input[name=ing][value="' + S().ing + '"]');
    if (i) i.checked = true;
    var r = document.querySelector('input[name=risk][value="' + S().risk + '"]');
    if (r) r.checked = true;
    updateForecast();
    $('shiftVeil').hidden = false;
  }

  /* کرکره را پایین می‌کشی. از این لحظه درآمد شب حساب می‌شود. */
  function closeShop() {
    var p = readShiftPick();
    S().ing = p.ing; S().risk = p.risk;
    S().closedAt = Date.now();
    /* نرخ همان لحظه‌ی بستن قفل می‌شود. وگرنه می‌شد ده ساعت بسته گذاشت،
       بعد درست قبل از باز کردن «شب شلوغ» خرید و کل شب را دو برابر کرد.
       نرخ پایه ذخیره می‌شود — تقاضا بعداً روی کل بازه میانگین گرفته می‌شود. */
    S().closedRate = St.rawRate() * St.boostMult();
    S().closedHour = S().hour;
    $('shiftVeil').hidden = true;
    heat = 0;
    Sc.reset();
    AU.sfx.close();
    U.toast('مغازه بست. هر چه بیشتر بماند، شب پربارتر است.', 'good');
    afterChange();
  }

  /* باز کردن: هرچه از لحظه‌ی بستن گذشته حساب می‌شود */
  function openShop() {
    if (!St.isClosed()) return;
    var realHours = (Date.now() - S().closedAt) / 3600e3;
    var hours = clamp(realHours, 0, E.closedCap);
    var lockedRate = S().closedRate > 0 ? S().closedRate : St.rawRate() * St.boostMult();
    var startHour = S().closedHour;
    S().closedAt = 0;
    S().closedRate = 0;
    /* ساعت بازی به اندازه‌ی زمان واقعیِ بسته بودن جلو می‌رود */
    S().hour = A.clock.advanceAway(startHour, realHours * 3600);
    S().openedAt = Date.now();
    AU.sfx.open();
    if (hours * 3600 < 8) {
      U.toast('همین الان بستی. چیزی جمع نشده.');
      afterChange();
      return;
    }
    runShift(hours, true, lockedRate, startHour);
  }

  /* ═════════ حساب شب ═════════ */
  function runShift(hours, wasClosed, rateOverride, startHour) {
    hours = clamp(Number(hours) || 0, 0, E.closedCap);
    if (hours <= 0 || !St.spaceUsed()) return;
    var ing = D.ING[S().ing], rk = D.RISK[S().risk];
    var luck = wasClosed ? (rk.lo + Math.random() * (rk.hi - rk.lo)) : 1;
    var eff = wasClosed ? E.closedRate * (1 + .18 * St.book('night')) : E.openOfflineRate;
    /* نرخ پایه (بدون تقاضا) × میانگین تقاضای همان بازه‌ی ساعت */
    var baseRate = rateOverride > 0 ? rateOverride : St.rawRate() * St.boostMult();
    var startH = startHour == null ? S().hour : startHour;
    var demand = A.clock.demandOver(startH, hours);
    var bands = A.clock.breakdown(startH, hours);
    var gross = baseRate * demand * 3600 * hours * eff * ing.out * luck;
    var ingCost = gross * ing.cost;
    var wages = S().hired * St.wage() * (hours / 8);
    var net = Math.max(0, gross - ingCost - wages);
    var note = U.pick(D.NIGHT);

    S().day++;
    S().money += net; S().total += net;
    St.applyInteg(wasClosed ? ing.integ : ing.integ * .4);
    S().lastNote = note;

    rcNet = net; rcHours = hours; rcUsedAd = false;
    UI.showReceipt({
      closed: wasClosed, day: S().day, tierName: St.tier().name, ing: S().ing,
      gross: gross, ingCost: ingCost, wages: wages, net: net, luck: luck,
      hired: S().hired, note: note, hours: hours,
      bands: bands, demand: demand, startHour: startH,
      adReady: hours * 60 >= E.adMinMinutes
    }, onAd, onReceiptOk, onCopy);
    AU.sfx.print();
    afterChange();
  }
  function onAd() {
    if (rcUsedAd || rcHours * 60 < E.adMinMinutes) { AU.sfx.no(); return; }
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

  /* ═════════ راهنما ═════════ */
  function maybeCoach(step) {
    if (M().coached & (1 << step)) return;
    M().coached |= (1 << step);
    St.save();
    if (step === 1) {
      UI.coach('این دکمه را بزن. هر بار یک مشتری سرو می‌کنی و پول می‌آید. تند بزنی، گرم می‌شود و بیشتر می‌دهد.',
        $('serveBtn'), 'down');
    } else if (step === 2) {
      UI.coach('پول جمع شد. برو توی «ایستگاه» و اجاق را راه بینداز تا بدون تو هم درآمد بیاید.',
        $('tabShop'), 'down');
    } else if (step === 3) {
      setTimeout(function () {
        UI.coach('وقتی می‌خواهی بروی، «بستن» را بزن. تا وقتی بسته است درآمد شب جمع می‌شود؛ برگردی، فاکتورش را می‌بینی.',
          $('shiftBtn'), 'up');
      }, 1200);
    }
  }

  /* ═════════ حلقه ═════════ */
  var loopErrors = 0;

  /* حفاظ: اگر یک استثنا از حلقه بیرون بزند، rAF دیگر زمان‌بندی نمی‌شود
     و بازی برای همیشه یخ می‌کند — یکی از علت‌های «صفحه‌ی سیاه». */
  function loop(now) {
    try {
      frame(now);
    } catch (e) {
      loopErrors++;
      if (window.console) console.error('حلقه:', e);
      if (loopErrors === 3) {
        /* بار سوم یعنی چیزی واقعاً خراب است؛ کیفیت را پایین می‌بریم
           تا دست‌کم بازی بچرخد */
        try { Sc.setQuality(0); } catch (e2) { }
        U.toast('یک مشکل تصویری پیش آمد. کیفیت آمد پایین.', 'bad');
      }
    }
    requestAnimationFrame(loop);
  }

  function frame(now) {
    var dt = clamp((now - lastFrame) / 1000, 0, .25);
    lastFrame = now;
    var T = now / 1000;
    /* تا وقتی صفحه‌ی بارگذاری کارش تمام نشده، صحنه هنوز آماده نیست */
    if (!booted) return;
    var open = !anyModal();
    var closed = St.isClosed();

    heat = Math.max(0, heat - dt * .3);

    /* ساعت بازی جلو می‌رود — حتی وقتی مغازه بسته است، شب می‌گذرد.
       فقط پشت مودال می‌ایستد تا بازیکن وسط تصمیم ضرر نکند. */
    if (open) S().hour = A.clock.advance(S().hour, dt);

    var r = St.rate();
    if (open && !closed) {
      S().money += r * dt;
      S().total += r * dt;
      /* اصالت به سمت هدفِ موادِ انتخابی می‌رود، نه به سمت صفر.
         انتخاب مواد یعنی «کجا بایستد»، نه «با چه شیبی سقوط کند». */
      St.driftInteg(D.ING[S().ing].target, dt);

      evTimer -= dt;
      if (evTimer <= 0) { evTimer = 70 + Math.random() * 60; fireEvent(); }

      if (r > 0 && !U.reduceMotion) {
        coinTimer -= dt;
        if (coinTimer <= 0) { coinTimer = 1.6 + Math.random() * 1.8; Sc.spawnCoin(r * (1.4 + Math.random())); }
      }
      goalTick(dt, r);

      /* شاخص ثابت شکننده بود؛ اگر تعداد پرده‌ها عوض شود از کار می‌افتاد */
      if (!S().ended && St.isLast() && S().total > D.TIERS[D.TIERS.length - 2].cost * 1.4) triggerEnding();
    }

    disp += (S().money - disp) * Math.min(1, dt * 6);
    if (Math.abs(S().money - disp) < 1) disp = S().money;

    var W = {
      rate: closed ? 0 : r, tier: clamp(S().tier | 0, 0, D.TIERS.length - 1),
      lvl: S().lvl, crew: closed ? 0 : St.crewUsed(), heat: heat,
      closed: closed, hour: S().hour,
      weather: (St.weather() || {}).id || 'clear',
      cityTint: (St.city() || {}).tint || null,
      brandLit: S().lvl.brand > 0 || S().tier >= 3
    };
    Sc.update(dt, T, W);
    Sc.render(T, W);

    /* HUD شش بار در ثانیه، ولی محتوای شیت سه بار — شیت به‌روزرسانی
       سنگین‌تری دارد و چشم فرقش را نمی‌فهمد */
    hudTimer -= dt;
    if (hudTimer <= 0) {
      hudTimer = .16;
      sheetTick = !sheetTick;
      UI.syncHUD(disp, heat, sheetTick);
      UI.syncGoal();
    }

    saveTimer -= dt;
    if (saveTimer <= 0) { saveTimer = 8; St.save(); }

    if (booted && !(M().coached & 4) && S().money > 200 && St.spaceUsed() === 0) maybeCoach(2);
  }

  /* ═════════ غیبت ═════════ */
  function onVisible() {
    if (document.hidden) {
      hiddenAt = Date.now();
      St.save();
      /* موسیقی و AudioContext در پس‌زمینه باتری می‌خوردند */
      AU.stopMusic();
      AU.suspend();
      return;
    }
    lastFrame = performance.now();
    if (M().sound) { AU.resume(); AU.startMusic(); }
    if (!hiddenAt) return;
    var away = clamp((Date.now() - hiddenAt) / 1000, 0, 24 * 3600);
    hiddenAt = 0;
    if (St.isClosed()) return;            /* بسته بوده؛ موقع باز کردن حساب می‌شود */
    /* ساعت بازی به اندازه‌ی زمان واقعی جلو می‌رود */
    var startH = S().hour;
    S().hour = A.clock.advanceAway(startH, away);
    if (away < 25 || !St.spaceUsed()) return;
    var hours = clamp(away / 3600, 0, E.openOfflineCap);
    if (away < 240) {
      var g = St.rawRate() * St.boostMult() * A.clock.demandOver(startH, away / 3600) * away * E.openOfflineRate;
      S().money += g; S().total += g;
      U.toast('در نبودت ' + money(g) + ' ایر جمع شد.', 'good');
      afterChange();
    } else if (!anyModal()) {
      runShift(hours, false, 0, startH);
    }
  }

  /* ═════════ اتصال ورودی‌ها ═════════ */
  function bindInputs() {
    $('serveBtn').addEventListener('click', function () { serve(false); });
    $('tapZone').addEventListener('pointerdown', function (e) {
      if (St.isClosed()) return;
      var w = Sc.toWorld(e.clientX, e.clientY);
      if (tapGift(w.x, w.y)) return;   /* کادو بر سرو مقدم است */
      serve(true, w.x, w.y);
    });
    window.addEventListener('keydown', function (e) {
      if (e.code === 'Space' && !anyModal() && !UI.isSheetOpen()) { e.preventDefault(); serve(false); }
      if (e.code === 'Escape') UI.closeSheet();
    });

    $('shiftBtn').addEventListener('click', openShiftPlan);
    $('shiftGo').addEventListener('click', closeShop);
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

    /* نوار آدرس موبایل هنگام باز و بسته شدن، ده‌ها رویداد resize
       می‌فرستد. بدون این مهار، هر رویداد چند مگابایت بوم تازه
       می‌ساخت و گوشی را می‌خواباند. */
    var resizePending = false;
    function askResize() {
      if (resizePending) return;
      resizePending = true;
      requestAnimationFrame(function () {
        resizePending = false;
        Sc.resize();
      });
    }
    window.addEventListener('resize', askResize);
    window.addEventListener('orientationchange', function () { setTimeout(askResize, 250); });
    if (window.ResizeObserver) new ResizeObserver(askResize).observe($('device'));
    document.addEventListener('pointerdown', function once() {
      AU.resume();
      if (M().sound) AU.startMusic();
      document.removeEventListener('pointerdown', once);
    });
  }

  /* ═════════ راه‌اندازی ═════════ */
  var hadOld = false, freshPlayer = true, awaySec = 0;

  function stageLoad() {
    var steps = Sc.initSteps($('stage')).slice();
    steps.push({
      label: 'باز کردن دفترچه', fn: function () {
        hadOld = St.hadOldSave();
        var had = St.load();
        if (!had && hadOld) St.dropOldSaves();
        Sc.setQuality(M().gfx == null ? 2 : M().gfx);
        if (!M().sound) AU.setOn(false);
        disp = S().money;
        Sc.setTier(S().tier);
        Sc.snapCamera();
        awaySec = had ? clamp((Date.now() - (S().ts || Date.now())) / 1000, 0, 24 * 3600) : 0;
        freshPlayer = !M().seenIntro;
      }
    });
    steps.push({
      label: 'روشن کردن چراغ‌ها', fn: function () {
        UI.init();
        bindInputs();
        buildShiftOptions();
        $('sndBtn').classList.toggle('on', !!M().sound);
        UI.syncHUD(disp, 0);
        UI.setGoal(null);
      }
    });
    return steps;
  }

  function afterLoad() {
    booted = true;
    if (hadOld) U.toast('نسخه‌ی تازه، اقتصاد تازه. بازی از اول شروع می‌شود.');

    if (freshPlayer) {
      var el = $('intro');
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
    } else if (St.isClosed()) {
      U.toast('مغازه بسته است. برای باز کردن، دکمه‌ی پایین را بزن.');
    } else if (awaySec > 240 && St.spaceUsed()) {
      var sh = S().hour;
      S().hour = A.clock.advanceAway(sh, awaySec);
      runShift(clamp(awaySec / 3600, 0, E.openOfflineCap), false, 0, sh);
    } else {
      U.toast('برگشتی. مغازه باز است.');
    }
  }

  function start() {
    A.loader.begin();
    A.loader.run(stageLoad(), function () {
      afterLoad();
    });
    requestAnimationFrame(loop);
  }

  A.game = {
    start: start,
    buyStation: buyStation, hire: hire, assignCrew: assignCrew, autoCrew: autoCrew,
    upgradeTier: upgradeTier, buyBook: buyBook, prestige: prestige, hardReset: hardReset,
    serve: serve, claimGoal: claimGoal, fireEvent: fireEvent, runShift: runShift,
    openShiftPlan: openShiftPlan, closeShop: closeShop, openShop: openShop,
    triggerEnding: triggerEnding,
    buyPack: buyPack, packContents: packContents, claimSubChest: claimSubChest,
    buyItem: buyItem, watchAdForGems: watchAdForGems,
    tapGift: tapGift, claimGift: claimGift, claimGiftTripled: claimGiftTripled,
    debug: {
      grant: function (v) { S().money += v; S().total += v; disp = S().money; afterChange(); },
      gems: function (v) { St.addGems(v); afterChange(); },
      setTier: function (i) {
        S().tier = clamp(i | 0, 0, D.TIERS.length - 1);
        Sc.reset(); Sc.setTier(S().tier); Sc.snapCamera(); afterChange();
      },
      state: function () { return S(); }, meta: function () { return M(); },
      heat: function (v) { heat = v; },
      goal: function () { newGoal(); return goal; },
      close: function (minutesAgo) { S().closedAt = Date.now() - (minutesAgo || 0) * 60000; afterChange(); },
      booted: function () { return booted; }
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window.ABRO);
