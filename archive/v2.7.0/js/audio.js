/* ═══════════════════════════════════════════════
   آبرو — صدا: همه‌چیز با WebAudio ساخته می‌شود
   ═══════════════════════════════════════════════ */
(function (A) {
  'use strict';

  var ctx = null, dead = false, on = true, master = null, musicGain = null;
  var musicTimer = null, musicStep = 0;

  function ac() {
    if (dead || !on) return null;
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    try {
      var C = window.AudioContext || window.webkitAudioContext;
      ctx = new C();
      master = ctx.createGain();
      master.gain.value = .9;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = .0;
      musicGain.connect(master);
      return ctx;
    } catch (e) { dead = true; return null; }
  }

  function tone(o) {
    if (!on) return;
    var c = ac(); if (!c) return;
    try {
      var t = c.currentTime + (o.delay || 0);
      var osc = c.createOscillator(), g = c.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.f, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(30, o.to), t + o.d);
      g.gain.setValueAtTime(.0001, t);
      g.gain.linearRampToValueAtTime(o.v == null ? .06 : o.v, t + (o.atk || .012));
      g.gain.exponentialRampToValueAtTime(.0001, t + o.d);
      var node = g;
      if (o.filter) {
        var f = c.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = o.filter;
        g.connect(f); node = f;
      }
      osc.connect(g); node.connect(o.bus || master);
      osc.start(t); osc.stop(t + o.d + .04);
    } catch (e) { }
  }

  function noise(dur, vol, freq) {
    if (!on) return;
    var c = ac(); if (!c) return;
    try {
      var len = Math.floor(c.sampleRate * dur);
      var buf = c.createBuffer(1, len, c.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = c.createBufferSource(); src.buffer = buf;
      var f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 1200; f.Q.value = .8;
      var g = c.createGain(); g.gain.value = vol == null ? .05 : vol;
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
    } catch (e) { }
  }

  /* ── جلوه‌ها ── */
  var SFX = {
    tap: function (heat) {
      heat = heat || 0;
      tone({ f: 430 + heat * 360, to: 620 + heat * 460, d: .07, type: 'triangle', v: .05 });
    },
    coin: function () {
      tone({ f: 880, to: 1250, d: .09, type: 'triangle', v: .05 });
      tone({ f: 1320, d: .11, type: 'triangle', v: .033, delay: .055 });
    },
    buy: function () {
      tone({ f: 330, to: 520, d: .1, type: 'square', v: .04 });
      tone({ f: 660, to: 900, d: .16, type: 'triangle', v: .05, delay: .07 });
    },
    no: function () { tone({ f: 150, to: 88, d: .17, type: 'sawtooth', v: .045 }); },
    open: function () { tone({ f: 520, to: 760, d: .1, type: 'sine', v: .035 }); },
    close: function () { tone({ f: 620, to: 380, d: .1, type: 'sine', v: .03 }); },
    event: function () {
      tone({ f: 240, to: 178, d: .24, type: 'sine', v: .05 });
      tone({ f: 176, to: 138, d: .34, type: 'sine', v: .04, delay: .14 });
    },
    win: function () {
      [523, 659, 784, 1046].forEach(function (f, i) {
        tone({ f: f, d: .17, type: 'triangle', v: .05, delay: i * .08 });
      });
    },
    badge: function () {
      [660, 880, 1320].forEach(function (f, i) {
        tone({ f: f, d: .22, type: 'sine', v: .045, delay: i * .1 });
      });
    },
    print: function () {
      var i = 0;
      var t = setInterval(function () {
        noise(.03, .022, 900 + Math.random() * 900);
        if (++i > 10) clearInterval(t);
      }, 52);
    },
    act: function () {
      tone({ f: 220, to: 330, d: .55, type: 'sine', v: .06 });
      tone({ f: 330, to: 440, d: .75, type: 'sine', v: .045, delay: .2 });
      tone({ f: 165, d: 1.1, type: 'sine', v: .035, delay: .1 });
    },
    thunder: function () { noise(.9, .07, 190); },
    rain: function () { noise(.4, .012, 3800); },
    sizzle: function () { noise(.22, .008, 5200); }
  };

  /* ── موسیقی زمینه: چند نت آرام، حلقه‌ی طولانی ── */
  var SCALE = [0, 2, 3, 5, 7, 8, 10];          // مینور شرقی
  var ROOT = 146.83;                            // ر
  function note(i) { return ROOT * Math.pow(2, SCALE[i % SCALE.length] / 12 + Math.floor(i / SCALE.length)); }

  function musicTick() {
    if (!on || !ctx) return;
    var c = ac(); if (!c) return;
    var pat = [0, 2, 4, 2, 5, 4, 2, 0, 3, 2, 1, 0];
    var n = pat[musicStep % pat.length];
    tone({ f: note(n), d: 1.9, type: 'sine', v: .022, atk: .35, bus: musicGain, filter: 900 });
    if (musicStep % 4 === 0) tone({ f: note(n) / 2, d: 3.2, type: 'triangle', v: .018, atk: .6, bus: musicGain, filter: 500 });
    musicStep++;
  }

  function startMusic() {
    if (musicTimer || !on) return;
    var c = ac(); if (!c) return;
    try { musicGain.gain.linearRampToValueAtTime(.75, c.currentTime + 3); } catch (e) { }
    musicTick();
    musicTimer = setInterval(musicTick, 1700);
  }
  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    if (ctx && musicGain) { try { musicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + .4); } catch (e) { } }
  }

  A.audio = {
    sfx: SFX,
    isOn: function () { return on; },
    toggle: function () {
      on = !on;
      if (!on) { stopMusic(); if (ctx) try { ctx.suspend(); } catch (e) { } }
      else { ac(); startMusic(); SFX.coin(); }
      return on;
    },
    setOn: function (v) { if (v !== on) A.audio.toggle(); },
    startMusic: startMusic,
    stopMusic: stopMusic,
    resume: function () { ac(); },
    suspend: function () {
      if (ctx && ctx.state === 'running') { try { ctx.suspend(); } catch (e) { } }
    }
  };
})(window.ABRO);
