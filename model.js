
/**
 * @fileoverview This is a rough port of Backbone.js' Model class modified to
 * work with the Closure library for things like publish/subscribe, ajax methods
 * and the other support functionality.
 *
 * This class inherits from {goog.pubsub.PubSub} to provide notifications to
 * subscribed observers.
 */


goog.provide('coccyx.Model');
goog.provide('coccyx.Model.Topics');

goog.require('goog.array');
goog.require('goog.object');
goog.require('goog.pubsub.PubSub');
goog.require('goog.string');
goog.require('goog.ui.IdGenerator');



/**
 * @param {!coccyx.Repo} repo The repository to use for this object.
 * @constructor
 * @extends {goog.pubsub.PubSub}
 */
coccyx.Model = function(repo) {
  goog.base(this);
  this.setRepo(repo);
};
goog.inherits(coccyx.Model, goog.pubsub.PubSub);


/**
 * Generator used to generate temporary unique IDs for managing models on
 * the client side before they get persisted to the service. NOTE: since
 * this is an object reference on the shared prototype, it will be shared
 * with all coccyx.Models.
 * @type {goog.ui.IdGenerator}
 * @private
 */
coccyx.Model.prototype.idGenerator_ = goog.ui.IdGenerator.getInstance();


/**
 * Convenience method to get a single attribute based on an unobfuscated key.
 *
 * @param {string} key The string of the unobfuscated attribute to fetch.
 * @return {*} val The value of the key.
 */
coccyx.Model.prototype.get = function(key) {
  var obfKey = this.attributeKeys[key];
  return obfKey != null ? this[obfKey] : void 0;
};


/**
 * Method to change a single or group of attributes and publish the appropriate
 * change notifications.
 * @param {Object.<string,*>|string} arg The json-ish representation of the
 *     model's attributes.
 * @param {*=} opt_value The value for the given key (only if a string was
 *     passed as the initial arg).
 */
coccyx.Model.prototype.set = function(arg, opt_value) {

  var obj;

  if (goog.typeOf(arg) === 'string') {
    obj = {};
    obj[arg] = opt_value;
  } else {
    obj = arg;
  }

  if (goog.typeOf(obj) === 'object') {
    /**
     * @type {Array.<string>}
     */
    var updated = [];
    var oldVals = [];

    // walk through the keys on the json object and use the obfuscated attribute
    // key map to set the corresponding attribute on ourselves.
    goog.object.forEach(/** @type {Object} */ (obj),
        function(val, key, object) {
          var obfKey = this.attributeKeys[key];
          if (obfKey && this[obfKey] !== val) {
            oldVals.push(this[obfKey]);
            //NOTE: this is unsafe-ish, since we're ignoring types.
            this[obfKey] = val;
            updated.push(key);
          }
        }, this);

    this.change(updated, oldVals);
  }
};


/**
 * Publishes a change notification for one or more optional attributes and also
 * publishes a change notification for the model as a whole.
 *
 * @param {string|Array.<string>} arg The key or array of keys
 *     that were changed, if any.
 * @param {*|Array.<*>} oldValue An optional old value or list of old
 *     values to publish for the given key.
 */
coccyx.Model.prototype.change = function(arg, oldValue) {
  if (goog.typeOf(arg) === 'array' &&
      goog.typeOf(oldValue) === 'array') {
    var keys = /** @type {Array} */ (arg);
    var oldVals = /** @type {Array} */ (oldValue);
    for (var i = 0; i < keys.length; i++) {
      this.publish(keys[i], this, this.get(keys[i]), oldVals[i]);
    }
    this.publish(coccyx.Model.Topics.CHANGE, this);
  } else if (goog.typeOf(arg) === 'string') {
    this.publish(/** @type {string} */ (arg),
        this, this.get(/** @type {string} */ (arg)),
        oldValue);
    this.publish(coccyx.Model.Topics.CHANGE, this);
  }
};


/**
 * @param {Array.<string>=} opt_include A limited set of attributes to include
 *    in the json output instead of including everything. These must match the
 *    strings passed to the setAttributeKeys function.
 * @return {Object} the serialized json object.
 */
