
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
 * @constructor
 * @extends {goog.pubsub.PubSub}
 */
coccyx.Model = function() {
  goog.base(this);
};
goog.inherits(coccyx.Model, goog.pubsub.PubSub);


/**
 * Generator used to generate temporary unique IDs for managing models on
 * the client side before they get persisted to the service.
 * @type {goog.ui.IdGenerator}
 * @private
 */
coccyx.Model.prototype.idGenerator_ = goog.ui.IdGenerator.getInstance();


/**
 * @param {!Object} obj The json representation of the model's attributes.
 */
coccyx.Model.prototype.setAttributes = function(obj) {
  var idKey = this.repo.getIdKey();
  var id = obj[idKey];

  if (id != null) {
    // we don't want the id to be set again below. TODO: maybe clone obj?
    delete obj[idKey];
    this.setId(id);
  }

  var updated = [];
  // walk through the keys on the json object and use the obfuscated attribute
  // key map to set the corresponding attribute on ourselves.
  goog.object.forEach(obj, function(val, key, object) {
    var obfKey = this.attributeKeys[key];
    if (obfKey && this[obfKey] !== val) {
      //NOTE: this is unsafe-ish, since we're ignoring types.
      this[obfKey] = val;
      updated.push(key);
    }
  }, this);
};


/**
 * @param {Array.<string>=} opt_include A limited set of attributes to include
 *    in the json output instead of including everything. These must match the
 *    strings passed to the setAttributeKeys function.
 * @return {Object} the serialized json object.
 */
coccyx.Model.prototype.toJson = function(opt_include) {

  var json = {};
  json[this.repo.getIdKey()] = this.getId();

  var keys = opt_include || goog.object.getKeys(this.attributeKeys);

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var obfKey = this.attributeKeys[key];

    if (obfKey && this[obfKey] !== void 0) {
      json[key] = this[obfKey];
    }
  }

  return json;
};


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
 * Uses the configured repository to persist the model. Will call validate()
 * on the model and fire the onError() handler if the model is locally invalid.
 * @return {goog.async.Deferred} The deferrable to give back to the caller.
 */
coccyx.Model.prototype.save = function() {
  this.setErrors(null);
  this.publish(coccyx.Model.Topics.SAVING, this);
  var deferred = (this.validate()) ?
      this.getRepo().save(this) :
      goog.async.Deferred.fail(this);

  deferred.addCallback(this.onSave, this);
  deferred.addErrback(this.onError, this);
  return deferred;
};


/**
 * Uses the configured repository to persist the model.
 * @return {goog.async.Deferred} The deferrable to give back to the caller.
 */
coccyx.Model.prototype.destroy = function() {
  this.publish(coccyx.Model.Topics.DESTROYING, this);
  //TODO: send validation state change notification?
  var deferred = this.getRepo().destroy(this);
  deferred.addCallback(this.onDestroy, this);
  deferred.addErrback(this.onError, this);
  return deferred;
};


/**
 * Publishes an update message and flags the model as persisted.
 */
coccyx.Model.prototype.onSave = function() {
  this.persisted = true;
  this.publish(coccyx.Model.Topics.UPDATE, this);
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
  return true;
};


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
  //in theory id could be truthy 'false'
  if (this.id_ != null) {
    this.id_ = coccyx.Model.tempIdPrefix +
        '.' + this.idGenerator_.getNextUniqueId();
  }
  return this.id_;
};


/**
 * Setting the id is 'special' because we use the id to track this object
 * in collections so we need to explicitly know when the id gets changed.
 * @param {string|number} newId The new id for this model.
 */
coccyx.Model.prototype.setId = function(newId) {
  if (this.id_ === void 0 || this.id_.toString() !== newId.toString()) {
    var oldId = this.id_;
    this.id_ = newId;
    this.publish(coccyx.Model.Topics.UPDATE_ID, this, oldId);
  }
};


/**
 * We need to determine, when saving, whether the model has been saved (and
 * therefore has a valid global ID, or if it just has a local temp ID.
 * @return {boolean} Whether the model has been saved.
 */
coccyx.Model.prototype.isPersisted = function() {
  return this.id_ != null &&
      !goog.string.startsWith(this.id_.toString(), coccyx.Model.tempIdPrefix);
};


/**
 * @type {number|string} The id for this object.
 * @private
 */
coccyx.Model.prototype.id_;


/**
 * @type {Object.<string,string|Array.<string>>} The map of n number of errors
 *     messages for each attribute.
 */
coccyx.Model.prototype.errors;


/**
 * The repository to persist models. This should be set to a concrete object
 * reference for subclasses, that way each instance of the class will share
 * the repo
 * @type {coccyx.Repo}
 * @protected;
 */
coccyx.Model.prototype.repo;


/**
 * Constants for topic prefixes.
 * @enum {string}
 */
coccyx.Model.Topics = {
  DESTROY: 'destroy',
  DESTROYING: 'destroying',
  UPDATE: 'update',
  SAVING: 'saving',
  ERROR: 'error',
  UPDATE_ID: 'updateId'
};


/**
 * The prefix used to determine whether the id for this model is temporary or
 * if the model has been persisted and given an id by the repository.
 */
coccyx.Model.tempIdPrefix = 'temp';

