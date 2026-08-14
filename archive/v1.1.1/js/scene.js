/* ═══════════════════════════════════════════════
   آبرو — موتور تصویر
   بوم دوبعدی، همه‌چیز رویه‌ای، بدون فایل خارجی.

   خط لوله‌ی رندر:
     صحنه → بافر فریم → بلوم → درجه‌بندی رنگ → دانه و وینیت
   ═══════════════════════════════════════════════ */
(function (A) {
  'use strict';

  var U = A.util, D = A.data;
  var clamp = U.clamp, rnd = U.rnd, rr = U.roundRect, off = U.offscreen;

  /* مختصات مجازی صحنه */
  var VW = 960, GY = 430;
  var BX0 = -380, BY0 = -280, BW = 1720, BH = 1000;

  var cv = null, ctx = null;
  var DPR = 1, CW = 0, CH = 0, K = 1, OX = 0, OY = 0;
  var backdrop = null, glowSprite = null, grain = null, vign = null, gradeGrad = null;
  var frameBuf = null, fctx = null, blurBuf = null, bctx = null;
  var FONT = 'sans-serif';
  var RM = U.reduceMotion;

  /* کیفیت: ۲ کامل، ۱ بدون بلوم/بازتاب، ۰ حداقلی */
  var quality = RM ? 1 : 2, frameMs = 16, slowFrames = 0, fastFrames = 0;
  var supportsFilter = false;

  /* چرخه‌ی شب و سحر */
  var CYCLE = 420, cycleT = CYCLE * .12, NF = 1;

  /* ───────── دوربین ───────── */
  var cam = { w: 400, h: 300, y: 362 }, camT = { w: 400, h: 300, y: 362 };
  var drift = 0, punchV = 0;

  function setTier(t) {
    var c = D.TIERS[clamp(t | 0, 0, D.TIERS.length - 1)].cam;
    camT = { w: c.w, h: c.h, y: c.y };
  }
  function snapCamera() { cam = { w: camT.w, h: camT.h, y: camT.y }; }
  function punch(v) { punchV = Math.max(punchV, v == null ? 1 : v); }

  /* ═════════ ساخت اسپرایت‌ها ═════════ */
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
  function buildGrain() {
    var m = 168;
    grain = off(m, m);
    var g = grain.getContext('2d'), img = g.createImageData(m, m);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = Math.random() * 255 | 0;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 24;
    }
    g.putImageData(img, 0, 0);
  }

  function skylineBand(g, R, baseY, h1, h2, col, winCol, chance, step, blur) {
    if (blur && supportsFilter) g.filter = 'blur(' + blur + 'px)';
    var x = BX0 - 40;
    while (x < BX0 + BW + 40) {
      var w = step[0] + R() * step[1], h = h1 + R() * (h2 - h1), y = baseY - h;
      g.fillStyle = col; g.fillRect(x, y, w, h);
      if (R() < .3) g.fillRect(x + w * .5 - 1.3, y - 10 - R() * 18, 2.6, 18);
      if (R() < .2) g.fillRect(x + 4, y - 6, w - 8, 6);
      if (R() < .12) { g.fillStyle = 'rgba(224,80,60,.5)'; g.fillRect(x + w * .5 - 2, y - 22, 4, 4); g.fillStyle = col; }
      for (var wy = y + 9; wy < baseY - 10; wy += 12) {
        for (var wx = x + 5; wx < x + w - 7; wx += 11) {
          if (R() < chance) { g.fillStyle = winCol; g.fillRect(wx, wy, 4.5, 5.5); g.fillStyle = col; }
        }
      }
      x += w + 3 + R() * 13;
    }
    g.filter = 'none';
  }

  function buildBackdrop() {
    var s = 1.5;
    var c = off(Math.round(BW * s), Math.round(BH * s));
    var g = c.getContext('2d');
    g.scale(s, s); g.translate(-BX0, -BY0);

    var sky = g.createLinearGradient(0, BY0, 0, GY);
    sky.addColorStop(0, '#02040a');
    sky.addColorStop(.28, '#050b16');
    sky.addColorStop(.58, '#0e1827');
    sky.addColorStop(.84, '#1c2839');
    sky.addColorStop(1, '#323847');
    g.fillStyle = sky; g.fillRect(BX0, BY0, BW, GY - BY0);

    var R = U.seeded(20250811);

    /* راه شیری کم‌رنگ */
    g.save();
    if (supportsFilter) g.filter = 'blur(22px)';
    var mw = g.createLinearGradient(BX0, BY0, BX0 + BW, 260);
    mw.addColorStop(0, 'rgba(90,110,160,0)');
    mw.addColorStop(.5, 'rgba(110,130,180,.07)');
    mw.addColorStop(1, 'rgba(90,110,160,0)');
    g.fillStyle = mw;
    g.beginPath(); g.moveTo(BX0, -120); g.lineTo(BX0 + BW, -250);
    g.lineTo(BX0 + BW, -110); g.lineTo(BX0, 30); g.closePath(); g.fill();
    g.restore();

    /* ستاره‌ها با اندازه و رنگ متفاوت */
    for (var i = 0; i < 460; i++) {
      var x = BX0 + R() * BW, y = BY0 + R() * (290 - BY0);
      var a = .07 + R() * .58, r = R() * 1.2 + .18;
      var tint = R();
      var col = tint < .12 ? '226,236,255' : (tint > .9 ? '255,232,210' : '236,242,255');
      g.fillStyle = 'rgba(' + col + ',' + a.toFixed(3) + ')';
      g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill();
      if (r > 1.15) {
        g.strokeStyle = 'rgba(' + col + ',' + (a * .35).toFixed(3) + ')';
        g.lineWidth = .6;
        g.beginPath(); g.moveTo(x - 3.5, y); g.lineTo(x + 3.5, y);
        g.moveTo(x, y - 3.5); g.lineTo(x, y + 3.5); g.stroke();
      }
    }

    /* ماه با هاله‌ی دولایه */
    var MX = 622, MY = 40;
    var halo = g.createRadialGradient(MX, MY, 6, MX, MY, 150);
    halo.addColorStop(0, 'rgba(226,236,255,.16)');
    halo.addColorStop(1, 'rgba(226,236,255,0)');
    g.fillStyle = halo; g.beginPath(); g.arc(MX, MY, 150, 0, 6.3); g.fill();
    var mg = g.createRadialGradient(MX, MY, 4, MX, MY, 74);
    mg.addColorStop(0, 'rgba(255,246,220,.40)');
    mg.addColorStop(1, 'rgba(255,244,214,0)');
    g.fillStyle = mg; g.beginPath(); g.arc(MX, MY, 74, 0, 6.3); g.fill();
    g.fillStyle = '#f7eed6'; g.beginPath(); g.arc(MX, MY, 20, 0, 6.3); g.fill();
    g.fillStyle = 'rgba(198,188,168,.30)';
    g.beginPath(); g.arc(MX - 6, MY - 5, 4.2, 0, 6.3); g.fill();
    g.beginPath(); g.arc(MX + 5, MY + 7, 2.8, 0, 6.3); g.fill();
    g.beginPath(); g.arc(MX + 8, MY - 8, 2, 0, 6.3); g.fill();
    g.beginPath(); g.arc(MX - 2, MY + 11, 2.4, 0, 6.3); g.fill();

    /* ابرهای نازک */
    g.save();
    if (supportsFilter) g.filter = 'blur(9px)';
    for (var cl = 0; cl < 11; cl++) {
      var cx2 = BX0 + R() * BW, cy2 = BY0 + 60 + R() * 210;
      var cwid = 180 + R() * 260, chei = 18 + R() * 22;
      g.fillStyle = 'rgba(126,148,186,' + (.03 + R() * .04).toFixed(3) + ')';
      g.beginPath(); g.ellipse(cx2, cy2, cwid / 2, chei / 2, 0, 0, 6.3); g.fill();
    }
    g.restore();

    /* سه لایه‌ی افق — دورترها تارتر (عمق میدان) */
    skylineBand(g, R, GY - 96, 70, 210, '#0b1220', 'rgba(255,206,140,.28)', .10, [40, 90], 2.2);
    skylineBand(g, R, GY - 56, 62, 176, '#0a1120', 'rgba(255,206,140,.48)', .16, [34, 76], 1.0);
    skylineBand(g, R, GY - 14, 84, 226, '#050a13', 'rgba(255,196,120,.42)', .13, [30, 70], 0);

    /* دیوار پشت */
    g.fillStyle = '#080d16'; g.fillRect(BX0, GY - 44, BW, 44);
    g.fillStyle = 'rgba(255,255,255,.022)';
    for (var wx2 = BX0; wx2 < BX0 + BW; wx2 += 46) g.fillRect(wx2, GY - 44, 1, 44);

    /* خیابان */
    var road = g.createLinearGradient(0, GY, 0, BY0 + BH);
    road.addColorStop(0, '#1c212c');
    road.addColorStop(.26, '#12161f');
    road.addColorStop(1, '#06080e');
    g.fillStyle = road; g.fillRect(BX0, GY, BW, BY0 + BH - GY);
    g.fillStyle = '#252d3b'; g.fillRect(BX0, GY, BW, 7);
    g.fillStyle = '#374254'; g.fillRect(BX0, GY, BW, 2);
    g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(BX0, GY + 7, BW, 3);
    g.strokeStyle = 'rgba(255,255,255,.03)'; g.lineWidth = 1;
    for (var px = BX0 - 60; px < BX0 + BW + 120; px += 56) {
      g.beginPath(); g.moveTo(px, GY + 10); g.lineTo(px - 66, BY0 + BH); g.stroke();
    }
    g.beginPath(); g.moveTo(BX0, GY + 54); g.lineTo(BX0 + BW, GY + 54); g.stroke();
    g.beginPath(); g.moveTo(BX0, GY + 128); g.lineTo(BX0 + BW, GY + 128); g.stroke();
    /* لکه‌های آسفالت */
    for (var k = 0; k < 80; k++) {
      var sx = BX0 + R() * BW, sy = GY + 12 + R() * (BY0 + BH - GY - 12);
      var sw = 22 + R() * 90, sh = 4 + R() * 12;
      g.fillStyle = 'rgba(255,255,255,' + (.006 + R() * .014).toFixed(3) + ')';
      g.beginPath(); g.ellipse(sx, sy, sw / 2, sh / 2, 0, 0, 6.3); g.fill();
    }
    /* ترک‌های ریز */
    g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 1;
    for (var cr = 0; cr < 26; cr++) {
      var crx = BX0 + R() * BW, cry = GY + 16 + R() * 220;
      g.beginPath(); g.moveTo(crx, cry);
      g.lineTo(crx + rnd(-30, 30), cry + rnd(4, 16));
      g.lineTo(crx + rnd(-50, 50), cry + rnd(10, 30));
      g.stroke();
    }
    backdrop = c;
  }

  /* گودال‌های ثابت روی آسفالت */
  var PUDDLES = [
    { x: 250, y: GY + 44, w: 120, h: 17 },
    { x: 706, y: GY + 74, w: 140, h: 19 },
    { x: 404, y: GY + 118, w: 150, h: 20 }
  ];

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

  /* ═════════ اجزای مشترک نما ═════════ */
  function wallPanel(g, x, y, w, h, c1, c2, tex) {
    var gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1;
    if (tex === 'v') {
      for (var i = x + 14; i < x + w; i += 17) { g.beginPath(); g.moveTo(i, y + 2); g.lineTo(i, y + h - 2); g.stroke(); }
    } else if (tex === 'h') {
      for (var j = y + 11; j < y + h; j += 12) { g.beginPath(); g.moveTo(x, j); g.lineTo(x + w, j); g.stroke(); }
    } else if (tex === 'grid') {
      for (var a = x + 26; a < x + w; a += 26) { g.beginPath(); g.moveTo(a, y); g.lineTo(a, y + h); g.stroke(); }
      for (var b = y + 26; b < y + h; b += 26) { g.beginPath(); g.moveTo(x, b); g.lineTo(x + w, b); g.stroke(); }
    }
    /* نور کناری از چراغ خیابان */
    var side = g.createLinearGradient(x, 0, x + w * .45, 0);
    side.addColorStop(0, 'rgba(255,186,110,.07)');
    side.addColorStop(1, 'rgba(255,186,110,0)');
    g.fillStyle = side; g.fillRect(x, y, w * .45, h);
    g.fillStyle = 'rgba(255,255,255,.055)'; g.fillRect(x, y, w, 1.6);
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x, y + h - 2, w, 2);
  }

  function awningBand(g, x, y, w, h, c1, c2, T) {
    var n = Math.max(4, Math.round(w / 27)), sw = w / n;
    var flut = RM ? 0 : 1;
    for (var i = 0; i < n; i++) {
      var dy = flut * Math.sin(T * 1.9 + i * .8) * 1.3;
      g.fillStyle = i % 2 ? c1 : c2;
      g.beginPath();
      g.moveTo(x + i * sw, y); g.lineTo(x + (i + 1) * sw, y);
      g.lineTo(x + (i + 1) * sw - 2, y + h + dy); g.lineTo(x + i * sw - 2, y + h + dy);
      g.closePath(); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,.24)';
    for (var j = 0; j < n; j++) {
      var dy2 = flut * Math.sin(T * 1.9 + j * .8) * 1.3;
      g.beginPath(); g.arc(x + j * sw + sw / 2 - 2, y + h + dy2, sw / 2, 0, Math.PI); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,.09)'; g.fillRect(x, y, w, 2);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x - 2, y + h + 1, w, 2);
  }

  function litWindow(g, x, y, w, h, warm, T, seed, people) {
    warm *= (.5 + .5 * NF);
    var gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, 'rgba(255,212,150,' + (.88 * warm) + ')');
    gr.addColorStop(.6, 'rgba(255,186,116,' + (.7 * warm) + ')');
    gr.addColorStop(1, 'rgba(255,164,92,' + (.52 * warm) + ')');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    if (people !== 0 && w > 26 && h > 22) {
      var n = people || 1;
      g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.globalAlpha = .46;
      for (var i = 0; i < n; i++) {
        var p = (Math.sin(T * (.5 + i * .17) + seed + i * 2.1) * .5 + .5);
        person(g, x + 9 + p * (w - 18), y + h, .6,
          { skin: '#0d1219', cloth: '#0d1219', pants: '#0d1219', hair: '#0d1219', t: T * 3 + i, walk: .22, shadow: false });
      }
      g.restore();
    }
    g.strokeStyle = '#0c111a'; g.lineWidth = 3; g.strokeRect(x, y, w, h);
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x + w / 2 - 1.5, y, 3, h);
    /* بازتاب شیشه */
    g.save(); g.globalAlpha = .11; g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(x + 4, y + h - 4); g.lineTo(x + w * .44, y + 4);
    g.lineTo(x + w * .6, y + 4); g.lineTo(x + w * .16, y + h - 4); g.closePath(); g.fill();
    g.restore();
    /* نور بیرون‌ریز */
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .17 * warm;
    g.drawImage(glowSprite, x - w * .4, y - h * .3, w * 1.8, h * 2.4);
    g.restore();
  }

  var NEON = ['rgba(255,138,92,', 'rgba(120,196,255,', 'rgba(255,196,110,'];
  function signBoard(g, cx, y, w, h, text, lit, T, neon) {
    var x = cx - w / 2;
    lit *= (.35 + .65 * NF);
    g.fillStyle = '#131922'; rr(g, x, y, w, h, 4); g.fill();
    g.strokeStyle = '#26303f'; g.lineWidth = 2; g.stroke();
    /* قاب فلزی */
    g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 1;
    rr(g, x + 3, y + 3, w - 6, h - 6, 3); g.stroke();

    var fl = lit > 0 ? (.84 + Math.sin(T * 12.7) * .05 + (Math.random() < .009 ? -.45 : 0)) : .16;
    if (lit > 0) {
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .5 * fl * Math.min(1, lit);
      g.drawImage(glowSprite, cx - w * .85, y - h * 1.7, w * 1.7, h * 3.8);
      g.restore();
    }
    var col = neon ? NEON[(neon - 1) % NEON.length] + fl + ')' : 'rgba(255,214,150,' + fl + ')';
    var fs = Math.round(Math.min(h * .66, w / Math.max(4, text.length * .62)));
    g.font = '700 ' + Math.max(9, fs) + 'px ' + FONT;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    var ty = y + h / 2 + 1;
    if (lit > 0) {
      g.save();
      g.fillStyle = col;
      g.shadowColor = neon ? col : 'rgba(255,180,90,.95)';
      g.shadowBlur = 16 * fl;
      g.fillText(text, cx, ty);
      g.fillText(text, cx, ty);
      g.restore();
      g.fillStyle = 'rgba(255,246,226,' + (.86 * fl) + ')';
      g.fillText(text, cx, ty);
    } else {
      g.fillStyle = '#495363';
      g.fillText(text, cx, ty);
    }
  }

  function bulbString(g, x1, y, x2, n, T) {
    g.strokeStyle = 'rgba(255,255,255,.15)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x1, y); g.quadraticCurveTo((x1 + x2) / 2, y + 15, x2, y); g.stroke();
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var mx = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * ((x1 + x2) / 2) + t * t * x2;
      var my = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * (y + 15) + t * t * y;
      var f = (.56 + Math.sin(T * 2.6 + i * 1.7) * .34) * NF;
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .34 * f;
      g.drawImage(glowSprite, mx - 18, my - 16, 36, 36); g.restore();
      g.fillStyle = 'rgba(255,218,168,' + (.7 + f * .3) + ')';
      g.beginPath(); g.arc(mx, my + 3.6, 2.2, 0, 6.3); g.fill();
    }
  }

  function groundShadow(g, cx, w, alpha) {
    g.save(); g.globalAlpha = alpha == null ? .45 : alpha; g.fillStyle = '#000';
    g.beginPath(); g.ellipse(cx, GY + 6, w / 2, 7.5, 0, 0, 6.3); g.fill(); g.restore();
  }

  function acUnit(g, x, y) {
    g.fillStyle = '#2a3240'; rr(g, x, y, 42, 22, 3); g.fill();
    g.strokeStyle = '#3d4658'; g.lineWidth = 1.4;
    for (var i = 0; i < 4; i++) { g.beginPath(); g.moveTo(x + 4, y + 4 + i * 5); g.lineTo(x + 38, y + 4 + i * 5); g.stroke(); }
  }
  function plantPot(g, x, y) {
    g.fillStyle = '#3a2c22'; rr(g, x, y - 24, 26, 24, 3); g.fill();
    g.fillStyle = '#2f5138';
    for (var i = 0; i < 6; i++) {
      g.beginPath();
      g.ellipse(x + 13 + Math.sin(i * 2.1) * 9, y - 30 - i * 3.4, 7.5, 4.2, i, 0, 6.3);
      g.fill();
    }
  }
  function outdoorSet(g, x, y, T, seed) {
    g.strokeStyle = '#2b3240'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 22); g.stroke();
    g.fillStyle = '#37404f'; rr(g, x - 19, y - 27, 38, 5, 2.5); g.fill();
    [-27, 27].forEach(function (dx) {
      g.strokeStyle = '#2b3240'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(x + dx, y); g.lineTo(x + dx, y - 16); g.stroke();
      g.fillStyle = '#333c4a'; rr(g, x + dx - 8, y - 20, 16, 4, 2); g.fill();
      g.fillStyle = '#2b3240'; rr(g, x + dx - 8, y - 32, 3, 13, 1.5); g.fill();
    });
    var f = (.6 + Math.sin(T * 5 + seed) * .3) * NF;
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .36 * f;
    g.drawImage(glowSprite, x - 42, y - 70, 84, 84); g.restore();
    g.fillStyle = 'rgba(255,214,150,.9)'; g.beginPath(); g.arc(x, y - 31, 2.2, 0, 6.3); g.fill();
  }
  function lightBar(g, x, y, w, T) {
    g.fillStyle = '#1a212c'; rr(g, x, y, w, 7, 2); g.fill();
    var n = Math.max(3, Math.round(w / 70));
    for (var i = 0; i < n; i++) {
      var lx = x + (i + .5) * (w / n);
      var f = (.7 + Math.sin(T * 3 + i) * .2) * NF;
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .32 * f;
      g.drawImage(glowSprite, lx - 58, y - 24, 116, 116); g.restore();
      g.fillStyle = 'rgba(216,236,255,' + (.55 + f * .35) + ')';
      rr(g, lx - 14, y + 5, 28, 4, 2); g.fill();
    }
  }
  function rollerDoor(g, x, y, w, h, open, T) {
    g.fillStyle = '#161c26'; g.fillRect(x - 3, y - 4, w + 6, 5);
    if (open) {
      var gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, 'rgba(255,200,124,' + (.58 * NF) + ')');
      gr.addColorStop(1, 'rgba(255,162,82,' + (.26 * NF) + ')');
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      g.fillStyle = '#232a36'; g.fillRect(x, y, w, h * .22);
      /* رد نور روی زمین */
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .15 * NF;
      g.drawImage(glowSprite, x - w * .3, y + h - 30, w * 1.6, 90); g.restore();
    } else {
      g.fillStyle = '#232a36'; g.fillRect(x, y, w, h);
      g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1;
      for (var i = y + 6; i < y + h; i += 7) { g.beginPath(); g.moveTo(x, i); g.lineTo(x + w, i); g.stroke(); }
    }
    g.strokeStyle = '#2f3846'; g.lineWidth = 2; g.strokeRect(x, y, w, h);
  }
  function container(g, x, y, w, h, col) {
    g.fillStyle = col; g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1;
    for (var i = x + 6; i < x + w; i += 7) { g.beginPath(); g.moveTo(i, y + 2); g.lineTo(i, y + h - 2); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.09)'; g.fillRect(x, y, w, 2);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x, y + h - 3, w, 3);
  }

  /* ═════════ وسایل نقلیه ═════════ */
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
  function drawVan(g, T, col) {
    g.fillStyle = '#0e1219';
    g.beginPath(); g.arc(-30, 0, 12, 0, 6.3); g.fill();
    g.beginPath(); g.arc(34, 0, 12, 0, 6.3); g.fill();
    g.strokeStyle = '#39424f'; g.lineWidth = 2.4;
    g.beginPath(); g.arc(-30, 0, 8.5, 0, 6.3); g.stroke();
    g.beginPath(); g.arc(34, 0, 8.5, 0, 6.3); g.stroke();
    g.fillStyle = col || '#e6e2d6'; rr(g, -52, -42, 104, 38, 5); g.fill();
    g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(-52, -14, 104, 3);
    g.fillStyle = '#2a3240'; rr(g, 18, -38, 26, 16, 3); g.fill();
    g.fillStyle = 'rgba(160,205,245,.35)'; rr(g, 20, -36, 22, 12, 2); g.fill();
    g.fillStyle = '#a63d33'; g.font = '700 13px ' + FONT;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('آبرو', -18, -24);
  }
  function drawTruck(g, T) {
    g.fillStyle = '#0e1219';
    [-58, -34, 46].forEach(function (x) { g.beginPath(); g.arc(x, 0, 13, 0, 6.3); g.fill(); });
    g.strokeStyle = '#39424f'; g.lineWidth = 2.4;
    [-58, -34, 46].forEach(function (x) { g.beginPath(); g.arc(x, 0, 9, 0, 6.3); g.stroke(); });
    container(g, -80, -54, 96, 46, '#4a6b7a');
    g.fillStyle = '#d8d2c4'; rr(g, 22, -46, 44, 38, 5); g.fill();
    g.fillStyle = '#2a3240'; rr(g, 40, -42, 22, 15, 3); g.fill();
    g.fillStyle = 'rgba(160,205,245,.35)'; rr(g, 42, -40, 18, 11, 2); g.fill();
  }

  /* ═════════ نما ═════════ */
  function potFire(g, px, py, T, fire) {
    g.fillStyle = '#232a35'; rr(g, px - 19, py + 4, 38, 10, 2); g.fill();
    if (fire) {
      g.save(); g.globalCompositeOperation = 'lighter';
      var f = .55 + Math.sin(T * 16) * .2 + Math.random() * .12;
      g.globalAlpha = .52 * f;
      g.drawImage(glowSprite, px - 56, py - 38, 112, 92);
      g.restore();
      for (var i = 0; i < 3; i++) {
        var fh = 9 + Math.sin(T * 14 + i * 2.1) * 4 + Math.random() * 3, fx = px - 9 + i * 9;
        var fg = g.createLinearGradient(0, py + 6, 0, py + 6 - fh);
        fg.addColorStop(0, 'rgba(255,120,30,.95)');
        fg.addColorStop(.6, 'rgba(255,178,70,.7)');
        fg.addColorStop(1, 'rgba(255,215,120,0)');
        g.fillStyle = fg;
        g.beginPath(); g.moveTo(fx - 4, py + 7); g.quadraticCurveTo(fx, py + 7 - fh, fx + 4, py + 7); g.closePath(); g.fill();
      }
    }
    var pg = g.createLinearGradient(px - 20, 0, px + 20, 0);
    pg.addColorStop(0, '#5b6472'); pg.addColorStop(.35, '#8e98a6');
    pg.addColorStop(.7, '#4d5563'); pg.addColorStop(1, '#39414d');
    g.fillStyle = pg; rr(g, px - 18, py - 15, 36, 21, 3); g.fill();
    g.fillStyle = '#9aa4b2'; rr(g, px - 21, py - 19, 42, 5, 2.5); g.fill();
    g.strokeStyle = '#5d6674'; g.lineWidth = 2;
    g.beginPath(); g.arc(px - 21, py - 11, 4, Math.PI * .5, Math.PI * 1.5); g.stroke();
    g.beginPath(); g.arc(px + 21, py - 11, 4, Math.PI * 1.5, Math.PI * .5); g.stroke();
  }

  function cartWheel(g, x, y, r) {
    g.fillStyle = '#12161e'; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill();
    g.strokeStyle = '#39424f'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r - 2, 0, 6.3); g.stroke();
    g.strokeStyle = '#2a323d'; g.lineWidth = 1.4;
    for (var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * (r - 3), y + Math.sin(a) * (r - 3)); g.stroke();
    }
    g.fillStyle = '#4a5462'; g.beginPath(); g.arc(x, y, 2.4, 0, 6.3); g.fill();
  }

  function drawFacade(g, fac, T, W, reflect) {
    var cx = 500, cw = fac.w, x = cx - cw / 2, top = fac.top;
    var lit = W.brandLit;
    var bigSign = Math.max(fac.signH, Math.min(54, cw * .075));
    var anchors = {
      pot: [cx - 48, top + 46], cash: [cx + 52, top + 40],
      crew: [x + 34, x + cw - 34], queue: x + cw + 34,
      steam: [cx - 48, top + 30], owner: [cx + 30, GY]
    };
    if (!reflect) groundShadow(g, cx, cw + 24, .5);

    switch (fac.style) {

      case 'cart': {
        var ct = top;
        cartWheel(g, x + 26, GY - 4, 17);
        cartWheel(g, x + cw - 26, GY - 4, 17);
        wallPanel(g, x, ct, cw, GY - ct - 14, '#6a4326', '#3b2415', 'v');
        g.strokeStyle = '#4a3020'; g.lineWidth = 5;
        g.beginPath(); g.moveTo(x + cw, ct + 16); g.lineTo(x + cw + 34, ct + 6); g.stroke();
        g.fillStyle = '#98a2ae'; rr(g, x - 8, ct - 8, cw + 16, 10, 3); g.fill();
        g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(x - 8, ct - 8, cw + 16, 2);
        g.strokeStyle = '#3a4250'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(cx + 52, ct - 8); g.lineTo(cx + 52, 286); g.stroke();
        g.save();
        g.beginPath(); g.moveTo(cx - 96, 300); g.quadraticCurveTo(cx + 52, 258, cx + 108, 300); g.closePath(); g.clip();
        awningBand(g, cx - 100, 262, 214, 42, fac.awning[0], fac.awning[1], T);
        g.restore();
        g.fillStyle = '#8f3129';
        g.beginPath(); g.moveTo(cx - 96, 300); g.quadraticCurveTo(cx + 52, 292, cx + 108, 300);
        g.lineTo(cx + 108, 304); g.quadraticCurveTo(cx + 52, 296, cx - 96, 304); g.closePath(); g.fill();
        var bf = (.7 + Math.sin(T * 4) * .25) * NF;
        g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .58 * bf;
        g.drawImage(glowSprite, cx + 52 - 72, 306 - 66, 144, 144); g.restore();
        g.fillStyle = 'rgba(255,222,170,.95)'; g.beginPath(); g.arc(cx + 52, 308, 4, 0, 6.3); g.fill();
        if (W.lvl.counter) {
          g.save(); g.globalAlpha = .2; g.fillStyle = '#cfe6ff';
          rr(g, x + 16, ct - 42, 84, 34, 3); g.fill(); g.restore();
          g.strokeStyle = '#5d6a7c'; g.lineWidth = 2; rr(g, x + 16, ct - 42, 84, 34, 3); g.stroke();
          for (var i = 0; i < 3; i++) {
            g.fillStyle = ['#d9a052', '#c96f43', '#e0c37a'][i];
            rr(g, x + 24 + i * 26, ct - 20, 20, 9, 2.5); g.fill();
          }
        }
        anchors.pot = [cx - 48, ct - 8]; anchors.steam = [cx - 48, ct - 26];
        anchors.cash = [cx + 40, ct - 14];
        anchors.owner = [cx + 30, ct + 2];
        anchors.crew = [x - 16, x + cw + 16];
        anchors.queue = x + cw + 30;
        potFire(g, anchors.pot[0], anchors.pot[1], T, W.lvl.stove > 0);
        signBoard(g, cx - 4, 292, 120, fac.signH, fac.sign, lit ? 1 : .25, T);
        break;
      }

      case 'kiosk': {
        wallPanel(g, x, top, cw, GY - top, fac.body[0], fac.body[1], 'v');
        var wx = x + 30, wy = top + 26, ww = cw - 60, wh = 54;
        litWindow(g, wx, wy, ww, wh, 1, T, 1.1, 1);
        g.fillStyle = '#8e5f38'; rr(g, x + 18, wy + wh + 2, cw - 36, 12, 3); g.fill();
        g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x + 18, wy + wh + 2, cw - 36, 2);
        awningBand(g, x - 14, top - 6, cw + 28, 30, fac.awning[0], fac.awning[1], T);
        g.fillStyle = '#1c232e'; rr(g, x - 18, top - 22, cw + 36, 16, 3); g.fill();
        signBoard(g, cx, top - 46, 168, fac.signH, fac.sign, lit ? 1 : .3, T);
        if (fac.bulbs) bulbString(g, x - 10, top - 2, x + cw + 10, 7, T);
        anchors.pot = [cx - 60, wy + wh + 2]; anchors.steam = [cx - 60, wy + wh - 16];
        anchors.cash = [cx + 48, wy + wh - 4];
        anchors.owner = [cx + 46, wy + wh + 2];
        potFire(g, anchors.pot[0], anchors.pot[1], T, W.lvl.stove > 0);
        g.fillStyle = '#3e2e20'; rr(g, x + cw + 8, GY - 26, 30, 26, 2); g.fill();
        break;
      }

      case 'shop': {
        wallPanel(g, x, top, cw, GY - top, fac.body[0], fac.body[1], 'h');
        var bh = bigSign + 12;
        var winY = top + bh + 28;
        var bigW = Math.round(cw * .52), doorW = 62;
        litWindow(g, x + 24, winY, bigW, 92, 1, T, .7, 2);
        litWindow(g, x + cw - 24 - doorW, winY, doorW, GY - winY, .88, T, 3.4, 1);
        g.fillStyle = '#151a22'; g.fillRect(x + cw - 26 - doorW, winY - 4, doorW + 4, 5);
        g.fillStyle = '#c8b78e'; g.fillRect(x + cw - 26 - doorW + 8, winY + 88, 4, 12);
        awningBand(g, x + 12, top + bh + 6, bigW + 24, 26, fac.awning[0], fac.awning[1], T);
        g.fillStyle = '#161c26'; g.fillRect(x, top, cw, bh);
        signBoard(g, cx, top + 6, cw - 30, bigSign, fac.sign, lit ? 1 : .35, T, fac.neon);
        if (fac.bulbs) bulbString(g, x + 6, top + bh + 8, x + cw - 6, 9, T);
        if (fac.ac) acUnit(g, x + cw - 54, top - 22);
        if (fac.plant) plantPot(g, x + cw + 6, GY);
        if (fac.tables) {
          outdoorSet(g, x - 8, GY + 16, T, .4);
          outdoorSet(g, x + cw + 22, GY + 16, T, 2.7);
        }
        anchors.pot = [x + 60, GY - 6]; anchors.steam = [x + 60, GY - 24];
        anchors.cash = [cx + 40, GY - 30];
        anchors.owner = [x + cw - 60, GY];
        anchors.crew = [x + 26, x + cw - 90];
        anchors.queue = cx + cw * .30;
        potFire(g, anchors.pot[0], anchors.pot[1], T, W.lvl.stove > 0);
        break;
      }

      case 'row': {
        var units = fac.units || 2, uw = cw / units;
        var rbh = bigSign + 14, rWinY = top + rbh + 42;
        wallPanel(g, x, top, cw, GY - top, fac.body[0], fac.body[1], 'grid');
        for (var u = 0; u < units; u++) {
          var ux = x + u * uw;
          g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(ux + uw - 2, top + rbh, 4, GY - top - rbh);
          litWindow(g, ux + 20, rWinY, uw - 84, 92, 1, T, u * 2.2, 2);
          litWindow(g, ux + uw - 56, rWinY, 40, GY - rWinY, .9, T, u * 1.6 + 4, 1);
          if (fac.awning) awningBand(g, ux + 12, top + rbh + 18, uw - 24, 24, fac.awning[0], fac.awning[1], T);
        }
        g.fillStyle = '#141a24'; g.fillRect(x, top, cw, rbh);
        signBoard(g, cx, top + 7, cw - 50, bigSign, fac.sign, 1, T, fac.neon);
        if (fac.bulbs) bulbString(g, x + 10, top + rbh + 8, x + cw - 10, Math.round(cw / 44), T);
        if (fac.tables) {
          outdoorSet(g, x - 10, GY + 16, T, .4);
          outdoorSet(g, x + cw + 24, GY + 16, T, 2.7);
        }
        anchors.pot = [x + 52, GY - 6];
        anchors.steam = [x + cw * .22, top - 8];
        anchors.cash = [x + uw * .6, GY - 30];
        anchors.owner = [x + uw * .5, GY];
        anchors.crew = [x + 24, x + cw - 60];
        anchors.queue = cx + cw * .26;
        break;
      }

      case 'depot': {
        wallPanel(g, x, top, cw, GY - top, fac.body[0], fac.body[1], 'grid');
        g.fillStyle = '#1d232d'; g.fillRect(x - 8, top - 12, cw + 16, 16);
        g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x - 8, top - 12, cw + 16, 2);
        var doors = Math.max(2, Math.round(cw / 150));
        for (var d = 0; d < doors; d++) {
          var dw = cw / doors - 26, dx = x + 13 + d * (cw / doors);
          rollerDoor(g, dx, GY - 78, dw, 78, d % 2 === 0, T);
        }
        for (var q = 0; q < doors; q++) {
          litWindow(g, x + 20 + q * (cw / doors), top + 22, cw / doors - 40, 30, .8, T, q, 0);
        }
        signBoard(g, cx, top - 22 - bigSign, Math.min(cw - 40, 480), bigSign, fac.sign, 1, T, fac.neon);
        if (fac.lightbar) lightBar(g, x + 10, top - 16, cw - 20, T);
        if (fac.containers) {
          container(g, x - 96, GY - 52, 84, 52, '#4a6b7a');
          container(g, x - 96, GY - 104, 84, 52, '#7a5a4a');
          container(g, x + cw + 14, GY - 52, 84, 52, '#5a6b4a');
        }
        if (fac.crane) {
          g.strokeStyle = '#4a5464'; g.lineWidth = 6;
          g.beginPath(); g.moveTo(x + cw + 70, GY); g.lineTo(x + cw + 70, top - 120); g.stroke();
          g.lineWidth = 5;
          g.beginPath(); g.moveTo(x + cw + 70, top - 116); g.lineTo(x + cw - 40, top - 150); g.stroke();
          g.lineWidth = 1.5; g.strokeStyle = '#333c4a';
          g.beginPath(); g.moveTo(x + cw - 20, top - 143); g.lineTo(x + cw - 20, top - 80); g.stroke();
          container(g, x + cw - 54, top - 80, 68, 40, '#8a6a3a');
          var cf = (.6 + Math.sin(T * 4) * .35) * NF;
          g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .42 * cf;
          g.drawImage(glowSprite, x + cw + 40, top - 150, 60, 60); g.restore();
        }
        anchors.pot = [x + 40, GY - 8]; anchors.steam = [cx, top - 14];
        anchors.cash = [cx, GY - 40];
        anchors.owner = [x + cw * .35, GY];
        anchors.crew = [x + 40, x + cw - 40];
        anchors.queue = cx + cw * .24;
        break;
      }

      case 'plant': {
        wallPanel(g, x, top, cw, GY - top, fac.body[0], fac.body[1], 'grid');
        var saw = 6, sw2 = cw / saw;
        for (var s2 = 0; s2 < saw; s2++) {
          g.fillStyle = '#252b34';
          g.beginPath();
          g.moveTo(x + s2 * sw2, top);
          g.lineTo(x + s2 * sw2 + sw2 * .55, top - 26);
          g.lineTo(x + (s2 + 1) * sw2, top);
          g.closePath(); g.fill();
          g.fillStyle = 'rgba(255,206,140,' + (.42 * NF) + ')';
          g.beginPath();
          g.moveTo(x + s2 * sw2 + sw2 * .58, top - 24);
          g.lineTo(x + (s2 + 1) * sw2 - 3, top - 1);
          g.lineTo(x + s2 * sw2 + sw2 * .62, top - 1);
          g.closePath(); g.fill();
        }
        for (var w2 = 0; w2 < 5; w2++) {
          litWindow(g, x + 26 + w2 * (cw - 52) / 5, top + 34, (cw - 52) / 5 - 18, 44, .82, T, w2, 1);
        }
        for (var dd = 0; dd < 3; dd++) rollerDoor(g, x + 40 + dd * (cw - 80) / 3, GY - 70, (cw - 80) / 3 - 30, 70, dd === 1, T);
        signBoard(g, cx, top - 20 - bigSign, Math.min(cw - 60, 460), bigSign, fac.sign, 1, T);
        if (fac.lightbar) lightBar(g, x + 14, top - 34, cw - 28, T);
        anchors.pot = [x + 40, GY - 8]; anchors.steam = [x + cw * .22, top - 120];
        anchors.cash = [cx, GY - 40];
        anchors.owner = [x + cw * .5, GY];
        anchors.crew = [x + 46, x + cw - 46];
        anchors.queue = cx + cw * .24;
        break;
      }

      case 'tower': {
        var floors = fac.floors || 5;
        var fh = (GY - top) / (floors + .6);
        wallPanel(g, x, top, cw, GY - top, fac.body[0], fac.body[1], 'grid');
        g.fillStyle = '#2a2a3a'; g.fillRect(x - 10, top - 14, cw + 20, 16);
        g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x - 10, top - 14, cw + 20, 2);
        for (var f2 = 0; f2 < floors; f2++) {
          var fy = top + 26 + f2 * fh;
          var cols = 4;
          for (var c2 = 0; c2 < cols; c2++) {
            var wgt = (cw - 60) / cols;
            var on = ((f2 * 7 + c2 * 3) % 5) !== 0;
            litWindow(g, x + 30 + c2 * wgt, fy, wgt - 16, Math.min(fh - 18, 40), on ? .92 : .12, T, f2 * 3 + c2, on ? 1 : 0);
          }
        }
        litWindow(g, x + 26, GY - fh * .9, cw - 52, fh * .9 - 4, 1, T, 9, 3);
        if (fac.antenna) {
          g.strokeStyle = '#3d4658'; g.lineWidth = 4;
          g.beginPath(); g.moveTo(cx, top - 14); g.lineTo(cx, top - 96); g.stroke();
          g.lineWidth = 2;
          g.beginPath(); g.moveTo(cx - 16, top - 40); g.lineTo(cx, top - 56); g.lineTo(cx + 16, top - 40); g.stroke();
          var af = .5 + Math.sin(T * 3.4) * .5;
          g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .58 * af;
          g.drawImage(glowSprite, cx - 42, top - 138, 84, 84); g.restore();
          g.fillStyle = 'rgba(255,110,90,' + (.5 + af * .5) + ')';
          g.beginPath(); g.arc(cx, top - 96, 3.4, 0, 6.3); g.fill();
        }
        signBoard(g, cx, top - 12 - bigSign, cw - 60, bigSign, fac.sign, 1, T, fac.neon);
        anchors.pot = [x + 44, GY - 8]; anchors.steam = [x + 26, top + 10];
        anchors.cash = [cx, GY - 40];
        anchors.owner = [cx - cw * .28, GY];
        anchors.crew = [x + 40, x + cw - 40];
        anchors.queue = cx + cw * .30;
        break;
      }
    }
    return anchors;
  }

  /* ═════════ ذرات ═════════ */
  var steam = [], coins = [], floats = [], sparks = [], drops = [], smoke = [], ripples = [];
  var rainUntil = 0, flash = 0, shakeT = 0, shakeP = 0;
  var lastAnchors = null;

  function shake(p) { shakeT = .38; shakeP = p || 4; }
  function rainFor(ms) { rainUntil = performance.now() + ms; }
  function isRaining() { return performance.now() < rainUntil; }

  function spawnCoin(v, big) {
    if (RM || !lastAnchors) return;
    var c = lastAnchors.cash;
    coins.push({
      x: c[0] + rnd(-12, 12), y: c[1], vy: rnd(-96, -66), vx: rnd(-18, 18),
      life: 0, max: 1.5, rot: rnd(0, 6), tr: 0
    });
    floats.push({
      x: c[0] + rnd(-18, 18), y: c[1] - 10, vy: -34, life: 0, max: big ? 1.7 : 1.25,
      txt: '+' + U.short(v), col: big ? '#9ff0b4' : '#ffd68f', sc: big ? 1.35 : 1
    });
  }
  function burst(x, y, n, col) {
    if (RM) return;
    for (var i = 0; i < n; i++) {
      sparks.push({ x: x, y: y, vx: rnd(-80, 80), vy: rnd(-100, -20), life: 0, max: rnd(.35, .7), col: col || '#ffd68f' });
    }
  }

  /* ═════════ مشتری ═════════ */
  var custs = [], crewLook = [], spawnAcc = 0;

  function tickCustomers(dt, W) {
    if (RM) return;
    var r = W.rate;
    var want = r > 0 ? clamp(Math.round(Math.log10(1 + r) * 1.7) + 1, 1, 9) : 0;
    var qx = lastAnchors ? lastAnchors.queue : 640;

    spawnAcc += dt;
    if (custs.length < want && spawnAcc > .55) {
      spawnAcc = 0;
      var look = randomLook();
      look.x = VW + rnd(40, 130); look.sc = rnd(.9, 1.02);
      look.state = 'walk'; look.t = rnd(0, 6); look.wait = 0;
      custs.push(look);
    }
    var speed = 62;
    for (var i = custs.length - 1; i >= 0; i--) {
      var c = custs[i];
      var tx = qx + i * 26;
      if (c.state === 'walk') {
        if (c.x > tx + 1.5) { c.x -= speed * dt; c.t += dt * 8; }
        else { c.x = tx; c.state = 'wait'; }
      } else if (c.state === 'wait') {
        c.t += dt * 1.4;
        if (Math.abs(c.x - tx) > 2) c.x += (tx - c.x) * Math.min(1, dt * 3);
        if (i === 0) {
          c.wait += dt;
          var need = clamp(2.4 - Math.log10(1 + r) / 5, .45, 2.4);
          if (c.wait > need) {
            c.state = 'leave';
            spawnCoin(Math.max(1, r * rnd(.9, 1.8)));
            if (Math.random() < .3) A.audio.sfx.coin();
          }
        }
      } else {
        c.x -= speed * 1.15 * dt; c.t += dt * 9;
        if (c.x < -70) custs.splice(i, 1);
      }
    }
    if (want === 0) {
      for (var j = 0; j < custs.length; j++) custs[j].state = 'leave';
    }
  }
  function drawCustomers(g, T) {
    for (var i = 0; i < custs.length; i++) {
      var c = custs[i];
      var walking = c.state !== 'wait';
      var bob = c.state === 'wait' ? Math.sin(T * 1.7 + i * 1.3) * 1.5 : 0;
      person(g, c.x, GY + 14, c.sc, {
        skin: c.skin, cloth: c.cloth, pants: c.pants, hair: c.hair,
        scarf: c.scarf, hat: c.hat, bag: c.state === 'leave' && c.bag,
        t: c.t, walk: walking ? 1 : .05,
        arm: bob, arm2: -bob, flip: c.state !== 'leave',
        rim: .5 * NF
      });
    }
  }

  /* ═════════ عابر، ماشین، پرنده، گربه ═════════ */
  var walkers = [], vehicles = [], birds = [], cats = [];
  var walkT = 2.4, vehT = 5, birdT = 22, catT = 34;

  function tickTraffic(dt, W) {
    if (RM) return;
    var r = W.rate;

    walkT -= dt;
    if (walkT <= 0) {
      walkT = Math.max(1.5, 6.5 - Math.log10(1 + r) * 1.4) + Math.random() * 2.4;
      var dir = Math.random() < .5 ? 1 : -1, fg = Math.random() < .5;
      var o = randomLook();
      o.x = dir > 0 ? -70 : VW + 70; o.dir = dir; o.fg = fg;
      o.y = fg ? GY + 132 : GY + 18;
      o.sc = fg ? 1.7 : .84;
      o.sp = (fg ? 74 : 46) * rnd(.85, 1.25);
      o.t = rnd(0, 6);
      walkers.push(o);
    }
    for (var i = walkers.length - 1; i >= 0; i--) {
      var w = walkers[i];
      w.x += w.dir * w.sp * dt; w.t += dt * w.sp * .13;
      if (w.x < -110 || w.x > VW + 110) walkers.splice(i, 1);
    }

    vehT -= dt;
    if (vehT <= 0) {
      var kinds = [];
      if (W.lvl.peyk) kinds.push('bike');
      if (W.tier >= 6 || W.lvl.fleet) { kinds.push('van'); kinds.push('van'); }
      if (W.tier >= 9) kinds.push('truck');
      if (kinds.length) {
        var kind = U.pick(kinds);
        var vd = Math.random() < .5 ? 1 : -1;
        vehicles.push({
          kind: kind, dir: vd, x: vd > 0 ? -160 : VW + 160,
          y: GY + (kind === 'bike' ? 104 : 118),
          sp: kind === 'bike' ? rnd(230, 300) : rnd(150, 200)
        });
        vehT = Math.max(3.5, 12 - (W.lvl.peyk || 0) * .3 - W.tier * .4) + Math.random() * 4;
      } else vehT = 6;
    }
    for (var v = vehicles.length - 1; v >= 0; v--) {
      var vh = vehicles[v];
      vh.x += vh.dir * vh.sp * dt;
      if (vh.x < -220 || vh.x > VW + 220) vehicles.splice(v, 1);
    }

    /* پرنده‌ها */
    birdT -= dt;
    if (birdT <= 0) {
      birdT = 26 + Math.random() * 34;
      var bd = Math.random() < .5 ? 1 : -1;
      var n = 3 + (Math.random() * 4 | 0);
      var by = 60 + Math.random() * 110;
      for (var b = 0; b < n; b++) {
        birds.push({
          x: (bd > 0 ? -60 : VW + 60) - bd * b * 22,
          y: by + Math.abs(b - n / 2) * 9 + rnd(-4, 4),
          dir: bd, sp: rnd(52, 74), ph: rnd(0, 6), sc: rnd(.7, 1.1)
        });
      }
    }
    for (var bi = birds.length - 1; bi >= 0; bi--) {
      var bb = birds[bi];
      bb.x += bb.dir * bb.sp * dt;
      bb.y += Math.sin(bb.x * .01) * 4 * dt;
      if (bb.x < -120 || bb.x > VW + 120) birds.splice(bi, 1);
    }

    /* گربه */
    catT -= dt;
    if (catT <= 0 && cats.length === 0) {
      catT = 40 + Math.random() * 50;
      var cd = Math.random() < .5 ? 1 : -1;
      cats.push({ x: cd > 0 ? -40 : VW + 40, dir: cd, sp: 30, t: 0, pause: 0, sat: 0 });
    }
    for (var ci = cats.length - 1; ci >= 0; ci--) {
      var ct2 = cats[ci];
      if (ct2.pause > 0) {
        ct2.pause -= dt; ct2.sat = 1;
      } else {
        ct2.sat = 0;
        ct2.x += ct2.dir * ct2.sp * dt;
        ct2.t += dt * 7;
        if (Math.random() < dt * .12) ct2.pause = rnd(1.5, 4);
      }
      if (ct2.x < -80 || ct2.x > VW + 80) cats.splice(ci, 1);
    }
  }

  function drawBirds(g, T) {
    if (!birds.length) return;
    g.strokeStyle = 'rgba(16,22,34,.72)';
    g.lineCap = 'round';
    for (var i = 0; i < birds.length; i++) {
      var b = birds[i];
      var flap = Math.sin(T * 9 + b.ph);
      g.lineWidth = 1.6 * b.sc;
      g.beginPath();
      g.moveTo(b.x - 6 * b.sc, b.y + flap * 2.4 * b.sc);
      g.quadraticCurveTo(b.x - 2 * b.sc, b.y - 2 * b.sc, b.x, b.y);
      g.quadraticCurveTo(b.x + 2 * b.sc, b.y - 2 * b.sc, b.x + 6 * b.sc, b.y + flap * 2.4 * b.sc);
      g.stroke();
    }
  }
  function drawCats(g, T) {
    for (var i = 0; i < cats.length; i++) {
      var c = cats[i];
      g.save();
      g.translate(c.x, GY + 14);
      g.scale(c.dir, 1);
      g.globalAlpha = .82;
      g.fillStyle = '#0e131c';
      if (c.sat) {
        g.beginPath(); g.ellipse(0, -5, 7, 6, 0, 0, 6.3); g.fill();
        g.beginPath(); g.arc(6, -13, 4, 0, 6.3); g.fill();
        g.beginPath(); g.moveTo(3.4, -16); g.lineTo(4.6, -20); g.lineTo(6.4, -16); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(7.4, -16.4); g.lineTo(9, -20); g.lineTo(9.8, -15.6); g.closePath(); g.fill();
        g.strokeStyle = '#0e131c'; g.lineWidth = 2; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-6, -4); g.quadraticCurveTo(-12, -6, -11, -14); g.stroke();
      } else {
        var lg = Math.sin(c.t) * 2.6;
        g.beginPath(); g.ellipse(0, -8, 9, 4.6, 0, 0, 6.3); g.fill();
        g.beginPath(); g.arc(9, -12, 3.8, 0, 6.3); g.fill();
        g.beginPath(); g.moveTo(6.6, -14.6); g.lineTo(7.6, -18.4); g.lineTo(9.4, -14.8); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(10.2, -15); g.lineTo(11.8, -18.4); g.lineTo(12.4, -14.4); g.closePath(); g.fill();
        g.strokeStyle = '#0e131c'; g.lineWidth = 1.8; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-5, -5); g.lineTo(-5 + lg, 0); g.stroke();
        g.beginPath(); g.moveTo(5, -5); g.lineTo(5 - lg, 0); g.stroke();
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(-8, -8); g.quadraticCurveTo(-15, -10, -13, -18); g.stroke();
      }
      /* چشم‌های براق */
      g.fillStyle = 'rgba(255,214,150,.9)';
      g.beginPath(); g.arc(c.sat ? 7.4 : 10.2, c.sat ? -13.6 : -12.6, .9, 0, 6.3); g.fill();
      g.restore();
    }
  }

  function drawWalkers(g, fg, T) {
    for (var i = 0; i < walkers.length; i++) {
      var w = walkers[i];
      if (!!w.fg !== fg) continue;
      person(g, w.x, w.y, w.sc, {
        skin: fg ? '#060911' : w.skin, cloth: fg ? '#060911' : w.cloth,
        pants: fg ? '#060911' : w.pants, hair: fg ? '#060911' : w.hair,
        scarf: fg ? null : w.scarf, hat: fg ? null : w.hat, bag: !fg && w.bag,
        t: w.t, walk: 1, flip: w.dir < 0,
        rim: fg ? 0 : .35 * NF, shadow: !fg
      });
    }
  }
  function drawVehicles(g, T) {
    for (var i = 0; i < vehicles.length; i++) {
      var v = vehicles[i];
      g.save();
      g.translate(v.x, v.y);
      g.scale(v.dir, 1);
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .34;
      g.drawImage(glowSprite, -66, -78, 230, 130); g.restore();
      if (v.kind === 'bike') drawBike(g, T);
      else if (v.kind === 'van') drawVan(g, T);
      else drawTruck(g, T);
      g.restore();
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .13;
      g.drawImage(glowSprite, v.x - 130, v.y - 24, 260, 70); g.restore();
    }
  }

  /* ═════════ کارکنان و صاحب ═════════ */
  function drawOwner(g, x, y, T, sc, busy) {
    person(g, x, y, sc, {
      cloth: '#efe5d0', pants: '#2b3244', skin: '#c08d63', hair: '#171c26',
      t: T * 4.5, walk: 0,
      arm: busy ? Math.sin(T * 7) * 5 - 4 : 0,
      arm2: busy ? Math.sin(T * 7 + 2) * 4 - 2 : 0,
      rim: .6 * NF
    });
    g.save(); g.translate(x, y); g.scale(sc, sc);
    g.fillStyle = '#ded2b8'; rr(g, -5, -24, 10, 13, 2); g.fill();
    g.restore();
  }
  function drawCrew(g, T, W) {
    var total = W.crew, n = Math.min(8, total);
    while (crewLook.length < n) crewLook.push(randomLook());
    var a = lastAnchors;
    if (!a) return;
    for (var i = 0; i < n; i++) {
      var side = i % 2, k = Math.floor(i / 2);
      var x = side ? a.crew[1] - k * 34 : a.crew[0] + k * 34;
      var o = crewLook[i];
      person(g, x, GY + 10, .92, {
        skin: o.skin, cloth: '#e6dcc4', pants: o.pants, hair: o.hair,
        t: T * 3 + i, walk: 0,
        arm: Math.sin(T * 5 + i) * 4 - 3, arm2: Math.sin(T * 5 + i + 1.7) * 3,
        flip: side === 1, rim: .45 * NF
      });
    }
  }

  /* ═════════ چراغ خیابان ═════════ */
  function drawLamp(g, T) {
    var x = Math.round(500 - cam.w / 2 + 42), topY = 108;
    var fl = (.86 + Math.sin(T * 8.7) * .05 + (Math.random() < .006 ? -.38 : 0)) * NF;
    var gr = g.createLinearGradient(x - 4, 0, x + 4, 0);
    gr.addColorStop(0, '#161c26'); gr.addColorStop(.5, '#2c3542'); gr.addColorStop(1, '#131821');
    g.fillStyle = gr; g.fillRect(x - 3.5, topY, 7, GY - topY + 5);
    g.fillStyle = '#1a212c'; rr(g, x - 8, GY - 4, 16, 8, 2); g.fill();
    g.beginPath(); g.moveTo(x, topY + 8); g.quadraticCurveTo(x + 28, topY - 8, x + 48, topY + 6);
    g.strokeStyle = '#232b37'; g.lineWidth = 6; g.stroke();
    g.fillStyle = '#2a323f';
    g.beginPath(); g.moveTo(x + 33, topY + 4); g.lineTo(x + 62, topY + 4);
    g.lineTo(x + 56, topY + 14); g.lineTo(x + 39, topY + 14); g.closePath(); g.fill();
    g.save(); g.globalCompositeOperation = 'lighter';
    var cone = g.createLinearGradient(0, topY + 13, 0, GY + 46);
    cone.addColorStop(0, 'rgba(255,194,116,' + (.20 * fl) + ')');
    cone.addColorStop(.6, 'rgba(255,176,96,' + (.07 * fl) + ')');
    cone.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = cone;
    g.beginPath(); g.moveTo(x + 40, topY + 14); g.lineTo(x + 57, topY + 14);
    g.lineTo(x + 156, GY + 56); g.lineTo(x - 60, GY + 56); g.closePath(); g.fill();
    g.globalAlpha = .78 * fl; g.drawImage(glowSprite, x + 48 - 74, topY + 14 - 68, 148, 148);
    g.globalAlpha = .3 * fl; g.drawImage(glowSprite, x + 50 - 138, GY - 28, 276, 120);
    g.restore();
    /* پروانه‌های دور چراغ */
    if (!RM) {
      for (var m = 0; m < 3; m++) {
        var mx = x + 48 + Math.sin(T * (1.7 + m * .6) + m * 2) * 26;
        var my = topY + 16 + Math.cos(T * (2.1 + m * .5) + m) * 14;
        g.fillStyle = 'rgba(255,226,178,' + (.25 + .2 * Math.sin(T * 9 + m)) + ')';
        g.fillRect(mx, my, 1.8, 1.4);
      }
    }
  }

  /* ═════════ دود و بخار ═════════ */
  function tickSmoke(dt, W, a) {
    if (RM) return;
    var fac = D.TIERS[W.tier].fac;
    if (!fac.chimneys && !(W.tier >= 4)) return;
    if (Math.random() < dt * 4) {
      var sx = a ? a.steam[0] : 300, sy = a ? a.steam[1] : 200;
      smoke.push({ x: sx + rnd(-16, 16), y: sy, vx: rnd(-8, 14), vy: rnd(-24, -14), r: rnd(12, 22), life: 0, max: rnd(3.4, 5.6) });
    }
    for (var i = smoke.length - 1; i >= 0; i--) {
      var s = smoke[i]; s.life += dt;
      if (s.life > s.max) { smoke.splice(i, 1); continue; }
      s.x += s.vx * dt + Math.sin(s.life) * 5 * dt; s.y += s.vy * dt; s.r += 9 * dt;
    }
  }
  function drawSmoke(g) {
    if (!smoke.length) return;
    g.save();
    for (var i = 0; i < smoke.length; i++) {
      var s = smoke[i];
      g.globalAlpha = Math.sin(s.life / s.max * Math.PI) * .1;
      g.fillStyle = '#8a93a5';
      g.beginPath(); g.arc(s.x, s.y, s.r, 0, 6.3); g.fill();
    }
    g.restore();
  }
  function drawChimneys(g, fac, T) {
    if (!fac.chimneys) return;
    var cx = 500, x = cx - fac.w / 2;
    for (var i = 0; i < fac.chimneys; i++) {
      var chx = x + 40 + i * (fac.w - 80) / (fac.chimneys - 1 || 1);
      var h = 96 + i * 18;
      var gr = g.createLinearGradient(chx - 12, 0, chx + 12, 0);
      gr.addColorStop(0, '#232932'); gr.addColorStop(.5, '#39424f'); gr.addColorStop(1, '#1d222b');
      g.fillStyle = gr; g.fillRect(chx - 11, fac.top - h, 22, h);
      g.fillStyle = '#b8534a'; g.fillRect(chx - 12, fac.top - h, 24, 7);
      g.fillStyle = '#b8534a'; g.fillRect(chx - 12, fac.top - h + 22, 24, 5);
      var f = .5 + Math.sin(T * 3 + i * 2) * .5;
      g.fillStyle = 'rgba(255,110,90,' + (.35 + f * .5) + ')';
      g.beginPath(); g.arc(chx, fac.top - h - 5, 2.6, 0, 6.3); g.fill();
    }
  }

  function tickSteam(dt, W, a) {
    if (RM || !a) return;
    if (W.lvl.stove > 0 && W.tier <= 3) {
      var want = clamp(1 + Math.log10(1 + W.rate) * 1.1, 1, 5);
      if (steam.length < want * 8 && Math.random() < dt * want * 3.2) {
        steam.push({
          x: a.steam[0] + rnd(-10, 10), y: a.steam[1],
          vx: rnd(-6, 6), vy: rnd(-28, -17), r: rnd(5, 12), life: 0, max: rnd(1.6, 2.9)
        });
        if (Math.random() < .04) A.audio.sfx.sizzle();
      }
    }
    for (var i = steam.length - 1; i >= 0; i--) {
      var s = steam[i]; s.life += dt;
      if (s.life > s.max) { steam.splice(i, 1); continue; }
      s.x += s.vx * dt + Math.sin(s.life * 2.4) * 8 * dt;
      s.y += s.vy * dt; s.r += 11 * dt; s.vy *= .995;
    }
  }
  function drawSteam(g) {
    if (!steam.length) return;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (var i = 0; i < steam.length; i++) {
      var s = steam[i];
      g.globalAlpha = Math.sin(s.life / s.max * Math.PI) * .11;
      g.fillStyle = '#dfe8f5';
      g.beginPath(); g.arc(s.x, s.y, s.r, 0, 6.3); g.fill();
    }
    g.restore();
  }

  /* ═════════ هوا ═════════ */
  function tickWeather(dt) {
    var on = isRaining();
    if (on && !RM) {
      var top = -OY / K - 90;
      var count = Math.round(dt * 320);
      for (var i = 0; i < count; i++) {
        drops.push({ x: rnd(-260, VW + 260), y: top + rnd(-90, 0), v: rnd(720, 990), len: rnd(11, 24) });
      }
      if (Math.random() < dt * .12) { flash = .55; A.audio.sfx.thunder(); }
      if (Math.random() < dt * 2.4) A.audio.sfx.rain();
    }
    var bot = (CH - OY) / K + 50;
    for (var j = drops.length - 1; j >= 0; j--) {
      var d = drops[j];
      d.y += d.v * dt; d.x += d.v * .16 * dt;
      if (d.y > bot) {
        drops.splice(j, 1);
        if (Math.random() < .1) {
          var ry = clamp(bot - rnd(0, 90), GY + 4, bot);
          ripples.push({ x: d.x, y: ry, r: 1, life: 0, max: .55 });
        }
      }
    }
    for (var k = ripples.length - 1; k >= 0; k--) {
      var rp = ripples[k]; rp.life += dt; rp.r += 34 * dt;
      if (rp.life > rp.max) ripples.splice(k, 1);
    }
    if (flash > 0) flash = Math.max(0, flash - dt * 2.2);
  }
  function drawRain(g) {
    if (!drops.length) return;
    g.strokeStyle = 'rgba(178,205,240,.26)'; g.lineWidth = 1.2;
    g.beginPath();
    for (var i = 0; i < drops.length; i++) {
      var d = drops[i];
      g.moveTo(d.x, d.y); g.lineTo(d.x - d.len * .16, d.y - d.len);
    }
    g.stroke();
  }
  function drawRipples(g) {
    if (!ripples.length) return;
    g.strokeStyle = 'rgba(190,214,246,.3)';
    for (var i = 0; i < ripples.length; i++) {
      var r = ripples[i];
      g.globalAlpha = (1 - r.life / r.max) * .5;
      g.lineWidth = 1;
      g.beginPath(); g.ellipse(r.x, r.y, r.r, r.r * .3, 0, 0, 6.3); g.stroke();
    }
    g.globalAlpha = 1;
  }
  function drawFog(g, T) {
    g.save();
    g.globalAlpha = .05;
    for (var i = 0; i < 3; i++) {
      var y = GY - 40 + i * 46;
      var xo = ((T * (6 + i * 4)) % (VW + 700)) - 350;
      var gr = g.createLinearGradient(xo - 320, 0, xo + 320, 0);
      gr.addColorStop(0, 'rgba(150,175,210,0)');
      gr.addColorStop(.5, 'rgba(150,175,210,1)');
      gr.addColorStop(1, 'rgba(150,175,210,0)');
      g.fillStyle = gr;
      g.fillRect(xo - 320, y, 640, 40);
    }
    g.restore();
  }

  /* گودال‌ها: نور را برمی‌گردانند */
  function drawPuddles(g, T) {
    var wet = isRaining() ? 1 : .45;
    g.save();
    for (var i = 0; i < PUDDLES.length; i++) {
      var p = PUDDLES[i];
      g.globalAlpha = .16 * wet;
      g.fillStyle = '#2a3648';
      g.beginPath(); g.ellipse(p.x, p.y, p.w / 2, p.h / 2, 0, 0, 6.3); g.fill();
      g.save();
      g.beginPath(); g.ellipse(p.x, p.y, p.w / 2, p.h / 2, 0, 0, 6.3); g.clip();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = .11 * wet * NF;
      g.drawImage(glowSprite, p.x - p.w * .42, p.y - p.h * 2.2, p.w * .84, p.h * 3.6);
      g.restore();
      g.globalAlpha = .1 * wet;
      g.strokeStyle = '#4a5a72'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(p.x, p.y, p.w / 2, p.h / 2, 0, 0, 6.3); g.stroke();
    }
    g.restore();
  }

  /* بازتاب نما روی آسفالت خیس */
  /* بازتاب فشرده — مثل آسفالت خیس، نه آینه‌ی کامل */
  var REF_SQUASH = .38;
  function drawReflection(g, fac, T, W) {
    g.save();
    g.beginPath(); g.rect(BX0, GY + 3, BW, 150); g.clip();
    g.globalAlpha = .17;
    g.translate(0, GY * (1 + REF_SQUASH) + 4);
    g.scale(1, -REF_SQUASH);
    if (supportsFilter) g.filter = 'blur(1.2px)';
    drawFacade(g, fac, T, W, true);
    g.filter = 'none';
    g.restore();
    /* محو شدن نرم بدون لبه‌ی تیز */
    var fade = g.createLinearGradient(0, GY + 3, 0, GY + 125);
    fade.addColorStop(0, 'rgba(14,18,26,0)');
    fade.addColorStop(.38, 'rgba(13,17,24,.62)');
    fade.addColorStop(.74, 'rgba(11,14,20,.92)');
    fade.addColorStop(1, 'rgba(10,13,18,1)');
    g.fillStyle = fade; g.fillRect(BX0, GY + 3, BW, 122);
  }

  /* ═════════ ذرات عمومی ═════════ */
  function tickParticles(dt) {
    for (var i = coins.length - 1; i >= 0; i--) {
      var c = coins[i]; c.life += dt;
      if (c.life > c.max) { coins.splice(i, 1); continue; }
      c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 92 * dt; c.rot += dt * 7;
      c.tr -= dt;
      if (c.tr <= 0 && !RM) {
        c.tr = .05;
        sparks.push({ x: c.x, y: c.y, vx: rnd(-6, 6), vy: rnd(-6, 6), life: 0, max: .32, col: 'rgba(255,222,160,.85)' });
      }
    }
    for (var j = floats.length - 1; j >= 0; j--) {
      var f = floats[j]; f.life += dt;
      if (f.life > f.max) { floats.splice(j, 1); continue; }
      f.y += f.vy * dt; f.vy *= .985;
    }
    for (var k = sparks.length - 1; k >= 0; k--) {
      var s = sparks[k]; s.life += dt;
      if (s.life > s.max) { sparks.splice(k, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 130 * dt;
    }
  }
  function drawParticles(g) {
    for (var i = 0; i < coins.length; i++) {
      var c = coins[i];
      g.save();
      g.globalAlpha = 1 - Math.max(0, (c.life - c.max * .6) / (c.max * .4));
      g.translate(c.x, c.y);
      g.scale(Math.max(.16, Math.abs(Math.cos(c.rot))), 1);
      g.fillStyle = '#f3c766'; g.beginPath(); g.arc(0, 0, 6, 0, 6.3); g.fill();
      g.fillStyle = '#ffe9b0'; g.beginPath(); g.arc(-1.4, -1.6, 2.2, 0, 6.3); g.fill();
      g.fillStyle = '#d9a534'; g.beginPath(); g.arc(0, 0, 3.4, 0, 6.3); g.fill();
      g.restore();
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (var j = 0; j < floats.length; j++) {
      var f = floats[j];
      g.save();
      g.globalAlpha = 1 - f.life / f.max;
      g.font = '800 ' + Math.round(16 * (f.sc || 1)) + 'px ' + FONT;
      g.fillStyle = f.col;
      g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 7;
      g.fillText(f.txt, f.x, f.y);
      g.restore();
    }
    for (var k = 0; k < sparks.length; k++) {
      var s = sparks[k];
      g.globalAlpha = 1 - s.life / s.max;
      g.fillStyle = s.col;
      g.fillRect(s.x, s.y, 2.7, 2.7);
    }
    g.globalAlpha = 1;
  }

  /* ═════════ آماده‌سازی ═════════ */
  function init(canvas) {
    cv = canvas;
    ctx = cv.getContext('2d', { alpha: false });
    supportsFilter = (function () {
      try {
        var t = off(4, 4).getContext('2d');
        t.filter = 'blur(1px)';
        return t.filter === 'blur(1px)';
      } catch (e) { return false; }
    })();
    FONT = getComputedStyle(document.body).fontFamily || 'sans-serif';
    buildGlow();
    buildGrain();
    buildBackdrop();
    resize();
  }

  function resize() {
    if (!cv) return;
    var r = cv.getBoundingClientRect();
    DPR = Math.min(2, window.devicePixelRatio || 1);
    CW = Math.max(1, Math.round(r.width));
    CH = Math.max(1, Math.round(r.height));
    cv.width = Math.round(CW * DPR);
    cv.height = Math.round(CH * DPR);

    frameBuf = off(cv.width, cv.height);
    fctx = frameBuf.getContext('2d', { alpha: false });
    blurBuf = off(Math.max(1, Math.round(cv.width / 4)), Math.max(1, Math.round(cv.height / 4)));
    bctx = blurBuf.getContext('2d');

    vign = ctx.createRadialGradient(CW / 2, CH * .42, Math.min(CW, CH) * .16, CW / 2, CH * .5, Math.max(CW, CH) * .82);
    vign.addColorStop(0, 'rgba(0,0,0,0)');
    vign.addColorStop(.56, 'rgba(0,0,0,.28)');
    vign.addColorStop(1, 'rgba(0,0,0,.82)');

    gradeGrad = ctx.createLinearGradient(0, 0, 0, CH);
    gradeGrad.addColorStop(0, 'rgba(70,104,168,.30)');
    gradeGrad.addColorStop(.45, 'rgba(40,52,80,.10)');
    gradeGrad.addColorStop(1, 'rgba(150,96,46,.26)');
  }

  function camera(dt) {
    var k = Math.min(1, dt * 1.7);
    cam.w += (camT.w - cam.w) * k;
    cam.h += (camT.h - cam.h) * k;
    cam.y += (camT.y - cam.y) * k;
    punchV = Math.max(0, punchV - dt * 2.6);
    var zoom = 1 + punchV * punchV * .045;
    K = Math.min(CW / cam.w, CH / cam.h) * zoom;
    drift += dt;
    var dx = RM ? 0 : Math.sin(drift * .21) * 5;
    var dy = RM ? 0 : Math.cos(drift * .17) * 3.5;
    OX = CW / 2 - (500 + dx) * K;
    OY = CH / 2 - (cam.y + dy) * K;
  }

  function dayNight(dt) {
    cycleT = (cycleT + dt) % CYCLE;
    var p = cycleT / CYCLE;
    var dawn = Math.max(0, Math.sin((p - .60) / .32 * Math.PI));
    if (p < .60 || p > .92) dawn = 0;
    NF = 1 - dawn * .72;
    return dawn;
  }

  function skyWash(g, dawn) {
    if (dawn <= .001) return;
    g.save();
    /* بالا آمدن نور آسمان */
    var lift = g.createLinearGradient(0, BY0, 0, GY);
    lift.addColorStop(0, 'rgba(46,66,112,' + (.30 * dawn) + ')');
    lift.addColorStop(.55, 'rgba(86,104,150,' + (.22 * dawn) + ')');
    lift.addColorStop(.88, 'rgba(196,138,116,' + (.30 * dawn) + ')');
    lift.addColorStop(1, 'rgba(238,168,120,' + (.42 * dawn) + ')');
    g.fillStyle = lift;
    g.fillRect(BX0, BY0, BW, GY - BY0);
    /* تابش افق */
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = .3 * dawn;
    g.drawImage(glowSprite, BX0, GY - 260, BW, 340);
    g.restore();
  }

  function update(dt, T, W) {
    camera(dt);
    dayNight(dt);
    tickCustomers(dt, W);
    tickTraffic(dt, W);
    tickSteam(dt, W, lastAnchors);
    tickSmoke(dt, W, lastAnchors);
    tickParticles(dt);
    tickWeather(dt);
  }

  /* بوکه‌ی پیش‌زمینه در فضای صفحه */
  function drawBokeh(g, T) {
    if (quality < 2) return;
    /* فقط بالای قاب، کم‌رنگ — وگرنه روی آسفالت لکه می‌اندازد */
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 4; i++) {
      var ph = T * (.05 + i * .013) + i * 2.3;
      var bx = (Math.sin(ph) * .5 + .5) * CW;
      var by = CH * (.09 + .10 * i) + Math.cos(ph * 1.3) * 16;
      var r = (26 + i * 11) * (CW / 420);
      g.globalAlpha = .026 + .008 * Math.sin(T + i);
      g.drawImage(glowSprite, bx - r, by - r, r * 2, r * 2);
    }
    g.restore();
  }

  function renderScene(g, T, W, dawn) {
    var sx = 0, sy = 0;
    if (shakeT > 0) {
      shakeT = Math.max(0, shakeT - .016);
      sx = rnd(-1, 1) * shakeP * shakeT * 2.6;
      sy = rnd(-1, 1) * shakeP * shakeT * 2.6;
    }
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.fillStyle = '#02040a';
    g.fillRect(0, 0, CW, CH);
    var groundScreenY = OY + GY * K;
    if (groundScreenY < CH) {
      g.fillStyle = '#06080e';
      g.fillRect(0, groundScreenY, CW, CH - groundScreenY);
    }

    g.save();
    g.translate(OX + sx, OY + sy);
    g.scale(K, K);

    if (backdrop) g.drawImage(backdrop, BX0, BY0, BW, BH);
    skyWash(g, dawn);
    drawBirds(g, T);

    var fac = D.TIERS[W.tier].fac;
    drawChimneys(g, fac, T);
    drawSmoke(g);
    drawLamp(g, T);
    drawPuddles(g, T);
    if (quality >= 2) drawReflection(g, fac, T, W);
    drawWalkers(g, false, T);
    drawCats(g, T);

    lastAnchors = drawFacade(g, fac, T, W, false);

    drawCrew(g, T, W);
    drawOwner(g, lastAnchors.owner[0], lastAnchors.owner[1], T, .88, W.rate > 0);
    drawSteam(g);
    drawCustomers(g, T);
    drawParticles(g);
    drawVehicles(g, T);
    drawRipples(g);
    drawFog(g, T);
    drawWalkers(g, true, T);
    drawRain(g);

    g.restore();
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function render(T, W) {
    if (!ctx) return;
    var t0 = performance.now();
    var dawn = 1 - (NF - .28) / .72;
    dawn = clamp((1 - NF) / .72, 0, 1);

    var useBloom = quality >= 2 && frameBuf;
    var g = useBloom ? fctx : ctx;
    renderScene(g, T, W, dawn);

    if (useBloom) {
      /* بلوم: کوچک، تار، جمع‌شونده */
      bctx.setTransform(1, 0, 0, 1, 0, 0);
      bctx.clearRect(0, 0, blurBuf.width, blurBuf.height);
      if (supportsFilter) bctx.filter = 'blur(4px)';
      bctx.drawImage(frameBuf, 0, 0, blurBuf.width, blurBuf.height);
      bctx.filter = 'none';

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.drawImage(frameBuf, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = .34;
      ctx.drawImage(blurBuf, 0, 0, cv.width, cv.height);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    if (flash > 0) {
      ctx.fillStyle = 'rgba(192,216,255,' + (flash * .2) + ')';
      ctx.fillRect(0, 0, CW, CH);
    }
    drawBokeh(ctx, T);

    /* درجه‌بندی رنگ: سایه‌ی سرد، روشنی گرم */
    if (gradeGrad && quality >= 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = .72;
      ctx.fillStyle = gradeGrad;
      ctx.fillRect(0, 0, CW, CH);
      ctx.restore();
    }

    if (vign) { ctx.fillStyle = vign; ctx.fillRect(0, 0, CW, CH); }
    if (grain && !RM && quality >= 1) {
      ctx.globalAlpha = .04;
      ctx.drawImage(grain, -(Math.random() * 30 | 0), -(Math.random() * 30 | 0), CW + 30, CH + 30);
      ctx.globalAlpha = 1;
    }

    /* کیفیت وفق‌پذیر */
    var ms = performance.now() - t0;
    frameMs = frameMs * .9 + ms * .1;
    if (frameMs > 22) { slowFrames++; fastFrames = 0; } else if (frameMs < 9) { fastFrames++; slowFrames = 0; }
    if (slowFrames > 90 && quality > 0) { quality--; slowFrames = 0; }
    else if (fastFrames > 260 && quality < 2 && !RM) { quality++; fastFrames = 0; }
  }

  function toWorld(clientX, clientY) {
    var r = cv.getBoundingClientRect();
    return { x: (clientX - r.left - OX) / K, y: (clientY - r.top - OY) / K };
  }

  /* ═════════ تصویرک آدم‌ها ═════════ */
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

  function reset() {
    steam.length = 0; coins.length = 0; floats.length = 0;
    sparks.length = 0; drops.length = 0; smoke.length = 0; ripples.length = 0;
    custs.length = 0; walkers.length = 0; vehicles.length = 0;
    birds.length = 0; cats.length = 0; crewLook.length = 0;
    rainUntil = 0; flash = 0;
  }

  A.scene = {
    init: init, resize: resize, update: update, render: render,
    setTier: setTier, snapCamera: snapCamera, punch: punch,
    spawnCoin: spawnCoin, burst: burst, shake: shake, rainFor: rainFor,
    toWorld: toWorld, reset: reset,
    drawAvatar: drawAvatar, drawEventArt: drawEventArt,
    person: person, randomLook: randomLook,
    anchors: function () { return lastAnchors; },
    stats: function () { return { quality: quality, ms: Math.round(frameMs * 10) / 10, night: Math.round(NF * 100) / 100 }; },
    setQuality: function (q) { quality = clamp(q | 0, 0, 2); },
    setCycle: function (v) { cycleT = clamp(v, 0, CYCLE - .01) * CYCLE; }
  };
})(window.ABRO);
