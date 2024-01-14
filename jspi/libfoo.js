addToLibrary({

  jfunc: async function(x) {
    console.log('jfunc called with', x);
    return Promise.resolve(x + 1);
  },
  jfunc__sig: 'ii',
  jfunc__async: true,

  atest: async function(x) {
    return x * x;
  },
  atest__sig: 'ii',
  atest__async: true
});