goog.provide('coccyx');

goog.require('coccyx.App');


/**
 * @type {coccyx.App} The current application.
 * @private
 */
coccyx.app_;


/**
 * @return {coccyx.App} The current application object.
 */
coccyx.getApp = function() {
  coccyx.app_ || (coccyx.app_ = coccyx.App.getInstance());
  return coccyx.app_;
};


/**
 * @param {!coccyx.App} app The new application object.
 */
coccyx.setApp = function(app) {
  coccyx.app_ = app;
};


/**
 * Convenience method for grabbing a named route from the current router. We
 * allow passing of a route to make it easier for other components to provide
 * an API that takes either a route or a string.
 *
 * @param {string|coccyx.Route} arg The name of the route, or for convenience,
 *     the actual route, which will just be returned.
 * @return {coccyx.Route} The matching route, or null.
 */
coccyx.getRoute = function(arg) {
  return coccyx.getApp().getRouter().get(arg);
};


/**
 * Convenience front end for {coccyx.Router.prototype.goToUri}
 * @param {goog.Uri|string} arg The goog.Uri or string uri to go to.
 */
coccyx.goToUri = function(arg) {
  coccyx.getApp().getRouter().goToUri(arg);
};


/**
 * Convenience front end for {coccyx.Router.prototype.goToRoute}
 * @param {coccyx.Route|string} arg The route or name of the desired route.
 * @param {Object.<string, *>=} opt_params The optional key/value map of params.
 * @param {*=} opt_state Optional model to pass directly to the method.
 */
coccyx.goToRoute = function(arg, opt_params, opt_state) {
  coccyx.getApp().getRouter().goToRoute(arg, opt_params, opt_state);
};


/**
 * Rudimentary caching system to use at page load. Used for avoiding the
 * two-request problem on the initial page load where the app loads the frame
 * and then loads the necessary data. Instead, we pre-cache raw json-like data
 * here and expect that repositories will look here for cached data in their
 * constructors.
 *
 * We could move this to the repositories, but keeping it in one place makes
 * the server-side portion much simpler.
 *
 * This implementation is just a simple map.
 *
 * @param {string} key The application-unique key for lookup.
 * @param {*} value Typically an array of json-like objects.
 */
coccyx.cache = function(key, value) {
  coccyx.getApp().cache(key, value);
};


/**
 * Caches an object's attributes using their keys as the cache keys. Allows us
 * to cache everything for the page at once by making a call like:
 *
 * coccyx.cacheAll({ 'account': {...}, 'topStories': [...]})
 *
 * @param {Object.<string, *>} obj The json-like objects to cache.
 */
coccyx.cacheAll = function(obj) {
  coccyx.getApp().cacheAll(obj);
};


/**
 * Simply return the cached value if it exists.
 * @param {string} key The key for the desired object.
 * @return {*} The value, or undefined.
 */
coccyx.getCached = function(key) {
  return coccyx.getApp().getCached(key);
};
