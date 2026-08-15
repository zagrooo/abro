/* ═══════════════════════════════════════════════
   آبرو — ابزارهای پایه
   ═══════════════════════════════════════════════ */
window.ABRO = window.ABRO || {};
window.ABRO.VERSION = '4.1.0';

(function (A) {
  'use strict';

  var FA = '۰۱۲۳۴۵۶۷۸۹';

  function fa(s) { return String(s).replace(/\d/g, function (d) { return FA[+d]; }); }
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.random() * arr.length | 0]; }
  function sep(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '٬'); }
  /* درجا بُر می‌خورد و همان آرایه را برمی‌گرداند */
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.random() * (i + 1) | 0;
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* واحدهای فارسی برای عددهای بزرگ */
  var UNITS = [
    [1e15, ' بیلیارد'], [1e12, ' تریلیون'], [1e9, ' میلیارد'], [1e6, ' میلیون']
  ];

  function money(n) {
    n = Math.max(0, Math.floor(n));
    if (n < 1e6) return fa(sep(n));
    for (var i = 0; i < UNITS.length; i++) {
      if (n >= UNITS[i][0]) {
        var v = n / UNITS[i][0];
        return fa(v < 100 ? v.toFixed(1) : Math.round(v)) + UNITS[i][1];
      }
    }
    return fa((n / 1e18).toFixed(1)) + ' کوینتیلیون';
  }

  /* نسخه‌ی کوتاه برای جاهای تنگ */
  function short(n) {
    n = Math.max(0, Math.floor(n));
    if (n < 1e4) return fa(sep(n));
    if (n < 1e6) return fa(Math.round(n / 1e3)) + 'هـ';
    if (n < 1e9) return fa((n / 1e6).toFixed(n < 1e7 ? 1 : 0)) + 'م';
    if (n < 1e12) return fa((n / 1e9).toFixed(1)) + 'مد';
    if (n < 1e15) return fa((n / 1e12).toFixed(1)) + 'تر';
    return fa((n / 1e15).toFixed(1)) + 'بد';
  }

  function pct(v) { return fa(Math.round(v)) + '٪'; }

  function timeAgo(sec) {
    sec = Math.max(0, Math.round(sec));
    if (sec < 60) return fa(sec) + ' ثانیه';
    if (sec < 3600) return fa(Math.round(sec / 60)) + ' دقیقه';
    return fa((sec / 3600).toFixed(1)) + ' ساعت';
  }

  var reduceMotion = (function () {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  })();

  function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { } }

  /* ── تُست ── */
  var toastTimer = null;
  function toast(text, kind) {
    var el = $('toast');
    if (!el) return;
    el.textContent = text;
    el.className = 'on' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = ''; }, 2900);
  }

  /* ── سکه‌ی پرنده به سمت شمارنده ── */
  function flyCoins(fromEl, count) {
    if (reduceMotion || !fromEl) return;
    var target = $('moneyPill');
    if (!target) return;
    var a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
    var n = count || 5;
    for (var i = 0; i < n; i++) {
      (function (i) {
        var s = document.createElement('div');
        s.className = 'flycoin';
        var sx = a.left + a.width / 2 - 8 + rnd(-15, 15);
        var sy = a.top + a.height / 2 - 8 + rnd(-11, 11);
        s.style.left = sx + 'px'; s.style.top = sy + 'px';
        document.body.appendChild(s);
        var dx = b.left + b.width / 2 - sx - 8, dy = b.top + b.height / 2 - sy - 8;
        var anim = s.animate([
          { transform: 'translate(0,0) scale(1)', opacity: 1 },
          { transform: 'translate(' + (dx * .35 + rnd(-34, 34)) + 'px,' + (dy * .32 - rnd(6, 30)) + 'px) scale(1.2)', offset: .5 },
          { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.32)', opacity: .2 }
        ], { duration: 500 + i * 55, easing: 'cubic-bezier(.4,0,.25,1)' });
        anim.onfinish = function () { s.remove(); };
      })(i);
    }
    setTimeout(function () {
      target.classList.remove('bump');
      void target.offsetWidth;
      target.classList.add('bump');
    }, 500);
  }

  /* ── بوم کمکی ── */
  function offscreen(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  /* مستطیل گرد */
  function roundRect(g, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
  }

  /* مولد تصادفی با بذر ثابت */
  function seeded(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ترکیب دو رنگ hex */
  function mix(c1, c2, t) {
    var a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
    var r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
    var g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
    var bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  A.util = {
    fa: fa, $: $, clamp: clamp, lerp: lerp, rnd: rnd, pick: pick, shuffle: shuffle,
    money: money, short: short, pct: pct, timeAgo: timeAgo,
    reduceMotion: reduceMotion, buzz: buzz, toast: toast, flyCoins: flyCoins,
    offscreen: offscreen, roundRect: roundRect, seeded: seeded, mix: mix
  };
})(window.ABRO);
