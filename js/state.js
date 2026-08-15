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
  /* هر ایستگاه یک آرایه به اندازه‌ی تکه‌هایش، همه صفر */
  function zeroSub() {
    var o = {};
    IDS.forEach(function (id) {
      var defs = D.SUBPARTS[id] || [];
      o[id] = defs.map(function () { return 0; });
    });
    return o;
  }
  function noFocus() {
    var o = {};
    IDS.forEach(function (id) { o[id] = -1; });
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
      sub: zeroSub(),       /* سطح هر زیرقطعه — جمعشان همان lvl است */
      subFocus: noFocus(),  /* تکه‌ای که خریدهای بعدی سراغش می‌روند، یا ‎-۱ */
      menu: [],             /* غذاهای امشب */
      price: 2,             /* پله‌ی قیمت — وسط، یعنی خنثی */
      licDay: -999,         /* مجوز از چه روزی گرفته شده */
      lastCheck: 0,         /* آخرین روزی که بازرسی شد */
      regDay: {},           /* هر مشتری همیشگی آخرین بار کدام روز آمد */
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
      shopName: '',    /* اسمی که بازیکن گذاشته — خالی یعنی اسم پرده */
      codeSeed: 0,     /* بذر کد همسایه */
      codesUsed: [],   /* کدهایی که قبلاً وارد شده */
      miniDay: '',     /* روزی که سهمیه‌ی مینی‌گیم‌ها شمرده شده */
      miniCount: {},   /* شناسه‌ی مینی‌گیم → چند بار امروز */
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
    return Math.floor(tier().space * (1 + .10 * book('space'))) + (M.spaceBonus || 0) + ruleAdd('space');
  }

  /* ───────── زیرقطعه‌ها ─────────
     قرار اصلی: جمع سطح تکه‌ها همیشه برابر سطح ایستگاه است. تا وقتی
     این برقرار باشد، نه نرخ عوض می‌شود و نه فضا — یعنی بالانس بازی
     دست‌نخورده می‌ماند و همه‌ی این لایه فقط نمای رشد است. */
  function subDefs(id) { return D.SUBPARTS[id] || []; }

  /* چند تکه سرِ این سطح باز است — دست‌کم یکی، وگرنه سطح جایی ندارد */
  function subOpenAt(id, lvl) {
    var defs = subDefs(id), n = 0;
    for (var i = 0; i < defs.length; i++) if (defs[i].at <= lvl) n++;
    return Math.max(1, n);
  }
  function subSum(a) {
    var n = 0;
    for (var i = 0; i < a.length; i++) n += a[i];
    return n;
  }
  /* آرایه‌ی خام، بدون هم‌گام‌سازی — برای جلوگیری از بازگشت بی‌پایان */
  function subRaw(id) {
    if (!S.sub) S.sub = zeroSub();
    var defs = subDefs(id), a = S.sub[id];
    if (!Array.isArray(a) || a.length !== defs.length) {
      a = defs.map(function () { return 0; });
      S.sub[id] = a;
    }
    return a;
  }
  /* n سطح تازه را بین تکه‌های باز پخش کن.
     سطح‌به‌سطح جلو می‌رویم چون وسط یک خرید بزرگ ممکن است تکه‌ی
     تازه‌ای باز شود و باید همان لحظه سهم بگیرد. */
  function subPut(id, n) {
    var defs = subDefs(id);
    if (!defs.length || n <= 0) return;
    var a = subRaw(id), f = subFocusOf(id);
    for (var k = 0; k < n; k++) {
      var open = subOpenAt(id, subSum(a)), idx;
      if (f >= 0 && f < open) {
        idx = f;
      } else {
        /* بدون انتخابِ بازیکن، تکه‌ی عقب‌مانده جلو می‌افتد تا
           ایستگاه یک‌دست بالا برود نه لنگ */
        idx = 0;
        for (var i = 1; i < open; i++) if (a[i] < a[idx]) idx = i;
      }
      a[idx]++;
    }
  }
  /* از صفر دوباره پخش کن — مهاجرت ذخیره‌ی قدیمی و ترمیم ناهماهنگی */
  function subSpread(id) {
    var a = subRaw(id);
    for (var i = 0; i < a.length; i++) a[i] = 0;
    subPut(id, S.lvl[id] | 0);
  }
  /* اگر جمع با سطح ایستگاه نخواند، از نو پخش می‌شود */
  function subSync(id) {
    var a = subRaw(id);
    if (subSum(a) !== (S.lvl[id] | 0)) subSpread(id);
    return a;
  }
  function subSyncAll() { IDS.forEach(subSync); }
  function subLevels(id) { return subSync(id); }
  function subFocusOf(id) {
    if (!S.subFocus) S.subFocus = noFocus();
    var f = S.subFocus[id];
    return f == null ? -1 : f;
  }
  /* انتخاب تکه‌ی هدف. همان تکه را دوباره زدن یعنی برداشتن انتخاب. */
  function setSubFocus(id, i) {
    if (!S.subFocus) S.subFocus = noFocus();
    var defs = subDefs(id);
    if (i == null || i < 0 || i >= defs.length || defs[i].at > S.lvl[id]) { S.subFocus[id] = -1; return false; }
    S.subFocus[id] = (S.subFocus[id] === i) ? -1 : i;
    return true;
  }
  /* تکه‌ی بعدی که هنوز باز نشده — برای نشان دادن هدف بعدی */
  function subNext(id) {
    var defs = subDefs(id), lvl = S.lvl[id] | 0;
    for (var i = 0; i < defs.length; i++) if (defs[i].at > lvl) return defs[i];
    return null;
  }
  /* سطح خریده‌شده را هم به ایستگاه می‌دهد هم به تکه‌ها — تنها راه
     درست بالا بردن سطح، تا جمع هیچ‌وقت از سطح جدا نیفتد */
  function addLevels(id, n) {
    n = Math.max(0, n | 0);
    if (!n) return 0;
    subSync(id);
    S.lvl[id] += n;
    subPut(id, n);
    return n;
  }

  /* ───────── منو ─────────
     منوی خالی دقیقاً خنثی است (ضریب ۱). یعنی بازیکنی که این تب را
     باز نکند، همان بازی قبلی را دارد؛ کسی که باز کند، ساعت و هوا
     برایش معنی پیدا می‌کند. */
  function menuSlots() { return 2 + Math.floor(S.tier / 3); }
  function menuOpen(d) { return S.tier >= d.tier; }
  function menuList() { return S.menu || (S.menu = []); }
  function menuHas(id) { return menuList().indexOf(id) >= 0; }
  function menuDish(id) {
    for (var i = 0; i < D.MENU.length; i++) if (D.MENU[i].id === id) return D.MENU[i];
    return null;
  }
  function menuToggle(id) {
    var d = menuDish(id);
    if (!d || !menuOpen(d)) return false;
    var list = menuList(), at = list.indexOf(id);
    if (at >= 0) { list.splice(at, 1); return true; }
    if (list.length >= menuSlots()) return false;
    list.push(id);
    return true;
  }
  /* این غذا همین حالا چقدر می‌ارزد: ساعتش خواند؟ هوایش خواند؟ */
  function dishScore(d) {
    var T = D.MENU_TUNE;
    var mood = A.clock ? A.clock.bandAt(S.hour).mood : null;
    var w = weather();
    var hitB = d.bands.indexOf(mood) >= 0;
    var hitW = !!w && d.wx.indexOf(w.id) >= 0;
    if (!hitB && !hitW) return T.miss;
    return (hitB ? T.band : 0) + (hitW ? T.weather : 0);
  }
  function menuMult() {
    var list = menuList();
    if (!list.length) return 1;
    var T = D.MENU_TUNE, sum = 0;
    for (var i = 0; i < list.length; i++) {
      var d = menuDish(list[i]);
      if (d && menuOpen(d)) sum += dishScore(d);
    }
    return clamp(1 + sum, T.lo, T.hi);
  }

  /* ───────── قیمت ─────────
     گرانی مشتری را می‌پراند، مگر اینکه آبرو داشته باشی. */
  function priceStep() { return clamp(S.price | 0, 0, D.PRICE_STEPS.length - 1); }
  function priceInfo() { return D.PRICE_STEPS[priceStep()]; }
  function setPrice(i) {
    if (i == null || i < 0 || i >= D.PRICE_STEPS.length) return false;
    S.price = i | 0;
    return true;
  }
  /* چند درصد از مشتری‌ها با این قیمت می‌مانند */
  function priceFlow() {
    var T = D.PRICE_TUNE;
    var sens = T.k * (1 - T.integShield * (S.integ / 100));
    return Math.max(T.floor, 1 - (priceInfo().mul - 1) * sens);
  }
  /* اثر نهایی قیمت روی فروش: قیمت × مشتری */
  function priceMult() { return priceInfo().mul * priceFlow(); }

  /* ───────── رقیب ─────────
     نواری که پر می‌شود. تا پرده‌ی سوم اصلاً به چشم نمی‌آید. */
  function rivalPower() {
    var R = D.RIVAL;
    if (S.tier < R.fromTier) return 0;
    var head = ruleAdd('rival');
    return clamp(head + (S.day * R.perDay + (S.tier - R.fromTier) * R.perTier) / R.full, 0, 1);
  }
  function rivalMult() {
    var R = D.RIVAL;
    if (perkOn('raqib')) return 1;          /* رابطه‌ات با او کار را حل کرده */
    var bite = R.bite * rivalPower();
    if (priceStep() < 2) bite *= R.cheapRelief;   /* از او ارزان‌تری */
    return 1 - bite;
  }

  /* ضریب فروش: منو × قیمت × رقیب. جدا از نرخ خام مانده تا دستمزد
     که از rawRate می‌آید، از این‌ها اثر نگیرد. */
  function sellMult() { return menuMult() * priceMult() * rivalMult() * ruleMul('sell'); }

  /* ───────── مجوز و بازرسی ───────── */
  function licenceCost() { return Math.floor(tier().cost * D.LICENCE.costShare * discount()) || 500; }
  function licenceLeft() { return Math.max(0, (S.licDay + D.LICENCE.days) - S.day); }
  function licenceOk() { return licenceLeft() > 0; }
  function buyLicence() {
    var c = licenceCost();
    if (S.money < c) return 0;
    S.money -= c;
    S.licDay = S.day;
    return c;
  }
  /* آیا امروز باید بازرسی بیاید */
  function checkDue() {
    var L = D.LICENCE;
    if (S.day <= 0 || S.day === S.lastCheck) return false;
    return S.day % L.every === 0;
  }
  /* نتیجه‌ی بازرسی — پول را همین‌جا کم می‌کند تا هیچ راهی برای
     فراموش کردنش نماند */
  function runCheck() {
    var L = D.LICENCE;
    S.lastCheck = S.day;
    if (licenceOk()) {
      shiftPeople({ bazres: 2 });
      return { ok: true, fine: 0 };
    }
    var fine = Math.floor(rate() * L.fine * (S.integ < L.dirtyInteg ? 2 : 1) * ruleMul('fine'));
    fine = Math.min(fine, Math.floor(S.money));
    S.money -= fine;
    shiftPeople({ bazres: -5 });
    return { ok: false, fine: fine, dirty: S.integ < L.dirtyInteg };
  }

  /* ───────── مشتری‌های همیشگی ─────────
     فقط اگر غذاشان روی منو باشد می‌آیند. یعنی این هم به همان
     یک تصمیم وصل است، نه جایزه‌ی مفت. */
  function regularDue() {
    if (isClosed()) return null;
    var h = S.hour;
    for (var i = 0; i < D.REGULARS.length; i++) {
      var r = D.REGULARS[i];
      if (!menuHas(r.dish)) continue;
      if ((S.regDay || (S.regDay = {}))[r.id] === S.day) continue;
      /* پنجره‌ی یک‌ساعته‌ی خودش */
      if (h >= r.hour && h < r.hour + 1) return r;
    }
    return null;
  }
  function takeRegular(r) {
    if (!r) return 0;
    if (!S.regDay) S.regDay = {};
    S.regDay[r.id] = S.day;
    var tip = Math.floor(rate() * r.tip);
    S.money += tip; S.total += tip;
    if (r.p) shiftPeople(r.p);
    return tip;
  }

  /* ───────── تکمیل شهر ─────────
     شهر وقتی تمام است که هم آخرین پرده رسیده باشد، هم هیچ ایستگاهی
     خاموش نمانده باشد. یعنی «همه‌ی مغازه‌ها باز شد و همه‌ی مراحل
     تمام شد» — تازه آن‌وقت شهر بعدی معنی دارد. */
  function cityComplete() {
    if (!isLast()) return false;
    for (var i = 0; i < IDS.length; i++) if (!S.lvl[IDS[i]]) return false;
    return true;
  }
  function cityProgress() {
    var on = 0;
    for (var i = 0; i < IDS.length; i++) if (S.lvl[IDS[i]]) on++;
    return { acts: S.tier + 1, actsMax: D.TIERS.length, shops: on, shopsMax: IDS.length };
  }

  /* ───────── قید شهر ─────────
     هر شهر همان دوازده پرده است با یک ضریب متفاوت. شهر اول خنثی
     است، پس دور اول هیچ‌کس با قید روبه‌رو نمی‌شود. */
  function city() { return A.world ? A.world.cityFor(M.runs || 0) : null; }
  function cityRule() {
    var c = city();
    return (c && c.rule) || {};
  }
  function ruleMul(key) {
    var v = cityRule()[key];
    return typeof v === 'number' ? v : 1;
  }
  function ruleAdd(key) {
    var v = cityRule()[key];
    return typeof v === 'number' ? v : 0;
  }

  /* ───────── اسم مغازه ─────────
     اسم مالِ خودِ بازیکن است و بین دورها می‌ماند، چون چیزی است که
     می‌خواهد نشان بدهد. خالی یعنی همان اسم پرده. */
  var NAME_MAX = 18;
  function shopName() {
    var n = (M.shopName || '').trim();
    return n || tier().name;
  }
  function hasShopName() { return !!(M.shopName || '').trim(); }
  function setShopName(s) {
    s = String(s == null ? '' : s).replace(/[<>&"']/g, '').trim().slice(0, NAME_MAX);
    M.shopName = s;
    return s;
  }

  /* ───────── کد همسایه ─────────
     بدون سرور، پس کد باید خودش خودش را تأیید کند: چهار حرف از روی
     بذر، به‌علاوه یک رقم درستی‌سنج. کدِ خودت روی خودت کار نمی‌کند و
     هر کد فقط یک‌بار.

     این عمداً «دعوت» نیست: هیچ‌چیز از دفترچه‌ی مخاطبان خوانده
     نمی‌شود و هیچ پیامی خودکار نمی‌رود. بازیکن کد را خودش می‌فرستد. */
  var CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function codeFrom(seed) {
    var rng = U.seeded(seed | 0), s = '';
    for (var i = 0; i < 5; i++) s += CODE_ABC[Math.floor(rng() * CODE_ABC.length)];
    var sum = 0;
    for (var j = 0; j < s.length; j++) sum += s.charCodeAt(j) * (j + 3);
    return s + CODE_ABC[sum % CODE_ABC.length];
  }
  function codeValid(c) {
    c = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length !== 6) return false;
    var body = c.slice(0, 5), sum = 0;
    for (var j = 0; j < body.length; j++) sum += body.charCodeAt(j) * (j + 3);
    return CODE_ABC[sum % CODE_ABC.length] === c[5];
  }
  /* کد خودِ بازیکن — از یک بذر ثابت که یک‌بار ساخته می‌شود */
  function myCode() {
    if (!M.codeSeed) M.codeSeed = Math.floor(Math.random() * 1e9) + 1;
    return codeFrom(M.codeSeed);
  }
  function codesUsed() { return M.codesUsed || (M.codesUsed = []); }
  function redeemCode(raw) {
    var c = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!codeValid(c)) return { ok: false, why: 'bad' };
    if (c === myCode()) return { ok: false, why: 'self' };
    if (codesUsed().indexOf(c) >= 0) return { ok: false, why: 'used' };
    if (codesUsed().length >= 10) return { ok: false, why: 'max' };
    codesUsed().push(c);
    addGems(15);
    return { ok: true, gems: 15 };
  }

  /* ───────── مینی‌گیم‌ها ─────────
     سهمیه روی روز واقعی است نه روز بازی، چون روز بازی فقط با بستن
     شیفت جلو می‌رود و بازیکنی که هیچ‌وقت نمی‌بندد سهمیه‌اش پر
     نمی‌شد. همان روال سهمیه‌ی تبلیغ. */
  function miniDef(id) {
    for (var i = 0; i < D.MINIS.length; i++) if (D.MINIS[i].id === id) return D.MINIS[i];
    return null;
  }
  function miniCounts() {
    if (M.miniDay !== today()) { M.miniDay = today(); M.miniCount = {}; }
    return M.miniCount || (M.miniCount = {});
  }
  function miniOpen(id) {
    var d = miniDef(id);
    return !!d && S.tier >= d.minTier;
  }
  function miniLeft(id) {
    var d = miniDef(id);
    if (!d) return 0;
    if (!miniOpen(id)) return 0;
    return Math.max(0, d.perDay - (miniCounts()[id] || 0));
  }
  function miniUse(id) {
    if (miniLeft(id) <= 0) return false;
    var c = miniCounts();
    c[id] = (c[id] || 0) + 1;
    return true;
  }
  /* نمره‌ی صفر تا یک → پول. کف دارد تا بازی بد هم دست خالی نماند. */
  function miniPay(id, score) {
    var d = miniDef(id), P = D.MINI_PAY;
    if (!d) return 0;
    var s = clamp(Number(score) || 0, 0, 1);
    var secs = (P[id] || 60) * (P.floor + (1 - P.floor) * s);
    return Math.max(P.minMoney, Math.floor(rate() * secs));
  }
  /* جایزه را همین‌جا می‌دهد تا هیچ مسیری برای دوبار گرفتن نماند */
  function miniReward(id, score) {
    var d = miniDef(id);
    if (!d) return null;
    var cash = miniPay(id, score);
    S.money += cash; S.total += cash;
    var gems = 0;
    if (d.gem && score >= .6) { addGems(d.gem); gems = d.gem; }
    return { cash: cash, gems: gems };
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
    return Math.floor(sum * ST().globalEffect(staffGlobal(), 'wage') * ruleMul('wage'));
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
  function rate() { return rawRate() * boostMult() * demandMult() * sellMult(); }

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
     اختلاف با جمع دقیق کمتر از n ایر است — در برابر میلیاردها هیچ. */
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
  function tierCost() { return Math.floor(tier().cost * discount() * ruleMul('tierCost')); }
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
    /* تقویتی که با فیروزه خریده شده نباید با واگذاری بسوزد */
    var keepBoost = S.boostUntil || 0;
    M.abroo += g;
    M.abrooTotal += g;
    M.runs++;
    M.bestTotal = Math.max(M.bestTotal || 0, S.total);
    S = newRun(M);
    S.boostUntil = keepBoost;
    return g;
  }

  /* ───────── فیروزه و سهمیه‌ی روزانه ───────── */
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

    /* ───── زیرقطعه‌ها ─────
       ذخیره‌ی قبل از v2.9.0 اصلاً `sub` ندارد. هرچه بیاید پاک‌سازی
       می‌شود و اگر جمعش با سطح ایستگاه نخواند، `subSyncAll` بعد از
       نشستن وضعیت از نو پخشش می‌کند. پس ذخیره‌ی قدیمی هم بدون
       هیچ سطح گم‌شده‌ای بالا می‌آید. */
    base.sub = {}; base.subFocus = {};
    IDS.forEach(function (id) {
      var defs = D.SUBPARTS[id] || [];
      var got = raw.sub && raw.sub[id];
      base.sub[id] = defs.map(function (d, i) {
        return Math.max(0, Math.floor(num(Array.isArray(got) ? got[i] : 0, 0)));
      });
      var f = Math.floor(num(raw.subFocus && raw.subFocus[id], -1));
      base.subFocus[id] = (f >= 0 && f < defs.length && defs[f].at <= base.lvl[id]) ? f : -1;
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
    /* ───── منو، قیمت، مجوز ───── */
    base.menu = [];
    if (Array.isArray(raw.menu)) {
      raw.menu.slice(0, 24).forEach(function (id) {
        var d = D.MENU.filter(function (x) { return x.id === id; })[0];
        if (d && d.tier <= base.tier && base.menu.indexOf(id) < 0) base.menu.push(id);
      });
    }
    /* اگر پرده پایین آمده یا جدول عوض شده، منو نباید از ظرفیت بزند */
    var slots = 2 + Math.floor(base.tier / 3);
    if (base.menu.length > slots) base.menu = base.menu.slice(0, slots);
    base.price = clamp(Math.floor(num(raw.price, 2)), 0, D.PRICE_STEPS.length - 1);
    base.licDay = Math.floor(num(raw.licDay, -999));
    base.lastCheck = Math.max(0, Math.floor(num(raw.lastCheck, 0)));
    base.regDay = {};
    D.REGULARS.forEach(function (r) {
      var v = Math.floor(num(raw.regDay && raw.regDay[r.id], -1));
      if (v >= 0) base.regDay[r.id] = v;
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
    if (typeof raw.miniDay === 'string') m.miniDay = raw.miniDay.slice(0, 12);
    if (typeof raw.shopName === 'string') m.shopName = raw.shopName.replace(/[<>&"']/g, '').trim().slice(0, 18);
    m.codeSeed = Math.max(0, Math.floor(num(raw.codeSeed, 0)));
    if (Array.isArray(raw.codesUsed)) {
      m.codesUsed = raw.codesUsed
        .filter(function (c) { return typeof c === 'string' && /^[A-Z0-9]{6}$/.test(c); })
        .slice(0, 10);
    }
    /* فقط شناسه‌های شناخته‌شده، و هر عدد در بازه‌ی سهمیه‌ی خودش */
    if (raw.miniCount && typeof raw.miniCount === 'object') {
      D.MINIS.forEach(function (g) {
        var n = Math.floor(num(raw.miniCount[g.id], 0));
        if (n > 0) m.miniCount[g.id] = clamp(n, 0, g.perDay);
      });
    }
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
    subSyncAll();
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
    subDefs: subDefs, subLevels: subLevels, subSync: subSync, subSyncAll: subSyncAll,
    subOpenAt: subOpenAt, subFocusOf: subFocusOf, setSubFocus: setSubFocus,
    subNext: subNext, addLevels: addLevels,
    crewFree: crewFree, crewUsed: crewUsed, crewNeed: crewNeed,
    crewPower: crewPower, understaffed: understaffed, autoAssign: autoAssign,
    staffAll: staffAll, staffAt: staffAt, staffIdle: staffIdle,
    staffGlobal: staffGlobal, staffFloor: staffFloor, hiredCount: hiredCount,
    addStaff: addStaff, assignStaff: assignStaff, syncCrewCounts: syncCrewCounts,
    hireCost: hireCost, wage: wage, wageBase: wageBase,
    abrooMult: abrooMult, integMult: integMult,
    stationRate: stationRate, rate: rate, rawRate: rawRate, tapValue: tapValue,
    menuSlots: menuSlots, menuOpen: menuOpen, menuList: menuList, menuHas: menuHas,
    menuDish: menuDish, menuToggle: menuToggle, menuMult: menuMult, dishScore: dishScore,
    priceStep: priceStep, priceInfo: priceInfo, setPrice: setPrice,
    priceFlow: priceFlow, priceMult: priceMult, sellMult: sellMult,
    rivalPower: rivalPower, rivalMult: rivalMult,
    licenceCost: licenceCost, licenceLeft: licenceLeft, licenceOk: licenceOk,
    buyLicence: buyLicence, checkDue: checkDue, runCheck: runCheck,
    regularDue: regularDue, takeRegular: takeRegular,
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
    cityComplete: cityComplete, cityProgress: cityProgress,
    cityRule: cityRule, shopName: shopName, hasShopName: hasShopName, setShopName: setShopName,
    myCode: myCode, codeValid: codeValid, redeemCode: redeemCode, codesUsed: codesUsed,
    miniDef: miniDef, miniOpen: miniOpen, miniLeft: miniLeft, miniUse: miniUse,
    miniPay: miniPay, miniReward: miniReward,
    checkBadges: checkBadges, hasBadge: hasBadge,
    save: save, load: load, wipe: wipe, hadOldSave: hadOldSave, dropOldSaves: dropOldSaves
  };
})(window.ABRO);
