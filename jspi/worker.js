
const BUILDS = new Map([
  ['asyncify', './cfunc-asyncify.mjs'],
  ['jspi', './cfunc-jspi.mjs'],
]);

Promise.resolve().then(async () => {
  const searchParams = new URLSearchParams(location.search);
  const build = searchParams.get('build');
  const { default: moduleFactory } = await import(BUILDS.get(build));
  const module = await moduleFactory();

  const start = performance.now();
  const result = await module.ccall('cfunc', 'number', ['number'], [10_000_000], { async: true });
  const end = performance.now();
  console.log(Math.trunc(end - start) / 1000, result);
  postMessage(`${build}: ${Math.trunc(end - start) / 1000} seconds`);
});
