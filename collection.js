goog.provide('coccyx.Collection');

goog.require('coccyx.Model');
goog.require('goog.array');
goog.require('goog.object');
goog.require('goog.pubsub.PubSub');
goog.require('goog.structs.Collection');



/**
 * A class representing an ordered list of models. Views can subscribe directly
 * to the collection and/or use the collection as their "model" class. For
 * instance a list control might consist of an outer component with a list of
 * models stored in a collection and a view control for each item mapped to
 * individual models.
 *
 * Because the internal structure is obscured, many of the goog.array methods
 * are included explicitly as methods on an instance of Collection.
 *
 * @constructor
 * @extends {goog.pubsub.PubSub}
 */
coccyx.Collection = function() {
  goog.base(this);
};
goog.inherits(coccyx.Collection, goog.pubsub.PubSub);


/**
 * @param {!coccyx.Model} model The model to add.
 */
coccyx.Collection.prototype.add = function(model) {
  this.addAt(model, this.getCount());
};


/**
 *
 * Much of this mirrors {goog.ui.Component.prototype.addChildAt} but without
 * the need to set the child's parent and deal with rendering/decoration.
 *
 * @param {!coccyx.Model} child The model to add.
 * @param {number} index The index to add the child at.
 */
coccyx.Collection.prototype.addAt = function(child, index) {

  if (index < 0 || index > this.getCount()) {
    throw Error(coccyx.Collection.Errors.CHILD_INDEX_OUT_OF_BOUNDS);
  }

  if (!this.childIndex_ || !this.children_) {
    this.childIndex_ = {};
    this.children_ = [];
  }

  if (this.contains(child)) {
    goog.object.set(this.childIndex_, child.getId().toString(), child);
    goog.array.remove(this.children_, child); //we'll add it back in below
  } else {
    goog.object.add(this.childIndex_, child.getId().toString(), child);
    //add model subscriptions
    child.subscribe(coccyx.Model.Topics.UPDATE, this.onChildUpdate, this);
    child.subscribe(coccyx.Model.Topics.UPDATE_ID, this.onChildUpdateId, this);
    child.subscribe(coccyx.Model.Topics.DESTROY, this.onChildDestroy, this);
    child.subscribe(coccyx.Model.Topics.ERROR, this.onChildError, this);
  }

  goog.array.insertAt(this.children_, child, index);

  this.publish(coccyx.Collection.Topics.ADD, this, child);
};


/**
 * @param {coccyx.Model} child Item that was updated.
 */
coccyx.Collection.prototype.onChildUpdate = function(child) {
  this.publish(coccyx.Collection.Topics.CHILD_UPDATE, this, child);
};


/**
 * @param {coccyx.Model} child Item who's id was updated.
 * @param {string|number} oldId The old id for this child.
 */
coccyx.Collection.prototype.onChildUpdateId = function(child, oldId) {

  if (!this.contains(child)) {
    throw Error(coccyx.Collection.Errors.NOT_OUR_CHILD);
  }

  goog.object.remove(this.childIndex_, oldId.toString());
  goog.object.add(this.childIndex_, child.getId().toString(), child);

};


/**
 * @param {coccyx.Model} child Item that was destroyed.
 */
coccyx.Collection.prototype.onChildDestroy = function(child) {
  this.remove(child);
};


/**
 * @param {coccyx.Model} child Item with error(s).
 */
coccyx.Collection.prototype.onChildError = function(child) {
  this.publish(coccyx.Collection.Topics.CHILD_ERROR, this, child);
};


/**
 * @param {string|number|coccyx.Model} arg Item or id of item to remove.
 * @return {boolean} True if model was removed.
 */
coccyx.Collection.prototype.remove = function(arg) {
  var success = false;
  if (arg) {
    var id = (goog.typeOf(arg) === 'object') ? arg.getId() : arg;
    var child = this.getChild((/** @type {string|number} */ id));

    if (id != null && child) {
      goog.object.remove(this.childIndex_, child.getId());
      success = success && goog.array.remove(this.children_, child);

      if (success) {
        child.unsubscribe(coccyx.Model.Topics.UPDATE,
            this.onChildUpdate, this);
        child.unsubscribe(coccyx.Model.Topics.UPDATE_ID,
            this.onChildUpdateId, this);
        child.unsubscribe(coccyx.Model.Topics.DESTROY,
            this.onChildDestroy, this);
        child.unsubscribe(coccyx.Model.Topics.ERROR,
            this.onChildError, this);

        this.publish(coccyx.Collection.Topics.REMOVE, this, child);
      }
    }
  }
  return success;
};


/**
 *
 * @param {number} index Index of child to remove.
 * @return {boolean} whether the child was successfully removed.
 */
