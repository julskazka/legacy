// Integration test: simulated D1; never touches the production database.
import assert from 'node:assert/strict';

const {default: worker}=await import(process.env.VOTING_WORKER_MODULE);
const base='https://nasledie-voting.gogina-jul.workers.dev';
const votes=new Map();
const db={prepare(sql){
  let args=[];
  return {
    bind(...values){args=values;return this},
    async run(){
      if(sql.startsWith('INSERT INTO votes'))votes.set(args[0],args[1]);
      return {success:true};
    },
    async all(){
      const totals=new Map();
      for(const n of votes.values())totals.set(n,(totals.get(n)||0)+1);
      return {results:[...totals].map(([nominee_id,count])=>({nominee_id,count}))};
    },
    async first(){
      if(sql.startsWith('SELECT COUNT'))return {n:votes.size};
      if(sql.startsWith('SELECT nominee_id FROM votes')){
        return votes.has(args[0])?{nominee_id:votes.get(args[0])}:null;
      }
      return null;
    }
  };
}};
const env={DB:db};
const req=(path,options)=>new Request(base+path,options);
let r=await worker.fetch(req('/api/health'),env);
assert.equal(r.status,200);
assert.equal((await r.json()).version,'2026-11-15-embedded-transport');
r=await worker.fetch(req('/api/vote',{method:'POST',headers:{Origin:'null','Content-Type':'text/plain'},body:JSON.stringify({userId:'tg:12345',nomineeId:1})}),env);
assert.equal(r.status,200);
assert.equal((await r.json()).selected,1);
r=await worker.fetch(req('/api/vote',{method:'POST',headers:{Origin:'null','Content-Type':'text/plain'},body:JSON.stringify({userId:'tg:12345',nomineeId:2})}),env);
assert.equal((await r.json()).selected,2);
assert.equal(votes.size,1,'re-vote must replace the previous vote');

const cb='window.__nasledie_nv_test_1';
r=await worker.fetch(req('/api/votes.js?userId=tg%3A12345&callback='+cb),env);
assert.equal(r.status,200);
assert.ok((await r.text()).startsWith(cb+'('));
const form=new URLSearchParams({userId:'tg:12345',nomineeId:'3',requestId:'nv_test_2'});
r=await worker.fetch(req('/api/vote-form',{method:'POST',headers:{Origin:'null'},body:form}),env);
assert.equal(r.status,200);
const html=await r.text();
assert.ok(html.includes('</script>'),'form response must contain a valid closing script');
assert.ok(html.includes('"selected":3'));
assert.equal(votes.size,1);

console.log('PASS: D1 health, save, readback and revote replacement.');
