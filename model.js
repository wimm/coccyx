
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
 * @param {!Object} json The json representation of the model's attributes.
 */
coccyx.Model.prototype.setAttributes = goog.abstractMethod;


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
 *
 */
coccyx.Model.prototype.onSave = function() {
  this.persisted = true;
  this.publish(coccyx.Model.Topics.UPDATE, this);
};


/**
 *
 */
coccyx.Model.prototype.onError = function() {
  this.publish(coccyx.Model.Topics.ERROR, this);
};


/**
 *
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
  if (coccyx.isNullOrUndefined(this.id_)) {
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
  if (this.id_ !== newId) {
    this.id_ = newId;
    this.publish(coccyx.Model.Topics.UPDATE_ID, this);
  }
};


/**
 * We need to determine, when saving, whether the model has been saved (and
 * therefore has a valid global ID, or if it just has a local temp ID.
 * @return {boolean} Whether the model has been saved.
 */
coccyx.Model.prototype.isPersisted = function() {
  return !coccyx.isNullOrUndefined(this.id_) &&
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

