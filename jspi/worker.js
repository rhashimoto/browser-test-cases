
const BUILDS = new Map([
  ['asyncify', './cfunc-asyncify.mjs'],
  ['jspi', './cfunc-jspi.mjs'],
]);

const ITERATIONS = 10_000;

Promise.resolve().then(async () => {
  const searchParams = new URLSearchParams(location.search);
  const build = searchParams.get('build');
  const { default: moduleFactory } = await import(BUILDS.get(build));
  const module = await moduleFactory();

  // Verify the call produces the correct answer.
  const result = await module.ccall('cfunc', 'number', ['number'], [2.0], { async: true });
  if (result !== 4.0) {
    console.error(`Expected 4.0, got ${result}`);
  }

  const cloopMillis = await time(async () => {
    await module.ccall('cloop', 'number', ['number'], [ITERATIONS], { async: true });
  });
  postMessage(`${build} ${ITERATIONS} iterations in C ${cloopMillis / 1000} seconds`);

  const jloopMillis = await time(async () => {
    for (let i = 0; i < ITERATIONS; ++i) {
      await module.ccall('cfunc', 'number', ['number'], [2.0], { async: true });
    }
  });
  postMessage(`${build} ${ITERATIONS} iterations in JS ${jloopMillis / 1000} seconds`);

  postMessage(null);
});

async function time(f) {
  const start = performance.now();
  await f();
  const end = performance.now();
  return Math.trunc(end - start);
}