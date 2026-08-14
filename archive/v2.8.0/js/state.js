/* ═══════════════════════════════════════════════
   آبرو — وضعیت، ذخیره، و همه‌ی فرمول‌ها
   ═══════════════════════════════════════════════ */
(function (A) {
  'use strict';

  var U = A.util, D = A.data;
  var clamp = U.clamp;
  var E = D.ECON;
  var IDS = D.STATIONS.map(function (s) { return s.id; });
  var PIDS = D.PEOPLE.map(function (p) { return p.id; });

  function zero(keys) {
    var o = {};
    keys.forEach(function (k) { o[k] = 0; });
    return o;
  }

  /* ───────── وضعیت یک دور ───────── */
  function newRun(meta) {
    var seedLv = meta && meta.book ? (meta.book.seed || 0) : 0;
    var start = seedLv > 0 ? 4e3 * Math.pow(12, seedLv - 1) : 0;
    var people = {};
    D.PEOPLE.forEach(function (p) { people[p.id] = p.start; });
    return {
      money: start, total: 0, integ: 70, tier: 0, day: 0, hired: 0,
      staff: [],            /* [{r:نقش, g:درجه, at:ایستگاه یا ''}] */
      lvl: zero(IDS), crew: zero(IDS), people: people,
      ing: 'normal', risk: 'mid', served: 0, goalsDone: 0,
      lastNote: '', ts: Date.now(), ended: 0,
      hour: 19,             /* ساعت بازی — شب شروع می‌شود، سرِ اوج */
      closedAt: 0,          /* اگر بسته باشد، زمان بستن */
      closedRate: 0,        /* نرخ پایه‌ی قفل‌شده در لحظه‌ی بستن (بدون تقاضا) */
      closedHour: 0,        /* ساعت بازی در لحظه‌ی بستن */
      openedAt: Date.now(), /* زمان آخرین باز شدن */
      boostUntil: 0
    };
  }

  /* ───────── وضعیت دائمی ───────── */
  function newMeta() {
    return {
      abroo: 0, abrooTotal: 0, gems: 12, runs: 0, bestTotal: 0,
      book: {}, badges: [], spaceBonus: 0,
      seenIntro: 0, coached: 0, sound: 1, gfx: 2, adCount: 0, adDay: '',
      /* فروشگاه */
      ramadan: 0,      /* منحنی وارونه‌ی رمضان — دستی روشن می‌شود */
      purchases: {},   /* شناسه‌ی بسته → زمان خرید (برای بسته‌های یک‌باره) */
      noAds: 0,        /* تبلیغ اجباری حذف شده */
      subUntil: 0,     /* پایان اشتراک صندوق روزانه */
      subDay: ''       /* آخرین روزی که صندوق گرفته شده */
    };
  }

  var S = newRun(null), M = newMeta();

  /* ───────── دسترسی ───────── */
  function tier() { return D.TIERS[clamp(S.tier | 0, 0, D.TIERS.length - 1)]; }
  function isLast() { return S.tier >= D.TIERS.length - 1; }
  function book(id) { return M.book[id] || 0; }
  function stand(id) { return S.people[id] == null ? 50 : S.people[id]; }
  function perkOn(id) {
    var p = D.PEOPLE.find(function (x) { return x.id === id; });
    return p ? stand(id) >= p.at : false;
  }
  function isClosed() { return S.closedAt > 0; }
  function boostLeft() { return Math.max(0, S.boostUntil - Date.now()) / 1000; }
  function boostMult() { return boostLeft() > 0 ? 2 : 1; }

  /* ───────── فضا ───────── */
  function spaceUsed() {
    var n = 0;
    for (var i = 0; i < IDS.length; i++) n += S.lvl[IDS[i]];
    return n;
  }
  function spaceCap() {
    return Math.floor(tier().space * (1 + .10 * book('space'))) + (M.spaceBonus || 0);
  }

  /* ───────── نیرو ───────── */
  var ST = function () { return A.staff; };

  /* کارمندهای ایستگاهی و کلی */
  function staffAll() { return S.staff || (S.staff = []); }
  function staffGlobal() {
    return staffAll().filter(function (m) { return ST().isGlobal(ST().role(m.r)); });
  }
  function staffFloor() {
    return staffAll().filter(function (m) { return !ST().isGlobal(ST().role(m.r)); });
  }
  function staffAt(id) {
    return staffFloor().filter(function (m) { return m.at === id; });
  }
  function staffIdle() {
    return staffFloor().filter(function (m) { return !m.at; });
  }
  function crewUsed() { return staffFloor().length - staffIdle().length; }
  function crewFree() { return staffIdle().length; }
  function hiredCount() { return staffAll().length; }

  /* توان کل روی یک ایستگاه — نه تعداد نفر، بلکه مجموع توان */
  function crewPower(id) {
    var list = staffAt(id), p = 0;
    for (var i = 0; i < list.length; i++) p += ST().power(list[i], id);
    return p;
  }
  /* نیاز پایه، که «مدیر شیفت» کمش می‌کند */
  function crewNeed(id) {
    var l = S.lvl[id];
    if (l === 0) return 0;
    var base = 1 + Math.floor((l - 1) / 7);
    var m = ST().globalEffect(staffGlobal(), 'need');
    return Math.max(1, Math.ceil(base * m));
  }
  /* چند ایستگاه نیروی کامل ندارند */
  function understaffed() {
    var n = 0;
    for (var i = 0; i < IDS.length; i++) {
      var id = IDS[i];
      if (S.lvl[id] > 0 && crewPower(id) < crewNeed(id)) n++;
    }
    return n;
  }

  /* استخدام یک داوطلب مشخص */
  function addStaff(member) {
    staffAll().push({ r: member.r, g: member.g | 0, at: '' });
    S.hired = hiredCount();
    return staffAll()[staffAll().length - 1];
  }
  /* جابه‌جا کردن یک نفر */
  function assignStaff(index, stationId) {
    var list = staffAll();
    if (index < 0 || index >= list.length) return false;
    var m = list[index];
    if (ST().isGlobal(ST().role(m.r))) return false;   /* نقش کلی جایی نمی‌ایستد */
    if (stationId && !S.lvl[stationId]) return false;  /* ایستگاه خاموش */
    m.at = stationId || '';
    syncCrewCounts();
    return true;
  }
  /* شمارنده‌ی قدیمی را هم‌گام نگه می‌داریم تا بقیه‌ی کد نشکند */
  function syncCrewCounts() {
    for (var i = 0; i < IDS.length; i++) S.crew[IDS[i]] = staffAt(IDS[i]).length;
    S.hired = hiredCount();
  }

  /* چیدن خودکار: هر بیکار می‌رود جایی که بیشترین درآمد را اضافه کند،
     با در نظر گرفتن تناسب نقش. */
  function autoAssign() {
    var moved = 0, guard = 0;
    while (guard++ < 500) {
      var idle = staffIdle();
      if (!idle.length) break;
      var bestGain = 0, bestSt = null, bestIdx = -1;
      for (var k = 0; k < idle.length; k++) {
        var m = idle[k];
        for (var i = 0; i < D.STATIONS.length; i++) {
          var s = D.STATIONS[i], id = s.id;
          if (!S.lvl[id] || crewPower(id) >= crewNeed(id)) continue;
          var before = stationRate(s);
          m.at = id;
          var after = stationRate(s);
          m.at = '';
          var gain = after - before;
          if (gain > bestGain) { bestGain = gain; bestSt = id; bestIdx = staffAll().indexOf(m); }
        }
      }
      if (!bestSt) break;
      staffAll()[bestIdx].at = bestSt;
      moved++;
    }
    syncCrewCounts();
    return moved;
  }

  function hireCost() {
    return Math.floor(E.hireBase * Math.pow(E.hireGrowth, hiredCount()) * tier().mult);
  }
  /* دستمزد پایه‌ی یک نفرِ عادی در هر هشت ساعت */
  function wageBase() {
    return Math.max(300, Math.floor(rawRate() * E.wageShare));
  }
  /* دستمزد کل: هر نفر به نسبت درجه‌اش، با تخفیف حسابدار */
  function wage() {
    var base = wageBase(), list = staffAll(), sum = 0;
    for (var i = 0; i < list.length; i++) sum += base * ST().wageFactor(list[i]);
    return Math.floor(sum * ST().globalEffect(staffGlobal(), 'wage'));
  }

  /* ───────── ضریب‌ها ───────── */
  function abrooMult() { return 1 + M.abrooTotal * .05; }
  function integMult() { return .62 + (S.integ / 100) * .58; }
  function bookRateMult() { return 1 + .25 * book('recipe'); }

  /* نرخ بدون تقویت — برای محاسبه‌ی دستمزد */
  function stationRate(s, noBoost) {
    var lvl = S.lvl[s.id];
    if (!lvl) return 0;
    var need = crewNeed(s.id);
    /* توان نیرو، نه تعدادشان — استادِ آشپز پشت اجاق چند نفر می‌ارزد */
    var man = need ? Math.min(1, crewPower(s.id) / need) : 1;
    var g = staffGlobal();
    /* سقف کارایی ۱٫۱۲ است، نه بیشتر. قبل از این سقف ۱٫۶ بود و
       با چند مربی، درآمد ۶۰٪ بالای حالت پایه می‌رفت — نگهبان بالانس
       دور کامل را از ۴۶ ساعت به ۲۶ ساعت پایین کشید. */
    var eff = Math.min((.45 + .55 * man) * ST().globalBonus(g, 'eff'), 1.12);
    var r = s.rate * lvl * eff * tier().mult * integMult() * abrooMult() * bookRateMult();
    r *= ST().globalBonus(g, 'allSt');
    if (s.id === 'peyk' && perkOn('peykboy')) r *= 1.25;
    /* هوا روی هر ایستگاه اثر خودش را دارد: باران پیک را بالا می‌برد،
       سرما اجاق را، گرما پیشخوان را. */
    r *= weatherStationMul(s.id);
    return noBoost ? r : r * boostMult() * demandMult();
  }
  function rawRate() {
    var r = 0;
    for (var i = 0; i < D.STATIONS.length; i++) r += stationRate(D.STATIONS[i], true);
    return r;
  }
  /* امروزِ جهان: شهر، هوا، مناسبت. یک بار در هر روزِ بازی حساب می‌شود. */
  function todayWorld() {
    if (!A.world) return null;
    return A.world.summary(M.runs || 0, S.day || 0);
  }
  function weather() {
    return A.world ? A.world.weatherFor(M.runs || 0, S.day || 0) : null;
  }
  function occasion() {
    return A.world ? A.world.occasionToday() : null;
  }
  function weatherStationMul(id) {
    return A.world ? A.world.weatherStationMul(weather(), id) : 1;
  }
  /* ضریب کلیِ روز: هوا × مناسبت */
  function worldMult() {
    return A.world ? A.world.todayMul(weather()) : 1;
  }

  /* تقاضا بر اساس ساعت بازی — دستمزد از آن اثر نمی‌گیرد،
     فقط فروش. میانگین شبانه‌روزش دقیقاً ۱ است. */
  function demandMult() {
    return (A.clock ? A.clock.demandAt(S.hour) : 1) * worldMult();
  }
  function rate() { return rawRate() * boostMult() * demandMult(); }

  /* یک سطح بیشتر از این ایستگاه چقدر به نرخ اضافه می‌کند؟
     چون «جا» محدود است، این عدد معیار درست خرید است، نه قیمت. */
  function marginalGain(s) {
    var before = stationRate(s), after = before;
    /* اگر وسط کار استثنا بخورد، سطح ایستگاه بالا می‌ماند و ذخیره خراب می‌شود */
    try {
      S.lvl[s.id]++;
      after = stationRate(s);
    } finally {
      S.lvl[s.id]--;
    }
    return after - before;
  }
  /* دو پیشنهاد جدا:
     buy    = بهترین چیزی که همین حالا پولش را داری
     target = بهترین چیزی که باید برایش پول جمع کنی

     قبلاً فقط یک عدد برمی‌گشت و چون ایستگاه‌های تازه همیشه بازده
     بیشتری دارند، نشان «بهترین» همیشه روی گران‌ترین می‌نشست —
     یعنی روی چیزی که بازیکن پولش را نداشت. */
  function bestPicks() {
    var out = { buy: null, target: null };
    if (spaceCap() - spaceUsed() <= 0) return out;
    var bAff = null, gAff = 0, bAny = null, gAny = 0;
    for (var i = 0; i < D.STATIONS.length; i++) {
      var s = D.STATIONS[i];
      if (S.tier < s.tier) continue;
      var g = marginalGain(s);
      if (g > gAny) { gAny = g; bAny = s.id; }
      if (upCost(s, 0) <= S.money && g > gAff) { gAff = g; bAff = s.id; }
    }
    out.buy = bAff;
    if (bAny && bAny !== bAff) out.target = bAny;
    return out;
  }

  function tapValue(heat) {
    var base = Math.max(E.tapFloor * (1 + S.tier), rate() * E.tapRateShare);
    return base * (1 + .35 * book('hands')) * (1 + (heat || 0) * E.heatMax);
  }

  /* ───────── هزینه‌ها ───────── */
  function discount() { return 1 - .06 * book('haggle'); }
  function upCost(s, extra) {
    return Math.floor(s.cost * Math.pow(D.COST_GROWTH, S.lvl[s.id] + (extra || 0)) * discount());
  }
  /* جمع سری هندسی به‌جای حلقه.
     حلقه‌ی قبلی تا ۱۴۲ بار Math.pow می‌زد و چون شش بار در ثانیه برای
     دوازده ایستگاه اجرا می‌شد، روی موبایل ده هزار pow در ثانیه می‌شد.
     اختلاف با جمع دقیق کمتر از n تومان است — در برابر میلیاردها هیچ. */
  function bulkCost(s, n) {
    if (n <= 0) return 0;
    if (n === 1) return upCost(s, 0);
    var g = D.COST_GROWTH;
    var c0 = s.cost * Math.pow(g, S.lvl[s.id]) * discount();
    return Math.floor(c0 * (Math.pow(g, n) - 1) / (g - 1));
  }
  function buyPlan(s, mult, money) {
    money = money == null ? S.money : money;
    var space = spaceCap() - spaceUsed();
    if (space <= 0) return { n: 0, c: 0, full: true };
    if (mult === 'max') {
      /* حل مستقیم سری هندسی — حلقه‌ی قبلی تا ۹۰۰ بار Math.pow صدا
         می‌زد و چون شش بار در ثانیه اجرا می‌شد، روی موبایل CPU می‌خورد. */
      var g = D.COST_GROWTH;
      var c0 = upCost(s, 0);
      if (c0 > money) return { n: 1, c: c0, full: false };
      var n = Math.floor(Math.log(1 + money * (g - 1) / c0) / Math.log(g));
      n = Math.min(Math.max(1, n), space);
      /* قیمت دقیق را با جمع واقعی می‌گیریم تا با ×۱ و ×۱۰ یکی باشد */
      var c = bulkCost(s, n);
      var guard = 0;
      while (n > 1 && c > money && guard++ < 40) { n--; c = bulkCost(s, n); }
      return { n: n, c: c, full: false };
    }
    var k = Math.min(+mult || 1, space);
    return { n: k, c: bulkCost(s, k), full: false };
  }
  function tierCost() { return Math.floor(tier().cost * discount()); }
  function tierReq() { return tier().req || 0; }
  function tierBlocked() {
    if (!tier().next) return 'last';
    if (spaceUsed() < tierReq()) return 'levels';
    if (S.money < tierCost()) return 'money';
    return null;
  }

  /* ───────── اصالت و آدم‌ها ───────── */
  function integLossMul() {
    var m = 1 - .15 * book('honest');
    if (perkOn('nane')) m *= .6;
    return Math.max(.08, m);
  }
  function applyInteg(delta) {
    if (delta < 0) delta *= integLossMul();
    S.integ = clamp(S.integ + delta, 0, 100);
  }
  /* حرکت آرام به سمت هدف. ثابت زمانی حدود ده دقیقه، پس بازیکن
     تغییر مواد را حس می‌کند ولی یک‌شبه جابه‌جا نمی‌شود.
     رفتن به سمت پایین با «امانت» و ننه‌ی همسایه کندتر می‌شود. */
  function driftInteg(target, dt) {
    if (target == null) return;
    var k = dt / 600;                  /* ثابت زمانی ≈ ده دقیقه */
    var d = (target - S.integ) * Math.min(1, k);
    if (d < 0) d *= integLossMul();
    S.integ = clamp(S.integ + d, 0, 100);
  }

  function shiftPeople(map) {
    if (!map) return;
    for (var k in map) {
      if (S.people[k] != null) S.people[k] = clamp(S.people[k] + map[k], 0, 100);
    }
  }

  /* ───────── آبرو ───────── */
  function abrooGain() {
    if (S.total <= 0) return 0;
    var raw = Math.pow(S.total / 2e8, .32) * (S.integ / 60);
    return Math.max(S.tier >= 3 ? 1 : 0, Math.floor(raw));
  }
  function canPrestige() { return S.tier >= 3 || S.total > 5e6; }

  function doPrestige() {
    var g = abrooGain();
    /* تقویتی که با الماس خریده شده نباید با واگذاری بسوزد */
    var keepBoost = S.boostUntil || 0;
    M.abroo += g;
    M.abrooTotal += g;
    M.runs++;
    M.bestTotal = Math.max(M.bestTotal || 0, S.total);
    S = newRun(M);
    S.boostUntil = keepBoost;
    return g;
  }

  /* ───────── الماس و سهمیه‌ی روزانه ───────── */
  var AD_PER_DAY = 5;
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  /* سهمیه‌ی تبلیغ هر روز از نو پر می‌شود — قبلاً هیچ‌وقت صفر نمی‌شد
     و بعد از پنج بار برای همیشه تمام بود. */
  function adsLeft() {
    if (M.adDay !== today()) return AD_PER_DAY;
    return Math.max(0, AD_PER_DAY - (M.adCount || 0));
  }
  function useAd() {
    if (M.adDay !== today()) { M.adDay = today(); M.adCount = 0; }
    if (M.adCount >= AD_PER_DAY) return false;
    M.adCount++;
    return true;
  }
  function addGems(n) { M.gems = Math.max(0, (M.gems || 0) + n); }

  /* ───────── فروشگاه ───────── */
  function hasPurchase(id) { return !!(M.purchases && M.purchases[id]); }
  function recordPurchase(id) {
    if (!M.purchases) M.purchases = {};
    M.purchases[id] = Date.now();
  }
  /* آیا این بسته الان قابل خرید است؟ */
  function packAvailable(b) {
    if (b.once && hasPurchase(b.id)) return false;
    if (b.sub && subActive()) return false;
    if (b.minTier != null && S.tier < b.minTier) return false;
    if (b.maxTier != null && S.tier > b.maxTier) return false;
    return true;
  }
  function subActive() { return (M.subUntil || 0) > Date.now(); }
  function subDaysLeft() {
    if (!subActive()) return 0;
    return Math.ceil((M.subUntil - Date.now()) / 86400e3);
  }
  /* صندوق روزانه — روزی یک بار */
  function subChestReady() { return subActive() && M.subDay !== today(); }
  function claimSubChest() {
    if (!subChestReady()) return 0;
    M.subDay = today();
    addGems(20);
    return 20;
  }
  function adsDisabled() { return !!M.noAds; }
  function spendGems(n) {
    if ((M.gems || 0) < n) return false;
    M.gems -= n;
    return true;
  }

  /* ───────── نشان‌ها ───────── */
  function badgeContext() {
    return { heat: 0, runs: M.runs, levels: spaceUsed() };
  }
  function checkBadges(extra) {
    var ctx = badgeContext();
    if (extra) for (var k in extra) ctx[k] = extra[k];
    var got = [];
    for (var i = 0; i < D.BADGES.length; i++) {
      var b = D.BADGES[i];
      if (M.badges.indexOf(b.id) >= 0) continue;
      var ok = false;
      try { ok = b.test(S, ctx); } catch (e) { ok = false; }
      if (ok) {
        M.badges.push(b.id);
        M.abroo += b.r; M.abrooTotal += b.r;
        M.gems = (M.gems || 0) + 1;
        got.push(b);
      }
    }
    return got;
  }
  function hasBadge(id) { return M.badges.indexOf(id) >= 0; }

  /* ───────── ذخیره ───────── */
  var KEY = 'abro:v4';
  var OLD_KEYS = ['abro:v3', 'abro:v2'];
  var memOnly = false;

  function save() {
    S.ts = Date.now();
    if (memOnly) return;
    try { localStorage.setItem(KEY, JSON.stringify({ v: 4, s: S, m: M })); }
    catch (e) { memOnly = true; }
  }
  function rawLoad() {
    try {
      var r = localStorage.getItem(KEY);
      return r ? JSON.parse(r) : null;
    } catch (e) { memOnly = true; return null; }
  }
  function hadOldSave() {
    try {
      for (var i = 0; i < OLD_KEYS.length; i++) if (localStorage.getItem(OLD_KEYS[i])) return true;
    } catch (e) { }
    return false;
  }
  function dropOldSaves() {
    try { OLD_KEYS.forEach(function (k) { localStorage.removeItem(k); }); } catch (e) { }
  }

  function num(v, def) { var n = Number(v); return isFinite(n) ? n : def; }

  function adoptRun(raw) {
    var base = newRun(M);
    if (!raw || typeof raw !== 'object') return base;
    ['money', 'total', 'integ', 'tier', 'day', 'hired', 'served', 'goalsDone', 'ended',
      'hour', 'closedAt', 'closedRate', 'closedHour', 'openedAt', 'boostUntil'].forEach(function (k) {
        base[k] = num(raw[k], base[k]);
      });
    base.hour = A.clock ? A.clock.norm(base.hour) : 19;
    base.tier = clamp(Math.floor(base.tier), 0, D.TIERS.length - 1);
    base.integ = clamp(base.integ, 0, 100);
    base.hired = Math.max(0, Math.floor(base.hired));
    base.money = Math.max(0, base.money);
    base.closedAt = Math.max(0, base.closedAt);
    base.openedAt = base.openedAt > 0 ? base.openedAt : Date.now();

    IDS.forEach(function (id) {
      base.lvl[id] = Math.max(0, Math.floor(num(raw.lvl && raw.lvl[id], 0)));
      base.crew[id] = Math.max(0, Math.floor(num(raw.crew && raw.crew[id], 0)));
    });
    IDS.forEach(function (id) {
      var l = base.lvl[id], cap = l ? 1 + Math.floor((l - 1) / 7) : 0;
      base.crew[id] = Math.min(base.crew[id], cap);
    });
    var over = IDS.reduce(function (a, i) { return a + base.crew[i]; }, 0) - base.hired;
    IDS.forEach(function (id) {
      while (over > 0 && base.crew[id] > 0) { base.crew[id]--; over--; }
    });

    /* ───── کارمندها ─────
       ذخیره‌ی تازه فهرست دارد. ذخیره‌ی قدیمی فقط یک عدد داشت،
       پس همان تعداد «شاگرد عادی» می‌سازیم و سرِ جای قبلی‌شان می‌گذاریم.
       هیچ نیرویی از دست نمی‌رود. */
    base.staff = [];
    var ROLE_IDS = D.ROLES.map(function (r) { return r.id; });
    if (Array.isArray(raw.staff) && raw.staff.length) {
      raw.staff.slice(0, 400).forEach(function (m) {
        if (!m || typeof m !== 'object') return;
        var rid = ROLE_IDS.indexOf(m.r) >= 0 ? m.r : 'helper';
        var g = clamp(Math.floor(num(m.g, 0)), 0, D.GRADES.length - 1);
        var at = (typeof m.at === 'string' && IDS.indexOf(m.at) >= 0) ? m.at : '';
        base.staff.push({ r: rid, g: g, at: at });
      });
    } else {
      /* مهاجرت از ذخیره‌ی قدیمی */
      IDS.forEach(function (id) {
        for (var i = 0; i < base.crew[id]; i++) base.staff.push({ r: 'helper', g: 0, at: id });
      });
      var rest = Math.max(0, base.hired - base.staff.length);
      for (var j = 0; j < rest; j++) base.staff.push({ r: 'helper', g: 0, at: '' });
    }
    /* نقش کلی نباید سرِ ایستگاه بماند، و ایستگاه خاموش هم نه */
    base.staff.forEach(function (m) {
      var r = D.ROLES.filter(function (x) { return x.id === m.r; })[0];
      if ((r && r.global) || (m.at && !base.lvl[m.at])) m.at = '';
    });
    base.hired = base.staff.length;
    IDS.forEach(function (id) {
      base.crew[id] = base.staff.filter(function (m) { return m.at === id; }).length;
    });
    PIDS.forEach(function (id) {
      var p = D.PEOPLE.find(function (x) { return x.id === id; });
      base.people[id] = clamp(num(raw.people && raw.people[id], p.start), 0, 100);
    });
    if (D.ING[raw.ing]) base.ing = raw.ing;
    if (D.RISK[raw.risk]) base.risk = raw.risk;
    if (typeof raw.lastNote === 'string') base.lastNote = raw.lastNote.slice(0, 200);
    base.ts = num(raw.ts, Date.now());
    return base;
  }

  function adoptMeta(raw) {
    var m = newMeta();
    if (!raw || typeof raw !== 'object') return m;
    ['abroo', 'abrooTotal', 'gems', 'runs', 'bestTotal', 'spaceBonus',
      'seenIntro', 'coached', 'sound', 'adCount', 'noAds', 'subUntil', 'ramadan'].forEach(function (k) {
        m[k] = Math.max(0, num(raw[k], m[k]));
      });
    if (typeof raw.subDay === 'string') m.subDay = raw.subDay.slice(0, 12);
    /* سابقه‌ی خرید — فقط شناسه‌های شناخته‌شده */
    if (raw.purchases && typeof raw.purchases === 'object') {
      var known = D.GEM_PACKS.map(function (p) { return p.id; })
        .concat(D.BUNDLES.map(function (b) { return b.id; }));
      known.forEach(function (id) {
        var t = num(raw.purchases[id], 0);
        if (t > 0) m.purchases[id] = t;
      });
    }
    if (m.abrooTotal < m.abroo) m.abrooTotal = m.abroo;
    m.gfx = clamp(Math.floor(num(raw.gfx, 2)), 0, 2);
    if (typeof raw.adDay === 'string') m.adDay = raw.adDay.slice(0, 12);
    D.BOOK.forEach(function (n) {
      m.book[n.id] = clamp(Math.floor(num(raw.book && raw.book[n.id], 0)), 0, n.max);
    });
    if (Array.isArray(raw.badges)) {
      var valid = D.BADGES.map(function (b) { return b.id; });
      m.badges = raw.badges.filter(function (x) { return valid.indexOf(x) >= 0; });
    }
    return m;
  }

  function load() {
    var raw = rawLoad();
    if (!raw || !raw.s) return false;
    M = adoptMeta(raw.m);
    S = adoptRun(raw.s);
    return true;
  }

  function wipe() {
    try { localStorage.removeItem(KEY); } catch (e) { }
    dropOldSaves();
    M = newMeta();
    S = newRun(M);
  }

  A.state = {
    IDS: IDS,
    get S() { return S; },
    get M() { return M; },
    tier: tier, isLast: isLast, book: book, stand: stand, perkOn: perkOn,
    isClosed: isClosed, boostLeft: boostLeft, boostMult: boostMult,
    spaceUsed: spaceUsed, spaceCap: spaceCap,
    crewFree: crewFree, crewUsed: crewUsed, crewNeed: crewNeed,
    crewPower: crewPower, understaffed: understaffed, autoAssign: autoAssign,
    staffAll: staffAll, staffAt: staffAt, staffIdle: staffIdle,
    staffGlobal: staffGlobal, staffFloor: staffFloor, hiredCount: hiredCount,
    addStaff: addStaff, assignStaff: assignStaff, syncCrewCounts: syncCrewCounts,
    hireCost: hireCost, wage: wage, wageBase: wageBase,
    abrooMult: abrooMult, integMult: integMult,
    stationRate: stationRate, rate: rate, rawRate: rawRate, tapValue: tapValue,
    demandMult: demandMult, worldMult: worldMult,
    weather: weather, occasion: occasion, todayWorld: todayWorld,
    city: function () { return A.world ? A.world.cityFor(M.runs || 0) : null; },
    marginalGain: marginalGain, bestPicks: bestPicks,
    upCost: upCost, bulkCost: bulkCost, buyPlan: buyPlan,
    tierCost: tierCost, tierReq: tierReq, tierBlocked: tierBlocked, discount: discount,
    applyInteg: applyInteg, driftInteg: driftInteg, shiftPeople: shiftPeople, integLossMul: integLossMul,
    abrooGain: abrooGain, canPrestige: canPrestige, doPrestige: doPrestige,
    addGems: addGems, spendGems: spendGems, adsLeft: adsLeft, useAd: useAd,
    hasPurchase: hasPurchase, recordPurchase: recordPurchase, packAvailable: packAvailable,
    subActive: subActive, subDaysLeft: subDaysLeft,
    subChestReady: subChestReady, claimSubChest: claimSubChest, adsDisabled: adsDisabled,
    checkBadges: checkBadges, hasBadge: hasBadge,
    save: save, load: load, wipe: wipe, hadOldSave: hadOldSave, dropOldSaves: dropOldSaves
  };
})(window.ABRO);
