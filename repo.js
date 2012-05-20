goog.provide('coccyx.Repo');

goog.require('coccyx.Collection');
goog.require('coccyx.Model');
goog.require('goog.async.Deferred');



/**
 * A simple abstraction to act as a type of model repo for persisting objects.
 * Subclasses could implement client-side or server-side persistence. All
 * operations are asynchronous. Notification of success/failure will be provided
 * by calling .onSave, .onError and .onDestroy on models passed to the
 * destroy/save methods.
 *
 * This default version is ethereal, not actually persisting models anywhere.
 *
 * All asynchronous methods also return {goog.async.Deferred} objects for
 * handling errors and chaining actions.
 *
 * A simple object cache is used to ensure that we don't have multiple copies
 * of an object client-side. Implementations should use the cache in a manner
 * appropriate for their use case.
 *
 * @constructor
 */
coccyx.Repo = function() {

  /**
   * @type {coccyx.Collection}
   * @protected
   */
  this.cache = new coccyx.Collection();

  /**
   * @protected
   */
  this.logger = goog.debug.Logger.getLogger('coccyx.Repo');

};


/**
 * @param {Object.<string,*>=} opt_params The parameters to get by.
 * @return {goog.async.Deferred} A deferred object representing this request,
 *     the deferred callback will return a coccyx Collection object.
 */
coccyx.Repo.prototype.getAll = function(opt_params) {
  return goog.async.Deferred.succeed(this.cache);
};


/**
 * @param {string|number} arg The id to get by.
 * @param {Object.<string,*>=} opt_params Optional params to use.
 * @param {boolean=} opt_forceFetch If true, fetches the object from
 *     storage/server, updating any cached copies.
 * @return {goog.async.Deferred} A deferred object representing this request,
 *     the deferred callback will return a single coccyx Model object.
 */
coccyx.Repo.prototype.get = function(
    arg, opt_params, opt_forceFetch) {

  //opt_forceFetch is ignored since we're local only.

  var model = this.cache.get(arg);

  if (model != null) {
    return goog.async.Deferred.succeed(model);
  } else {
    return goog.async.Deferred.fail('could not find ' + arg);
  }
};


/**
 * @param {!coccyx.Model} model The model to create.
 * @return {goog.async.Deferred} A deferred object representing this request,
 *     the deferred callback will call onSave or onError on the model and also
 *     pass the model through the callback chain of the deferred.
 */
coccyx.Repo.prototype.save = function(model) {
  this.cache.add(model);
  return goog.async.Deferred.succeed(model);
};


/**
 * @param {!coccyx.Model} model The model to destroy.
 * @return {goog.async.Deferred} A deferred object representing this request,
 *     the deferred callback will pass the model through the callback chain.
 */
coccyx.Repo.prototype.destroy = function(model) {
  // We don't need to remove the model from the cache explicitly
  // as the cache collection is already subscribed to model destroy
  // notifications and will do so itself.
  if (this.cache.contains(model)) {
    return goog.async.Deferred.succeed(model);
  } else {
    return goog.async.Deferred.fail(
        'could not destroy model: ' + model.getId());
  }
};


/**
 * @param {Function} ctor The constructor for this repo's models.
 */
coccyx.Repo.prototype.setModelConstructor = function(ctor) {
  this.modelConstructor_ = ctor;
};


/**
 * @return {coccyx.Model} An empty instantiation of the model class for this
 *     repo.
 */
coccyx.Repo.prototype.newModel = function() {
  return new this.modelConstructor_(this);
};


/**
 * @return {coccyx.Collection} An empty instantiation of the collection class
 *     for this repo.
 */
coccyx.Repo.prototype.newCollection = function() {
  return new coccyx.Collection();
};


/**
 * The key for the model id attribute.
 * @type {string}
 * @private
 */
coccyx.Repo.prototype.idKey_ = 'id';


/**
 * @param {string} key The new id attribute key.
 */
coccyx.Repo.prototype.setIdKey = function(key) {
  this.idKey_ = key;
};


/**
 * @return {string} The id attribute key.
 */
coccyx.Repo.prototype.getIdKey = function() {
  return this.idKey_;
};


/**
 * @param {!Object.<string,*>} params JSON-like params of a model to insert
 *     into the cache.
 * @return {!coccyx.Model} The resulting model.
 */
coccyx.Repo.prototype.modelForParams = function(params) {
  var child = this.cache.get(
      /** @type {string|number} */ (params[this.getIdKey()]));
  if (!child) {
    child = this.newModel();
    child.setJSON(params, true);
    this.cache.add(child);
  } else {
    child.setJSON(params);
  }

  return child;
};


/**
 * Instantiates and caches a list of models based on their JSON-like attributes.
 *
 * @param {Array.<Object.<string,*>>} paramArr The array of JSON-like model
 *     params.
 * @return {coccyx.Collection} The list of model objects.
 */
coccyx.Repo.prototype.collectionForParams = function(paramArr) {
  var collection = new coccyx.Collection();
  if (paramArr) {
    for (var i = 0; i < paramArr.length; i++) {
      var params = paramArr[i];
      params && collection.add(this.modelForParams(params));
    }
  } else {
    this.logger.warning('collectionForParams: no parameters received');
  }
  return collection;
};


/**
 * @param {string} id The id for the desired object.
 * @return {coccyx.Model} An empty instantiation of the model class for this
 *     repo or an existing model from the cache.
 */
coccyx.Repo.prototype.modelForId = function(id) {
  var child = this.cache.get(id);

  if (!child) {
    child = this.newModel();
    child.set(this.getIdKey(), id);
    this.cache.add(child);
  }

  return child;
};


/**
 * Warms the cache collection with the data from the application cache (if it
 * exists). For remote apps, this allows us to pre-cache data at page load that
 * can be accessed via the normal repo.get() methods.
 * @param {string} key The key for our data on the application cache.
 */
coccyx.Repo.prototype.warmCache = function(key) {
  var raw = coccyx.getCached(key);
  if (raw) {
    if (goog.isArray(raw)) {
      for (var i = 0; i < raw.length; i++) {
        if (raw[i]) { this.modelForParams(raw[i]); }
      }
    } else if (goog.isObject(raw)) {
      this.modelForParams(raw);
    }
  } else {
    this.logger.info('no cached data found for \'' + key + '\'');
  }
};
