# Safari stack overflow test
This test page is a reproducible case for [this WebKit bug](https://bugs.webkit.org/show_bug.cgi?id=284752).

The page can be loaded from https://rhashimoto.github.io/browser-test-cases/safari-stackoverflow/

## Description
The test uses [wa-sqlite](https://github.com/rhashimoto/wa-sqlite), providing SQLite
compiled to WebAssembly using Emscripten with Asyncify. The test mostly runs in a
Worker where it creates a database and attempts 50,000 queries.

## Expected results
The test should execute 50,000 queries with progress logged to the page.

## Actual results
| Browser | Result |
|---|---|
| Chrome 132 |✅|
| Firefox 134 |✅|
| Safari 18.2 | Maximum call stack size exceeded after 3000 queries |
| Safari Technology Preview 212 |✅|
