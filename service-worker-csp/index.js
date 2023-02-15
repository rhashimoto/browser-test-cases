(async function() {
  await new Promise(resolve => {
    window.addEventListener('load', () => {
      const url = new URL('./service-worker.js', import.meta.url);
      resolve(navigator.serviceWorker.register(url));
    });
  }).then(async () => {
    await navigator.serviceWorker.ready;
    console.log('Service Worker ready')
  }, e => {
    console.warn('service worker load failed', e);
  });

  const worker = new Worker(
    './worker.js?import=worker-module&key=nomoresecrets',
    { type: "module" });

  navigator.serviceWorker.controller.postMessage('from window');
  navigator.serviceWorker.addEventListener('message', event => {
    console.log('Window message received', event);
  });
})();