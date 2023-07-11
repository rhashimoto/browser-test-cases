globalThis.postMessage('worker started');

(async function() {
  try {
    const directoryHandle = await navigator.storage.getDirectory();
    globalThis.postMessage('obtained OPFS root');
    for await (const [name] of directoryHandle) {
      await directoryHandle.removeEntry(name, { recursive: true });
    }

    const fileHandle = await directoryHandle.getFileHandle('foo', { create: true });
    globalThis.postMessage('opened/created file "foo"');

    globalThis.postMessage('listing directory contents...');
    for await (const [name] of directoryHandle) {
      globalThis.postMessage(`- ${name}`);
    }

    globalThis.postMessage('checking for move method...');
    if (fileHandle.move) {
      globalThis.postMessage('FileSystemFileHandle.move exists');
    } else {
      globalThis.postMessage('FileSystemFileHandle.move does not exist');
    }

    await fileHandle.move(directoryHandle, 'bar');
    globalThis.postMessage('moved "foo" to "bar"');

    globalThis.postMessage('listing directory contents...');
    for await (const [name] of directoryHandle) {
      globalThis.postMessage(`- ${name}`);
    }
  } catch (e) {
    globalThis.postMessage(e.message);
  }
})();
