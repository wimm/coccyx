var testBasicUri = function() {
  assertTrue('Should start with \'\'', goog.string.startsWith('abcd', ''));
  assertTrue('Should start with \'ab\'', goog.string.startsWith('abcd', 'ab'));
};
