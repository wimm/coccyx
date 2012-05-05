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
 * @type {coccyx.RouteMatch} A RouteMatch object containing the currently
 *     matched route and the currently matched params, used for determining
 *     if we're already on this route without relying on the ordering of
 *     query parameters.
 */
coccyx.Router.prototype.currentMatch = null;


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

  // Ignore non-supported browsers and iOS prior to v5
  // regex from pjax (https://github.com/defunkt/jquery-pjax)
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
  var uri = new goog.Uri(this.window_.location.href);
  var match = new coccyx.RouteMatch();
  if (this.match(uri, match)) {
    this.execMatch(match);
  }
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
  var matched = this.match(uri, match);
  if (matched) {
    if (this.currentMatch && this.currentMatch.equals(match)) {
      this.getLogger().info('already on \'' + match.route.name + '\'');
    } else {
      this.getLogger().info('routing back to \'' + match.route.name + '\'');
      this.execMatch(match, e.state, true);
      this.currentUri = uri;
    }
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
 * @param {coccyx.RouteMatch} match The RouteMatch object to execute.
 * @param {*=} opt_state The optional state that was passed in.
 * @param {boolean=} opt_suppressPush Whether to keep from pushing this route
 *     onto the history stack.
 * @protected
 */
coccyx.Router.prototype.execMatch = function(
    match, opt_state, opt_suppressPush) {
  var route = match.route;
  var params = match.params;
  if (route.isBuildOnly()) {
    this.onRouteNotFound(route.uri(params));
  } else {
    if (this.currentMatch && this.currentMatch.equals(match)) {
      this.getLogger().info('already on route: ' + route.uri(params));
    } else {
      this.currentMatch = match;
      this.getLogger().info('routing to \'' + route.name + '\'');

      this.window_.setTimeout(goog.bind(function() {
        route.getHandler()(params, opt_state);
        route.publish(coccyx.Route.Topics.MATCH, route, params);
        this.publish(coccyx.Router.Topics.ROUTE_CHANGE, this, route, params);
      }, this), 0);

      if (!opt_suppressPush && this.enabled_) {
        var uri = route.uri(params);
        this.getLogger().info('pushing uri \'' + uri + '\'');
        this.window_.history.pushState(opt_state || null, null, uri);
      }
    }
  }
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
    this.execMatch(match);
  } else if (arg !== this.window_.location.href) {
    this.onRouteNotFound(uri);
  }
};


/**
 * @param {coccyx.Route|string} arg The route or name of the desired route.
 * @param {coccyx.Model|Object.<string,*>=} opt_paramArg The optional key/value
 *     map of params or a model to pull params off of.
 * @param {*=} opt_state The optional state that was placed on the stack.
 */
coccyx.Router.prototype.goToRoute = function(arg, opt_paramArg, opt_state) {
  var route = null;
  if (goog.typeOf(arg) === 'string') {
    route = this.get(/** @type {string} */(arg));
  } else if (goog.typeOf(arg) === 'object') {
    route = /** @type {coccyx.Route} */ (arg);
  }

  var params;
  params = /** @type {Object.<string,string>} */({});
  if (opt_paramArg) {
    var val;
    var paramNames = route.getRegExp().paramNames;
    // If we've been given a model, we need to grab the values off it, but even
    // if we've been given a params array, we need to convert the params to
    // strings so that the currentMatch.equals params comparison will work.
    for (var i = 0; i < paramNames.length; i++) {
      val = (opt_paramArg instanceof coccyx.Model) ?
          opt_paramArg.get(paramNames[i]) :
          opt_paramArg[paramNames[i]];
      if (val !== void 0) {
        params[paramNames[i]] = val.toString();
      }
    }
  }

  if (route) {
    //add any default params that haven't been parsed
    if (route.getParams()) {
      goog.object.forEach(route.getParams(), function(param, key) {
        goog.object.setIfUndefined(params, key, param);
      }, this);
    }
    var match = new coccyx.RouteMatch();
    match.route = route;
    match.params = params;
    match.handler = route.getHandler();
    this.execMatch(match);
  } else {
    this.getLogger().severe('route not found: \'' + arg + '\'');
  }

};


/**
 * By default, we just redirect to the given URL and let the server
 * figure out if this is a non-dynamic page or a bad URI.
 * @param {goog.Uri|string} uri The uri we couldn't match.
 * @protected
 */
coccyx.Router.prototype.onRouteNotFound = function(uri) {
  var dest = goog.isString(uri) ? uri : uri.toString();
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
