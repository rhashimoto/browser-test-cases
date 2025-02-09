const TIME_FORMAT = {
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3
};

const worker = new Worker('./bandwidth-worker.js', { type: 'module' });
worker.addEventListener('message', ({data}) => {
  const timestamp = new Date().toLocaleTimeString(undefined, TIME_FORMAT);
  const pre = document.createElement('pre');
  pre.textContent = `${timestamp} ${data}`;
  document.body.appendChild(pre);
});