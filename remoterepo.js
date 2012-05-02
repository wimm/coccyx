goog.provide('coccyx.RemoteRepo');

goog.require('coccyx.Model');
goog.require('coccyx.Repo');
goog.require('coccyx.csrf');
goog.require('goog.debug.Logger');
goog.require('goog.net.XhrManager');



/**
 * A simple abstraction to act as a type of model repo for persisting objects
 * over a connection to a resourceful resource. Currently assumes a rails-style
 * REST url structure.
 *
 * Additionally, the 'get' method will currently return (immediately via
 * {goog.async.Deferred.succeed}) the cached version of the object if one
 * exists.
 *
 * This class wraps a goog.net.XhrManager and handles CRUD operations
 * @extends {coccyx.Repo}
 * @constructor
 */
coccyx.RemoteRepo = function() {
  goog.base(this);
};
goog.inherits(coccyx.RemoteRepo, coccyx.Repo);


/**
 * @inheritDoc
 */
coccyx.RemoteRepo.prototype.getAll = function(opt_params) {
  var uri = this.collectionRoute.uri(opt_params);
  this.logger.info('Getting ' + uri);
  return this.getAllInternal(uri);
};


/**
 * Internal method accessible to child classes that gets a collection of models
 * at a particular uri.
 *
 * @param {string} uri The location to get.
 * @return {!goog.async.Deferred} A deferred object representing this request,
 *     the deferred callback will return a single coccyx Model object.
 * @protected
 */
coccyx.RemoteRepo.prototype.getAllInternal = function(uri) {
  coccyx.getApp().startLoading();
  var ioId = coccyx.getApp().getNextId();
  var deferred = new goog.async.Deferred(goog.bind(this.onCancel, this, ioId));
  coccyx.getApp().getXhrManager().send(ioId, uri,
      coccyx.RemoteRepo.Method.GET,
      void 0, null, null, goog.bind(deferred.callback, deferred));

  deferred.addCallback(this.onComplete, this);
  deferred.addCallback(this.onGetAll, this);
  return deferred;
};


/**
 * Internal callback function that gets added to the deferred object returned
 * from getAll. Starts off the deferred chain by returning the collection or
 * throwing an error.
 *
 * @param {Array.<Object.<string,*>>} params The parsed array of JSON-like
 *     params.
 * @return {coccyx.Collection} The collection of models.
 * @protected
 */
coccyx.RemoteRepo.prototype.onGetAll = function(params) {
  if (params) {
    return this.collectionForParams(params);
  } else {
    this.logger.severe('no parameters received for get all request');
    throw Error('No parameters received');
  }
};


/**
 * @inheritDoc
 */
coccyx.RemoteRepo.prototype.get = function(arg, opt_forceFetch) {
  var model = opt_forceFetch ? null : this.cache.get(arg);

  if (model != null) {
    return goog.async.Deferred.succeed(model);
  } else {
    var params = {};
    params[this.getIdKey()] = arg;
    var uri = this.modelRoute.uri(params);
    this.logger.info('Getting ' + uri);

    return this.getInternal(uri);
  }
};


/**
 * Internal method accessible to child classes that gets a model at a
 * particular uri.
 *
 * @param {string} uri The location to get.
 * @return {!goog.async.Deferred} A deferred object representing this request,
 *     the deferred callback will return a single coccyx Model object.
 * @protected
 */
coccyx.RemoteRepo.prototype.getInternal = function(uri) {
  coccyx.getApp().startLoading();
  var ioId = coccyx.getApp().getNextId();
  var deferred =
      new goog.async.Deferred(goog.bind(this.onCancel, this, ioId));

  coccyx.getApp().getXhrManager().send(ioId, uri, coccyx.RemoteRepo.Method.GET,
      void 0, null, null, goog.bind(deferred.callback, deferred));

  deferred.addCallback(this.onComplete, this);
  deferred.addCallback(this.onGet, this);
  return deferred;
};


/**
 * Internal callback function that gets added to the deferred object returned
 * from get. Starts off the deferred chain by returning the model or
 * throwing an error.
 * @param {Object.<string,*>} params The parsed JSON-like params.
 * @return {coccyx.Model} The parsed model.
 * @protected
 */
coccyx.RemoteRepo.prototype.onGet = function(params) {
  if (params) {
    return this.modelForParams(params);
  } else {
    this.logger.severe('no parameters received for get request');
    throw Error('No parameters received');
  }
};


/**
 * @inheritDoc
 */
coccyx.RemoteRepo.prototype.save = function(model) {
  var uri, method;
  if (model.isPersisted()) {
    uri = this.modelRoute.uri(model);
    method = coccyx.RemoteRepo.Method.PUT;
  } else {
    uri = this.newModelRoute ? this.newModelRoute.uri(model) :
        this.collectionRoute.uri(model);
    method = coccyx.RemoteRepo.Method.POST;
  }

  this.logger.info('Saving ' + uri);
  return this.saveInternal(uri, model, method);
};


