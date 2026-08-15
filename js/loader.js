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
    /* شماره‌ی نسخه از یک‌جا می‌آید. قبلاً در HTML دستی نوشته شده بود و
       دو نسخه عقب مانده بود. */
    var v = $('ldVer');
    if (v) v.textContent = 'نسخه‌ی ' + U.fa(A.VERSION.replace(/\./g, '٫'));
    var el = $('loader');
    if (el) el.hidden = false;
    setProgress(0, 'شروع');
    rotateTips();
  }

  /* اگر صفحه در پس‌زمینه باشد rAF اجرا نمی‌شود؛ آن وقت با تایمر
     ادامه می‌دهیم تا بارگذاری برای همیشه معلق نماند */
  function nextTick(fn) {
    if (document.hidden) { setTimeout(fn, 40); return; }
    requestAnimationFrame(function () { requestAnimationFrame(fn); });
  }

  /* اجرای زنجیره‌ی مراحل با نفس دادن به مرورگر */
  function run(steps, onDone) {
    var i = 0, n = steps.length, failed = 0;

    /* تور نجات: اگر ده ثانیه گذشت و هنوز تمام نشده، دلیلش را نشان بده */
    var bail = setTimeout(function () {
      if (done) return;
      var st = $('ldStep');
      if (st) st.textContent = 'بارگذاری طول کشید — کمی صبر کن';
    }, 10000);

    function next() {
      if (i >= n) {
        clearTimeout(bail);
        setProgress(1, failed ? 'با چند خطا آماده شد' : 'آماده');
        finish(onDone);
        return;
      }
      var step = steps[i];
      setProgress(i / n, step.label);
      nextTick(function () {
        try { step.fn(); }
        catch (e) {
          failed++;
          if (window.console) console.error('مرحله‌ی بارگذاری «' + step.label + '»:', e);
        }
        i++;
        setProgress(i / n, step.label);
        next();
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
