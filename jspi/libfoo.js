addToLibrary({
  $foo_support__postset: 'foo_support',
  $foo_support: function() {

    _jfunc = function(x) {
      return Promise.resolve(x * x);
    }
  },

  jfunc: function(){},
  jfunc__deps: ['$foo_support']
});