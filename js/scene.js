/* ═══════════════════════════════════════════════
   آبرو — هنرِ آدم‌ها، و درِ ورودیِ موتور تصویر

   از v4.0.0 دنیای بازی ایزومتریک است و در js/iso.js کشیده می‌شود.
   این فایل دو کار دارد:

     ۱. چهره و بدن آدم‌ها — چون رابط کاربری هم به آن نیاز دارد
        (آواتار شخصیت‌ها، تصویر کارت رویداد)
     ۲. همان API قبلیِ A.scene را نگه می‌دارد و به iso واگذار می‌کند،
        تا game.js و ui.js دست‌نخورده بمانند

   نمای قدیمِ از پهلو این‌جا بود و رفت. اگر روزی خواستی برش گردانی،
   در archive/v3.0.0/js/scene.js دست‌نخورده هست.
   ═══════════════════════════════════════════════ */
(function (A) {
  'use strict';

  var U = A.util, D = A.data;
  var clamp = U.clamp, rnd = U.rnd, rr = U.roundRect, off = U.offscreen;
  var FONT = 'Vazirmatn, sans-serif';
  var glowSprite = null;
  var ISO = function () { return A.iso; };

  function buildGlow() {
    var n = 256;
    glowSprite = off(n, n);
    var g = glowSprite.getContext('2d');
    var rg = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    rg.addColorStop(0, 'rgba(255,201,118,.97)');
    rg.addColorStop(.20, 'rgba(255,182,94,.46)');
    rg.addColorStop(.52, 'rgba(255,164,74,.14)');
    rg.addColorStop(1, 'rgba(255,150,60,0)');
    g.fillStyle = rg; g.fillRect(0, 0, n, n);
  }

  /* ═════════ آدم‌ها ═════════ */
  var SKINS = ['#c69a74', '#b9865f', '#d8ae87', '#a3714f', '#e0bb96', '#8f6242'];
  var CLOTHS = ['#31405d', '#3d3450', '#274a44', '#4a3a2e', '#2c3550', '#503038', '#2a3f57', '#45364f'];
  var PANTS = ['#1b2231', '#241d29', '#1d2a24', '#2a2230'];
  var HAIRS = ['#141821', '#241a14', '#0f1218', '#3a2a1e'];

  function randomLook() {
    return {
      skin: U.pick(SKINS), cloth: U.pick(CLOTHS), pants: U.pick(PANTS), hair: U.pick(HAIRS),
      scarf: Math.random() < .22 ? U.pick(['#8a3f3f', '#3f5f8a', '#7a6a3a', '#6a3f6a']) : null,
      hat: Math.random() < .15 ? U.pick(['#2a3242', '#3a2f22']) : null,
      bag: Math.random() < .3
    };
  }

  /* یک آدم: سایه، بدن، و لبه‌ی نورِ گرم از سمت مغازه */
  function person(g, x, y, sc, o) {
    o = o || {};
    var t = o.t || 0, w = o.walk || 0;

    if (o.shadow !== false && sc > .5) {
      g.save();
      g.globalAlpha = .3 * clamp(sc, 0, 1.4);
      g.fillStyle = '#000';
      g.beginPath(); g.ellipse(x, y + 1.5, 9 * sc, 2.8 * sc, 0, 0, 6.3); g.fill();
      g.restore();
    }

    g.save();
    g.translate(x, y);
    g.scale(sc * (o.flip ? -1 : 1), sc);
    if (o.a != null) g.globalAlpha = o.a;

    var s1 = Math.sin(t) * w, s2 = Math.sin(t + Math.PI) * w;
    var body = o.cloth || '#31405d', pants = o.pants || '#1b2231';
    var skin = o.skin || '#c69a74', hair = o.hair || '#141821';
    var bob = w ? Math.abs(Math.sin(t)) * 1.4 : 0;
    g.translate(0, -bob);
    g.lineCap = 'round';

    g.strokeStyle = pants; g.lineWidth = 4.4;
    g.beginPath(); g.moveTo(0, -16); g.lineTo(s1 * 6.6, 0); g.stroke();
    g.beginPath(); g.moveTo(0, -16); g.lineTo(s2 * 6.6, 0); g.stroke();
    g.strokeStyle = '#0d1017'; g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(s1 * 6.6 - 1.6, .6); g.lineTo(s1 * 6.6 + 2.4, .6); g.stroke();
    g.beginPath(); g.moveTo(s2 * 6.6 - 1.6, .6); g.lineTo(s2 * 6.6 + 2.4, .6); g.stroke();

    g.fillStyle = body; rr(g, -5.9, -35, 11.8, 20.6, 4.3); g.fill();
    g.fillStyle = 'rgba(255,255,255,.06)'; rr(g, -5.9, -35, 4, 20.6, 4.3); g.fill();

    g.strokeStyle = body; g.lineWidth = 3.6;
    g.beginPath(); g.moveTo(-3.6, -32); g.lineTo(-3.6 + s2 * 5.6, -20 + (o.arm || 0)); g.stroke();
    g.beginPath(); g.moveTo(3.6, -32); g.lineTo(3.6 + s1 * 5.6, -20 + (o.arm2 || 0)); g.stroke();
    g.strokeStyle = skin; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-3.6 + s2 * 5.6, -21 + (o.arm || 0)); g.lineTo(-3.6 + s2 * 6.4, -18.5 + (o.arm || 0)); g.stroke();
    g.beginPath(); g.moveTo(3.6 + s1 * 5.6, -21 + (o.arm2 || 0)); g.lineTo(3.6 + s1 * 6.4, -18.5 + (o.arm2 || 0)); g.stroke();

    if (o.bag) {
      g.fillStyle = '#c9b489';
      rr(g, 4.2 + s1 * 5, -19 + (o.arm2 || 0), 6.5, 8, 1.4); g.fill();
    }

    g.fillStyle = skin; g.beginPath(); g.arc(0, -40.6, 5.6, 0, 6.3); g.fill();
    g.fillStyle = 'rgba(0,0,0,.13)'; g.beginPath(); g.arc(1.6, -40.6, 5.6, -1.1, 1.1); g.fill();
    g.fillStyle = hair; g.beginPath(); g.arc(0, -42.1, 5.7, Math.PI * 1.02, Math.PI * 2.02); g.fill();
    if (o.scarf) { g.fillStyle = o.scarf; g.beginPath(); g.arc(0, -41, 6.7, Math.PI * .88, Math.PI * 2.12); g.fill(); }
    if (o.hat) {
      g.fillStyle = o.hat;
      rr(g, -6.6, -48, 13.2, 3.8, 1.6); g.fill();
      rr(g, -4.5, -51.4, 9, 4.2, 1.6); g.fill();
    }

    /* لبه‌ی نور گرم */
    if (o.rim) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = o.rim;
      g.fillStyle = 'rgba(255,196,120,.85)';
      rr(g, -6.4, -35, 2.2, 20.6, 1.1); g.fill();
      g.beginPath(); g.arc(0, -40.6, 5.6, Math.PI * .68, Math.PI * 1.32); g.lineWidth = 1.4;
      g.strokeStyle = 'rgba(255,206,140,.9)'; g.stroke();
      g.restore();
    }
    g.restore();
  }


  /* موتور برای سوارِ موتور — تصویر کارت رویدادِ «پیک» به آن نیاز دارد */
  function drawBike(g, T) {
    g.fillStyle = '#11151d';
    g.beginPath(); g.arc(-22, 0, 11, 0, 6.3); g.fill();
    g.beginPath(); g.arc(24, 0, 11, 0, 6.3); g.fill();
    g.strokeStyle = '#3a4453'; g.lineWidth = 2;
    g.beginPath(); g.arc(-22, 0, 8, 0, 6.3); g.stroke();
    g.beginPath(); g.arc(24, 0, 8, 0, 6.3); g.stroke();
    g.fillStyle = '#8c2f28'; rr(g, -16, -16, 34, 12, 4); g.fill();
    g.fillStyle = '#20262f'; rr(g, -24, -22, 20, 8, 3); g.fill();
    g.fillStyle = '#c8873c'; rr(g, -34, -32, 22, 17, 3); g.fill();
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-34, -25, 22, 2);
    person(g, 6, -14, .82, { cloth: '#2c4a6b', pants: '#1b2231', skin: '#b9865f', hair: '#191c24', t: 0, walk: 0, arm: -10, arm2: -10, hat: '#c8873c', shadow: false });
  }

  /* ═════════ آواتار و تصویر رویداد ═════════ */
  function drawAvatar(canvas, look, standing) {
    var g = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    g.clearRect(0, 0, w, h);
    var warm = clamp((standing == null ? 50 : standing) / 100, 0, 1);
    var bg = g.createRadialGradient(w * .5, h * .3, 2, w * .5, h * .5, w * .8);
    bg.addColorStop(0, U.mix('#24304a', '#4a3a1e', warm));
    bg.addColorStop(1, '#0a0f17');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.save();
    g.translate(w / 2, h * 1.42);
    g.scale(w / 44, w / 44);
    person(g, 0, 0, 1.1, {
      skin: look.skin, cloth: look.cloth, pants: look.pants || '#1b2231',
      hair: look.hair, scarf: look.scarf, hat: look.hat, t: 0, walk: 0,
      shadow: false, rim: .45 + warm * .4
    });
    g.restore();
  }

  /* ═════════ تصویر کارت رویداد ═════════ */
  function drawEventArt(canvas, kind, T) {
    var g = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    g.clearRect(0, 0, w, h);
    var sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#080f1c'); sky.addColorStop(1, '#17202f');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);

    /* افق کوچک */
    var R = U.seeded(4242);
    g.fillStyle = '#0a1120';
    var bx = 0;
    while (bx < w) {
      var bw2 = 14 + R() * 34, bh2 = 16 + R() * 44;
      g.fillRect(bx, h - 10 - bh2, bw2, bh2);
      for (var wy2 = h - 10 - bh2 + 5; wy2 < h - 16; wy2 += 8) {
        for (var wx3 = bx + 3; wx3 < bx + bw2 - 4; wx3 += 7) {
          if (R() < .2) { g.fillStyle = 'rgba(255,200,130,.35)'; g.fillRect(wx3, wy2, 3, 3.5); g.fillStyle = '#0a1120'; }
        }
      }
      bx += bw2 + 2 + R() * 8;
    }

    var gy = h - 8;
    g.fillStyle = '#0b1017'; g.fillRect(0, gy, w, h - gy);
    g.save();
    var s = h / 78;
    g.translate(w / 2, gy + 4);
    g.scale(s, s);
    var pale = { skin: '#c69a74', cloth: '#31405d', pants: '#1b2231', hair: '#141821', shadow: false };

    function glowAt(x, y, r, a) {
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a;
      g.drawImage(glowSprite, x - r, y - r, r * 2, r * 2); g.restore();
    }
    switch (kind) {
      case 'inspector':
        glowAt(0, -30, 60, .28);
        person(g, -22, 0, 1, pale);
        person(g, 22, 0, 1, { skin: '#c69a74', cloth: '#3a4250', pants: '#232a36', hair: '#22262f', hat: '#2a3242', arm: -8, shadow: false });
        g.fillStyle = '#e8e0cc'; rr(g, 12, -26, 10, 13, 1); g.fill();
        break;
      case 'oldlady':
        glowAt(0, -28, 56, .32);
        person(g, -20, 0, 1, pale);
        person(g, 20, 0, .92, { skin: '#d8ae87', cloth: '#5a3f52', pants: '#2a2230', hair: '#c9c3ba', scarf: '#7a4a5c', shadow: false });
        break;
      case 'crowd':
        for (var i = 0; i < 7; i++) {
          person(g, -60 + i * 20, 0, .8 + (i % 3) * .07, {
            skin: SKINS[i % SKINS.length], cloth: CLOTHS[i % CLOTHS.length],
            pants: '#1b2231', hair: '#141821', t: i, walk: .2, shadow: false
          });
        }
        glowAt(0, -26, 70, .2);
        break;
      case 'bike':
        glowAt(-30, -18, 50, .32);
        g.save(); g.translate(6, -2); g.scale(.86, .86); drawBike(g, 0); g.restore();
        break;
      case 'rival':
        person(g, -34, 0, 1, pale);
        person(g, 34, 0, 1, { skin: '#a3714f', cloth: '#4a2f2f', pants: '#241d29', hair: '#141821', flip: true, shadow: false });
        g.fillStyle = 'rgba(224,96,74,.8)';
        g.font = '700 14px ' + FONT; g.textAlign = 'center';
        g.fillText('٪۵۰', 34, -50);
        break;
      case 'suit':
        glowAt(20, -30, 54, .24);
        person(g, -22, 0, 1, pale);
        person(g, 24, 0, 1.04, { skin: '#c69a74', cloth: '#20242e', pants: '#14171e', hair: '#191c24', flip: true, shadow: false });
        break;
      case 'rain':
        g.strokeStyle = 'rgba(178,205,240,.4)'; g.lineWidth = 1;
        for (var r2 = 0; r2 < 46; r2++) {
          var rx = -110 + Math.random() * 220, ry = -84 + Math.random() * 84;
          g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx - 2, ry + 11); g.stroke();
        }
        person(g, 0, 0, 1, pale);
        break;
      case 'worker':
        person(g, -20, 0, 1, { skin: '#b9865f', cloth: '#e6dcc4', pants: '#24303f', hair: '#191c24', shadow: false });
        person(g, 22, 0, 1, pale);
        break;
      case 'book':
        glowAt(0, -34, 44, .38);
        person(g, 0, 0, 1.1, { skin: '#c08d63', cloth: '#efe5d0', pants: '#2b3244', hair: '#171c26', arm: -12, arm2: -12, shadow: false });
        g.fillStyle = '#d8c9a8'; rr(g, -9, -30, 18, 12, 1.5); g.fill();
        g.strokeStyle = '#a08c66'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -30); g.lineTo(0, -18); g.stroke();
        break;
      case 'phone':
        glowAt(24, -34, 34, .42);
        person(g, -18, 0, 1, pale);
        person(g, 24, 0, 1, { skin: '#d8ae87', cloth: '#274a44', pants: '#1d2a24', hair: '#241a14', arm: -14, flip: true, shadow: false });
        g.fillStyle = '#cfe6ff'; rr(g, 14, -36, 7, 12, 1.5); g.fill();
        break;
      default:
        person(g, 0, 0, 1.1, pale);
    }
    g.restore();
    var fade = g.createLinearGradient(0, 0, 0, h);
    fade.addColorStop(0, 'rgba(12,17,27,.5)');
    fade.addColorStop(.5, 'rgba(12,17,27,0)');
    fade.addColorStop(1, 'rgba(12,17,27,.78)');
    g.fillStyle = fade; g.fillRect(0, 0, w, h);
  }

  /* ═════════ راه‌اندازی ═════════ */
  var canvasEl = null;

  function init(canvas) {
    canvasEl = canvas;
    buildGlow();
    ISO().attach(canvas);
  }
  /* بارگذاری مرحله‌ای: هر گام یک تکه، تا صفحه‌ی بارگذاری نپرد */
  function initSteps(canvas) {
    canvasEl = canvas;
    /* کلید «fn» است نه «run» — loader.js با همین صدا می‌زند */
    return [
      { label: 'نور', fn: buildGlow },
      { label: 'زمین', fn: function () { ISO().attach(canvas); } },
      { label: 'مغازه', fn: function () { ISO().setTier(0); } }
    ];
  }

  A.scene = {
    init: init, initSteps: initSteps,
    /* هنرِ آدم — همان‌جا که بود */
    person: person, randomLook: randomLook,
    drawAvatar: drawAvatar, drawEventArt: drawEventArt,
    /* بقیه، همه به iso */
    resize: function (f) { ISO().resize(f); },
    update: function (dt, T, W) { ISO().update(dt, T, W); },
    render: function (T, W) { ISO().render(T, W); },
    reset: function () { ISO().reset(); },
    setTier: function (t) { ISO().setTier(t); },
    setCityTint: function (c) { ISO().setCityTint(c); },
    snapCamera: function () { ISO().snapCamera(); },
    punch: function (v) { ISO().punch(v); },
    shake: function (p) { ISO().shake(p); },
    /* باران دیگر ذره‌ی جدا ندارد؛ هوای صحنه از خود W می‌آید */
    rainFor: function () { },
    spawnCoin: function (v, big) { ISO().spawnCoin(v, big); },
    burst: function (x, y, n, c) { ISO().burst(x, y, n, c); },
    burstAt: function (id, c) { ISO().burstAt(id, c); },
    toWorld: function (x, y) { return ISO().toWorld(x, y); },
    hitGift: function (x, y) { return ISO().hitGift(x, y); },
    takeGift: function (o) { ISO().takeGift(o); },
    hasGift: function () { return ISO().hasGift(); },
    hitStation: function (x, y) { return ISO().hitStation(x, y); },
    setHotStations: function (ids) { ISO().setHotStations(ids); },
    hotIds: function () { return ISO().spotIds(); },
    panBy: function (dx, dy) { ISO().panBy(dx, dy); },
    zoomBy: function (f, x, y) { ISO().zoomBy(f, x, y); },
    zoomLevel: function () { return ISO().zoomLevel(); },
    toggleWide: function () { return ISO().toggleWide(); },
    isWide: function () { return ISO().isWide(); },
    stats: function () { return ISO().stats(); },
    setQuality: function (q) { ISO().setQuality(q); }
  };
})(window.ABRO);
