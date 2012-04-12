goog.require('coccyx.csrf');
goog.provide('coccyx.csrf.RailsAdapter');



/**
 * Rails 3.x specific adapter to get CSRF token
 *
 * @constructor
 * @implements {coccyx.csrf.Adapter}
 */
coccyx.csrf.RailsAdapter = function() {
};
goog.addSingletonGetter(coccyx.csrf.RailsAdapter);


/** @inheritDoc */
coccyx.csrf.RailsAdapter.prototype.getToken = function() {
  return this.getMetaContent_('csrf-token');
};


/** @inheritDoc */
coccyx.csrf.RailsAdapter.prototype.getParam = function() {
  return this.getMetaContent_('csrf-param');
};


/** @inheritDoc */
coccyx.csrf.RailsAdapter.prototype.getHeaderKey = function() {
  return 'X-CSRF-Token';
};


/**
 * Returns the value of the first matching meta tag
 *
 * @param {string} mName a particular meta tag's name.
 * @return {?string} The value of the matching meta tag or null.
 * @private
 */
coccyx.csrf.RailsAdapter.prototype.getMetaContent_ = function(mName) {

  var metas = document.getElementsByTagName('meta');

  for (var i = 0; i < metas.length; i++) {
    if (metas[i].getAttribute('name') === mName) {
      return metas[i].getAttribute('content');
    }
  }
  return null;
};

