EMCC ?= emcc
CFLAGS =
EMFLAGS = \
	-s ALLOW_MEMORY_GROWTH=1 \
	-s ASYNCIFY=2 \
	-s ASYNCIFY_IMPORTS='["jfunc"]' \
	-s ENVIRONMENT="web,worker" \
	-s WASM=1

.PHONY: all
all:
	$(EMCC) $(CFLAGS) $(EMFLAGS) -o cfunc.mjs cfunc.c --js-library libfoo.js

.PHONY: clean
clean:
	rm -rf cfunc.mjs cfunc.wasm