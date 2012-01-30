goog.provide('coccyx.Asset');

goog.require('coccyx.AssetRepo');
goog.require('coccyx.Model');



/**
 * An extension of coccyx.Model meant to represent images or other assets.
 * Does not currently extend the HTML5 file api in any way, however the intent
 * is that this would eventually contain a file object as member data, augmented
 * with things like remote uri, and thumbnail data.
 *
 * @constructor
 * @extends {coccyx.Model}
 */
coccyx.Asset = function() {
  goog.base(this);
  this.repo = coccyx.AssetRepo.getInstance();
};
goog.inherits(coccyx.Asset, coccyx.Model);


/**
 * @type {string|number} the id for this object.
 */
coccyx.Asset.prototype.id;


/**
 * @type {string} The filename of the file.
 */
coccyx.Asset.prototype.name;


/**
 * @type {string} The remote uri of the file.
 */
coccyx.Asset.prototype.uri;


/**
 * @type {string} The remote uri of the file thumbnail.
 */
coccyx.Asset.prototype.thumbnailUri;


/**
 * We need to pass along the form containing the file input in order to send
 * it via ajax. We can simplify this one sunny day when all browsers support the
 * html5 file api.
 * @param {Element} form The form element to submit.
 * @return {goog.async.Deferred} The deferrable to give back to the caller.
 */
coccyx.Asset.prototype.save = function(form) {
  this.setErrors(null);
  this.publish(coccyx.Model.Topics.SAVING, this);
  var deferred = (this.validate()) ?
      this.getRepo().save(this, form) :
      goog.async.Deferred.fail(this);

  deferred.addCallback(this.onSave, this);
  deferred.addErrback(this.onError, this);
  return deferred;
};


/**
 * @param {!Object} json The json representation of the account.
 */
coccyx.Asset.prototype.setAttributes = function(json) {

  this.id =
      /** @type {string|number} */ (json[coccyx.Asset.Keys.ID]);

  this.name =
      /** @type {string} */ (json[coccyx.Asset.Keys.NAME]);

  this.uri =
      /** @type {string} */ (json[coccyx.Asset.Keys.URI]);

  this.thumbnailUri =
      /** @type {string} */ (json[coccyx.Asset.Keys.THUMBNAIL_URI]);

};


/**
 * @return {Object} the serialized json object.
 */
coccyx.Asset.prototype.toJSON = function() {
  var json = {};

  json[coccyx.Asset.Keys.ID] = this.id;
  json[coccyx.Asset.Keys.NAME] = this.name;
  json[coccyx.Asset.Keys.URI] = this.uri;
  json[coccyx.Asset.Keys.THUMBNAIL_URI] = this.thumbnailUri;
  return json;
};


/**
 * Serialization keys for the notification attributes.
 * @enum {string}
 */
coccyx.Asset.Keys = {
  ID: 'id',
  NAME: 'name',
  URI: 'uri',
  THUMBNAIL_URI: 'thumbnail_uri'
};


