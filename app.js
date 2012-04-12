goog.provide('coccyx.App');

goog.require('coccyx.Router');
goog.require('coccyx.csrf');
goog.require('goog.net.XhrManager');
goog.require('goog.structs.Map');



/**
 * The global application object. This is where the main router gets registered
 * and other application-wide functionality should be attached.
 *
 * By default, coccyx.getApp() will return an instance of this class if
 * coccyx.setApp() has not been called. To provide custom functionality,
 * override this class and call coccyx.setApp(my.App.getInstance()); when
 * starting up your application.
 * @constructor
 */
coccyx.App = function() {

  /**
   * A cache of raw json-like data that will be loaded with the page and
   * accessible to the running app.
   * @type {Object.<string,*>}
   * @private
   */
  this.cache_ = {};

};
goog.addSingletonGetter(coccyx.App);


/**
 * @type {goog.net.XhrManager}
 * @protected
 */
coccyx.App.prototype.xhrManager;


/**
 * @type {coccyx.Router} The main application router.
 * @protected
 */
coccyx.App.prototype.router;


/**
 * @return {!coccyx.Router} The application router, or a new one.
 */
coccyx.App.prototype.getRouter = function() {
  if (!this.router) {
    this.router = new coccyx.Router();
  }
  return this.router;
};


/**
 * @param {!coccyx.Router} router The new application router.
 */
coccyx.App.prototype.setRouter = function(router) {
  this.router = router;
};


/**
 * {goog.net.XhrManager} allows pooling and re-use of xhrio objects. To take
 * advantage of this, we enable sharing of a single instance between all repos.
 *
 * By default, we disable retries (0) because validation errors (422) are
 * treated as failures and otherwise the xhrManager will retry on a validation
 * error.
 * @return {goog.net.XhrManager} The shared xhrio request manager.
 */
coccyx.App.prototype.getXhrManager = function() {

  if (!this.xhrManager) {
    var headers = new goog.structs.Map(
        {'Content-Type': 'application/json',
          'Accept': 'application/json'}
        );

    headers.set(coccyx.csrf.getHeaderKey(), coccyx.csrf.getToken());

    this.xhrManager = new goog.net.XhrManager(
        0, //disable retries
        headers);
  }

  return this.xhrManager;
};


/**
 * Generates an ID unique to this app instance for use in assigning an id to
 * an XHR transaction or creating a temporary model. Similar to
 * {goog.ui.IdGenerator.nextUniqueId()}.
 * @return {string} the next incremented id.
 */
coccyx.App.prototype.getNextId = function() {
  return this.generatedIdPrefix + (++this.lastId_).toString(36);
};


/**
 * @return {string} The current prefix for generated ids.
 */
coccyx.App.prototype.getGeneratedIdPrefix = function() {
  return this.generatedIdPrefix;
};


/**
 * An incrementable counter for generated IDs.
 * @type {number}
 * @private
 */
coccyx.App.prototype.lastId_ = 0;


/**
 * The prefix used to determine whether the id is temporary (has been generated
 * by us) or if it came from the server.
 * @protected
 */
coccyx.App.prototype.generatedIdPrefix = '_';


/**
 * See {coccyx.cache}
 *
 * @param {string} key The application-unique key for lookup.
 * @param {*} value Typically an array of json-like objects.
 */
coccyx.App.prototype.cache = function(key, value) {
  this.cache_[key] = value;
};


/**
 * See {coccyx.getCached}
 *
 * @param {string} key The key for the desired object.
 * @return {*} The value, or undefined.
 */
coccyx.App.prototype.getCached = function(key) {
  return this.cache_[key];
};


/**
 * See {coccyx.cacheAll}
 *
 * @param {Object.<string, *>} obj The json-like objects to cache.
 */
coccyx.App.prototype.cacheAll = function(obj) {
  goog.object.forEach(obj, function(value, key) {
    this.cache(key, value);
  }, this);
};


/**
 * We want to be able to show a 'loading' indicator for async requests.
 * To allow multiple requests to be 'loading' simultaneously, we use a simple
 * reference counter to let repos track async requests. This isn't meant to be
 * used for anything mission critical, so it's pretty naive.
 */
coccyx.App.prototype.startLoading = function() {
  if (this.loading_ === void 0) { this.loading_ = 0; }
  this.loading_++;
  if (this.loading_ === 1) {
    this.onStartLoading();
  }
};


/**
 * Decrements the loading counter and calls onDoneLoading if we're back to 0.
 */
coccyx.App.prototype.doneLoading = function() {
  this.loading_--;
  if (this.loading_ === 0) {
    this.onDoneLoading();
  }
};


/**
 * Subclasses should override this to show a loading indicator.
 */
coccyx.App.prototype.onStartLoading = goog.nullFunction;


/**
 * Subclasses should override this to hide a loading indicator.
 */
coccyx.App.prototype.onDoneLoading = goog.nullFunction;
