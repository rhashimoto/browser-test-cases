addToLibrary({
  $foo_support__postset: 'foo_support()',
  $foo_support: function() {

    _jfunc = function(x) {
      console.log('jfunc called with', x);
      return Promise.resolve(x * x);
    }

    // This signature specification works, but is it correct?
    _jfunc.sig = 'ii';
    _jfunc.isAsync = true;
  },

  jfunc: function(){},
  jfunc__deps: ['$foo_support'],

  // This signature specification does not work.
  jfunc__sig: 'ii'
});