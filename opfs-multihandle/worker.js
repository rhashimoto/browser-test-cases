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

  log('Write data with sync handle 0...');
  syncHandles[0].write(new TextEncoder().encode('hello').buffer, { at: 0 });
  syncHandles[0].flush();

  for (let i = 0; i < syncHandles.length; ++i) {
    log(`Read data with sync handle ${i}...`);
    const syncHandle = syncHandles[i];
    const buffer = new Uint8Array(syncHandle.getSize());
    const count = syncHandle.read(buffer.buffer, { at: 0 });
    const text = new TextDecoder().decode(buffer);
    log(`  ${text}`);
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
  