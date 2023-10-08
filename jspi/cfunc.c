#include <emscripten.h>

extern int jfunc(int x);

EMSCRIPTEN_KEEPALIVE
int cfunc(int x) {
  return jfunc(x);
}