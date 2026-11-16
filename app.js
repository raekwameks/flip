// ===== Main app code =====
const APP_VERSION = '1'; // keep in step with VERSION in sw.js

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

// ----- Offline support: register the service worker -----
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
