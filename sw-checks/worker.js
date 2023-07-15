import data from './foo.js';

globalThis.postMessage('Worker started');
globalThis.postMessage(data);