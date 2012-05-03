goog.provide('coccyx.Router');


goog.require('coccyx.Route');
goog.require('goog.debug.Logger');
goog.require('goog.pubsub.PubSub');

// Portions Copyright 2012 The Gorilla Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.



/**
 * Registers routes to be matched.
 * @param {coccyx.Route=} opt_parent Optional parent route for subrouters.
 *
 * @constructor
 * @extends {goog.pubsub.PubSub}
 * @implements {coccyx.RouteMatcher}
 */
coccyx.Router = function(opt_parent) {
  goog.base(this);
  if (opt_parent) { this.parent = opt_parent; }
  this.routes = [];
};
goog.inherits(coccyx.Router, goog.pubsub.PubSub);


/**
 * @type {coccyx.Route} the parent route if this is a subrouter.
 * @protected
 */
coccyx.Router.prototype.parent = null;


/**
 * @type {Array.<coccyx.Route>} routes to be matched, in order.
 * @protected
 */
coccyx.Router.prototype.routes;


/**
 * @type {Object.<string,coccyx.Route>} map of routes keyed to name strings.
 * @protected
 */
coccyx.Router.prototype.namedRoutes = null;


/**
 * @type {boolean} whether presence or lack of trailing slashes is enforced for
 *     all subroutes.
 * @protected
 */
coccyx.Router.prototype.strictSlash = false;


/**
 * @type {goog.Uri} The current uri, to avoid pushing the same uri to the
 *     history or re-execing a route we're already on.
 */
coccyx.Router.prototype.currentUri = null;


/**
 * @return {goog.debug.Logger} The logger for this class.
 */
coccyx.Router.prototype.getLogger = function() {
  return goog.debug.Logger.getLogger('coccyx.Router');
};


/**
 * @param {goog.Uri} uri The location to match.
 * @param {coccyx.RouteMatch} match Reference to the match info.
 * @return {boolean} whether a route was matched.
 */
coccyx.Router.prototype.match = function(uri, match) {
  return goog.array.some(this.routes, function(route) {
    return route.match(uri, match);
  });
};


/**
 * @param {string|coccyx.Route} arg The name of the desired route, or
 *     for convenience, the route itself (which will simply be returned).
 * @return {?coccyx.Route} The route or undefined.
 */
coccyx.Router.prototype.get = function(arg) {
  if (goog.typeOf(arg) === 'string') {
    var route = this.getNamedRoutes()[/** @type {string} */(arg)];
    if (!route) {
      this.getLogger().severe('Could not find route with name: ' + arg);
    } else {
      return route;
    }
  } else {
    return /** @type {coccyx.Route} */(arg);
  }
};


/**
 * @return {!Object.<string,coccyx.Route>} Map of named routes.
 */
coccyx.Router.prototype.getNamedRoutes = function() {
  if (!this.namedRoutes) {
    if (this.parent) {
      this.namedRoutes = this.parent.getNamedRoutes();
    } else {
      this.namedRoutes = {};
    }
  }
  return this.namedRoutes;
};


/**
 * @return {coccyx.RouteRegExp} The path regexp for this router, if any.
 */
coccyx.Router.prototype.getRegExp = function() {
  if (this.parent) {
    return this.parent.getRegExp();
  }
  return null;
};


/**
 * @return {coccyx.Route} The new empty route.
 */
coccyx.Router.prototype.newRoute = function() {
  var route = new coccyx.Route(this);
  this.routes.push(route);
  return route;
};


/**
 * Sets this router as the application router. This router will listen for
 * events on the given window and route requests appropriately. Calls to
 * coccyx.History.go(...) will be handled by this router.
 * @param {Window=} opt_win An optional window to listen on/dispatch to.
 */
coccyx.Router.prototype.install = function(opt_win) {
  this.window_ = opt_win || window;
  this.enabled_ = !!(this.window_.history && this.window_.history.pushState &&
      window.history.replaceState && !navigator.userAgent.match(
          /((iPod|iPhone|iPad).+\bOS\s+[1-4]|WebApps\/.+CFNetwork)/));
  this.statePopped_ = ('state' in this.window_.history);
  this.initialUri_ = this.window_.location.href;

  if (this.enabled_) {
    goog.events.listen(this.window_, goog.events.EventType.POPSTATE,
                       this.onPopState, false, this);

    goog.events.listen(this.window_, goog.events.EventType.CLICK,
                       this.onClick, false, this);
  }

  // NOTE: the matching handler will be executed via setTimeout, not right now.
  this.goToUri(this.window_.location.href);
};


/**
 * @param {goog.events.BrowserEvent} e The browser event object.
 * @protected
 */
