// ===== STOCK: list, totals, item detail =====
// Each item is saved in the 'items' store. Status goes bought → listed → sold.
// Uses things from app.js: $, $$, draft, readForm, cfg, money, gbp, profitFor, showTab, DB

let stockFilter = 'all';
let current = null;          // the item open in the detail screen

// Today's date as YYYY-MM-DD in UK local time (for the date boxes)
function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

// Profit for a stock item. Sold items use the real sold price; others use listed / expected price.
function itemProfit(it) {
  const sold = it.status === 'sold' && money(it.soldPrice) != null;
  const sell = sold ? money(it.soldPrice) : (money(it.listedPrice) ?? money(it.sellPrice) ?? money(it.soldTypical));
  const r = profitFor({
    buyPrice: it.buyPrice,
    sellPrice: sell == null ? '' : String(sell),
    fees: it.feesPaid,
    postage: it.postage,
    otherCosts: it.otherCosts,
  }, { ...cfg, ...(it.cfg || {}) });
  return { ...r, sold, hasSell: sell != null };
}


// ---------- Add to stock (button on the Check screen) ----------
$('#btn-add-stock').addEventListener('click', async () => {
  readForm();
  if (!draft.name) { toast('Type a name first'); $('#f-name').focus(); return; }

  const item = {
    ...draft,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    created: Date.now(),
    status: 'bought',
    boughtDate: today(), listedDate: '', soldDate: '',
    listedPrice: '', soldPrice: '', feesPaid: '',
    // lock in today's defaults so changing Settings later doesn't rewrite old items
    postage: String(money(draft.postage) ?? cfg.postage),
    otherCosts: String(money(draft.otherCosts) ?? cfg.otherCosts),
    cfg: { feePercent: cfg.feePercent, feeFixed: cfg.feeFixed },
    notes: '',
  };
  delete item.fees; // fee is worked out from the real price later
  await DB.put('items', item);

  $('#btn-clear').click();          // empty the Check screen for the next item
  toast('Added to stock ✓');
  await renderStock();
  showTab('stock');
});


// ---------- Stock list ----------
$('#stock-search').addEventListener('input', renderStock);
$$('#stock-filter button').forEach(b => b.addEventListener('click', () => {
  stockFilter = b.dataset.f;
  $$('#stock-filter button').forEach(x => x.classList.toggle('active', x === b));
  renderStock();
}));
$('.tabbar button[data-tab="stock"]').addEventListener('click', renderStock);

async function renderStock() {
  const items = (await DB.all('items')).sort((a, b) => b.created - a.created);

  // Totals (always for everything, not just the filtered list)
  let spent = 0, made = 0, profit = 0, inStock = 0;
  for (const it of items) {
    const r = itemProfit(it);
    spent += r.cost;
    if (r.sold) { made += r.sell; profit += r.profit; } else { inStock++; }
  }
  $('#t-spent').textContent = gbp(spent);
  $('#t-made').textContent = gbp(made);
  $('#t-profit').textContent = gbp(profit);
  $('#t-profit').className = profit < 0 ? 'neg' : profit > 0 ? 'pos' : '';
  $('#t-count').textContent = inStock;

  // Filter + search
  const q = $('#stock-search').value.trim().toLowerCase();
  const shown = items.filter(it =>
    (stockFilter === 'all' || it.status === stockFilter) &&
    (!q || [it.name, it.brand, it.model, it.size, it.colour, it.notes].join(' ').toLowerCase().includes(q))
  );

  const list = $('#stock-list');
  list.innerHTML = '';
  if (!shown.length) {
    list.innerHTML = `<p class="empty">${items.length ? 'Nothing matches.' : 'No stock yet. Check an item and tap “Add to stock”.'}</p>`;
    return;
  }
  for (const it of shown) list.appendChild(stockRow(it));
}

