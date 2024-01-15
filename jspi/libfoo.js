addToLibrary({

  jfunc: function(x) {
    return Asyncify.handleAsync(async () => {
      return Math.pow(x, 2);
    });
  },
  jfunc__sig: 'dd',
  jfunc__async: true,
});