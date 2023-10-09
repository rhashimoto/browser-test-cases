#include <emscripten.h>
#include <stdio.h>

extern int jfunc(int x);

EMSCRIPTEN_KEEPALIVE
int cfunc(int x) {
  printf("cfunc called with %d\n", x);
  return jfunc(x);
}
