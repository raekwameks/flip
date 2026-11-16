// ===== BACKUP & RESTORE =====
// Full backup  = a .json file with every item, photos and settings.
// CSV export   = a spreadsheet of your stock (no photos). Opens in Numbers, Excel, Google Sheets.
// Restore      = pick either file. Adds new items and updates existing ones. Never deletes.

const CSV_COLUMNS = [
  'id', 'name', 'brand', 'model', 'size', 'colour', 'condition', 'status',
  'boughtDate', 'listedDate', 'soldDate',
  'buyPrice', 'listedPrice', 'soldPrice', 'feesPaid', 'postage', 'otherCosts', 'profit',
  'sellPrice', 'soldLow', 'soldTypical', 'soldHigh', 'vintedAsk',
  'feePercent', 'feeFixed', 'measurements', 'flaws', 'notes', 'barcode', 'created',
];
const SETTING_KEYS = ['cfg', 'tpl', 'relayUrl'];
const NAG_DAYS = 7;

// iPhone only lets us open the Share sheet straight after a tap, so files are
// prepared in advance (whenever Settings is opened) and shared instantly on tap.
let prepared = { full: null, csv: null };

const stamp = () => today();  // today() lives in stock.js

async function prepareBackups() {
  const items = await DB.all('items');
  const settings = {};
  for (const k of SETTING_KEYS) settings[k] = await getSetting(k, null);

  const full = JSON.stringify({ app: 'flip', version: APP_VERSION, exported: new Date().toISOString(), items, settings });
  prepared.full = new File([full], `flip-backup-${stamp()}.json`, { type: 'application/json' });

  const rows = [CSV_COLUMNS.join(',')];
  for (const it of items) {
    const r = itemProfit(it);
    const row = CSV_COLUMNS.map(c => {
      if (c === 'profit') return r.hasSell ? r.profit.toFixed(2) : '';
      if (c === 'feePercent' || c === 'feeFixed') return it.cfg?.[c] ?? '';
      return it[c] ?? '';
    });
    rows.push(row.map(csvCell).join(','));
  }
  // ﻿ makes Excel read the £ sign correctly
  prepared.csv = new File(['﻿' + rows.join('\r\n')], `flip-stock-${stamp()}.csv`, { type: 'text/csv' });
}

function csvCell(v) {
  const s = String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Opens the Share sheet (iPhone) or downloads the file (computer)
async function shareFile(file) {
  if (!file) { toast('Still getting ready, tap again'); return false; }
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false; // you closed the share sheet
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  return true;
}

$('#btn-backup-full').addEventListener('click', async () => {
  if (await shareFile(prepared.full)) {
    await setSetting('lastBackup', Date.now());
    showLastBackup();
  }
});
$('#btn-backup-csv').addEventListener('click', () => shareFile(prepared.csv));

// Prepare files whenever Settings is opened
$('.tabbar button[data-tab="settings"]').addEventListener('click', () => { prepareBackups(); showLastBackup(); });
$('#backup-nag').addEventListener('click', () => {
  showTab('settings');
  prepareBackups(); showLastBackup();
});


// ---------- Restore ----------
$('#btn-restore').addEventListener('click', () => $('#restore-input').click());
$('#restore-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const isJson = file.name.toLowerCase().endsWith('.json') || text.trim().startsWith('{');
    const n = isJson ? await restoreJson(text) : await restoreCsv(text);
    toast(`Restored ${n} item${n === 1 ? '' : 's'} ✓`);
    await renderStock();
    prepareBackups();
  } catch (err) {
    toast('That file couldn’t be read. Is it a Flip backup?');
  }
});

async function restoreJson(text) {
  const data = JSON.parse(text);
  if (data.app !== 'flip' || !Array.isArray(data.items)) throw new Error('not a flip backup');
  for (const it of data.items) if (it && it.id) await DB.put('items', it);
  for (const k of SETTING_KEYS) {
    if (data.settings?.[k] != null) await setSetting(k, data.settings[k]);
  }
  await loadSettings();
  await loadTemplate();
  return data.items.length;
}

async function restoreCsv(text) {
  const rows = parseCsv(text.replace(/^﻿/, ''));
  const head = rows.shift().map(h => h.trim());
  if (!head.includes('name')) throw new Error('no name column');
  let n = 0;
  for (const row of rows) {
    const rec = {};
    head.forEach((h, i) => rec[h] = (row[i] ?? '').trim());
    if (!rec.name) continue;
    const existing = rec.id ? await DB.get('items', rec.id) : null;
    const it = { ...(existing || {}) };       // keeps the photo if the item already exists
    for (const c of CSV_COLUMNS) {
      if (c === 'profit' || c === 'feePercent' || c === 'feeFixed' || !(c in rec)) continue;
      it[c] = rec[c];
    }
    it.id = it.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    it.created = Number(it.created) || Date.now();
    it.status = ['bought', 'listed', 'sold'].includes((it.status || '').toLowerCase()) ? it.status.toLowerCase() : 'bought';
    if (rec.feePercent !== undefined || rec.feeFixed !== undefined) {
      it.cfg = { feePercent: money(rec.feePercent) ?? cfg.feePercent, feeFixed: money(rec.feeFixed) ?? cfg.feeFixed };
    }
    await DB.put('items', it);
    n++;
  }
  return n;
}

// Reads CSV text into rows of cells (handles "quoted, text" and line breaks inside quotes)
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}


// ---------- "Last backup" + reminder ----------
async function showLastBackup() {
  const last = await getSetting('lastBackup', null);
  const items = await DB.all('items');
  const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
  $('#backup-last').textContent = last
    ? `Last full backup: ${new Date(last).toLocaleDateString('en-GB')} (${days === 0 ? 'today' : days + ' day' + (days === 1 ? '' : 's') + ' ago'})`
    : 'No full backup yet.';
  $('#backup-nag').hidden = !(items.length && (days == null || days >= NAG_DAYS));
}
$('.tabbar button[data-tab="stock"]').addEventListener('click', showLastBackup);

showLastBackup();
prepareBackups();
