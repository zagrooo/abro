/* ═══════════════════════════════════════════════
   آبرو — لایه‌ی پرداخت

   ⚠️  حالت فعلی: آزمایشی. هیچ درگاهی وصل نیست.
       خرید داخل خود بازی تأیید می‌شود و جنس بلافاصله می‌رسد.

   برای انتشار واقعی فقط همین فایل عوض می‌شود:
   ۱. MODE را بگذار 'bazaar'
   ۲. داخل realBuy، Poolakey/IAB بازار را صدا بزن
   ۳. SKUها را در SKU_MAP بنویس
   بقیه‌ی بازی هیچ خبری از این تغییر ندارد.
   ═══════════════════════════════════════════════ */
(function (A) {
  'use strict';

  var MODE = 'test';          /* 'test' | 'bazaar' */

  /* نگاشت شناسه‌ی داخلی به SKU فروشگاه — روز انتشار پر می‌شود */
  var SKU_MAP = {
    g1: 'abroo_gems_50', g2: 'abroo_gems_120', g3: 'abroo_gems_320',
    g4: 'abroo_gems_900', g5: 'abroo_gems_2500',
    starter: 'abroo_pack_starter', growth: 'abroo_pack_growth',
    master: 'abroo_pack_master', daily: 'abroo_sub_daily',
    noads: 'abroo_noads'
  };

  function isTest() { return MODE === 'test'; }

  /* خرید آزمایشی: کارت تأیید داخل بازی */
  function testBuy(item, onOk, onCancel) {
    A.ui.showPurchase(item, function () {
      onOk({ test: true, sku: SKU_MAP[item.id] || item.id, at: Date.now() });
    }, onCancel);
  }

  /* اینجا روز انتشار پر می‌شود */
  function realBuy(item, onOk, onCancel) {
    /* نمونه‌ی ساختار مورد انتظار:
       Bazaar.purchase(SKU_MAP[item.id], function (receipt) {
         Bazaar.verify(receipt, function (valid) {
           if (valid) onOk(receipt); else onCancel('تأیید نشد');
         });
       }, onCancel);                                              */
    onCancel('درگاه پرداخت هنوز وصل نیست');
  }

  function buy(item, onOk, onCancel) {
    if (!item) { if (onCancel) onCancel('جنس پیدا نشد'); return; }
    if (isTest()) testBuy(item, onOk, onCancel);
    else realBuy(item, onOk, onCancel);
  }

  A.billing = {
    buy: buy,
    isTest: isTest,
    mode: function () { return MODE; },
    sku: function (id) { return SKU_MAP[id] || id; }
  };
})(window.ABRO);
