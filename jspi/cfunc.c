#include <emscripten.h>
#include <stdio.h>

typedef int (*vfunc_t)(int);
extern vfunc_t atest;

extern int jfunc(int x);

EMSCRIPTEN_KEEPALIVE
int cfunc(int x) {
  EM_ASM({ globalThis.wasmTable = wasmTable; });
  printf("cfunc called with %d\n", x);
  return jfunc(x);
}

EMSCRIPTEN_KEEPALIVE
int callcb(int x, int (*cb)(int)) {
  printf("callcb called with %d\n", x);
  atest = jfunc;
  return atest(x);
}
