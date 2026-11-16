# Flip: my Vinted resale app

A personal app for checking whether an item is worth buying to resell, keeping track of stock, and writing Vinted listings.

- **Open it:** https://raekwameks.github.io/flip/
- **Costs:** nothing. No paid services, no Apple developer account.
- **Your data:** stays on your phone. It is never uploaded anywhere. (The *code* on GitHub is public; your stock is not in it.)
- **Works offline:** everything except the eBay/Vinted price buttons and barcode name lookups.

---

## Put it on your iPhone

1. Open **Safari** (not Chrome) and go to `raekwameks.github.io/flip`
2. Tap the **Share** button (square with an up arrow).
3. Tap **Add to Home Screen**, then **Add**.
4. Always open Flip from the home-screen icon. Data saved there is separate from the Safari tab.

---

## How to use it

### 1. Check an item (🔍 Check tab)
- **Scan**: point the camera at a barcode or QR code. The name, brand, model, size and colour fill in if the product is known.
- **Photo**: take a photo, or pick several from your photo library (up to 10 per item). The first one is the **cover** shown in the stock list. Tap a thumbnail to see it big, **Make cover** or **Delete photo**.
- **🤖 AI identify** (optional, free): after you add photos, Google Gemini looks at them (item, labels, tags) and fills in the name, brand, model, size and colour. It only fills **empty** boxes. If you'd already typed a name, it offers a **Use AI name** button. Take a photo of the label or size tag as well for better results. Turn on in **Settings → AI photo identify** (see below).
- **Type**: type the name, e.g. `Nike Air Max 90 white UK 9`, then tap **Done**. Brand, model, size, colour and condition fill themselves in. It only fills empty boxes, so it never overwrites what you typed.

### 2. Check prices
- **eBay sold** opens eBay UK *sold* listings for the item.
- **Vinted live** opens Vinted UK listings for the item.
- Come back and type the **low / typical / high** sold prices and the **Vinted asking price**.
- Change **Search words** if the search needs tweaking.

### 3. Profit
- Type the **buy price**. Leave **Expected sell** empty to use the typical eBay price.
- Grey numbers are your defaults from Settings. Type over them for just this item.
- The big **BUY** (green) or **SKIP** (red) is based on your **minimum profit** in Settings.
- **ROI** = profit as a percentage of what you spent (buy price + postage + other costs).

### 4. Add to stock
Tap **＋ Add to stock**. It is saved as *Bought* with today's date.

### Stock list (📦 Stock tab)
- Totals at the top: money spent, money made, profit (sold items), items in stock.
- **Monthly profit chart**: profit from items sold in each of the last 12 months. Orange bars = profit, purple bars below the line = a month that lost money. Tap a bar to see that month's profit and number of sales; **Show as a table** lists every month. A sale counts in the month of its *Sold* date.
- Search box, and **All / Bought / Listed / Sold** filters.
- Tap an item to open it:
  - Tap **Listed** or **Sold**. Today's date is filled in automatically.
  - Enter listed price, sold price and fees paid. Leave *fees paid* empty to use the estimate.
  - **Draft listing**: add measurements and flaws, then use the **Copy** buttons and paste into Vinted.
  - **＋ Add photos** adds more photos to an item already in stock.
  - **Delete item** needs two taps.

### Settings (⚙️)
- **Backup** (see below).
- **Minimum profit to BUY.**
- **Default fees & costs**: selling fee %, fixed fee per sale, postage you pay, other costs. Nothing is built in, so update these if Vinted or eBay change their fees. Each item keeps the fees from the day you added it.
- **Listing template**: change the wording of every draft listing.
  - `{brand}`, `{model}`, `{size}`, `{colour}`, `{condition}`, `{measurements}`, `{flaws}`, `{name}` get filled in.
  - Anything in `[square brackets]` is left out if one of its `{words}` is empty.
- **Barcode lookup relay**: the address of your Cloudflare relay (see below).

---

## Backing up (do this weekly)

Your stock only lives on your phone. If you delete the Flip icon or lose your phone, it is gone unless you have a backup.

**Back up:**
1. **Settings → Full backup (with photos)**
2. Tap **Save to Files** → **iCloud Drive** → **Save**

