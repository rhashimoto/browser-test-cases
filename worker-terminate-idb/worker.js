import { openDatabase } from "./idb.js";

const REQUEST_COUNT = 100;

(async function() {
  const db = await openDatabase();

  const tx = db.transaction(db.objectStoreNames, 'readwrite');
  const txComplete = new Promise(function(resolve) {
    tx.addEventListener('complete', resolve);
  });

  const requests = [];
  const objectStore = tx.objectStore(db.objectStoreNames[0]);
  for (let i = 0; i < REQUEST_COUNT; ++i) {
    const request = objectStore.put(new Uint8Array(2**20), i);
    requests.push(request);
  }

  await txComplete;
  db.close();
  postMessage('worker done');
})();
