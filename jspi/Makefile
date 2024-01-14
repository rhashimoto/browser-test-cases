EMCC ?= emcc
CFLAGS = -g
EMFLAGS = \
	-s ALLOW_MEMORY_GROWTH=1 \
	-s ALLOW_TABLE_GROWTH=1 \
	-s ASSERTIONS=1 \
	-s ASYNCIFY=2 \
	-s ASYNCIFY_EXPORTS='["cfunc", "callcb"]' \
	-s ASYNCIFY_IMPORTS='["jfunc", "atest"]' \
	-s ENVIRONMENT="web,worker" \
	-s EXPORTED_RUNTIME_METHODS='["addFunction", "ccall", "cwrap"]' \
	-s WASM=1

.PHONY: all
all:
	$(EMCC) $(CFLAGS) $(EMFLAGS) -o cfunc.mjs cfunc.c --js-library libfoo.js

.PHONY: clean
clean:
	rm -rf cfunc.mjs cfunc.wasm