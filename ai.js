// ===== AI PHOTO IDENTIFY (Google Gemini, free tier) =====
// Sends up to 3 of the item's photos to Gemini and fills in the empty boxes.
// The API key is saved on the phone only (settings 'aiKey'), never in backups or in this code.
// Uses things from app.js: $, draft, readForm, fillForm, saveDraft, autoFillFromName, getPhotos, showStatus, getSetting, setSetting

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
const AI_MAX_PHOTOS = 3;
let aiKey = '', aiAuto = true, aiModels = null, aiBusy = false;

const AI_PROMPT = `You identify second-hand items being checked for resale on Vinted UK.
Look carefully at every photo, including labels, care tags, size tags, logos and boxes.
Return JSON with these fields (use "" when you can't tell; never invent a size):
- name: short, searchable listing name, e.g. "Nike Air Max 90 White" or "Zara Wool Blend Blazer Black"
- brand
- model: product line / model name or type of item, without the brand
- size: exactly as printed on a label (e.g. "UK 9", "M", "W32 L30"), else ""
- colour: main colour(s) in plain English, e.g. "Black" or "Black / White"
- condition: "New with tags" ONLY if shop tags are clearly attached, otherwise ""
- confidence: "high", "medium" or "low"
- notes: one short sentence on anything uncertain`;

const AI_SCHEMA = {
  type: 'OBJECT',
  properties: Object.fromEntries(['name', 'brand', 'model', 'size', 'colour', 'condition', 'confidence', 'notes']
    .map(k => [k, { type: 'STRING' }])),
  required: ['name', 'brand', 'model', 'size', 'colour', 'condition', 'confidence', 'notes'],
};


// ---------- Pick a model ----------
// Asks Google which models this key can use, and prefers the newest stable "Flash" model
// (fast, and on the free tier). Means the app keeps working when Google renames models.
async function aiPickModels() {
  if (aiModels) return aiModels;
  const res = await fetch(`${GEMINI}/models?pageSize=200`, { headers: { 'x-goog-api-key': aiKey } });
  if (!res.ok) throw await aiError(res);
  const names = ((await res.json()).models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name.replace(/^models\//, ''));
  const ver = n => parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
  const stableFlash = names.filter(n => /^gemini-\d+(\.\d+)?-flash$/.test(n)).sort((a, b) => ver(b) - ver(a));
  const lite = names.filter(n => /^gemini-\d+(\.\d+)?-flash-lite$/.test(n)).sort((a, b) => ver(b) - ver(a));
  const latest = names.filter(n => n === 'gemini-flash-latest');
  aiModels = [...stableFlash, ...latest, ...lite];
  if (!aiModels.length) aiModels = names.filter(n => /flash/.test(n) && !/image|tts|audio|live/.test(n));
  if (!aiModels.length) throw new Error('No suitable Gemini model is available for this key.');
  return aiModels;
}

async function aiError(res) {
  let msg = '';
  try { msg = (await res.json()).error?.message || ''; } catch (e) {}
  if (res.status === 400 && /API key/i.test(msg)) return new Error('That API key doesn’t look right. Check it in Settings.');
  if (res.status === 403) return new Error('Google refused the key. Check it in Settings.');
  if (res.status === 429) return Object.assign(new Error('Free AI limit reached for now. Try again later.'), { busy: true });
  return Object.assign(new Error(msg || `Google error ${res.status}`), { status: res.status });
}


// ---------- Identify ----------
// Makes a smaller copy of a photo (saves the free quota and is faster on weak signal)
function aiShrink(dataUrl, max = 768) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.8).split(',')[1]);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