/**
 * Internal method accessible to child classes that saves a model to a
 * particular uri. Takes an optional payload that can be only a portion of a
 * model, for situations where we want to only update certain attributes.
 *
 * @param {string} uri The location to save the payload to.
 * @param {coccyx.Model} model The model to save, or to use for callbacks only
 *     if a payload is provided.
 * @param {coccyx.RemoteRepo.Method} method IE POST or PUT for
 *     create/update.
 * @param {Object=} opt_payload The JSON-like representation of the model or
 *     portion of the model to save.
 *
 * @return {!goog.async.Deferred} A deferred object representing this request,
 *     the deferred callback will return a single coccyx Model object.
 * @protected
 */
coccyx.RemoteRepo.prototype.saveInternal = function(uri, model, method,
                                                    opt_payload) {

  coccyx.getApp().startLoading();
  var ioId = coccyx.getApp().getNextId();
  var deferred = new goog.async.Deferred(goog.bind(this.onCancel, this, ioId));
  var payloadString = this.serializeResource(opt_payload || model.toJSON());

  coccyx.getApp().getXhrManager().send(ioId, uri, method, payloadString,
      null, null, goog.bind(deferred.callback, deferred));

  deferred.addCallback(this.onComplete, this);
  deferred.addCallback(goog.bind(this.onModelUpdated, this, model));
  deferred.addErrback(goog.bind(this.onModelError, this, model));

  return deferred;
};


/**
 * Internal callback function that receives the xhr completion event and calls
 * the appropriate method on the model depending on whether the save was
 * successful. Returns the model to the next callback in the deferral chain.
 * @param {!coccyx.Model} model The model that was operated on (prebound).
 * @param {Object.<string,*>} modifiedParams The parsed JSON-like params.
 * @return {coccyx.Model} the modified model.
 * @protected
 */
coccyx.RemoteRepo.prototype.onModelUpdated = function(model, modifiedParams) {
  this.logger.info('Saved');
  modifiedParams && model.setJSON(modifiedParams);
  return model;
};


/**
 * @inheritDoc
 */
coccyx.RemoteRepo.prototype.destroy = function(model) {
  return this.destroyInternal(this.modelRoute.uri(model), model);
};


/**
 * Internal method accessible to child classes that destroys a model at a
 * particular uri.
 *
 * @param {string} uri The location to save the payload to.
 * @param {coccyx.Model} model The model to delete.
 * @return {!goog.async.Deferred} A deferred object representing this request,
 *     the deferred callback will return a single coccyx Model object.
 * @protected
 */
coccyx.RemoteRepo.prototype.destroyInternal = function(uri, model) {
  coccyx.getApp().startLoading();
  var ioId = coccyx.getApp().getNextId();
  var deferred = new goog.async.Deferred(goog.bind(this.onCancel, this, ioId));

  this.logger.info('Destroying ' + uri);

  coccyx.getApp().getXhrManager().send(ioId, uri,
      coccyx.RemoteRepo.Method.DELETE, '', null,
      null, goog.bind(deferred.callback, deferred));

  deferred.addCallback(this.onComplete, this);
  deferred.addCallback(goog.bind(this.onDestroy, this, model));
  deferred.addErrback(goog.bind(this.onModelError, this, model));

  return deferred;
};


/**
 * Internal callback function that basically just returns the model on success
 * so that downstream callbacks get a handle on the model that was destroyed.
 *
 * We don't need to remove the model from the cache explicitly
 * as the cache collection is already subscribed to model destroy
 * notifications and will do so itself.
 *
 * @param {!coccyx.Model} model The model that was operated on (prebound).
 * @return {coccyx.Model} the model that was destroyed.
 * @protected
 */
coccyx.RemoteRepo.prototype.onDestroy = function(model) {
  this.logger.info('Destroyed model id:' + model.getId());
  return model;
};


/**
 * Internal callback function attached to all returned deferreds that will
 * cancel the xhrio request based on the request's id. This allows consumers
 * to call .cancel() on the returned deferred and have that handled properly.
 * TODO: other cleanup.
 * @param {string} ioId The id for the request to cancel. Will be prebound
 *     before passing this function to the deferred's constructor.
 * @protected
 */
coccyx.RemoteRepo.prototype.onCancel = function(ioId) {
  coccyx.getApp().getXhrManager().abort(ioId);
};


/**
 * Internal callback that kicks off the callback/errback chain by inspecting
 * the response from the server. Also will trigger an Application-level auth
 * exception on particular
 * @param {goog.events.Event} e The event object for the xhr completion.
 * @return {Object.<string,*>} The resulting JSON object, could be errors or
 *     the JSON representation of the model or array of models.
 * @protected
 */
