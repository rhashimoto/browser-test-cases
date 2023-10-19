// @ts-ignore
import * as VFS from '../VFS.js';

const SECTOR_SIZE = 4096;

function log(...args) {
  // console.log(...args);
}

async function logLocks() {
  await new Promise(resolve => setTimeout(resolve));
  const query = await navigator.locks.query();
  console.log(query);
}

/** @type {IDBDatabase} */ let idb;
let idbReady = new Promise(function(resolve, reject) {
  const openRequest = indexedDB.open('WALIndex', 1);
  openRequest.addEventListener('upgradeneeded', () => {
    const db = openRequest.result;
    db.createObjectStore('tx', { keyPath: ['path', 'txId'] });
  });
  openRequest.addEventListener('success', () => {
    resolve(idb = openRequest.result);
  });
  openRequest.addEventListener('error', () => {
    reject(openRequest.error);
  });
});

// Fragmented Log On OPFS Realized (FLOOR)
export class File {
  /** @type {string} */ #path;
  /** @type {number} */ #flags;
  /** @type {FileSystemSyncAccessHandle} */ #accessHandle = null;
  /** @type {FileSystemSyncAccessHandle} */ #walAccessHandle = null;

  #lockingMode = 'normal';
  #isRollbackJournalTx = false;
  #isBatchAtomicTx = false;
  
  #txCount = 0;
  #dbPageSize = 0;
  #dbPageCount = 0;
  #needsSync = false;

  /** @type {Map<number, {txId: number, index: number}>} */ #mapPageToWAL = new Map();
  /** @type {Map<number, {page: number, index: number}[]>} */ #mapTxToPages = new Map();
  /** @type {Set<number>} */ #walFree = new Set();
  #walLock = null;

  // Overlay data for in-progress transaction.
  #txPageCount = 0;
  /** @type {Map<number, {txId: number, index: number}>} */ #txPageToWAL = new Map();

  /** @type {0|1|2|4} */ #lockState = VFS.SQLITE_LOCK_NONE;
  _gateLock = null;
  _readLock = null;
  _writeLock = null;

  // /** @type {Uint8Array} */ shadowFile;

  constructor(path, flags) {
    this.#path = path;
    this.#flags = flags;
  }

