const STABILIZE_DELAY = 1;
const CREATE_DELETE_COUNT = 1000;
const READ_WRITE_BLOCKS = 1024;
const READ_WRITE_BLOCKSIZE = 4096;

function log(text) {
  globalThis.postMessage({
    time: new Date(),
    text
  });
}

async function go() {
  await clean();
  await read_write(READ_WRITE_BLOCKS, READ_WRITE_BLOCKSIZE);
}

function stabilize() {
  log(`waiting ${STABILIZE_DELAY} seconds...`);
  return new Promise(resolve => {
    setTimeout(resolve, STABILIZE_DELAY * 1000);
  });
}

async function clean() {
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

async function create_delete(count) {
  const root = await navigator.storage.getDirectory();
  const filenames = Array.from(new Array(3)).map((_, i) => String(i));

  await time(`Creating ${count} files...`, () => {
    return Promise.all(filenames.map(filename => {
      return root.getFileHandle(filename, { create: true });
    }));
  });
  await time(`Deleting ${count} files...`, () => {
    return Promise.all(filenames.map(filename => {
      return root.removeEntry(filename);
    }));
  });
}

async function read_write(nBlocks, blockSize) {
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle(Math.random().toString(), { create: true });
  const accessHandle = await fileHandle.createSyncAccessHandle();
  const block = new Uint8Array(blockSize);
  crypto.getRandomValues(block);
  try {
    await time(`Writing and flushing ${nBlocks} blocks of ${blockSize} bytes...`, async () => {
      for (let i = 0; i < nBlocks; ++i) {
        accessHandle.write(block, { at: i * blockSize });
        accessHandle.flush();
      }
    });

    const fileSize = accessHandle.getSize();
    log(`file size is ${fileSize} bytes`);

    await time(`Reading ${nBlocks} blocks of ${blockSize} bytes...`, async () => {
      for (let i = 0; i < nBlocks; ++i) {
        accessHandle.read(block, { at: i * blockSize });
      }
    });
  } finally {
    accessHandle.close();
    root.removeEntry(fileHandle.name);
  }
}

async function time(label, f) {
  log(label);
  const t0 = Date.now();
  const result = await f();
  const t1 = Date.now();
  log(`${(t1 - t0)/1000}s elapsed`);
  return result;
}

Promise.resolve().then(stabilize)
  .then(go).catch(e => {
    const text = e.stack.includes(e.message) ? e.stack : `${e.message}\n${e.stack}`;
    log(text);
  }).finally(() => {
    log('done');
  });