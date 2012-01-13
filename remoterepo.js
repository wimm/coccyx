goog.provide('coccyx.RemoteRepo');

goog.require('coccyx.Model');
goog.require('coccyx.Repo');
goog.require('goog.net.XhrManager');



/**
 * A simple abstraction to act as a type of model repo for persisting objects
 * over a connection to a resourceful resource. Currently assumes a rails-style
 * REST url structure.
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

  /**
   * @type {coccyx.Collection}
   * @protected
   */
  this.cache = new coccyx.Collection();
};
goog.inherits(coccyx.RemoteRepo, coccyx.Repo);


/**
 * @inheritDoc
 */
coccyx.RemoteRepo.prototype.getAll = function(opt_params) {

  var ioId = this.nextId();
  var deferred = new goog.async.Deferred();
  this.xhrManager_.send(ioId, this.uriFor(null, void 0, opt_params),
      coccyx.RemoteRepo.Method.GET,
      void 0, null, null, goog.bind(deferred.callback, deferred));

  deferred.addCallback(this.onGetAll, this);
  return deferred;
};


/**
 * Internal callback function that gets added to the deferred object returned
 * from getAll. Starts off the deferred chain by returning the collection or
 * throwing an error.
 *
 * @param {goog.events.Event} e The event object for the xhr completion.
 * @return {coccyx.Collection} The collection of models.
 * @protected
 */
coccyx.RemoteRepo.prototype.onGetAll = function(e) {
  var response =
      /** @type {Array.<Object.<string,*>>} */(this.parseResponse(e));
  if (e.target.isSuccess()) {
    return this.collectionForParams(response);
  } else {
    throw Error(response);
  }
};


/**
 * @inheritDoc
 */
coccyx.RemoteRepo.prototype.get = function(opt_arg, opt_params) {

  var ioId = this.nextId();
  var uri = this.uriFor(opt_arg);
  var deferred = new goog.async.Deferred();

  this.xhrManager_.send(ioId, uri, coccyx.RemoteRepo.Method.GET,
      void 0, null, null, goog.bind(deferred.callback, deferred));

  deferred.addCallback(this.onGet, this);
  return deferred;
};


/**
 * Internal callback function that gets added to the deferred object returned
 * from get. Starts off the deferred chain by returning the model or
 * throwing an error.
 * @param {goog.events.Event} e The event object for the xhr completion.
 * @return {coccyx.Model} The parsed model.
 * @protected
 */
coccyx.RemoteRepo.prototype.onGet = function(e) {
  var response = this.parseResponse(e);
  if (e.target.isSuccess() && response) {
    return this.modelForParams(response);
  } else {
    throw Error(response);
  }
};


/**
 * @inheritDoc
 */
coccyx.RemoteRepo.prototype.save = function(model) {

  var uri = this.uriFor(model);

  var payload = this.serializeResource(model.toJson());
  var ioId = this.nextId();
  var deferred = new goog.async.Deferred();
  var method = model.isPersisted() ?
      coccyx.RemoteRepo.Method.PUT : coccyx.RemoteRepo.Method.POST;
  console.log('Saving ' + uri);
  this.xhrManager_.send(ioId, uri, method, payload, null, null,
      goog.bind(deferred.callback, deferred));

  deferred.addCallback(goog.bind(this.onSave, this, model));

  return deferred;
};


/**
 * Internal callback function that receives the xhr completion event and calls
 * the appropriate method on the model depending on whether the save was
 * successful. Returns the model to the next callback in the deferral chain.
 * @param {!coccyx.Model} model The model that was operated on (prebound).
 * @param {goog.events.Event} e The event object for the xhr completion.
 * @return {coccyx.Model} the modified model.
 * @protected
 */
coccyx.RemoteRepo.prototype.onSave = function(model, e) {
  var response = this.parseResponse(e);

  if (e.target.isSuccess()) {
    response && model.setAttributes(response);
    return model;
  } else {
    response && model.setErrors(response);
    throw Error(response);
  }
};


/**
 * @inheritDoc
 */
coccyx.RemoteRepo.prototype.destroy = function(
    model, callback) {

  if (model != null) {
    throw new Error('No object received');
  }
  var uri = this.uriFor(model);
  var ioId = this.nextId();
  var deferred = new goog.async.Deferred();

  console.log('Destroying ' + uri);

  this.xhrManager_.send(ioId, uri, coccyx.RemoteRepo.Method.DELETE, '', null,
      null, goog.bind(deferred.callback, deferred));

  deferred.addCallback(goog.bind(this.onDestroy, this, model));

  return deferred;
};


