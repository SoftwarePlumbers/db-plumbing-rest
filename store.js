/** @module db-plumbing-map
 *
 */
'use strict';

const debug = require('debug')('db-plumbing-map');

/** Default comparison operation.
 *
 * @param key {Function{} function that extracts a key value (number or string) from a stored object
 * @param a First object
 * @param b Second object
 * @returns -1, 1, 0 depending on whether a < b, b < a, or a == b
 *
 */
function defaultComparator(key, a, b) {
    if (key(a) < key(b)) return -1;
    if (key(a) > key(b)) return 1;
    return 0;
}

/** Utility function used to inject log operations into promise chain
 *
 * @param e value to log
 * @returns e
 */
function logValue(e) {
    debug('lv',e);
    return e[1];
}

/** Error type (used when find() cannot return)
*
*/
class DoesNotExist extends Error {

    /** Constructor
    *
    * @param key key for which an item cannot be found
    */
    constructor(key) { super(`${key} does not exist`); this.key = key; }
}

/** In-memory document store.
 *
 * Essentially just some utility functions wrapping an ES6 Map. Other implementations (db-plumbing-mongo etc) have the
 * same signature and should work as a drop-in replacement.
 */
class Store {

    static get DoesNotExist() { return DoesNotExist; }

    /** Constructor.
    * 
    * Only the first parameter is mandatory. Default behavior is to look for an attribute uid in the object to 
    * use as the unique key, and assume uid can be compared with standard comparison operations (basically it must
    * be a string or a number).
    *
    *
    * @param type {Function} a constructor (perhaps a base class constructor) for elements in this store.
    * @param key {Function} a function that extracts a unique key from objects in this store
    * @param comparator {Function} a function that compares two objects in this store
    */ 
    constructor(type, key = e=>e.uid, comparator = (a,b) => defaultComparator(key,a,b)) {
        this.idMap = new Map();
        this.key = key;
        this.comparator = comparator;
        this.sorted = true;
        this.type = type;
    }

    /** Find an object by its unique key
    *
    * @param key Unique object identifier
    * @returns A promise, either resovled with the object stored for the given key, or rejected with a DoesNotExist error.
    */
    find(key) { 
        debug('find', key);
        let val = this.idMap.get(key);
        return val === undefined ? Promise.reject(new DoesNotExist(key)) : Promise.resolve(val);
    }

    /** Get all objects in the store
    *
    * @returns a promise resovled with an array contianing all values in the store
    */
    get all() {
        debug('all');
        return Promise.resolve(Array.from(this.idMap.values()));
    }

    /** Find objects by index
    *
    * Index is, by convention, an named function (value, item) => boolean and the result of store.findAll(index,value)
    * should be equivalent to store.all().filter(item => index(value, item)). However, other implementations of store
    * may optimize this algorithm to use a better algorithm than a simple linear search. The distinct 'findAll' method
    * allows for that.
    *
    * @param index {Function} A function that takes a value and a stored object and returns true or false
    * @returns A promise of an array containing all elements for which the function returns true for the given value
    */ 
    findAll(index, value)  { 
        debug('findAll', index, value);
        return this.all.then(all => all.filter(item => index(value, item))); 
    }

    /** Update or add an object in the store.
    *
    * @param object to add or update.
    * @returns a resolved promise.
    */
    update(object) { 
        debug('Update',object);
        if (!this.idMap.has(object.uid)) this.sorted = false;
        this.idMap.set(object.uid, object); 
        return Promise.resolve(true);
    }

    /** Remove an object from the store.
    *
    * @param key unique identifier of object to remove.
    * @returns a promise that resolves to true if the object is removed, false otherwise.
    */
    remove(key)  { 
        if (! this.idMap.get(key) === undefined) {
            this.idMap.delete(key);
            return Promise.resolve(true);
        }
        return Promise.resolve(false);
    }

    /** Remove multiple objects from the store
    *
    * @param index {Function} a function that takes a value and an object from the store and returns true or false
    * @param a value that determines which objects are removed.
    */ 
    removeAll(index, value) {
        return this.findAll(index,value)
            .then(items => { 
                if (items.length === 0) 
                    return false;
                else {
                    for (let item in items) this.idMap.delete(item.uid);
                    return true;
                }
            });
    }

    /** Execute multiple update operations on the store
    *
    * @param patch { Patch.Operation } Information to update in patch format. 
    * @see [Typed Patch](https://www.npmjs.com/package/typed-patch)
    */
    bulk(patch) {
        debug('bulk', patch);
        debug('bulk - this.sorted', this.sorted);
        debug('bulk - before', this.idMap);
        this.idMap = patch.patch(this.idMap, { value: logValue, collectionElementType: this.type, sorted: this.sorted });
        this.sorted = true;
        debug('bulk - after', this.idMap);

        return Promise.resolve(patch.data.length);
    }
}

/** the public API of this module. */
module.exports = Store;

