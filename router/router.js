goog.provide('coccyx.Router');


goog.require('coccyx.Route');
goog.require('goog.Uri');
goog.require('goog.debug.Logger');
goog.require('goog.pubsub.PubSub');
goog.require('goog.userAgent');

// Portions copyright 2012 The Gorilla Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the gorillalicense.txt file.



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
 * @return {coccyx.Route} The route or null.
 */
coccyx.Router.prototype.get = function(arg) {
  if (goog.typeOf(arg) === 'string') {
    var route = this.getNamedRoutes()[/** @type {string} */(arg)];
    if (!route) {
      this.getLogger().severe('Could not find route with name: ' + arg);
      return null;
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
  this.enabled_ = !!(this.getWindow().history &&
      this.getWindow().history.pushState &&
      window.history.replaceState && !navigator.userAgent.match(
          /((iPod|iPhone|iPad).+\bOS\s+[1-4]|WebApps\/.+CFNetwork)/));

  // Can't detect via capabilities any longer, so we have to check against
  // webkit.
  this.statePopped_ = !goog.userAgent.WEBKIT;

  this.initialUri_ = this.getWindow().location.href;

  if (this.enabled_) {
    goog.events.listen(this.getWindow(), goog.events.EventType.POPSTATE,
                       this.onPopState, false, this);

    goog.events.listen(this.getWindow(), goog.events.EventType.CLICK,
                       this.onClick, false, this);
  }

  // NOTE: the matching handler will be executed via setTimeout, not right now.
  var uri = new goog.Uri(this.getWindow().location.href);
  var match = new coccyx.RouteMatch();
  if (this.match(uri, match)) {

    // If we have a match-only route, we don't want to execute it, since that
    // will send us back to this page, just publish the match events.
    if (match.route.isMatchOnly()) {
      this.getWindow().setTimeout(goog.bind(function() {
        match.route.publish(
            coccyx.Route.Topics.MATCH, match.route, match.params);
        this.publish(
            coccyx.Router.Topics.ROUTE_CHANGE, this, match.route, match.params);
      }, this), 0);
    } else {
      this.execMatch(match);
    }
  }
};


/**
 * @param {goog.events.BrowserEvent} e The browser event object.
 * @protected
 */
coccyx.Router.prototype.onPopState = function(e) {
  //ignore initial popstate from browsers we think will fire it.
  if (!this.statePopped_ &&
      this.getWindow().location.href == this.initialUri_) {
    this.getLogger().info('ignoring what we believe to be the initial pop');
    this.statePopped_ = true;
    return;
  }
  //get the matching route from window.location
  var uri = new goog.Uri(this.getWindow().location.href);
  var match = new coccyx.RouteMatch();
  var matched = this.match(uri, match);
  if (matched) {
    if (this.currentMatch && this.currentMatch.equals(match)) {
      this.getLogger().info('already on \'' + match.route.getName() + '\'');
    } else {
      this.getLogger().info(
          'routing back to \'' + match.route.getName() + '\'');
      this.execMatch(match, e.state, true);
      this.currentUri = uri;
    }
  } else {
    this.getLogger().info('no route matches \'' +
                          this.getWindow().location.href + '\'');
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
 * @param {boolean=} opt_suppressHistory Whether to suppress push or replace
 *     history state calls.
 * @param {boolean=} opt_replaceState Whether to replace the current state
 *     instead of pushing the new state.
 * @return {goog.async.Deferred} A deferred representing execution result of the
 *     route handler. May also include the process of loading a module.
 * @protected
 */
coccyx.Router.prototype.execMatch = function(
    match, opt_state, opt_suppressHistory, opt_replaceState) {
  var route = match.route;
  var params = match.params;
  if (route.isBuildOnly()) {
    return this.onRouteNotFound(route.uri(params));
  } else {
    if (this.currentMatch && this.currentMatch.equals(match)) {
      this.getLogger().info('already on route: ' + route.uri(params));
      // the current, already succeeded deferred will be returned
    } else if (route.isMatchOnly()) {
      this.getLogger().info('route is match only, setting location');
      this.getWindow().location = match.route.uri(params);
      this.currentMatch.result = goog.async.Deferred.cancelled();
    } else {
      this.currentMatch = match;
      this.getLogger().info('routing to \'' + route.getName() + '\'');

      if (this.enabled_) {
        var uri = route.uri(params);
        if (!!opt_suppressHistory) {
          this.getLogger().info('suppressing \'' + uri + '\'');
        } else if (!!opt_replaceState) {
          this.getLogger().info('replacing with uri \'' + uri + '\'');
          this.getWindow().history.replaceState(opt_state || null, '', uri);
        } else {
          this.getLogger().info('pushing uri \'' + uri + '\'');
          this.getWindow().history.pushState(opt_state || null, '', uri);
        }
      }

      // We want to call the matching here so the nav expands immediately.
      // It's entirely possible this could cause issues for other people,
      // however, so we may need to do this in a branch off the deferred
      // instead.
      route.publish(coccyx.Route.Topics.MATCH, route, params);
      this.publish(coccyx.Router.Topics.ROUTE_CHANGE, this, route, params);

      var deferred;
      if (route.getHandler() == null) {
        deferred = goog.module.ModuleManager.getInstance().load(
            route.getModule());
        deferred.addCallback(function() {
          return route.getHandler()(params, opt_state);
        }, this);
      } else {
        var handler = route.getHandler();
        var result = handler(params, opt_state);
        if (result instanceof goog.async.Deferred) {
          deferred = result;
        } else {
          deferred = goog.async.Deferred.succeed(result);
        }
      }

      this.currentMatch.result = deferred;
    }
    return this.currentMatch.result;
  }
};


/**
 * Takes a uri argument as a string or Uri object and either execs the matching
 * route, if it exists and routing is enabled, or sets the window location to
 * the new uri.
 * @param {goog.Uri|string} arg The goog.Uri or string uri to go to.
 * @param {boolean=} opt_suppressHistory Whether to suppress push or replace
 *     history state calls.
 * @param {boolean=} opt_replaceState Whether to replace the current state
 *     instead of pushing the new state.
 * @return {goog.async.Deferred} A deferred representing execution result of the
 *     route handler. May also include the process of loading a module.
 */
coccyx.Router.prototype.goToUri = function(
    arg, opt_suppressHistory, opt_replaceState) {
  var uri = new goog.Uri(arg);
  var loc = new goog.Uri(this.getWindow().location);
  var match = new coccyx.RouteMatch();
  var deferred;
  if (this.enabled_ && loc.hasSameDomainAs(uri) && this.match(uri, match)) {
    deferred = this.execMatch(
        match, void 0, opt_suppressHistory, opt_replaceState);
  } else if (arg !== this.getWindow().location.href) {
    deferred = this.onRouteNotFound(uri);
  } else {
    deferred = goog.async.Deferred.cancelled();
  }
  return deferred;
};


/**
 * @param {coccyx.Route|string} arg The route or name of the desired route.
 * @param {coccyx.Model|Object.<string,*>=} opt_paramArg The optional key/value
 *     map of params or a model to pull params off of.
 * @param {*=} opt_state The optional state that was placed on the stack.
 * @param {boolean=} opt_suppressHistory Whether to suppress push or replace
 *     history state calls.
 * @param {boolean=} opt_replaceState Whether to replace the current state
 *     instead of pushing the new state.
 * @return {goog.async.Deferred} A deferred representing execution result of the
 *     route handler. May also include the process of loading a module.
 */
coccyx.Router.prototype.goToRoute = function(arg, opt_paramArg, opt_state,
    opt_suppressHistory, opt_replaceState) {
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

  var deferred;
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
    deferred = this.execMatch(
        match, void 0, opt_suppressHistory, opt_replaceState);
  } else {
    this.getLogger().severe('route not found: \'' + arg + '\'');
    deferred = goog.async.Deferred.cancelled();
  }
  return deferred;
};


/**
 * By default, we just redirect to the given URL and let the server
 * figure out if this is a non-dynamic page or a bad URI.
 * @param {goog.Uri|string} uri The uri we couldn't match.
 * @return {goog.async.Deferred} A cancelled deferred.
 * @protected
 */
coccyx.Router.prototype.onRouteNotFound = function(uri) {
  var dest = goog.isString(uri) ? uri : uri.toString();
  this.getLogger().info('route not found, redirecting to \'' + dest + '\'');
  this.getWindow().location = dest;
  return goog.async.Deferred.cancelled();
};


/**
 * @return {!Window} The window we're installed in. FIXME: probably doesn't
 *     work, this is a placeholder for future multi-window functionality.
 */
coccyx.Router.prototype.getWindow = function() {
  return this.window_ || (this.parent && this.parent.getWindow()) || window;
};


/**
 * Constants for subscribable topics.
 * @enum {string}
 */
coccyx.Router.Topics = {
  ROUTE_CHANGE: 'routeChange' // receives this, coccyx.Route as parameters
};
