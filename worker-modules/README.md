# worker-modules
This is a simple test of launching a Worker as an ES6 module.

This web page can be accessed [here](https://rhashimoto.github.io/browser-test-cases/worker-modules/).
The two buttons each launch a Worker, one with `type: "module"` and one with `type: "classic"`. The only
thing the Worker does is post a message back to the Window, which logs it on the page.
