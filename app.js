// ===== Main app code =====
const APP_VERSION = '6'; // keep in step with VERSION in sw.js

// Shortcut for finding things on the page
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ----- Tabs -----
function showTab(name) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
  $$('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  window.scrollTo(0, 0);
}
$$('.tabbar button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

$('#app-version').textContent = APP_VERSION;


// =====================================================================
// CHECK TAB — the item you're currently looking at ("draft")
// The draft is saved on the phone as you type, so it survives closing the app.
// =====================================================================
const FIELDS = ['name', 'brand', 'model', 'size', 'colour', 'condition', 'barcode',
                'query', 'soldLow', 'soldTypical', 'soldHigh', 'vintedAsk'];
let draft = { photo: null };

function readForm() {
  FIELDS.forEach(f => draft[f] = $('#f-' + f).value.trim());
}
function fillForm() {
  FIELDS.forEach(f => $('#f-' + f).value = draft[f] || '');
  $('#photo-box').hidden = !draft.photo;
  $('#photo-preview').src = draft.photo || '';
  updatePriceLinks();
}
async function saveDraft() {
  readForm();
  await DB.put('settings', { key: 'draft', value: draft });
}
async function loadDraft() {
  const row = await DB.get('settings', 'draft');
  if (row) draft = row.value;
  fillForm();
}

FIELDS.forEach(f => $('#f-' + f).addEventListener('input', () => { saveDraft(); updatePriceLinks(); }));
$('#f-condition').addEventListener('change', saveDraft);

// When you finish typing the name, guess brand/size/colour/etc. into the empty boxes
$('#f-name').addEventListener('change', autoFillFromName);

// Typing a barcode number in by hand looks it up too
$('#f-barcode').addEventListener('change', () => {
  const code = $('#f-barcode').value.replace(/\D/g, '');
  if (code.length >= 8 && code.length <= 14) lookupBarcode(code);
});

$('#btn-type').addEventListener('click', () => $('#f-name').focus());

$('#btn-clear').addEventListener('click', async () => {
  draft = { photo: null };
  fillForm();
  showStatus('');
  await saveDraft();
  window.scrollTo(0, 0);
});

// ----- Photo -----
$('#btn-photo').addEventListener('click', () => $('#photo-input').click());
$('#photo-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  draft.photo = await shrinkPhoto(file);
  e.target.value = '';
  fillForm();
  await saveDraft();

  // --- AI IDENTIFY: future feature goes here ---
  // e.g. const guess = await aiIdentify(draft.photo); if (guess) { draft.name = guess.name; fillForm(); }
});
$('#btn-photo-remove').addEventListener('click', async () => {
  draft.photo = null;
  fillForm();
  await saveDraft();
});

// Makes photos smaller (max 1200px wide/high) so the phone doesn't fill up
function shrinkPhoto(file, max = 1200) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Placeholder for a future "AI identify from photo" feature. Returns nothing for now.
async function aiIdentify(photoDataUrl) {
  return null;
}


// =====================================================================
// PRICE CHECK — builds eBay / Vinted search links. Nothing is scraped.
// =====================================================================
function autoQuery() {
  const name = $('#f-name').value.trim();
  const size = $('#f-size').value.trim();
  // add the size unless it's already in the name
  return (size && !name.toLowerCase().includes(size.toLowerCase())) ? `${name} ${size}` : name;
}

function updatePriceLinks() {
  const typed = $('#f-query').value.trim();
  const q = typed || autoQuery();
  $('#f-query').placeholder = autoQuery() || 'Made from the name + size';
  const enc = encodeURIComponent(q);
  $('#btn-ebay').href = `https://www.ebay.co.uk/sch/i.html?_nkw=${enc}&LH_Sold=1&LH_Complete=1`;
  $('#btn-vinted').href = `https://www.vinted.co.uk/catalog?search_text=${enc}`;
  $$('#btn-ebay, #btn-vinted').forEach(a => a.classList.toggle('disabled', !q));
  $('#query-note').textContent = q ? `Searching for: "${q}"` : 'Type a name first.';
}
$$('#btn-ebay, #btn-vinted').forEach(a => a.addEventListener('click', e => {
  if (a.classList.contains('disabled')) e.preventDefault();
}));

