// ===== Saving data on the phone (IndexedDB) =====
// Two "stores" (like tables):
//   items    — every item in your stock list
//   settings — your fees, minimum profit, template, etc. (one row per setting)
// Use: await DB.put('items', item), await DB.get('items', id), await DB.all('items'), await DB.del('items', id)

const DB = (() => {
  const NAME = 'flip-db';
  const VERSION = 1;
  let dbPromise;

  function open() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(NAME, VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('items')) db.createObjectStore('items', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  async function run(store, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = () => reject(tx.error);
    });
  }

  return {
    put: (store, value) => run(store, 'readwrite', s => s.put(value)),
    get: (store, key) => run(store, 'readonly', s => s.get(key)),
    all: (store) => run(store, 'readonly', s => s.getAll()),
    del: (store, key) => run(store, 'readwrite', s => s.delete(key)),
    clear: (store) => run(store, 'readwrite', s => s.clear()),
  };
})();

// Ask iPhone not to clear our data when storage is low
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
