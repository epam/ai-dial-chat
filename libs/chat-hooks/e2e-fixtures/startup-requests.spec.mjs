import assert from 'node:assert/strict';
import test from 'node:test';
import {collectStartupResponses} from './startup-requests.mjs';
test('late response from an early dynamic request retains its startup cost',async()=>{
  let finish;
  const delayed=new Promise(resolve=>{finish=resolve;});
  const request=(startedAt,response)=>({response:()=>response,timing:()=>({startTime:startedAt}),url:()=>'/feature.js'});
  const result=collectStartupResponses([request(10,delayed),request(30,Promise.resolve('after-marker'))],20);
  finish('early-dynamic');
  assert.deepEqual(await result,['early-dynamic']);
});
test('failed requests cannot become zero-byte success',async()=>{
  await assert.rejects(collectStartupResponses([{response:async()=>null,url:()=>'/failed.js'}],20),/failed/);
});
