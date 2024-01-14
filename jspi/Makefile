EMCC ?= emcc
CFLAGS = \
	-DSQLITE_DEFAULT_MEMSTATUS=0 \
	-DSQLITE_DEFAULT_WAL_SYNCHRONOUS=1 \
	-DSQLITE_DQS=0 \
	-DSQLITE_LIKE_DOESNT_MATCH_BLOBS \
	-DSQLITE_MAX_EXPR_DEPTH=0 \
	-DSQLITE_OMIT_AUTOINIT \
	-DSQLITE_OMIT_DECLTYPE \
	-DSQLITE_OMIT_DEPRECATED \
	-DSQLITE_OMIT_LOAD_EXTENSION \
	-DSQLITE_OMIT_SHARED_CACHE \
	-DSQLITE_THREADSAFE=0 \
	-DSQLITE_USE_ALLOCA \
	-DSQLITE_ENABLE_BATCH_ATOMIC_WRITE \
	-Oz -I. -flto

EMFLAGS = \
	-s ALLOW_MEMORY_GROWTH=1 \
	-s ASYNCIFY_EXPORTS='["cfunc"]' \
	-s ASYNCIFY_IMPORTS='["jfunc"]' \
	-s ENVIRONMENT="web,worker" \
	-s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap"]' \
	-s INVOKE_RUN \
	-s STACK_SIZE=512KB \
	-s WASM=1

.PHONY: all
all:
	$(EMCC) $(CFLAGS) $(EMFLAGS) -s ASYNCIFY -o cfunc-asyncify.mjs cfunc.c sqlite3.c --js-library libfoo.js
	$(EMCC) $(CFLAGS) $(EMFLAGS) -s ASYNCIFY=2 -o cfunc-jspi.mjs cfunc.c sqlite3.c --js-library libfoo.js

.PHONY: clean
clean:
	rm -rf cfunc-*.mjs cfunc-*.wasm