  async _initialize() {
    const create = !!(this.#flags & VFS.SQLITE_OPEN_CREATE);
    const [directoryHandle, filename] = await getPathComponents(this.#path, create);
    if (!directoryHandle) return VFS.SQLITE_CANTOPEN;

    const fileHandle = await directoryHandle.getFileHandle(filename, { create });
    this.#accessHandle = await fileHandle.createSyncAccessHandle({ mode: 'readwrite-unsafe' });
    // this.#accessHandle.read(this.shadowFile);

    if (this.#flags & VFS.SQLITE_OPEN_MAIN_DB) {
      // Get a write lock so the WAL file isn't deleted while we scan it.
      await navigator.locks.request(this.#path + '-write', async () => {
        // Open the WAL file.
        const [directoryHandle, filename] =
          await getPathComponents(walFilename(this.#path), true);
        const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
        this.#walAccessHandle =
          await fileHandle.createSyncAccessHandle({ mode: 'readwrite-unsafe' });

        // Preload WAL metadata from IndexedDB. This is optional here but
        // would otherwise need to be done on the first transaction.
        await idbReady;
        await this.#updateWALState();
      });
    }
  }

  async #updateWALState() {
    // Remove local lookup entries for checkpointed transactions.
    // These would be transactions no longer in IndexedDB.
    const tx = idb.transaction('tx', 'readonly');
    const firstTxKey = await idbX(
      tx.objectStore('tx').getKey(IDBKeyRange.bound([this.#path], [this.#path, []])));
    const ckptCount = firstTxKey?.[1] ?? Infinity;
    for (const [txId, pages] of this.#mapTxToPages) {
      if (txId < ckptCount) {
        for (const { page, index } of pages) {
          // console.debug(`removing WAL txId=${txId} page=${page} index=${index}`);
          if (this.#mapPageToWAL.get(page).txId === txId) {
            this.#mapPageToWAL.delete(page);
          }
          this.#walFree.add(index);
        }
        this.#mapTxToPages.delete(txId);
      } else {
        // txId keys are in ascending order in the map.
        break;
      }
    }

    if (!this.#dbPageSize) {
      // Get the page size from the database file. If the file is
      // empty it will remain zero but that won't cause a problem.
      const pageSize = new DataView(new ArrayBuffer(2));
      this.#accessHandle.read(pageSize, { at: 16 });
      this.#dbPageSize = pageSize.getUint16(0, false);
      if (this.#dbPageSize === 1) this.#dbPageSize = 65536;
      // console.debug(`dbPageSize=${this.#dbPageSize}`);
    }

    // If WAL file has grown, add extra slots to free list.
    const walFileSize = this.#walAccessHandle.getSize();
    const walFrameCount = walFileSize ? Math.trunc(walFileSize / this.#dbPageSize) : 0;
    for (let i = this.#walFree.size; i < walFrameCount; i++) {
      this.#walFree.add(i);
    }

    // Add lookup entries for new transactions and update free list.
    const range = IDBKeyRange.bound([this.#path, this.#txCount], [this.#path, []]);
    const transactions = await idbX(tx.objectStore('tx').getAll(range));
    for (const t of transactions) {
      // A transaction without pages has already been checkpointed
      // but is still used to update txCount and dbPageCount.
      if (t.pages) {
        for (const [page, index] of t.pages) {
          // console.debug(`adding WAL txId=${t.txId} page=${page} index=${index}`);

          // If the page is already in the WAL, free the previous slot.
          const oldIndex = this.#mapPageToWAL.get(page)?.index;
          if (oldIndex !== undefined) {
            this.#walFree.add(oldIndex);
          }

          // Add the new page association.
          this.#mapPageToWAL.set(page, { txId: t.txId, index });
          this.#walFree.delete(index);
        }
        this.#mapTxToPages.set(t.txId, t.pages.map(([page, index]) => ({ page, index })));
      }
      this.#dbPageCount = t.dbPageCount;
      this.#txCount = t.txId + 1;
    }
  }
  
  async #checkpointWAL(isFullCkpt) {
    // Find minimum txCount in use by a transaction.
    const locks = await navigator.locks.query();
    const txCountMin = locks.held
      .filter(({name}) => name.startsWith(this.#path + '-tx#-'))
      .map(({name}) => {
        const hexDigits = name.match(/tx#-([0-9a-zA-Z]+)$/)?.[1];
        return parseInt(hexDigits, 16);
      })
      .sort()[0] ?? Infinity;
    // console.debug(`checkpoint WAL up to txCount=${txCountMin}`);

    // Extract transactions before the minimum. The preparation step
    // is done to put the eligible transactions in newest to oldest
    // order so database pages aren't written more than once.
    /** @type {[number, { page: number, index: number }[]][]} */
    const txPagePairs = [];
    for (const [txId, pages] of this.#mapTxToPages) {
      if (txId + 1 < txCountMin) {
        txPagePairs.unshift([txId, pages]);
      } else {
        break;
      }
    }

    // Process transactions newest to oldest.
    /** @type {Set<number>} */ const copiedPages = new Set();
    const buffer = new Uint8Array(this.#dbPageSize);
    for (const [txId, pages] of txPagePairs) {
      for (const { page, index } of pages) {
        // Copy to each database page only once.
        if (!copiedPages.has(page)) {
          // console.debug(`checkpoint txId=${txId} index=${index}`)
          this.#walAccessHandle.read(buffer, { at: index * this.#dbPageSize });
          this.#accessHandle.write(buffer, { at: (page - 1) * this.#dbPageSize });
          copiedPages.add(page);
        }

        // Remove any local reference to this WAL frame.
        const local = this.#mapPageToWAL.get(page);
        if (local?.txId === txId) {
          console.assert(local.index === index);
          this.#mapPageToWAL.delete(page);
        }
        this.#walFree.add(index);
      }
      this.#mapTxToPages.delete(txId);
    }
    this.#accessHandle.flush();

    // Remove checkpointed transactions from IndexedDB.
    const tx = idb.transaction('tx', 'readwrite');
    const range = IDBKeyRange.bound([this.#path], [this.#path, txCountMin - 2]);
    await idbX(tx.objectStore('tx').delete(range));

    if (!this.#mapPageToWAL.size && this.#txCount) {
      // The WAL is empty. Put a placeholder object in IndexedDB so we
      // don't forget the transaction count.
      console.assert(!this.#mapTxToPages.size)
      await idbX(tx.objectStore('tx').put({
        path: this.#path,
        txId: this.#txCount - 1,
        dbPageCount: this.#dbPageCount
      }));
      tx.commit();

      if (isFullCkpt) {
        console.assert(this._gateLock && this._writeLock);
        this.#walAccessHandle.truncate(0);
        this.#walAccessHandle.flush();
        this.#walFree.clear();
      }
    } else {
      tx.commit();
    }
    console.debug(`checkpoint complete, WAL has ${this.#mapTxToPages.size} tx ${this.#walFree.size} free frames`);
  }

  async xClose(fileId) {
    log('xClose', this.#path);
    try {
      this.#accessHandle.close();
      if (this.#flags & VFS.SQLITE_OPEN_DELETEONCLOSE) {
        const [directoryHandle, filename] = await getPathComponents(this.#path, false);
        await directoryHandle.removeEntry(filename);
      }
      File.openFilesById.delete(fileId);
      File.openFilesByName.delete(this.#path);
      return VFS.SQLITE_OK;
    } catch (e) {
      console.error(e);
      return VFS.SQLITE_IOERR;
    }
  }

  xRead(_, pData, iAmt, iOffset) {
    log('xRead', this.#path, iAmt, iOffset);
    // const shadowOut = this.shadowFile.subarray(iOffset, iOffset + iAmt);
    try {
      if (this.#flags & VFS.SQLITE_OPEN_MAIN_DB) {
        if (iAmt >= SECTOR_SIZE) {
          this.#dbPageSize = iAmt;
        }

        // Try reading from the WAL.
        if (this.#txPageToWAL.size || this.#mapPageToWAL.size) {
          const pageNumber = Math.trunc(iOffset / this.#dbPageSize) + 1;
          const pageOffset = iOffset % this.#dbPageSize;

          // Check the provisional WAL index first, in case we're in a
          // transaction that has written this page, then check the
          // regular WAL index.
          const walEntry = this.#txPageToWAL.get(pageNumber) ??
                           this.#mapPageToWAL.get(pageNumber);
          const walIndex = walEntry?.index ?? -1;
          if (walIndex >= 0) {
            // console.debug(`read page ${pageNumber} from WAL ${walIndex}`)
            const byteOffset = walIndex * this.#dbPageSize + pageOffset;
            const nBytes = this.#walAccessHandle.read(pData, { at: byteOffset });

            // if (shadowOut.some((v, i) => v !== pData.getUint8(i))) debugger;
            if (nBytes !== iAmt) return VFS.SQLITE_IOERR_SHORT_READ;
            return VFS.SQLITE_OK;
          }
        }
      } 

      const nBytes = this.#accessHandle.read(pData, { at: iOffset });
      // if (shadowOut.some((v, i) => v !== pData.getUint8(i))) debugger;
      if (nBytes !== iAmt) return VFS.SQLITE_IOERR_SHORT_READ;
      return VFS.SQLITE_OK;
    } catch (e) {
      console.error(e);
      return VFS.SQLITE_IOERR_READ;
    }
  }

  xWrite(_, pData, iAmt, iOffset) {
    log('xWrite', this.#path, iAmt, iOffset);
    this.#needsSync = true;
    // if (iOffset + pData.byteLength > this.shadowFile.byteLength) {
    //   const newFile = new Uint8Array(iOffset + pData.byteLength);
    //   newFile.set(this.shadowFile);
    //   this.shadowFile = newFile;
    // }
    // this.shadowFile.set(new Uint8Array(pData.buffer, pData.byteOffset, pData.byteLength), iOffset);
    try {
      if (this.#isBatchAtomicTx) {
        console.assert(iAmt >= SECTOR_SIZE);
        this.#dbPageSize = iAmt;
        const pageIndex = Math.trunc(iOffset / this.#dbPageSize) + 1;

        // Determine where in the WAL to write the page.
        let index;
        if (this.#txPageToWAL.has(pageIndex)) {
          // This page was already written during this transaction so
          // use the same slot.
          index = this.#txPageToWAL.get(pageIndex).index;
        } else if (this.#walFree.size) {
          // The free set has an available slot.
          index = this.#walFree.values().next().value;
          this.#walFree.delete(index);
        } else {
          // Append to the end of the WAL file.
          index = Math.trunc(this.#walAccessHandle.getSize() / this.#dbPageSize);
        }

        // Write the page to the WAL file.
        // console.debug(`write page ${pageIndex} to WAL ${index}`);
        const nBytes = this.#walAccessHandle.write(pData, { at: index * this.#dbPageSize });

        // Update the provisional WAL index and database size.
        this.#txPageToWAL.set(pageIndex, { txId: this.#txCount, index });
        this.#txPageCount = Math.max(this.#txPageCount, pageIndex);

        if (nBytes !== iAmt) return VFS.SQLITE_IOERR_WRITE;
        return VFS.SQLITE_OK;
      }

      const nBytes = this.#accessHandle.write(pData, { at: iOffset });
      if (nBytes !== iAmt) return VFS.SQLITE_IOERR_WRITE;
      return VFS.SQLITE_OK;
    } catch (e) {
      console.error(e);
      return VFS.SQLITE_IOERR_WRITE;
    }
  }

  xTruncate(_, iSize) {
    log('xTruncate', this.#path, iSize);
    try {
      if (this.#isBatchAtomicTx) {
        console.assert(this.#dbPageSize > 0);
        this.#txPageCount = Math.trunc(iSize / this.#dbPageSize);
      } else {
        this.#accessHandle.truncate(iSize);
      }
      return VFS.SQLITE_OK;
    } catch (e) {
      console.error(e);
      return VFS.SQLITE_IOERR;
    }
  }

  xSync(_, flags) {
    log('xSync', this.#path, '0x'+flags.toString(16));
    try {
      if (this.#flags & VFS.SQLITE_OPEN_MAIN_DB && this.#needsSync) {
        this.#accessHandle.flush();
        this.#needsSync = false;
      }
      return VFS.SQLITE_OK;
    } catch (e) {
      console.error(e);
      return VFS.SQLITE_IOERR;
    }
  }

  xFileSize(_, pSize64) {
    log('xFileSize', this.#path);
    try {
      if (this.#flags & VFS.SQLITE_OPEN_MAIN_DB) {
        // Try the provisional size first, in case we're in a transaction,
        // then the size from a transaction in the WAL, and finally the
        // size from the database file.
        const size = 
          this.#dbPageSize * this.#txPageCount ||
          this.#dbPageSize * this.#dbPageCount ||
          this.#accessHandle.getSize();
        pSize64.setBigInt64(0, BigInt(size), true);
        // console.debug(`size=${size}`);
      } else {
        pSize64.setBigInt64(0, BigInt(this.#accessHandle.getSize()), true);
      }
      return VFS.SQLITE_OK;
    } catch (e) {
      console.error(e);
      return VFS.SQLITE_IOERR;
    }
  }

  async xLock(_, flags) {
    log('xLock', this.#path, flags);
    try {
      switch (flags) {
        case 1: // SQLITE_LOCK_SHARED
          console.assert(this.#lockState === VFS.SQLITE_LOCK_NONE, `lockState=${this.#lockState}`);
          if (!this.#accessHandle.getSize() || this.#lockingMode === 'exclusive') {
            // Get all the locks.
            await this.#acquireLock('gate', { mode: 'exclusive' });
            await this.#acquireLock('read', { mode: 'exclusive' });
            await this.#acquireLock('write', { mode: 'exclusive' });

            // Make sure no first commit occurred while waiting.
            if (this.#accessHandle.getSize() && this.#lockingMode !== 'exclusive') {
              this._writeLock();
              this._readLock();
              this._gateLock();
              return VFS.SQLITE_BUSY;
            }

            await this.#updateWALState();
            await this.#checkpointWAL(true);
          } else {
            // The outer gate lock must be acquired temporarily until the read
            // lock is acquired. This lets connections that need exclusive
            // access to prevent new readers by acquiring the gate lock.
            await this.#acquireLock('gate', { mode: 'shared' });
            await this.#acquireLock('read', { mode: 'shared' });
            this._gateLock();

            await this.#updateWALState();
          }

          // Use lock to signal txCount.
          const lockName = `${this.#path}-tx#-${this.#txCount.toString(16)}`;
          await new Promise(resolve => {
            navigator.locks.request(lockName, { mode: 'shared' }, () => {
              resolve();
              return new Promise(resolve => {
                this.#walLock = resolve;
              });
            });
          });
          break;
        case 2: // SQLITE_LOCK_RESERVED
          // Acquire the write lock when reserved. This minimizes the time
          // for txState to become out of sync with the WAL file.
          console.assert(this.#lockState === VFS.SQLITE_LOCK_SHARED, `lockState=${this.#lockState}`);
          if (!this._writeLock) {
            // Writes will go to the WAL file so we don't need to exclude
            // readers, only writers.
            this.#acquireLock('write', { mode: 'exclusive' });

            // Check if this connection is current.
            const tx = idb.transaction('tx', 'readonly');
            if (await idbX(tx.objectStore('tx').getKey([this.#path, this.#txCount]))) {
              this._writeLock();
              return VFS.SQLITE_BUSY;
            }
          }
          break;
        case 4: // SQLITE_LOCK_EXCLUSIVE
          console.assert(this.#lockState === VFS.SQLITE_LOCK_RESERVED, `lockState=${this.#lockState}`);
          break;
        default:
          throw new Error(`unexpected lock state ${flags}`);
      }

      this.#lockState = flags;
      // await logLocks();
      return VFS.SQLITE_OK;
    } catch (e) {
      console.error(e);
      return VFS.SQLITE_IOERR;
    }
  }

  xUnlock(_, flags) {
    log('xUnlock', this.#path, flags);
    try {
      switch (flags) {
        case 1: // SQLITE_LOCK_SHARED
          console.assert(this.#lockState > VFS.SQLITE_LOCK_SHARED, `lockState=${this.#lockState}`);
          this._writeLock();
          this._gateLock?.();
          break;
        case 0: // SQLITE_LOCK_NONE
          console.assert(this.#lockState === VFS.SQLITE_LOCK_SHARED, `lockState=${this.#lockState}`);
          this._writeLock?.();
          this._gateLock?.();
          this._readLock();
          this.#walLock();
          break;
        default:
          throw new Error(`unexpected unlock state ${flags}`);
      }
      this.#lockState = flags;
      return VFS.SQLITE_OK;
    } catch (e) {
      console.error(e);
      return VFS.SQLITE_IOERR;
    }
  }

  async xCheckReservedLock(_, pResOut) {
    log('xCheckReservedLock', this.#path);
    try {
      // Test if the write lock is held.
      const query = await navigator.locks.query();
      const isReserved = query.held.find(({name}) => {
        return name === this.#path + '-write';
      });
      pResOut.setUint32(0, isReserved ? 1 : 0, true);
      return VFS.SQLITE_OK;
    } catch (e) {
      console.error(e);
      return VFS.SQLITE_IOERR;
    }
  }

  /**
   * @param {'gate'|'read'|'write'} name 
   * @param {LockOptions} options 
   * @returns {Promise<Lock>}
   */
  #acquireLock(name, options) {
    return new Promise(resolve => {
      navigator.locks.request(`${this.#path}-${name}`, options, lock => {
        resolve(lock);
        if (lock) {
          return new Promise(resolve => {
            this[`_${name}Lock`] = () => {
              resolve();                
              this[`_${name}Lock`] = null;
            };
          });
        }
      });
    });
  }

  async xFileControl(_, op, pArg) {
    try {
      switch (op) {
        case 14: // SQLITE_FCNTL_PRAGMA
          const key = this.#cvtCString(pArg, 4);
          const value = this.#cvtCString(pArg, 8);
          log('xFileControl', this.#path, `PRAGMA ${key} ${value}`);
          switch (key) {
            case 'journal_mode':
              if (value?.toLowerCase() !== 'delete') {
                // Making every journal mode work is not worth the effort.
                console.error('unsupported journal mode', value);
                return VFS.SQLITE_MISUSE;
              }
              break;
            case 'locking_mode':
              if (value?.toLowerCase() === 'exclusive') {
                this.#lockingMode = 'exclusive';
              } else {
                this.#lockingMode = value;
              }
              break;
            case 'wal_checkpoint':
              if (this.#isBatchAtomicTx || this.#isRollbackJournalTx) {
                console.error('cannot checkpoint within a transaction')
                return VFS.SQLITE_MISUSE;
              }

              try {
                await this.#acquireLock('gate', { mode: 'shared' });
                await this.#acquireLock('read', { mode: 'shared' });
                this._gateLock();

                if (value?.toLowerCase() === 'full') {
                  await this.#acquireLock('gate', { mode: 'exclusive' });
                  this._readLock();
                  await this.#acquireLock('read', { mode: 'exclusive' });
                  await this.#acquireLock('write', { mode: 'exclusive' });
                }

                await this.#updateWALState();
                await this.#checkpointWAL(value?.toLowerCase() === 'full');
              } finally {
                this._writeLock?.();
                this._gateLock?.();
                this._readLock?.();
              }
              return VFS.SQLITE_OK;
          }
          return VFS.SQLITE_NOTFOUND;
          break;
        case 22: // SQLITE_FCNTL_COMMIT_PHASETWO
          // Marks the end of a transaction.
          log('xFileControl', this.#path, 'COMMIT_PHASETWO');
          this.#isRollbackJournalTx = false;
          return VFS.SQLITE_OK;
        case 31: // SQLITE_FCNTL_BEGIN_ATOMIC_WRITE
          log('xFileControl', this.#path, 'BEGIN_ATOMIC_WRITE');
          this.#isBatchAtomicTx = true;
          this.#txPageCount = this.#dbPageCount;
          return VFS.SQLITE_OK;
        case 32: // SQLITE_FCNTL_COMMIT_ATOMIC_WRITE
          log('xFileControl', this.#path, 'COMMIT_ATOMIC_WRITE');

          // Commit transaction WAL state.
          const pages = [];
          for (const [page, entry] of this.#txPageToWAL) {
            this.#mapPageToWAL.set(page, entry);
            pages.push({ page, index: entry.index });
          }
          this.#dbPageCount = this.#txPageCount;
          this.#mapTxToPages.set(this.#txCount, pages);

          // Flush the WAL file first, then write metadata to IndexedDB.
          this.#accessHandle.flush();

          const tx = idb.transaction('tx', 'readwrite');
          await idbX(tx.objectStore('tx').put({
            path: this.#path,
            txId: this.#txCount++,
            dbPageCount: this.#dbPageCount,
            pages: pages.map(({ page, index }) => [page, index])
          }));
          tx.commit();

          this.#isBatchAtomicTx = false;
          this.#needsSync = false;
          this.#txPageToWAL.clear();
          this.#txPageCount = 0;
          return VFS.SQLITE_OK;
        case 33: // SQLITE_FCNTL_ROLLBACK_ATOMIC_WRITE
          log('xFileControl', this.#path, 'ROLLBACK_ATOMIC_WRITE');

          // Restore WAL slots to the free set.
          for (const [page, { index }] of this.#txPageToWAL) {
            console.debug(`Restoring WAL ${index} for page ${page}`);
            this.#walFree.add(index);
          }

          this.#isBatchAtomicTx = false;
          this.#needsSync = false;
          this.#txPageToWAL.clear();
          this.#txPageCount = 0;
          return VFS.SQLITE_OK;
        default:
          log('xFileControl', this.#path, op);
          return VFS.SQLITE_NOTFOUND;
      }
    } catch (e) {
      console.error(e);
      return VFS.SQLITE_IOERR;
    }
  }

  #cvtCString(dataView, offset) {
    const p = dataView.getUint32(offset, true);
    if (p) {
      const chars = new Uint8Array(dataView.buffer, p);
      return new TextDecoder().decode(chars.subarray(0, chars.indexOf(0)));
    }
    return null;
  }

  xSectorSize(_) {
    log('xSectorSize', this.#path, SECTOR_SIZE);
    return SECTOR_SIZE;
  }

  xDeviceCharacteristics(_) {
    log('xDeviceCharacteristics', this.#path);
    return 0 |
      VFS.SQLITE_IOCAP_BATCH_ATOMIC |
      VFS.SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN;
  }

  setRollback(status) {
    if (status && !this._writeLock) {
      console.error('using rollback journal without exclusive lock');
      return false;
    }
    this.#isRollbackJournalTx = status;
    return true;
  }

  static openFilesById = new Map();
  static openFilesByName = new Map();
  static rootDirectory = navigator.storage.getDirectory();

  static async xOpen(_, zName, fileId, flags, pOutFlags) {
    log('xOpen', zName, fileId, '0x'+flags.toString(16));
    try {
      if (flags & VFS.SQLITE_OPEN_MAIN_JOURNAL) {
        // A rollback journal requires exclusive locking.
        const dbFile = File.openFilesByName.get(mainFilename(zName));
        if (!dbFile.setRollback(true)) {
          return VFS.SQLITE_MISUSE;
        }
      }

      const f = new File(zName, flags);
      await f._initialize();
      File.openFilesById.set(fileId, f);
      File.openFilesByName.set(zName, f);
      pOutFlags.setUint32(0, flags, true);
      return VFS.SQLITE_OK;
    } catch (e) {
      console.error(e);
      return e.name === 'NotFoundError' ? VFS.SQLITE_CANTOPEN : VFS.SQLITE_IOERR;
    }
  }

  static async xDelete(_, zName, syncDir) {
    log('xDelete', zName, syncDir);
    try {
      const [directoryHandle, filename] = await getPathComponents(zName, false);
      await directoryHandle.removeEntry(filename);

      if (zName.endsWith('-journal')) {
        // Unmark the corresponding database.
        const dbFile = File.openFilesByName.get(mainFilename(zName));
        dbFile?.setRollback(false);
      }
      return VFS.SQLITE_OK;
    } catch (e) {
      console.error(e);
      return VFS.SQLITE_IOERR;
    }
  }

  static async xAccess(_, zName, flags, pResOut) {
    log('xAccess', zName, '0x'+flags.toString(16));
    try {
      const [directoryHandle, filename] = await getPathComponents(zName, false);
      await directoryHandle.getFileHandle(filename);
      pResOut.setUint32(0, 1, true);
    } catch (e) {
      if (e.name === 'NotFoundError') {
        pResOut.setUint32(0, 0, true);
      } else {
        console.error(e);
        return VFS.SQLITE_IOERR;
      }
    }
    return VFS.SQLITE_OK;
  }
};

async function getPathComponents(path, create) {
  try {
    const [_, directories, filename] = path.match(/[/]?(.*)[/](.*)$/);
    let directoryHandle = await File.rootDirectory;
    for (const directory of directories.split('/')) {
      if (directory) {
        directoryHandle = await directoryHandle.getDirectoryHandle(directory, { create });
      }
    }
    return [directoryHandle, filename];
  } catch (e) {
    return [];
  }
}

function walFilename(path) {
  // Don't use -wal suffix because SQLite may access it directly.
  return path + '-floor';
}

function mainFilename(path) {
  return path.match(/(.*)-(?:floor|journal)$/)[1];
}

function idbX(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error));
  });
}