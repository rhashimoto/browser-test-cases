(async () => {
  const broadcastChannel = new BroadcastChannel('sw-log');
  broadcastChannel.addEventListener('message', ({data}) => {
    log(data);
  });

  const registration = await navigator.serviceWorker.register('./service-worker.js');
  await navigator.serviceWorker.ready;

  const sw = registration.active;
  if (sw.state !== 'activated') {
    await new Promise(resolve => {
      sw.addEventListener('statechange', () => {
        if (sw.state === 'activated') {
          resolve();
        }
      });
    });
  }
  log('service worker activated');

  const worker = new Worker('./worker.js', { type: 'module' });
  worker.addEventListener('message', ({data}) => {
    log(data);
  });

})();

function log(message) {
  const element = document.createElement('pre');
  element.textContent = `${new Date().toLocaleString()}  ${message}`;
  document.body.appendChild(element);
}