/**
 * Internal callback function that receives the xhr completion event and calls
 * the appropriate method on the model depending on whether the save was
 * successful.
 * @param {!coccyx.Model} model The model that was operated on (prebound).
 * @param {goog.events.Event} e The event object for the xhr completion.
 * @return {coccyx.Model} the model that was destroyed.
 * @protected
 */
coccyx.RemoteRepo.prototype.onDestroy = function(model, e) {
  var response = this.parseResponse(e);

  if (e.target.isSuccess()) {
    return model;
  } else {
    response && model.setErrors(response);
    throw Error(response);
  }
};


/**
 * Internal callback function that receives the xhr completion event and parses
 * the resulting JSON.
 * @param {goog.events.Event} e The event object for the xhr completion.
 * @return {Object.<string,*>} The resulting JSON object, could be errors or
 *     the JSON representation of the model or array of models.
 * @protected
 */
coccyx.RemoteRepo.prototype.parseResponse = function(e) {

  //TODO: if the server returns a 500 error this doesn't handle it gracefully
  // we need to separate out the logic here for parsing the different response
  // codes differently.
  var response = (goog.string.isEmpty(e.target.getResponseText())) ?
      null : e.target.getResponseJson();
  return response;
};


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
  if (this.rawJson_ || (this.key_ === void 0)) {
    res = goog.json.serialize(j);
  } else {
    var j = {};
    j[this.key_] = resource;
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
 * The key for base URI and request wrapping.
 * @type {string}
 * @private
 */
coccyx.RemoteRepo.prototype.key_;


/**
 * @param {string} key The new wrapper object key.
 */
coccyx.RemoteRepo.prototype.setKey = function(key) {
  this.key_ = key;
};


/**
 * The key for the model id attribute.
 * @type {string}
 * @private
 */
coccyx.RemoteRepo.prototype.idKey_ = 'id';


/**
 * @param {string} key The new id attribute key.
 */
coccyx.RemoteRepo.prototype.setIdKey = function(key) {
  this.idKey_ = key;
};


/**
 * @return {string} The id attribute key.
 */
coccyx.RemoteRepo.prototype.getIdKey = function() {
  return this.idKey_;
};


/**
 * @param {string} uri The new base URI for requests.
 */
coccyx.RemoteRepo.prototype.setBaseUri = function(uri) {
  this.baseUri = uri;
};


/**
 * @type {boolean} Whether to send raw JSON data.
 * @private
 */
coccyx.RemoteRepo.prototype.rawJson_ = false;


/**
 * @param {boolean} useRaw Whether to send raw json data or wrap it in an
 *    object such as {'account':*}.
 */
coccyx.RemoteRepo.prototype.useRawJson = function(useRaw) {
  this.rawJson_ = useRaw;
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
  var params;
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

  //IE doesn't distinguish between content types when determining things like
  //the back button and caching, so we need to use a different url for ajax
  //requests to uris that have a matching html version we might have already
  //loaded. Putting .json on the end of the request makes IE happy and rails
  //just routes it back to the normal uri.
  //TODO: make this a configurable parameter.
  uri += '.json';

  return !!params ? uri + params : uri;

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
 * @param {!Object.<string,*>} json JSON of model to insert into the cache.
 * @return {!coccyx.Model} The resulting model.
 */
coccyx.RemoteRepo.prototype.modelForParams = function(json) {
  var child = this.cache.getChild(
      /** @type {string|number} */ (json[this.getIdKey()]));
  if (!child) {
    child = this.newModel();
    child.setAttributes(json);
    this.cache.add(child);
  } else {
    child.setAttributes(json);
  }

  return child;
};


/**
 * Instantiates and caches a list of models based on their JSON attributes.
 *
 * @param {Array.<Object.<string,*>>} models The array of model json
 *     objects.
 * @return {coccyx.Collection} The list of model objects.
 */
coccyx.RemoteRepo.prototype.collectionForParams = function(models) {
  var collection = new coccyx.Collection();
  for (var i = 0; i < models.length; i++) {
    var model = models[i];
    model && collection.add(this.modelForParams(model));
  }
  return collection;
};


/**
 * @param {string} id The id for the desired object.
 * @return {coccyx.Model} An empty instantiation of the model class for this
 *     repo or an existing model from the cache.
 */
coccyx.RemoteRepo.prototype.modelForId = function(id) {
  var child = this.cache.getChild(id);

  if (!child) {
    child = this.newModel();
    child.setId(id);
    this.cache.add(child);
  }

  return child;
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


