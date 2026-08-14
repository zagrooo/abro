/* ═══════════════════════════════════════════════
   آبرو — هوا، مناسبت، شهر

   هوا فقط تزئین نیست: هر کدام ایستگاه‌های خاصی را
   بالا و پایین می‌برد، پس برنامه‌ی شیفت عوض می‌شود.

   مناسبت‌ها روی تقویم شمسیِ واقعی می‌نشینند — یلدای واقعی،
   نوروز واقعی. چون بازیکن‌ها بیرون از بازی درباره‌شان حرف می‌زنند.
   ═══════════════════════════════════════════════ */
(function (A) {
  'use strict';

  var U = A.util, D = A.data, CK = A.clock;

  /* ───────── شهر ───────── */
  function cityFor(runIndex) {
    return D.CITIES[(runIndex | 0) % D.CITIES.length];
  }

  /* ───────── فصل ─────────
     از ماه شمسی: ۱-۳ بهار، ۴-۶ تابستان، ۷-۹ پاییز، ۱۰-۱۲ زمستان */
  function seasonOf(jm) { return Math.floor((jm - 1) / 3); }
  var SEASON_NAMES = ['بهار', 'تابستان', 'پاییز', 'زمستان'];

  /* ───────── هوا ─────────
     هوا هر «روزِ بازی» یک بار عوض می‌شود، با بذر ثابت تا
     در یک روز مدام تغییر نکند. */
  function weatherFor(cityIdx, dayIndex) {
    var city = cityFor(cityIdx);
    var j = CK.todayJalali();
    var pool = (D.CLIMATE[city.climate] || D.CLIMATE.mild)[seasonOf(j.m)] || ['clear'];
    var rng = U.seeded((cityIdx + 1) * 7919 + (dayIndex | 0) * 104729);
    var pick = pool[Math.floor(rng() * pool.length) % pool.length];
    return D.WEATHER[pick] || D.WEATHER.clear;
  }

  /* ضریب هوا روی یک ایستگاه خاص */
  function weatherStationMul(w, stationId) {
    if (!w || !w.st) return 1;
    return w.st[stationId] || 1;
  }

  /* ───────── مناسبت ───────── */
  function occasionToday() {
    var j = CK.todayJalali();
    var wd = new Date().getDay();      /* ۰ یکشنبه … ۴ پنجشنبه */
    for (var i = 0; i < D.OCCASIONS.length; i++) {
      var o = D.OCCASIONS[i];
      if (o.ramadan) continue;         /* رمضان جدا حساب می‌شود */
      if (o.wd != null) {
        if (wd === o.wd) return o;
        continue;
      }
      if (o.m === j.m) {
        var end = o.d + (o.span || 1) - 1;
        if (j.d >= o.d && j.d <= end) return o;
      }
    }
    return null;
  }

  /* رمضان: چون قمری است، تاریخ ثابت شمسی ندارد.
     تا وقتی تقویم قمری اضافه نشده، بازیکن می‌تواند خودش روشنش کند. */
  function ramadanOn() {
    try { return !!(A.state && A.state.M && A.state.M.ramadan); } catch (e) { return false; }
  }
  function setRamadan(v) {
    if (A.state && A.state.M) A.state.M.ramadan = v ? 1 : 0;
  }

  /* منحنی تقاضای امروز — در رمضان وارونه می‌شود */
  function demandTable() {
    return ramadanOn() ? D.RAMADAN_DEMAND : D.DEMAND;
  }

  /* ضریب کلی امروز: هوا × مناسبت */
  function todayMul(w) {
    var m = w ? w.mul : 1;
    var o = occasionToday();
    if (o && !o.ramadan) m *= o.mul;
    return m;
  }

  /* خلاصه‌ی امروز برای نمایش */
  function summary(cityIdx, dayIndex) {
    var w = weatherFor(cityIdx, dayIndex);
    var o = occasionToday();
    var j = CK.todayJalali();
    return {
      city: cityFor(cityIdx),
      weather: w,
      occasion: o,
      ramadan: ramadanOn(),
      season: SEASON_NAMES[seasonOf(j.m)],
      mul: todayMul(w)
    };
  }

  A.world = {
    cityFor: cityFor, seasonOf: seasonOf, SEASON_NAMES: SEASON_NAMES,
    weatherFor: weatherFor, weatherStationMul: weatherStationMul,
    occasionToday: occasionToday, ramadanOn: ramadanOn, setRamadan: setRamadan,
    demandTable: demandTable, todayMul: todayMul, summary: summary
  };
})(window.ABRO);
