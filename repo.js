goog.provide('coccyx.Repo');

goog.require('coccyx.Model');
goog.require('goog.async.Deferred');
goog.require('goog.pubsub.PubSub');



/**
 * A simple abstraction to act as a type of model repo for persisting objects.
 * Subclasses could implement client-side or server-side persistence. All
 * operations are asynchronous. Notification of success/failure will be provided
 * by calling .onSave, .onError and .onDestroy on models passed to the
 * destroy/save methods, and via the callback function passed to the get/getAll
 * methods.
 *
 * This normalizes the API between local storage and remote storage.
 *
 * @extends {goog.pubsub.PubSub}
 * @constructor
 */
coccyx.Repo = function() {};


/**
 * @param {Object.<string,*>=} opt_params The parameters to get by.
 * @return {goog.async.Deferred} A deferred object representing this request,
 *     the deferred callback will return a coccyx Collection object.
 */
coccyx.Repo.prototype.getAll = goog.abstractMethod;


/**
 * @param {string|number=} opt_arg The id to get by.
 * @param {Object.<string,*>=} opt_params Optional params to use.
 * @return {goog.async.Deferred} A deferred object representing this request,
 *     the deferred callback will return a single coccyx Model object.
 */
coccyx.Repo.prototype.get = goog.abstractMethod;


/**
 * @param {!coccyx.Model} model The model to create.
 * @return {goog.async.Deferred} A deferred object representing this request,
 *     the deferred callback will call onSave or onError on the model and also
 *     pass the model through the callback chain of the deferred.
 */
coccyx.Repo.prototype.save = goog.abstractMethod;


/**
 * @param {coccyx.Model} arg The model to destroy.
 * @return {goog.async.Deferred} A deferred object representing this request,
 *     the deferred callback will call onDestroy or onError on the model and
 *     also pass the model through the callback chain of the deferred.
 */
coccyx.Repo.prototype.destroy = goog.abstractMethod;


/**
 * @return {coccyx.Model} An empty instantiation of the model class for this
 *     repo.
 */
coccyx.Repo.prototype.newModel = goog.abstractMethod;


/**
 * @return {coccyx.Collection} An empty instantiation of the collection class
 *     for this repo.
 */
coccyx.Repo.prototype.newCollection = goog.abstractMethod;