async function aiIdentify(photos) {
  const parts = [{ text: AI_PROMPT }];
  for (const p of photos.slice(0, AI_MAX_PHOTOS)) {
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: await aiShrink(p) } });
  }
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: AI_SCHEMA, temperature: 0.2 },
  });

  let lastErr;
  for (const model of (await aiPickModels()).slice(0, 3)) {   // try the next model if one is busy/missing
    const res = await fetch(`${GEMINI}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': aiKey },
      body,
    });
    if (res.ok) {
      const text = (await res.json()).candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
      return JSON.parse(text);
    }
    lastErr = await aiError(res);
    if (!(lastErr.busy || lastErr.status === 404 || lastErr.status >= 500)) break;
  }
  throw lastErr;
}

// Runs AI on the Check screen's photos and fills the empty boxes
async function runIdentify() {
  if (aiBusy) return;
  const photos = getPhotos(draft);
  if (!photos.length) { showStatus('Add a photo first.'); return; }
  if (!aiKey) { showStatus('Add your free Gemini key in Settings to use AI identify.'); return; }
  if (!navigator.onLine) { showStatus('No signal, so AI identify needs internet. Type the name yourself.'); return; }

  aiBusy = true;
  $('#btn-ai-identify').textContent = '🤖 Looking at your photo…';
  showStatus('AI is looking at your photo…');
  try {
    const g = await aiIdentify(photos);
    readForm();
    const typedName = draft.name;
    for (const k of ['name', 'brand', 'model', 'size', 'colour', 'condition']) {
      if (g[k] && !draft[k]) draft[k] = String(g[k]).trim();
    }
    fillForm();
    await autoFillFromName();   // fills anything still empty from the name
    showAiResult(g, typedName);
  } catch (e) {
    showStatus('AI identify: ' + (e.message || 'something went wrong'));
  } finally {
    aiBusy = false;
    $('#btn-ai-identify').textContent = '🤖 Identify from photo';
  }
}

function showAiResult(g, typedName) {
  const box = $('#scan-status');
  box.hidden = false;
  box.textContent = '';
  const conf = { high: 'sure', medium: 'fairly sure', low: 'not sure' }[g.confidence] || g.confidence || '';
  box.appendChild(document.createTextNode(
    g.name ? `🤖 AI thinks: ${g.name}${conf ? ` (${conf})` : ''}. Empty boxes filled in; check them.` : '🤖 AI couldn’t tell what this is. Type the name yourself.'));
  if (g.notes) {
    const n = document.createElement('div'); n.className = 'muted small'; n.textContent = g.notes; box.appendChild(n);
  }
  // You'd already typed a different name: offer to swap
  if (typedName && g.name && typedName.toLowerCase() !== g.name.toLowerCase()) {
    const b = document.createElement('button');
    b.className = 'use-btn';
    b.textContent = `Use AI name: “${g.name}”`;
    b.addEventListener('click', async () => {
      $('#f-name').value = g.name;
      await saveDraft();
      updatePriceLinks();
      b.remove();
    });
    box.appendChild(b);
  }
}

// Called by app.js after photos are added
function autoIdentify() {
  if (aiKey && aiAuto) runIdentify();
}
function updateAiButton() {
  $('#btn-ai-identify').hidden = !(aiKey && getPhotos(draft).length);
}
$('#btn-ai-identify').addEventListener('click', runIdentify);


// ---------- Settings ----------
$('#s-aiKey').addEventListener('change', async e => {
  aiKey = e.target.value.trim();
  aiModels = null;
  await setSetting('aiKey', aiKey);
  updateAiButton();
  $('#ai-test-status').textContent = '';
});
$('#s-aiAuto').addEventListener('change', async e => {
  aiAuto = e.target.checked;
  await setSetting('aiAuto', aiAuto);
});
$('#btn-ai-test').addEventListener('click', async () => {
  aiKey = $('#s-aiKey').value.trim();
  await setSetting('aiKey', aiKey);
  aiModels = null;
  const out = $('#ai-test-status');
  if (!aiKey) { out.textContent = 'Paste a key first.'; return; }
  out.textContent = 'Checking…';
  try {
    const models = await aiPickModels();
    out.textContent = `✅ Key works. Using ${models[0]}.`;
  } catch (e) {
    out.textContent = '❌ ' + e.message;
  }
  updateAiButton();
});

(async () => {
  aiKey = await getSetting('aiKey', '');
  aiAuto = await getSetting('aiAuto', true);
  $('#s-aiKey').value = aiKey;
  $('#s-aiAuto').checked = aiAuto;
  updateAiButton();
})();
