/* ═══════════════════════════════════════════════
   آبرو — مینی‌گیم‌ها

   چهار بازی کوتاه، هرکدام ۱۵ تا ۳۰ ثانیه. همه یک قرارداد دارند:

     start(def, done)  →  بازی را روی همان یک مودال سوار می‌کند
     done(score)       →  نمره‌ی صفر تا یک برمی‌گرداند

   جایزه این‌جا داده نمی‌شود؛ `game.js` می‌دهد. دلیلش این است که
   سهمیه و پول و صدا و ذخیره همه یک‌جا بمانند.

   حلقه‌ی هر بازی حفاظ دارد: اگر وسط کار استثنا بخورد، بازی با
   نمره‌ی صفر بسته می‌شود و مودال قفل نمی‌ماند — همان درسی که از
   حلقه‌ی اصلی گرفتیم.
   ═══════════════════════════════════════════════ */
(function (A) {
  'use strict';

  var U = A.util, D = A.data;
  var $ = U.$, fa = U.fa, clamp = U.clamp, rnd = U.rnd;

  var live = null;        /* بازی در جریان */
  var rafId = 0;

  function AU() { return A.audio; }

  /* ───────── چارچوب مشترک ───────── */
  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    live = null;
  }
  function finish(score) {
    var cb = live && live.done;
    var id = live && live.def.id;
    stop();
    if (cb) cb(clamp(score, 0, 1), id);
  }
  /* حلقه‌ی امن: هر خطایی یعنی بازی تمام، نه یخ زدن مودال */
  function loop(now) {
    if (!live) return;
    try {
      live.tick(now);
    } catch (e) {
      U.toast('بازی نیمه‌کاره ماند.', 'bad');
      finish(0);
      return;
    }
    if (live) rafId = requestAnimationFrame(loop);
  }

  function setStage(html) { $('miStage').innerHTML = html; }
  function setNote(t) { $('miNote').textContent = t; }
  function setBar(p) { $('miTime').style.width = clamp(p * 100, 0, 100) + '%'; }
  function setScore(s) {
    $('miScore').textContent = fa(Math.round(clamp(s, 0, 1) * 100)) + '٪';
  }

  /* ═════════ ۱. چانه‌زنی — نشانگر روی نوار ═════════
     نوار می‌رود و می‌آید، بازیکن نگهش می‌دارد. سه بار.
     نزدیکی به وسط = نمره. */
  function playBar(def, done) {
    var round = 0, rounds = 3, total = 0;
    var pos = 0, dir = 1, speed = .78, held = false;

    setStage(
      '<div class="mi-bar"><span class="mi-zone mi-z1"></span>' +
      '<span class="mi-zone mi-z2"></span><i class="mi-mark" id="miMark"></i></div>' +
      '<div class="mi-rounds" id="miRounds"></div>' +
      '<button class="mi-act" id="miAct">نگه دار</button>'
    );
    paintRounds();

    function paintRounds() {
      var s = '';
      for (var i = 0; i < rounds; i++) s += '<span class="' + (i < round ? 'on' : '') + '"></span>';
      $('miRounds').innerHTML = s;
    }

    var t0 = performance.now();
    live = {
      def: def, done: done,
      tick: function (now) {
        if (held) return;
        var dt = Math.min(.05, (now - t0) / 1000);
        t0 = now;
        pos += dir * speed * dt;
        if (pos > 1) { pos = 1; dir = -1; }
        if (pos < 0) { pos = 0; dir = 1; }
        $('miMark').style.insetInlineStart = (pos * 100) + '%';
        setBar(1 - (round + pos * 0) / rounds);
      }
    };

    $('miAct').onclick = function () {
      if (held) return;
      held = true;
      /* فاصله تا وسط: صفر یعنی دقیق */
      var d = Math.abs(pos - .5) * 2;
      var sc = clamp(1 - d * 1.15, 0, 1);
      total += sc;
      round++;
      paintRounds();
      setScore(total / rounds);
      if (sc > .8) { AU().sfx.win(); U.buzz([10, 30, 10]); setNote('دقیقاً وسط. قیمت شکست.'); }
      else if (sc > .4) { AU().sfx.buy(); setNote('بد نبود.'); }
      else { AU().sfx.no(); setNote('این‌بار نگرفت.'); }

      if (round >= rounds) {
        setTimeout(function () { finish(total / rounds); }, 620);
        return;
      }
      speed += .34;                    /* هر دور تندتر */
      setTimeout(function () {
        held = false;
        t0 = performance.now();
      }, 460);
    };
    rafId = requestAnimationFrame(loop);
  }

  /* ═════════ ۲. سیخ‌گردانی — ریتم ═════════
     شش سیخ. حلقه‌ای دور هر سیخ تنگ می‌شود؛ سرِ وقت بزن. */
  function playBeat(def, done) {
    var n = 6, i = 0, hits = 0, phase = 0, window0 = .16;
    var t0 = performance.now();
    var armed = true;

    setStage(
      '<div class="mi-grill"><i class="mi-ring" id="miRing"></i>' +
      '<svg class="mi-sk" viewBox="0 0 64 64"><path d="M8 32h48M20 22h32M20 42h32" stroke-width="4"/></svg></div>' +
      '<div class="mi-rounds" id="miRounds"></div>' +
      '<button class="mi-act" id="miAct">بچرخان</button>'
    );
    paint();
    function paint() {
      var s = '';
      for (var k = 0; k < n; k++) s += '<span class="' + (k < i ? 'on' : '') + '"></span>';
      $('miRounds').innerHTML = s;
    }

    live = {
      def: def, done: done,
      tick: function (now) {
        var dt = Math.min(.05, (now - t0) / 1000);
        t0 = now;
        phase += dt * .85;
        if (phase >= 1) {
          /* از دستش داد */
          phase = 0;
          i++; armed = true; paint();
          AU().sfx.no();
          setNote('سوخت. سیخ بعدی.');
          if (i >= n) { finish(hits / n); return; }
        }
        var r = 1 - phase;
        var el = $('miRing');
        el.style.transform = 'scale(' + (0.34 + r * 1.1) + ')';
        el.classList.toggle('hot', Math.abs(phase - .72) < window0);
        setBar(1 - i / n);
      }
    };

    $('miAct').onclick = function () {
      if (!armed || !live) return;
      armed = false;
      /* لحظه‌ی درست ۰٫۷۲ است؛ هرچه نزدیک‌تر، بهتر */
      var d = Math.abs(phase - .72);
      if (d < window0) {
        hits += d < window0 * .45 ? 1 : .7;
        AU().sfx.win(); U.buzz(10);
        setNote(d < window0 * .45 ? 'درست همان لحظه.' : 'گرفت.');
      } else {
        AU().sfx.no();
        setNote(phase < .72 ? 'زود بود، هنوز خام است.' : 'دیر شد.');
      }
      i++; phase = 0; armed = true; paint();
      setScore(hits / n);
      if (i >= n) finish(hits / n);
    };
    rafId = requestAnimationFrame(loop);
  }

  /* ═════════ ۳. صف شلوغ — تطبیق ═════════
     مشتری غذا می‌خواهد، سه دکمه جلویت است. گزینه‌ها از منوی خودت
     می‌آیند، پس هرچه منو بازتر، بازی سخت‌تر. */
  function playMatch(def, done) {
    var rounds = def.rounds || 5, i = 0, hits = 0;
    var perRound = 2.5, left = perRound;
    var t0 = performance.now();
    var want = null, locked = false;

    var pool = D.MENU.filter(function (d) { return A.state.menuOpen(d); });
    if (pool.length < 3) pool = D.MENU.slice(0, 3);

    setStage(
      '<div class="mi-order"><b id="miWant">—</b><i id="miFace">مشتری ۱</i></div>' +
      '<div class="mi-picks" id="miPicks"></div>' +
      '<div class="mi-rounds" id="miRounds"></div>'
    );
    next();

    function paint() {
      var s = '';
      for (var k = 0; k < rounds; k++) s += '<span class="' + (k < i ? 'on' : '') + '"></span>';
      $('miRounds').innerHTML = s;
    }
    function next() {
      locked = false;
      left = perRound;
      var opts = U.shuffle(pool.slice()).slice(0, 3);
      want = opts[Math.random() * opts.length | 0];
      $('miWant').textContent = want.name + ' می‌خواهم';
      $('miFace').textContent = 'مشتری ' + fa(i + 1);
      $('miPicks').innerHTML = opts.map(function (o) {
        return '<button class="mi-pick" data-mid="' + o.id + '">' + o.name + '</button>';
      }).join('');
      paint();
    }

    $('miPicks').onclick = function (e) {
      var b = e.target.closest('[data-mid]');
      if (!b || locked || !live) return;
      locked = true;
      var right = b.dataset.mid === want.id;
      b.classList.add(right ? 'right' : 'wrong');
      if (right) { hits++; AU().sfx.coin(); setNote('درست. بعدی.'); }
      else { AU().sfx.no(); U.buzz(18); setNote('اشتباه دادی. پس آورد.'); }
      i++;
      setScore(hits / rounds);
      setTimeout(function () {
        if (!live) return;
        if (i >= rounds) finish(hits / rounds);
        else next();
      }, 420);
    };

    live = {
      def: def, done: done,
      tick: function (now) {
        var dt = Math.min(.05, (now - t0) / 1000);
        t0 = now;
        if (locked) return;
        left -= dt;
        setBar(left / perRound);
        if (left <= 0) {
          locked = true;
          AU().sfx.no();
          setNote('معطل ماند و رفت.');
          i++;
          setScore(hits / rounds);
          setTimeout(function () {
            if (!live) return;
            if (i >= rounds) finish(hits / rounds);
            else next();
          }, 380);
        }
      }
    };
    rafId = requestAnimationFrame(loop);
  }

  /* ═════════ ۴. گاوصندوق شب — رمز ═════════
     عقربه می‌چرخد، سه بار روی نشانه نگهش دار. */
  function playDial(def, done) {
    var need = 3, got = 0, ang = 0, speed = 150, mark = 0;
    var t0 = performance.now();
    var cool = false;

    setStage(
      '<div class="mi-dial"><i class="mi-notch" id="miNotch"></i>' +
      '<i class="mi-hand" id="miHand"></i><b id="miLock">۰/۳</b></div>' +
      '<button class="mi-act" id="miAct">بچرخان و نگه دار</button>'
    );
    place();
    function place() {
      mark = rnd(0, 360);
      $('miNotch').style.transform = 'rotate(' + mark + 'deg)';
    }

    live = {
      def: def, done: done,
      tick: function (now) {
        var dt = Math.min(.05, (now - t0) / 1000);
        t0 = now;
        ang = (ang + speed * dt) % 360;
        $('miHand').style.transform = 'rotate(' + ang + 'deg)';
        setBar(1 - got / need);
      }
    };

    $('miAct').onclick = function () {
      if (cool || !live) return;
      var d = Math.abs(((ang - mark + 540) % 360) - 180);
      d = 180 - d;                       /* فاصله‌ی زاویه‌ای، ۰ یعنی دقیق */
      if (d < 22) {
        got++;
        $('miLock').textContent = fa(got) + '/۳';
        AU().sfx.badge(); U.buzz([8, 26, 8]);
        setNote(d < 9 ? 'تق. افتاد سرِ جایش.' : 'گرفت.');
        speed += 55;
        place();
        setScore(got / need);
        if (got >= need) { finish(1); return; }
      } else {
        AU().sfx.no();
        setNote('رد شد. دوباره.');
        cool = true;
        setTimeout(function () { cool = false; }, 420);
        /* هر خطا یک پله از نمره کم می‌کند، ولی بازی تمام نمی‌شود */
        need = Math.min(6, need + 1);
        $('miLock').textContent = fa(got) + '/' + fa(need);
        setScore(got / need);
      }
    };
    rafId = requestAnimationFrame(loop);
  }

  var ENGINES = { bar: playBar, beat: playBeat, match: playMatch, dial: playDial };

  /* ───────── ورودی ───────── */
  function start(def, done) {
    if (live) return false;
    var eng = ENGINES[def.kind];
    if (!eng) return false;
    setNote(def.hint);
    setScore(0);
    setBar(1);
    eng(def, done);
    return true;
  }
  function cancel() {
    if (!live) return;
    finish(0);
  }
  function busy() { return !!live; }

  A.mini = { start: start, cancel: cancel, busy: busy, ENGINES: ENGINES };
})(window.ABRO);
