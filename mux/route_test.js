goog.require('coccyx');
goog.require('coccyx.Route');
goog.require('coccyx.RouteRegExp');
goog.require('coccyx.Router');
goog.require('goog.Uri');
goog.require('goog.string');
goog.require('goog.testing.jsunit');


/**
 * ROUTE REGEX
 */
var testBasicUri = function() {
  var reg = new coccyx.RouteRegExp('/111/222/333');
  assertTrue('Should match /111/222/333',
             reg.match(new goog.Uri('/111/222/333')));
  assertFalse('Should not match /211/222/333',
              reg.match(new goog.Uri('/211/222/333')));
};


var testPrefix = function() {
  var reg = new coccyx.RouteRegExp('/111/', true);
  assertTrue('Should match /111/222/333',
             reg.match(new goog.Uri('/111/222/333')));
  assertFalse('Should not match /211/222/333',
              reg.match(new goog.Uri('/211/222/333')));
};

var testSimpleParam = function() {
  var reg = new coccyx.RouteRegExp('/111/222/{id}');
  assertTrue('Should match /111/222/333',
             reg.match(new goog.Uri('/111/222/333')));
  assertFalse('Should not match /111/222',
              reg.match(new goog.Uri('/111/222')));
};

var testSimpleParamAtStart = function() {
  var reg = new coccyx.RouteRegExp('/{id}/222/333');
  assertTrue('Should match /111/222/333',
             reg.match(new goog.Uri('/111/222/333')));
  assertFalse('Should not match /222/333',
              reg.match(new goog.Uri('/222/333')));
};

var testSimpleRegex = function() {
  var reg = new coccyx.RouteRegExp('/1/2/{id:[0-9]+}');
  assertTrue('Should match /1/2/3',
             reg.match(new goog.Uri('/1/2/3')));
  assertTrue('Should match /1/2/32',
             reg.match(new goog.Uri('/1/2/32')));
  assertFalse('Should not match /1/2/a',
              reg.match(new goog.Uri('/1/2/a')));
};

var testMultiVar = function() {
  var reg = new coccyx.RouteRegExp(
      '/parent/{parentId:[0-9]+}/child/{childName}');
  assertTrue('Should match /parent/2/child/bar',
             reg.match(new goog.Uri('/parent/2/child/bar')));
  assertFalse('Should not match /parent/foo/child/bar',
              reg.match(new goog.Uri('/parent/foo/child/bar')));

  var match = new coccyx.RouteMatch();
  reg.setMatch(new goog.Uri('/parent/2/child/bar'), match);
  assertEquals('2', match.params['parentId']);
  assertEquals('bar', match.params['childName']);
};

var testReverseSimple = function() {
  var reg = new coccyx.RouteRegExp('/111/222/333');
  assertEquals('/111/222/333', reg.uri());
};

var testReverseWithVar = function() {
  var reg = new coccyx.RouteRegExp('/111/222/{id}');
  assertEquals('/111/222/333', reg.uri({'id': 333}));
};

var testReverseMultiVar = function() {
  var reg = new coccyx.RouteRegExp(
      '/parent/{parentId:[0-9]+}/child/{childName}');
  assertEquals('/parent/123/child/sally',
               reg.uri({'parentId': 123, 'childName': 'sally'}));
};

var testReverseMultiVarWithInvalidId = function() {
  var reg = new coccyx.RouteRegExp(
      '/parent/{parentId:[0-9]+}/child/{childName}');
  var e = assertThrows('Should have thrown error for invalid param',
      function() {
        reg.uri({'parentId': 'foo', 'childName': 'bar'});
      });
  assertEquals(
      'coccyx.RouteRegExp: variable \'foo\' does not match,' +
          ' expected /^[0-9]+$/',
      e.message);
};


/**
 * ROUTE
 */
var testBasicUriRoute = function() {
  var route = new coccyx.Route();
  var match = new coccyx.RouteMatch();

  route.setPath('/111/222/333');
  assertTrue('Should match /111/222/333',
             route.match(new goog.Uri('/111/222/333'), match));
  assertFalse('Should not match /211/222/333',
              route.match(new goog.Uri('/211/222/333'), match));
};


var testSubRoute = function() {
  var route = new coccyx.Route();
  var match = new coccyx.RouteMatch();

  route.setPath('/111');
  var subrouter = route.newSubrouter();
  var subroute = subrouter.newRoute();
  subroute.setPath('/222');

  assertTrue('Should match /111/222',
             subroute.match(new goog.Uri('/111/222'), match));
  assertFalse('Should not match /211/222/333',
              subroute.match(new goog.Uri('/211/222'), match));
};


