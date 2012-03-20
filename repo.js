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
 * @param {string|number=} opt_arg The id to get by.
 * @param {Object.<string,*>=} opt_params Optional params to use.
 * @param {boolean=} opt_forceFetch If true, fetches the object, updating any
 *     cached copies.
 * @return {goog.async.Deferred} A deferred object representing this request,
 *     the deferred callback will return a single coccyx Model object.
 */
coccyx.Repo.prototype.get = function(
    opt_arg, opt_params, opt_forceFetch) {

  var model;

  if (opt_arg != null) {
    model = this.cache.getChild(opt_arg);
  }

  if (model != null) {
    return goog.async.Deferred.succeed(model);
  } else {
    return goog.async.Deferred.fail('could not find ' + opt_arg);
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
  var child = this.cache.getChild(
      /** @type {string|number} */ (params[this.getIdKey()]));
  if (!child) {
    child = this.newModel();
    child.setJSON(params);
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
  for (var i = 0; i < paramArr.length; i++) {
    var params = paramArr[i];
    params && collection.add(this.modelForParams(params));
  }
  return collection;
};


/**
 * @param {string} id The id for the desired object.
 * @return {coccyx.Model} An empty instantiation of the model class for this
 *     repo or an existing model from the cache.
 */
coccyx.Repo.prototype.modelForId = function(id) {
  var child = this.cache.getChild(id);

  if (!child) {
    child = this.newModel();
    child.setId(id);
    this.cache.add(child);
  }

  return child;
};


