import SQLiteESMFactory from './dist/wa-sqlite-async.mjs';
import { MemoryAsyncVFS as MyVFS } from './src/examples/MemoryAsyncVFS.js';
import * as SQLite from './src/sqlite-api.js';

const DB_FILENAME = 'hello.db';
const ITERATIONS = 50_000;
const REPORT_INTERVAL = 1000;

Promise.resolve().then(async () => {
  try {
    postMessage('Worker starting');

    postMessage('Open database');
    const module = await SQLiteESMFactory();
    const sqlite3 = SQLite.Factory(module);

    const vfs = await MyVFS.create('hello', module);
    sqlite3.vfs_register(vfs, true);
    const db = await sqlite3.open_v2(DB_FILENAME);

    // This just makes the test faster.
    await sqlite3.exec(db, 'PRAGMA journal_mode=OFF');
    await sqlite3.exec(db, 'PRAGMA locking_mode=EXCLUSIVE');
    await sqlite3.exec(db, 'PRAGMA synchronous=OFF');

    // Prepare the statement.
    await sqlite3.exec(db, 'CREATE TABLE IF NOT EXISTS hello (id PRIMARY KEY, value TEXT)');
    const prepared = await (async function() {
      for await (const stmt of sqlite3.statements(db, 'INSERT OR REPLACE INTO hello VALUES (?, ?)', { unscoped: true})) {
        return stmt;
      }
    })();

    postMessage(`Execute ${ITERATIONS} queries...`);
    for (let i = 0; i < ITERATIONS; i++) {
      sqlite3.reset(prepared);
      sqlite3.bind_int(prepared, 1, i % 100);
      sqlite3.bind_text(prepared, 2, Math.random());
      while (await sqlite3.step(prepared) === SQLite.ROW) {
      }

      if ((i + 1) % REPORT_INTERVAL === 0) {
        postMessage(`${i + 1} queries`);
      }
    }
    if (ITERATIONS % REPORT_INTERVAL !== 0) {
      postMessage(`${ITERATIONS} queries`);
    }

    postMessage('Done');
  } catch (e) {
    postMessage(`Error: ${e.message}`);
  }
});
