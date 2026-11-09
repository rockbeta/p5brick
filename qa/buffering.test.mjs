import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

class AudioContext{
  constructor(){this.state='suspended';this.destination={};this.started=[];}
  resume(){this.state='running';return Promise.resolve();}
  createGain(){return {connect(){}};}
  createBuffer(channels,length,sampleRate){return {duration:length/sampleRate,copyToChannel(samples){this.samples=samples;}};}
  createBufferSource(){const context=this;return {playbackRate:{value:1},connect(){},disconnect(){},stop(){this.stopped=true;},start(){context.started.push(this);}};}
}
const LocalNarrator=vm.runInNewContext(readFileSync(new URL('../dist/voice.js',import.meta.url),'utf8')+'\nLocalNarrator;',{window:{AudioContext}});
const audio={samples:new Float32Array([.1,-.2,.3]),sampleRate:24000};
const parts=['One','Two','Three','Four','Five','Six'];
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};

// Each deferred response stands for synthesis taking longer than one part plays.
const requests=[],progress=[],narrator=new LocalNarrator();
narrator.ready=Promise.resolve({synthesize(text){narrator.progress('Preparing the course…','generating');return new Promise(resolve=>requests.push({text,resolve}));}});
const playback=narrator.play(parts[0],{prepare:parts,onprogress:message=>progress.push(message)});
assert.equal(narrator.context.state,'running','Play must still unlock audio in the user gesture');
for(let i=0;i<parts.length;i++){
  await flush();assert.equal(requests.length,i+1,'Preparation must queue only one part at a time');
  assert.equal(requests[i].text,parts[i]);
  assert.equal(progress.at(-1),`Preparing the course… ${i} of 6 parts ready`,'Progress must remain visible while the next part generates');
  assert.equal(narrator.context.started.length,0,'Playback must wait until all six parts are ready');
  requests[i].resolve(audio);
}
assert.equal(await playback,true);
assert.equal(narrator.context.started.length,1);
assert.match(progress.at(-1),/6 of 6 parts ready/);
for(let i=1;i<parts.length;i++)await narrator.play(parts[i],{prepare:parts.slice(i)});
await narrator.play(parts[0],{prepare:parts});
assert.equal(requests.length,6,'Every later part and replay must use the prepared audio without generating more speech');
narrator.stop();

// Pausing during preparation must not leave five obsolete jobs ahead of a new lesson.
let finishFirst;const canceledCalls=[],canceled=new LocalNarrator();
canceled.ready=Promise.resolve({synthesize(text){canceledCalls.push(text);return text==='One'?new Promise(resolve=>finishFirst=resolve):Promise.resolve(audio);}});
const pending=canceled.play('One',{prepare:parts});await flush();canceled.stop();finishFirst(audio);
assert.equal(await pending,false);assert.deepEqual(canceledCalls,['One']);
assert.equal(canceled.context.started.length,0);
assert.equal(await canceled.play('One',{prepare:parts}),true);
assert.deepEqual(canceledCalls,parts,'Resume must reuse the completed first part and prepare the rest');
canceled.stop();

const stale=new LocalNarrator();let finishOld;
stale.ready=Promise.resolve({synthesize(text){return text==='Old opening'?new Promise(resolve=>finishOld=resolve):Promise.resolve(audio);}});
const old=stale.play('Old opening',{prepare:['Old opening','Old second']});await flush();
assert.equal(await stale.play('New opening',{prepare:['New opening','New second']}),true);
const newSource=stale.source;finishOld(audio);
assert.equal(await old,false);assert.equal(stale.source,newSource,'Old preparation must not interrupt the new lesson');
stale.stop();

// Reusing a partly cached lesson must keep all its parts when old entries are evicted.
const cachedCalls=[],cached=new LocalNarrator(),voice={synthesize(text){cachedCalls.push(text);return Promise.resolve(audio);}};
cached.ready=Promise.resolve(voice);
for(const text of ['One','Two',...Array.from({length:10},(_,i)=>`Old ${i}`)])await cached.render(voice,text);
await cached.play('One',{prepare:parts});const preparedCalls=cachedCalls.length;
for(const text of parts)await cached.play(text,{prepare:parts.slice(parts.indexOf(text))});
assert.equal(cachedCalls.length,preparedCalls,'Cache eviction must retain the entire active lesson');
cached.stop();

let disposed=false;const broken=new LocalNarrator();
broken.ready=Promise.resolve({synthesize(text){return text==='Three'?Promise.reject(new Error('Preparation failed')):Promise.resolve(audio);},dispose(){disposed=true;}});
await assert.rejects(broken.play('One',{prepare:parts}),/Preparation failed/);
assert.equal(broken.context.started.length,0,'Failed preparation must never start a partial lesson');
assert.equal(broken.ready,null);assert.equal(disposed,true);
console.log('PASS: full-lesson buffering, sequential preparation, progress, cached transitions/replay, cancellation/resume, chapter changes, cache pressure, and preparation failure.');
