goog.provide('coccyx.ui.CollectionList');

goog.require('coccyx.Collection');
goog.require('coccyx.Model');
goog.require('goog.ui.Component');



/**
 * A simple component that handles adding a list of model widgets to itself.
 * @param {Function} childCtor The constructor for child elements.
 * @param {string|Array.<string>=} opt_containerClasses An optional class or
 *     classes to use for the container element.
 * @param {goog.dom.DomHelper=} opt_domHelper Optional DOM helper.
 * @constructor
 * @extends {goog.ui.Component}
 */
coccyx.ui.CollectionList = function(
    childCtor, opt_containerClasses, opt_domHelper) {
  goog.base(this, opt_domHelper);

  /**
   * @protected
   */
  this.containerClasses = opt_containerClasses;

  /**
   * @protected
   */
  this.childCtor = childCtor;

  /**
   * @protected
   */
  this.logger = goog.debug.Logger.getLogger('coccyx.ui.CollectionList');
};
goog.inherits(coccyx.ui.CollectionList, goog.ui.Component);


/**
 * @inheritDoc
 */
coccyx.ui.CollectionList.prototype.createDom = function() {
  var dom = this.getDomHelper();

  this.setElementInternal(dom.createDom('ul', this.containerClasses));

  var collection = /** @type {coccyx.Collection} */ (this.getModel());
  if (collection) { collection.forEach(this.addAt, this); }
};


/**
 * @param {coccyx.Collection} collection The new collection.
 */
coccyx.ui.CollectionList.prototype.setModel = function(collection) {
  var oldCol = this.getModel();

  if (oldCol) {
    oldCol.unsubscribe(coccyx.Collection.Topics.REORDER,
        goog.bind(this.onReorder, this));
    oldCol.unsubscribe(coccyx.Collection.Topics.ADD,
        goog.bind(this.onAdd, this));

    this.removeChildren(true);
  }

  goog.base(this, 'setModel', collection);

  collection.subscribe(coccyx.Collection.Topics.REORDER,
      goog.bind(this.onReorder, this));
  collection.subscribe(coccyx.Collection.Topics.ADD,
      goog.bind(this.onAdd, this));


  if (this.isInDocument()) {
    collection.forEach(this.addAt, this);
  }
};


/**
 * @param {coccyx.Collection} collection Ignored.
 * @param {coccyx.Model} model The child model to add.
 * @param {number} index The index to add the child at.
 */
coccyx.ui.CollectionList.prototype.onAdd = function(
    collection, model, index) {
  this.addAt(model, index);
};


/**
 * @param {coccyx.Model} model The child model to add.
 * @param {number} index The index to add the child at.
 * @protected
 */
coccyx.ui.CollectionList.prototype.addAt = function(model, index) {
  var widget = /** @type {goog.ui.Component} */(new this.childCtor());
  widget.setModel(model);
  this.addChildAt(widget, index, true);
};


/**
 * @param {coccyx.Collection} collection Ignored.
 * @param {Array.<number|string>} oldOrder The old order or records.
 */
coccyx.ui.CollectionList.prototype.onReorder = function(collection, oldOrder) {
  this.logger.severe('onReorder not implemented, old order: ' + oldOrder);
};
