/** @module db-plumbing-rest
 *
 */
'use strict';

require('isomorphic-fetch');

const debug = require('debug')('db-plumbing-rest');
const debugResponses = require('debug')('db-plumbing-rest~response');
const { DoesNotExist } = require('db-plumbing-map');



/** Default options for HTTP operations.
 *
 * In the form of an object with attributes per the method column in table below. Each attribute
 * contains an object with attributes per the related row in the table below.
 *
 * | method     | mode | cache   |
 * |------------|------|---------|
 * | GET        | cors | default |
 * | DELETE     | cors |         |
 * | POST       | cors |         |
 * | PUT        | cors |         |
 */
const DEFAULT_OPTIONS = {
    GET: {
        method: 'GET',
        mode: 'cors',
        cache: 'default'
    },

    DELETE: {
        method: 'DELETE',
        mode: 'cors'
    },

    POST: {
        method: 'POST',
        model: 'cors'
    },

    PUT: {
        method: 'PUT',
        model: 'cors'
    }
};

/** Default headers
*
* For now, just a Content-Type of 'application/json'
*/
const DEFAULT_HEADERS = {
    'Content-Type': 'application/json'
};
    

/** Generic handler for response
*
* Checks whether the response status code is ok. Further checks to see
* that the response payload is parsable json. Throws Error if not, and also logs warnings.
*/
function checkStatus(response) {
    if (response.status == 204) {
        return true;
    }
    if (response.status == 200) {
        try {
            return response.json();
        } catch (err) {
            console.warn('ServiceClient.checkStatus - couldn\'t parse', response.text());
            throw new Error('unknown response from server');
        }
    }

    let error;
    console.warn('checkStatus', response.statusText);

    if (response.status == 404)
        error = new DoesNotExist(response.statusText);
    else 
        error = new Error(response.statusText);

    error.response = response;
    throw error;
}


function debugInline(msg) {
    return data => { debug(msg, data); return data; };
}


function debugResponse(response) {
    debugResponses('response', response); 
    return response;
}

class IndexMap {

    /** Add a mapping for a simple single-field index 
    * 
    * @param index the named index function
    * @param name the name of the field as it will be encoded in an HTTP service request
    */
    addSimpleField(index, name) {
        this[index.name] = value => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
        return this;
    }
}

/** REST document store.
 *
 * Provide remote access to a document store via a REST api (such as that provided by db-plumbing-rest-server) 
 * Other implementations (db-plumbing-mongo etc) have the same signature and should work as a drop-in replacement.
 */
class Store {

    /** Constructor.
    * 
    * The class indicate by the constructor should supprt a static fromJSON method.
    *
    * @param client {Client} http client wrapping server info and authentication data
    * @param endpoint {String} path for the data service on the remote server
    * @param type {Function} constructor (maybe base class constructor) for objects in this store
    */ 
    constructor(client, endpoint, type, index_map = new IndexMap()) {
        debug('ServiceStore - constructor', endpoint, type.name);
        this.client = client;
        this.endpoint = endpoint;
        this.type = type;
        this.index_map = index_map;
    } 

    /** Raw get operation */
    _doGet(url, resultmap) {
        let request = this.client.getGetRequest(url);
        debug('ServiceStore - GET', url);

        return fetch(request)
            .then(debugResponse)
            .then(checkStatus)
            .then(debugInline('body'))
            .then(resultmap)
            .then(debugInline('returns'));

    }

    /** Raw post operation */
    _doPost(url, object) {
        let request = this.client.getPostRequest(url,object);
        debug('_doPost', url, object);
        return fetch(request)
            .then(debugResponse)
            .then(checkStatus)
            .then(debugInline('returns'));
    }

    /** Raw put operation */
    _doPut(url, object) {
        let request = this.client.getPutRequest(url,object);
        debug('_doPut', url, object);
        return fetch(request)
            .then(debugResponse)
            .then(checkStatus)
            .then(debugInline('returns'));
    }
    
    /** Raw delete operation */
    _doDelete(url) {
        debug.log('_doDelete', url);
        return fetch(this.client.getDeleteRequest(url))
            .then(debugResponse)
            .then(checkStatus)
            .then(debugInline('returns'));
    }

    _singleResourceURI(uid) {
        return `${this.endpoint}/items/${encodeURIComponent(uid)}`;
    }
    
    _multipleResourceURI(op, index, value) {
        debug('_multipleResourceURI', index.name, this.index_map);
        return `${this.endpoint}/${op}/${index.name}?${this.index_map[index.name](value)}`;
    }

    _bulkResourceURI() {
        return `${this.endpoint}/bulk`;
    }

    /** Find an object by its unique key
    *
    * @param key Unique object identifier
    * @returns A promise, either resovled with the object stored for the given key, or rejected with a DoesNotExist error.
    */
    find(key) { 
        debug('find', key);
        return this._doGet( this._singleResourceURI(key), result => this.type.fromJSON(result))
            .then(debugInline('find - returns')); 
    }



