const DB_NAME = 'worker-terminate-idb';

export async function openDatabase() {
  const request = indexedDB.open(DB_NAME, 1);
  request.addEventListener('upgradeneeded', function(event) {
    const db = event.target.result;
    db.createObjectStore('kv');
  });
  return new Promise(function(resolve, reject) {
    request.addEventListener('success', function(event) {
      resolve(event.target.result);
    });
    request.addEventListener('error', function(event) {
      reject(event.target.error);
    });
  });
}

export async function deleteDatabase() {
  indexedDB.deleteDatabase(DB_NAME);
}