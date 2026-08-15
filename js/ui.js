/* ═══════════════════════════════════════════════
   آبرو — رابط کاربری
   ═══════════════════════════════════════════════ */
(function (A) {
  'use strict';

  var U = A.util, D = A.data, St = A.state;
  var $ = U.$, fa = U.fa, money = U.money, clamp = U.clamp;

  var tab = 'shop', sheetOn = false, mult = '1';
  var openCard = null;   /* کدام ایستگاه تکه‌هایش باز است */
  var armPrestige = null, armReset = null;
  var goal = null;

  var TAB_TITLE = {
    shop: 'ایستگاه‌ها', menu: 'منوی امشب', crew: 'نیرو و جا', grow: 'رشد و واگذاری',
    book: 'دفترچه‌ی پدر', store: 'فروشگاه', more: 'دفتر'
  };

  /* ═════════ تب و شیت ═════════ */
  function openTab(t) {
    if (sheetOn && tab === t) { closeSheet(); return; }
    tab = t; sheetOn = true;
    document.querySelectorAll('.tab').forEach(function (b) {
      b.classList.toggle('sel', b.dataset.tab === t);
    });
    $('shTitle').textContent = TAB_TITLE[t];
    $('multSeg').hidden = t !== 'shop';
    $('sheet').classList.add('on');
    $('scrim').classList.add('on');
    buildSheet();
    A.audio.sfx.open();
  }
  function closeSheet() {
    if (!sheetOn) return;
    sheetOn = false;
    $('sheet').classList.remove('on');
    $('scrim').classList.remove('on');
    document.querySelectorAll('.tab').forEach(function (b) { b.classList.remove('sel'); });
    A.audio.sfx.close();
  }
  function isSheetOpen() { return sheetOn; }

  /* از لمس همان اجاق در صحنه می‌آید: تب ایستگاه‌ها باز شود، کارت
     همان ایستگاه باز شود، و خودش بیاید جلوی چشم */
  function openStation(id) {
    openCard = id;
    if (sheetOn && tab === 'shop') buildSheet();
    else { tab = 'shop'; sheetOn = false; openTab('shop'); }
    var el = document.querySelector('[data-wrap="' + id + '"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
  }
  function toggleCard(id) {
    openCard = openCard === id ? null : id;
    syncSheet();
    A.audio.sfx.open();
  }

  function svg(path) { return '<svg viewBox="0 0 24 24">' + path + '</svg>'; }

  /* ═════════ ساخت محتوای شیت ═════════ */
  function buildSheet() {
    var body = $('shBody');
    body.scrollTop = 0;
    if (tab === 'shop') body.innerHTML = htmlShop();
    else if (tab === 'menu') body.innerHTML = htmlMenu();
    else if (tab === 'crew') body.innerHTML = htmlCrew();
    else if (tab === 'grow') body.innerHTML = htmlGrow();
    else if (tab === 'book') body.innerHTML = htmlBook();
    else if (tab === 'store') body.innerHTML = htmlStore();
    else body.innerHTML = htmlMore();
    if (tab === 'more') paintAvatars();
    syncSheet();
  }

  function htmlShop() {
    return D.STATIONS.map(function (s) {
      return '<div class="cwrap" data-wrap="' + s.id + '">' +
        '<div class="card" data-card="' + s.id + '">' +
        '<div class="c-ico">' + svg(s.icon) + '<span class="lv" data-lv>۰</span></div>' +
        '<div class="c-mid"><div class="c-name">' + s.name +
        '<i class="caret" data-caret></i></div>' +
        '<div class="c-meta" data-meta>—</div>' +
        '<div class="c-bar"><i data-share style="width:0%"></i></div></div>' +
        '<button class="buy" data-up="' + s.id + '"><span data-t>ارتقا</span><span class="c" data-cost>—</span></button>' +
        '</div>' +
        '<div class="subgrid" data-sub="' + s.id + '" hidden></div>' +
        '</div>';
    }).join('') + '<div class="note" id="spaceNote">—</div>';
  }

  /* شبکه‌ی زیرقطعه‌های یک ایستگاه.
     فقط برای کارتِ باز ساخته می‌شود — دوازده شبکه‌ی همیشه‌روشن سه بار
     در ثانیه دوباره ساخته می‌شد و روی گوشی حس کندی می‌داد. */
  function subGridHTML(s) {
    var defs = St.subDefs(s.id), lv = St.subLevels(s.id), lvl = St.S.lvl[s.id];
    var focus = St.subFocusOf(s.id);
    if (!defs.length) return '';
    var cells = defs.map(function (d, i) {
      var open = d.at <= lvl;
      return '<button class="spart' + (open ? '' : ' lock') + (focus === i ? ' on' : '') + '"' +
        (open ? ' data-part="' + s.id + ':' + i + '"' : ' disabled') + '>' +
        '<b>' + d.name + '</b>' +
        '<span>' + (open ? fa(lv[i]) : 'سطح ' + fa(d.at)) + '</span>' +
        '</button>';
    }).join('');
    var nx = St.subNext(s.id);
    var note = focus >= 0
      ? 'هر سطح تازه می‌رود روی <b>' + defs[focus].name + '</b>. دوباره بزن تا آزاد شود.'
      : 'سطح‌های تازه خودشان می‌روند سراغ عقب‌مانده‌ترین تکه. روی هر تکه بزن تا فقط همان بزرگ شود.';
    if (nx) note += '<br>تکه‌ی بعدی: <b>' + nx.name + '</b> سرِ سطح ' + fa(nx.at) + '.';
    return '<div class="sgrid">' + cells + '</div><div class="snote">' + note + '</div>';
  }

  /* ═════════ منو ═════════ */
  function htmlMenu() {
    var dishes = D.MENU.map(function (d) {
      return '<div class="card dish" data-dish="' + d.id + '">' +
        '<div class="c-ico">' + svg(DISH_ICO) + '<span class="lv" data-fit>—</span></div>' +
        '<div class="c-mid"><div class="c-name">' + d.name + '</div>' +
        '<div class="c-meta" data-dmeta>—</div>' +
        '<div class="c-bar"><i data-dbar style="width:0%"></i></div></div>' +
        '<button class="buy" data-pick="' + d.id + '"><span data-pt>روی منو</span></button>' +
        '</div>';
    }).join('');

    var steps = D.PRICE_STEPS.map(function (p) {
      return '<button class="pstep" data-price="' + p.id + '">' + p.name + '</button>';
    }).join('');

    return '<div class="note" id="menuNote">—</div>' +
      '<div class="sechead">غذاهای امشب</div>' + dishes +
      '<div class="sechead">قیمت</div>' +
      '<div class="pbar">' + steps + '</div>' +
      '<div class="note" id="priceNote">—</div>' +
      '<div class="sechead">مجوز و رقیب</div>' +
      '<div class="card" id="licCard">' +
      '<div class="c-ico">' + svg('<path d="M5 3h14v18l-7-4-7 4z"/><path d="M9 9h6M9 13h4"/>') + '</div>' +
      '<div class="c-mid"><div class="c-name">مجوز</div><div class="c-meta" id="licMeta">—</div>' +
      '<div class="c-bar"><i id="licBar" style="width:0%"></i></div></div>' +
      '<button class="buy" id="licBtn"><span>گرفتن</span><span class="c" id="licCost">—</span></button></div>' +
      '<div class="card" id="rivalCard">' +
      '<div class="c-ico">' + svg('<path d="M4 20h16M6 20V9l6-5 6 5v11"/><path d="M10 20v-5h4v5"/>') + '</div>' +
      '<div class="c-mid"><div class="c-name">رقیب روبه‌رو</div><div class="c-meta" id="rivalMeta">—</div>' +
      '<div class="c-bar"><i id="rivalBar" style="width:0%"></i></div></div></div>' +
      '<div class="sechead">کارهای شب</div>' +
      D.MINIS.map(function (g) {
        return '<div class="card mini" data-mini="' + g.id + '">' +
          '<div class="c-ico">' + svg(g.icon) + '<span class="lv" data-mleft>۰</span></div>' +
          '<div class="c-mid"><div class="c-name">' + g.name + '</div>' +
          '<div class="c-meta" data-mmeta>—</div></div>' +
          '<button class="buy" data-play="' + g.id + '"><span>شروع</span></button>' +
          '</div>';
      }).join('') +
      '<div class="sechead">مشتری‌های همیشگی</div>' +
      D.REGULARS.map(function (r) {
        var d = St.menuDish(r.dish);
        return '<div class="regrow" data-reg="' + r.id + '">' +
          '<b>' + r.name + '</b>' +
          '<span>ساعت ' + fa(r.hour) + ' · ' + (d ? d.name : r.dish) + '</span>' +
          '<i data-regon>—</i></div>';
      }).join('');
  }
  var DISH_ICO = '<path d="M3 12h18a9 9 0 0 1-18 0z"/><path d="M12 3v3M7 21h10"/>';

  function htmlCrew() {
    return '<div class="card" id="hireCard">' +
      '<div class="c-ico">' + svg('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M18 8v6M15 11h6"/>') +
      '<span class="lv" id="hiredLv">۰</span></div>' +
      '<div class="c-mid"><div class="c-name">استخدام</div><div class="c-meta" id="hireMeta">—</div></div>' +
      '<button class="buy" id="hireBtn">استخدام<span class="c" id="hireCost">—</span></button></div>' +
      '<div class="note" id="crewNote">—</div>' +
      '<button class="autobtn" id="autoCrewBtn">' +
      svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>') +
      '<span>چیدن خودکار نیروها</span><i id="autoCrewInfo">—</i></button>' +
      '<div class="sechead">ایستگاه‌ها</div>' +
      D.STATIONS.map(function (s) {
        return '<div class="card" data-crewcard="' + s.id + '">' +
          '<div class="c-ico">' + svg(s.icon) + '</div>' +
          '<div class="c-mid"><div class="c-name">' + s.name + '</div>' +
          '<div class="c-meta" data-cmeta>—</div>' +
          '<div class="c-bar"><i data-manbar style="width:0%"></i></div></div>' +
          '<div class="powbox"><b data-pow>۰</b><i data-need>/۰</i></div>' +
          '</div>';
      }).join('') +
      '<div class="sechead">کارمندها</div>' +
      '<div id="staffList"></div>';
  }

  /* فهرست کارمندها — هر کارت یک نفر با نقش و درجه و جای فعلی */
  function staffListHTML() {
    var list = St.staffAll();
    if (!list.length) {
      return '<div class="note">هنوز کسی را استخدام نکرده‌ای. ' +
        'ایستگاه بدون نیرو فقط ۴۵٪ کار می‌کند.</div>';
    }
    /* نقش‌های کلی اول، بعد ایستگاهی — چون کلی‌ها تصمیم ندارند */
    var order = list.map(function (m, i) { return { m: m, i: i }; });
    order.sort(function (a, b) {
      var ga = A.staff.isGlobal(A.staff.role(a.m.r)) ? 0 : 1;
      var gb = A.staff.isGlobal(A.staff.role(b.m.r)) ? 0 : 1;
      if (ga !== gb) return ga - gb;
      return b.m.g - a.m.g;
    });

    return order.map(function (o) {
      var m = o.m, r = A.staff.role(m.r), g = A.staff.grade(m.g);
      var glob = A.staff.isGlobal(r);
      var where = glob ? 'دفتر' : (m.at ? stationName(m.at) : 'بیکار');
      var opts = '';
      if (!glob) {
        opts = '<select class="stsel" data-assign="' + o.i + '">' +
          '<option value=""' + (m.at ? '' : ' selected') + '>بیکار</option>' +
          D.STATIONS.filter(function (s) { return St.S.lvl[s.id] > 0; }).map(function (s) {
            var fit = r.st === s.id ? ' ✓' : '';
            return '<option value="' + s.id + '"' + (m.at === s.id ? ' selected' : '') + '>' +
              s.name + fit + '</option>';
          }).join('') + '</select>';
      }
      return '<div class="stcard g' + m.g + (glob ? ' glob' : '') + (m.at || glob ? '' : ' idle') + '">' +
        '<div class="st-ic">' + svg(r.icon) + '</div>' +
        '<div class="st-mid">' +
        '<div class="st-nm"><b>' + r.name + '</b>' +
        '<span class="st-g" style="color:' + g.color + '">' + g.name + '</span></div>' +
        '<div class="st-d">' + r.desc + '</div></div>' +
        (opts || '<span class="st-where">' + where + '</span>') +
        '</div>';
    }).join('');
  }
  function stationName(id) {
    for (var i = 0; i < D.STATIONS.length; i++) if (D.STATIONS[i].id === id) return D.STATIONS[i].name;
    return id;
  }
  /* امضای فهرست کارمندها — تا وقتی عوض نشده دوباره ساخته نشود،
     وگرنه هر ۳۲۰ میلی‌ثانیه منوی باز زیر دست بازیکن بسته می‌شود. */
  function staffSig() {
    return St.staffAll().map(function (m) { return m.r + m.g + (m.at || '-'); }).join('|') +
      '#' + D.STATIONS.filter(function (s) { return St.S.lvl[s.id] > 0; }).length;
  }

  function htmlGrow() {
    return '<div class="card" id="tierCard">' +
      '<div class="c-ico">' + svg('<path d="M3 21V10l9-6 9 6v11"/><path d="M9 21v-6h6v6"/>') + '</div>' +
      '<div class="c-mid"><div class="c-name" id="tierName">—</div><div class="c-meta" id="tierMeta">—</div>' +
      '<div class="c-bar"><i id="tierBar" style="width:0%"></i></div></div>' +
      '<button class="buy" id="tierBtn">ارتقا<span class="c" id="tierCost">—</span></button></div>' +
      '<div class="note" id="tierNote">—</div>' +
      '<div class="sechead">واگذاری</div>' +
      '<div class="card" id="prestigeCard">' +
      '<div class="c-ico">' + svg(D.MARK.abroo) + '</div>' +
      '<div class="c-mid"><div class="c-name">بسپار و برو شهر بعد</div>' +
      '<div class="c-meta">همه‌چیز صفر می‌شود. فقط آبرو با تو می‌آید.</div></div>' +
      '<button class="buy" id="prestigeBtn">واگذاری<span class="c" id="prestigeGain">—</span></button></div>' +
      '<div class="note" id="growNote">—</div>' +
      '<div class="sechead">مسیر</div>' +
      '<div class="roadmap" id="roadmap"></div>';
  }

  function htmlBook() {
    return '<div class="note" id="bookHead">—</div>' +
      D.BOOK.map(function (n) {
        return '<div class="node" data-node="' + n.id + '">' +
          '<div class="n-ic">' + svg(n.icon) + '</div>' +
          '<div class="n-mid"><div class="n-name">' + n.name + '</div>' +
          '<div class="n-desc" data-desc>—</div>' +
          '<div class="n-pips" data-pips></div></div>' +
          '<button class="n-buy" data-buy="' + n.id + '"><span data-t>ارتقا</span><span class="c" data-cost>—</span></button>' +
          '</div>';
      }).join('');
  }

  function htmlStore() {
    var items = D.SHOP_ITEMS.map(function (it) {
      return '<div class="card store-item" data-item="' + it.id + '">' +
        '<div class="c-ico gem">' + svg(it.icon) + '</div>' +
        '<div class="c-mid"><div class="c-name">' + it.name + '</div>' +
        '<div class="c-meta" data-imeta>' + it.desc + '</div></div>' +
        '<button class="buy gembuy" data-buyitem="' + it.id + '">' +
        '<span class="gemrow"><svg viewBox="0 0 24 24" class="gemi">' + D.MARK.gem + '</svg>' +
        fa(it.gems) + '</span></button></div>';
    }).join('');

    var packs = D.GEM_PACKS.map(function (p) {
      return '<button class="pack' + (p.best ? ' best' : '') + (p.hot ? ' hot' : '') +
        '" data-pack="' + p.id + '">' +
        (p.tag ? '<span class="pack-tag">' + p.tag + '</span>' : '') +
        '<span class="pack-gem"><svg viewBox="0 0 24 24">' + D.MARK.gem + '</svg></span>' +
        '<b>' + fa(p.gems) + '</b><span class="pack-price">' + p.price + '</span></button>';
    }).join('');

    /* بسته‌های ویژه — فقط آن‌هایی که شرطشان جور است */
    var bundles = D.BUNDLES.filter(St.packAvailable).map(function (b) {
      var give = A.game.packContents(b).map(function (c) {
        return '<span class="bd-item">' + c.text + '</span>';
      }).join('');
      return '<button class="bundle ' + (b.color || '') + '" data-pack="' + b.id + '">' +
        (b.tag ? '<span class="bd-tag">' + b.tag + '</span>' : '') +
        '<div class="bd-head">' +
        '<span class="bd-ic">' + svg(b.icon) + '</span>' +
        '<div><b>' + b.name + '</b><i>' + b.desc + '</i></div></div>' +
        '<div class="bd-give">' + give + '</div>' +
        '<span class="bd-price">' + b.price + '</span></button>';
    }).join('');

    var subBox = '';
    if (St.subActive()) {
      var ready = St.subChestReady();
      subBox = '<div class="subbox' + (ready ? ' ready' : '') + '">' +
        '<div class="sb-mid"><b>صندوق روزانه</b>' +
        '<i>' + fa(St.subDaysLeft()) + ' روز مانده</i></div>' +
        '<button class="sb-btn" id="subChestBtn"' + (ready ? '' : ' disabled') + '>' +
        (ready ? 'بگیر ۲۰' : 'فردا') + '</button></div>';
    }

    return '<div class="gembar"><span class="gembar-l">فیروزه‌ی تو</span>' +
      '<span class="gembar-v"><svg viewBox="0 0 24 24">' + D.MARK.gem + '</svg>' +
      '<b id="storeGems">۰</b></span></div>' +
      (A.billing.isTest()
        ? '<div class="testflag">حالت آزمایشی — هیچ درگاه پرداختی وصل نیست و هیچ پولی کم نمی‌شود</div>'
        : '') +
      subBox +
      (bundles ? '<div class="sechead">بسته‌های ویژه</div><div class="bundles">' + bundles + '</div>' : '') +
      '<div class="sechead">بسته‌های فیروزه</div>' +
      '<div class="packs">' + packs + '</div>' +
      '<div class="sechead">با فیروزه بخر</div>' + items +
      '<div class="sechead">فیروزه‌ی رایگان</div>' +
      '<button class="adbtn" id="adGemBtn">' +
      svg('<path d="M4 5h16v11H4z"/><path d="M10 8.5l4 2.5-4 2.5z"/><path d="M9 20h6"/>') +
      '<span><b>' + (St.adsDisabled() ? 'جایزه‌ی روزانه' : 'تماشای تبلیغ') +
      '</b><i id="adLeft">—</i></span><span class="adplus">+۲</span></button>';
  }

  function htmlMore() {
    var people = D.PEOPLE.map(function (p) {
      return '<div class="person" data-person="' + p.id + '">' +
        '<div class="p-av"><canvas width="92" height="92"></canvas></div>' +
        '<div class="p-mid"><div class="p-nm">' + p.name + '</div>' +
        '<div class="p-rl">' + p.role + '</div>' +
        '<div class="p-bar"><i data-bar style="width:0%"></i></div>' +
        '<div class="p-perk" data-perk>' + p.perk + '</div></div></div>';
    }).join('');

    var badges = D.BADGES.map(function (b) {
      return '<div class="bg" data-badge="' + b.id + '">' +
        '<div class="bi">' + svg(b.icon) + '</div>' +
        '<div class="bn">' + b.name + '</div>' +
        '<div class="bd">' + b.d + '</div></div>';
    }).join('');

    return '<div class="sechead">کوچه‌ی من</div>' +
      '<div class="namebox">' +
      '<input id="shopInput" maxlength="18" placeholder="اسم مغازه‌ات را بنویس">' +
      '<button id="shopSave">ثبت</button>' +
      '</div>' +
      '<div class="note" id="cityNote">—</div>' +
      '<div class="sechead">کارت‌ها</div>' +
      '<div class="note tiny">کارت را می‌سازی و خودت می‌فرستی. هیچ‌چیز خودکار جایی نمی‌رود.</div>' +
      '<div class="cardgrid">' +
      '<button class="cardbtn" data-card="recipe"><b>دستور پدر</b><i>دستور پختِ یکی از غذاهایت</i></button>' +
      '<button class="cardbtn" data-card="night"><b>کارت شب</b><i>فاکتور دیشب</i></button>' +
      '<button class="cardbtn" data-card="occasion"><b>کارت مناسبت</b><i>یلدا، نوروز، …</i></button>' +
      '<button class="cardbtn" data-card="code"><b>کد کوچه</b><i>کد خودت روی کارت</i></button>' +
      '</div>' +
      '<div class="sechead">کد همسایه</div>' +
      '<div class="note" id="codeNote">—</div>' +
      '<div class="namebox">' +
      '<input id="codeInput" maxlength="8" placeholder="کد همسایه را وارد کن">' +
      '<button id="codeGo">وارد کن</button>' +
      '</div>' +
      '<div class="sechead">دیشب</div>' +
      '<div class="note" id="ledger">—</div>' +
      '<div class="sechead">آدم‌ها</div>' + people +
      '<div class="sechead">نشان‌ها</div>' +
      '<div class="badges">' + badges + '</div>' +
      '<div class="sechead">آمار</div>' +
      '<div class="kv">' +
      '<div><span>شب‌ها</span><b id="kDay">۰</b></div>' +
      '<div><span>کل درآمد این دور</span><b id="kTotal">۰</b></div>' +
      '<div><span>واگذاری‌ها</span><b id="kRuns">۰</b></div>' +
      '<div><span>مشتری سرو شده</span><b id="kServed">۰</b></div>' +
      '<div><span>سفارش ویژه</span><b id="kGoals">۰</b></div>' +
      '<div><span>بهترین دور</span><b id="kBest">۰</b></div>' +
      '</div>' +
      '<div class="sechead">تصویر</div>' +
      '<div class="card" style="padding:11px">' +
      '<div class="c-mid"><div class="c-name">کیفیت تصویر</div>' +
      '<div class="c-meta" id="gfxMeta">—</div></div>' +
      '<div class="seg" id="gfxSeg">' +
      '<button data-q="2">کامل</button><button data-q="1">متوسط</button><button data-q="0">سبک</button>' +
      '</div></div>' +
      '<div class="sechead">تنظیمات</div>' +
      '<button class="dangerbtn" id="resetBtn">پاک کردن همه‌چیز و شروع از صفر</button>' +
      '<div class="note verline">آبرو — نسخه‌ی ' + fa(A.VERSION) + '</div>';
  }

  function paintAvatars() {
    D.PEOPLE.forEach(function (p) {
      var el = document.querySelector('[data-person="' + p.id + '"] canvas');
      if (el) A.scene.drawAvatar(el, p.look, St.stand(p.id));
    });
  }

  /* ═════════ هم‌گام‌سازی شیت ═════════ */
  function dotsHTML(n, f) {
    if (!n) return '<span class="dotsnone">این ایستگاه نیرو نمی‌خواهد</span>';
    var s = '';
    for (var i = 0; i < n; i++) s += '<span class="dot' + (i < f ? ' f' : '') + '"></span>';
    return s;
  }

  function syncSheet() {
    if (!sheetOn) return;
    var S = St.S, M = St.M;
    var r = St.rate(), used = St.spaceUsed(), cap = St.spaceCap(), free = St.crewFree();

    if (tab === 'shop') {
      var picks = St.bestPicks();
      D.STATIONS.forEach(function (s) {
        var el = document.querySelector('[data-card="' + s.id + '"]');
        if (!el) return;
        var locked = S.tier < s.tier, lvl = S.lvl[s.id], p = St.buyPlan(s, mult);
        var afford = !locked && !p.full && S.money >= p.c;
        el.classList.toggle('locked', locked);
        el.classList.toggle('ready', afford);
        el.classList.toggle('best', !locked && s.id === picks.buy);
        el.classList.toggle('target', !locked && s.id === picks.target);
        el.querySelector('[data-lv]').textContent = fa(lvl);
        var meta = el.querySelector('[data-meta]');
        var sr = St.stationRate(s);
        if (locked) meta.textContent = 'در پرده‌ی ' + fa(s.tier + 1) + ' باز می‌شود';
        else {
          /* جا محدود است، پس «هر جا چقدر می‌آورد» معیار درست خرید است */
          meta.innerHTML = '<b class="gain">+' + money(St.marginalGain(s)) + '</b> برای هر جا' +
            (lvl ? ' · الان ' + money(sr) + '/ث' : '');
        }
        el.querySelector('[data-share]').style.width = (r > 0 ? clamp(sr / r * 100, 0, 100) : 0) + '%';
        var b = el.querySelector('[data-up]');
        b.disabled = locked || p.full || p.n <= 0;
        b.classList.toggle('can', afford);
        b.querySelector('[data-t]').textContent = (lvl ? 'ارتقا' : 'راه‌اندازی') + (p.n > 1 ? ' ×' + fa(p.n) : '');
        b.querySelector('[data-cost]').textContent = p.full ? 'جا نیست' : money(p.c);

        /* تکه‌ها */
        var wrap = document.querySelector('[data-wrap="' + s.id + '"]');
        var sg = document.querySelector('[data-sub="' + s.id + '"]');
        var show = openCard === s.id && !locked;
        if (wrap) wrap.classList.toggle('open', show);
        if (sg) {
          sg.hidden = !show;
          /* تا سطح یا تکه‌ی انتخابی عوض نشده، دوباره ساخته نشود */
          var sig = lvl + ':' + St.subFocusOf(s.id);
          if (show && sg.dataset.sig !== sig) {
            sg.dataset.sig = sig;
            sg.innerHTML = subGridHTML(s);
          }
        }
      });
      var n = $('spaceNote');
      if (n) n.innerHTML = 'فضا: <b>' + fa(used) + ' از ' + fa(cap) + '</b> — هر سطح یک جا می‌گیرد. ' +
        'چون جا کم است، عددی که مهم است <b>«برای هر جا»</b> است نه قیمت. ' +
        'ایستگاه‌های تازه گران‌ترند ولی هر جایشان خیلی بیشتر می‌آورد.';

    } else if (tab === 'menu') {
      var slots = St.menuSlots(), on = St.menuList();
      var mood = A.clock.bandAt(S.hour), wx = St.weather();
      D.MENU.forEach(function (d) {
        var el = document.querySelector('[data-dish="' + d.id + '"]');
        if (!el) return;
        var open = St.menuOpen(d), picked = St.menuHas(d.id);
        var sc = St.dishScore(d);
        el.classList.toggle('locked', !open);
        el.classList.toggle('ready', picked && sc > 0);
        el.classList.toggle('picked', picked);
        el.querySelector('[data-fit]').textContent = open ? (sc > 0 ? '+' + fa(Math.round(sc * 100)) : fa(Math.round(sc * 100))) : '×';
        el.querySelector('[data-dmeta]').textContent = open
          ? (sc > 0 ? 'الان ساعتش است' + (wx && d.wx.indexOf(wx.id) >= 0 ? ' و هوایش هم' : '') : 'الان وقتش نیست — ' + d.desc)
          : 'در پرده‌ی ' + fa(d.tier + 1) + ' باز می‌شود';
        el.querySelector('[data-dbar]').style.width = clamp((sc + .05) / .16 * 100, 0, 100) + '%';
        var pb = el.querySelector('[data-pick]');
        pb.disabled = !open;
        pb.classList.toggle('can', open && (picked || on.length < slots));
        pb.querySelector('[data-pt]').textContent = picked ? 'بردار' : 'روی منو';
      });
      var mn = $('menuNote');
      if (mn) mn.innerHTML = 'الان <b>' + mood.name + '</b> است' + (wx ? ' و هوا <b>' + wx.name + '</b>' : '') +
        '. منو: <b>' + fa(on.length) + ' از ' + fa(slots) + '</b> — ضریب فروش <b>' +
        U.pct(St.menuMult() * 100) + '</b>.<br>' +
        'غذای درست سرِ ساعت درست می‌فروشد. دیگِ بی‌مشتری روی اجاق، ضرر است.';
      document.querySelectorAll('[data-price]').forEach(function (b) {
        b.classList.toggle('on', +b.dataset.price === St.priceStep());
      });
      var pn = $('priceNote'), pi = St.priceInfo();
      if (pn) pn.innerHTML = '<b>' + pi.name + '</b> — ' + pi.note + '<br>' +
        'از هر ده مشتری <b>' + fa(Math.round(St.priceFlow() * 10)) + '</b> می‌ماند، ' +
        'اثر نهایی روی فروش <b>' + U.pct(St.priceMult() * 100) + '</b>.<br>' +
        'اصالت بالا یعنی مردم پای قیمتت می‌ایستند؛ اصالت پایین یعنی نمی‌ایستند.';
      var lm = $('licMeta'), lb = $('licBtn');
      if (lm) {
        var left = St.licenceLeft();
        lm.textContent = left
          ? (fa(left) + ' شب اعتبار — بازرسی هر ' + fa(D.LICENCE.every) + ' شب')
          : 'نداری. شب بازرسی جریمه می‌شوی.';
        $('licBar').style.width = (left / D.LICENCE.days * 100) + '%';
        $('licCost').textContent = money(St.licenceCost());
        lb.disabled = !!left;
        lb.classList.toggle('can', !left && S.money >= St.licenceCost());
        $('licCard').classList.toggle('ready', !!left);
      }
      var rm = $('rivalMeta');
      if (rm) {
        var pw = St.rivalPower(), bite = 1 - St.rivalMult();
        rm.textContent = pw <= 0 ? 'هنوز جدی نیست'
          : (St.perkOn('raqib') ? 'رابطه‌تان خوب است — به تو نمی‌خورد'
            : 'الان ' + U.pct(bite * 100) + ' از فروشت را می‌برد');
        $('rivalBar').style.width = (pw * 100) + '%';
        $('rivalCard').classList.toggle('locked', pw <= 0);
      }
      D.MINIS.forEach(function (g) {
        var el = document.querySelector('[data-mini="' + g.id + '"]');
        if (!el) return;
        var open = St.miniOpen(g.id), left = St.miniLeft(g.id);
        el.classList.toggle('locked', !open);
        el.classList.toggle('ready', open && left > 0);
        el.querySelector('[data-mleft]').textContent = open ? fa(left) : '×';
        el.querySelector('[data-mmeta]').textContent = !open
          ? ('در پرده‌ی ' + fa(g.minTier + 1) + ' باز می‌شود')
          : (left > 0
            ? (g.desc + ' · ' + fa(left) + ' بار مانده امروز')
            : 'سهمیه‌ی امروز تمام شد');
        var b = el.querySelector('[data-play]');
        b.disabled = !open || left <= 0;
        b.classList.toggle('can', open && left > 0);
      });
      D.REGULARS.forEach(function (r) {
        var row = document.querySelector('[data-reg="' + r.id + '"]');
        if (!row) return;
        var has = St.menuHas(r.dish), came = (S.regDay || {})[r.id] === S.day;
        row.classList.toggle('off', !has);
        row.querySelector('[data-regon]').textContent = !has ? 'غذایش روی منو نیست'
          : (came ? 'امشب آمد' : 'منتظرش باش');
      });

    } else if (tab === 'crew') {
      var c = St.hireCost(), hb = $('hireBtn');
      var total = St.hiredCount();
      if (hb) {
        $('hiredLv').textContent = fa(total);
        $('hireCost').textContent = money(c);
        $('hireMeta').textContent = total
          ? ('دستمزد کل ' + money(St.wage()) + ' در هر هشت ساعت')
          : 'اولین نفر را بیاور';
        hb.classList.toggle('can', S.money >= c);
      }
      var cn = $('crewNote');
      var short = St.understaffed();
      if (cn) cn.innerHTML = 'بیکار: <b>' + fa(free) + '</b> از ' + fa(total) +
        ' — درجه‌ی بالاتر یعنی توان بیشتر، ولی دستمزد بیشتر هم می‌برد.' +
        (short ? '<br><b style="color:#f0a08e">' + fa(short) + ' ایستگاه توانِ کافی ندارد.</b>' : '');
      var ab = $('autoCrewBtn'), ai = $('autoCrewInfo');
      if (ab) {
        var can = free > 0 && short > 0;
        ab.classList.toggle('can', can);
        ab.disabled = !can;
        if (ai) ai.textContent = can
          ? (fa(Math.min(free, short)) + ' نفر جابه‌جا می‌شود')
          : (free <= 0 ? 'کسی بیکار نیست' : 'همه سرِ جایشان هستند');
      }
      D.STATIONS.forEach(function (s) {
        var el = document.querySelector('[data-crewcard="' + s.id + '"]');
        if (!el) return;
        var lvl = S.lvl[s.id], nd = St.crewNeed(s.id), pw = St.crewPower(s.id);
        var man = nd ? Math.min(1, pw / nd) : 1;
        el.classList.toggle('locked', !lvl);
        el.classList.toggle('ready', !!lvl && pw >= nd);
        el.querySelector('[data-cmeta]').textContent = lvl
          ? ('کارایی ' + U.pct((.45 + .55 * man) * 100))
          : 'هنوز راه نیفتاده';
        el.querySelector('[data-manbar]').style.width = (man * 100) + '%';
        /* توان، نه تعداد: استادِ آشپز پشت اجاق ۳٫۷۵ می‌ارزد */
        el.querySelector('[data-pow]').textContent = fa(pw.toFixed(1));
        el.querySelector('[data-need]').textContent = '/' + fa(nd);
      });
      var sl = $('staffList');
      if (sl && sl.dataset.sig !== staffSig()) {
        sl.dataset.sig = staffSig();
        sl.innerHTML = staffListHTML();
      }

    } else if (tab === 'grow') {
      var t = St.tier(), tb = $('tierBtn'), cost = St.tierCost();
      var blocked = St.tierBlocked();
      if (tb) {
        if (t.next) {
          $('tierName').textContent = t.next;
          $('tierMeta').textContent = t.nextMeta;
          $('tierCost').textContent = money(cost);
          $('tierBar').style.width = clamp(S.money / cost * 100, 0, 100) + '%';
          tb.disabled = false;
          tb.classList.toggle('can', !blocked);
        } else {
          $('tierName').textContent = 'بالاتر از این نیست';
          $('tierMeta').textContent = 'آخرین پرده. حالا فقط یک راه مانده.';
          $('tierCost').textContent = '—';
          $('tierBar').style.width = '100%';
          tb.disabled = true; tb.classList.remove('can');
        }
      }
      var tn = $('tierNote');
      if (tn) {
        var reqTxt = t.next
          ? ('سطح لازم: <b>' + fa(St.spaceUsed()) + ' از ' + fa(St.tierReq()) + '</b>' +
            (St.spaceUsed() < St.tierReq() ? ' — هنوز کم داری' : ' ✓'))
          : '';
        tn.innerHTML = 'پرده‌ی <b>' + fa(S.tier + 1) + ' از ' + fa(D.TIERS.length) + '</b> — ' + t.name +
          '. ضریب این پرده <b>×' + fa(t.mult) + '</b>.' + (reqTxt ? '<br>' + reqTxt : '');
      }
      var pc = $('prestigeCard'), pb = $('prestigeBtn');
      var ok = St.canPrestige();
      if (pc) pc.classList.toggle('locked', !ok);
      if (pb) {
        pb.disabled = !ok;
        pb.classList.toggle('can', ok);
        if (!armPrestige) {
          $('prestigeGain').textContent = ok ? '+' + fa(St.abrooGain()) + ' آبرو' : 'هنوز نه';
        }
      }
      var gn = $('growNote');
      if (gn) gn.innerHTML = 'هر آبرو <b>۵٪</b> به درآمد اضافه می‌کند. ضریب فعلی <b>×' +
        fa(St.abrooMult().toFixed(2)) + '</b>. آبرو خرج‌شدنی هم هست — در دفترچه‌ی پدر.';
      var rm = $('roadmap');
      if (rm) {
        rm.innerHTML = D.TIERS.map(function (x, i) {
          var cls = i < S.tier ? 'done' : (i === S.tier ? 'now' : '');
          var mark = i < S.tier ? '✓' : (i === S.tier ? '◆' : fa(i + 1));
          return '<div class="rm ' + cls + '"><span class="rm-m">' + mark + '</span>' +
            '<span class="rm-n">' + x.name + '</span>' +
            '<span class="rm-c">' + (x.next ? money(x.cost) : '—') + '</span></div>';
        }).join('');
      }

    } else if (tab === 'book') {
      var bh = $('bookHead');
      if (bh) bh.innerHTML = 'آبرو خرج‌کردنی: <b>' + fa(M.abroo) + '</b> — این ارتقاها هیچ‌وقت پاک نمی‌شوند، ' +
        'حتی بعد از واگذاری.';
      D.BOOK.forEach(function (nd) {
        var el = document.querySelector('[data-node="' + nd.id + '"]');
        if (!el) return;
        var lv = St.book(nd.id), maxed = lv >= nd.max, cost = nd.cost(lv);
        el.classList.toggle('max', maxed);
        el.querySelector('[data-desc]').textContent = maxed
          ? ('کامل — ' + nd.desc(lv - 1))
          : nd.desc(lv);
        var pips = '';
        for (var i = 0; i < nd.max; i++) pips += '<span class="pip' + (i < lv ? ' f' : '') + '"></span>';
        el.querySelector('[data-pips]').innerHTML = pips;
        var b = el.querySelector('[data-buy]');
        b.disabled = maxed || M.abroo < cost;
        b.classList.toggle('can', !maxed && M.abroo >= cost);
        b.querySelector('[data-t]').textContent = maxed ? 'کامل' : 'ارتقا';
        b.querySelector('[data-cost]').textContent = maxed ? '—' : fa(cost) + ' آبرو';
      });

    } else if (tab === 'store') {
      var sg = $('storeGems');
      if (sg) sg.textContent = fa(M.gems || 0);
      D.SHOP_ITEMS.forEach(function (it) {
        var el = document.querySelector('[data-item="' + it.id + '"]');
        if (!el) return;
        var can = (M.gems || 0) >= it.gems;
        el.classList.toggle('ready', can);
        var b = el.querySelector('[data-buyitem]');
        b.classList.toggle('can', can);
        var meta = el.querySelector('[data-imeta]');
        if (it.id === 'cash1') meta.textContent = 'همین حالا ' + money(Math.max(1000, St.rate() * 3600)) + ' ایر';
        else if (it.id === 'boost' && St.boostLeft() > 0) {
          meta.textContent = 'فعال — ' + fa(Math.ceil(St.boostLeft() / 60)) + ' دقیقه مانده';
        } else meta.textContent = it.desc;
      });
      var left = St.adsLeft();
      var al = $('adLeft');
      if (al) al.textContent = left > 0 ? (fa(left) + ' بار امروز مانده') : 'فردا دوباره پر می‌شود';
      var ab = $('adGemBtn');
      if (ab) ab.classList.toggle('spent', left <= 0);

    } else {
      var l = $('ledger');
      if (l) l.innerHTML = S.day ? ('شب <b>' + fa(S.day) + '</b>: ' + S.lastNote) : 'هنوز شبی را نبسته‌ای.';
      D.PEOPLE.forEach(function (p) {
        var el = document.querySelector('[data-person="' + p.id + '"]');
        if (!el) return;
        var v = St.stand(p.id), on = v >= p.at;
        var bar = el.querySelector('[data-bar]');
        bar.style.width = v + '%';
        bar.style.background = on
          ? 'linear-gradient(90deg,#3f8a4c,#7fd894)'
          : 'linear-gradient(90deg,#7a4636,#d99a52)';
        var pk = el.querySelector('[data-perk]');
        pk.classList.toggle('on', on);
        pk.textContent = (on ? '✓ ' : '') + p.perk + ' — الان ' + fa(Math.round(v));
      });
      D.BADGES.forEach(function (b) {
        var el = document.querySelector('[data-badge="' + b.id + '"]');
        if (el) el.classList.toggle('got', St.hasBadge(b.id));
      });
      var set = function (id, v) { var e = $(id); if (e) e.textContent = v; };
      var si = $('shopInput');
      if (si && document.activeElement !== si && si.dataset.set !== '1') {
        si.value = St.hasShopName() ? St.shopName() : '';
        si.dataset.set = '1';
      }
      var cn = $('cityNote'), ct = St.city(), rule = St.cityRule();
      if (cn && ct) {
        var bits = [];
        if (rule.sell) bits.push('فروش ' + U.pct(rule.sell * 100));
        if (rule.wage) bits.push('دستمزد ' + U.pct(rule.wage * 100));
        if (rule.tierCost) bits.push('هزینه‌ی پرده ' + U.pct(rule.tierCost * 100));
        if (rule.space) bits.push((rule.space > 0 ? '+' : '') + fa(rule.space) + ' جا');
        if (rule.rival) bits.push('رقیب از ' + U.pct(rule.rival * 100) + ' شروع کرده');
        if (rule.fine) bits.push('جریمه ×' + fa(rule.fine));
        cn.innerHTML = '<b>' + ct.name + '</b> — ' + ct.note + '<br>' +
          (ct.ruleNote || '') + (bits.length ? '<br><b>' + bits.join(' · ') + '</b>' : '') +
          '<br>اسم مغازه روی تابلو و روی همه‌ی کارت‌ها می‌نشیند.';
      }
      var kn = $('codeNote');
      if (kn) kn.innerHTML = 'کد تو: <b>' + St.myCode() + '</b> — کدِ همسایه که وارد کنی، ' +
        '۱۵ فیروزه می‌گیری. تا ده کد.<br>' +
        'تا حالا <b>' + fa(St.codesUsed().length) + '</b> کد وارد کرده‌ای.';
      set('kDay', fa(S.day));
      set('kTotal', money(S.total));
      set('kRuns', fa(M.runs));
      set('kServed', fa(S.served || 0));
      set('kGoals', fa(S.goalsDone || 0));
      set('kBest', money(M.bestTotal || 0));
      var stx = A.scene.stats();
      var gm = $('gfxMeta');
      if (gm) gm.textContent = fa(stx.ms) + ' میلی‌ثانیه در هر فریم';
      document.querySelectorAll('#gfxSeg button').forEach(function (b) {
        b.classList.toggle('on', +b.dataset.q === stx.quality);
      });
    }
  }

  /* ═════════ HUD ═════════ */
  var lastMoneyText = '';
  function syncHUD(disp, heat, alsoSheet) {
    var S = St.S, M = St.M, t = St.tier();
    var r = St.rate();
    var closed = St.isClosed();

    var mt = money(disp);
    if (mt !== lastMoneyText) { $('money').textContent = mt; lastMoneyText = mt; }
    $('abroo').textContent = fa(M.abroo);
    $('gems').textContent = fa(M.gems || 0);

    /* نوار نرخ */
    if (closed) {
      /* نشان دادن مبلغ تخمینی — «۲۰ دقیقه» به بازیکن نمی‌گوید چقدر گیرش می‌آید */
      var E = D.ECON;
      var hrs = clamp((Date.now() - S.closedAt) / 3600e3, 0, E.closedCap);
      var ing = D.ING[S.ing];
      var lr = S.closedRate > 0 ? S.closedRate : r;
      var gross = lr * 3600 * hrs * E.closedRate * (1 + .18 * St.book('night')) * ing.out;
      var est = Math.max(0, gross - gross * ing.cost - S.hired * St.wage() * (hrs / 8));
      var mins = Math.floor(hrs * 60);
      $('rateBadge').textContent = mins < 1
        ? 'بسته — تازه بستی'
        : 'بسته ' + fa(mins) + ' دقیقه — حدود ' + money(est);
      $('rateBadge').classList.add('closed');
    } else {
      $('rateBadge').textContent = r > 0 ? money(r) + ' ایر در ثانیه' : 'هنوز چیزی نمی‌آید';
      $('rateBadge').classList.remove('closed');
    }

    /* ساعت بازی، حال‌وهوای این ساعت، و تاریخ شمسیِ واقعی */
    var band = A.clock.bandAt(S.hour);
    $('ckTime').textContent = A.clock.label(S.hour);
    var mood = $('ckMood');
    mood.textContent = band.name + ' ×' + fa(band.mul.toFixed(2));
    mood.className = 'ck-mood ' + band.mood;
    $('ckDate').textContent = A.clock.dateLabel();

    /* هوای امروز */
    var wx = St.weather();
    if (wx) {
      var wxEl = $('ckWx');
      wxEl.querySelector('svg').innerHTML = wx.icon;
      wxEl.querySelector('b').textContent = wx.name;
      wxEl.className = 'ck-wx wx-' + wx.id;
      wxEl.title = wx.note;
    }

    /* مناسبت */
    var occ = St.occasion(), ob = $('occBar');
    if (occ) {
      ob.hidden = false;
      ob.querySelector('.oc-ic svg').innerHTML = occ.icon;
      $('occName').textContent = occ.name;
      $('occNote').textContent = occ.note;
      $('occMul').textContent = '×' + fa(occ.mul.toFixed(2));
    } else ob.hidden = true;

    /* نام شهر کنار نام مغازه — هر واگذاری یک شهر تازه */
    var cty = St.city();
    /* اسمی که بازیکن گذاشته جلوتر از اسم پرده می‌نشیند — تابلو مالِ اوست */
    $('shopName').textContent = St.shopName() + (cty ? ' · ' + cty.name : '');
    $('actLbl').textContent = 'پرده‌ی ' + fa(S.tier + 1) + '/' + fa(D.TIERS.length);
    $('integVal').textContent = fa(Math.round(S.integ));
    /* اصالت باید اثرش دیده شود، نه فقط عددش */
    $('integMul').textContent = '×' + fa(St.integMult().toFixed(2)) + ' درآمد';
    $('integProg').style.width = S.integ + '%';
    $('integTrack').classList.toggle('low', S.integ < 30);

    var cost = St.tierCost();
    var blocked = St.tierBlocked();
    var prog = t.next ? clamp(S.money / cost * 100, 0, 100) : 100;
    $('actProg').style.width = prog + '%';
    $('actTrack').classList.toggle('shine', !blocked && !!t.next);

    /* فضا و سطح لازم — دو عددی که تصمیم بازیکن را می‌سازند
       ولی قبلاً فقط داخل شیت دیده می‌شدند */
    var usedN = St.spaceUsed(), capN = St.spaceCap();
    var cs = $('chipSpace');
    cs.textContent = 'فضا ' + fa(usedN) + '/' + fa(capN);
    cs.classList.toggle('full', usedN >= capN);
    var cr = $('chipReq');
    if (t.next) {
      var need = St.tierReq(), ok = usedN >= need;
      cr.hidden = false;
      cr.textContent = (ok ? '✓ ' : '') + 'سطح ' + fa(usedN) + '/' + fa(need);
      cr.classList.toggle('ok', ok);
      cr.classList.toggle('warn', !ok && S.money >= cost);
    } else cr.hidden = true;

    /* دکمه‌ی سرو */
    var fabB = $('fabLabel'), fabS = $('fabSub');
    if (closed) {
      fabB.textContent = 'باز کن';
      fabS.textContent = 'مغازه';
      $('serveBtn').classList.add('closed');
    } else {
      fabB.textContent = 'سرو';
      fabS.textContent = heat > .08 ? '×' + fa((1 + heat).toFixed(1)) : 'مشتری';
      $('serveBtn').classList.remove('closed');
    }
    $('serveBtn').style.setProperty('--heat', (heat * 360).toFixed(0) + 'deg');
    $('serveBtn').classList.toggle('hot', heat > .6);
    $('shiftLabel').textContent = closed ? 'باز کردن' : 'بستن';

    /* کادو روی صحنه */
    var gh = $('giftHint');
    if (gh) gh.hidden = closed || !A.scene.hasGift();

    /* تقویت */
    var bl = St.boostLeft();
    var bc = $('boostChip');
    if (bl > 0) {
      bc.hidden = false;
      bc.querySelector('b').textContent = fa(Math.ceil(bl / 60)) + ' دقیقه';
    } else bc.hidden = true;

    /* نشان‌های تب */
    var used = St.spaceUsed(), cap = St.spaceCap();
    var bShop = false;
    if (used < cap && !closed) {
      for (var i = 0; i < D.STATIONS.length; i++) {
        var s = D.STATIONS[i];
        if (S.tier >= s.tier && S.money >= St.upCost(s)) { bShop = true; break; }
      }
    }
    $('bShop').hidden = !bShop;
    /* نشان نیرو باید وقتی ایستگاهی نیروی کم دارد هم روشن شود —
       قبلاً بازیکن متوجه افت کارایی نمی‌شد */
    $('bCrew').hidden = !(!closed && (
      (St.crewFree() > 0 && St.understaffed() > 0) ||
      (St.understaffed() > 0 && S.money >= St.hireCost())
    ));
    $('bGrow').hidden = !(t.next && !St.tierBlocked());
    var bBook = D.BOOK.some(function (n) {
      var lv = St.book(n.id);
      return lv < n.max && M.abroo >= n.cost(lv);
    });
    $('bBook').hidden = !bBook;
    var bStore = D.SHOP_ITEMS.some(function (it) { return (M.gems || 0) >= it.gems; });
    $('bStore').hidden = !bStore;

    if (alsoSheet !== false) syncSheet();
  }

  /* ═════════ سفارش ویژه ═════════ */
  function setGoal(g) { goal = g; syncGoal(); }
  function syncGoal() {
    var box = $('goalBox');
    if (!goal || St.isClosed()) { box.hidden = true; return; }
    box.hidden = false;
    $('goalText').textContent = goal.txt;
    $('goalProg').style.width = clamp(goal.have / goal.need * 100, 0, 100) + '%';
    var b = $('goalClaim');
    b.classList.toggle('ready', !!goal.done);
    b.textContent = goal.done ? 'بگیر' : (goal.left > 0 ? fa(Math.ceil(goal.left)) + 'ث' : '—');
  }

  /* ═════════ رویداد ═════════ */
  function showEvent(ev, night, onPick) {
    $('evKind').textContent = ev.k;
    $('evNight').textContent = 'شب ' + fa(night);
    $('evTitle').textContent = ev.t;
    $('evText').textContent = ev.x;

    var pick = $('evPick');
    pick.replaceChildren();
    ['a', 'c'].forEach(function (key) {
      var o = ev[key];
      var b = document.createElement('button');
      var chips = '';
      if (o.m) chips += '<span class="fxchip ' + (o.m > 0 ? 'pos' : 'neg') + '">پول ' + (o.m > 0 ? '+' : '−') + '</span>';
      if (o.i) chips += '<span class="fxchip ' + (o.i > 0 ? 'pos' : 'neg') + '">اصالت ' + (o.i > 0 ? '+' : '−') + fa(Math.abs(o.i)) + '</span>';
      if (o.p) {
        for (var k in o.p) {
          var per = D.PEOPLE.find(function (x) { return x.id === k; });
          if (per) chips += '<span class="fxchip ' + (o.p[k] > 0 ? 'pos' : 'neg') + '">' + per.name + '</span>';
        }
      }
      b.innerHTML = '<b>' + o.b + '</b><span class="why">' + o.s + '</span><span class="fx">' + chips + '</span>';
      b.addEventListener('click', function () { onPick(o); });
      pick.appendChild(b);
    });

    /* اول محتوا کامل ساخته می‌شود، بعد کارت نشان داده می‌شود —
       وگرنه یک لحظه دکمه‌های رویداد قبلی دیده می‌شد */
    $('evVeil').hidden = false;
    var art = $('evArt');
    art.width = Math.round((art.clientWidth || 380) * 2);
    art.height = Math.round((art.clientHeight || 96) * 2);
    A.scene.drawEventArt(art, ev.art || '', 0);
  }
  function hideEvent() { $('evVeil').hidden = true; }

  /* ═════════ فاکتور ═════════ */
  function showReceipt(d, onAd, onOk, onCopy) {
    $('rcTitle').textContent = d.closed ? 'گزارش شبِ بسته' : 'گزارش غیبت';
    $('rcSub').textContent = 'شب ' + fa(d.day) + ' — ' + d.tierName;
    var rows = [
      ['مدت', 0, '', U.timeAgo(d.hours * 3600)],
      ['فروش ناخالص', d.gross, 'pos'],
      ['مواد اولیه (' + D.ING[d.ing].label + ')', -d.ingCost, 'neg'],
      ['دستمزد ' + fa(d.hired) + ' نفر', -d.wages, 'neg']
    ];
    if (d.closed && Math.abs(d.luck - 1) > .1) {
      rows.push([d.luck > 1 ? 'شب بهتر از انتظار' : 'شب کساد', 0, d.luck > 1 ? 'pos' : 'neg',
      (d.luck > 1 ? '+' : '−') + fa(Math.round(Math.abs(d.luck - 1) * 100)) + '٪']);
    }
    $('rcRows').innerHTML = rows.map(function (row, i) {
      var val = row[3] != null ? row[3]
        : (row[1] ? ((row[1] < 0 ? '−' : '+') + money(Math.abs(row[1]))) : '—');
      return '<div class="r-row ' + row[2] + '" style="animation-delay:' + (i * 85 + 130) + 'ms">' +
        '<span class="k">' + row[0] + '</span><span class="num">' + val + '</span></div>';
    }).join('');
    /* تفکیک ساعت‌ها: بازیکن ببیند شبش کجا گذشت */
    var bd = $('rcBands');
    if (bd) {
      if (d.bands && d.bands.length) {
        bd.hidden = false;
        bd.innerHTML = '<div class="rb-t">از ' + A.clock.label(d.startHour) +
          ' تا ' + A.clock.label(d.startHour + d.hours) + '</div>' +
          d.bands.map(function (b) {
            var w = clamp(b.hours / d.hours * 100, 0, 100);
            return '<div class="rb-row"><span>' + b.name + '</span>' +
              '<span class="rb-bar"><i style="width:' + w + '%"></i></span>' +
              '<span class="num">' + fa(b.hours.toFixed(1)) + 'س</span></div>';
          }).join('');
      } else bd.hidden = true;
    }
    $('rcNote').textContent = d.note;
    $('rcNet').textContent = money(d.net);
    var ad = $('rcAd');
    ad.disabled = !d.adReady;
    ad.textContent = d.adReady
      ? 'تماشای تبلیغ: خالص شب دو برابر'
      : 'برای دو برابر کردن، حداقل ' + fa(D.ECON.adMinMinutes) + ' دقیقه بسته بماند';
    $('rcVeil').hidden = false;
    ad.onclick = onAd;
    $('rcOk').onclick = onOk;
    $('rcCopy').onclick = onCopy;
  }
  function setReceiptNet(v, done) {
    $('rcNet').textContent = money(v);
    if (done) { $('rcAd').disabled = true; $('rcAd').textContent = 'دو برابر شد'; }
  }
  function hideReceipt() { $('rcVeil').hidden = true; }

  /* ═════════ داوطلب تازه ═════════ */
  var hireTimer = null;
  function showHire(member) {
    var r = A.staff.role(member.r), g = A.staff.grade(member.g);
    var veil = $('hireVeil');
    veil.querySelector('.hc-ic').innerHTML = svg(r.icon);
    $('hcRole').textContent = r.name;
    $('hcGrade').textContent = g.name;
    $('hcGrade').style.color = g.color;
    $('hcDesc').textContent = r.desc;
    var card = veil.querySelector('.hirecard');
    card.className = 'hirecard g' + member.g;
    veil.hidden = false;
    clearTimeout(hireTimer);
    /* خودش می‌رود؛ استخدام پشت‌سرهم نباید هر بار یک کلیک اضافه بخواهد */
    hireTimer = setTimeout(hideHire, U.reduceMotion ? 600 : 2200);
    veil.onclick = hideHire;
  }
  function hideHire() {
    clearTimeout(hireTimer);
    var v = $('hireVeil');
    if (v) { v.hidden = true; v.onclick = null; }
  }

  /* ═════════ کادو ═════════ */
  function showGift(reward, onTake, onTriple) {
    var isAbroo = reward.type === 'abroo';
    var one = isAbroo ? (fa(reward.amount) + ' آبرو') : (money(reward.amount) + ' ایر');
    var three = isAbroo ? (fa(reward.amount * 3) + ' آبرو') : (money(reward.amount * 3) + ' ایر');
    $('giftKind').textContent = isAbroo ? 'یک نفر آبرویت را برد بالا' : 'یکی چیزی گذاشت کف دستت';
    $('giftOne').textContent = one;
    $('giftThree').textContent = three;
    var veil = $('giftVeil');
    veil.hidden = false;
    $('giftTake').onclick = onTake;
    $('giftTriple').onclick = onTriple;
    /* راه فرار: زدن بیرون کارت = گرفتن جایزه‌ی ساده.
       بدون این، اگر دکمه‌ای خطا بدهد کل بازی پشت مودال گیر می‌کند. */
    veil.onclick = function (e) { if (e.target === veil) onTake(); };
  }
  function hideGift() { $('giftVeil').hidden = true; }

  /* ═════════ مینی‌گیم ═════════ */
  function showMini(def) {
    $('miTitle').textContent = def.name;
    $('miDone').hidden = true;
    $('miStage').hidden = false;
    $('miVeil').hidden = false;
  }
  function miniResult(def, score, got) {
    var lines = money(got.cash) + ' ایر';
    if (got.gems) lines += ' + ' + fa(got.gems) + ' فیروزه';
    $('miStage').hidden = true;
    $('miPay').innerHTML = '<span class="mi-pct">' + fa(Math.round(score * 100)) + '٪</span>' + lines;
    $('miDone').hidden = false;
    $('miNote').textContent = score >= .85 ? 'کارِ استاد.'
      : score >= .5 ? 'بد نبود.'
        : 'دفعه‌ی بعد بهتر.';
  }
  function hideMini() { $('miVeil').hidden = true; }

  /* ═════════ پنل بخش ═════════
     همان چیزی که با تپ روی خودِ مغازه باز می‌شود: آمار بالا، نوار
     سطح، دکمه‌ی ارتقا، و شبکه‌ی تکه‌ها. تب‌ها فقط برای چیزهای
     بی‌مکان مانده‌اند. */
  var secId = null;

  function stationOf(id) {
    for (var i = 0; i < D.STATIONS.length; i++) if (D.STATIONS[i].id === id) return D.STATIONS[i];
    return null;
  }
  function showSection(id) {
    var s = stationOf(id);
    if (!s) return;
    secId = id;
    closeSheet();
    $('spIco').innerHTML = svg(s.icon);
    $('spName').textContent = s.name;
    $('spTitle').textContent = s.name;
    $('spNote').textContent = s.desc;
    $('secPanel').hidden = false;
    buildSecGrid();
    syncSection();
  }
  function hideSection() {
    secId = null;
    $('secPanel').hidden = true;
  }
  function sectionOpen() { return !!secId; }

  function buildSecGrid() {
    if (!secId) return;
    var defs = St.subDefs(secId), lv = St.subLevels(secId), focus = St.subFocusOf(secId);
    $('spGrid').innerHTML = defs.map(function (d, i) {
      var open = d.at <= St.S.lvl[secId];
      return '<button class="sp-cell' + (open ? '' : ' off') + (focus === i ? ' sel' : '') + '"' +
        (open ? ' data-part="' + secId + ':' + i + '"' : ' disabled') + '>' +
        '<span class="sp-cn">' + d.name + '</span>' +
        '<span class="sp-cl">' + (open ? fa(lv[i]) : 'سطح ' + fa(d.at)) + '</span>' +
        '</button>';
    }).join('');
    $('spGrid').dataset.sig = secSig();
  }
  function secSig() {
    if (!secId) return '';
    return secId + '|' + St.S.lvl[secId] + '|' + St.subLevels(secId).join(',') + '|' + St.subFocusOf(secId);
  }

  function syncSection() {
    if (!secId) return;
    var s = stationOf(secId), S = St.S;
    var lvl = S.lvl[secId], p = St.buyPlan(s, mult);
    var need = St.crewNeed(secId), pow = St.crewPower(secId);
    var man = need ? Math.min(1, pow / need) : 1;

    $('spRate').textContent = money(St.stationRate(s));
    $('spEff').textContent = lvl ? U.pct((.45 + .55 * man) * 100) : '—';
    $('spPow').textContent = fa(pow.toFixed(1)) + '/' + fa(need);
    $('spLvlNum').textContent = fa(lvl);

    var r = St.rate();
    var share = r > 0 ? clamp(St.stationRate(s) / r * 100, 0, 100) : 0;
    $('spBar').style.width = share + '%';
    $('spPct').textContent = U.pct(share);

    var locked = S.tier < s.tier;
    var b = $('spBuy');
    b.disabled = locked || p.full || p.n <= 0;
    b.classList.toggle('can', !locked && !p.full && S.money >= p.c);
    $('spBuyT').textContent = (lvl ? 'ارتقا' : 'راه‌اندازی') + (p.n > 1 ? ' ×' + fa(p.n) : '');
    $('spBuyC').textContent = locked ? 'قفل' : (p.full ? 'جا نیست' : money(p.c));
    $('spNote').textContent = lvl
      ? ('هر جا ' + money(St.marginalGain(s)) + ' اضافه می‌کند')
      : s.desc;

    if ($('spGrid').dataset.sig !== secSig()) buildSecGrid();
  }

  /* ═════════ پیش‌نمای کارت ═════════ */
  var cardNow = null;
  function showCard(canvas, kind) {
    if (!canvas) { A.audio.sfx.no(); U.toast('کارت ساخته نشد.', 'bad'); return; }
    cardNow = { canvas: canvas, kind: kind };
    var cv = $('cdCanvas'), g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(canvas, 0, 0);
    $('cdSend').textContent = A.share.canShare() ? 'فرستادن' : 'ذخیره در گوشی';
    $('cardVeil').hidden = false;
  }
  function hideCard() { $('cardVeil').hidden = true; cardNow = null; }
  function currentCard() { return cardNow; }

  /* ═════════ کارت تأیید خرید ═════════ */
  var ICONS = {
    gem: A.data.MARK.gem,
    coin: A.data.MARK.air,
    crew: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M18 8v6M15 11h6"/>',
    space: '<path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6"/>',
    abroo: A.data.MARK.abroo,
    noads: '<path d="M4 5h16v11H4z"/><path d="M9 20h6"/><path d="M4 5l16 11"/>'
  };

  function showPurchase(item, onConfirm, onCancel) {
    var name = item.name || (fa(item.gems) + ' فیروزه');
    $('pcName').textContent = name;
    $('pcPrice').textContent = item.price;
    $('pcTest').hidden = !A.billing.isTest();

    var rows = A.game.packContents(item).map(function (c) {
      return '<div class="pc-row"><span class="pc-ic">' +
        svg(ICONS[c.icon] || ICONS.gem) + '</span><span>' + c.text + '</span></div>';
    }).join('');
    $('pcGive').innerHTML = rows;

    var veil = $('pcVeil');
    veil.hidden = false;

    function close() {
      veil.hidden = true;
      veil.onclick = null;
      $('pcOk').onclick = null;
      $('pcNo').onclick = null;
    }
    $('pcOk').onclick = function () { close(); onConfirm(); };
    $('pcNo').onclick = function () { close(); if (onCancel) onCancel(); };
    veil.onclick = function (e) { if (e.target === veil) { close(); if (onCancel) onCancel(); } };
  }

  /* ═════════ کارت پرده ═════════ */
  var actTimer = null;
  function showAct(tierIndex, unlocked) {
    var t = D.TIERS[tierIndex];
    $('actNo').textContent = 'پرده‌ی ' + fa(tierIndex + 1) + ' — ' + t.place;
    $('actNm').textContent = t.name;
    $('actTx').textContent = t.intro;
    $('actUnlock').textContent = unlocked ? ('باز شد: ' + unlocked) : '';
    $('actVeil').hidden = false;
    A.audio.sfx.act();
    clearTimeout(actTimer);
    actTimer = setTimeout(function () { $('actVeil').hidden = true; }, U.reduceMotion ? 600 : 3400);
  }

  /* ═════════ پایان ═════════ */
  function showEnding(kind, stats, onClose) {
    var e = D.ENDINGS[kind];
    $('enT').textContent = e.t;
    $('enH').textContent = e.h;
    $('enP').innerHTML = e.p.map(function (p) { return '<p>' + p + '</p>'; }).join('');
    $('enStats').innerHTML = stats.map(function (s) {
      return '<div class="stat"><span>' + s[0] + '</span><b>' + s[1] + '</b></div>';
    }).join('');
    $('enVeil').hidden = false;
    $('enOk').onclick = onClose;
  }

  /* ═════════ راهنما ═════════ */
  var coachEl = null;
  function coach(text, anchorEl, dir, onDone) {
    hideCoach();
    if (!anchorEl) return;
    var el = document.createElement('div');
    el.className = 'coach ' + (dir || 'down');
    el.innerHTML = '<b>راهنما</b>' + text + '<button class="ok">باشد</button>';
    $('device').appendChild(el);
    coachEl = el;
    var a = anchorEl.getBoundingClientRect(), d = $('device').getBoundingClientRect();
    el.style.left = clamp(a.left - d.left + a.width / 2 - el.offsetWidth / 2, 8, d.width - el.offsetWidth - 8) + 'px';
    el.style.top = (dir === 'up' ? a.bottom - d.top + 10 : a.top - d.top - el.offsetHeight - 10) + 'px';
    el.querySelector('.ok').addEventListener('click', function () {
      hideCoach();
      if (onDone) onDone();
    });
  }
  function hideCoach() {
    if (coachEl) { coachEl.remove(); coachEl = null; }
  }

  /* ═════════ اتصال ═════════ */
  function init() {
    document.querySelectorAll('.tab').forEach(function (b) {
      b.addEventListener('click', function () { openTab(b.dataset.tab); });
    });
    $('scrim').addEventListener('click', closeSheet);

    document.querySelectorAll('#multSeg button').forEach(function (b) {
      b.addEventListener('click', function () {
        mult = b.dataset.m;
        document.querySelectorAll('#multSeg button').forEach(function (x) { x.classList.toggle('on', x === b); });
        syncSheet();
        A.audio.sfx.open();
      });
    });

    (function () {
      var y0 = null;
      var sh = $('sheet');
      sh.addEventListener('touchstart', function (e) { y0 = e.touches[0].clientY; }, { passive: true });
      sh.addEventListener('touchmove', function (e) {
        if (y0 === null) return;
        var dy = e.touches[0].clientY - y0;
        if (dy > 66 && $('shBody').scrollTop <= 0) { closeSheet(); y0 = null; }
      }, { passive: true });
      sh.addEventListener('touchend', function () { y0 = null; });
    })();

    $('shBody').addEventListener('click', function (e) {
      var G = A.game;
      var up = e.target.closest('[data-up]');
      if (up) { G.buyStation(up.dataset.up, mult, up); return; }
      var pl = e.target.closest('[data-play]');
      if (pl) { G.playMini(pl.dataset.play); return; }
      var pick = e.target.closest('[data-pick]');
      if (pick) { G.toggleDish(pick.dataset.pick); return; }
      var pr = e.target.closest('[data-price]');
      if (pr) { G.setPrice(+pr.dataset.price); return; }
      if (e.target.closest('#licBtn')) { G.buyLicence(e.target.closest('#licBtn')); return; }
      var part = e.target.closest('[data-part]');
      if (part) {
        var pv = part.dataset.part.split(':');
        G.focusPart(pv[0], +pv[1]);
        return;
      }
      var card = e.target.closest('[data-card]');
      if (card) { toggleCard(card.dataset.card); return; }
      if (e.target.closest('#hireBtn')) { G.hire(e.target.closest('#hireBtn')); return; }
      if (e.target.closest('#autoCrewBtn')) { G.autoCrew(); return; }
      if (e.target.closest('#tierBtn')) { G.upgradeTier(); return; }
      if (e.target.closest('#prestigeBtn')) { clickPrestige(); return; }
      var nb = e.target.closest('[data-buy]');
      if (nb) { G.buyBook(nb.dataset.buy); return; }
      var ib = e.target.closest('[data-buyitem]');
      if (ib) { G.buyItem(ib.dataset.buyitem, ib); return; }
      var pk = e.target.closest('[data-pack]');
      if (pk) { G.buyPack(pk.dataset.pack); return; }
      if (e.target.closest('#subChestBtn')) { G.claimSubChest(); return; }
      if (e.target.closest('#adGemBtn')) { G.watchAdForGems(); return; }
      if (e.target.closest('#resetBtn')) { clickReset(); return; }
      var q = e.target.closest('[data-q]');
      if (q) {
        A.scene.setQuality(+q.dataset.q);
        St.M.gfx = +q.dataset.q;
        St.save();
        A.audio.sfx.open();
        syncSheet();
        return;
      }
    });

    /* جابه‌جا کردن کارمند از منوی کشویی */
    $('shBody').addEventListener('change', function (e) {
      var sel = e.target.closest('[data-assign]');
      if (!sel) return;
      A.game.assignStaff(+sel.dataset.assign, sel.value);
    });

    $('goalClaim').addEventListener('click', function () { A.game.claimGoal(); });

    /* بستن مینی‌گیم: چه وسط بازی، چه سرِ نتیجه.
       اگر بازی هنوز در جریان باشد، لغو می‌شود تا حلقه‌اش نماند. */
    $('shBody').addEventListener('click', function (e) {
      var cb = e.target.closest('[data-card]');
      if (cb) { A.game.makeCard(cb.dataset.card); return; }
      if (e.target.closest('#shopSave')) { A.game.saveShopName($('shopInput').value); return; }
      if (e.target.closest('#codeGo')) { A.game.useCode($('codeInput').value); return; }
    });
    $('nextCity').addEventListener('click', function () { A.game.goNextCity(); });
    $('statusBtn').addEventListener('click', function () {
      var el = $('statusCard');
      el.hidden = !el.hidden;
      $('statusBtn').classList.toggle('on', !el.hidden);
      A.audio.sfx.open();
    });
    $('zoomBtn').addEventListener('click', function () {
      A.game.toggleCityView();
      A.audio.sfx.open();
    });
    $('spClose').addEventListener('click', hideSection);
    $('spBuy').addEventListener('click', function () {
      if (secId) A.game.buyStation(secId, mult, $('spBuy'));
    });
    $('spGrid').addEventListener('click', function (e) {
      var b = e.target.closest('[data-part]');
      if (!b) return;
      var pv = b.dataset.part.split(':');
      A.game.focusPart(pv[0], +pv[1]);
      buildSecGrid();
    });

    $('cdClose').addEventListener('click', hideCard);
    $('cdSave').addEventListener('click', function () { A.game.saveCard(); });
    $('cdSend').addEventListener('click', function () { A.game.sendCard(); });

    $('miQuit').addEventListener('click', function () {
      if (A.mini.busy()) { A.game.quitMini(); return; }
      hideMini();
    });
    $('miOk').addEventListener('click', function () {
      hideMini();
      syncSheet();
    });
  }

  function clickPrestige() {
    if (!St.canPrestige()) { A.audio.sfx.no(); return; }
    if (!armPrestige) {
      armPrestige = setTimeout(function () { armPrestige = null; syncSheet(); }, 4200);
      var el = $('prestigeGain');
      if (el) el.textContent = 'مطمئنی؟';
      U.toast('همه‌چیز صفر می‌شود. ' + fa(St.abrooGain()) + ' آبرو با تو می‌آید. دوباره بزن.');
      return;
    }
    clearTimeout(armPrestige); armPrestige = null;
    A.game.prestige();
  }
  function clickReset() {
    var b = $('resetBtn');
    if (!armReset) {
      armReset = setTimeout(function () {
        armReset = null;
        var x = $('resetBtn');
        if (x) x.textContent = 'پاک کردن همه‌چیز و شروع از صفر';
      }, 4200);
      if (b) b.textContent = 'مطمئنی؟ دوباره بزن — همه‌چیز می‌رود';
      return;
    }
    clearTimeout(armReset); armReset = null;
    A.game.hardReset();
  }

  A.ui = {
    init: init, openTab: openTab, closeSheet: closeSheet, isSheetOpen: isSheetOpen,
    openStation: openStation,
    buildSheet: buildSheet, syncSheet: syncSheet, syncHUD: syncHUD,
    setGoal: setGoal, syncGoal: syncGoal,
    showEvent: showEvent, hideEvent: hideEvent,
    showReceipt: showReceipt, setReceiptNet: setReceiptNet, hideReceipt: hideReceipt,
    showPurchase: showPurchase,
    showGift: showGift, hideGift: hideGift,
    showMini: showMini, miniResult: miniResult, hideMini: hideMini,
    showCard: showCard, hideCard: hideCard, currentCard: currentCard,
    showSection: showSection, hideSection: hideSection, sectionOpen: sectionOpen, syncSection: syncSection,
    showHire: showHire, hideHire: hideHire,
    showAct: showAct, showEnding: showEnding,
    coach: coach, hideCoach: hideCoach,
    paintAvatars: paintAvatars,
    getMult: function () { return mult; }
  };
})(window.ABRO);
