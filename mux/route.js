goog.provide('coccyx.Route');
goog.provide('coccyx.RouteMatch');
goog.provide('coccyx.RouteMatcher');

goog.require('coccyx.Model');
goog.require('coccyx.RouteRegExp');
goog.require('goog.array');
goog.require('goog.object');
goog.require('goog.pubsub.PubSub');
goog.require('goog.string.format');


// Portions copyright 2012 The Gorilla Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the GORILLA-LICENSE file.



/**
 * @param {coccyx.Router=} opt_parent The parent router for this route.
 * @constructor
 * @extends {goog.pubsub.PubSub}
 * @implements {coccyx.RouteMatcher}
 */
coccyx.Route = function(opt_parent) {
  goog.base(this);
  if (opt_parent) { this.parent = opt_parent; }
  this.matchers = [];
};
goog.inherits(coccyx.Route, goog.pubsub.PubSub);


/**
 * @type {coccyx.Router} The router where this route was registered.
 * @protected
 */
coccyx.Route.prototype.parent = null;


/**
 * @type {function(Object.<string,string>, *=)} The function to call
 *     on match.
 * @protected
 */
coccyx.Route.prototype.handler;


/**
 * @type {Array} The list of matchers for this route.
 * @protected
 */
coccyx.Route.prototype.matchers = null;


/**
 * @type {coccyx.RouteRegExp} Regex var manager.
 * @protected
 */
coccyx.Route.prototype.regExp = null;


/**
 * @type {boolean} Whether to be strict about trailing slashes.
 * @protected
 */
coccyx.Route.prototype.strictSlash = false;


/**
 * @type {boolean} Whether this route is for building URLs only or also
 *     can be matched against.
 * @protected
 */
coccyx.Route.prototype.buildOnly = false;


/**
 * @type {Object.<string,*>} The default params to return when this route is
 *     matched.
 * @protected
 */
coccyx.Route.prototype.params = null;


/**
 * @return {goog.debug.Logger} The logger for this class.
 */
coccyx.Route.prototype.getLogger = function() {
  return goog.debug.Logger.getLogger('coccyx.Route');
};


/**
 * @param {goog.Uri} uri The location of the current document.
 * @param {coccyx.RouteMatch} match Reference to the match info.
 * @return {boolean} whether a route was matched.
 */
coccyx.Route.prototype.match = function(uri, match) {
  if (this.buildOnly) {
    return false;
  }
  //we must match all of our matchers
  for (var i = 0; i < this.matchers.length; i++) {
    var matched = this.matchers[i].match(uri, match);
    if (!matched) {
      return false;
    }
  }

  // if the route isn't set, then it's this route that matched.
  if (!match.route) {
    match.route = this;
  }
  if (!match.handler) { match.handler = this.handler; }

  //parses the loc and sets the params for this portion of the path.
  if (this.regExp) { this.regExp.setMatch(uri, match); }

  //add any default params that haven't been parsed
  if (this.params) {
    goog.object.forEach(this.params, function(param, key) {
      goog.object.setIfUndefined(match.params, key, param);
    }, this);
  }

  return true;
};


/**
 * @param {boolean} buildOnly Whether the route should be matched against or
 *     used only for constructing urls.
 * @return {coccyx.Route} Return self for chaining.
 */
coccyx.Route.prototype.setBuildOnly = function(buildOnly) {
  this.buildOnly = buildOnly;
  return this;
};


/**
 * @return {boolean} Whether the route should be matched against or
 *     used only for constructing urls.
 */
coccyx.Route.prototype.isBuildOnly = function() {
  return this.buildOnly;
};


/**
 * We want to be able to lazily initialize controllers when the user actually
 * needs them. An optional context parameter can be passed to act as the 'this'
 * object. However, this method also accepts a constructor for a controller that
 * implements the .getInstance() method and uses the result of that as the
 * context, allowing consumers to pass in a constructor function for a
 * controller they want to lazily initialize.
 *
 * NOTE: Since there's no way to specify a type that describes this, the
 * compiler isn't much help here, and users are responsible for checking that
 * the provided constructor actually has a getInstance method.
 *
 * @param {function(Object.<string,string>, *=)} method The method to call on
 *     the controller.
 * @param {Object|function(new:Object)=} opt_context A context object or a
 *     controller constructor with a singleton getter.
 * @return {coccyx.Route} Return self for chaining.
 */
coccyx.Route.prototype.setHandler = function(method, opt_context) {

  if (opt_context) {
    var c = opt_context;

    this.handler = function(params, state) {
      if (goog.typeOf(c) === 'function' && c.getInstance) {
        c = c.getInstance();
      }
      method.call(c, params, state);
    };
  } else {
    this.handler = method;
  }
  return this;
};


/**
 * @return {function(Object.<string,string>, *=)} The handler for this route.
 */
coccyx.Route.prototype.getHandler = function() {
  return this.handler || goog.nullFunction;
};


/**
 * @param {string} name The route name.
 * @return {coccyx.Route} Return self for chaining.
 */
coccyx.Route.prototype.setName = function(name) {
  if (this.name && this.name != '') {
    this.getLogger().severe('route already has name \'' + this.name +
                            '\' can\'t set \'' + name + '\'');
  }

  this.name = name;
  this.getNamedRoutes()[name] = this;

  return this;
};


/**
 * @param {string} template The route template.
 * @return {coccyx.Route} Return self for chaining.
 */
