import assert from 'node:assert/strict';
import {createKokoroVoice} from '../dist/kokoro.mjs';
let now=0,serial=0;
const timers=new Map(),originalSetTimeout=globalThis.setTimeout,originalClearTimeout=globalThis.clearTimeout;
globalThis.setTimeout=(fn,delay)=>{const id=++serial;timers.set(id,{fn,at:now+delay});return id;};
globalThis.clearTimeout=id=>timers.delete(id);
function advance(ms){now+=ms;for(const [id,timer] of [...timers])if(timer.at<=now){timers.delete(id);timer.fn();}}
const workers=[];
globalThis.Worker=class{
  constructor(url,options){this.url=url;this.options=options;this.requests=[];workers.push(this);}
  postMessage(message){this.requests.push(message);}
  terminate(){this.terminated=true;}
};
const progress=[],voice=createKokoroVoice({onprogress:message=>progress.push(message)}),worker=workers[0];
assert.equal(worker.options.type,'module');
const audio=voice.synthesize('Welcome, Alex!'),request=worker.requests.at(-1);
worker.onmessage({data:{type:'progress',message:'Preparing the course… 50%'}});
assert.equal(progress[0],'Preparing the course… 50%');
worker.onmessage({data:{type:'audio',id:request.id,samples:new Float32Array([.1,.2,.3]),sampleRate:24000}});
assert.equal((await audio).sampleRate,24000);
const first=voice.synthesize('One'),second=voice.synthesize('Two');
const canceled=[assert.rejects(first,/reset/),assert.rejects(second,/reset/)];
voice.dispose();await Promise.all(canceled);assert.equal(worker.terminated,true);
await assert.rejects(voice.synthesize('No dangling requests'),/reset/);
const next=createKokoroVoice(),pending=next.synthesize('Retry');
const crashed=assert.rejects(pending,/Worker crashed/);workers[1].onerror({message:'Worker crashed'});await crashed;
assert.equal(workers[1].terminated,true,'A crashed worker must be terminated');
const stuck=createKokoroVoice(),stuckWorker=workers.at(-1);
const stuckFirst=stuck.synthesize('First'),stuckSecond=stuck.synthesize('Prefetched');
const timedOut=[assert.rejects(stuckFirst,{code:'VOICE_TIMEOUT'}),assert.rejects(stuckSecond,{code:'VOICE_TIMEOUT'})];
stuckWorker.onmessage({data:{type:'progress',stage:'generating',message:'Preparing the course…'}});
advance(59999);assert.notEqual(stuckWorker.terminated,true);
advance(2);await Promise.all(timedOut);
assert.equal(stuckWorker.terminated,true,'A stuck WASM job must be terminated from the page');
await assert.rejects(stuck.synthesize('No requests on a dead worker'),{code:'VOICE_TIMEOUT'});
const retry=createKokoroVoice(),retried=retry.synthesize('Fresh retry'),retryWorker=workers.at(-1);
retryWorker.onmessage({data:{type:'audio',id:retryWorker.requests[0].id,samples:new Float32Array([.1]),sampleRate:24000}});
assert.equal((await retried).sampleRate,24000,'A fresh worker must be able to synthesize after a timeout');
advance(180001);assert.notEqual(retryWorker.terminated,true,'Finished speech must clear the watchdog');
retry.dispose();
const downloading=createKokoroVoice(),download=downloading.synthesize('Slow download'),downloadWorker=workers.at(-1);
const expired=assert.rejects(download,{code:'VOICE_TIMEOUT'});
advance(170000);
downloadWorker.onmessage({data:{type:'progress',stage:'loading',message:'Preparing the course… 90%'}});
advance(179999);assert.notEqual(downloadWorker.terminated,true,'Active download progress must renew the loading timeout');
advance(2);await expired;assert.equal(downloadWorker.terminated,true);
assert.equal(timers.size,0,'Worker disposal must leave no pending watchdogs');
globalThis.setTimeout=originalSetTimeout;globalThis.clearTimeout=originalClearTimeout;
console.log('PASS: worker progress, speech transfer, cancellation, fatal errors, synthesis/download timeouts, and fresh-worker retry.');
