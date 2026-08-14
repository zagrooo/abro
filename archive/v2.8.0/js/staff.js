/* ═══════════════════════════════════════════════
   آبرو — کارمندها

   هر کارمند یک نقش دارد و یک درجه.
     نقش‌های ایستگاهی → روی یک ایستگاه می‌ایستند
     نقش‌های کلی      → جایی نمی‌ایستند، اثرشان روی کل کار است

   «توان» هر نفر = درجه × تناسب نقش با ایستگاه.
   یک استادِ آشپز پشت اجاق ۳٫۷۵ برابر یک شاگرد می‌ارزد.
   ═══════════════════════════════════════════════ */
(function (A) {
  'use strict';

  var U = A.util, D = A.data;
  var clamp = U.clamp;

  var MATCH = 1.5;    /* نقش با ایستگاه می‌خواند */
  var MISS = .7;      /* نقشِ ایستگاهی، ولی ایستگاه اشتباه */

  function role(id) {
    for (var i = 0; i < D.ROLES.length; i++) if (D.ROLES[i].id === id) return D.ROLES[i];
    return D.ROLES[0];
  }
  function grade(g) { return D.GRADES[clamp(g | 0, 0, D.GRADES.length - 1)]; }
  function isGlobal(r) { return !!(r && r.global); }

  /* نقش‌هایی که در این پرده باز شده‌اند */
  function unlocked(tier) {
    return D.ROLES.filter(function (r) { return r.tier <= tier; });
  }

  /* توان یک نفر روی یک ایستگاه مشخص */
  function power(member, stationId) {
    var r = role(member.r), g = grade(member.g);
    if (isGlobal(r)) return 0;
    var fit = 1;
    if (r.st) fit = (r.st === stationId) ? MATCH : MISS;
    return g.power * fit;
  }

  /* هزینه‌ی دستمزد یک نفر، نسبت به دستمزد پایه */
  function wageFactor(member) { return grade(member.g).wage; }

  /* ───────── انتخاب داوطلب ─────────
     درجه با شانس، نقش از بین نقش‌های باز شده. */
  function rollGrade() {
    var total = 0, i;
    for (i = 0; i < D.GRADES.length; i++) total += D.GRADES[i].odds;
    var x = Math.random() * total;
    for (i = 0; i < D.GRADES.length; i++) {
      x -= D.GRADES[i].odds;
      if (x <= 0) return i;
    }
    return 0;
  }
  /* نقش‌های تازه‌تر کمیاب‌ترند تا استخدام همیشه هیجان داشته باشد */
  function rollRole(tier) {
    var pool = unlocked(tier);
    var weights = pool.map(function (r, i) { return Math.pow(.82, pool.length - 1 - i); });
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var x = Math.random() * total;
    for (var i = 0; i < pool.length; i++) {
      x -= weights[i];
      if (x <= 0) return pool[i].id;
    }
    return pool[0].id;
  }
  function candidate(tier, forceGrade) {
    return {
      r: rollRole(tier),
      g: forceGrade == null ? rollGrade() : clamp(forceGrade, 0, 2),
      at: ''
    };
  }

  /* ───────── اثر نقش‌های کلی ─────────
     چند نفر از یک نقش، اثرشان ضرب می‌شود ولی کف دارد. */
  function globalEffect(list, key) {
    var m = 1;
    for (var i = 0; i < list.length; i++) {
      var r = role(list[i].r);
      if (r.global !== key) continue;
      var v = r.v * grade(list[i].g).power;
      m *= (1 - v);
    }
    /* کف ۰٫۵۵: چند نفر از یک نقش نباید هزینه را نصفِ نصف کنند */
    return clamp(m, .55, 1);
  }
  /* برای اثرهای افزاینده (کارایی، درآمد) */
  function globalBonus(list, key) {
    var m = 1;
    for (var i = 0; i < list.length; i++) {
      var r = role(list[i].r);
      if (r.global !== key) continue;
      m *= (1 + r.v * grade(list[i].g).power);
    }
    /* سقف ۱٫۳۵ — وگرنه انباشتن مربی و مدیر منطقه اقتصاد را می‌ترکاند */
    return clamp(m, 1, 1.35);
  }

  /* ───────── خلاصه برای نمایش ───────── */
  function label(member) {
    var r = role(member.r), g = grade(member.g);
    return g.name + ' ' + r.name;
  }
  function counts(list) {
    var out = {};
    for (var i = 0; i < list.length; i++) {
      var k = list[i].r;
      out[k] = (out[k] || 0) + 1;
    }
    return out;
  }

  A.staff = {
    role: role, grade: grade, isGlobal: isGlobal, unlocked: unlocked,
    power: power, wageFactor: wageFactor,
    candidate: candidate, rollGrade: rollGrade, rollRole: rollRole,
    globalEffect: globalEffect, globalBonus: globalBonus,
    label: label, counts: counts,
    MATCH: MATCH, MISS: MISS
  };
})(window.ABRO);
