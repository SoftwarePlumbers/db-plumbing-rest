
const Store = require( '../store');
const Patch = require('typed-patch');
const expect = require('chai').expect;
const debug = require('debug')('db-plumbing-map~tests');
const Ops = Patch.Operations;

const PATCH_OPTS = { map:true, key: e=>e.uid, value: e=>e, entry: (k,v)=>v }

function withDebug(a) { debug(a); return a; }

class Simple { 
    constructor(uid, a, b) { this.uid = uid; this.a=a; this.b=b; } 
    static fromJSON({uid,a,b}) { return new Simple(uid,a,b); }
}

function byA(a, simple) { return simple.a == a; }

describe('Store', () => {

        it('creates and retrieves test object in store', (done) => {
            let store = new Store(Simple, o=>o.uid);
            store.update(new Simple(1,'hello','world'))
                .then(() => store.find(1))
                .then(withDebug)
                .then(result=> {
                        expect(result.a).to.equal('hello');
                        expect(result.b).to.equal('world');
                    })
                .then(()=>done(), done);
            
        });

        it('creates multiple objects in store and finds by index', (done) => {

            let store = new Store(Simple, o=>o.uid);
            store.update(new Simple(1,'hello','world'))
                .then(() => store.update(new Simple(2, 'hello','friend')))
                .then(() => store.update(new Simple(3, 'goodbye', 'Mr. Chips')))
                .then(() => store.findAll(byA, 'hello'))
                .then(result=> {
                        expect(result).to.have.length(2);
                        expect(result[0].b).to.equal('world');
                        expect(result[1].b).to.equal('friend');
                    })
                .then(()=>done(), done);
          });

        it('Find item that does not exist throws Store.DoesNotExist', (done) => {

            let store = new Store(Simple, o=>o.uid);
            store.update(new Simple(1,'hello','world'))
                .then( () => store.find(2))
                .then( () => chai.fail('call should not succeed') )
                .then( null, err => expect(err).to.be.instanceof(Store.DoesNotExist) )
                .then( () => done(), done );
            }
        );

        it('can do bulk update in store', (done) => {

            let store = new Store(Simple, o=>o.uid);
            store.update(new Simple(1,'hello','world'))
                .then(() => store.update(new Simple(2, 'hello','friend')))
                .then(() => store.update(new Simple(3, 'goodbye', 'Mr. Chips')))
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
