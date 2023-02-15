window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('module').addEventListener('click', () => {
    // Start a ES6 module Worker. The Worker posts a message back.
    const worker = new Worker('./worker.js', { type: 'module' });
    worker.addEventListener('message', ({ data }) => {
      logToOutput(`module: ${data}`);
    });
  });
  document.getElementById('classic').addEventListener('click', () => {
    // Start a non-module Worker. The Worker posts a message back.
    const worker = new Worker('./worker.js', { type: 'classic' });
    worker.addEventListener('message', ({ data }) => {
      logToOutput(`classic: ${data}`);
    });
  });
});

function logToOutput(data) {
  const output = document.getElementById('output');
  const entry = document.createElement('pre');
  entry.textContent = `${new Date().toLocaleTimeString()} ${data}`;
  output.appendChild(entry);
}
logToOutput('Click button and Worker will log below...');