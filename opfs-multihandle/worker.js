const TEST_FILENAME = 'foo';

async function prepare() {
  log('Removing all OPFS files and directories...');
  const root = await navigator.storage.getDirectory();
  if (root.remove) {
    await root.remove( { recursive: true });
  } else {
    for await (const handle of root.values()) {
      await root.removeEntry(handle.name, { recursive: true });
    }
  }
}

async function go() {
  const root = await navigator.storage.getDirectory();

  log('Creating test file...');
  const handle = await root.getFileHandle(TEST_FILENAME, { create: true });

  const syncHandles = [];
  for (let i = 0; i < 2; ++i) {
    log(`Creating sync handle ${i}...`);
    syncHandles.push(await handle.createSyncAccessHandle({ mode: 'readwrite-unsafe' }));
  }
}

Promise.resolve().then(prepare)
  .then(go).catch(e => {
    const text = e.stack.includes(e.message) ? e.stack : `${e.message}\n${e.stack}`;
    log(text);
  }).finally(() => {
    log('done');
  });

function log(text) {
  globalThis.postMessage({
    time: new Date(),
    text
  });
}
  