coccyx.Router.prototype.onPopState = function(e) {
  //ignore initial popstate from browsers we think will fire it.
  if (!this.statePopped_ && this.window_.location.href == this.initialUri_) {
    this.getLogger().info('ignoring what we believe to be the initial pop');
    return;
  }
  this.statePopped_ = true;
  //get the matching route from window.location
  var uri = new goog.Uri(this.window_.location.href);
  var match = new coccyx.RouteMatch();
  if ((!this.currentUri || (uri.toString() != this.currentUri.toString())) &&
      this.match(uri, match)) {
    this.getLogger().info('routing back to \'' + match.route.name + '\'');
    this.execRoute(match.route, match.params);
    this.currentUri = uri;
  } else {
    this.getLogger().info('no route matches \'' +
                          this.window_.location.href + '\'');
  }
};


/**
 * We need to hijack any link clicks to check against our routes before letting
 * them continue on.
 * @param {goog.events.BrowserEvent} e The browser event object.
 * @protected
 */
coccyx.Router.prototype.onClick = function(e) {
  var link = goog.dom.getAncestorByTagNameAndClass(e.target, 'a');
  if (link) {
    this.goToUri(link.toString());
    // we always set window.location manually even if we're disabled or don't
    // have a matching route. So we always prevent the link from redirecting us.
    e.preventDefault();
  }
};


/**
 * Asynchronously execute the route's handler. We need to do this async because
 * the link we clicked on might get removed from the document by the handler we
 * call.
 * @param {coccyx.Route} route The route to execute.
 * @param {Object.<string, *>=} opt_params The optional key/value map of params.
 * @param {*=} opt_state The optional state that was placed on the stack.
 * @protected
 */
coccyx.Router.prototype.execRoute = function(route, opt_params, opt_state) {
  var params = opt_params || {};
  //TODO: replace the current state with the slashified or unslashified uri

  this.window_.setTimeout(goog.bind(function() {
    route.getHandler()(params, opt_state);
    route.publish(coccyx.Route.Topics.MATCH, route, params);
    this.publish(coccyx.Router.Topics.ROUTE_CHANGE, this, route, params);
  }, this), 0);
};


/**
 * Asynchronously execute the route's handler.
 * @param {coccyx.Route} route The route to execute.
 * @param {Object.<string, *>=} opt_params The optional key/value map of params.
 * @param {*=} opt_state The optional state that was placed on the stack.
 * @protected
 */
coccyx.Router.prototype.pushRoute = function(route, opt_params, opt_state) {
  this.getLogger().info('pushing uri \'' + route.uri(opt_params) + '\'');
  this.window_.history.pushState(
      opt_state || null, null, route.uri(opt_params));
};


/**
 * Takes a uri argument as a string or Uri object and either execs the matching
 * route, if it exists and routing is enabled, or sets the window location to
 * the new uri.
 * @param {goog.Uri|string} arg The goog.Uri or string uri to go to.
 */
coccyx.Router.prototype.goToUri = function(arg) {
  var uri = new goog.Uri(arg);
  var loc = new goog.Uri(this.window_.location);
  var match = new coccyx.RouteMatch();
  if (this.enabled_ && loc.hasSameDomainAs(uri) && this.match(uri, match)) {
    if (!this.currentUri || (uri.toString() != this.currentUri.toString())) {
      this.currentUri = uri;
      this.goToRoute(match.route, match.params);
    } else {
      this.getLogger().info('already on uri ' + uri.toString());
    }
  } else {
    this.onRouteNotFound(uri);
  }
};


/**
 * @param {coccyx.Route|string} arg The route or name of the desired route.
 * @param {Object.<string, *>=} opt_params The optional key/value map of params.
 * @param {*=} opt_state The optional state that was placed on the stack.
 */
coccyx.Router.prototype.goToRoute = function(arg, opt_params, opt_state) {
  var route = null;
  if (goog.typeOf(arg) === 'string') {
    route = this.get(/** @type {string} */(arg));
  } else if (goog.typeOf(arg) === 'object') {
    route = arg;
  }

  if (route) {
    this.getLogger().info('routing to \'' + route.name + '\'');
    this.execRoute(/** @type {coccyx.Route} */(route), opt_params, opt_state);
    this.pushRoute(/** @type {coccyx.Route} */(route), opt_params, opt_state);
  } else {
    throw Error('coccyx.Router: route not found: \'' + arg + '\'');
  }

};


/**
 * By default, we just redirect to the given URL and let the server
 * figure out if this is a non-dynamic page or a bad URI.
 * @param {goog.Uri} uri The uri we couldn't match.
 * @protected
 */
coccyx.Router.prototype.onRouteNotFound = function(uri) {
  var dest = uri.toString();
  this.getLogger().info('route not found, redirecting to \'' + dest + '\'');
  this.window_.location = dest;
};


/**
 * Constants for subscribable topics.
 * @enum {string}
 */
coccyx.Router.Topics = {
  ROUTE_CHANGE: 'routeChange' // receives this, coccyx.Route as parameters
};