// One row in the list (built safely, without inserting raw text as HTML)
function stockRow(it) {
  const r = itemProfit(it);
  const row = el('button', 'stock-row');
  if (it.photo) { const img = el('img'); img.src = it.photo; img.alt = ''; row.appendChild(img); }
  else row.appendChild(el('div', 'noimg', '📦'));

  const info = el('div', 'info');
  info.appendChild(el('div', 'nm', it.name));
  const sub = el('div', 'sub');
  sub.appendChild(el('span', 'badge ' + it.status, it.status[0].toUpperCase() + it.status.slice(1)));
  const price = it.status === 'sold' ? it.soldPrice : it.status === 'listed' ? it.listedPrice : '';
  sub.appendChild(document.createTextNode(
    `Buy ${gbp(r.buy)}` + (money(price) != null ? ` · ${it.status === 'sold' ? 'Sold' : 'Listed'} ${gbp(money(price))}` : '')
  ));
  info.appendChild(sub);
  row.appendChild(info);

  const pr = el('div', 'pr ' + (r.profit < 0 ? 'neg' : 'pos'), r.hasSell ? gbp(r.profit) : '—');
  if (!r.sold) pr.style.opacity = 0.6; // not sold yet = estimate
  row.appendChild(pr);

  row.addEventListener('click', () => openItem(it.id));
  return row;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}


// ---------- Item detail ----------
async function openItem(id) {
  current = await DB.get('items', id);
  if (!current) return;
  $$('#tab-item [data-k]').forEach(inp => inp.value = current[inp.dataset.k] ?? '');
  $('#i-photo').hidden = !current.photo;
  $('#i-photo').src = current.photo || '';
  resetDelete();
  refreshItem();
  showTab('item');
  $$('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === 'stock'));
  if (typeof renderDraftListing === 'function') renderDraftListing(current); // step 7
}

function refreshItem() {
  $('#i-title').textContent = current.name || 'Untitled';
  $$('#i-status button').forEach(b => b.classList.toggle('on', b.dataset.s === current.status));
  const r = itemProfit(current);
  $('#i-profit-label').textContent = r.sold ? 'Profit' : 'Expected profit';
  $('#i-profit').textContent = r.hasSell ? gbp(r.profit) : '—';
  $('#i-profit').className = r.profit < 0 ? 'neg' : 'pos';
  $('#i-roi').textContent = r.hasSell && r.roi != null ? Math.round(r.roi) + '%' : '—';
  $('#i-fees').placeholder = r.hasSell ? r.fees.toFixed(2) + ' (est.)' : '';
}

// Any box in the detail screen saves straight away
$$('#tab-item [data-k]').forEach(inp => {
  const ev = inp.tagName === 'SELECT' || inp.type === 'date' ? 'change' : 'input';
  inp.addEventListener(ev, async () => {
    if (!current) return;
    current[inp.dataset.k] = inp.value.trim();
    refreshItem();
    await DB.put('items', current);
    if (typeof renderDraftListing === 'function') renderDraftListing(current);
  });
});

// Status buttons: Bought / Listed / Sold. Fills in today's date if it's empty.
$$('#i-status button').forEach(b => b.addEventListener('click', async () => {
  const s = b.dataset.s;
  current.status = s;
  if (s === 'listed' && !current.listedDate) current.listedDate = today();
  if (s === 'sold') {
    if (!current.soldDate) current.soldDate = today();
    if (!current.listedDate) current.listedDate = current.soldDate;
    if (!current.soldPrice && current.listedPrice) current.soldPrice = current.listedPrice;
  }
  $$('#tab-item [data-k]').forEach(inp => inp.value = current[inp.dataset.k] ?? '');
  refreshItem();
  await DB.put('items', current);
  if (s === 'listed' && !current.listedPrice) $('[data-k="listedPrice"]').focus();
  if (s === 'sold' && !current.soldPrice) $('[data-k="soldPrice"]').focus();
}));

$('#btn-back').addEventListener('click', async () => {
  await renderStock();
  showTab('stock');
});

// Delete needs two taps so you can't do it by accident
let deleteTimer;
function resetDelete() {
  clearTimeout(deleteTimer);
  $('#btn-delete').textContent = 'Delete item';
  $('#btn-delete').dataset.armed = '';
}
$('#btn-delete').addEventListener('click', async () => {
  const btn = $('#btn-delete');
  if (!btn.dataset.armed) {
    btn.dataset.armed = '1';
    btn.textContent = 'Tap again to delete for good';
    deleteTimer = setTimeout(resetDelete, 3000);
    return;
  }
  await DB.del('items', current.id);
  current = null;
  resetDelete();
  toast('Deleted');
  await renderStock();
  showTab('stock');
});

renderStock();
