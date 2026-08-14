/* ═══════════════════════════════════════════════
   آبرو — صفحه‌ی بارگذاری
   کارهای واقعی آماده‌سازی را مرحله‌به‌مرحله اجرا می‌کند
   و بین هر مرحله به مرورگر نفس می‌دهد تا انیمیشن نپرد.
   ═══════════════════════════════════════════════ */
(function (A) {
  'use strict';

  var U = A.util, $ = U.$;
  var MIN_MS = U.reduceMotion ? 400 : 2600;   /* حداقل زمان نمایش */
  var tipTimer = null, startedAt = 0, done = false;

  function setProgress(p, label) {
    var bar = $('ldBar');
    if (bar) bar.style.width = U.clamp(p * 100, 0, 100).toFixed(1) + '%';
    var st = $('ldStep');
    if (st && label) st.textContent = label;
    var pc = $('ldPct');
    if (pc) pc.textContent = U.fa(Math.round(U.clamp(p * 100, 0, 100))) + '٪';
  }

  function rotateTips() {
    var tips = A.data.TIPS, i = Math.random() * tips.length | 0;
    var el = $('ldTip');
    if (!el) return;
    el.textContent = tips[i];
    tipTimer = setInterval(function () {
      i = (i + 1 + (Math.random() * (tips.length - 1) | 0)) % tips.length;
      el.style.opacity = 0;
      setTimeout(function () {
        el.textContent = tips[i];
        el.style.opacity = 1;
      }, 320);
    }, 3200);
  }

  function begin() {
    startedAt = performance.now();
    done = false;
    var el = $('loader');
    if (el) el.hidden = false;
    setProgress(0, 'شروع');
    rotateTips();
  }

  /* اجرای زنجیره‌ی مراحل با نفس دادن به مرورگر */
  function run(steps, onDone) {
    var i = 0, n = steps.length;
    function next() {
      if (i >= n) {
        setProgress(1, 'آماده');
        finish(onDone);
        return;
      }
      var step = steps[i];
      setProgress(i / n, step.label);
      /* دو فریم صبر تا نوار واقعاً حرکت کند، بعد کار سنگین */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          try { step.fn(); } catch (e) { if (window.console) console.error('load step', step.label, e); }
          i++;
          setProgress(i / n, step.label);
          next();
        });
      });
    }
    next();
  }

  function finish(cb) {
    if (done) return;
    done = true;
    var wait = Math.max(0, MIN_MS - (performance.now() - startedAt));
    setTimeout(function () {
      clearInterval(tipTimer);
      var el = $('loader');
      if (el) {
        el.classList.add('gone');
        setTimeout(function () { el.hidden = true; }, 850);
      }
      if (cb) cb();
    }, wait);
  }

  A.loader = { begin: begin, run: run, setProgress: setProgress };
})(window.ABRO);
