import assert from 'node:assert/strict';
import {createKokoroVoice} from '../dist/kokoro.mjs';
const workers=[];
globalThis.Worker=class{
  constructor(url,options){this.url=url;this.options=options;this.requests=[];workers.push(this);}
  postMessage(message){this.requests.push(message);}
  terminate(){this.terminated=true;}
};
const progress=[],voice=createKokoroVoice({onprogress:message=>progress.push(message)}),worker=workers[0];
assert.equal(worker.options.type,'module');
const audio=voice.synthesize('Welcome, Alex!'),request=worker.requests.at(-1);
worker.onmessage({data:{type:'progress',message:'Downloading Kokoro voice… 50%'}});
assert.equal(progress[0],'Downloading Kokoro voice… 50%');
worker.onmessage({data:{type:'audio',id:request.id,samples:new Float32Array([.1,.2,.3]),sampleRate:24000}});
assert.equal((await audio).sampleRate,24000);
const first=voice.synthesize('One'),second=voice.synthesize('Two');
const canceled=[assert.rejects(first,/reset/),assert.rejects(second,/reset/)];
voice.dispose();await Promise.all(canceled);assert.equal(worker.terminated,true);
await assert.rejects(voice.synthesize('No dangling requests'),/reset/);
const next=createKokoroVoice(),pending=next.synthesize('Retry');
const crashed=assert.rejects(pending,/Worker crashed/);workers[1].onerror({message:'Worker crashed'});await crashed;
console.log('PASS: worker progress, speech transfer, reset cancellation, retry, and fatal errors.');
