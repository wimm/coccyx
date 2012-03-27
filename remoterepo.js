goog.provide('coccyx.RemoteRepo');

goog.require('coccyx.Model');
goog.require('coccyx.Repo');
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

  /**
   * @type {goog.structs.Map}
   * @protected
   * @suppress {underscore}
   */
  this.headers_ = new goog.structs.Map(
      {'Content-Type': 'application/json',
        'Accept': 'application/json'}
      );

  // TODO: Need to experiment more with how rails handles refreshing this token
  this.headers_.set('X-CSRF-Token', wimm.csrf.getToken());

  /**
   * @type {goog.net.XhrManager}
   * @protected
   * @suppress {underscore}
   */
  this.xhrManager_ = new goog.net.XhrManager(0, this.headers_);

  goog.base(this);
};
goog.inherits(coccyx.RemoteRepo, coccyx.Repo);


/**
 * @inheritDoc
 */
coccyx.RemoteRepo.prototype.getAll = function(opt_params) {

  var ioId = this.nextId();
  var deferred = new goog.async.Deferred(goog.bind(this.onCancel, this, ioId));
  this.xhrManager_.send(ioId, this.uriFor(null, void 0, opt_params),
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
    this.logger.warn('no parameters received for get all request');
    throw Error('No parameters received');
  }
};


/**
 * @inheritDoc
 */
coccyx.RemoteRepo.prototype.get = function(
    opt_arg, opt_params, opt_forceFetch) {
  var model;
  if (opt_arg != null) {
    model = this.cache.getChild(opt_arg);
  }
  if (model != null) {
    return goog.async.Deferred.succeed(model);
  } else {
    var ioId = this.nextId();
    var uri = this.uriFor(opt_arg);
    var deferred =
        new goog.async.Deferred(goog.bind(this.onCancel, this, ioId));

    this.xhrManager_.send(ioId, uri, coccyx.RemoteRepo.Method.GET,
        void 0, null, null, goog.bind(deferred.callback, deferred));

    deferred.addCallback(this.onComplete, this);
    deferred.addCallback(this.onGet, this);
    return deferred;
  }
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
    this.logger.warn('no parameters received for get request');
    throw Error('No parameters received');
  }
};


/**
 * @inheritDoc
 */
coccyx.RemoteRepo.prototype.save = function(model) {

  var uri = this.uriFor(model);

  var payload = this.serializeResource(model.toJSON());
  var ioId = this.nextId();
  var deferred = new goog.async.Deferred(goog.bind(this.onCancel, this, ioId));
  var method = model.isPersisted() ?
      coccyx.RemoteRepo.Method.PUT : coccyx.RemoteRepo.Method.POST;
  this.logger.info('Saving ' + uri);
  this.xhrManager_.send(ioId, uri, method, payload, null, null,
      goog.bind(deferred.callback, deferred));

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
coccyx.RemoteRepo.prototype.destroy = function(
    model, callback) {

  var uri = this.uriFor(model);
  var ioId = this.nextId();
  var deferred = new goog.async.Deferred(goog.bind(this.onCancel, this, ioId));

  this.logger.info('Destroying ' + uri);

  this.xhrManager_.send(ioId, uri, coccyx.RemoteRepo.Method.DELETE, '', null,
      null, goog.bind(deferred.callback, deferred));

  deferred.addCallback(this.onComplete, this);
  deferred.addCallback(goog.bind(this.onDestroy, this, model));
  deferred.addErrback(goog.bind(this.onModelError, this, model));

  return deferred;
};


/**
 * Internal callback function that basically just returns the model on success
 * so that downstream callbacks get a handle on the model that was destroyed.
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
  this.xhrManager_.abort(ioId);
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
 * by each custom repository. The default just re-throws the passed exception.
 * subclasses should override this to deal with auth exceptions as they want.
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
 * generates an ID unique to this repo instance for use in assigning an id to
 * an XHR transaction.
 * @return {string} the next incremented id.
 * @protected
 */
coccyx.RemoteRepo.prototype.nextId = function() {
  return (++this.lastXhrId_).toString(); //XhrManager expects a string
};


/**
 * An incrementable counter for the request IDs.
 * @type {number}
 * @private
 */
coccyx.RemoteRepo.prototype.lastXhrId_ = 0;


/**
 * The base URI to use for requests.
 * @type {string}
 * @protected
 */
coccyx.RemoteRepo.prototype.baseUri;


/**
 * The key to use when serializing/deserializing json objects.
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
 * @param {string} uri The new base URI for requests.
 */
coccyx.RemoteRepo.prototype.setBaseUri = function(uri) {
  this.baseUri = uri;
};


/**
 * TODO: I'd like to centralize the URL handling somewhere, either in soy-based
 * templates or in a more sophisticated routing mechanism.
 *
 * The function that will produce the edit uri for this model.
 * Subclasses should override this if not using Rails-style REST.
 * @param {string|number|coccyx.Model=} opt_arg The id or object whos id to use.
 * @param {string=} opt_action The action, such as 'new'.
 * @param {Object.<string,string>=} opt_params Optional url params to be
 *     appended to the end of the query string.
 * @return {string} The uri for GET edit requests.
 */
coccyx.RemoteRepo.prototype.uriFor = function(opt_arg, opt_action, opt_params) {
  var uri = this.baseUri;
  var params = '?';
  var oid;
  if (opt_arg) {
    oid = this.getIdentifier(opt_arg);
    if (oid !== void 0) {
      uri += '/' + oid;
    }
  }

  if (opt_action != null) {
    uri += '/' + opt_action;
  }

  if (opt_params) {
    for (var key in opt_params) {
      params += key + '=' + opt_params[key] + '&';
    }
  }

  //IE doesn't distinguish between content types when determining things like
  //the back button and caching, so we need to use a different url for ajax
  //requests to uris that have a matching html version we might have already
  //loaded. Putting .json on the end of the request makes IE happy and rails
  //just routes it back to the normal uri.
  //TODO: make this a configurable parameter.
  uri += '.json';

  return params != '?' ? uri + params : uri;

};


/**
 * Sometimes we may want to use something other than the id of the object, like
 * the slug.
 * @param {string|number|coccyx.Model} arg The id or object whos id to use.
 * @return {string?} The identifier for the arg or undefined.
 */
coccyx.RemoteRepo.prototype.getIdentifier = function(arg) {
  var oid;
  if (typeof arg == 'string' || typeof arg == 'number') {
    oid = arg.toString();
  } else {
    var model = /** @type {coccyx.Model} */(arg);
    model.isPersisted() && (oid = model.getId().toString());
  }
  return oid;
};


/**
 * @param {!Object.<string,*>} params The parameters to put on the query string.
 * @return {string} The resulting uri.
 */
coccyx.RemoteRepo.prototype.serializeParams = function(params) {
  return '';
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


