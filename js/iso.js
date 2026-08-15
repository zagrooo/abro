/* ═══════════════════════════════════════════════
   آبرو — موتور ایزومتریک

   نما از بالاست، با زاویه. کف کاشی‌کاری ایزومتریک است و اجسام
   حجم دارند؛ آدم‌ها ولی ایستاده‌اند و رو به بیننده — همان چیزی که
   در بازی‌های این سبک هم می‌بینی. دلیلش ساده است: صورت آدم از
   بالا دیده نمی‌شود و کل حسِ «مغازه‌ی من» از همان آدم‌ها می‌آید.

   قرارداد مختصات:
     کاشی (tx, ty)  →  جهان (wx, wy)  →  صفحه (sx, sy)

     wx = (tx - ty) * TW/2
     wy = (tx + ty) * TH/2

   ترتیب کشیدن بر اساس (tx + ty) است، پس هرچه جلوتر، دیرتر —
   وگرنه اجسام از هم رد می‌شوند.
   ═══════════════════════════════════════════════ */
(function (A) {
  'use strict';

  var U = A.util, D = A.data;
  var clamp = U.clamp, rnd = U.rnd, rr = U.roundRect;

  var TW = 76, TH = 38;          /* عرض و ارتفاع یک کاشی روی صفحه */
  var RM = U.reduceMotion;

  var cv = null, g = null;
  var DPR = 1, CW = 0, CH = 0;
  var K = 1, KT = 1;             /* بزرگ‌نمایی و هدفش */
  var camX = 0, camY = 0;        /* مرکز دوربین در مختصات جهان */
  var panVX = 0, panVY = 0;
  var quality = RM ? 0 : 2;
  var frameMs = 16;

  var tier = 0, layout = null;
  var NF = 1;                    /* چقدر شب است */
  var CF = 1;                    /* مغازه باز است یا بسته */
  var shakeT = 0, shakeP = 0, punchV = 0;
  var cityTint = null;

  /* ───────── تبدیل‌ها ───────── */
  function tileToWorld(tx, ty) {
    return { x: (tx - ty) * TW / 2, y: (tx + ty) * TH / 2 };
  }
  function worldToTile(wx, wy) {
    return { x: (wy / TH + wx / TW), y: (wy / TH - wx / TW) };
  }
  function worldToScreen(wx, wy) {
    return { x: CW / 2 + (wx - camX) * K, y: CH / 2 + (wy - camY) * K };
  }
  function screenToWorld(sx, sy) {
    return { x: (sx - CW / 2) / K + camX, y: (sy - CH / 2) / K + camY };
  }
  /* برای بیرون: همان قرارداد قبلی، تا game.js دست نخورد */
  function toWorld(clientX, clientY) {
    var r = cv.getBoundingClientRect();
    return screenToWorld((clientX - r.left) * 1, (clientY - r.top) * 1);
  }

  function lay() { return layout || D.LAYOUTS[0]; }
  function setTier(t) {
    tier = clamp(t | 0, 0, D.LAYOUTS.length - 1);
    layout = D.LAYOUTS[tier];
    buildCrowdPaths();
    fitCamera();
  }
  function setCityTint(hex) { cityTint = hex || null; }

  /* دوربین وسطِ نقشه می‌نشیند و بزرگ‌نمایی طوری می‌آید که کل مغازه
     در قاب باشد — با یک کف، وگرنه در پرده‌ی دوازدهم همه‌چیز مورچه
     می‌شود و تپ کردن غیرممکن. */
  function fitCamera() {
    var L = lay();
    var c = tileToWorld(L.w / 2, L.h / 2);
    camX = c.x; camY = c.y;
    var wpx = (L.w + L.h) * TW / 2 + 60;
    var hpx = (L.w + L.h) * TH / 2 + 120;
    if (!CW || !CH) { KT = K = 1; return; }
    /* عمداً «همه‌چیز در قاب» نیست: اگر کل نقشه را در گوشیِ عمودی جا
       بدهیم، کاشی‌ها آن‌قدر ریز می‌شوند که تپ کردنشان شکنجه است.
       پس تا جایی نزدیک می‌شویم که بخش‌ها بزرگ بمانند و بازیکن
       بقیه را با انگشت بگردد. */
    KT = clamp(Math.max(CW / wpx, CH / hpx * .82), .5, 1.4);
    K = KT;
  }
  function snapCamera() { fitCamera(); }
  function panBy(dx, dy) {
    if (RM) return;
    panVX += dx / Math.max(.3, K);
    panVY += (dy || 0) / Math.max(.3, K);
  }
  function punch(v) { punchV = Math.max(punchV, v == null ? 1 : v); }
  function shake(p) { shakeT = .34; shakeP = p || 4; }

  /* ───────── ذرات ───────── */
  var coins = [], floats = [], sparks = [], steam = [];
  var CAP = { coins: 24, floats: 16, sparks: 60, steam: 40 };

  function spawnCoin(v, big) {
    if (coins.length >= CAP.coins || RM) return;
    var L = lay(), s = L.spots[1] || L.spots[0];
    var p = tileToWorld(s.x + .5, s.y + .5);
    coins.push({ x: p.x + rnd(-20, 20), y: p.y - 30, vy: rnd(-52, -34), t: 0, life: 1.5, big: !!big, v: v });
  }
  function burst(x, y, n, col) {
    if (RM) return;
    n = Math.min(n || 8, CAP.sparks - sparks.length);
    for (var i = 0; i < n; i++) {
      sparks.push({
        x: x, y: y, vx: rnd(-60, 60), vy: rnd(-90, -20),
        t: 0, life: rnd(.5, 1), col: col || '#ffd68f'
      });
    }
  }
  /* انفجار روی یک بخش — برای وقتی که چیزی ارتقا می‌گیرد */
  function burstAt(id, col) {
    var s = spotOf(id);
    if (!s) return;
    var p = tileToWorld(s.x + s.w / 2, s.y + s.h / 2);
    burst(p.x, p.y - (s.h3 || 20), 14, col);
  }
  function tickParticles(dt) {
    var i;
    for (i = coins.length - 1; i >= 0; i--) {
      var c = coins[i];
      c.t += dt; c.y += c.vy * dt; c.vy += 42 * dt;
      if (c.t > c.life) coins.splice(i, 1);
    }
    for (i = sparks.length - 1; i >= 0; i--) {
      var s = sparks[i];
      s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 150 * dt;
      if (s.t > s.life) sparks.splice(i, 1);
    }
    for (i = floats.length - 1; i >= 0; i--) {
      var f = floats[i];
      f.t += dt; f.y -= 26 * dt;
      if (f.t > 1.2) floats.splice(i, 1);
    }
    for (i = steam.length - 1; i >= 0; i--) {
      var st = steam[i];
      st.t += dt; st.y -= 18 * dt; st.r += 9 * dt;
      if (st.t > st.life) steam.splice(i, 1);
    }
  }
  function puffSteam(wx, wy) {
    if (steam.length >= CAP.steam || RM) return;
    steam.push({ x: wx + rnd(-6, 6), y: wy, r: rnd(5, 9), t: 0, life: rnd(1.4, 2.2) });
  }

  /* ═══════════════════════════════════════════════
     رفت‌وآمد

     هر مشتری یک قصه‌ی کوتاه دارد: از در می‌آید، توی صف می‌ایستد،
     سرِ پیشخوان سفارش می‌دهد، اگر میز خالی باشد می‌نشیند و
     می‌خورد، بعد می‌رود. همین چند حالت کافی است تا مغازه زنده
     به نظر برسد؛ بیشتر از این فقط CPU می‌خورد.

     حالت‌ها: walk → queue → order → seat → leave
     ═══════════════════════════════════════════════ */
  var crowd = [], spawnAcc = 0, gift = null, giftT = 20;
  var doorT = null, queueT = [], seatsT = [];

  function buildCrowdPaths() {
    var L = lay();
    var d = L.door || { x: (L.w / 2) | 0, y: L.h - 1 };
    doorT = { x: d.x + .5, y: d.y + .5 };
    var cs = L.spots.filter(function (s) { return s.id === 'counter'; })[0] || L.spots[0];
    /* صف: شش جای پشت سر هم، جلوی پیشخوان */
    queueT = [];
    var qx = cs.x + cs.w / 2, qy = cs.y + cs.h + .55;
    for (var i = 0; i < 6; i++) queueT.push({ x: qx - i * .1, y: qy + i * .78 });
    /* میزها: هر تزیینِ «میز» یک جای نشستن است */
    seatsT = (L.decor || []).filter(function (dd) { return dd.k === 'table'; })
      .map(function (dd) { return { x: dd.x + .5, y: dd.y + 1.05, busy: null }; });
    crowd.length = 0;
  }

  function freeQueueSlot() {
    for (var i = 0; i < queueT.length; i++) {
      var taken = false;
      for (var j = 0; j < crowd.length; j++) {
        if (crowd[j].slot === i) { taken = true; break; }
      }
      if (!taken) return i;
    }
    return -1;
  }
  function freeSeat() {
    for (var i = 0; i < seatsT.length; i++) {
      var taken = false;
      for (var j = 0; j < crowd.length; j++) {
        if (crowd[j].seat === i) { taken = true; break; }
      }
      if (!taken) return i;
    }
    return -1;
  }

  function spawnPerson() {
    if (!doorT) return;
    var slot = freeQueueSlot();
    if (slot < 0) return;                 /* صف پر است، بیرون بماند */
    crowd.push({
      x: doorT.x + rnd(-.4, .4), y: doorT.y + rnd(-.2, .2),
      tx: queueT[slot].x, ty: queueT[slot].y,
      state: 'queue', slot: slot, seat: -1,
      speed: rnd(1.5, 2.4), wait: 0, phase: rnd(0, 6.3),
      look: A.scene && A.scene.randomLook ? A.scene.randomLook() : {},
      dish: null, gift: 0, mood: rnd(0, 1)
    });
  }

  /* یک قدم به سمت هدف. برمی‌گرداند که رسید یا نه. */
  function step(c, dt) {
    var dx = c.tx - c.x, dy = c.ty - c.y;
    var d = Math.hypot(dx, dy);
    if (d < .06) { c.x = c.tx; c.y = c.ty; return true; }
    var v = Math.min(d, c.speed * dt);
    c.x += dx / d * v;
    c.y += dy / d * v;
    return false;
  }

  function tickCrowd(dt, W) {
    if (!doorT) buildCrowdPaths();
    var want = W.closed ? 0 : clamp(4 + Math.log10(Math.max(1, W.rate)) * 4.5, 4,
      quality >= 2 ? 30 : (quality >= 1 ? 16 : 8));
    spawnAcc += dt * (W.closed ? 0 : 2.2);
    while (spawnAcc >= 1) {
      spawnAcc -= 1;
      if (crowd.length < want) spawnPerson();
    }

    for (var i = crowd.length - 1; i >= 0; i--) {
      var c = crowd[i];
      if (c.wait > 0) { c.wait -= dt; continue; }

      if (c.state === 'queue') {
        /* اگر جلوتر جا باز شد، صف جلو می‌رود */
        var ahead = freeQueueSlot();
        if (ahead >= 0 && ahead < c.slot) {
          c.slot = ahead;
          c.tx = queueT[ahead].x; c.ty = queueT[ahead].y;
        }
        if (step(c, dt) && c.slot === 0) {
          c.state = 'order';
          c.wait = rnd(.7, 1.6);
          c.dish = pickDish();
        }
      } else if (c.state === 'order') {
        c.slot = -1;
        var seat = seatsT.length ? freeSeat() : -1;
        if (seat >= 0 && Math.random() < .6) {
          c.state = 'seat'; c.seat = seat;
          c.tx = seatsT[seat].x; c.ty = seatsT[seat].y;
        } else {
          c.state = 'leave';
          c.tx = doorT.x + rnd(-.5, .5); c.ty = doorT.y + 1.4;
        }
      } else if (c.state === 'seat') {
        if (step(c, dt)) {
          c.wait = rnd(4, 9);
          c.state = 'eat';
        }
      } else if (c.state === 'eat') {
        c.state = 'leave'; c.seat = -1;
        c.tx = doorT.x + rnd(-.5, .5); c.ty = doorT.y + 1.4;
      } else if (c.state === 'leave') {
        if (step(c, dt)) crowd.splice(i, 1);
      }
    }

    /* کادوی خیابانی روی یکی از مشتری‌ها */
    giftT -= dt;
    if (giftT <= 0 && !gift && crowd.length && !W.closed) {
      giftT = rnd(26, 52);
      var pick = crowd[(Math.random() * crowd.length) | 0];
      pick.gift = 1;
      gift = pick;
    }
    if (gift && crowd.indexOf(gift) < 0) gift = null;
  }

  /* غذایی که سفارش می‌دهد از منوی خودِ بازیکن می‌آید */
  function pickDish() {
    if (!A.state || !A.state.menuList) return null;
    var m = A.state.menuList();
    if (!m.length) return null;
    return A.state.menuDish(m[(Math.random() * m.length) | 0]);
  }

  function crowdPos(c) { return { tx: c.x, ty: c.y }; }

  /* ───────── بخش‌های لمسی ───────── */
  var hotOn = [];
  function setHotStations(ids) { hotOn = ids || []; }
  function spotOf(id) {
    var L = lay();
    for (var i = 0; i < L.spots.length; i++) if (L.spots[i].id === id) return L.spots[i];
    return null;
  }
  function spotIds() { return lay().spots.map(function (s) { return s.id; }); }

  /* تپ: از صفحه به کاشی، بعد کاشی به بخش. چون اجسام حجم دارند،
     نقطه‌ی لمس را کمی پایین‌تر می‌گیریم تا «بالای جسم» هم بگیرد. */
  function hitStation(wx, wy) {
    var L = lay();
    var cand = null, best = 1e9;
    for (var i = 0; i < L.spots.length; i++) {
      var s = L.spots[i];
      var c = tileToWorld(s.x + s.w / 2, s.y + s.h / 2);
      var top = c.y - (s.h3 || 20) * .5;
      var rx = (s.w + s.h) * TW / 4 + 10;
      var ry = (s.w + s.h) * TH / 4 + (s.h3 || 20) * .5 + 8;
      var ddx = (wx - c.x) / rx, ddy = (wy - top) / ry;
      var d = ddx * ddx + ddy * ddy;
      if (d <= 1 && d < best) { best = d; cand = s.id; }
    }
    return cand;
  }
  function hitGift(wx, wy) {
    if (!gift) return null;
    var w = tileToWorld(gift.x, gift.y);
    var d = Math.hypot(wx - w.x, wy - (w.y - 46));
    return d < 42 ? gift : null;
  }
  function takeGift(o) {
    if (!o) return;
    var w = tileToWorld(o.x, o.y);
    o.gift = 0;
    if (gift === o) gift = null;
    burst(w.x, w.y - 40, 16, '#ffd68f');
    burst(w.x, w.y - 40, 9, '#9ff0b4');
  }
  function hasGift() { return !!gift; }

  /* ───────── کشیدن ───────── */
  function diamond(x, y, w, h) {
    g.beginPath();
    g.moveTo(x, y - h / 2);
    g.lineTo(x + w / 2, y);
    g.lineTo(x, y + h / 2);
    g.lineTo(x - w / 2, y);
    g.closePath();
  }

  function drawFloor() {
    var L = lay(), F = D.FLOORS[L.floor] || D.FLOORS.tile;
    for (var ty = 0; ty < L.h; ty++) {
      for (var tx = 0; tx < L.w; tx++) {
        var w = tileToWorld(tx + .5, ty + .5);
        var s = worldToScreen(w.x, w.y);
        if (s.x < -TW * K || s.x > CW + TW * K || s.y < -TH * K * 2 || s.y > CH + TH * K * 2) continue;
        g.fillStyle = ((tx + ty) & 1) ? F.a : F.b;
        diamond(s.x, s.y, TW * K, TH * K);
        g.fill();
        if (quality >= 1) {
          g.strokeStyle = F.line;
          g.lineWidth = 1;
          g.stroke();
        }
      }
    }
    /* لبه‌ی بیرونی زمین، تا کف در هوا شناور نباشد */
    var c0 = worldToScreen(tileToWorld(0, 0).x, tileToWorld(0, 0).y);
    var c1 = worldToScreen(tileToWorld(L.w, 0).x, tileToWorld(L.w, 0).y);
    var c2 = worldToScreen(tileToWorld(L.w, L.h).x, tileToWorld(L.w, L.h).y);
    var c3 = worldToScreen(tileToWorld(0, L.h).x, tileToWorld(0, L.h).y);
    g.save();
    g.strokeStyle = 'rgba(233,185,106,.20)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(c0.x, c0.y - TH * K / 2); g.lineTo(c1.x, c1.y - TH * K / 2);
    g.lineTo(c2.x, c2.y - TH * K / 2); g.lineTo(c3.x, c3.y - TH * K / 2);
    g.closePath(); g.stroke();
    /* ضخامت زمین */
    g.fillStyle = '#12161f';
    g.beginPath();
    g.moveTo(c3.x, c3.y - TH * K / 2);
    g.lineTo(c2.x, c2.y - TH * K / 2);
    g.lineTo(c2.x, c2.y - TH * K / 2 + 14 * K);
    g.lineTo(c3.x, c3.y - TH * K / 2 + 14 * K);
    g.closePath(); g.fill();
    g.restore();
  }

  /* یک جعبه‌ی ایزومتریک: رویه + دو وجه کناری */
  function isoBox(cx, cy, wTiles, hTiles, height, top, left, right) {
    var w = (wTiles + hTiles) * TW / 2 * K;
    var hh = (wTiles + hTiles) * TH / 2 * K;
    var H = height * K;
    /* وجه چپ */
    g.fillStyle = left;
    g.beginPath();
    g.moveTo(cx - w / 2, cy);
    g.lineTo(cx, cy + hh / 2);
    g.lineTo(cx, cy + hh / 2 - H);
    g.lineTo(cx - w / 2, cy - H);
    g.closePath(); g.fill();
    /* وجه راست */
    g.fillStyle = right;
    g.beginPath();
    g.moveTo(cx + w / 2, cy);
    g.lineTo(cx, cy + hh / 2);
    g.lineTo(cx, cy + hh / 2 - H);
    g.lineTo(cx + w / 2, cy - H);
    g.closePath(); g.fill();
    /* رویه */
    g.fillStyle = top;
    g.beginPath();
    g.moveTo(cx, cy - hh / 2 - H);
    g.lineTo(cx + w / 2, cy - H);
    g.lineTo(cx, cy + hh / 2 - H);
    g.lineTo(cx - w / 2, cy - H);
    g.closePath(); g.fill();
  }

  var FONT = 'Vazirmatn, sans-serif';

  /* ═══════════════════════════════════════════════
     اجسام واقعی

     هر بخش دیگر یک جعبه‌ی رنگی نیست: اجاق دیگ و شعله و هود دارد،
     پیشخوان ویترین و صندوق، پیک موتور، آشپزخانه میز کار و قفسه.
     همه از همان جعبه‌ی ایزومتریک ساخته می‌شوند تا نور و سایه‌شان
     یک زبان داشته باشد.

     پالت هر بخش: [رویه، وجه چپ، وجه راست، لهجه]
     ═══════════════════════════════════════════════ */
  var PAL = {
    stove: ['#c98a4e', '#6b4223', '#8f5a30', '#ffb45c'],
    counter: ['#5f92cc', '#2f4f78', '#3f6a9c', '#ffe0a0'],
    peyk: ['#54a377', '#2c5c45', '#3b7a5b', '#a8ffc4'],
    kitchen: ['#9b74b8', '#4f3466', '#6d4a86', '#e2c4ff'],
    brand: ['#f0c274', '#96703c', '#c19553', '#fff3d4'],
    storage: ['#8a93a6', '#454c5c', '#5f677a', '#d5dded'],
    packing: ['#5f96c9', '#31506f', '#436e97', '#a8dcff'],
    fleet: ['#b58652', '#5f452c', '#82603c', '#ffd8a0'],
    catering: ['#c47088', '#6b3c4b', '#94566a', '#ffc9d8'],
    academy: ['#5fa8c2', '#356070', '#48839c', '#b8ecff'],
    franchise: ['#adad66', '#5f5f38', '#82824c', '#f5f5b8'],
    office: ['#7f7fc2', '#454570', '#5f5f96', '#d0d0ff']
  };
  function pal(id) { return PAL[id] || PAL.storage; }

  /* استوانه‌ی ایزومتریک — دیگ، بشکه، سطل */
  function isoCyl(cx, cy, rTiles, height, top, side) {
    var rx = rTiles * TW / 2 * K, ry = rTiles * TH / 2 * K, H = height * K;
    g.fillStyle = side;
    g.beginPath();
    g.moveTo(cx - rx, cy - H);
    g.lineTo(cx - rx, cy);
    g.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true);
    g.lineTo(cx + rx, cy - H);
    g.closePath(); g.fill();
    g.fillStyle = top;
    g.beginPath(); g.ellipse(cx, cy - H, rx, ry, 0, 0, 6.3); g.fill();
  }

  /* شعله‌ی زنده */
  function flame(cx, cy, sc, T, seed) {
    var f = .72 + Math.sin(T * 9 + seed) * .28;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = .85 * CF;
    var grd = g.createRadialGradient(cx, cy, 0, cx, cy, 16 * sc * f);
    grd.addColorStop(0, 'rgba(255,236,180,.95)');
    grd.addColorStop(.42, 'rgba(255,150,60,.55)');
    grd.addColorStop(1, 'rgba(255,110,30,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(cx, cy, 16 * sc * f, 0, 6.3); g.fill();
    g.restore();
  }

  /* پنجره‌های روشن روی یک وجه */
  function windows(cx, cy, w, h, cols, rows, col) {
    g.save();
    g.fillStyle = col;
    for (var i = 0; i < cols; i++) {
      for (var j = 0; j < rows; j++) {
        if (((i * 7 + j * 13) % 5) < 2) continue;   /* بعضی پنجره‌ها خاموش */
        g.globalAlpha = (.28 + ((i + j) % 3) * .2) * (NF * .9 + .1);
        g.fillRect(cx + i * w * 1.7, cy + j * h * 2.1, w, h);
      }
    }
    g.restore();
  }

  /* ───────── خودِ بخش‌ها ───────── */
  function propStove(p, s, lvl, T) {
    var P = pal('stove');
    isoBox(p.x, p.y, s.w, s.h, 20, P[0], P[1], P[2]);
    var top = p.y - 20 * K;
    isoBox(p.x, top - 26 * K, s.w * .8, s.h * .8, 8, '#39424f', '#232a35', '#2c343f');
    var pots = Math.min(3, 1 + Math.floor(lvl / 8));
    for (var i = 0; i < pots; i++) {
      var dx = (i - (pots - 1) / 2) * 20 * K;
      isoCyl(p.x + dx, top + 4 * K, .34, 11, '#9aa4b2', '#6e7885');
      if (CF > .5) flame(p.x + dx, top + 7 * K, .5, T, i * 2.1);
    }
    if (CF > .5 && quality >= 1 && Math.random() < .08) {
      var w = tileToWorld(s.x + s.w / 2, s.y + s.h / 2);
      puffSteam(w.x, w.y - 26);
    }
  }

  function propCounter(p, s, lvl, T) {
    var P = pal('counter');
    isoBox(p.x, p.y, s.w, s.h, 14, P[0], P[1], P[2]);
    var top = p.y - 14 * K;
    g.save();
    g.globalAlpha = .55;
    isoBox(p.x, top, s.w * .92, s.h * .5, 12, 'rgba(180,220,255,.5)', 'rgba(90,140,190,.5)', 'rgba(110,160,210,.5)');
    g.restore();
    isoBox(p.x + 22 * K, top - 2 * K, .5, .5, 9, '#c9ccd4', '#7f838c', '#9aa0aa');
    if (CF > .5) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = .26 + Math.sin(T * 2) * .08;
      g.fillStyle = 'rgba(255,214,143,.5)';
      g.beginPath(); g.ellipse(p.x, top + 2 * K, 46 * K, 20 * K, 0, 0, 6.3); g.fill();
      g.restore();
    }
  }

  function propPeyk(p, s, lvl, T) {
    var P = pal('peyk');
    isoBox(p.x, p.y, s.w, s.h, 5, P[0], P[1], P[2]);
    var y = p.y - 5 * K;
    g.fillStyle = '#11151d';
    g.beginPath(); g.ellipse(p.x - 16 * K, y, 7 * K, 4 * K, 0, 0, 6.3); g.fill();
    g.beginPath(); g.ellipse(p.x + 16 * K, y, 7 * K, 4 * K, 0, 0, 6.3); g.fill();
    g.fillStyle = '#8c2f28';
    rr(g, p.x - 14 * K, y - 16 * K, 30 * K, 10 * K, 3 * K); g.fill();
    isoBox(p.x - 16 * K, y - 14 * K, .42, .42, 14, '#c8873c', '#7d5322', '#9a672b');
    g.strokeStyle = '#39424f'; g.lineWidth = 2 * K;
    g.beginPath(); g.moveTo(p.x + 12 * K, y - 6 * K); g.lineTo(p.x + 20 * K, y - 18 * K); g.stroke();
  }

  function propKitchen(p, s, lvl, T) {
    var P = pal('kitchen');
    isoBox(p.x, p.y, s.w, s.h, 16, P[0], P[1], P[2]);
    var top = p.y - 16 * K;
    isoBox(p.x - 14 * K, top - 4 * K, s.w * .42, s.h * .42, 12, '#b9c0cb', '#767c86', '#8f959f');
    isoBox(p.x + 16 * K, top - 8 * K, s.w * .34, s.h * .34, 22, '#4a3f5a', '#2c2438', '#372e46');
    if (CF > .5 && quality >= 1 && Math.random() < .04) {
      var w = tileToWorld(s.x + s.w / 2, s.y + s.h / 2);
      puffSteam(w.x, w.y - 22);
    }
  }

  function propBrand(p, s, lvl, T) {
    var P = pal('brand');
    isoBox(p.x, p.y, s.w * .5, s.h * .5, 10, P[1], P[1], P[2]);
    g.fillStyle = '#39424f';
    g.fillRect(p.x - 3 * K, p.y - 52 * K, 6 * K, 44 * K);
    var sw = 74 * K, sh = 30 * K, sy = p.y - 84 * K;
    g.fillStyle = 'rgba(16,12,8,.94)';
    rr(g, p.x - sw / 2, sy, sw, sh, 6 * K); g.fill();
    g.strokeStyle = 'rgba(233,185,106,' + (.35 + .3 * CF) + ')';
    g.lineWidth = 2 * K;
    rr(g, p.x - sw / 2, sy, sw, sh, 6 * K); g.stroke();
    var nm = (A.state && A.state.shopName) ? A.state.shopName() : 'آبرو';
    g.fillStyle = 'rgba(255,236,190,' + (.55 + .45 * CF) + ')';
    g.font = '800 ' + Math.round(13 * K) + 'px ' + FONT;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(nm.slice(0, 14), p.x, sy + sh / 2);
    if (CF > .5) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = .2 + Math.sin(T * 1.7) * .06;
      g.fillStyle = 'rgba(255,206,140,.6)';
      g.beginPath(); g.ellipse(p.x, sy + sh / 2, sw * .8, sh * 1.4, 0, 0, 6.3); g.fill();
      g.restore();
    }
  }

  function propStorage(p, s, lvl, T) {
    var P = pal('storage');
    isoBox(p.x, p.y, s.w, s.h, 12, P[0], P[1], P[2]);
    var top = p.y - 12 * K;
    var rows = Math.min(3, 1 + Math.floor(lvl / 7));
    for (var r = 0; r < rows; r++) {
      isoBox(p.x, top - r * 13 * K, s.w * .8, s.h * .8, 11, '#6a4d2e', '#412c18', '#553a20');
    }
  }

  function propPacking(p, s, lvl, T) {
    var P = pal('packing');
    isoBox(p.x, p.y, s.w, s.h, 10, P[0], P[1], P[2]);
    var top = p.y - 10 * K;
    var half = (s.w + s.h) * TW / 4 * K;
    for (var i = 0; i < 4; i++) {
      var t = ((T * .25 + i / 4) % 1);
      var bx = p.x - half + t * half * 2;
      var by = top - 8 * K + (t - .5) * (s.w + s.h) * TH / 4 * K;
      isoBox(bx, by, .3, .3, 9, '#c9a05e', '#7d6234', '#9a7942');
    }
  }

  function propFleet(p, s, lvl, T) {
    var P = pal('fleet');
    isoBox(p.x, p.y, s.w, s.h, 4, P[1], P[1], P[2]);
    var y = p.y - 4 * K;
    isoBox(p.x, y - 4 * K, s.w * .7, s.h * .7, 20, '#e8e4dc', '#9a968e', '#b6b2aa');
    isoBox(p.x - 18 * K, y - 4 * K, s.w * .3, s.h * .3, 14, '#cfd4dc', '#8a8f97', '#a4a9b1');
    g.fillStyle = '#11151d';
    g.beginPath(); g.ellipse(p.x - 12 * K, y + 2 * K, 6 * K, 3.4 * K, 0, 0, 6.3); g.fill();
    g.beginPath(); g.ellipse(p.x + 14 * K, y + 2 * K, 6 * K, 3.4 * K, 0, 0, 6.3); g.fill();
  }

  function propCatering(p, s, lvl, T) {
    var P = pal('catering');
    isoBox(p.x, p.y, s.w, s.h, 6, P[1], P[1], P[2]);
    isoBox(p.x, p.y - 6 * K, s.w * .86, s.h * .86, 16, '#efe5d0', '#a99f8c', '#c4baa5');
    var top = p.y - 22 * K;
    for (var i = 0; i < 4; i++) {
      var dx = (i - 1.5) * 15 * K;
      isoCyl(p.x + dx, top + 3 * K, .22, 6, '#d9c9a8', '#a08c66');
    }
  }

  function propAcademy(p, s, lvl, T) {
    var P = pal('academy');
    isoBox(p.x, p.y, s.w, s.h, 22, P[0], P[1], P[2]);
    var top = p.y - 22 * K;
    g.fillStyle = '#1d3a33';
    rr(g, p.x - 24 * K, top - 26 * K, 48 * K, 20 * K, 2 * K); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1.2 * K;
    g.beginPath(); g.moveTo(p.x - 18 * K, top - 18 * K); g.lineTo(p.x + 6 * K, top - 18 * K); g.stroke();
    g.beginPath(); g.moveTo(p.x - 18 * K, top - 13 * K); g.lineTo(p.x + 14 * K, top - 13 * K); g.stroke();
    for (var i = 0; i < 3; i++) isoBox(p.x + (i - 1) * 18 * K, top + 6 * K, .34, .34, 8, '#6a5238', '#3f3021', '#503d2a');
  }

  function propFranchise(p, s, lvl, T) {
    var P = pal('franchise');
    isoBox(p.x, p.y, s.w, s.h, 18, P[0], P[1], P[2]);
    var top = p.y - 18 * K;
    var w = (s.w + s.h) * TW / 2 * K * .9;
    for (var i = 0; i < 6; i++) {
      g.fillStyle = i % 2 ? '#c9433a' : '#efe3cf';
      g.beginPath();
      g.moveTo(p.x - w / 2 + i * w / 6, top - 6 * K);
      g.lineTo(p.x - w / 2 + (i + 1) * w / 6, top - 6 * K);
      g.lineTo(p.x - w / 2 + (i + 1) * w / 6 - 5 * K, top - 14 * K);
      g.lineTo(p.x - w / 2 + i * w / 6 - 5 * K, top - 14 * K);
      g.closePath(); g.fill();
    }
  }

  function propOffice(p, s, lvl, T) {
    var P = pal('office');
    var h1 = 44 + Math.min(28, lvl * .6);
    isoBox(p.x, p.y, s.w, s.h, h1, P[0], P[1], P[2]);
    var top = p.y - h1 * K;
    windows(p.x + 6 * K, top + 12 * K, 5 * K, 4 * K, 3, 4, 'rgba(255,214,143,.9)');
    windows(p.x - 34 * K, top + 12 * K, 5 * K, 4 * K, 3, 4, 'rgba(180,214,255,.8)');
    g.strokeStyle = '#39424f'; g.lineWidth = 2 * K;
    g.beginPath(); g.moveTo(p.x, top - 2 * K); g.lineTo(p.x, top - 18 * K); g.stroke();
    g.fillStyle = '#e0604a';
    g.beginPath(); g.arc(p.x, top - 20 * K, 2.6 * K, 0, 6.3); g.fill();
  }

  var PROPS = {
    stove: propStove, counter: propCounter, peyk: propPeyk, kitchen: propKitchen,
    brand: propBrand, storage: propStorage, packing: propPacking, fleet: propFleet,
    catering: propCatering, academy: propAcademy, franchise: propFranchise, office: propOffice
  };

  /* سایه‌ی نرمِ پای هر جسم — بدون این، همه‌چیز روی زمین شناور است */
  function contactShadow(px, py, wTiles, hTiles, alpha) {
    g.save();
    g.globalAlpha = alpha == null ? .38 : alpha;
    var grd = g.createRadialGradient(px + 3 * K, py + 2 * K, 0, px + 3 * K, py + 2 * K, (wTiles + hTiles) * TW / 4 * K);
    grd.addColorStop(0, 'rgba(0,0,0,.75)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    diamond(px + 3 * K, py + 2 * K, (wTiles + hTiles) * TW / 2 * K * 1.05, (wTiles + hTiles) * TH / 2 * K * 1.05);
    g.fill();
    g.restore();
  }

  function drawSpot(s, W, T) {
    var lvl = (W.lvl && W.lvl[s.id]) || 0;
    var c = tileToWorld(s.x + s.w / 2, s.y + s.h / 2);
    var p = worldToScreen(c.x, c.y);

    if (!lvl) {
      /* جای خالیِ آماده — تا بازیکن بفهمد این‌جا چیزی می‌آید */
      g.save();
      g.globalAlpha = .55 + Math.sin(T * 2 + s.x) * .12;
      g.setLineDash([7 * K, 5 * K]);
      g.strokeStyle = 'rgba(233,185,106,.55)';
      g.lineWidth = 2 * K;
      diamond(p.x, p.y, (s.w + s.h) * TW / 2 * K * .9, (s.w + s.h) * TH / 2 * K * .9);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = 'rgba(233,185,106,.5)';
      g.font = '700 ' + Math.round(11 * K) + 'px ' + FONT;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('جای خالی', p.x, p.y);
      g.restore();
      return;
    }

    contactShadow(p.x, p.y, s.w, s.h);
    (PROPS[s.id] || propStorage)(p, s, lvl, T);

    /* نورِ گرمِ کفِ جسم، شب‌ها */
    if (NF > .3 && quality >= 1 && CF > .5) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = .10 * NF;
      g.fillStyle = pal(s.id)[3];
      diamond(p.x, p.y, (s.w + s.h) * TW / 2 * K * 1.3, (s.w + s.h) * TH / 2 * K * 1.3);
      g.fill();
      g.restore();
    }

    /* شماره‌ی سطح — کوچک، پای جسم، نه بالای سرش */
    var badgeY = p.y + (s.h + s.w) * TH / 4 * K - 2 * K;
    g.save();
    g.fillStyle = 'rgba(8,11,18,.86)';
    rr(g, p.x - 12 * K, badgeY - 7 * K, 24 * K, 14 * K, 7 * K); g.fill();
    g.strokeStyle = 'rgba(233,185,106,.5)'; g.lineWidth = 1 * K;
    rr(g, p.x - 12 * K, badgeY - 7 * K, 24 * K, 14 * K, 7 * K); g.stroke();
    g.fillStyle = '#f0c980';
    g.font = '800 ' + Math.round(9.5 * K) + 'px ' + FONT;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(U.fa(lvl), p.x, badgeY);
    g.restore();

    /* حلقه‌ی سبزِ «پولش را داری» — همان نشانِ نمونه */
    if (hotOn.indexOf(s.id) >= 0) {
      var pulse = .72 + Math.sin(T * 3.6 + s.x) * .28;
      var bx = p.x, by = p.y - ((s.h3 || 20) + 22) * K;
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = .25 * pulse;
      g.fillStyle = '#7ef096';
      g.beginPath(); g.arc(bx, by, 18 * K, 0, 6.3); g.fill();
      g.restore();
      g.save();
      g.fillStyle = 'rgba(14,32,20,.95)';
      g.beginPath(); g.arc(bx, by, 9.5 * K, 0, 6.3); g.fill();
      g.strokeStyle = 'rgba(126,240,150,' + pulse + ')';
      g.lineWidth = 2.2 * K;
      g.beginPath(); g.arc(bx, by, 9.5 * K, 0, 6.3); g.stroke();
      g.fillStyle = '#9ff0b4';
      g.font = '800 ' + Math.round(11 * K) + 'px ' + FONT;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('↑', bx, by + K);
      g.restore();
    }
  }

  function drawDecor(d, T) {
    var c = tileToWorld(d.x + .5, d.y + .5);
    var p = worldToScreen(c.x, c.y);
    if (d.k === 'lamp') {
      g.fillStyle = '#2c3542';
      g.fillRect(p.x - 2 * K, p.y - 54 * K, 4 * K, 54 * K);
      g.fillStyle = 'rgba(255,208,138,' + (.85 * NF) + ')';
      g.beginPath(); g.arc(p.x, p.y - 58 * K, 6 * K, 0, 6.3); g.fill();
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = .18 * NF;
      g.fillStyle = '#ffcf8a';
      g.beginPath(); g.arc(p.x, p.y - 20 * K, 46 * K, 0, 6.3); g.fill();
      g.restore();
    } else if (d.k === 'plant') {
      g.fillStyle = '#3a2c22';
      rr(g, p.x - 9 * K, p.y - 16 * K, 18 * K, 16 * K, 3 * K); g.fill();
      g.fillStyle = '#2f5138';
      for (var i = 0; i < 5; i++) {
        g.beginPath();
        g.ellipse(p.x + Math.sin(i * 2.1) * 8 * K, p.y - 22 * K - i * 4 * K, 7 * K, 4 * K, i, 0, 6.3);
        g.fill();
      }
    } else if (d.k === 'crate') {
      isoBox(p.x, p.y, 1, 1, 18, '#6a4d2e', '#452f1c', '#573c24');
    } else if (d.k === 'bench') {
      isoBox(p.x, p.y, 1, 1, 10, '#4a3a2a', '#2f2419', '#3a2d20');
    } else if (d.k === 'table') {
      isoBox(p.x, p.y, 1, 1, 14, '#3f4a5c', '#28303d', '#313a49');
    }
  }

  function drawPerson(c, T) {
    var w = tileToWorld(c.x, c.y);
    var p = worldToScreen(w.x, w.y);
    if (p.x < -60 || p.x > CW + 60 || p.y < -90 || p.y > CH + 60) return;
    var sc = .62 * K;
    var walking = (c.state === 'queue' || c.state === 'leave' || c.state === 'seat') && c.wait <= 0;
    var sitting = c.state === 'eat';

    if (A.scene && A.scene.person) {
      A.scene.person(g, p.x, p.y - (sitting ? 6 * K : 0), sc * (sitting ? .88 : 1), {
        t: T * 5 + c.phase, walk: walking ? 1 : 0,
        skin: c.look.skin, cloth: c.look.cloth, pants: c.look.pants,
        hair: c.look.hair, scarf: c.look.scarf, hat: c.look.hat, bag: c.look.bag,
        rim: .22 * NF,
        arm: sitting ? -10 : 0
      });
    }

    /* حباب سفارش بالای سرِ کسی که دارد سفارش می‌دهد یا می‌خورد */
    if ((c.state === 'order' || c.state === 'eat') && c.dish && quality >= 1) {
      bubble(p.x, p.y - 52 * K, c.dish.name);
    }
    if (c.gift) drawGiftBox(p.x, p.y - 50 * K, K, T);
  }

  /* حباب کوچک متن — همان چیزی که مغازه را «شلوغ» نشان می‌دهد */
  function bubble(x, y, text) {
    g.save();
    g.font = '700 ' + Math.round(9 * K) + 'px ' + FONT;
    var w = g.measureText(text).width + 14 * K, h = 17 * K;
    g.fillStyle = 'rgba(12,16,24,.92)';
    rr(g, x - w / 2, y - h, w, h, 6 * K); g.fill();
    g.strokeStyle = 'rgba(233,185,106,.35)'; g.lineWidth = 1 * K;
    rr(g, x - w / 2, y - h, w, h, 6 * K); g.stroke();
    g.beginPath();
    g.moveTo(x - 3 * K, y); g.lineTo(x + 3 * K, y); g.lineTo(x, y + 4 * K);
    g.closePath();
    g.fillStyle = 'rgba(12,16,24,.92)'; g.fill();
    g.fillStyle = '#e9d3a4';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, x, y - h / 2);
    g.restore();
  }

  function drawGiftBox(x, y, k, T) {
    var pulse = .78 + Math.sin(T * 3.4) * .22;
    g.save();
    g.translate(x, y + Math.sin(T * 2.2) * 2);
    g.scale(k, k);
    g.globalAlpha = .5 * pulse;
    g.fillStyle = 'rgba(255,214,143,.6)';
    g.beginPath(); g.arc(0, 0, 20, 0, 6.3); g.fill();
    g.globalAlpha = 1;
    g.fillStyle = '#c9433a';
    rr(g, -9, -8, 18, 15, 2.5); g.fill();
    g.fillStyle = '#a8342c';
    rr(g, -10, -11, 20, 5, 2); g.fill();
    g.fillStyle = '#f2d79a';
    g.fillRect(-1.8, -11, 3.6, 18);
    g.fillRect(-10, -3.2, 20, 3.2);
    g.restore();
  }

  function drawParticles(T) {
    var i;
    for (i = 0; i < steam.length; i++) {
      var st = steam[i];
      var sp = worldToScreen(st.x, st.y);
      g.save();
      g.globalAlpha = .3 * (1 - st.t / st.life);
      g.fillStyle = '#dfe8f5';
      g.beginPath(); g.arc(sp.x, sp.y, st.r * K, 0, 6.3); g.fill();
      g.restore();
    }
    for (i = 0; i < sparks.length; i++) {
      var s = sparks[i];
      var ss = worldToScreen(s.x, s.y);
      g.save();
      g.globalAlpha = 1 - s.t / s.life;
      g.fillStyle = s.col;
      g.fillRect(ss.x - 2 * K, ss.y - 2 * K, 4 * K, 4 * K);
      g.restore();
    }
    for (i = 0; i < coins.length; i++) {
      var c = coins[i];
      var cp = worldToScreen(c.x, c.y);
      g.save();
      g.globalAlpha = clamp(1 - c.t / c.life, 0, 1);
      g.fillStyle = '#f0c164';
      g.beginPath();
      g.ellipse(cp.x, cp.y, (c.big ? 9 : 6) * K, (c.big ? 11 : 7.5) * K, 0, 0, 6.3);
      g.fill();
      g.fillStyle = 'rgba(90,60,10,.5)';
      g.fillRect(cp.x - 3 * K, cp.y - 1 * K, 6 * K, 2 * K);
      g.restore();
    }
  }

  /* شب و روز روی کل صحنه */
  function nightWash(dayLight) {
    NF = 1 - dayLight * .78;
    if (NF <= .02) return;
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = 'rgba(70,64,120,' + (.26 * NF) + ')';
    g.fillRect(0, 0, CW, CH);
    g.restore();
    if (cityTint) {
      g.save();
      g.globalAlpha = .16;
      g.fillStyle = cityTint;
      g.fillRect(0, 0, CW, CH);
      g.restore();
    }
  }

  /* ═══════════════════════════════════════════════
     شهرِ دورِ مغازه

     ساختمان‌ها یک‌بار ساخته می‌شوند و ثابت می‌مانند (بذر ثابت)، پس
     هر بار که دوربین تکان می‌خورد شهر عوض نمی‌شود. ماشین‌ها و
     رهگذرها فقط در حاشیه می‌گذرند و تعدادشان با کیفیت دستگاه
     کم و زیاد می‌شود.
     ═══════════════════════════════════════════════ */
  var city = { blocks: [], cars: [], walkers: [], tier: -1 };

  function buildCity() {
    var L = lay();
    var R = U.seeded(1337 + tier * 91);
    city.blocks = [];
    var ring = 7;                       /* شهر تا کجا ادامه دارد */
    var minX = -ring - 4, maxX = L.w + ring + 4;
    var minY = -ring - 4, maxY = L.h + ring + 4;
    for (var tx = minX; tx < maxX; tx++) {
      for (var ty = minY; ty < maxY; ty++) {
        var inShop = tx >= -1 && tx <= L.w && ty >= -1 && ty <= L.h;
        if (inShop) continue;
        var d = Math.min(
          Math.abs(tx + 1), Math.abs(tx - L.w),
          Math.abs(ty + 1), Math.abs(ty - L.h)
        );
        if (d < 1) continue;            /* فقط یک خیابان دور مغازه باز بماند */
        if (R() > .66) continue;
        city.blocks.push({
          x: tx, y: ty,
          w: 1 + (R() > .7 ? 1 : 0),
          h: 1 + (R() > .7 ? 1 : 0),
          hh: 34 + R() * 130,
          hue: R()
        });
      }
    }
    /* ماشین‌ها روی خیابانِ دور مغازه */
    city.cars = [];
    for (var i = 0; i < 6; i++) {
      city.cars.push({
        side: i % 4, t: R(), speed: .05 + R() * .07,
        col: ['#c9433a', '#3f5f8a', '#e8e4dc', '#3a6a52', '#c8873c'][(R() * 5) | 0]
      });
    }
    /* رهگذرهای پیاده‌رو */
    city.walkers = [];
    for (var j = 0; j < 10; j++) {
      city.walkers.push({
        side: j % 4, t: R(), speed: .02 + R() * .03,
        look: A.scene && A.scene.randomLook ? A.scene.randomLook() : {},
        phase: R() * 6.3
      });
    }
    city.tier = tier;
  }

  /* نقطه‌ی روی خیابانِ دورِ مغازه، بر حسب ضلع و پیشرفت */
  function ringPoint(side, t) {
    var L = lay(), m = 1.6;
    if (side === 0) return { x: -m + t * (L.w + 2 * m), y: -m };
    if (side === 1) return { x: L.w + m, y: -m + t * (L.h + 2 * m) };
    if (side === 2) return { x: L.w + m - t * (L.w + 2 * m), y: L.h + m };
    return { x: -m, y: L.h + m - t * (L.h + 2 * m) };
  }

  function tickCity(dt) {
    if (city.tier !== tier) buildCity();
    var n = quality >= 2 ? city.cars.length : (quality >= 1 ? 3 : 0);
    for (var i = 0; i < n; i++) {
      var c = city.cars[i];
      c.t += c.speed * dt;
      if (c.t > 1) { c.t = 0; c.side = (c.side + 1) % 4; }
    }
    var wn = quality >= 2 ? city.walkers.length : (quality >= 1 ? 4 : 0);
    for (var j = 0; j < wn; j++) {
      var w = city.walkers[j];
      w.t += w.speed * dt;
      if (w.t > 1) { w.t = 0; w.side = (w.side + 1) % 4; }
    }
  }

  function drawCity(T) {
    if (city.tier !== tier) buildCity();
    /* ساختمان‌ها — دورترها کم‌رنگ‌تر، تا عمق حس شود */
    var L = lay();
    var sorted = city.blocks.slice().sort(function (a, b) { return (a.x + a.y) - (b.x + b.y); });
    for (var i = 0; i < sorted.length; i++) {
      var b = sorted[i];
      var c = tileToWorld(b.x + b.w / 2, b.y + b.h / 2);
      var p = worldToScreen(c.x, c.y);
      if (p.x < -180 || p.x > CW + 180 || p.y < -260 || p.y > CH + 200) continue;
      var far = clamp(1 - Math.max(0, (Math.abs(b.x - L.w / 2) + Math.abs(b.y - L.h / 2)) - L.w / 2) / 14, .35, 1);
      g.save();
      g.globalAlpha = far;
      var lum = 26 + b.hue * 26;
      isoBox(p.x, p.y, b.w, b.h, b.hh,
        'rgb(' + (lum + 16) + ',' + (lum + 20) + ',' + (lum + 30) + ')',
        'rgb(' + (lum - 8) + ',' + (lum - 4) + ',' + (lum + 4) + ')',
        'rgb(' + lum + ',' + (lum + 4) + ',' + (lum + 12) + ')');
      /* پنجره‌های شب */
      if (NF > .25 && quality >= 1) {
        windows(p.x + 4 * K, p.y - b.hh * K + 10 * K, 4 * K, 3.4 * K, 3, Math.min(6, (b.hh / 18) | 0), 'rgba(255,214,143,.85)');
      }
      g.restore();
    }
    /* ماشین‌ها */
    var cn = quality >= 2 ? city.cars.length : (quality >= 1 ? 3 : 0);
    for (var k = 0; k < cn; k++) {
      var car = city.cars[k];
      var rp = ringPoint(car.side, car.t);
      var cw = tileToWorld(rp.x, rp.y);
      var sp = worldToScreen(cw.x, cw.y);
      if (sp.x < -60 || sp.x > CW + 60 || sp.y < -60 || sp.y > CH + 60) continue;
      isoBox(sp.x, sp.y, .62, .62, 13, car.col, 'rgba(0,0,0,.45)', 'rgba(0,0,0,.3)');
      if (NF > .4) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = .5 * NF;
        g.fillStyle = 'rgba(255,220,160,.7)';
        g.beginPath(); g.ellipse(sp.x, sp.y + 2 * K, 16 * K, 6 * K, 0, 0, 6.3); g.fill();
        g.restore();
      }
    }
    /* رهگذرهای بیرون */
    var wn = quality >= 2 ? city.walkers.length : (quality >= 1 ? 4 : 0);
    for (var m = 0; m < wn; m++) {
      var wk = city.walkers[m];
      var wp = ringPoint(wk.side, wk.t);
      var ww = tileToWorld(wp.x, wp.y);
      var wsp = worldToScreen(ww.x, ww.y);
      if (wsp.x < -40 || wsp.x > CW + 40 || wsp.y < -60 || wsp.y > CH + 60) continue;
      if (A.scene && A.scene.person) {
        A.scene.person(g, wsp.x, wsp.y, .42 * K, {
          t: T * 4 + wk.phase, walk: 1,
          skin: wk.look.skin, cloth: wk.look.cloth, pants: wk.look.pants,
          hair: wk.look.hair, a: .8
        });
      }
    }
  }

  /* ───────── زوم ─────────
     دو انگشت، یا دکمه‌ی «شهر» که بین نمای نزدیک و نمای کل شهر
     جابه‌جا می‌کند. */
  var ZOOM_MIN = .34, ZOOM_MAX = 1.9;
  var wideMode = false;

  function zoomBy(f, sx, sy) {
    var before = screenToWorld(sx == null ? CW / 2 : sx, sy == null ? CH / 2 : sy);
    KT = clamp(KT * f, ZOOM_MIN, ZOOM_MAX);
    K = KT;
    /* نقطه‌ی زیر انگشت سرِ جایش بماند */
    var after = screenToWorld(sx == null ? CW / 2 : sx, sy == null ? CH / 2 : sy);
    camX += before.x - after.x;
    camY += before.y - after.y;
    wideMode = false;
  }
  function zoomLevel() { return KT; }
  /* نمای کل شهر: عقب می‌رود تا ساختمان‌های دور هم دیده شوند */
  function toggleWide() {
    wideMode = !wideMode;
    if (wideMode) {
      var L = lay();
      var wpx = (L.w + L.h) * TW / 2 + 620;
      KT = K = clamp(CW / wpx, ZOOM_MIN, ZOOM_MAX);
      var c = tileToWorld(L.w / 2, L.h / 2);
      camX = c.x; camY = c.y;
    } else {
      fitCamera();
    }
    return wideMode;
  }
  function isWide() { return wideMode; }

  /* ───────── حلقه ───────── */
  function update(dt, T, W) {
    CF = W.closed ? .12 : 1;
    /* دوربین: کشیدن انگشت با اصطکاک */
    camX -= panVX * Math.min(1, dt * 12);
    camY -= panVY * Math.min(1, dt * 12);
    panVX *= Math.max(0, 1 - dt * 6);
    panVY *= Math.max(0, 1 - dt * 6);
    /* از نقشه دور نیفتد */
    var L = lay();
    var c = tileToWorld(L.w / 2, L.h / 2);
    var maxOff = (L.w + L.h) * TW / 4;
    camX = clamp(camX, c.x - maxOff, c.x + maxOff);
    camY = clamp(camY, c.y - maxOff * .6, c.y + maxOff * .6);

    punchV = Math.max(0, punchV - dt * 2.6);
    K = KT * (1 + punchV * punchV * .05);
    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);

    tickCrowd(dt, W);
    tickCity(dt);
    tickParticles(dt);
  }

  function render(T, W) {
    if (!g) return;
    var t0 = performance.now();
    g.setTransform(DPR, 0, 0, DPR, 0, 0);

    /* آسمانِ بالای سر — رنگش با ساعت عوض می‌شود */
    var day = (A.clock && W.hour != null) ? A.clock.daylight(W.hour) : 0;
    var sky = g.createLinearGradient(0, 0, 0, CH);
    if (day > .5) {
      sky.addColorStop(0, '#4a6f9c'); sky.addColorStop(.55, '#6d8fb4'); sky.addColorStop(1, '#3c5570');
    } else {
      /* شب: بنفشِ شهری، نه سیاهِ مرده */
      sky.addColorStop(0, '#1a1636'); sky.addColorStop(.5, '#221c42'); sky.addColorStop(1, '#12102a');
    }
    g.fillStyle = sky;
    g.fillRect(0, 0, CW, CH);

    if (shakeT > 0) {
      g.save();
      g.translate(rnd(-1, 1) * shakeP * shakeT * 3, rnd(-1, 1) * shakeP * shakeT * 3);
    }

    drawCity(T);
    drawFloor();

    /* همه‌ی چیزهای روی زمین با هم مرتب می‌شوند — وگرنه از هم رد
       می‌شوند و عمق به هم می‌ریزد */
    var L = lay();
    var items = [];
    L.spots.forEach(function (s) {
      items.push({ d: s.x + s.w / 2 + s.y + s.h / 2, kind: 'spot', o: s });
    });
    (L.decor || []).forEach(function (dd) {
      items.push({ d: dd.x + dd.y, kind: 'decor', o: dd });
    });
    crowd.forEach(function (c) {
      items.push({ d: c.x + c.y + .01, kind: 'person', o: c });
    });
    items.sort(function (a, b) { return a.d - b.d; });

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.kind === 'spot') drawSpot(it.o, W, T);
      else if (it.kind === 'decor') drawDecor(it.o, T);
      else drawPerson(it.o, T);
    }

    drawParticles(T);
    nightWash(day);
    /* وینیت: چشم را می‌برد وسط قاب */
    if (quality >= 1) {
      var vg = g.createRadialGradient(CW / 2, CH * .48, Math.min(CW, CH) * .3, CW / 2, CH * .48, Math.max(CW, CH) * .78);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(4,3,14,.62)');
      g.fillStyle = vg;
      g.fillRect(0, 0, CW, CH);
    }

    if (shakeT > 0) g.restore();

    /* «بسته است» روی کل صحنه */
    if (W.closed) {
      g.save();
      g.fillStyle = 'rgba(4,6,12,.55)';
      g.fillRect(0, 0, CW, CH);
      g.fillStyle = 'rgba(214,178,120,.9)';
      g.font = '800 ' + Math.round(22) + 'px ' + FONT;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('بسته است', CW / 2, CH / 2);
      g.restore();
    }

    frameMs = frameMs * .9 + (performance.now() - t0) * .1;
    autoQuality();
  }

  /* اگر گوشی جا نیاورد، خودش می‌آید پایین — درسی که از اندروید گرفتیم */
  var slow = 0, fast = 0;
  function autoQuality() {
    if (frameMs > 22) { slow++; fast = 0; } else if (frameMs < 12) { fast++; slow = 0; }
    if (slow > 90 && quality > 0) { quality--; slow = 0; }
    else if (fast > 400 && quality < 2 && !RM) { quality++; fast = 0; }
  }

  /* ───────── راه‌اندازی ───────── */
  function pickDPR() {
    var d = window.devicePixelRatio || 1;
    return Math.min(d, quality >= 2 ? 2 : 1.5);
  }
  function attach(canvas) {
    cv = canvas;
    g = cv.getContext('2d', { alpha: false });
    resize(true);
  }
  var lastW = 0, lastH = 0;
  function resize(force) {
    if (!cv) return;
    var r = cv.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (!force && w === lastW && h === lastH) return;
    lastW = w; lastH = h;
    DPR = pickDPR();
    cv.width = Math.round(w * DPR);
    cv.height = Math.round(h * DPR);
    CW = w; CH = h;
    fitCamera();
  }
  function reset() {
    coins.length = 0; sparks.length = 0; floats.length = 0; steam.length = 0;
    crowd.length = 0; gift = null; giftT = 20;
    fitCamera();
  }
  function setQuality(q) {
    quality = clamp(q | 0, 0, 2);
    resize(true);
  }
  function stats() {
    return { quality: quality, ms: Math.round(frameMs * 10) / 10, night: Math.round(NF * 100) / 100, crowd: crowd.length };
  }

  A.iso = {
    attach: attach, resize: resize, update: update, render: render, reset: reset,
    setTier: setTier, setCityTint: setCityTint, setQuality: setQuality,
    snapCamera: snapCamera, panBy: panBy, punch: punch, shake: shake,
    zoomBy: zoomBy, zoomLevel: zoomLevel, toggleWide: toggleWide, isWide: isWide,
    spawnCoin: spawnCoin, burst: burst, burstAt: burstAt,
    toWorld: toWorld, tileToWorld: tileToWorld, worldToTile: worldToTile,
    hitStation: hitStation, setHotStations: setHotStations, spotIds: spotIds, spotOf: spotOf,
    hitGift: hitGift, takeGift: takeGift, hasGift: hasGift,
    stats: stats
  };
})(window.ABRO);
