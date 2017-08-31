
const { Client, Store, IndexMap, DoesNotExist } = require( '../store');
const Patch = require('typed-patch');
const { app, start, stop, TestObject, byA } = require('db-plumbing-rest-server/test/server');
const chai = require('chai')
const expect = chai.expect;
const debug = require('debug')('db-plumbing-rest~tests');
const Ops = Patch.Operations;

const INDEX_MAP = new IndexMap().addSimpleField(byA, 'a');

const client = new Client('http://127.0.0.1:8666');

function withDebug(a) { debug(a); return a; }

describe('Store', () => {

    before(function() {
        return start();
    });

    after(function() {
        return stop();
    });

        it('creates and retrieves test object in store', (done) => {
            let store = client.getStore("",TestObject,INDEX_MAP);
            store.update(new TestObject(1,'hello','world'))
                .then(() => store.find(1))
                .then(result=> {
                        expect(result.a).to.equal('hello');
                        expect(result.b).to.equal('world');
                    })
                .then(()=>done(), done);
            
        });

        it('creates multiple objects in store and finds by index', (done) => {

            let store = client.getStore("",TestObject,INDEX_MAP);
            store.update(new TestObject(1,'hello','world'))
                .then(() => store.update(new TestObject(2, 'hello','friend')))
                .then(() => store.update(new TestObject(3, 'goodbye', 'Mr. Chips')))
                .then(() => store.findAll(byA, 'hello'))
                .then(result=> {
                        expect(result).to.have.length(2);
                        expect(result[0].b).to.equal('world');
                        expect(result[1].b).to.equal('friend');
                    })
                .then(()=>done(), done);
          });

        it('Find item that does not exist throws Store.DoesNotExist', (done) => {

            let store = client.getStore("",TestObject,INDEX_MAP);
            store.update(new TestObject(1,'hello','world'))
                .then( () => store.find(69))
                .then( () => { throw new Error('call should not succeed') } )
                .then( null, err => expect(withDebug(err)).to.be.instanceof(DoesNotExist) )
                .then( () => done(), done );
            }
        );

        it('can do bulk update in store', (done) => {

            let store = client.getStore("",TestObject,INDEX_MAP);
            store.update(new TestObject(1,'hello','world'))
                .then(() => store.update(new TestObject(2, 'hello','friend')))
                .then(() => store.update(new TestObject(3, 'goodbye', 'Mr. Chips')))
                .then(() => store.bulk(new Ops.Map([ [1, new Ops.Mrg( { b: new Ops.Rpl('pizza') } ) ]])))
                .then(() => store.find(1))
                .then(withDebug)
                .then(result=> {
                        expect(result.b).to.equal('pizza');
                    })
                .then(()=>done(), done);
            }
        );
    }
);
