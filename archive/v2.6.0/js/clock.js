/* ═══════════════════════════════════════════════
   آبرو — ساعت بازی و منحنی تقاضا

   دو سرعت زمان:
     داخل بازی  → ۱ دقیقه‌ی واقعی = ۱ ساعت بازی  (روز = ۲۴ دقیقه)
     بیرون بازی → ۱ ساعت واقعی   = ۱ ساعت بازی

   دلیلش: وقتی بازیکن نشسته، باید حس کند شب دارد می‌گذرد.
   وقتی نیست، باید وقتی برگردد زمان واقعی گذشته باشد.
   ═══════════════════════════════════════════════ */
(function (A) {
  'use strict';

  var U = A.util, D = A.data;
  var C = D.CLOCK;

  /* ───────── تقویم شمسی ─────────
     تبدیل میلادی به شمسی. الگوریتم استاندارد، بدون کتابخانه. */
  var MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  var WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

  function toJalali(gy, gm, gd) {
    var g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    var jy = (gy <= 1600) ? 0 : 979;
    gy -= (gy <= 1600) ? 621 : 1600;
    var gy2 = (gm > 2) ? (gy + 1) : gy;
    var days = (365 * gy) + (Math.floor((gy2 + 3) / 4)) - (Math.floor((gy2 + 99) / 100)) +
      (Math.floor((gy2 + 399) / 400)) - 80 + gd + g_d_m[gm - 1];
    jy += 33 * (Math.floor(days / 12053));
    days %= 12053;
    jy += 4 * (Math.floor(days / 1461));
    days %= 1461;
    if (days > 365) {
      jy += Math.floor((days - 1) / 365);
      days = (days - 1) % 365;
    }
    var jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    var jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    return { y: jy, m: jm, d: jd };
  }

  /* تاریخ شمسی امروزِ واقعی */
  function todayJalali() {
    var n = new Date();
    var j = toJalali(n.getFullYear(), n.getMonth() + 1, n.getDate());
    j.wd = WEEKDAYS[n.getDay()];
    j.mName = MONTHS[j.m - 1];
    return j;
  }
  function dateLabel() {
    var j = todayJalali();
    return U.fa(j.d) + ' ' + j.mName;
  }

  /* ───────── ساعت بازی ─────────
     hours: عددی بین ۰ تا ۲۴ (اعشاری) */
  function norm(h) {
    h = h % 24;
    return h < 0 ? h + 24 : h;
  }

  /* سرعت گذر زمان در ساعتِ فعلی — سحر تندتر می‌گذرد */
  function speedAt(h) {
    h = norm(h);
    return (h >= C.dawnStart && h < C.dawnEnd) ? C.dawnSpeed : 1;
  }

  /* پیش بردن ساعت با گذشت dt ثانیه‌ی واقعی، وقتی بازیکن داخل بازی است.
     چون سرعت در بازه‌ها فرق دارد، گام‌به‌گام جلو می‌رویم. */
  function advance(h, dtSeconds) {
    var left = dtSeconds / 60 / C.minutesPerGameHour;  /* ساعتِ بازی، با سرعت ۱ */
    var guard = 0;
    while (left > 1e-6 && guard++ < 200) {
      var sp = speedAt(h);
      var cur = norm(h);
      /* تا مرز بعدی چقدر مانده؟ */
      var edge = (cur < C.dawnStart) ? C.dawnStart
        : (cur < C.dawnEnd) ? C.dawnEnd : 24;
      var room = edge - cur;
      var step = Math.min(left * sp, room);
      h = norm(h + step);
      left -= step / sp;
    }
    return h;
  }

  /* گذر زمان در نبودِ بازیکن: ساعتِ واقعی = ساعتِ بازی، بدون شتاب */
  function advanceAway(h, seconds) {
    return norm(h + seconds / 3600);
  }

  /* ───────── منحنی تقاضا ───────── */
  var SORTED = D.DEMAND.slice().sort(function (a, b) { return a.from - b.from; });

  function bandAt(h) {
    h = norm(h);
    var best = SORTED[SORTED.length - 1];
    for (var i = 0; i < SORTED.length; i++) {
      if (SORTED[i].from <= h) best = SORTED[i];
    }
    return best;
  }
  function demandAt(h) { return bandAt(h).mul; }
  function moodAt(h) { return bandAt(h).name; }

  /* میانگین تقاضا در بازه‌ی [h, h+hours) — برای حساب شب بسته و غیبت */
  function demandOver(h, hours) {
    if (hours <= 0) return demandAt(h);
    var step = .25, total = 0, n = 0;
    for (var t = 0; t < hours; t += step) {
      total += demandAt(h + t);
      n++;
    }
    return n ? total / n : demandAt(h);
  }

  /* تفکیک ساعت‌ها به بازه‌ها — برای نشان دادن در فاکتور */
  function breakdown(h, hours) {
    var out = {}, step = .25;
    for (var t = 0; t < hours; t += step) {
      var b = bandAt(h + t);
      out[b.name] = (out[b.name] || 0) + step;
    }
    return Object.keys(out).map(function (k) {
      return { name: k, hours: out[k] };
    }).sort(function (a, b) { return b.hours - a.hours; });
  }

  /* ───────── نمایش ───────── */
  function label(h) {
    h = norm(h);
    var hh = Math.floor(h);
    var mm = Math.floor((h - hh) * 60);
    return U.fa((hh < 10 ? '0' : '') + hh) + ':' + U.fa((mm < 10 ? '0' : '') + mm);
  }

  /* چقدر از شبانه‌روز گذشته — برای رنگ آسمان (۰ نیمه‌شب، ۰٫۵ ظهر) */
  function dayFraction(h) { return norm(h) / 24; }

  /* روشناییِ روز در این ساعت: ۰ شب کامل، ۱ ظهر */
  function daylight(h) {
    h = norm(h);
    /* طلوع ۵:۳۰، غروب ۱۸:۳۰ */
    if (h <= 4.5 || h >= 19.5) return 0;
    if (h >= 7 && h <= 17) return 1;
    if (h < 7) return (h - 4.5) / 2.5;
    return (19.5 - h) / 2.5;
  }

  A.clock = {
    advance: advance, advanceAway: advanceAway, norm: norm, speedAt: speedAt,
    demandAt: demandAt, demandOver: demandOver, moodAt: moodAt,
    bandAt: bandAt, breakdown: breakdown,
    label: label, dayFraction: dayFraction, daylight: daylight,
    dateLabel: dateLabel, todayJalali: todayJalali, toJalali: toJalali,
    MONTHS: MONTHS, WEEKDAYS: WEEKDAYS
  };
})(window.ABRO);
