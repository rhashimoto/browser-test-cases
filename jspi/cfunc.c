#include <emscripten.h>
#include <stdio.h>
#include <sqlite3.h>

extern double jfunc(double x);

// This is the SQLite user function. It handles the data handoff
// with SQLite and calls the JavaScript function.
void relay(sqlite3_context *ctx, int argc, sqlite3_value **argv) {
  double x = sqlite3_value_double(argv[0]);
  double y = jfunc(x);
  sqlite3_result_double(ctx, y);
}

sqlite3 *db;
const char* sql =
  "SELECT relay(42) FROM cnt;"
  ;

// This optional callback just prints out the result to make
// sure everything worked.
int callback(void *pAppData, int argc, char **argv, char **azColName) {
  for (int i = 0; i < argc; i++) {
    printf("%s %s\n", azColName[i], argv[i]);
  }
  return 0;
}

// This is the C function launched from JavaScript to perform the query.
EMSCRIPTEN_KEEPALIVE int cfunc(int count) {
  int rc = sqlite3_exec(db, sql, NULL, NULL, NULL);
  return rc;
}

int main() {
  // Open a in-memory database and create a user function.
  sqlite3_initialize();
  int rc = sqlite3_open(":memory:", &db);
  rc = sqlite3_create_function(db, "relay", 1, SQLITE_UTF8, NULL, &relay, NULL, NULL);
  return 0;
}