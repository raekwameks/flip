// ===== Main app code =====
const APP_VERSION = '2'; // keep in step with VERSION in sw.js

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
const FIELDS = ['name', 'brand', 'model', 'size', 'colour', 'condition'];
let draft = { photo: null };

function readForm() {
  FIELDS.forEach(f => draft[f] = $('#f-' + f).value.trim());
}
function fillForm() {
  FIELDS.forEach(f => $('#f-' + f).value = draft[f] || '');
  $('#photo-box').hidden = !draft.photo;
  $('#photo-preview').src = draft.photo || '';
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

FIELDS.forEach(f => $('#f-' + f).addEventListener('input', saveDraft));
$('#f-condition').addEventListener('change', saveDraft);

$('#btn-type').addEventListener('click', () => $('#f-name').focus());
$('#btn-scan').addEventListener('click', () => { $('#scan-note').hidden = false; });

$('#btn-clear').addEventListener('click', async () => {
  draft = { photo: null };
  fillForm();
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
