/* ═══════════════════════════════════════════════
   آبرو — کارت‌های فرستادنی

   قانونی که این ماژول رویش ساخته شده:

     محتوا باید مالِ خودِ بازیکن باشد، به‌تنهایی زیبا باشد، و لوگو
     کوچک گوشه بنشیند. اگر کارت بدون اسم بازی هم قشنگ نباشد، اصلاً
     نباید ساخته شود.

   و چیزی که این‌جا هرگز نیست: پست خودکار، خواندن مخاطبان، پیام
   جعلی از طرف کسی. کارت ساخته می‌شود و کف دستِ بازیکن می‌ماند —
   خودش تصمیم می‌گیرد بفرستد یا نه.
   ═══════════════════════════════════════════════ */
(function (A) {
  'use strict';

  var U = A.util, D = A.data;
  var fa = U.fa, money = U.money, rr = U.roundRect;

  var W = 1080, H = 1080;
  var FONT = 'Vazirmatn, sans-serif';

  /* ───────── قلم‌های مشترک ───────── */
  function bg(g, top, bot) {
    var gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, top);
    gr.addColorStop(1, bot);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    /* بافت ریز، تا تخت نباشد */
    g.save();
    g.globalAlpha = .04;
    for (var i = 0; i < 900; i++) {
      g.fillStyle = i % 2 ? '#fff' : '#000';
      g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
    g.restore();
  }
  function frame(g) {
    g.strokeStyle = 'rgba(233,185,106,.34)';
    g.lineWidth = 3;
    rr(g, 44, 44, W - 88, H - 88, 26);
    g.stroke();
  }
  /* لوگو — کوچک، گوشه، مزاحم نه */
  function stamp(g) {
    g.save();
    g.globalAlpha = .5;
    g.fillStyle = '#e9b96a';
    g.font = '700 30px ' + FONT;
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillText('آبرو', 74, H - 74);
    g.restore();
  }
  function title(g, text, y) {
    g.fillStyle = '#fff3d4';
    g.font = '800 76px ' + FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, W / 2, y);
  }
  function sub(g, text, y, color, size) {
    g.fillStyle = color || 'rgba(214,198,170,.82)';
    g.font = '500 ' + (size || 34) + 'px ' + FONT;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, W / 2, y);
  }
  /* خط جداکننده با یک نقطه‌ی طلایی وسط */
  function rule(g, y) {
    g.strokeStyle = 'rgba(233,185,106,.28)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(180, y); g.lineTo(W - 180, y); g.stroke();
    g.fillStyle = '#e9b96a';
    g.beginPath(); g.arc(W / 2, y, 7, 0, 6.3); g.fill();
  }
  /* متن چندخطی راست‌به‌چپ، وسط‌چین */
  function wrap(g, text, y, max, lh, size) {
    g.font = '500 ' + (size || 32) + 'px ' + FONT;
    g.textAlign = 'center';
    g.fillStyle = 'rgba(206,192,168,.88)';
    var words = String(text).split(' '), line = '', out = [];
    words.forEach(function (w) {
      var t = line ? line + ' ' + w : w;
      if (g.measureText(t).width > max && line) { out.push(line); line = w; }
      else line = t;
    });
    if (line) out.push(line);
    out.forEach(function (l, i) { g.fillText(l, W / 2, y + i * (lh || 46)); });
    return y + out.length * (lh || 46);
  }
  /* دیگ بخارِ کوچک — نشانِ همه‌ی کارت‌ها */
  function pot(g, cx, cy, s) {
    g.save();
    g.translate(cx, cy);
    g.scale(s, s);
    g.fillStyle = '#7b8593';
    rr(g, -54, -22, 108, 58, 8); g.fill();
    g.fillStyle = '#9aa4b2';
    rr(g, -64, -34, 128, 16, 8); g.fill();
    g.strokeStyle = 'rgba(226,236,248,.5)';
    g.lineWidth = 5;
    g.lineCap = 'round';
    [-26, 0, 26].forEach(function (dx, i) {
      g.beginPath();
      g.moveTo(dx, -48);
      g.quadraticCurveTo(dx + (i - 1) * 16, -78, dx, -104);
      g.stroke();
    });
    g.fillStyle = '#ff9a3c';
    g.beginPath();
    g.moveTo(-20, 36); g.quadraticCurveTo(0, 8, 20, 36);
    g.closePath(); g.fill();
    g.restore();
  }

  function newCanvas() {
    var c = U.offscreen(W, H);
    return { c: c, g: c.getContext('2d') };
  }

  /* ═════════ کارت دستور پدر ═════════
     قوی‌ترین کارت، چون خودش به‌تنهایی ارزش دارد: یک دستور پخت واقعی
     که آدم بدون بازی هم نگهش می‌دارد. */
  function recipeCard(dishId) {
    var dish = A.state.menuDish(dishId) || D.MENU[0];
    var rec = D.RECIPES[dish.id] || D.RECIPES[D.MENU[0].id];
    var o = newCanvas(), g = o.g;

    bg(g, '#171208', '#0a0c12');
    frame(g);
    pot(g, W / 2, 210, .9);

    sub(g, 'از دفترچه‌ی پدر', 320, 'rgba(233,185,106,.7)', 30);
    title(g, dish.name, 386);
    rule(g, 448);

    g.textAlign = 'right';
    g.font = '600 30px ' + FONT;
    g.fillStyle = 'rgba(233,185,106,.85)';
    g.fillText('چه می‌خواهد', W - 150, 512);
    g.font = '500 29px ' + FONT;
    g.fillStyle = 'rgba(206,192,168,.9)';
    rec.items.forEach(function (t, i) {
      g.fillText('· ' + t, W - 150, 566 + i * 46);
    });

    var y = 566 + rec.items.length * 46 + 34;
    g.textAlign = 'right';
    g.font = '600 30px ' + FONT;
    g.fillStyle = 'rgba(233,185,106,.85)';
    g.fillText('چطور', W - 150, y);
    g.textAlign = 'center';
    y = wrap(g, rec.how, y + 52, W - 300, 46, 29);

    rule(g, Math.min(y + 40, H - 190));
    sub(g, A.state.shopName(), H - 130, 'rgba(255,243,212,.9)', 34);
    stamp(g);
    return o.c;
  }

  /* ═════════ کارت شب ═════════
     همان فاکتوری که بازیکن هر شب می‌بیند، ولی قابل فرستادن. */
  function nightCard(d) {
    var o = newCanvas(), g = o.g;
    bg(g, '#0e1420', '#080a10');
    frame(g);

    sub(g, 'شب ' + fa(d.day), 190, 'rgba(233,185,106,.7)', 30);
    title(g, A.state.shopName(), 258);
    sub(g, d.tierName, 322, 'rgba(206,192,168,.6)', 28);
    rule(g, 386);

    g.textAlign = 'center';
    g.fillStyle = '#9ff0b4';
    g.font = '800 96px ' + FONT;
    g.fillText(money(d.net), W / 2, 500);
    sub(g, 'خالص این شب — ایر', 570, 'rgba(206,192,168,.6)', 28);

    /* سه عدد کوچک زیرش */
    var cols = [
      ['اصالت', fa(Math.round(d.integ)) + ' از ۱۰۰'],
      ['ساعت', fa(d.hours.toFixed(1))],
      ['نیرو', fa(d.hired)]
    ];
    cols.forEach(function (c, i) {
      var x = 250 + i * 290;
      g.fillStyle = 'rgba(233,185,106,.7)';
      g.font = '500 26px ' + FONT;
      g.fillText(c[0], x, 660);
      g.fillStyle = '#fff3d4';
      g.font = '700 38px ' + FONT;
      g.fillText(c[1], x, 710);
    });

    rule(g, 790);
    wrap(g, d.note, 850, W - 320, 46, 31);
    stamp(g);
    return o.c;
  }

  /* ═════════ کارت مناسبت ═════════ */
  function occasionCard(occ) {
    var o = newCanvas(), g = o.g;
    bg(g, '#1c1220', '#0a0810');
    frame(g);
    pot(g, W / 2, 300, 1.15);

    sub(g, 'امشب', 440, 'rgba(233,185,106,.7)', 30);
    title(g, occ.name, 516);
    rule(g, 584);
    wrap(g, occ.note, 650, W - 300, 50, 34);

    sub(g, A.state.shopName(), H - 200, 'rgba(255,243,212,.9)', 36);
    sub(g, 'باز است', H - 146, 'rgba(159,240,180,.8)', 30);
    stamp(g);
    return o.c;
  }

  /* ═════════ کارت کد همسایه ═════════ */
  function codeCard() {
    var o = newCanvas(), g = o.g;
    bg(g, '#101820', '#080b10');
    frame(g);
    pot(g, W / 2, 280, 1);

    sub(g, 'کوچه‌ی من', 430, 'rgba(233,185,106,.7)', 30);
    title(g, A.state.shopName(), 500);
    rule(g, 566);

    g.fillStyle = '#fff3d4';
    g.font = '800 92px ' + FONT;
    g.textAlign = 'center';
    g.fillText(A.state.myCode(), W / 2, 680);

    wrap(g, 'این کد را در بازی وارد کن، هر دومان فیروزه می‌گیریم.', 790, W - 300, 48, 32);
    stamp(g);
    return o.c;
  }

  var MAKERS = {
    recipe: recipeCard, night: nightCard, occasion: occasionCard, code: codeCard
  };

  /* ───────── بیرون دادن ─────────
     ذخیره و فرستادن هر دو دستِ بازیکن است. هیچ‌چیز خودکار نمی‌رود. */
  function toBlob(canvas) {
    return new Promise(function (res) {
      if (canvas.toBlob) canvas.toBlob(res, 'image/png');
      else res(null);
    });
  }
  function fileName(kind) {
    return 'abro-' + kind + '-' + Date.now() + '.png';
  }
  function save(canvas, kind) {
    try {
      var a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = fileName(kind);
      a.click();
      return true;
    } catch (e) { return false; }
  }
  /* اگر گوشی «فرستادن» بلد باشد از همان استفاده می‌کنیم؛ وگرنه ذخیره */
  function canShare() {
    try { return !!(navigator.share && navigator.canShare); } catch (e) { return false; }
  }
  function send(canvas, kind, text) {
    if (!canShare()) return Promise.resolve(save(canvas, kind) ? 'saved' : 'failed');
    return toBlob(canvas).then(function (b) {
      if (!b) return save(canvas, kind) ? 'saved' : 'failed';
      var f = new File([b], fileName(kind), { type: 'image/png' });
      if (!navigator.canShare({ files: [f] })) {
        return save(canvas, kind) ? 'saved' : 'failed';
      }
      return navigator.share({ files: [f], text: text || '' })
        .then(function () { return 'shared'; })
        .catch(function () { return 'cancelled'; });
    });
  }

  function make(kind, arg) {
    var fn = MAKERS[kind];
    if (!fn) return null;
    try { return fn(arg); } catch (e) { return null; }
  }

  A.share = { make: make, save: save, send: send, canShare: canShare, MAKERS: MAKERS };
})(window.ABRO);
