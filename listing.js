// ===== DRAFT VINTED LISTING =====
// Builds a title, description and hashtags from a template (editable in Settings).
// Template rules:
//   {brand}            → replaced with the item's brand
//   [Size: {size}]     → the whole [ ... ] part is left out if size is empty

const TPL_DEFAULT = {
  title: '{brand} {model}[ – {colour}][ – Size {size}]',
  desc:
`{brand} {model}

[Size: {size}
][Colour: {colour}
][Condition: {condition}
][Measurements: {measurements}
][Flaws: {flaws}
]
Posted within 1–2 days and carefully packed.
Bundles welcome, just send me a message!`,
  tags: '#vinteduk',
};
let tpl = { ...TPL_DEFAULT };

// Fills a template with the item's details
function fillTemplate(text, item) {
  const val = k => String(item[k] ?? '').trim();
  // drop [ ... ] sections that mention an empty {word}
  text = text.replace(/\[([^\]]*)\]/g, (_, inner) =>
    /\{(\w+)\}/.test(inner) && [...inner.matchAll(/\{(\w+)\}/g)].some(m => !val(m[1])) ? '' : inner);
  text = text.replace(/\{(\w+)\}/g, (_, k) => val(k));
  return text.replace(/[ \t]+/g, ' ').replace(/ +\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// "air max 90" → "Air Max 90" (leaves words like "iPhone" or "TNF" alone)
const capWords = s => s.replace(/\b([a-z])([a-z]*)\b/g, (_, a, b) => a.toUpperCase() + b);

function listingData(item) {
  const d = { ...item };
  // No brand or model? Use the item name instead
  if (!d.brand && !d.model) { d.brand = d.name || ''; d.model = ''; }
  d.model = capWords(d.model || '');
  d.brand = capWords(d.brand || '');
  return d;
}

function makeHashtags(item) {
  const tag = s => '#' + String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const tags = [];
  if (item.brand) tags.push(tag(item.brand));
  if (item.model) {
    tags.push(tag(item.model));                         // #airmax90
    if (item.brand) tags.push(tag(item.brand + item.model)); // #nikeairmax90
  }
  if (item.colour) tags.push(...item.colour.split('/').map(c => tag(c)));
  if (/vintage/i.test(item.name || '')) tags.push('#vintage');
  tags.push(...(tpl.tags || '').split(/\s+/).filter(Boolean).map(t => t.startsWith('#') ? t : '#' + t));
  return [...new Set(tags.filter(t => t.length > 2))].join(' ');
}

// Called by stock.js whenever an item is opened or edited
async function renderDraftListing(item) {
  // --- AI WRITER: future feature goes here ---
  // e.g. const ai = await aiWriteListing(item); if (ai) { show ai.title / ai.desc / ai.tags instead; return; }
  const d = listingData(item);
  $('#l-title').value = fillTemplate(tpl.title, d);
  $('#l-desc').value = fillTemplate(tpl.desc, d);
  $('#l-tags').value = makeHashtags(item);
  updateTitleCount();
}

// Placeholder for a future AI listing writer. Returns nothing for now.
async function aiWriteListing(item) {
  return null;
}

function updateTitleCount() {
  $('#l-title-count').textContent = `(${$('#l-title').value.length} characters)`;
}
$('#l-title').addEventListener('input', updateTitleCount);


// ---------- Copy buttons ----------
async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    // older fallback
    const t = document.createElement('textarea');
    t.value = text; document.body.appendChild(t); t.select();
    document.execCommand('copy'); t.remove();
  }
  const old = btn.textContent;
  btn.textContent = 'Copied ✓';
  btn.classList.add('copied');
  setTimeout(() => { btn.textContent = old; btn.classList.remove('copied'); }, 1500);
}
$$('.btn.copy').forEach(b => b.addEventListener('click', () => copyText($('#' + b.dataset.copy).value, b)));
$('#btn-copy-all').addEventListener('click', e =>
  copyText($('#l-desc').value + '\n\n' + $('#l-tags').value, e.currentTarget));


// ---------- Template settings ----------
const TPL_INPUTS = { title: '#s-tplTitle', desc: '#s-tplDesc', tags: '#s-tplTags' };

async function loadTemplate() {
  tpl = { ...TPL_DEFAULT, ...(await getSetting('tpl', {})) };
  for (const [k, sel] of Object.entries(TPL_INPUTS)) $(sel).value = tpl[k];
}
for (const [k, sel] of Object.entries(TPL_INPUTS)) {
  $(sel).addEventListener('input', async () => {
    tpl[k] = $(sel).value;
    await setSetting('tpl', tpl);
  });
}
$('#btn-tpl-reset').addEventListener('click', async () => {
  tpl = { ...TPL_DEFAULT };
  await setSetting('tpl', tpl);
  await loadTemplate();
  toast('Template reset');
});

loadTemplate();
