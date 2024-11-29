const TIME_FORMAT = {
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3
};

async function* fakeDatabaseStreamer() {
  const data = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'.split(' ');
  for (const word of data) {
    log(`producing '${word}'`);
    yield word + ' '; // restore the space that split removed
  }
}

document.getElementById('start').addEventListener('click', async () => {
  log('Create a ReadableStream source to stream data from the fake database.')
  const encoder = new TextEncoder();
  const streamIterator = fakeDatabaseStreamer();
  const source = {
    // The ReadableStream consumer will call this method when it needs
    // more data. Operate the iterator manually (instead of using for-await)
    // so data doesn't fill memory faster than the consumer can handle.
    async pull(controller) {
      try {
        const { done, value } = await streamIterator.next();
        if (!done) {
          // For use in a Response, convert to Uint8Array.
          controller.enqueue(encoder.encode(value));
        } else {
          streamIterator.return();
          controller.close();
        }
      } catch (e) {
        controller.error(e);
        controller.close();
      }
    }
  }

  log('Create a Response from a ReadableStream.')
  const response = new Response(
    new ReadableStream(source),
    {
      headers: {
        // This type will be applied to the Blob.
        "Content-Type": "text/plain"
      }
    });

  log('Get the response contents as a Blob.')
  const blob = await response.blob();
  
  log(`blob contents: ${await blob.text()}`);
  log('Done.');
})

function log(text) {
  const time = new Date();
  const timestamp = time.toLocaleTimeString(undefined, TIME_FORMAT);
  const pre = document.createElement('pre');
  pre.textContent = `${timestamp} ${text}`;
  document.body.appendChild(pre);
}