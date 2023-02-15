'use strict';

console.log('Hello from ServiceWorker!');

globalThis.addEventListener('install', (/** @type {ExtendableEvent} */ event) => {
  event.waitUntil(globalThis.skipWaiting());
});

globalThis.addEventListener('activate', (/** @type {ExtendableEvent} */ event) => {
  event.waitUntil(globalThis.clients.claim());
});

globalThis.addEventListener('fetch', (/** @type {FetchEvent} */ event) => {
  console.log('fetch event', event);
  const url = new URL(event.request.url);
  if (url.pathname.endsWith('worker.js')) {
    const importName = url.searchParams.get('import');
    const key = url.searchParams.get('key');
    event.respondWith(new Response(`
      import foo from './${importName}?key=${key}';

      (function() { console.log(this); })();
      console.log('Imported value = ', foo);
      fetch('www.example.com');
      import('./another.js');
      new Function('console.log("Hello from Function"');
    `, {
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': 'application/javascript',
        'Content-Security-Policy': 'default-src none'
      }
    }));
  } else if (url.pathname.endsWith('worker-module')) {
    const url = new URL(event.request.url);
    const key = url.searchParams.get('key');
    event.respondWith(new Response(`
      console.log('Hello from Worker module!');
      export default 42;
    `, {
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': 'application/javascript',
        'Content-Security-Policy': 'default-src none'
      }
    }));
  }
});

globalThis.addEventListener('message', async event => {
  console.log('SW message received', event);
  const clientList = await clients.matchAll({ type: 'all' });
  console.log(clientList);
  event.source.postMessage('from service worker');
});