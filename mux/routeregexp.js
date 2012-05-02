goog.provide('coccyx.RouteRegExp');

goog.require('coccyx.Model');

// Portions copyright 2012 The Gorilla Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the GORILLA-LICENSE file.



/**
 * @param {string} tpl The route template.
 * @param {boolean=} opt_matchPrefix Whether to match the path prefix.
 * @constructor
 * @implements {coccyx.RouteMatcher}
 */
coccyx.RouteRegExp = function(tpl, opt_matchPrefix) {
  var indices = coccyx.RouteRegExp.getBraceIndices(tpl);

  this.template = tpl;
  this.matchPrefix = !!opt_matchPrefix;

  var defaultPattern = '[^/]+';

  // Unlike gorilla mux, we want to accept both '/foo/' and '/foo' and
  // only 'redirect' to the canonical slash if strictSlash is true. The
  // redirect happens in router.execRoute using history.replaceState().
  var endSlash = false;
  if (goog.string.endsWith(tpl, '/')) {
    tpl = tpl.substring(0, tpl.length - 1);
    endSlash = true;
  }

  this.paramNames = [];
  this.paramRegExps = [];
  var pattern = '^';
  this.reverse = '';
  var end = 0;
  var error;
  var raw;

  for (var i = 0; i < indices.length; i += 2) {
    raw = tpl.substring(end, indices[i]);
    end = indices[i + 1];
    var subTemplate = tpl.substring(indices[i] + 1, end - 1);
    var colIndex = subTemplate.indexOf(':');
    var name = '';
    var patt = defaultPattern;
    if (colIndex >= 0) {
      name = subTemplate.substring(0, colIndex);
      if (colIndex + 1 < subTemplate.length) {
        patt = subTemplate.substring(colIndex + 1);
      }
    } else {
      name = subTemplate;
    }

    if (name == '' || patt == '') {
      this.logger.severe('missing name or pattern in ' +
          subTemplate);
    }

    pattern += goog.string.regExpEscape(raw) + '(' + patt + ')';
    this.reverse += raw + '%s';
    this.paramNames[i / 2] = name;
    this.paramRegExps[i / 2] = new RegExp('^' + patt + '$');
  }

  // Add the remaining
  raw = tpl.substring(end);
  pattern += goog.string.regExpEscape(raw);

  // always accept trailing slashes but don't require them
  pattern += '[/]?';
  if (!this.matchPrefix) { pattern += '$'; }
  this.reverse += raw;
  if (endSlash) { this.reverse += '/'; }

  this.regExp = new RegExp(pattern);

};


/**
 * @type {string} The unmodified template.
 */
coccyx.RouteRegExp.prototype.template;


/**
 * @type {RegExp} The regex for this path.
 */
coccyx.RouteRegExp.prototype.regExp;


/**
 * @type {string} The reverse template for building routes.
 */
coccyx.RouteRegExp.prototype.reverse;


/**
 * @type {Array.<string>} The ordered array of parameter names.
 */
coccyx.RouteRegExp.prototype.paramNames;


/**
 * @type {Array.<RegExp>} The ordered array of parameter regexps. NOTE: this may
 *     be sparse.
 */
coccyx.RouteRegExp.prototype.paramRegExps;


/**
 * @return {goog.debug.Logger} The logger for this class.
 */
coccyx.RouteRegExp.prototype.getLogger = function() {
  return goog.debug.Logger.getLogger('coccyx.RouteRegExp');
};


/**
 * @param {goog.Uri} uri The location to match.
 * @param {coccyx.RouteMatch} match Reference to the match info.
 * @return {boolean} whether the loc was matched.
 */
coccyx.RouteRegExp.prototype.match = function(uri, match) {
  return !!uri.getPath().match(this.regExp);
};


/**
 * @param {coccyx.Model|Object.<string, *>=} opt_arg The key/value params for
 *     building the uri or a coccyx.Model to pull params off.
 * @return {string} The built URI.
 */
coccyx.RouteRegExp.prototype.uri = function(opt_arg) {
  if (this.paramNames.length === 0) {
    return this.template;
  } else if (!opt_arg) {
    this.getLogger().severe('no params provided, expected ' +
                       this.paramNames.length);
  }

  var urlValues = [];
  var val;
  for (var i = 0; i < this.paramNames.length; i++) {
    val = (opt_arg instanceof coccyx.Model) ?
        opt_arg.get(this.paramNames[i]) :
        opt_arg[this.paramNames[i]];
    if (val === void 0) {
      this.getLogger().severe('missing route variable \'' +
                         this.paramNames[i] + '\'');
    }
    urlValues[i] = val.toString();
  }

  // Format takes a pattern and a set of varargs, so we need to put our pattern
  // on the beginning of the array and then apply the whole thing.
  urlValues.unshift(this.reverse);
  var uri = goog.string.format.apply(null, urlValues);

  if (!uri.match(this.regExp)) {
    // The URL is checked against the full regexp, instead of checking
    // individual variables. This is faster but to provide a good error
    // message, we check individual regexps if the URL doesn't match.
    for (i = 0; i < this.paramNames.length; i++) {

      val = (opt_arg instanceof coccyx.Model) ?
          opt_arg.get(this.paramNames[i]) :
          opt_arg[this.paramNames[i]];
      if (! val.toString().match(this.paramRegExps[i])) {
        this.getLogger().severe(
            'variable \'' + val.toString() +
            '\' does not match, expected ' + this.paramRegExps[i].toString());
      }
    }
  }
  return uri;
};


/**
 * Returns the first level curly brace indeces from a string, throws an error
 * in the event of unmatched braces.
 * @param {string} template The template to search.
 * @return {Array.<number>} The indices of opening and closing braces.
 */
coccyx.RouteRegExp.getBraceIndices = function(template) {
  var level = 0;
  var idx = 0;
  var indices = [];

  for (var i = 0; i < template.length; i++) {
    switch (template[i]) {
      case '{':
        level++;
        if (level == 1) {
          idx = i;
        }
        break;
      case '}':
        level--;
        if (level == 0) {
          indices.push(idx, i + 1);
        } else if (level < 0) {
          coccyx.RouteRegExp.prototype.getLogger().severe(
              'unbalanced braces in: ' + template);
        }
        break;
    }
  }

  if (level != 0) {
    coccyx.RouteRegExp.prototype.getLogger().severe(
        'unbalanced braces in: ' + template);
  }

  return indices;
};


/**
 * Populates (or adds-to) the params object on the given RouteMatch object. This
 * allows us to build up param objects based on nested routes. The child params
 * will get populated, and then the parent.
 * @param {goog.Uri} uri The location to match.
 * @param {coccyx.RouteMatch} match The routematch object to populate.
 */
coccyx.RouteRegExp.prototype.setMatch = function(uri, match) {
  if (!match.params) { match.params = {}; }
  var pathVars = uri.getPath().match(this.regExp);
  if (pathVars) {
    for (var i = 0; i < this.paramNames.length; i++) {
      match.params[this.paramNames[i]] = pathVars[i + 1];
    }
  }
};
