'use strict';

console.log('Hello from ServiceWorker!');

globalThis.addEventListener('install', (/** @type {ExtendableEvent} */ event) => {
  event.waitUntil(globalThis.skipWaiting());
});

globalThis.addEventListener('activate', (/** @type {ExtendableEvent} */ event) => {
  event.waitUntil(globalThis.clients.claim());
});

globalThis.addEventListener('fetch', (/** @type {FetchEvent} */ event) => {
  const url = new URL(event.request.url);
  if (url.pathname.endsWith('worker.js')) {
    event.respondWith(new Response(`
      import foo from './worker-module.js';

      console.log('Imported value = ', foo);
      new Function('console.log("Hello from Function"');
    `, {
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': 'application/javascript',
        'Content-Security-Policy': 'default-src none'
      }
    }));
  } else if (url.pathname.endsWith('worker-module.js')) {
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