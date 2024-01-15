#include <emscripten.h>
#include <stdio.h>

// This function is defined in libfoo.js.
extern double jfunc(double x);

EMSCRIPTEN_KEEPALIVE double cfunc(double x) {
  return jfunc(x);
}

EMSCRIPTEN_KEEPALIVE int cloop(int count) {
  for (int i = 0; i < count; i++) {
    cfunc(i);
  }
  return 0;
}