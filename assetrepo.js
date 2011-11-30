
goog.provide('coccyx.AssetRepo');

goog.require('coccyx.Model');
goog.require('coccyx.Repo');
goog.require('goog.net.XhrManager');



/**
 * A simple abstraction to act as a type of model repo for persisting objects
 * over a connection to a resourceful resource. Currently assumes a rails-style
 * REST url structure.
 *
 * This class wraps a goog.net.XhrManager and handles CRUD operations
 * @extends {coccyx.RemoteRepo}
 * @constructor
 */
coccyx.AssetRepo = function() {
  goog.base(this);
};
goog.inherits(coccyx.AssetRepo, coccyx.RemoteRepo);


/**
 * Sends a file to a particular uri by uploading a form via an iFrame.
 * @param {coccyx.Asset} model The asset to save.
 * @param {Element} form The form element to submit.
 * @return {goog.async.Deferred} The deferred which will receive the modified
 *     asset as the arg.
 */
coccyx.AssetRepo.prototype.save = function(model, form) {
  this.iframeIo_ || this.iframeIo_ = new goog.net.IframeIo();
  var deferred = new goog.async.Deferred();
  form.action = this.uiFor(model);
  form.method = wimm.isNullOrEmpty(this.getIdentifier(opt_arg)) ?
      coccyx.RemoteRepo.Method.POST : coccyx.RemoteRepo.Method.PUT;

  this.iframeIo_.sendFromForm(form, goog.bind(deferred.callback, deferred));

  deferred.addCallback(goog.bind(this.onSave, this, model));
  return deferred;
};

