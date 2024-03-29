// Copyright 2021 Roy T. Hashimoto. All Rights Reserved.

// Define the selectable configurations.
const CONFIGURATIONS = new Map([
  {
    label: 'opfs / jspi',
    isAsync: true,
    dbName: '/demo-opfs-benchmark'
  }

].map(obj => [obj.label, obj]));

const benchmarksReady = Promise.all(Array.from(new Array(16), (_, i) => {
  const filename = `./benchmark${i + 1}.sql`;
  return fetch(filename).then(response => response.text());
}));
  
const ComlinkReady = import('https://unpkg.com/comlink/dist/esm/comlink.mjs');

const headers = document.querySelector('thead').firstElementChild;
for (const config of CONFIGURATIONS.values()) {
  addEntry(headers, config.label)
}

document.getElementById('start').addEventListener('click', async event => {
  // @ts-ignore
  event.target.disabled = true;

  // Clear any existing storage state.
  const cleanWorker = new Worker('./clean-worker.js', { type: 'module' });
  await new Promise(resolve => {
    cleanWorker.addEventListener('message', resolve);
  });
  cleanWorker.terminate();

  // Clear timings from the table.
  Array.from(document.getElementsByTagName('tr'), element => {
    if (element.parentElement.tagName === 'TBODY') {
      // Keep only the first child.
      while (element.firstElementChild.nextElementSibling) {
        element.firstElementChild.nextElementSibling.remove();
      }
    }
  });

  const benchmarks = await benchmarksReady;
  const Comlink = await ComlinkReady;
  try {
    // @ts-ignore
    const preamble = document.getElementById('preamble').value;
    document.getElementById('error').textContent = '';
    for (const config of CONFIGURATIONS.values()) {
      const worker = new Worker('./demo-worker.js', { type: 'module' });
      try {
        await Promise.race([
          new Promise(resolve => {
            worker.addEventListener('message', resolve, { once: true });
          }),
          new Promise((_, reject) => setTimeout(() => {
            reject(new Error(`${config.label} initialization timeout`));
          }, 5000))
        ])

        const workerProxy = Comlink.wrap(worker)
        const sql = await workerProxy(config);

        await sql([preamble], []);

        let tr = document.querySelector('tbody').firstElementChild;
        for (const benchmark of benchmarks) {
          const startTime = Date.now();
          await sql([benchmark], []);
          const elapsed = (Date.now() - startTime) / 1000;

          addEntry(tr, elapsed.toString());
          tr = tr.nextElementSibling;
        }
      } finally {
        worker.terminate();
      }
    }
  } catch (e) {
    document.getElementById('error').textContent = e.stack.includes(e.message) ? e.stack : `${e.stack}\n${e.message}`;
  } finally {
    // @ts-ignore
    event.target.disabled = false;
  }
});

function addEntry(parent, text) {
  const tag = parent.parentElement.tagName === 'TBODY' ? 'td' : 'th';
  const child = document.createElement(tag);
  child.textContent = text;
  parent.appendChild(child);
}