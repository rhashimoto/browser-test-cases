import { SharedService, createSharedServicePort } from "./SharedService.js";

// This is a sample service. Only methods with structured cloneable
// arguments and results can be called by proxy.
const targetA = {
  async method() {
    log('targetA method called');
    return 'service A method result';
  }
};

const targetB = {
  async method() {
    log('targetB method called');
    return 'service B method result';
  }
}

// This function is called when this instance is designated as the
// service provider. The port is created locally here but it could
// come from a different context, e.g. a Worker.
function portProviderA() {
  log('providing service A');
  return createSharedServicePort(targetA);
}
function portProviderB() {
  log('providing service B');
  return createSharedServicePort(targetB);
}

// Load the service worker.
navigator.serviceWorker.register('SharedService_ServiceWorker.js');

// Create the shared service.
log('start');
const sharedServiceA = new SharedService('A', portProviderA);
sharedServiceA.activate();

const sharedServiceB = new SharedService('B', portProviderB);
sharedServiceB.activate();

document.getElementById('ServiceA').addEventListener('click', async () => {
  log('calling service A');
  const result = await sharedServiceA.proxy.method();
  log(result);
});
document.getElementById('ServiceB').addEventListener('click', async () => {
  log('calling service B');
  const result = await sharedServiceB.proxy.method();
  log(result);
});

function log(s) {
  const TIME_FORMAT = {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  };
  // @ts-ignore
  const timestamp = new Date().toLocaleTimeString(undefined, TIME_FORMAT);
  document.getElementById('output').textContent += `${timestamp} ${s}\n`;
}