addToLibrary({

  jfunc: function(x) {
    return Asyncify.handleAsync(async () => {
      return Math.pow(2, -x);
    });
  },
  jfunc__sig: 'dd',
  jfunc__async: true,
});