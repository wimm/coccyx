goog.provide('coccyx.View');

goog.require('coccyx.Collection');
goog.require('coccyx.Model');
goog.require('goog.ui.Component');



/**
 * Simple wrapper around goog.ui.Component to .
 *
 * @param {goog.dom.DomHelper=} opt_domHelper Optional DOM helper.
 * @constructor
 * @extends {goog.ui.Component}
 */
coccyx.View = function(opt_domHelper) {
  goog.base(this, opt_domHelper);
};
goog.inherits(coccyx.View, goog.ui.Component);


/**
 * Overrides the default component setModel method to enforce using a
 * coccyx.Model type.
 *
 * @param {coccyx.Model} model The model.
 */
coccyx.View.prototype.setModel = function(model) {
  goog.base(this, 'setModel', model);

};


/**
 * Overrides the default component getModel to cast the result as a
 * coccyx.Model.
 *
 * @return {coccyx.Model} The model.
 */
coccyx.View.prototype.getModel = function() {
  return /** @type {coccyx.Model} */ (goog.base(this, 'getModel'));
};
