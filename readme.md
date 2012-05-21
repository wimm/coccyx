Coccyx.js
=========

Coccyx is a library inspired by [backbone.js](http://documentcloud.github.com/backbone/docs/backbone.html) and [spine.js](http://spinejs.com/) designed to work with the Closure Library and the Closure Compiler.

Attributes
-------------

* Compatible with the Closure Compiler in "advanced" mode without relying on an externs file.
* A model+repository persistence metaphor with pluggable repository back ends for local or remote persistence.
* Easy model JSON serialization/deserialization to compiler-renamed member properties via `goog.object.reflect` (also used for key-based property pubsub).
* An HTML5 History-based routing framework using a parser ported from the [Gorilla mux package](http://gorilla-web.appspot.com/pkg/gorilla/mux/) that provides sophisticated route parsing as well as route reversing (generation) and also allows routing across modules.
* A collection class with fast key-based access, ordering and a number of convenient functional-style methods like map, reduce and find.
* Extensive use of `goog.async.Deferred` for asynchronous callback handling and chaining, including routing and all persistence operations.
* A publish/subscribe mechanism for observing/binding model, model attribute and collection changes based on `goog.pubsub` to avoid the overhead of a DOM event system.


Status
------
The Coccyx project is in use in production, but should still be considered an Alpha release. The API is still in flux and a number of bugs are still outstanding with more undoubtedly lurking.


License
-------
Coccyx is provided under a BSD-style license. See `coccyxlicense.txt`. The route parsing and reversing portions are ported from [Gorilla](http://gorilla-web.appspot.com/pkg/gorilla/mux/), see `/router/gorillalicense.txt`.