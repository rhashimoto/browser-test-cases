#include <emscripten.h>
#include <stdio.h>

EM_JS(void, js, (), {
  throw new Error('test exception');
});

EMSCRIPTEN_KEEPALIVE void cfunc() {
  int stackVar;
  printf("stack: %p\n", &stackVar);
  js();
}

int main() {
  printf("main\n");
  return 0;
}