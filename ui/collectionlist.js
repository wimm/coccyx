goog.provide('coccyx.ui.CollectionList');

goog.require('coccyx.Collection');
goog.require('coccyx.Model');
goog.require('goog.ui.Component');
goog.require('wimm.Notification');
goog.require('wimm.ui.NotificationWidget');



/**
 * A simple component that handles adding notification widgets to itself.
 * @param {Function} childCtor The constructor for child elements.
 * @param {string=} opt_containerClass An optional class to use for the
 *     container element.
 * @param {goog.dom.DomHelper=} opt_domHelper Optional DOM helper.
 * @constructor
 * @extends {goog.ui.Component}
 */
coccyx.ui.CollectionList = function(
    childCtor, opt_containerClass, opt_domHelper) {
  goog.base(this, opt_domHelper);

  /**
   * @protected
   */
  this.containerClass = opt_containerClass;

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

  this.setElementInternal(dom.createDom('ul', this.containerClass));
};


/**
 * @inheritDoc
 */
coccyx.ui.CollectionList.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');

  var collection = /** @type {coccyx.Collection} */ (this.getModel());
  collection &&
      collection.forEach(this.addAt, this);
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
    oldCol.unsubscribe(coccyx.Collection.Topics.REMOVE,
        goog.bind(this.onRemove, this));
  }

  this.removeChildren(true);

  goog.base(this, 'setModel', collection);

  collection.subscribe(coccyx.Collection.Topics.REORDER,
      goog.bind(this.onReorder, this));
  collection.subscribe(coccyx.Collection.Topics.ADD,
      goog.bind(this.onAdd, this));
  collection.subscribe(coccyx.Collection.Topics.REMOVE,
      goog.bind(this.onRemove, this));


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
  if (this.isInDocument()) {
    var widget = /** @type {goog.ui.Component} */(new this.childCtor());
    widget.setModel(model);
    this.addChildAt(widget, index, true);
  }
};


/**
 * @param {coccyx.Collection} collection Ignored.
 * @param {Array.<number|string>} oldOrder The old order or records.
 */
coccyx.ui.CollectionList.prototype.onReorder = function(collection, oldOrder) {
  this.logger.warn('onReorder not implemented, old order: ' + oldOrder);
};


/**
 * @param {coccyx.Collection} collection Ignored.
 * @param {coccyx.Model} model The child model to add.
 */
coccyx.ui.CollectionList.prototype.onRemove = function(collection, model) {
  this.logger.warn('onRemove not implemented, removed model: ' + model);
};
