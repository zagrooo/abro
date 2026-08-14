/* ═══════════════════════════════════════════════
   آبرو — وضعیت، ذخیره، و همه‌ی فرمول‌ها
   ═══════════════════════════════════════════════ */
(function (A) {
  'use strict';

  var U = A.util, D = A.data;
  var clamp = U.clamp;
  var IDS = D.STATIONS.map(function (s) { return s.id; });
  var PIDS = D.PEOPLE.map(function (p) { return p.id; });

  function zero(keys) {
    var o = {};
    keys.forEach(function (k) { o[k] = 0; });
    return o;
  }

  /* وضعیت یک دور */
  function newRun(meta) {
    var seedLv = meta && meta.book ? (meta.book.seed || 0) : 0;
    var start = seedLv > 0 ? 5e4 * Math.pow(9, seedLv - 1) : 0;
    var people = {};
    D.PEOPLE.forEach(function (p) { people[p.id] = p.start; });
    return {
      money: start, total: 0, integ: 70, tier: 0, day: 0, hired: 0,
      lvl: zero(IDS), crew: zero(IDS), people: people,
      ing: 'normal', risk: 'mid', served: 0, goalsDone: 0,
      lastNote: '', ts: Date.now(), ended: 0
    };
  }

  /* وضعیت دائمی (از واگذاری جان به در می‌برد) */
  function newMeta() {
    return {
      abroo: 0, abrooTotal: 0, runs: 0, bestTotal: 0,
      book: {}, badges: [], seenIntro: 0, coached: 0, sound: 1, gfx: 2
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

  /* ───────── فضا ───────── */
  function spaceUsed() {
    var n = 0;
    for (var i = 0; i < IDS.length; i++) n += S.lvl[IDS[i]];
    return n;
  }
  function spaceCap() {
    return Math.floor(tier().space * (1 + .12 * book('space')));
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
    return Math.floor(15e3 * Math.pow(1.85, S.hired) * (1 + S.tier * .6) * Math.pow(3.4, Math.max(0, S.tier - 4)));
  }
  function wage() {
    return Math.floor(42e3 * (1 + S.tier * 1.5) * Math.pow(2.6, Math.max(0, S.tier - 4)));
  }

  /* ───────── ضریب‌ها ───────── */
  function abrooMult() { return 1 + M.abrooTotal * .09; }
  function integMult() { return .62 + (S.integ / 100) * .58; }
  function bookRateMult() { return 1 + .25 * book('recipe'); }

  function stationRate(s) {
    var lvl = S.lvl[s.id];
    if (!lvl) return 0;
    var need = crewNeed(s.id);
    var man = need ? Math.min(1, S.crew[s.id] / need) : 1;
    var r = s.rate * lvl * (.45 + .55 * man) * tier().mult * integMult() * abrooMult() * bookRateMult();
    if (s.id === 'peyk' && perkOn('peykboy')) r *= 1.25;
    return r;
  }
  function rate() {
    var r = 0;
    for (var i = 0; i < D.STATIONS.length; i++) r += stationRate(D.STATIONS[i]);
    return r;
  }
  function tapValue(heat) {
    var base = Math.max(120, rate() * 2.2) * (1 + S.tier * .15);
    return base * (1 + .5 * book('hands')) * (1 + (heat || 0) * 1.5);
  }

  /* ───────── هزینه‌ها ───────── */
  function discount() { return 1 - .07 * book('haggle'); }
  function upCost(s, extra) {
    return Math.floor(s.cost * Math.pow(1.28, S.lvl[s.id] + (extra || 0)) * discount());
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
      var n = 0, c = 0;
      while (n < space && n < 500) {
        var nx = upCost(s, n);
        if (c + nx > money) break;
        c += nx; n++;
      }
      if (n === 0) return { n: 1, c: upCost(s, 0), full: false };
      return { n: n, c: c, full: false };
    }
    var k = Math.min(+mult || 1, space);
    return { n: k, c: bulkCost(s, k), full: false };
  }
  function tierCost() { return Math.floor(tier().cost * discount()); }

  /* ───────── اصالت ───────── */
  function integLossMul() {
    var m = 1 - .2 * book('honest');
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
    var raw = Math.pow(S.total / 5e8, .4) * (S.integ / 55);
    return Math.max(S.tier >= 3 ? 1 : 0, Math.floor(raw));
  }
  function canPrestige() { return S.tier >= 3 || S.total > 6e7; }

  function doPrestige() {
    var g = abrooGain();
    M.abroo += g;
    M.abrooTotal += g;
    M.runs++;
    M.bestTotal = Math.max(M.bestTotal || 0, S.total);
    S = newRun(M);
    return g;
  }

  /* ───────── نشان‌ها ───────── */
  function checkBadges(extra) {
    var got = [];
    for (var i = 0; i < D.BADGES.length; i++) {
      var b = D.BADGES[i];
      if (M.badges.indexOf(b.id) >= 0) continue;
      var ok = false;
      try { ok = b.test(S, extra || {}); } catch (e) { ok = false; }
      if (ok) {
        M.badges.push(b.id);
        M.abroo += b.r; M.abrooTotal += b.r;
        got.push(b);
      }
    }
    return got;
  }
  function hasBadge(id) { return M.badges.indexOf(id) >= 0; }

  /* ───────── ذخیره ───────── */
  var KEY = 'abro:v3';
  var memOnly = false;

  function save() {
    S.ts = Date.now();
    if (memOnly) return;
    try { localStorage.setItem(KEY, JSON.stringify({ v: 3, s: S, m: M })); }
    catch (e) { memOnly = true; }
  }
  function rawLoad() {
    try {
      var r = localStorage.getItem(KEY);
      return r ? JSON.parse(r) : null;
    } catch (e) { memOnly = true; return null; }
  }

  function num(v, def) { var n = Number(v); return isFinite(n) ? n : def; }

  function adoptRun(raw) {
    var base = newRun(M);
    if (!raw || typeof raw !== 'object') return base;
    ['money', 'total', 'integ', 'tier', 'day', 'hired', 'served', 'goalsDone', 'ended'].forEach(function (k) {
      base[k] = num(raw[k], base[k]);
    });
    base.tier = clamp(Math.floor(base.tier), 0, D.TIERS.length - 1);
    base.integ = clamp(base.integ, 0, 100);
    base.hired = Math.max(0, Math.floor(base.hired));
    base.money = Math.max(0, base.money);

    IDS.forEach(function (id) {
      base.lvl[id] = Math.max(0, Math.floor(num(raw.lvl && raw.lvl[id], 0)));
      base.crew[id] = Math.max(0, Math.floor(num(raw.crew && raw.crew[id], 0)));
    });
    /* سقف نیروی هر ایستگاه */
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
    ['abroo', 'abrooTotal', 'runs', 'bestTotal', 'seenIntro', 'coached', 'sound'].forEach(function (k) {
      m[k] = Math.max(0, num(raw[k], m[k]));
    });
    if (m.abrooTotal < m.abroo) m.abrooTotal = m.abroo;
    m.gfx = clamp(Math.floor(num(raw.gfx, 2)), 0, 2);
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
    M = newMeta();
    S = newRun(M);
  }
  function softReset() {
    S = newRun(M);
  }

  A.state = {
    IDS: IDS,
    get S() { return S; },
    get M() { return M; },
    tier: tier, isLast: isLast, book: book, stand: stand, perkOn: perkOn,
    spaceUsed: spaceUsed, spaceCap: spaceCap,
    crewFree: crewFree, crewUsed: crewUsed, crewNeed: crewNeed,
    hireCost: hireCost, wage: wage,
    abrooMult: abrooMult, integMult: integMult,
    stationRate: stationRate, rate: rate, tapValue: tapValue,
    upCost: upCost, bulkCost: bulkCost, buyPlan: buyPlan, tierCost: tierCost, discount: discount,
    applyInteg: applyInteg, shiftPeople: shiftPeople, integLossMul: integLossMul,
    abrooGain: abrooGain, canPrestige: canPrestige, doPrestige: doPrestige,
    checkBadges: checkBadges, hasBadge: hasBadge,
    save: save, load: load, wipe: wipe, softReset: softReset
  };
})(window.ABRO);
