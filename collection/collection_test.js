goog.require('coccyx');
goog.require('coccyx.Collection');
goog.require('coccyx.Model');
goog.require('coccyx.Repo');
goog.require('goog.testing.jsunit');

var testRepo, testModel;

var testParams = [
  {
    'id': 1,
    'name': 'one'
  },
  {
    'id': 2,
    'name': 'two'
  },
  {
    'id': 3,
    'name': 'three'
  },
  {
    'id': 4,
    'name': 'four'
  },
  {
    'id': 5,
    'name': 'five'
  },
  {
    'id': 6,
    'name': 'six'
  },
  {
    'id': 7,
    'name': 'seven'
  },
  {
    'id': 8,
    'name': 'eight'
  },
  {
    'id': 9,
    'name': 'nine'
  },
  {
    'id': 10,
    'name': 'ten'
  },
  {
    'id': 100,
    'name': 'one hundred'
  }
];

var testIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100];

// This will reset the testRepo and model classes before each test
var setUp = function() {
  /**
   * @constructor
   * @param {!coccyx.Repo} repo The repository to use for this object.
   * @extends {coccyx.Model}
   */
  testModel = function(repo) {
    goog.base(this, repo);
    this.setAttributeKeys(goog.reflect.object(
        testModel, {
          id: 'id',
          name: 'name'
        }));
  };
  goog.inherits(testModel, coccyx.Model);


  /** @type {string} id. */
  testModel.prototype.id;


  /** @type {string} name. */
  testModel.prototype.name;



  /**
   * Local repo for managing settingGroups
   * @constructor
   * @extends {coccyx.Repo}
   */
  testRepo = function() {
    goog.base(this);
    this.setModelConstructor(testModel);
  };
  goog.inherits(testRepo, coccyx.Repo);
  goog.addSingletonGetter(testRepo);

};


/**
 * Contains
 */
var testBasicCollection = function() {
  var collection = testRepo.getInstance().collectionForParams(testParams);

  assertTrue('Should contain \'1\'', collection.contains('1'));
  assertTrue('Should contain \'100\'', collection.contains('100'));
  assertEquals(11, collection.getCount());
};


/**
 * Ordering
 */
var testOrdering = function() {
  var collection = testRepo.getInstance().collectionForParams(testParams);
  var order = [100, 2, 3, 6, 5, 4, 9, 7, 8, 10, 1];
  collection.setOrder(order);

  for (var i = 0; i < order.length; i++) {
    assertEquals(collection.getChildAt(i).id, order[i]);
  }
};


var testPartialOrdering = function() {
  var collection = testRepo.getInstance().collectionForParams(testParams);
  var order = [100, 5, 4, 6, 7];
  collection.setOrder(order);
  var expected = [100, 5, 4, 6, 7, 1, 2, 3, 8, 9, 10];

  for (var i = 0; i < expected.length; i++) {
    assertEquals(collection.getChildAt(i).id, expected[i]);
  }
};


/**
 * Removing
 */
var testRemoval = function() {
  var collection = testRepo.getInstance().collectionForParams(testParams);
  var expected = [1, 2, 3, 4, 5, 8, 9, 10, 100];
  collection.remove('6');
  collection.remove('7');

  for (var i = 0; i < expected.length; i++) {
    assertEquals(collection.getChildAt(i).id, expected[i]);
  }
  console.log(goog.json.serialize(collection.toJSON()));
};