    /** Find objects by index
    *
    * Index is, by convention, an named function (value, item) => boolean and the result of store.findAll(index,value)
    * should be equivalent to store.all.filter(item => index(value, item)). However, other implementations of store
    * may optimize this algorithm to use a better algorithm than a simple linear search. The distinct 'findAll' method
    * allows for that.
    *
    * @param index {Function} A function that takes a value and a stored object and returns true or false
    * @returns A promise of an array containing all elements for which the function returns true for the given value
    */ 
    findAll(index, value)  { 
        console.assert(typeof index === 'function', 'index must be a function');
        debug('findAll', index.name, value);
        return this._doGet(this._multipleResourceURI('findAll',index,value), 
            result => result.map(item => this.type.fromJSON(item)));
    }

    /** Update or add an object in the store.
    *
    * @param object to add or update.
    * @returns a resolved promise.
    */
    update(object) { 
        debug('update', object);
        return this._doPut(this._singleResourceURI(object.uid), object);
    }

    /** Remove an object from the store.
    *
    * @param key unique identifier of object to remove.
    * @returns a promise that resolves to true if the object is removed, false otherwise.
    */
    remove(key)  { 
        debug('remove', key);
        return this._doDelete(this._singleResourceURI(key));
    }

    /** Remove multiple objects from the store
    *
    * @param index {Function} a function that takes a value and an object from the store and returns true or false
    * @param a value that determines which objects are removed.
    */ 
    removeAll(index, value) {
        debug('removeAll', index, value);
        return this._doDelete(this._multipleResourceURI('removeAll',index, value));
    }

    /** Execute multiple update operations on the store
    *
    * @param patch { Patch.Operation } Information to update in patch format. 
    * @see [Typed Patch](https://www.npmjs.com/package/typed-patch)
    */
    bulk(patch) {
        debug('bulk', patch);
        return this._doPost(this._bulkResourceURI(), patch.toJSON());
    }
}

/** Encapsulates base URL for data source and authorization.
 *
 * e.g. 
 * ```
 * client = new Client('mysite/api', Client.getBearerAuthHeader(token));
 * store = client.getStore('users',User);
 * ```
 * 
 */
class Client {

    /** Utility function for creating bearer authoriztion Http header (e.g. for use with JWT)
    */ 
    static getBearerAuthHeader(token) {
        return { Authorizaton: 'Bearer ' + token };
    }
    
    /** Constructor
    *
    * @param base_url base URL for site data APIs
    * @param headers, including authorization, to be merged with DEFAULT_HEADERS (@see DEFAULT_HEADERS)
    * @param standard options to be merged with DEFAULT_OPTIONS (@see DEFAULT_OPTIONS) 
    */
    constructor(base_url, headers = {}, options = {}) {
        debug('ServiceClient - constructor', base_url);
        this.base_url = base_url;
        this.options = Object.assign({}, DEFAULT_OPTIONS, options);
        this.headers = Object.assign({}, DEFAULT_HEADERS, headers);
    }

    /** Update request headers
     *
     * New headers are merged with existing headers.
     *
     * @param headers to merge.
     */
    updateHeaders(headers) {
        Object.assign(this.headers, headers);
    }

    /** Get a get request
    * 
    * Create a get request using the fetch API for the specified URL relative to the base suppied in the constructor.
    * @param url {String} url to operate on
    * @returns fetch API request
    */
    getGetRequest(url) {
        return new Request(this.base_url + url, this._addHeaders(Object.assign({}, this.options.GET)));
    }

    /** Get a delete request
    * 
    * Create a delete request using the fetch API for the specified URL relative to the base suppied in the constructor.
    * @param url {String} url to operate on
    * @returns fetch API request
    */
    getDeleteRequest(url) {
        return new Request(this.base_url + url, this._addHeaders(Object.assign({}, this.options.DELETE)));
    }

    /** Get a post request
    * 
    * Create a post request using the fetch API for the specified URL relative to the base suppied in the constructor.
    * @param url {String} url to operate on
    * @param obj json request body
    * @returns fetch API request
    */
    getPostRequest(url,obj) {
        return new Request(this.base_url + url, this._addBody(this._addHeaders(Object.assign({},this.options.POST)), obj));
    }

    /** Get a put request
    * 
    * Create a put request using the fetch API for the specified URL relative to the base suppied in the constructor.
    * @param url {String} url to operate on
    * @param obj json request body
    * @returns fetch API request
    */
    getPutRequest(url,obj) {
        return new Request(this.base_url + url, this._addBody(this._addHeaders(Object.assign({},this.options.PUT)), obj));
    }

    /** Add headers to a request
    */
    _addHeaders(request) {
        request.headers = new Headers(this.headers);
        return request;
    }

    /** Add body to a request
    */
    _addBody(request, body) {
        debug('_addBody', body);
        request.body = typeof body === 'string' ? body :  JSON.stringify(body);
        return request;
    }

    /** Create a store using this client 
    *
    * @param endpoint {String} path component relative to the base url specified in the constructor.
    * @param type {Function} constructor for objects in the store. (must have fromJSON static method)
    * @param index_map {IndexMap} map indexes to request parameters
    */
    getStore(endpoint, type, index_map) {
        return new Store(this, endpoint, type, index_map);
    }
}

/** the public API of this module. */
module.exports = { Client, Store, IndexMap, DoesNotExist };

