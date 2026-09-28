/* MG's Store — catálogo online */
'use strict';

/* ==========================================================
   Estado global
   ========================================================== */
var PRODUCTS = [];
var mode = 'retail';
var filter = 'Todas';
var priceFilter = 'all';
var sortMode = 'default';
var cart = {};

var toque = 730;
var trend = 'up';
var calc = 740;

var MARGINS = {
  up: 10,
  stable: 5,
  down: 0
};

var delivery = 'pickup';       // 'pickup' | 'ship'
var deliveryAddress = '';

var WA_NUMBER = '5358890678';
var SITE_URL = 'https://mgstores.pages.dev';
var FEATURED_SECTIONS = ['🔥 Más buscados', '⚡ Repuestos disponibles'];
var LOW_STOCK_THRESHOLD = 5;

/* ==========================================================
   Utilidades
   ========================================================== */
function $(id) { return document.getElementById(id); }

function fmt(n) {
  return new Intl.NumberFormat('es-CU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

function norm(s) {
  return String(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim();
}

function escapeHTML(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function currentMargin() {
  return MARGINS[trend] != null ? MARGINS[trend] : 0;
}

function recalc() {
  calc = toque + currentMargin();
}

/* ==========================================================
   Persistencia
   ========================================================== */
function loadState() {
  try { cart = JSON.parse(localStorage.getItem('mg_cart') || '{}'); } catch (e) { cart = {}; }

  var t = localStorage.getItem('mg_toque');
  if (t && Number(t) > 0) {
    toque = Number(t);
  } else {
    var r = localStorage.getItem('mg_rate');
    if (r && Number(r) > 0) {
      toque = Math.max(1, Number(r) - 10);
      localStorage.setItem('mg_toque', String(toque));
    }
  }

  var tr = localStorage.getItem('mg_trend');
  if (tr === 'up' || tr === 'stable' || tr === 'down') {
    trend = tr;
  }

  var d = localStorage.getItem('mg_delivery');
  if (d === 'pickup' || d === 'ship') {
    delivery = d;
  }

  var addr = localStorage.getItem('mg_delivery_address');
  if (addr) {
    deliveryAddress = addr;
  }

  recalc();

  var pf = localStorage.getItem('mg_price_filter');
  if (pf) priceFilter = pf;
  var sm = localStorage.getItem('mg_sort');
  if (sm) sortMode = sm;
}

function saveCart() { localStorage.setItem('mg_cart', JSON.stringify(cart)); }
function saveRate() {
  localStorage.setItem('mg_toque', String(toque));
  localStorage.setItem('mg_trend', trend);
}
function saveDelivery() {
  localStorage.setItem('mg_delivery', delivery);
  localStorage.setItem('mg_delivery_address', deliveryAddress);
}
function savePriceFilter() { localStorage.setItem('mg_price_filter', priceFilter); }
function saveSort() { localStorage.setItem('mg_sort', sortMode); }

/* ==========================================================
   Horario
   ========================================================== */
function updateOpenStatus() {
  var el = $('openStatus');
  var dot = $('statusDot');
  if (!el) return;

  var now = new Date();
  var utc = now.getTime() + now.getTimezoneOffset() * 60000;
  var cuba = new Date(utc - 5 * 3600000);

  var day = cuba.getDay();
  var hour = cuba.getHours();
  var min = cuba.getMinutes();
  var h = hour + min / 60;

  var isSunday = day === 0;
  var isSaturday = day === 6;

  var isOpen = false;
  if (!isSunday) {
    if (isSaturday) isOpen = (h >= 9 && h < 12);
    else isOpen = (h >= 9 && h < 17);
  }

  if (isOpen) {
    el.textContent = 'Abierto ahora · respondemos en minutos';
    if (dot) dot.classList.remove('closed');
  } else if (isSunday) {
    el.textContent = 'Domingo cerrado · te respondemos el lunes';
    if (dot) dot.classList.add('closed');
  } else if (isSaturday && h >= 12) {
    el.textContent = 'Sábado cerrado · abrimos el lunes a las 9 AM';
    if (dot) dot.classList.add('closed');
  } else if (h < 9) {
    el.textContent = 'Abrimos a las 9 AM · escríbenos, te respondemos';
    if (dot) dot.classList.add('closed');
  } else {
    el.textContent = 'Cerrado · abrimos mañana a las 9 AM';
    if (dot) dot.classList.add('closed');
  }
}

/* ==========================================================
   Tasa CUP
   ========================================================== */
function loadRate() {
  if ($('rateInput')) $('rateInput').value = toque;
  updateTrendUI();
  updateRateDisplay();
}

function updateRateDisplay() {
  if ($('calcRate')) $('calcRate').textContent = calc + ' CUP/USD';
  if ($('toqueRate')) $('toqueRate').textContent = toque;

  var badge = $('marginBadge');
  if (badge) {
    var m = currentMargin();
    var arrow = trend === 'up' ? '↑' : (trend === 'down' ? '↓' : '→');
    badge.textContent = (m > 0 ? '+' : '') + m + ' ' + arrow;
    badge.classList.remove('margin-up', 'margin-stable', 'margin-down');
    badge.classList.add('margin-' + trend);
  }
}

function updateRateSource(updatedAt, source) {
  var el = $('rateSource');
  if (!el) return;

  if (!updatedAt) {
    el.textContent = 'Manual';
    el.classList.remove('auto');
    return;
  }

  var mins = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60000);
  var cuando;
  if (mins < 1) cuando = 'ahora';
  else if (mins < 60) cuando = 'hace ' + mins + ' min';
  else if (mins < 1440) cuando = 'hace ' + Math.floor(mins / 60) + ' h';
  else cuando = 'hace ' + Math.floor(mins / 1440) + ' d';

  if (source && source.indexOf('elTOQUE') !== -1) {
    el.textContent = 'Auto · ' + cuando;
    el.classList.add('auto');
  } else {
    el.textContent = 'Manual · ' + cuando;
    el.classList.remove('auto');
  }
}

function updateTrendUI() {
  var btns = { up: $('trendUp'), stable: $('trendStable'), down: $('trendDown') };
  Object.keys(btns).forEach(function (k) {
    var b = btns[k];
    if (!b) return;
    b.classList.toggle('active', k === trend);
    b.setAttribute('aria-checked', k === trend ? 'true' : 'false');
  });
}

function setTrend(t) {
  if (t !== 'up' && t !== 'stable' && t !== 'down') return;
  trend = t;
  recalc();
  saveRate();
  updateTrendUI();
  updateRateDisplay();
  render();
  renderFeatured();
}

function applyRate() {
  var v = Number($('rateInput').value);
  if (!v || v <= 0) return alert('Tasa inválida');

  toque = v;
  recalc();
  saveRate();
  updateRateDisplay();
  render();
  renderFeatured();
}

/* ==========================================================
   Carga de datos
   ========================================================== */
function load() {
  Promise.all([
    fetch('datos/catalogo.json?v=' + Date.now()).then(function (r) {
      if (!r.ok) throw new Error('catalogo HTTP ' + r.status);
      return r.json();
    }),
    fetch('datos/tasa.json?v=' + Date.now()).then(function (r) {
      if (!r.ok) return null;
      return r.json();
    }).catch(function () { return null; })
  ]).then(function (results) {
    var d = results[0];
    var t = results[1];

    PRODUCTS = Array.isArray(d) ? d : (d.items || []);

    if (t && t.calc && t.toque && t.trend) {
      toque = Number(t.toque);
      trend = t.trend;
      calc = Number(t.calc);
      if ($('rateInput')) $('rateInput').value = toque;
      updateTrendUI();
      updateRateDisplay();
      updateRateSource(t.updated_at, t.source);
    } else {
      updateRateSource(null, null);
    }

    document.title = "MG's Store | " + PRODUCTS.length + " repuestos";
    render();
    renderFeatured();
    restoreDeliveryUI();
  }).catch(function (e) {
    console.error(e);
    $('grid').innerHTML = '<p class="notice" style="grid-column:1/-1">No se pudo cargar el catálogo. Verifica tu conexión e intenta de nuevo.</p>';
  });
}

/* ==========================================================
   Entrega
   ========================================================== */
function restoreDeliveryUI() {
  var wrap = $('deliveryAddressWrap');
  var ta = $('deliveryAddress');
  if (ta) ta.value = deliveryAddress;

  var p = $('delivPickup');
  var s = $('delivShip');
  if (p && s) {
    p.classList.toggle('active', delivery === 'pickup');
    s.classList.toggle('active', delivery === 'ship');
    p.setAttribute('aria-checked', delivery === 'pickup' ? 'true' : 'false');
    s.setAttribute('aria-checked', delivery === 'ship' ? 'true' : 'false');
  }
  if (wrap) wrap.style.display = (delivery === 'ship') ? 'block' : 'none';
}

function setDelivery(d) {
  if (d !== 'pickup' && d !== 'ship') return;
  delivery = d;
  saveDelivery();
  restoreDeliveryUI();
}

function saveAddress(v) {
  deliveryAddress = v || '';
  saveDelivery();
}

/* ==========================================================
   Modo
   ========================================================== */
function setMode(m) {
  mode = m;
  $('wh').classList.toggle('active', m === 'wholesale');
  $('rt').classList.toggle('active', m === 'retail');
  render();
  renderFeatured();
}

/* ==========================================================
   Filtros
   ========================================================== */
function categories() {
  var set = {};
  PRODUCTS.forEach(function (p) { if (p.cat) set[p.cat] = 1; });
  var cs = ['Todas'].concat(Object.keys(set).sort());
  $('filters').innerHTML = cs.map(function (c) {
    var active = (filter === c) ? ' active' : '';
    return '<button type="button" class="' + active.trim() + '" onclick="setFilter(\'' + c.replace(/'/g, "\\'") + '\')">' + c + '</button>';
  }).join('');
}

function setFilter(c) {
  filter = c;
  updatePdfCategoryLabel();
  render();
}

function setPriceFilter(v) {
  priceFilter = v;
  savePriceFilter();
  render();
}

function setSort(v) {
  sortMode = v;
  saveSort();
  render();
}

function priceInRange(price) {
  if (price == null) return false;
  if (priceFilter === 'lt5') return price < 5;
  if (priceFilter === '5to20') return price >= 5 && price < 20;
  if (priceFilter === '20to50') return price >= 20 && price < 50;
  if (priceFilter === 'gt50') return price >= 50;
  return true;
}

function sortList(list) {
  var priceOf = function (p) { return mode === 'wholesale' ? p.wholesale : p.retail; };
  var copy = list.slice();
  if (sortMode === 'price-asc') {
    copy.sort(function (a, b) {
      var pa = priceOf(a), pb = priceOf(b);
      if (pa == null) return 1;
      if (pb == null) return -1;
      return pa - pb;
    });
  } else if (sortMode === 'price-desc') {
    copy.sort(function (a, b) {
      var pa = priceOf(a), pb = priceOf(b);
      if (pa == null) return 1;
      if (pb == null) return -1;
      return pb - pa;
    });
  } else if (sortMode === 'name-asc') {
    copy.sort(function (a, b) { return a.name.localeCompare(b.name, 'es'); });
  } else if (sortMode === 'stock-desc') {
    copy.sort(function (a, b) { return (b.stock || 0) - (a.stock || 0); });
  }
  return copy;
}

/* ==========================================================
   Card HTML
   ========================================================== */
function cardHTML(p, opts) {
  opts = opts || {};
  var featured = opts.featured === true;
  var price = mode === 'wholesale' ? p.wholesale : p.retail;
  var can = price != null && (p.disponible || p.stock > 0);
  var isLow = p.stock > 0 && p.stock < LOW_STOCK_THRESHOLD;
  var stockLabel = p.stock > 0
    ? '🟢 ' + p.stock + ' disponibles'
    : (p.disponible ? '🟡 Consultar' : '⚪ Agotado');
  var priceHTML = price != null
    ? '<div class="price">$' + fmt(price) + ' USD</div><div class="cup">$' + fmt(price * calc) + ' CUP</div>'
    : '<div class="small">Precio no definido</div>';

  if (featured) {
    var featPrice = price != null ? '<div class="featured-price">$' + fmt(price) + '</div>' : '';
    return '<article class="featured-card" onclick="add(\'' + p.code + '\')">' +
      '<div class="pic">' +
        '<img src="' + p.photo + '" alt="' + escapeHTML(p.name) + '" loading="lazy" ' +
             'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\'">' +
        '<span class="noimg" style="display:none">' + escapeHTML(p.code) + '</span>' +
      '</div>' +
      '<div class="featured-body">' +
        '<div class="code">' + escapeHTML(p.code) + '</div>' +
        '<h3>' + escapeHTML(p.name) + '</h3>' +
        featPrice +
      '</div>' +
    '</article>';
  }

  var ribbon = isLow ? '<div class="card-ribbon">¡Últimas!</div>' : '';
  var stockClass = isLow ? 'stock low' : 'stock';
  var stockText = isLow ? '⚡ Solo quedan ' + p.stock : stockLabel;

  return '<article class="card">' +
    ribbon +
    '<div class="pic">' +
      '<img src="' + p.photo + '" alt="' + escapeHTML(p.name) + '" loading="lazy" width="235" height="180" ' +
           'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\'">' +
      '<span class="noimg" style="display:none">Foto pendiente</span>' +
    '</div>' +
    '<div class="body">' +
      '<div class="code">' + escapeHTML(p.code) + '</div>' +
      '<h3>' + escapeHTML(p.name) + '</h3>' +
      priceHTML +
      (mode === 'wholesale' ? '<span class="badge">Mínimo 5 unidades</span>' : '') +
      '<div class="' + stockClass + '">' + stockText + '</div>' +
      '<button type="button" class="add ' + (can ? '' : 'disabled') + '" ' + (can ? '' : 'disabled') + ' ' +
              'onclick="add(\'' + p.code + '\')">' +
        (can ? '🛒 Añadir al carrito' : 'No disponible') +
      '</button>' +
    '</div>' +
  '</article>';
}

/* ==========================================================
   Render
   ========================================================== */
function render() {
  categories();
  var q = norm($('search').value || '');

  var list = PRODUCTS.filter(function (p) {
    if (!p.disponible && p.stock === 0) return false;
    if (filter !== 'Todas' && p.cat !== filter) return false;
    if (q && norm(p.name + ' ' + p.code).indexOf(q) === -1) return false;
    if (mode === 'wholesale' && p.wholesale == null) return false;
    var price = mode === 'wholesale' ? p.wholesale : p.retail;
    if (!priceInRange(price)) return false;
    return true;
  });

  list = sortList(list);

  var countEl = $('productCount');
  if (countEl) {
    countEl.textContent = (list.length === 1) ? '1 producto' : list.length + ' productos';
  }

  if (!list.length) {
    $('grid').innerHTML = '';
    $('empty').style.display = 'block';
    cartRender();
    return;
  }
  $('empty').style.display = 'none';
  $('grid').innerHTML = list.map(function (p) { return cardHTML(p); }).join('');
  cartRender();
}

/* ==========================================================
   Destacados
   ========================================================== */
function renderFeatured() {
  var section = $('featuredSection');
  if (!section) return;

  var featured = PRODUCTS.filter(function (p) {
    if (!p.seccion) return false;
    var match = FEATURED_SECTIONS.some(function (s) { return p.seccion.indexOf(s) !== -1; });
    if (!match) return false;
    if (!p.disponible && p.stock === 0) return false;
    if (mode === 'wholesale' && p.wholesale == null) return false;
    return true;
  }).slice(0, 12);

  if (!featured.length) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';
  $('featuredGrid').innerHTML = featured.map(function (p) {
    return cardHTML(p, { featured: true });
  }).join('');

  requestAnimationFrame(function () { updateFeaturedArrows(); });
}

/* ==========================================================
   Carrusel
   ========================================================== */
function scrollFeatured(direction) {
  var grid = $('featuredGrid');
  if (!grid) return;
  var card = grid.querySelector('.featured-card');
  if (!card) return;
  var cardWidth = card.offsetWidth + 10;
  grid.scrollBy({ left: direction * cardWidth * 2, behavior: 'smooth' });
}

function updateFeaturedArrows() {
  var grid = $('featuredGrid');
  if (!grid) return;
  var wrap = grid.parentElement;
  var prev = $('featPrev');
  var next = $('featNext');
  if (!wrap || !prev || !next) return;

  var atStart = grid.scrollLeft <= 2;
  var atEnd = grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - 2;

  prev.disabled = atStart;
  next.disabled = atEnd;

  wrap.classList.toggle('has-left', !atStart);
  wrap.classList.toggle('has-right', !atEnd);
}

function initFeaturedNav() {
  var grid = $('featuredGrid');
  if (!grid) return;
  grid.addEventListener('scroll', updateFeaturedArrows, { passive: true });
  window.addEventListener('resize', updateFeaturedArrows);
}

/* ==========================================================
   Carrito
   ========================================================== */
function add(code) {
  var p = PRODUCTS.filter(function (x) { return x.code === code; })[0];
  if (!p) return;
  var price = mode === 'wholesale' ? p.wholesale : p.retail;
  if (price == null) {
    alert('Este producto no tiene precio en la modalidad actual.');
    return;
  }
  cart[code] = (cart[code] || 0) + 1;
  saveCart();
  cartRender();
  openCart();
}

function change(code, d) {
  cart[code] = (cart[code] || 0) + d;
  if (cart[code] <= 0) delete cart[code];
  saveCart();
  cartRender();
}

function clearCart() {
  if (!confirm('¿Vaciar el carrito?')) return;
  cart = {};
  saveCart();
  cartRender();
}

function openCart() { $('cartOverlay').classList.add('open'); }
function closeCart() { $('cartOverlay').classList.remove('open'); }
function overlayClose(e) { if (e.target.id === 'cartOverlay') closeCart(); }

function cartRender() {
  var html = '', usd = 0, count = 0;
  Object.keys(cart).forEach(function (c) {
    var q = cart[c];
    var p = PRODUCTS.filter(function (x) { return x.code === c; })[0];
    if (!p) return;
    var price = mode === 'wholesale' ? p.wholesale : p.retail;
    if (price == null) return;
    usd += price * q;
    count += q;
    html += '<div class="line">' +
      '<span>' + q + ' × ' + escapeHTML(p.name) + '</span>' +
      '<span>$' + fmt(price * q) + '</span>' +
      '<span class="qty">' +
        '<button type="button" onclick="change(\'' + c + '\',-1)">−</button>' +
        '<button type="button" onclick="change(\'' + c + '\',1)">+</button>' +
      '</span>' +
    '</div>';
  });
  $('cartLines').innerHTML = html || '<div class="cart-empty"><div class="cart-empty-icon">🛒</div><p>Añade productos para preparar tu pedido</p></div>';
  $('count').textContent = count + ' unidades';
  $('floatingCount').textContent = count;
  $('usd').textContent = fmt(usd);
  $('cup').textContent = fmt(usd * calc);
  $('applied').textContent = calc;
}

/* ==========================================================
   Pedido
   ========================================================== */
function buildOrderText() {
  var rows = [], usd = 0;
  Object.keys(cart).forEach(function (c) {
    var q = cart[c];
    var p = PRODUCTS.filter(function (x) { return x.code === c; })[0];
    if (!p) return;
    var price = mode === 'wholesale' ? p.wholesale : p.retail;
    if (price == null) return;
    usd += price * q;
    rows.push(q + ' x ' + p.name + ' [' + p.code + '] — ' + fmt(price * q) + ' USD');
  });
  if (!rows.length) return null;

  var trendLabel = trend === 'up' ? 'subiendo' : (trend === 'down' ? 'bajando' : 'estable');
  var margin = currentMargin();

  var entregaTexto;
  if (delivery === 'ship') {
    entregaTexto = 'ENVIAR POR MENSAJERÍA\nDirección: ' + (deliveryAddress.trim() || '(sin especificar)');
  } else {
    entregaTexto = 'RECOGER EN TIENDA\n(Guanabacoa, La Habana)';
  }

  var text =
    "MG'S STORE — PEDIDO\n\n" +
    "Modalidad: " + (mode === 'wholesale' ? 'MAYORISTA' : 'MINORISTA') + "\n" +
    "Entrega: " + entregaTexto + "\n\n" +
    rows.join('\n') + "\n\n" +
    "TOTAL USD: " + fmt(usd) + "\n" +
    "TOTAL CUP: " + fmt(usd * calc) + "\n" +
    "TASA: " + calc + " CUP/USD (elTOQUE " + toque + " " + trendLabel + (margin > 0 ? " +" + margin : "") + ")\n\n" +
    "Por favor confirmar disponibilidad, condiciones de pago y entrega.";

  return { text: text, total: usd };
}

function validarPedido() {
  if (mode === 'wholesale') {
    var keys = Object.keys(cart);
    for (var i = 0; i < keys.length; i++) {
      if (cart[keys[i]] < 5) {
        alert('Cada producto mayorista debe tener mínimo 5 unidades.');
        return false;
      }
    }
  }
  if (delivery === 'ship' && !deliveryAddress.trim()) {
    alert('Por favor escribe la dirección de entrega para el envío por mensajería.');
    var ta = $('deliveryAddress');
    if (ta) {
      ta.focus();
      if (ta.scrollIntoView) ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return false;
  }
  return true;
}

function sendWhatsApp() {
  if (!validarPedido()) return;
  var order = buildOrderText();
  if (!order) return alert('El carrito está vacío.');
  window.open('https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(order.text), '_blank');
}

function copyOrder() {
  if (!validarPedido()) return;
  var order = buildOrderText();
  if (!order) return alert('El carrito está vacío.');

  var btn = $('copyBtn');
  var label = $('copyBtnText');

  function done() {
    btn.classList.add('copied');
    label.textContent = '¡Copiado!';
    setTimeout(function () {
      btn.classList.remove('copied');
      label.textContent = 'Copiar pedido';
    }, 2000);
  }

  function fallbackCopy() {
    var ta = document.createElement('textarea');
    ta.value = order.text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      done();
    } catch (e) {
      alert('No se pudo copiar. Selecciona manualmente el texto.');
    }
    document.body.removeChild(ta);
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(order.text).then(done).catch(fallbackCopy);
  } else {
    fallbackCopy();
  }
}

/* ==========================================================
   Cómo comprar
   ========================================================== */
function openHowto() { $('howtoOverlay').classList.add('open'); }
function closeHowto() { $('howtoOverlay').classList.remove('open'); }
function overlayHowtoClose(e) { if (e.target.id === 'howtoOverlay') closeHowto(); }

/* ==========================================================
   Menú PDF
   ========================================================== */
function togglePdfMenu(e) {
  if (e) e.stopPropagation();
  var menu = $('pdfMenu');
  if (!menu) return;
  var visible = menu.style.display !== 'none';
  menu.style.display = visible ? 'none' : 'block';
  if (!visible) updatePdfCategoryLabel();
}

function closePdfMenu() {
  var menu = $('pdfMenu');
  if (menu) menu.style.display = 'none';
}

function updatePdfCategoryLabel() {
  var el = $('pdfCategoryLabel');
  if (!el) return;
  if (filter && filter !== 'Todas') {
    el.textContent = filter + ' · ' + countByCategory(filter) + ' productos';
  } else {
    el.textContent = 'Selecciona una categoría primero';
  }
}

function countByCategory(cat) {
  return PRODUCTS.filter(function (p) {
    return (p.cat === cat) && (p.disponible || p.stock > 0);
  }).length;
}

document.addEventListener('click', function (e) {
  var menu = $('pdfMenu');
  if (!menu || menu.style.display === 'none') return;
  var wrap = document.querySelector('.pdf-wrap');
  if (wrap && !wrap.contains(e.target)) closePdfMenu();
});

/* ==========================================================
   PDF
   ========================================================== */
function descargarPDF(tipo) {
  closePdfMenu();

  var list = PRODUCTS.filter(function (p) { return p.disponible || p.stock > 0; });

  if (tipo === 'light') {
    // sin fotos
  } else if (tipo === 'category') {
    if (!filter || filter === 'Todas') {
      alert('Selecciona primero una categoría en los filtros.');
      return;
    }
    list = list.filter(function (p) { return p.cat === filter; });
  } else if (tipo === 'wholesale') {
    list = list.filter(function (p) { return p.wholesale != null; });
  }

  if (!list.length) {
    alert('No hay productos disponibles para exportar.');
    return;
  }

  var incluirFotos = (tipo !== 'light');
  var titulo = (tipo === 'category' && filter !== 'Todas')
    ? filter
    : (tipo === 'wholesale' ? 'Catálogo Mayorista' : 'Catálogo de Repuestos');

  var grupos = {};
  list.forEach(function (p) {
    var cat = p.cat || 'Sin categoría';
    if (!grupos[cat]) grupos[cat] = [];
    grupos[cat].push(p);
  });
  var categorias = Object.keys(grupos).sort();

  var hoy = new Date();
  var meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var fechaTexto = hoy.getDate() + ' de ' + meses[hoy.getMonth()] + ' de ' + hoy.getFullYear();

  var seccionesHTML = '';
  categorias.forEach(function (cat) {
    var prods = grupos[cat].sort(function (a, b) { return a.name.localeCompare(b.name, 'es'); });
    var icono = iconoPorCategoria(cat);

    seccionesHTML +=
      '<section class="cat-section">' +
        '<h2 class="cat-title"><span class="cat-icon">' + icono + '</span>' + escapeHTML(cat) + '</h2>' +
        '<div class="product-grid">' +
          prods.map(function (p) { return productPDF(p, incluirFotos); }).join('') +
        '</div>' +
      '</section>';
  });

  var qrURL = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(SITE_URL);
  var trendLabel = trend === 'up' ? 'subiendo' : (trend === 'down' ? 'bajando' : 'estable');
  var margin = currentMargin();
  var rateLine = 'elTOQUE ' + toque + ' (' + trendLabel + (margin > 0 ? ', +' + margin + ' margen' : '') + ')';

  var html =
    '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<title>' + escapeHTML(titulo) + ' — MG\'s Store</title>' +
    '<style>' + estilosPDF(incluirFotos) + '</style>' +
    '</head><body>' +

    '<div class="watermark">Precios sujetos a cambio</div>' +

    '<div class="cover">' +
      '<div class="cover-brand">⚡ MG\'s Store</div>' +
      '<h1 class="cover-title">' + escapeHTML(titulo).replace(' ', '<br>') + '</h1>' +
      '<p class="cover-sub">Motos eléctricas · Mayorista y minorista</p>' +
      '<div class="cover-meta">' +
        '<div class="cover-line"><strong>Fecha:</strong> ' + fechaTexto + '</div>' +
        '<div class="cover-line"><strong>Productos:</strong> ' + list.length + '</div>' +
        '<div class="cover-line"><strong>Categorías:</strong> ' + categorias.length + '</div>' +
        '<div class="cover-line"><strong>Tasa CUP:</strong> ' + calc + ' CUP/USD</div>' +
        '<div class="cover-line" style="font-size:9pt;color:rgba(255,255,255,.6)">' + rateLine + '</div>' +
      '</div>' +
      '<div class="cover-qr">' +
        '<img src="' + qrURL + '" alt="QR">' +
        '<div class="cover-qr-text">Escanea para ver el catálogo online</div>' +
      '</div>' +
      '<div class="cover-contact">' +
        '<div class="cover-contact-title">Contacto</div>' +
        '<div>WhatsApp: +53 5889 0678</div>' +
        '<div>Guanabacoa, La Habana · Cuba</div>' +
      '</div>' +
      '<div class="cover-note">Los precios son referenciales y pueden variar. Confirma por WhatsApp antes de comprar. <strong>Revisa tu pieza antes de pagar — no hay devoluciones.</strong></div>' +
    '</div>' +

    seccionesHTML +

    '<div class="final-page">' +
      '<div class="final-brand">⚡ MG\'s Store</div>' +
      '<h2 class="final-title">¿Listo para pedir?</h2>' +
      '<p class="final-text">Escríbenos por WhatsApp con el código y la cantidad de cada producto. Te confirmamos disponibilidad, precio final y forma de entrega.</p>' +
      '<div class="final-qr">' +
        '<img src="' + qrURL + '" alt="QR">' +
      '</div>' +
      '<div class="final-wa">📲 +53 5889 0678</div>' +
      '<div class="final-note">Mayorista: mínimo 5 unidades del mismo producto · Entregas en La Habana · Lun–Vie 9 AM–5 PM · Sáb 9 AM–12 PM<br><strong>Revisa bien tu producto antes de comprar — no aceptamos devoluciones.</strong></div>' +
    '</div>' +

    '</body></html>';

  var win = window.open('', '_blank');
  if (!win) {
    alert('Permite las ventanas emergentes para descargar el PDF.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();

  esperarImagenesYImprimir(win);
}

function productPDF(p, incluirFotos) {
  var precioMinor = p.retail != null ? fmt(p.retail) : '—';
  var precioMayor = p.wholesale != null ? fmt(p.wholesale) : '—';
  var cupMinor = p.retail != null ? fmt(p.retail * calc) : '—';
  var cupMayor = p.wholesale != null ? fmt(p.wholesale * calc) : '—';
  var stockInfo = p.stock > 0
    ? '<span class="p-stock-ok">' + p.stock + ' uds.</span>'
    : '<span class="p-stock-low">Consultar</span>';

  var imgHTML = incluirFotos
    ? '<div class="p-img"><img src="' + p.photo + '" alt="" onerror="this.parentNode.style.display=\'none\'"></div>'
    : '';

  return '<div class="product-item' + (incluirFotos ? '' : ' no-img') + '">' +
    imgHTML +
    '<div class="p-info">' +
      '<div class="p-code">' + escapeHTML(p.code) + '</div>' +
      '<div class="p-name">' + escapeHTML(p.name) + '</div>' +
      '<div class="p-prices">' +
        '<div class="p-price-block">' +
          '<div class="p-price-label">Minorista</div>' +
          '<div class="p-price-usd">$' + precioMinor + '</div>' +
          '<div class="p-price-cup">' + cupMinor + ' CUP</div>' +
        '</div>' +
        '<div class="p-price-block">' +
          '<div class="p-price-label">Mayorista</div>' +
          '<div class="p-price-usd">$' + precioMayor + '</div>' +
          '<div class="p-price-cup">' + cupMayor + ' CUP</div>' +
        '</div>' +
      '</div>' +
      '<div class="p-stock">' + stockInfo + '</div>' +
    '</div>' +
  '</div>';
}

function iconoPorCategoria(cat) {
  var c = (cat || '').toLowerCase();
  if (c.indexOf('motor') !== -1) return '🔧';
  if (c.indexOf('eléctrico') !== -1) return '⚡';
  if (c.indexOf('ilumin') !== -1) return '💡';
  if (c.indexOf('freno') !== -1) return '🛑';
  if (c.indexOf('rueda') !== -1 || c.indexOf('llanta') !== -1) return '🛞';
  if (c.indexOf('carrocer') !== -1 || c.indexOf('control') !== -1) return '🎨';
  if (c.indexOf('quím') !== -1 || c.indexOf('spray') !== -1) return '🧴';
  if (c.indexOf('accesor') !== -1 || c.indexOf('tornill') !== -1) return '🔩';
  if (c.indexOf('servicio') !== -1) return '🛠️';
  return '📦';
}

function esperarImagenesYImprimir(win) {
  try {
    var imgs = win.document.querySelectorAll('img');
    var cargadas = 0;
    var total = imgs.length;
    var contadas = false;

    function imprimir() {
      setTimeout(function () {
        try { win.focus(); win.print(); } catch (e) { console.error(e); }
      }, 400);
    }

    if (total === 0) { imprimir(); return; }

    function completar() {
      cargadas++;
      if (cargadas >= total && !contadas) {
        contadas = true;
        imprimir();
      }
    }

    Array.prototype.forEach.call(imgs, function (img) {
      if (img.complete) completar();
      else {
        img.addEventListener('load', completar);
        img.addEventListener('error', completar);
      }
    });

    setTimeout(function () {
      if (!contadas) { contadas = true; imprimir(); }
    }, 10000);
  } catch (e) {
    console.error(e);
    try { win.focus(); win.print(); } catch (e2) {}
  }
}

function estilosPDF(incluirFotos) {
  var imgStyles = incluirFotos
    ? '.product-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
      '.p-img{width:80px;height:80px;flex-shrink:0;background:#f8fafc;border-radius:8px;overflow:hidden;display:flex;align-items:center;justify-content:center}' +
      '.p-img img{max-width:100%;max-height:100%;object-fit:contain}' +
      '.product-item{display:flex;gap:10px;padding:10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;page-break-inside:avoid;break-inside:avoid;align-items:stretch}'
    : '.product-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}' +
      '.product-item{padding:9px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;page-break-inside:avoid;break-inside:avoid}' +
      '.product-item.no-img{display:block}';

  return [
    '*{box-sizing:border-box;margin:0;padding:0}',
    'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#0f172a;font-size:11pt;line-height:1.4;position:relative}',
    '.watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:80pt;font-weight:900;color:rgba(15,23,42,.04);pointer-events:none;z-index:0;white-space:nowrap}',
    '.cover{page-break-after:always;display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:95vh;text-align:center;padding:40px 30px;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#fff;position:relative;z-index:1}',
    '.cover-brand{font-size:16pt;font-weight:900;margin-bottom:40px;letter-spacing:-.02em}',
    '.cover-title{font-size:36pt;font-weight:900;letter-spacing:-.04em;line-height:1.05;margin-bottom:18px}',
    '.cover-sub{font-size:14pt;color:rgba(255,255,255,.75);margin-bottom:40px}',
    '.cover-meta{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:14px;padding:20px 28px;margin-bottom:30px;text-align:left;min-width:280px}',
    '.cover-line{font-size:11pt;color:rgba(255,255,255,.9);padding:5px 0}',
    '.cover-line strong{color:#f97316;font-weight:800}',
    '.cover-qr{margin-bottom:28px}',
    '.cover-qr img{width:130px;height:130px;background:#fff;border-radius:10px;padding:6px}',
    '.cover-qr-text{font-size:9pt;color:rgba(255,255,255,.6);margin-top:8px}',
    '.cover-contact{margin-bottom:24px}',
    '.cover-contact-title{font-size:9pt;text-transform:uppercase;letter-spacing:.15em;color:rgba(255,255,255,.5);margin-bottom:8px}',
    '.cover-contact div{font-size:11pt;color:#fff}',
    '.cover-note{font-size:9pt;color:rgba(255,255,255,.6);font-style:italic;max-width:440px;line-height:1.5}',
    '.cat-section{margin-bottom:22px;page-break-inside:auto;position:relative;z-index:1}',
    '.cat-title{font-size:16pt;font-weight:900;letter-spacing:-.02em;color:#0f172a;border-bottom:2px solid #f97316;padding-bottom:8px;margin-bottom:14px;display:flex;align-items:center;gap:8px;page-break-after:avoid}',
    '.cat-icon{font-size:16pt}',
    imgStyles,
    '.p-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}',
    '.p-code{font-size:7.5pt;font-weight:700;color:#94a3b8;letter-spacing:.06em;text-transform:uppercase}',
    '.p-name{font-size:10pt;font-weight:700;color:#0f172a;line-height:1.25;margin-bottom:2px}',
    '.p-prices{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:auto}',
    '.p-price-block{padding:5px 7px;background:#f8fafc;border-radius:6px}',
    '.p-price-label{font-size:6.5pt;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:700;margin-bottom:1px}',
    '.p-price-usd{font-size:11pt;font-weight:900;color:#0f172a;line-height:1.1}',
    '.p-price-cup{font-size:7pt;color:#94a3b8;line-height:1.1}',
    '.p-stock{font-size:8pt;margin-top:4px}',
    '.p-stock-ok{color:#16a34a;font-weight:700}',
    '.p-stock-low{color:#ea580c;font-weight:700}',
    '.final-page{page-break-before:always;display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:95vh;text-align:center;padding:60px 30px;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#fff;position:relative;z-index:1}',
    '.final-brand{font-size:16pt;font-weight:900;margin-bottom:30px}',
    '.final-title{font-size:28pt;font-weight:900;letter-spacing:-.03em;margin-bottom:16px}',
    '.final-text{font-size:12pt;color:rgba(255,255,255,.75);max-width:500px;line-height:1.6;margin-bottom:30px}',
    '.final-qr{margin-bottom:24px}',
    '.final-qr img{width:150px;height:150px;background:#fff;border-radius:10px;padding:8px}',
    '.final-wa{font-size:20pt;font-weight:900;color:#16a34a;background:rgba(22,163,74,.12);padding:14px 28px;border-radius:999px;margin-bottom:24px}',
    '.final-note{font-size:9pt;color:rgba(255,255,255,.55);max-width:480px;line-height:1.6}',
    '@page{size:A4;margin:10mm}',
    '@media print{',
      'body{-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}',
      '.cover,.final-page{min-height:auto;height:auto;padding:25mm 15mm}',
      '.product-item{page-break-inside:avoid;break-inside:avoid}',
      '.cat-title{page-break-after:avoid;break-after:avoid}',
      '.watermark{display:block}',
    '}'
  ].join('');
}

/* ==========================================================
   Init
   ========================================================== */
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closeCart();
    closeHowto();
    closePdfMenu();
  }
});

function restoreFilters() {
  if ($('priceFilter')) $('priceFilter').value = priceFilter;
  if ($('sortSelect')) $('sortSelect').value = sortMode;
}

loadState();
loadRate();
initFeaturedNav();
restoreFilters();
updateOpenStatus();
setInterval(updateOpenStatus, 60000);
updatePdfCategoryLabel();
load();