coccyx.RemoteRepo.prototype.onComplete = function(e) {
  coccyx.getApp().doneLoading();
  this.logger.info('request complete');
  var responseText = e.target.getResponseText();
  if (e.target.isSuccess()) {
    return (goog.string.isEmpty(responseText)) ?
        null : e.target.getResponseJson();
  } else {
    var responseCode = e.target.getStatus();
    switch (responseCode) {
      case goog.net.HttpStatus.UNAUTHORIZED:
        this.onAuthError(e);
        throw Error(responseText);
        break;
      default:
        throw Error(responseText);
    }
  }
};


/**
 * Internal errback that takes an exception passed by the onComplete callback
 * and attempts to parse json errors off the message and attach them to the
 * prebound model object.
 * @param {coccyx.Model} model The model to assign errors to.
 * @param {Error} err The error object.
 * @return {Error} The re-thrown error so that it's passed along.
 * @protected
 */
coccyx.RemoteRepo.prototype.onModelError = function(model, err) {
  var errors = null;

  /** @preserveTry */
  try {
    errors = goog.json.parse(err.message);
  } catch (ex) {
  }

  errors && model.setErrors(errors);

  throw err;
};


/**
 * We need to be able to deal with authentication errors outside the normal
 * callback/deferred scope. In most cases, this is a true failure and we need
 * to have the application handle this for us, but that should be determined
 * by each custom repository.
 * @param {goog.events.Event} e The event object for the xhr completion.
 */
coccyx.RemoteRepo.prototype.onAuthError = goog.nullFunction;


/**
 * Generates a JSON encoded string for the given object. If the repo is set to
 * use raw JSON, the raw JSON string will be returned, otherwise the result will
 * be wrapped in an object using this repo's key as the lookup. Typically this
 * would be used when talking to a server which expects a parameterized json
 * request, such as Rails.
 * @param {*} resource An object representing the resouce to be saved, can be
 *     a primitive value, but is usually an object.
 * @return {string} resource A JSON string representation of the input.
 * @protected
 */
coccyx.RemoteRepo.prototype.serializeResource = function(resource) {
  var res;
  if (this.jsonKey_ === void 0) {
    res = goog.json.serialize(resource);
  } else {
    var j = {};
    j[this.jsonKey_] = resource;
    res = goog.json.serialize(j);
  }
  return res;
};


/**
 * The route to use for collection (index) requests.
 * @type {coccyx.Route}
 * @protected
 */
coccyx.RemoteRepo.prototype.collectionRoute;


/**
 * The route to use for model (get,save,destroy) requests.
 * @type {coccyx.Route}
 * @protected
 */
coccyx.RemoteRepo.prototype.modelRoute;


/**
 * The key to use when serializing json objects.
 * NOTE: deserialization based on this key is not currently
 * supported: JSON representation must come down raw.
 * @type {string}
 * @private
 */
coccyx.RemoteRepo.prototype.jsonKey_;


/**
 * @param {string} key The new wrapper object key.
 */
coccyx.RemoteRepo.prototype.setJsonKey = function(key) {
  this.jsonKey_ = key;
};


/**
 * @return {string} The wrapper object key.
 */
coccyx.RemoteRepo.prototype.getJsonKey = function() {
  return this.jsonKey_;
};


/**
 * By default, the route that getAll uses.
 * @param {string|coccyx.Route} arg The name of the desired route or
 *     the route itself.
 */
coccyx.RemoteRepo.prototype.setCollectionRoute = function(arg) {
  this.collectionRoute = coccyx.getRoute(arg);
};


/**
 * By default, the route that save, get and destroy requests go to. get()
 * expects that the route has one param, and that param matches the idKey
 * accessible via this.getIdKey(). Ie '/calendars/{id}'.
 *
 * To override this behavior, child classes should override .get(), save() and
 * .destroy() as needed to build the route in a custom manner.
 *
 * @param {string|coccyx.Route} arg The name of the desired route or
 *     the route itself.
 */
coccyx.RemoteRepo.prototype.setModelRoute = function(arg) {
  this.modelRoute = coccyx.getRoute(arg);
};


/**
 * By default, the route that save calls when the model has not yet been
 * persisted is to do a post request to the collection route. However, if you
 * want to override that, specify a newModelRoute, or override .save().
 *
 * @param {string|coccyx.Route} arg The name of the desired route or
 *     the route itself.
 */
coccyx.RemoteRepo.prototype.setNewModelRoute = function(arg) {
  this.newModelRoute = coccyx.getRoute(arg);
};


/**
 * @enum {string}
 */
coccyx.RemoteRepo.Method = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE'
};


