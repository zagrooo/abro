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
      lvl: zero(IDS), crew: zero(IDS), people: people,
      ing: 'normal', risk: 'mid', served: 0, goalsDone: 0,
      lastNote: '', ts: Date.now(), ended: 0,
      closedAt: 0,          /* اگر بسته باشد، زمان بستن */
      closedRate: 0,        /* نرخ قفل‌شده در لحظه‌ی بستن */
      openedAt: Date.now(), /* زمان آخرین باز شدن */
      boostUntil: 0
    };
  }

  /* ───────── وضعیت دائمی ───────── */
  function newMeta() {
    return {
      abroo: 0, abrooTotal: 0, gems: 12, runs: 0, bestTotal: 0,
      book: {}, badges: [], spaceBonus: 0,
      seenIntro: 0, coached: 0, sound: 1, gfx: 2, adCount: 0, adDay: ''
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
  function crewUsed() {
    var n = 0;
    for (var i = 0; i < IDS.length; i++) n += S.crew[IDS[i]];
    return n;
  }
  function crewFree() { return S.hired - crewUsed(); }
  function crewNeed(id) {
    var l = S.lvl[id];
    return l === 0 ? 0 : 1 + Math.floor((l - 1) / 7);
  }
  function hireCost() {
    return Math.floor(E.hireBase * Math.pow(E.hireGrowth, S.hired) * tier().mult);
  }
  function wage() {
    return Math.max(300, Math.floor(rawRate() * E.wageShare));
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
    var man = need ? Math.min(1, S.crew[s.id] / need) : 1;
    var r = s.rate * lvl * (.45 + .55 * man) * tier().mult * integMult() * abrooMult() * bookRateMult();
    if (s.id === 'peyk' && perkOn('peykboy')) r *= 1.25;
    return noBoost ? r : r * boostMult();
  }
  function rawRate() {
    var r = 0;
    for (var i = 0; i < D.STATIONS.length; i++) r += stationRate(D.STATIONS[i], true);
    return r;
  }
  function rate() { return rawRate() * boostMult(); }

  /* یک سطح بیشتر از این ایستگاه چقدر به نرخ اضافه می‌کند؟
     چون «جا» محدود است، این عدد معیار درست خرید است، نه قیمت. */
  function marginalGain(s) {
    var before = stationRate(s);
    S.lvl[s.id]++;
    var after = stationRate(s);
    S.lvl[s.id]--;
    return after - before;
  }
  /* بهترین ایستگاه برای جای بعدی */
  function bestStationId() {
    var best = null, bg = -1;
    for (var i = 0; i < D.STATIONS.length; i++) {
      var s = D.STATIONS[i];
      if (S.tier < s.tier) continue;
      var g = marginalGain(s);
      if (g > bg) { bg = g; best = s.id; }
    }
    return best;
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
  function bulkCost(s, n) {
    var c = 0;
    for (var i = 0; i < n; i++) c += upCost(s, i);
    return c;
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
      'closedAt', 'closedRate', 'openedAt', 'boostUntil'].forEach(function (k) {
        base[k] = num(raw[k], base[k]);
      });
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
      'seenIntro', 'coached', 'sound', 'adCount'].forEach(function (k) {
        m[k] = Math.max(0, num(raw[k], m[k]));
      });
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
    hireCost: hireCost, wage: wage,
    abrooMult: abrooMult, integMult: integMult,
    stationRate: stationRate, rate: rate, rawRate: rawRate, tapValue: tapValue,
    marginalGain: marginalGain, bestStationId: bestStationId,
    upCost: upCost, bulkCost: bulkCost, buyPlan: buyPlan,
    tierCost: tierCost, tierReq: tierReq, tierBlocked: tierBlocked, discount: discount,
    applyInteg: applyInteg, shiftPeople: shiftPeople, integLossMul: integLossMul,
    abrooGain: abrooGain, canPrestige: canPrestige, doPrestige: doPrestige,
    addGems: addGems, spendGems: spendGems, adsLeft: adsLeft, useAd: useAd,
    checkBadges: checkBadges, hasBadge: hasBadge,
    save: save, load: load, wipe: wipe, hadOldSave: hadOldSave, dropOldSaves: dropOldSaves
  };
})(window.ABRO);