**Export CSV** makes a spreadsheet (no photos) you can open in Numbers, Excel or Google Sheets.

**Restore:** **Settings → Restore from a backup file** → pick the `flip-backup-….json` (or a `.csv`). It adds and updates items; it never deletes.

A yellow reminder appears on the Stock tab if you haven't made a full backup for 7 days.

**New phone?** Add Flip to the home screen, then restore your latest backup from iCloud Drive.

---

## AI photo identify (setup, once)

1. On your phone or computer, go to **aistudio.google.com/apikey** and sign in with a Google account.
2. Tap **Create API key** and copy it.
3. In Flip: **Settings → AI photo identify**, paste the key, tap **Test key**. It should say ✅.
4. Leave **Identify automatically when I add a photo** ticked, or untick it and use the **🤖 Identify from photo** button instead.

Good to know:
- It's **free** on Google's free tier, which has a daily limit (not clearly published). If you hit it, Flip says so; try later.
- Photos go to Google only when identifying. On the free tier Google may use them to improve its products.
- The key is stored only on your phone and is **not** in backup files. On a new phone, paste it in again.
- AI can be wrong. Always glance at the boxes, especially size.

## Barcode lookups

After a scan, Flip tries these in order:
1. **UPCitemdb** (electronics, branded goods), through your own free Cloudflare relay. About 100 lookups a day; sometimes "busy", so Flip retries once.
2. **Open Food Facts** and **Open Beauty Facts** (food, toiletries, cosmetics).
3. If nothing is found, type the name yourself.

Clothes often have no barcode entry anywhere. Typing the name with auto-fill is usually quickest.

**The relay** is a Cloudflare Worker called `flip-barcode` in your Cloudflare account (dash.cloudflare.com → Workers & Pages). Its code is in `cloudflare-worker.js`. Its address goes in **Flip → Settings → Relay address**.

---

## Updating the app

**Easiest:** ask Claude Code to make the change (the project is in `~/Flip` on the Mac). It edits the code and publishes it.

**Doing it yourself:**
1. Edit the file(s) in `~/Flip`.
2. Raise the version number in **two** places, both to the same number:
   - `sw.js`: `const VERSION = '11';`
   - `app.js`: `const APP_VERSION = '11';`
   (Phones only notice an update when this number changes.)
3. In Terminal:
   ```
   cd ~/Flip
   git add -A
   git commit -m "describe the change"
   git push
   ```
4. Wait about a minute for GitHub to publish it. Next time Flip opens with signal, it updates itself.

To check which version your phone has: **Settings → App version**.

---

## What's in each file

| File | What it does |
|---|---|
| `index.html` | All the screens and buttons |
| `style.css` | Colours and layout. Change colours at the top under `:root` |
| `app.js` | Check screen: photo, scanning, auto-fill, price links, profit, settings |
| `stock.js` | Stock list, totals, item page |
| `listing.js` | Draft Vinted listing and template |
| `backup.js` | Backup, CSV export and restore |
| `ai.js` | AI photo identify (Google Gemini free tier) |
| `db.js` | Saving data on the phone |
| `sw.js` | Makes the app work offline |
| `lib/html5-qrcode.min.js` | Barcode/QR scanner library |
| `cloudflare-worker.js` | Barcode relay code (runs on Cloudflare, not in the app) |

**Adding brands or colours for auto-fill:** edit the `BRANDS` and `COLOURS` lists in `app.js`.

**AI:**
- `ai.js`: AI photo identify (Gemini). The instructions sent to the AI are in `AI_PROMPT`.
- `aiWriteListing()` in `listing.js`: spot left for an AI listing writer later.

---

## Troubleshooting

- **Camera won't open:** iPhone **Settings → Apps → Safari → Camera** → *Ask* or *Allow*. Home-screen apps may ask for camera permission each time; that's an Apple limit.
- **Not working offline:** open Flip with signal, go to **Settings**, and wait until **Offline ready** shows ✅.
- **Don't see a new change:** open Flip with signal and wait a few seconds. It reloads by itself. If not, swipe it away and reopen.
- **Copy button didn't work:** press and hold in the text box → **Select All** → **Copy**.
