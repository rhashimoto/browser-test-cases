import { openDatabase, deleteDatabase } from './idb.js';

(async function() {
  deleteDatabase();

  const worker = new Worker('./worker.js', { type: "module" });
  await new Promise(function(resolve) {
    worker.addEventListener('message', function({ data }) {
      resolve(data);
    });
  });
  worker.terminate();

  const db = await openDatabase();
  const tx = db.transaction(db.objectStoreNames, 'readwrite');
  const objectStore = tx.objectStore(db.objectStoreNames[0]);
  const request = objectStore.getAllKeys();
  const result = await new Promise(function(resolve, reject) {
    request.addEventListener('success', function(event) {
      resolve(event.target.result);
    });
    request.addEventListener('error', function(event) {
      resolve(event.target.error);
    });
  });

  document.getElementById('output').textContent = `
    ${result.length} objects in IndexedDB
  `;
})();
