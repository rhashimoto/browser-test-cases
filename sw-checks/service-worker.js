const broadcastChannel = new BroadcastChannel('sw-log');
broadcastChannel.postMessage('service worker start');

// Install the service worker as soon as possible.
globalThis.addEventListener('install', (/** @type {ExtendableEvent} */ event) => {
  broadcastChannel.postMessage('install event');
  event.waitUntil(globalThis.skipWaiting());
});
globalThis.addEventListener('activate', (/** @type {ExtendableEvent} */ event) => {
  broadcastChannel.postMessage('activate event');
  event.waitUntil(globalThis.clients.claim());
});

globalThis.addEventListener('fetch', (/** @type {FetchEvent} */ event) => {
  broadcastChannel.postMessage(`fetch event: ${event.request.url}`);
  if (event.request.url.endsWith('foo.js')) {
    event.respondWith((async function() {
      return new Response(`export default 'from service worker';`, {
        headers: {
          'Content-Type': 'application/javascript'
        }
      });
    })());
  }
});