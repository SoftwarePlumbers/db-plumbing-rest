# ![Software Plumbers](http://docs.softwareplumbers.com/common/img/SquareIdent-160.png) DB Plumbing (REST)

REST document store

## Tl;DR

```javascript
let store = new Store('https://mystore.softwareplumbers.net/objects', Object, object=>object.key);

store.update({ key: 1, a: "hello", b: "sailor"});

value=store.find(1);
```

and value should be `{key:1, a:"hello", b:"sailor"}`

The store supports remove, find by criteria, and remove by criteria operations. It also supports a bulked update operation based on the [typed-patch](https://npmjs.org/packages/typed-patch) library.

db-plumbing-rest provides a simple client to services provided by db-plumbing-rest-server. db-plumbing-rest-server exposes services provided by db-plubming-mongo or db-plumbing-map. (Other back-end modules are planned).

For the latest API documentation see [The Software Plumbers Site](http://docs.softwareplumbers.com/db-plumbing-rest/master)
