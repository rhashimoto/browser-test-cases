EMCC ?= emcc

EMFLAGS = \
	-s ENVIRONMENT="web,worker" \
	-s INVOKE_RUN \
	-s WASM=1

.PHONY: all
all:
	$(EMCC) $(CFLAGS) $(EMFLAGS) -o cfunc.mjs cfunc.c

.PHONY: clean
clean:
	rm -rf cfunc.mjs cfunc.wasm