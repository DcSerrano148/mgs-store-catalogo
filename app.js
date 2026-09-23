// MG's Store — catálogo
let PRODUCTS = [];
let mode = 'retail';
let filter = 'Todas';
let cart = {};
let calc = 685;

const $ = id => document.getElementById(id);
const fmt = n => new Intl.NumberFormat('es-CU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

// --- Persistencia ---
function loadCart(){ try{ cart = JSON.parse(localStorage.getItem('mg_cart')||'{}'); }catch(e){ cart={}; } }
function saveCart(){ localStorage.setItem('mg_cart', JSON.stringify(cart)); }

// --- Tasa ---
function loadRate(){
  const saved = localStorage.getItem('mg_rate');
  if(saved){ calc = Number(saved); $('rateInput').value = calc; $('calcRate').textContent = calc + ' CUP/USD'; }
}
function applyRate(){
  const v = Number($('rateInput').value);
  if(!v || v<=0) return alert('Tasa inválida');
  calc = v;
  localStorage.setItem('mg_rate', v);
  $('calcRate').textContent = v + ' CUP/USD';
  render();
}

// --- Datos ---
async function load(){
  try{
    const r = await fetch('datos/catalogo.json?v=' + Date.now());
    const d = await r.json();
    PRODUCTS = d.items || d;
    document.title = "MG's Store | " + PRODUCTS.length + " repuestos para motos eléctricas";
    render();
  }catch(e){
    $('grid').innerHTML = '<p class="notice">No se pudo cargar el catálogo. Revisa tu conexión e intenta de nuevo.</p>';
  }
}

// --- UI ---
function setMode(m){
  mode = m;
  $('wh').classList.toggle('active', m==='wholesale');
  $('rt').classList.toggle('active', m==='retail');
  render();
}

function categories(){
  const cs = ['Todas', ...new Set(PRODUCTS.map(p => p.cat))].sort();
  $('filters').innerHTML = cs.map(c =>
    `<button class="${filter===c?'active':''}" onclick="setFilter('${c}')">${c}</button>`
  ).join('');
}
function setFilter(c){ filter = c; render(); }

function badgeFor(p){
  if(p.wholesale && p.retail && p.wholesale < p.retail * 0.9) return '<span class="badge deal">💚 Precio mayorista</span>';
  return '';
}

function render(){
  categories();
  const q = norm($('search').value || '');
  let list = PRODUCTS.filter(p => {
    if(!p.disponible && p.stock===0) return false; // oculta agotados
    if(filter !== 'Todas' && p.cat !== filter) return false;
    if(q && !norm(p.name + ' ' + p.code).includes(q)) return false;
    if(mode === 'wholesale' && p.wholesale == null) return false;
    return true;
  });

  $('grid').innerHTML = list.map(p => {
    const price = mode === 'wholesale' ? p.wholesale : p.retail;
    const can = price != null && (p.disponible || p.stock > 0);
    return `
    <article class="card">
      <div class="pic">
        <img src="${p.photo}" alt="${p.name}" loading="lazy" width="235" height="180"
             onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
        <span class="noimg" style="display:none">Foto pendiente</span>
      </div>
      <div class="body">
        <div class="code">${p.code}</div>
        <h3>${p.name}</h3>
        ${price != null
          ? `<div class="price">$${fmt(price)} USD</div><div class="cup">$${fmt(price*calc)} CUP</div>`
          : `<div class="small">Precio ${mode==='wholesale'?'mayorista':'minorista'} pendiente</div>`}
        ${mode==='wholesale' ? '<span class="badge">Mínimo 5 unidades</span>' : ''}
        ${badgeFor(p)}
        <div class="stock">${p.stock>0 ? '🟢 '+p.stock+' disponibles' : (p.disponible ? '🟡 Consultar disponibilidad' : '⚪ Agotado')}</div>
        <button class="add ${can?'':'disabled'}" ${can?'':'disabled'} onclick="add('${p.code}')">
          ${can ? '🛒 Añadir al carrito' : 'No disponible'}
        </button>
      </div>
    </article>`;
  }).join('') || '<p class="notice">Sin resultados para esa búsqueda.</p>';

  cartRender();
}

// --- Carrito ---
function add(code){
  const p = PRODUCTS.find(x => x.code === code); if(!p) return;
  cart[code] = (cart[code] || 0) + 1;
  saveCart(); openCart();
}
function change(code, d){
  cart[code] = (cart[code] || 0) + d;
  if(cart[code] <= 0) delete cart[code];
  saveCart(); cartRender();
}
function clearCart(){
  if(!confirm('¿Vaciar el carrito?')) return;
  cart = {}; saveCart(); cartRender();
}
function openCart(){ $('cartOverlay').classList.add('open'); }
function closeCart(){ $('cartOverlay').classList.remove('open'); }
function overlayClose(e){ if(e.target.id==='cartOverlay') closeCart(); }

function cartRender(){
  let html = '', usd = 0, count = 0;
  for(const [c,q] of Object.entries(cart)){
    const p = PRODUCTS.find(x => x.code === c); if(!p) continue;
    const price = mode === 'wholesale' ? p.wholesale : p.retail;
    if(price == null) continue;
    usd += price * q; count += q;
    html += `<div class="line">
      <span>${q} × ${p.name}</span>
      <span>$${fmt(price*q)}</span>
      <span class="qty">
        <button onclick="change('${c}',-1)">−</button>
        <button onclick="change('${c}',1)">+</button>
      </span>
    </div>`;
  }
  $('cartLines').innerHTML = html || '<span class="small">Añade productos para preparar tu pedido.</span>';
  $('count').textContent = count + ' unidades';
  $('floatingCount').textContent = count;
  $('usd').textContent = fmt(usd);
  $('cup').textContent = fmt(usd * calc);
  $('applied').textContent = calc;
}

// --- WhatsApp ---
function sendWhatsApp(){
  const rows = []; let usd = 0;
  for(const [c,q] of Object.entries(cart)){
    const p = PRODUCTS.find(x => x.code === c); if(!p) continue;
    const price = mode === 'wholesale' ? p.wholesale : p.retail;
    if(price == null) continue;
    if(mode === 'wholesale' && q < 5){ alert('Cada producto mayorista debe tener mínimo 5 unidades.'); return; }
    usd += price * q;
    rows.push(`${q} x ${p.name} [${p.code}] — ${fmt(price*q)} USD`);
  }
  if(!rows.length){ alert('El carrito está vacío.'); return; }
  const msg = `MG'S STORE — PEDIDO\n\nModalidad: ${mode==='wholesale'?'MAYORISTA':'MINORISTA'}\n\n${rows.join('\n')}\n\nTOTAL USD: ${fmt(usd)}\nTOTAL CUP: ${fmt(usd*calc)}\nTASA DE CÁLCULO: ${calc} CUP/USD\n\nPor favor confirmar disponibilidad, condiciones de pago y entrega.`;
  window.open('https://wa.me/5354800976?text=' + encodeURIComponent(msg), '_blank');
}

// --- Init ---
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeCart(); });
loadRate();
loadCart();
load();
