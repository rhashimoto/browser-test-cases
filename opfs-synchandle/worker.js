(async function() {
  try {
    postMessage('worker started');

    postMessage('clearing OPFS');
    const root = await navigator.storage.getDirectory();
    for await (const entry of root.values()) {
      await root.removeEntry(entry.name, { recursive: true });
    }

    // Create a directory under the root.
    const directoryName = 'foo';
    postMessage(`creating directory "${directoryName}"`);
    const directory = await root.getDirectoryHandle(directoryName, { create: true });

    // Create two files in the directory. One of the files has the
    // same name as the directory. If this is not the case then the
    // bug does not appear.
    postMessage(`creating file "foo" in "${directoryName}"`);
    const fileA = await directory.getFileHandle('foo', { create: true });
    postMessage(`creating file "bar" in "${directoryName}"`);
    const fileB = await directory.getFileHandle('bar', { create: true });

    
    // Create sync access handles for the two files. Chrome throws
    // on the second call.
    postMessage(`creating sync access handle for ${fileA.name}`);
    await fileA.createSyncAccessHandle();
    postMessage(`creating sync access handle for ${fileB.name}`);
    await fileB.createSyncAccessHandle();

    postMessage('success!');
  } catch (e) {
    postMessage('error: ' + e.message);
  }
})();
