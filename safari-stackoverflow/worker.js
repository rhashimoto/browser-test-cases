import SQLiteESMFactory from './dist/wa-sqlite-async.mjs';
import { MemoryAsyncVFS as MyVFS } from './src/examples/MemoryAsyncVFS.js';
import * as SQLite from './src/sqlite-api.js';

const DB_FILENAME = 'hello.db';
const ITERATIONS = 50_000;
const REPORT_INTERVAL = 1000;

const SETUP = `
  PRAGMA journal_mode=OFF;
  PRAGMA locking_mode=EXCLUSIVE;
  PRAGMA synchronous=OFF;
  CREATE TABLE IF NOT EXISTS hello (id PRIMARY KEY, value TEXT);
`;

const QUERY = `INSERT OR REPLACE INTO hello VALUES (1234, 'foo')`;

Promise.resolve().then(async () => {
  try {
    postMessage('Worker starting');

    postMessage('Open database');
    const module = await SQLiteESMFactory();
    const sqlite3 = SQLite.Factory(module);

    const vfs = await MyVFS.create('hello', module);
    sqlite3.vfs_register(vfs, true);
    const db = await sqlite3.open_v2(DB_FILENAME);

    postMessage('Set up database');
    await sqlite3.exec(db, SETUP);

    postMessage(`Execute ${ITERATIONS} queries...`);
    for await (const prepared of sqlite3.statements(db, QUERY)) {
      for (let i = 0; i < ITERATIONS; i++) {
        sqlite3.reset(prepared);
        while (await sqlite3.step(prepared) === SQLite.ROW) {
          console.assert(false, 'unexpected');
        }

        if ((i + 1) % REPORT_INTERVAL === 0) {
          postMessage(`${i + 1} queries`);
        }
      }
      if (ITERATIONS % REPORT_INTERVAL !== 0) {
        postMessage(`${ITERATIONS} queries`);
      }
    }
    
    postMessage('Done');
  } catch (e) {
    postMessage(`Error: ${e.message}`);
    console.error(e);
    throw e;
  }
});