coccyx.Route.prototype.setPath = function(template) {
  this.addRegExpMatcher(template, false);
  return this;
};


/**
 * @param {string} template The route template.
 * @return {coccyx.Route} Return self for chaining.
 */
coccyx.Route.prototype.setPathPrefix = function(template) {
  this.addRegExpMatcher(template, true);
  return this;
};


/**
 * @param {Object.<string,*>} params The default (or additional) params to
 *     return when this route is matched.
 * @return {coccyx.Route} Return self for chaining.
 */
coccyx.Route.prototype.setParams = function(params) {
  this.params = params;
  return this;
};


/**
 * @return {Object.<string,*>} The default (or additional) params to
 *     return when this route is matched.
 */
coccyx.Route.prototype.getParams = function() {
  return this.params;
};


/**
 * @param {boolean} strictSlash Whether presence or lack of trailing slashes is
 *     enforced for this route.
 * @return {coccyx.Route} Return self for chaining.
 */
coccyx.Route.prototype.setStrictSlash = function(strictSlash) {
  this.strictSlash = strictSlash;
  return this;
};


/**
 * @param {!coccyx.RouteMatcher} matcher The matcher function to add.
 * @return {coccyx.Route} Return self for chaining.
 */
coccyx.Route.prototype.addMatcher = function(matcher) {
  this.matchers.push(matcher);
  return this;
};


/**
 * @param {string} template The route template to parse.
 * @param {boolean=} opt_matchPrefix Whether this is a prefix matcher only.
 * @return {coccyx.Route} Return self for chaining.
 * @protected
 */
coccyx.Route.prototype.addRegExpMatcher = function(template, opt_matchPrefix) {

  if (template.length == 0 || !goog.string.startsWith(template, '/')) {
    this.getLogger().severe('path must start with a slash, got \'' +
                            template + '\'');
  }

  //returns our regExp or our parents'
  var regExp = this.getRegExp();
  if (regExp) {
    var templ = regExp.template;
    //pre-pend the existing or parent regExp, stripping any trailing slash
    templ = (goog.string.endsWith(templ, '/')) ?
        templ.substring(0, templ.length - 1) : templ;
    template = templ + template;
  }

  this.regExp = new coccyx.RouteRegExp(template, opt_matchPrefix);
  this.addMatcher(this.regExp);
  return this;
};


/**
 * Creates a subrouter for this route. Subrouter will only be tested if the
 * parent route matched.
 * @return {coccyx.Router} The new subrouter with this as a parent.
 */
coccyx.Route.prototype.newSubrouter = function() {
  var router = new coccyx.Router(this);
  this.addMatcher(router);
  return router;
};


/**
 * @param {coccyx.Model|Object.<string, *>=} opt_arg The key/value pairs of
 *     params or a coccyx.Model to pull values off.
 * @return {string} The generated URI.
 */
coccyx.Route.prototype.uri = function(opt_arg) {
  return (this.regExp) ? this.regExp.uri(opt_arg) : '';
};


/**
 * Fetches the route regExp for this route, copying the parent's if this route
 * does not have one.
 * @return {coccyx.RouteRegExp} The RouteRegExp object for this route.
 */
coccyx.Route.prototype.getRegExp = function() {
  var regExp = this.regExp;
  if (!regExp) {
    if (!this.parent) {
      //router might not be set during testing
      this.parent = new coccyx.Router();
    }
    regExp = this.parent.getRegExp();
  }
  return regExp;
};


/**
 * @return {!Object.<string, coccyx.Route>} The map of named routes.
 */
coccyx.Route.prototype.getNamedRoutes = function() {
  if (!this.parent) {
    //router might not be set during testing
    this.parent = new coccyx.Router();
  }
  return this.parent.getNamedRoutes();
};


/**
 * Constants for subscribable topics.
 * @enum {string}
 */
coccyx.Route.Topics = {
  MATCH: 'match' // receives this as parameter
};



/**
 * A function that takes a window location and returns a boolean as to whether
 * it matches.
 * @interface
 */
coccyx.RouteMatcher = function() {};


/**
 * @param {goog.Uri} uri The location of the current document.
 * @param {coccyx.RouteMatch} match Reference to the match info.
 * @return {boolean} whether a route was matched.
 */
coccyx.RouteMatcher.prototype.match;



/**
 * A struct to hold information about a matched route.
 * @constructor
 */
coccyx.RouteMatch = function() {};


/**
 * @type {coccyx.Route} The matched route.
 */
coccyx.RouteMatch.prototype.route = null;


/**
 * @type {function(Object.<string,string>, *=)} The handler for the
 *     matching route.
 */
coccyx.RouteMatch.prototype.handler;


/**
 * @type {Object.<string,string>} The parsed params for the matched route.
 */
coccyx.RouteMatch.prototype.params = null;


/**
 * Determins if this match is equivalent to a given match.
 * Checks first to see if the routes are the same object, which they must be.
 * Next, it checks if the params hashes are both null or the same object.
 * Then it checks each of the known keys and checks to see if the matched
 * route's keys match the given param
 *
 * @param {coccyx.RouteMatch} other The RouteMatch object to compare.
 * @return {boolean} whether the two matches have the same route and params.
 */
coccyx.RouteMatch.prototype.equals = function(other) {
  return this.route === other.route &&
      (this.params === other.params || (!!this.params && !!other.params &&
      goog.array.every(this.route.regExp.paramNames, function(key) {
        return this.params[key] === other.params[key]; }, this)));
};
