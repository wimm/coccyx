goog.provide('coccyx.CollectionController');
goog.provide('coccyx.Controller');
goog.provide('coccyx.ModelController');

goog.require('coccyx.Collection');
goog.require('coccyx.Model');
goog.require('coccyx.Repo');
goog.require('goog.async.Deferred');
goog.require('goog.events.EventHandler');
goog.require('goog.net.XhrManager');



/**
 * @constructor
 * @extends {goog.events.EventHandler}
 */
coccyx.Controller = function() {
  goog.base(this);
};
goog.inherits(coccyx.Controller, goog.events.EventHandler);


/**
 * @param {coccyx.Repo} repository The new repo to use for
 * persisting objects.
 */
coccyx.Controller.prototype.setRepo = function(repository) {
  this.repo_ = repository;
};


/**
 * @return {coccyx.Repo} The repo for this controller.
 */
coccyx.Controller.prototype.getRepo = function() {
  return this.repo_;
};


/**
 * @type {coccyx.Repo} The repo for this controller.
 * @private
 */
coccyx.Controller.repo_;



/**
 * @constructor
 * @extends {coccyx.Controller}
 */
coccyx.ModelController = function() {
  goog.base(this);
};
goog.inherits(coccyx.ModelController, coccyx.Controller);


/**
 * @type {coccyx.Model} The model for this controller.
 */
coccyx.ModelController.prototype.model_;


/**
 * @return {coccyx.Model} The model for this controller.
 */
coccyx.ModelController.prototype.getModel = function() {
  return this.model_;
};


/**
 * @param {coccyx.Model} model The model for this controller.
 */
coccyx.ModelController.prototype.setModel = function(model) {
  this.model_ = model;
};


/**
 * Fetches all the records for the given repository.
 * @param {string|number|coccyx.Model} arg The model to show or id of a model
 *     to fetch.
 * @return {goog.async.Deferred} A deferred which may immediately return if
 *     a model is passed, or will wait until the repo fetches the model.
 */
coccyx.ModelController.prototype.show = function(arg) {
  var deferred;
  if (typeof opt_arg == 'string' || typeof opt_arg == 'number') {
    deferred = this.getRepo().get(/** @type {string|number} */ (arg));
  } else {
    deferred = goog.async.Deferred.succeed(arg);
  }

  deferred.addCallback(this.onShow, this);
  return deferred;
};


/**
 * @param {coccyx.Model} model The instantiated model object.
 */
coccyx.ModelController.prototype.onShow = goog.abstractMethod;


/**
 * Fetches the given model and passes it to the onEdit function.
 * @param {string|number|coccyx.Model} arg The model to show or id of a model
 *     to fetch.
 * @return {goog.async.Deferred} A deferred which may immediately return if
 *     a model is passed, or will wait until the repo fetches the model.
 */
coccyx.ModelController.prototype.edit = function(arg) {
  var deferred;
  if (typeof opt_arg == 'string' || typeof opt_arg == 'number') {
    deferred = this.getRepo().get(/** @type {string|number} */ (arg));
  } else {
    deferred = goog.async.Deferred.succeed(arg);
  }

  deferred.addCallback(this.onEdit, this);
  return deferred;
};


/**
 * @param {coccyx.Model} model The instantiated model object.
 */
coccyx.ModelController.prototype.onEdit = goog.abstractMethod;



/**
 * @constructor
 * @extends {coccyx.ModelController}
 */
coccyx.CollectionController = function() {
  goog.base(this);
};
goog.inherits(coccyx.CollectionController, coccyx.ModelController);


/**
 * Fetches all the records for the given repository.
 * TODO: on pagination
 * @return {goog.async.Deferred} A deferred which may immediately return if
 *     a model is passed, or will wait until the repo fetches the model.
 */
coccyx.CollectionController.prototype.index = function() {
  var deferred = this.getRepo().getAll();
  deferred.addCallback(this.onIndex, this);
  return deferred;
};


/**
 * Callback added to the deferred's chain in .index().
 * @param {coccyx.Collection} collection the list of parsed resource objects.
 * @protected
 */
coccyx.CollectionController.prototype.onIndex = goog.abstractMethod;


/**
 * @type {coccyx.Collection} The collection for this controller.
 * @private
 */
coccyx.Controller.prototype.collection_;


/**
 * @return {coccyx.Collection} The collection for this controller.
 */
coccyx.Controller.prototype.getCollection = function() {
  return this.collection_;
};


/**
 * @param {coccyx.Collection} collection The collection for this controller.
 */
coccyx.Controller.prototype.setCollection = function(collection) {
  this.collection_ = collection;
};


