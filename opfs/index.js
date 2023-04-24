const TIME_FORMAT = {
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3
};

const worker = new Worker('./worker.js');
worker.addEventListener('message', ({data}) => {
  const { time, text } = data;
  const timestamp = time.toLocaleTimeString(undefined, TIME_FORMAT);
  const pre = document.createElement('pre');
  pre.textContent = `${timestamp} ${text}`;
  document.body.appendChild(pre);
});