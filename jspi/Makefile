EMCC ?= emcc
CFLAGS =-O2 -I.

EMFLAGS = \
	-s ALLOW_MEMORY_GROWTH=1 \
	-s ASYNCIFY_EXPORTS='["cfunc", "cloop"]' \
	-s ASYNCIFY_IMPORTS='["jfunc"]' \
	-s ENVIRONMENT="web,worker" \
	-s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap"]' \
	-s INVOKE_RUN \
	-s WASM=1

.PHONY: all
all:
	$(EMCC) $(CFLAGS) $(EMFLAGS) -s ASYNCIFY -o cfunc-asyncify.mjs cfunc.c --js-library libfoo.js
	$(EMCC) $(CFLAGS) $(EMFLAGS) -s ASYNCIFY=2 -o cfunc-jspi.mjs cfunc.c --js-library libfoo.js

.PHONY: clean
clean:
	rm -rf cfunc-*.mjs cfunc-*.wasm