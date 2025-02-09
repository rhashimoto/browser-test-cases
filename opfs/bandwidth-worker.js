const FILENAME = 'bandwidth-test';
const FILE_SIZE = 4096 * (2**20);
const CHUNK_SIZE = 2**20;

(async function() {
  const onFinally = [];
  try {
    postMessage('Clearing OPFS.');
    const root = await navigator.storage.getDirectory();
    for await (const key of root.keys()) {
      await root.removeEntry(key, { recursive: true });
    }

    postMessage('Creating file...');
    const fileHandle = await createFile(root);
    onFinally.push(() => root.removeEntry(FILENAME));
    postMessage(`${FILE_SIZE} bytes written to ${FILENAME}.`);

    for (let i = 0; i < 3; i++) {
      postMessage('Reading with FileSystemSyncAccessHandle...');
      await readWithAccessHandle(fileHandle);
      postMessage('Read complete.')
    }

    for (let i = 0; i < 3; i++) {
      postMessage('Reading with File...');
      await readWithFile(fileHandle);
      postMessage('Read complete.')
    }
  } catch (e) {
    postMessage(`Error: ${e.message}\n${e.stack}`);
  } finally {
    while (onFinally.length) {
      try {
        onFinally.pop()();
      } catch (e) {
        console.warn(e);
      }
    }
  }
})();

/**
 * @param {FileSystemDirectoryHandle} root
 */
async function createFile(root) {
  const fileHandle = await root.getFileHandle(FILENAME, { create: true });
  const accessHandle = await fileHandle.createSyncAccessHandle();
  try {
    const buffer = new Uint8Array(CHUNK_SIZE);
    let nBytesWritten = 0;
    while (nBytesWritten < FILE_SIZE) {
      nBytesWritten += accessHandle.write(buffer, { at: nBytesWritten });
    }
    return fileHandle;
  } finally {
    accessHandle.close();
  }
}

/**
 * @param {FileSystemFileHandle} fileHandle
 */
async function readWithAccessHandle(fileHandle) {
  const startTime = performance.now();
  const accessHandle = await fileHandle.createSyncAccessHandle();

  const buffer = new Uint8Array(CHUNK_SIZE);
  let nBytesRead = 0;
  while (nBytesRead < FILE_SIZE) {
    nBytesRead += accessHandle.read(buffer, { at: nBytesRead });
  }
  const endTime = performance.now();
  
  accessHandle.close();
  const duration = Math.round(endTime - startTime);
  const bw = (FILE_SIZE / 2**30) / (duration / 1000);
  postMessage(`Read ${nBytesRead} bytes in ${duration} ms (${bw.toFixed(2)} GB/s).`);
}

/**
 * @param {FileSystemFileHandle} fileHandle
 */
async function readWithFile(fileHandle) {
  const startTime = performance.now();
  const file = await fileHandle.getFile();
  let nBytesRead = 0;
  await file.stream()
    .pipeTo(new WritableStream({
      write(chunk) {
        nBytesRead += chunk.byteLength;
      }
    }, new CountQueuingStrategy({ highWaterMark: 100 })));
  const endTime = performance.now();
  const duration = Math.round(endTime - startTime);
  const bw = (FILE_SIZE / 2**30) / (duration / 1000);
  postMessage(`Read ${nBytesRead} bytes in ${duration} ms (${bw.toFixed(2)} GB/s).`);
}