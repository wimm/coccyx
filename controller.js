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

  /**
   * @protected
   */
  this.logger = goog.debug.Logger.getLogger('coccyx.Controller');
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
 * Fetches a model matching the params for the given repository.
 *
 * @param {Object.<string,*>} params The parsed params from the current uri
 *     or provided by the calling method. May be empty.
 * @param {*=} opt_model Optional model (state) object retrieved from a popstate
 *     event or passed in manually.
 *
 * @return {goog.async.Deferred} A deferred which may immediately return if
 *     a model is passed, or will wait until the repo fetches the model.
 */
coccyx.ModelController.prototype.show = function(params, opt_model) {
  var deferred, oid;
  if (opt_model) {
    deferred = goog.async.Deferred.succeed(opt_model);
  } else if (params && (oid = params[this.getRepo().getIdKey()])) {
    deferred = this.getRepo().get(/** @type {string|number} */ (oid));
  } else {
    deferred = goog.async.Deferred.fail('no args provided');
  }

  deferred.addCallback(this.onShow, this);
  return deferred;
};


/**
 * @param {coccyx.Model} model The instantiated model object.
 * @return {goog.ui.Component} The new or updated component.
 */
coccyx.ModelController.prototype.onShow = goog.abstractMethod;


/**
 * Fetches a model matching the params for the given repository and passes it to
 * the onEdit function.
 *
 * @param {Object.<string,*>} params The parsed params from the current uri
 *     or provided by the calling method. May be empty.
 * @param {*=} opt_model Optional model (state) object retrieved from a popstate
 *     event or passed in manually.
 *
 * @return {goog.async.Deferred} A deferred which may immediately return if
 *     a model is passed, or will wait until the repo fetches the model.
 */
coccyx.ModelController.prototype.edit = function(params, opt_model) {
  var deferred, oid;

  if (opt_model) {
    deferred = goog.async.Deferred.succeed(opt_model);
  } else if (params && (oid = params[this.getRepo().getIdKey()])) {
    deferred = this.getRepo().get(/** @type {string|number} */ (oid));
  } else {
    deferred = goog.async.Deferred.fail('no args provided');
  }

  deferred.addCallback(this.onEdit, this);
  return deferred;
};


/**
 * @param {coccyx.Model} model The instantiated model object.
 * @return {goog.ui.Component} The new or updated component.
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
 * TODO: on pagination
 * Fetches a collection matching the params for the given repository and passes
 * it to the onIndex function.
 *
 * @param {Object.<string,*>} params The parsed params from the current uri
 *     or provided by the calling method. May be empty.
 * @param {*=} opt_collection Optional collection (state) object retrieved from
 *     a popstate event or passed in manually.
 *
 * @return {goog.async.Deferred} A deferred which may immediately return if
 *     a model is passed, or will wait until the repo fetches the model.
 */
coccyx.CollectionController.prototype.index = function(params, opt_collection) {
  var deferred = (opt_collection == null) ? this.getRepo().getAll(params) :
                 goog.async.Deferred.succeed(opt_collection);

  deferred.addCallback(this.onIndex, this);
  return deferred;
};


/**
 * Callback added to the deferred's chain in .index().
 * @param {coccyx.Collection} collection the list of parsed resource objects.
 * @return {goog.ui.Component} The new or updated component.
 * @protected
 */
coccyx.CollectionController.prototype.onIndex = goog.abstractMethod;


/**
 * @type {coccyx.Collection} The collection for this controller.
 * @private
 */
coccyx.CollectionController.prototype.collection_;


/**
 * @return {coccyx.Collection} The collection for this controller.
 */
coccyx.CollectionController.prototype.getCollection = function() {
  return this.collection_;
};


/**
 * @param {coccyx.Collection} collection The collection for this controller.
 */
coccyx.CollectionController.prototype.setCollection = function(collection) {
  this.collection_ = collection;
};


