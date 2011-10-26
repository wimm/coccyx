goog.provide('coccyx.Collection');

goog.require('coccyx.Model');
goog.require('goog.pubsub.PubSub');
goog.require('goog.structs.Collection');



/**
 * A class representing an ordered list of models. Views can subscribe directly
 * to the collection and/or use the collection as their "model" class. For
 * instance a list control might consist of an outer component with a list of
 * models stored in a collection and a view control or each item mapped to
 * individual models.
 * @constructor
 * @extends {goog.pubsub.PubSub}
 */
coccyx.Collection = function() {
  goog.base(this);
  this.items_ = [];
};
goog.inherits(coccyx.Collection, goog.pubsub.PubSub);


/**
 * @param {coccyx.Model} model The model to add.
 */
coccyx.Collection.prototype.add = function(model) {
  goog.array.insert(this.items_, model);
  this.publish(coccyx.Collection.Topics.ADD, this, model);
};


/**
 * @param {coccyx.Model} model Item to remove.
 * @return {boolean} True if model was removed.
 */
coccyx.Collection.prototype.remove = function(model) {
  var success = goog.array.remove(this.items_, model);
  success && this.publish(coccyx.Collection.Topics.REMOVE, this, model);
  return success;
};


/**
 * Similar to goog.ui.Component we keep a map of children models' ids
 * for fun and profit. We do this so that we have fast access to the
 * children outside of the order they are stored. We then use this to access
 * the children in the order specified by the user.
 */
coccyx.Collection.prototype.childIndex_;


/**
 * @type {Array.<coccyx.Model>} the internal list of items
 */
coccyx.Collection.prototype.items_;


/**
 * Pulled from {@code goog.ui.Component.forEachChild}
 *
 * Calls the given function on each of this component's children in order.  If
 * {@code opt_obj} is provided, it will be used as the 'this' object in the
 * function when called.  The function should take two arguments:  the child
 * component and its 0-based index.  The return value is ignored.
 * @param {Function} f The function to call for every child component; should
 *    take 2 arguments (the child and its index).
 * @param {Object=} opt_obj Used as the 'this' object in f when called.
 */
coccyx.Collection.prototype.forEach = function(f, opt_obj) {
  if (this.items_) {
    goog.array.forEach(this.items_, f, opt_obj);
  }
};


/**
 * Constants for topic prefixes.
 * @enum {string}
 */
coccyx.Collection.Topics = {
  REFRESH: 'refresh',
  ADD: 'add',
  REMOVE: 'destroy'
};