coccyx.Model.prototype.toJSON = function(opt_include) {

  var json = {};
  opt_include || (json[this.repo.getIdKey()] = this.getId());

  var keys = opt_include || goog.object.getKeys(this.attributeKeys);

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var obfKey = this.attributeKeys[key];

    if (obfKey != null && Object.prototype.hasOwnProperty.call(this, obfKey)) {
      var val = this[obfKey];

      //We can do this because 'toJSON' is in a closure compiler externs
      if (goog.typeOf(val) === 'object' && val['toJSON'] !== void 0) {
        val = val.toJSON();
      }
      json[key] = val;
    }
  }

  return json;
};


/**
 * @param {Object.<string,*>} obj JSON-like object with desired attributes. By
 *     default this is the same as .set, however it is necessary to separate
 *     the two when instantiating object graphs from deep JSON structures so
 *     that we know when to simply set an attribute or when to instantiate a new
 *     child object.
 */
coccyx.Model.prototype.setJSON = coccyx.Model.prototype.set;


/**
 * @param {Object} obj The obfuscated attribute-to-string mapping that has
 *     been renamed via a call to {goog.reflect.object()}.
 */
coccyx.Model.prototype.setAttributeKeys = function(obj) {
  // this takes an object like {$renamedParam$ : 'param'} and gives us an
  // object of the form {param: '$renamedParam$'}
  this.attributeKeys = goog.object.transpose(obj);
};


/**
 * Subscribes a function to a topic. Overrides
 * {goog.pubsub.PubSub.prototype.subscribe} and validates that the topic is
 * either one of the attribute keys for this object or one of the model-level
 * topics from {coccyx.Model.Topics}.
 *
 * @param {string} topic Topic to subscribe to.
 * @param {Function} fn Function to be invoked when a message is published to
 *     the given topic.
 * @param {Object=} opt_context Object in whose context the function is to be
 *     called (the global scope if none).
 * @return {number} Subscription key.
 */
coccyx.Model.prototype.subscribe = function(topic, fn, opt_context) {
  if (!(topic in this.attributeKeys) && !(topic in coccyx.Model.TopicKeys) &&
      topic !== this.getRepo().getIdKey()) {
    throw Error('Uknown topic: ' + topic);
  }

  return goog.base(this, 'subscribe', topic, fn, opt_context);
};


/**
 * Uses the configured repository to persist the model. Will call validate()
 * on the model and fire the onError() handler if the model is locally invalid.
 * @return {goog.async.Deferred} The deferrable to give back to the caller.
 */
coccyx.Model.prototype.save = function() {
  this.setErrors(null);
  this.publish(coccyx.Model.Topics.SAVING, this);
  this.deferred && this.deferred.cancel();
  this.deferred = (this.validate()) ?
      this.getRepo().save(this) :
      goog.async.Deferred.fail(this);

  this.deferred.addCallback(this.onSave, this);
  this.deferred.addErrback(this.onError, this);
  return this.deferred;
};


/**
 * Uses the configured repository to persist the model.
 * @return {goog.async.Deferred} The deferrable to give back to the caller.
 */
coccyx.Model.prototype.destroy = function() {
  this.publish(coccyx.Model.Topics.DESTROYING, this);
  this.deferred && this.deferred.cancel();
  //TODO: send validation state change notification?
  this.deferred = this.getRepo().destroy(this);
  this.deferred.addCallback(this.onDestroy, this);
  this.deferred.addErrback(this.onError, this);
  return this.deferred;
};


/**
 * Publishes an update message and flags the model as persisted.
 * @param {!coccyx.Model} model The model that was operated on (prebound).
 * @return {coccyx.Model} the modified model.
 */
coccyx.Model.prototype.onSave = function(model) {
  this.persisted = true;
  this.publish(coccyx.Model.Topics.SAVE, this);
  return model;
};


/**
 * Publishes an error message.
 */
coccyx.Model.prototype.onError = function() {
  this.publish(coccyx.Model.Topics.ERROR, this);
};


