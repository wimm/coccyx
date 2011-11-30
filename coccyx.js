goog.provide('coccyx');


/**
 * Convenience method to check if something is explicitly null or explicitly
 * undefined for situations where if (obj) are ambiguous due to type coersion.
 * @param {*} obj object to check.
 * @return {boolean} whether the object is null or undefined.
 */
coccyx.isNullOrUndefined = function(obj) {
  return obj === void 0 || obj === null;
};

