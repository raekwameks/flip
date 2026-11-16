// ===== Barcode lookup relay (runs on Cloudflare, free) =====
// UPCitemdb won't answer the Flip app directly, so this tiny relay asks on the app's behalf.
// Paste this whole file into a Cloudflare Worker (see README), then put the Worker's address in Flip > Settings.
// Free trial limit: about 100 lookups a day.

const APP_ADDRESS = 'https://raekwameks.github.io'; // only the Flip app may use this relay

export default {
  async fetch(request) {
    const cors = {
      'Access-Control-Allow-Origin': APP_ADDRESS,
      'Content-Type': 'application/json',
    };
    const upc = (new URL(request.url).searchParams.get('upc') || '').replace(/\D/g, '');
    if (!upc) return new Response('{"error":"no barcode"}', { status: 400, headers: cors });

    const res = await fetch('https://api.upcitemdb.com/prod/trial/lookup?upc=' + upc);
    return new Response(await res.text(), { status: res.status, headers: cors });
  },
};
