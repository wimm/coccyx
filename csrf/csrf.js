goog.provide('coccyx.csrf');
goog.provide('coccyx.csrf.Adapter');

/*
 * This is a simple class that is currently just wrapping a rudimentary rails
 * adapter, eventually it may have multi-document csrf token handling
 */


/**
 * Cached csrf token
 * @type {string}
 * @private
 */
coccyx.csrf.token_;


/**
 * Cached csrf parameter
 * @type {string}
 * @private
 */
coccyx.csrf.param_;


/**
 * Cached csrf header key
 * @type {string}
 * @private
 */
coccyx.csrf.header_;


/**
 * Current CSRF Adapter.
 * @type {coccyx.csrf.Adapter}
 * @private
 */
coccyx.csrf.adapter_;


/**
 * Gets the current CSRF token for this adapter and this request.
 *
 * @return {?string} the current CSRF token for this adapter.
 */
coccyx.csrf.getToken = function() {
  return coccyx.csrf.token_ || coccyx.csrf.adapter_.getToken();
};


/**
 * Gets the current CSRF param name for this adapter and this request. This is
 * used when submitting the CSRF token as part of a form submission.
 *
 * @return {?string} the current CSRF param.
 */
coccyx.csrf.getParam = function() {
  return coccyx.csrf.param_ || coccyx.csrf.adapter_.getParam();
};


/**
 * Gets the current header key to use when setting the CSRF token on the
 * request headers, as opposed to including it in the form submission.
 *
 * @return {?string} the current header key.
 */
coccyx.csrf.getHeaderKey = function() {
  return coccyx.csrf.header_ || coccyx.csrf.adapter_.getHeaderKey();
};


/**
 * Sets the current framework adapter.
 *
 * @param {coccyx.csrf.Adapter} adapter the new CSRF adapter instance.
 */
coccyx.csrf.setAdapter = function(adapter) {
  coccyx.csrf.adapter_ = adapter;
};



/**
 * An interface gets and sets CSRF tokens and parameters.
 * @interface
 */
coccyx.csrf.Adapter = function() {};


/**
 * Gets the current CSRF token for this adapter and this request.
 *
 * @return {?string} the current CSRF token for this adapter.
 */
coccyx.csrf.Adapter.prototype.getToken = goog.abstractMethod;


/**
 * Gets the current CSRF param name for this adapter and this request.
 *
 * @return {?string} the current CSRF param.
 */
coccyx.csrf.Adapter.prototype.getParam = goog.abstractMethod;


/**
 * Gets the current CSRF param name for this adapter and this request.
 *
 * @return {?string} the current CSRF param.
 */
coccyx.csrf.Adapter.prototype.getHeaderKey = goog.abstractMethod;