coccyx.Collection.prototype.removeChildAt = function(index) {
  return this.remove(this.getChildAt(index));
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
coccyx.Collection.prototype.children_;


/**
 * Returns the length of the collection, handling the case where our internal
 * representation isn't initialized.
 * @return {number} the number of child models.
 */
coccyx.Collection.prototype.getCount = function() {
  return this.children_ ? this.children_.length : 0;
};


/**
 *
 * @param {string|number|coccyx.Model} arg The model or it's ID.
 * @return {boolean} whether the model is present in the collection.
 */
coccyx.Collection.prototype.contains = function(arg) {
  if (!this.childIndex_) {
    return false;
  }
  var id = (goog.typeOf(arg) === 'object') ?
      arg.getId() : (/** @type {string|number} */ arg);
  return goog.object.get(this.childIndex_, id.toString()) != null;
};


/**
 * Returns the child model with the given id. See also:
 * {goog.ui.Component.getChild}. Uses the childIndex_ map to enable O(1) lookup.
 * @param {string|number} id The id of the child to return.
 * @return {coccyx.Model?} the child model or null.
 */
coccyx.Collection.prototype.getChild = function(id) {
  return (this.childIndex_ && id) ? (/** @type {coccyx.Model} */
      goog.object.get(this.childIndex_, id.toString())) || null : null;
};


/**
 * Returns the child model at the given index. See also:
 * {goog.ui.Component.getChildAt}.
 * @param {number} index The index of the child to return.
 * @return {coccyx.Model?} The child model at the index or null.
 */
coccyx.Collection.prototype.getChildAt = function(index) {
  return this.children_ ? this.children_[index] || null : null;
};


/**
 * Calls the given function on each of the collection's children in order.  If
 * {@code opt_obj} is provided, it will be used as the 'this' object in the
 * function when called.  The function should take two arguments:  the model
 * and its 0-based index.  The return value is ignored.
 * @param {Function} f The function to call for every child component; should
 *    take 2 arguments (the child and its index).
 * @param {Object=} opt_obj Used as the 'this' object in f when called.
 */
coccyx.Collection.prototype.forEach = function(f, opt_obj) {
  this.children_ && goog.array.forEach(this.children_, f, opt_obj);
};


/**
 * Calls a function for each element in the collection, starting from the last
 * element rather than the first.
 *
 * @param {Function} f The function to call for every element. This function
 *     takes 2 arguments (the element and the index). The return
 *     value is ignored.
 * @param {Object=} opt_obj The object to be used as the value of 'this'
 *     within f.
 */
coccyx.Collection.prototype.forEachRight = function(f, opt_obj) {
  this.children_ && goog.array.forEachRight(this.children_, f, opt_obj);
};


/**
 * Calls a function for each element in the collection, and if the function
 * returns true adds the element to a new array.
 *
 * See {@link http://tinyurl.com/developer-mozilla-org-array-filter}
 *
 * @param {Function} f The function to call for every element. This function
 *     takes 2 arguments (the element and the index) and must
 *     return a Boolean. If the return value is true the element is added to the
 *     result array. If it is false the element is not included.
 * @param {Object=} opt_obj The object to be used as the value of 'this'
 *     within f.
 * @return {!Array} a new array in which only elements that passed the test are
 *     present.
 */
coccyx.Collection.prototype.filter = function(f, opt_obj) {
  return this.children_ ? goog.array.filter(this.children_, f, opt_obj) : [];
};


/**
 * Calls a function for each element in the collection and inserts the result
 * into a new array.
 *
 * See {@link http://tinyurl.com/developer-mozilla-org-array-map}
 *
 * @param {Function} f The function to call for every element. This function
 *     takes 2 arguments (the element and the index) and should
 *     return something. The result will be inserted into a new array.
 * @param {Object=} opt_obj The object to be used as the value of 'this'
 *     within f.
 * @return {!Array} a new array with the results from f.
 */
coccyx.Collection.prototype.map = function(f, opt_obj) {
  return this.children_ ? goog.array.map(this.children_, f, opt_obj) : [];
};


/**
 * Passes every element of the collection into a function and accumulates the
 * result.
 *
 * See {@link http://tinyurl.com/developer-mozilla-org-array-reduce}
 *
 * For example:
 * var a = [1, 2, 3, 4];
 * goog.array.reduce(a, function(r, v, i, arr) {return r + v;}, 0);
 * returns 10
 *
 * @param {Function} f The function to call for every element. This function
 *     takes 3 arguments (the function's previous result or the initial value,
 *     the value of the current array element and the current array index)
 *     function(previousValue, currentValue, index).
 * @param {*} val The initial value to pass into the function on the first call.
 * @param {Object=} opt_obj  The object to be used as the value of 'this'
 *     within f.
 * @return {*} Result of evaluating f repeatedly across the values of the array.
 */
coccyx.Collection.prototype.reduce = function(f, val, opt_obj) {
  return this.children_ ?
      goog.array.reduce(this.children_, f, opt_obj) : void 0;
};


/**
 * Passes every element of the collection into a function and accumulates the
 * result, starting from the last element and working towards the first.
 *
 * See {@link http://tinyurl.com/developer-mozilla-org-array-reduceright}
 *
 * For example:
 * var a = ['a', 'b', 'c'];
 * goog.array.reduceRight(a, function(r, v, i, arr) {return r + v;}, '');
 * returns 'cba'
 *
 * @param {Function} f The function to call for every element. This function
 *     takes 3 arguments (the function's previous result or the initial value,
 *     the value of the current array element and the current array index)
 *     function(previousValue, currentValue, index, array).
 * @param {*} val The initial value to pass into the function on the first call.
 * @param {Object=} opt_obj The object to be used as the value of 'this'
 *     within f.
 * @return {*} Object returned as a result of evaluating f repeatedly across the
 *     values of the array.
 */
coccyx.Collection.prototype.reduceRight = function(f, val, opt_obj) {
  return this.children_ ?
      goog.array.reduceRight(this.children_, f, val, opt_obj) : void 0;
};


/**
 * Calls f for each element of the collection. If any call returns true, some()
 * returns true (without checking the remaining elements). If all calls
 * return false, some() returns false.
 *
 * See {@link http://tinyurl.com/developer-mozilla-org-array-some}
 *
 * @param {Function} f The function to call for every element. This function
 *     takes 2 arguments (the element and the element's index) and must
 *     return a Boolean.
 * @param {Object=} opt_obj  The object to be used as the value of 'this'
 *     within f.
 * @return {boolean} true if any element passes the test.
 */
coccyx.Collection.prototype.some = function(f, opt_obj) {
  return !!this.children_ && goog.array.some(this.children_, f, opt_obj);
};


/**
 * Call f for each element of the collection. If all calls return true, every()
 * returns true. If any call returns false, every() returns false and
 * does not continue to check the remaining elements.
 *
 * See {@link http://tinyurl.com/developer-mozilla-org-array-every}
 *
 * @param {Function} f The function to call for every element. This function
 *     takes 2 arguments (the element and the element's index) and must
 *     return a Boolean.
 * @param {Object=} opt_obj The object to be used as the value of 'this'
 *     within f.
 * @return {boolean} false if any element fails the test.
 */
coccyx.Collection.prototype.every = function(f, opt_obj) {
  return !!this.children_ && goog.array.every(this.children_, f, opt_obj);
};


/**
 * Search an array for the first element that satisfies a given condition and
 * return that element.
 * @param {Function} f The function to call for every element. This function
 *     takes 2 arguments (the element and the index) and should
 *     return a boolean.
 * @param {Object=} opt_obj An optional "this" context for the function.
 * @return {*} The first array element that passes the test, or null if no
 *     element is found.
 */
coccyx.Collection.prototype.find = function(f, opt_obj) {
  return this.children_ ? goog.array.find(this.children_, f, opt_obj) : null;
};


/**
 * Search an array for the first element that satisfies a given condition and
 * return its index.
 * @param {Function} f The function to call for every element. This function
 *     takes 2 arguments (the element and the index) and should
 *     return a boolean.
 * @param {Object=} opt_obj An optional "this" context for the function.
 * @return {number} The index of the first array element that passes the test,
 *     or -1 if no element is found.
 */
coccyx.Collection.prototype.findIndex = function(f, opt_obj) {
  return this.children_ ? goog.array.findIndex(this.children_, f, opt_obj) : -1;
};


/**
 * Search an array (in reverse order) for the last element that satisfies a
 * given condition and return that element.
 * @param {Function} f The function to call for every element. This function
 *     takes 2 arguments (the element and the index) and should
 *     return a boolean.
 * @param {Object=} opt_obj An optional "this" context for the function.
 * @return {*} The last array element that passes the test, or null if no
 *     element is found.
 */
coccyx.Collection.prototype.findRight = function(f, opt_obj) {
  return this.children_ ?
      goog.array.findRight(this.children_, f, opt_obj) : null;
};


/**
 * Search an array (in reverse order) for the last element that satisfies a
 * given condition and return its index.
 * @param {Function} f The function to call for every element. This function
 *     takes 2 arguments (the element and the index) and should
 *     return a boolean.
 * @param {Object=} opt_obj An optional "this" context for the function.
 * @return {number} The index of the last array element that passes the test,
 *     or -1 if no element is found.
 */
coccyx.Collection.prototype.findIndexRight = function(f, opt_obj) {
  return this.children_ ?
      goog.array.findIndexRight(this.children_, f, opt_obj) : -1;
};


/**
 * Constants for topic prefixes.
 * @enum {string}
 */
coccyx.Collection.Topics = {
  REFRESH: 'refresh',
  ADD: 'add',
  REMOVE: 'remove',
  CHILD_UPDATE: 'childUpdate',
  CHILD_ERROR: 'childError'
};


/**
 * Error codes that may be thrown by the collection.
 * @enum {string}
 */
coccyx.Collection.Errors = {
  CHILD_INDEX_OUT_OF_BOUNDS: 'Child model index out of bounds',
  NOT_OUR_CHILD: 'Child model is not a member of this collection'
};