// Turns "£12.50" or "12,5" into 12.5. Empty box → null.
function money(v) {
  const n = parseFloat(String(v ?? '').replace(/[£\s]/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

// =====================================================================
// BARCODE SCANNING + LOOKUP
// =====================================================================
let scanner = null;

function showStatus(msg) {
  $('#scan-status').hidden = !msg;
  $('#scan-status').textContent = msg;
}

$('#btn-scan').addEventListener('click', startScan);
$('#btn-scan-cancel').addEventListener('click', stopScan);

async function startScan() {
  $('#scanner').hidden = false;
  const F = Html5QrcodeSupportedFormats;
  scanner = new Html5Qrcode('reader', {
    verbose: false,
    formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.QR_CODE],
  });
  try {
    await scanner.start(
      { facingMode: 'environment' },          // back camera
      { fps: 10, qrbox: (w) => { const size = Math.min(w * 0.8, 300); return { width: size, height: size * 0.75 }; } },
      onScanned
    );
  } catch (err) {
    await stopScan();
    showStatus('Could not open the camera. Check Flip is allowed to use the camera, then try again.');
  }
}

async function stopScan() {
  if (scanner) {
    try { await scanner.stop(); } catch (e) {}
    try { scanner.clear(); } catch (e) {}
    scanner = null;
  }
  $('#scanner').hidden = true;
}

async function onScanned(text) {
  await stopScan();
  if (navigator.vibrate) navigator.vibrate(80);
  readForm();
  text = text.trim();

  // QR codes can hold a barcode number, a web link, or plain text
  const gs1 = text.match(/\/01\/(\d{8,14})/);          // GS1 "digital link" QR — has the barcode inside
  const code = /^\d{8,14}$/.test(text) ? text : (gs1 ? gs1[1].replace(/^0+(?=\d{12})/, '') : null);

  if (code) {
    draft.barcode = code;
    fillForm();
    await saveDraft();
    await lookupBarcode(code);
  } else if (/^https?:\/\//i.test(text)) {
    draft.link = text;
    await saveDraft();
    showStatus('');
    $('#scan-status').hidden = false;
    $('#scan-status').innerHTML = 'QR code is a web link. <a target="_blank" rel="noopener">Open it</a> to see what the item is, then type the name.';
    $('#scan-status a').href = text;
  } else {
    if (!draft.name) draft.name = text.slice(0, 120);
    fillForm();
    await autoFillFromName();
    showStatus('QR code text added as the name. Edit it if needed.');
  }
}

// Tries each free lookup in turn. Fills in only the boxes that are still empty.
async function lookupBarcode(code) {
  if (!navigator.onLine) {
    showStatus(`Barcode ${code} saved. No signal, so type the name yourself.`);
    $('#f-name').focus();
    return;
  }
  showStatus(`Looking up ${code}…`);
  const found = (await lookupUpcItemDb(code)) || (await lookupOpenFacts(code, 'food')) || (await lookupOpenFacts(code, 'beauty'));

  readForm();
  if (found) {
    for (const k of ['name', 'brand', 'model', 'colour', 'size']) {
      if (found[k] && !draft[k]) draft[k] = found[k];
    }
    if (found.name) draft.name = found.name; // a scan always replaces the name
    fillForm();
    await autoFillFromName(); // fill any boxes the lookup didn't
    showStatus(`Found: ${found.name} (from ${found.source}). Edit it if it's not quite right.`);
  } else {
    showStatus(`Nothing found for ${code}. Type the name yourself.`);
    $('#f-name').focus();
  }
}

// UPCitemdb (electronics, branded goods). Only works through your own relay — see cloudflare-worker.js
async function lookupUpcItemDb(code) {
  const relay = await getSetting('relayUrl', '');
  if (!relay) return null;
  try {
    const url = relay.replace(/\/$/, '') + '/?upc=' + encodeURIComponent(code);
    let res = await fetch(url);
    if (res.status === 429) { // "too busy" — wait a second and try once more
      await new Promise(r => setTimeout(r, 1200));
      res = await fetch(url);
    }
    if (!res.ok) return null;
    const item = (await res.json()).items?.[0];
    if (!item?.title) return null;
    return { name: item.title, brand: item.brand, model: item.model, colour: item.color, size: item.size, source: 'UPCitemdb' };
  } catch (e) { return null; }
}

// Open Food Facts / Open Beauty Facts (food, toiletries, cosmetics). Free, no key.
async function lookupOpenFacts(code, kind) {
  const host = kind === 'food' ? 'world.openfoodfacts.org' : 'world.openbeautyfacts.org';
  try {
    const res = await fetch(`https://${host}/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,quantity`);
    if (!res.ok) return null;
    const p = (await res.json()).product;
    if (!p?.product_name) return null;
    const brand = (p.brands || '').split(',')[0].trim();
    const name = [brand, p.product_name, p.quantity].filter(Boolean).join(' ');
    return { name, brand, source: kind === 'food' ? 'Open Food Facts' : 'Open Beauty Facts' };
  } catch (e) { return null; }
}


// =====================================================================
// AUTO-FILL FROM THE NAME (works offline, no AI)
// Reads the item name and guesses brand, size, colour, condition and model.
// Only fills boxes that are empty. Add brands/colours to the lists below any time.
// =====================================================================
const BRANDS = [
  // Clothing & shoes
  'Nike', 'Adidas', 'Puma', 'Reebok', 'New Balance', 'Asics', 'Vans', 'Converse', 'Dr. Martens|Dr Martens|Doc Martens',
  'Timberland', 'UGG', 'Birkenstock', 'Salomon', 'Hoka', 'On Running', 'Crocs', 'Clarks', 'Skechers',
  'The North Face|North Face|TNF', 'Patagonia', 'Arc\'teryx|Arcteryx', 'Columbia', 'Berghaus', 'Barbour', 'Canada Goose', 'Moncler',
  'Stone Island', 'C.P. Company|CP Company', 'Carhartt', 'Dickies', 'Stüssy|Stussy', 'Supreme', 'Palace', 'Corteiz', 'Trapstar',
  'Ralph Lauren|Polo Ralph Lauren', 'Tommy Hilfiger', 'Calvin Klein', 'Lacoste', 'Fred Perry', 'Hugo Boss|Boss', 'Armani|Emporio Armani',
  'Levi\'s|Levis|Levi', 'Wrangler', 'Lee', 'Diesel', 'G-Star|G Star', 'Superdry', 'Hollister', 'Abercrombie & Fitch|Abercrombie',
  'Zara', 'H&M', 'Uniqlo', 'Mango', 'COS', 'Arket', '& Other Stories|Other Stories', 'Massimo Dutti', 'Bershka', 'Pull&Bear|Pull and Bear',
  'ASOS', 'Topshop', 'River Island', 'Next', 'Primark', 'M&S|Marks & Spencer|Marks and Spencer', 'Reiss', 'AllSaints|All Saints', 'Ted Baker',
  'Whistles', 'Jigsaw', 'Hobbs', 'Boden', 'White Stuff', 'Fat Face|FatFace', 'Joules', 'Jack Wills', 'Urban Outfitters', 'Free People',
  'Gymshark', 'Lululemon', 'Sweaty Betty', 'Under Armour', 'Champion', 'Fila', 'Kappa', 'Ellesse', 'Umbro', 'Le Coq Sportif',
  'Burberry', 'Gucci', 'Prada', 'Louis Vuitton|LV', 'Chanel', 'Dior', 'Balenciaga', 'Versace', 'Off-White|Off White', 'Moschino', 'Vivienne Westwood',
  'Michael Kors', 'Coach', 'Kate Spade', 'Mulberry', 'Radley', 'Fossil', 'Ray-Ban|Ray Ban', 'Oakley', 'Casio', 'Seiko',
  // Tech, toys, games
  'Apple', 'Samsung', 'Sony', 'PlayStation', 'Xbox', 'Nintendo', 'Microsoft', 'Bose', 'Beats', 'JBL', 'Dyson', 'GoPro', 'Canon', 'Nikon',
  'Fujifilm', 'Google', 'Garmin', 'Fitbit', 'Lego', 'Pokémon|Pokemon', 'Barbie', 'Hot Wheels',
];
const COLOURS = ['Black', 'White', 'Grey|Gray', 'Navy', 'Blue', 'Red', 'Green', 'Khaki', 'Olive', 'Cream', 'Beige', 'Brown', 'Tan',
  'Pink', 'Purple', 'Lilac', 'Yellow', 'Orange', 'Gold', 'Silver', 'Burgundy', 'Maroon', 'Teal', 'Multicolour|Multicolor|Multi'];

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Finds the first word/phrase from a list in the text. Returns { value, matched } or null.
function findInList(text, list) {
  let best = null;
  for (const entry of list) {
    const [display, ...aliases] = entry.split('|');
    for (const word of [display, ...aliases]) {
      const m = text.match(new RegExp('(^|[^\\p{L}])(' + escapeRe(word) + ')(?=$|[^\\p{L}])', 'iu'));
      if (m && (!best || m.index < best.index || (m.index === best.index && word.length > best.matched.length))) {
        best = { value: display, matched: m[2], index: m.index };
      }
    }
  }
  return best;
}

function guessFromName(name) {
  const g = {};
  let rest = name;
  const take = (matched) => { rest = rest.replace(matched, ' '); };

  const brand = findInList(name, BRANDS);
  if (brand) { g.brand = brand.value; take(brand.matched); }

  // Sizes — tried in this order
  const sizeRules = [
    [/\bW\s?(\d{2})\s?L\s?(\d{2})\b/i, m => `W${m[1]} L${m[2]}`],                 // jeans: W32 L30
    [/\b(UK|EU|US)\s?(\d{1,2}(?:\.5)?)\b/i, m => `${m[1].toUpperCase()} ${m[2]}`], // shoes: UK 9
    [/\b(\d{1,2}-\d{1,2})\s?(?:y|yrs?|years)\b/i, m => `${m[1]} years`],          // kids: 7-8 years
    [/\bsize\s+(\d{1,2}(?:\.5)?|[a-z]{1,4})\b/i, m => m[1].toUpperCase()],         // size 10, size M
    [/\b(XXS|XS|S|M|L|XL|XXL|XXXL|[2-5]XL)\b/, m => m[1]],                         // capital letters only
    [/\b(x-?small|small|medium|large|x-?large)\b/i,
      m => ({ xsmall: 'XS', 'x-small': 'XS', small: 'S', medium: 'M', large: 'L', xlarge: 'XL', 'x-large': 'XL' })[m[1].toLowerCase()]],
  ];
  for (const [re, fmt] of sizeRules) {
    const m = rest.match(re);
    if (m) { g.size = fmt(m); take(m[0]); rest = rest.replace(/\bsize\b/i, ' '); break; }
  }

  // Up to two colours, e.g. "Black / White"
  const colours = [];
  for (let i = 0; i < 2; i++) {
    const c = findInList(rest, COLOURS);
    if (!c) break;
    colours.push(c.value); take(c.matched);
  }
  if (colours.length) g.colour = colours.join(' / ');

  // Seller shorthand for condition
  const condRules = [
    [/\b(bnwot|new without tags?)\b/i, 'New without tags'],
    [/\b(bnwt|new with tags?)\b/i, 'New with tags'],
    [/\b(vgc|very good condition)\b/i, 'Very good'],
  ];
  for (const [re, val] of condRules) {
    const m = rest.match(re);
    if (m) { g.condition = val; take(m[0]); break; }
  }

  // Model = what's left, but only if we found a brand (otherwise it's just the name again)
  if (brand) {
    const model = rest.replace(/[\s,\/\-|]+/g, ' ').trim();
    if (model) g.model = model;
  }
  return g;
}

async function autoFillFromName() {
  readForm();
  if (!draft.name) return;
  const g = guessFromName(draft.name);
  for (const k of ['brand', 'model', 'size', 'colour', 'condition']) {
    if (g[k] && !draft[k]) draft[k] = g[k];
  }
  fillForm();
  await saveDraft();
}


// =====================================================================
// SETTINGS
// =====================================================================
async function getSetting(key, fallback) {
  const row = await DB.get('settings', key);
  return row ? row.value : fallback;
}
async function setSetting(key, value) {
  await DB.put('settings', { key, value });
}

$('#s-relay').addEventListener('change', e => setSetting('relayUrl', e.target.value.trim()));
async function loadSettings() {
  $('#s-relay').value = await getSetting('relayUrl', '');
}


// =====================================================================
// OFFLINE SUPPORT
// =====================================================================
async function checkOffline() {
  const ok = 'caches' in window && (await caches.keys()).some(k => k === 'flip-v' + APP_VERSION);
  $('#offline-status').textContent = ok ? '✅ yes' : '❌ not yet — keep the app open with signal for a few seconds';
  if (!ok) setTimeout(checkOffline, 2000);
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(checkOffline);
} else {
  $('#offline-status').textContent = '❌ not supported';
}

// ----- Start up -----
loadDraft();
loadSettings();