var testSubRouteTrimming = function() {
  var route = new coccyx.Route();
  var match = new coccyx.RouteMatch();

  route.setPath('/111/');
  var subrouter = route.newSubrouter();
  var subroute = subrouter.newRoute();
  subroute.setPath('/222');

  assertTrue('Should match /111/222',
             subroute.match(new goog.Uri('/111/222'), match));
  assertFalse('Should not match /211/222',
              subroute.match(new goog.Uri('/211/222'), match));
};


var testSubRouteNaming = function() {
  var router = new coccyx.Router();
  var match = new coccyx.RouteMatch();

  var route = router.newRoute().setPathPrefix('/111');
  var subrouter = route.newSubrouter();
  subrouter.newRoute().setPath('/').setName('foo');
  subrouter.newRoute().setPath('/222').setName('bar');

  assertTrue('Should match /111/222',
             router.match(new goog.Uri('/111/222'), match));

  match = new coccyx.RouteMatch();
  assertFalse('Should not match /211/222',
              router.match(new goog.Uri('/211/222'), match));

  match = new coccyx.RouteMatch();
  assertTrue('Should match /111/222',
             router.match(new goog.Uri('/111/222'), match));
  assertEquals('bar', match.route.name);
  assertEquals('/111/222', match.route.uri());

  match = new coccyx.RouteMatch();
  assertTrue('Should match /111/',
             router.match(new goog.Uri('/111/'), match));
  assertEquals('foo', match.route.name);
  assertEquals('/111/', match.route.uri());
};


var testDefaultParams = function() {
  var router = new coccyx.Router();
  var subrouter = router.newRoute().
      setPathPrefix('/111/{id}').
      setParams({'name': 'gary', 'id': 12}).
      newSubrouter();

  subrouter.newRoute().
      setPath('/');
  subrouter.newRoute().
      setPath('/method/{methodName}').
      setParams({'day': 12, 'methodName': 'foo'});

  var match = new coccyx.RouteMatch();
  assertTrue('Should match /111/222/',
             router.match(new goog.Uri('/111/222/'), match));
  assertEquals('gary', match.params['name']);
  assertEquals('222', match.params['id']);
  assertEquals(void 0, match.params['methodName']);
  assertEquals(void 0, match.params['day']);

  match = new coccyx.RouteMatch();
  assertTrue('Should match /111/222/method/delete',
             router.match(new goog.Uri('/111/222/method/delete'), match));
  assertEquals('gary', match.params['name']);
  assertEquals('222', match.params['id']);
  assertEquals('delete', match.params['methodName']);
  assertEquals(12, match.params['day']);
};


var testNameLookup = function() {
  var router = coccyx.getApp().getRouter();
  var route = router.newRoute();
  var match = new coccyx.RouteMatch();
  route.setPath('/111/222/333');
  route.setName('foo');
  var fooRoute = coccyx.getRoute('foo');
  assertEquals(route, fooRoute);
  assertTrue('Should match /111/222/333',
             fooRoute.match(new goog.Uri('/111/222/333'), match));
  assertFalse('Should not match /211/222/333',
              fooRoute.match(new goog.Uri('/211/222/333'), match));
};


var testTrailingSlash = function() {
  var router = new coccyx.Router();
  var route = router.newRoute().
      setPath('/foo/');

  var match = new coccyx.RouteMatch();

  assertTrue('Should match /foo/', route.match(new goog.Uri('/foo/'), match));

  match = new coccyx.RouteMatch();
  assertTrue('Should match /foo', route.match(new goog.Uri('/foo/'), match));
};


var testSubRouteTrailingSlash = function() {
  var route = new coccyx.Route();
  var match = new coccyx.RouteMatch();

  route.setPath('/111/');
  var subrouter = route.newSubrouter();
  var subroute = subrouter.newRoute();
  subroute.setPath('/222');

  assertTrue('Should match /111/222',
             subroute.match(new goog.Uri('/111/222'), match));
  assertFalse('Should not match /111222',
              subroute.match(new goog.Uri('/111222'), match));
  assertFalse('Should not match /111//222',
              subroute.match(new goog.Uri('/111//222'), match));
  assertFalse('Should not match /211/222',
              subroute.match(new goog.Uri('/211/222'), match));
};