/**
 * Publishes a destroy message.
 */
coccyx.Model.prototype.onDestroy = function() {
  this.publish(coccyx.Model.Topics.DESTROY, this);
};


/**
 * @return {boolean} Whether the model is valid. Override this method
 * to perform your own validation.
 */
coccyx.Model.prototype.validate = function() {
  this.setErrors(null);
  this.validateInternal();
  return this.errors == null || goog.object.isEmpty(this.errors);
};


/**
 * Validates the model, setting errors on the errors object as needed.
 * @type {function()}
 * @protected
 */
coccyx.Model.prototype.validateInternal = goog.nullFunction;


/**
 * @param {Object.<string,string|Array.<string>>} errors The JSON representation
 *     of the errors for this model.
 */
coccyx.Model.prototype.setErrors = function(errors) {
  //TODO: we may need to link these directly to the model's attributes,
  // currently we're leaving it as string-based JSON.
  this.errors = errors;
};


/**
 * @param {string} field The name of the field (non obfuscated).
 * @param {string} message The error message.
 */
coccyx.Model.prototype.addError = function(field, message) {
  this.errors || (this.errors = {});
  if (this.errors[field] === void 0) {
    this.errors[field] = message;
  } else if (goog.isArrayLike(this.errors[field])) {
    this.errors[field].push(message);
  } else {
    var errs = [];
    errs.push(this.errors[field]);
    errs.push(message);
    this.errors[field] = errs;
  }
};


/**
 * @param {coccyx.Repo} repo The repository to use for this model.
 */
coccyx.Model.prototype.setRepo = function(repo) {
  this.repo = repo;
};


/**
 * @return {coccyx.Repo} The repository to use for this model.
 */
coccyx.Model.prototype.getRepo = function() {
  return this.repo;
};


/**
 * Gets the id for this model, creating a temporary id if none exists.
 * @return {string|number} id for this model.
 */
coccyx.Model.prototype.getId = function() {
  var key = this.getRepo().getIdKey();
  if (this.get(key) == null) {
    this.set(key, coccyx.Model.tempIdPrefix +
        '.' + this.idGenerator_.getNextUniqueId());
  }

  return /** @type {string|number} */(this.get(key));
};


/**
 * We need to determine, when saving, whether the model has been saved (and
 * therefore has a valid global ID, or if it just has a local temp ID.
 * @return {boolean} Whether the model has been saved.
 */
coccyx.Model.prototype.isPersisted = function() {
  return !goog.string.startsWith(
      this.getId().toString(), coccyx.Model.tempIdPrefix);
};


/**
 * @type {Object.<string,string|Array.<string>>} The map of n number of errors
 *     messages for each attribute.
 */
coccyx.Model.prototype.errors;


/**
 * @type {goog.async.Deferred} The currently deferred action, we want to be able
 * to cancel this if the user has requested another action that should override
 * the previous deferred chain
 * @protected
 */
coccyx.Model.prototype.deferred;


/**
 * The repository to persist models. Repos are singletons, so this is typically
 * set in the model constructor with a call to the repo's getInstance method.
 * @type {coccyx.Repo}
 * @protected;
 */
coccyx.Model.prototype.repo;


/**
 * Constants for topic prefixes.
 * //TODO: change 'update' to 'change'.
 * @enum {string}
 */
coccyx.Model.Topics = {
  DESTROY: '_destroy',
  DESTROYING: '_destroying',
  CHANGE: '_change',
  SAVING: '_saving',
  SAVE: '_save',
  ERROR: '_error'
};


/**
 * We need to check for presence of a topic string in the topics and we
 * want to be able to do it in O(1) timeframe, so we cache the transposed
 * version of the topics list.
 * @type {Object}
 */
coccyx.Model.TopicKeys = goog.object.transpose(coccyx.Model.Topics);


/**
 * The prefix used to determine whether the id for this model is temporary or
 * if the model has been persisted and given an id by the repository.
 */
coccyx.Model.tempIdPrefix = 'temp';

