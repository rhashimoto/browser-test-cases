addToLibrary({

  jfunc: async function(x) {
    console.log('jfunc called with', x);
    return Promise.resolve(x * x);
  },
  jfunc__sig: 'ii',
  jfunc__async: true
});