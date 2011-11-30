goog.provide('coccyx.string');


/**
 * Convenience method to check if a string is explicitly null, explicitly
 * undefined or contains only whitespace.
 * @param {string} str string to check.
 * @return {boolean} whether the object is null or undefined.
 */
coccyx.String.isNullOrEmpty = function(str) {
  return coccyx.isNullOrUndefined(str) || /^[\s\xa0]*$/.test(str);
};


/**
 * Does a brutish case-insensitive compare against the two strings
 * WARNING: Does not work with internationalization as in some languages the
 * lower case representation has different chars than the upper case (turkish)
 * @param {string} left string a to check.
 * @param {string} right string b to check.
 * @return {boolean} whether the object is null or undefined.
 */
coccyx.String.equalsIgnoreCase = function(left, right) {
  return left.toLowerCase() === right.toLowerCase();
};
