import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync(new URL('../dist/voice.js',import.meta.url),'utf8')+'\nLocalNarrator;';
const clips=Array.from({length:6},(_,i)=>({src:`audio/part-${i+1}.mp3`,text:`Part ${i+1}`}));
const bytes=()=>new Uint8Array([1,2,3,4]).buffer;
const response=()=>({ok:true,arrayBuffer:async()=>bytes()});
const flush=async()=>{for(let i=0;i<50;i++)await Promise.resolve();};
function harness({fetchAudio=async()=>response(),decodeAudio}={}){
  const downloads=[],timers=new Map();let serial=0,decoded=0;
  class AudioContext{
    constructor(){this.state='suspended';this.destination={};this.started=[];}
    resume(){this.state='running';return Promise.resolve();}
    createGain(){return {connect(){}};}
    async decodeAudioData(data){decoded++;if(decodeAudio)return decodeAudio(data);const samples=new Uint8Array(data).slice();structuredClone(data,{transfer:[data]});return {duration:12,samples};}
    createBufferSource(){const context=this;return {playbackRate:{value:1},connect(){},disconnect(){},stop(){this.stopped=true;},start(when,position){this.position=position;context.started.push(this);}};}
  }
  const LocalNarrator=vm.runInNewContext(code,{window:{AudioContext},AbortController,
    fetch(url,options){downloads.push(url);return fetchAudio(url,options);},
    setTimeout(fn){const id=++serial;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}
  });
  return {narrator:new LocalNarrator(),downloads,timers,decoded:()=>decoded};
}
const ready=harness();
await ready.narrator.preload(clips);
assert.equal(ready.narrator.context,null,'Preloading must not create an audio context or play sound');
assert.equal(ready.downloads.length,6);
const play=ready.narrator.play(clips[0],{prepare:clips});
assert.equal(ready.narrator.context.state,'running','Audio must unlock in the Play gesture');
assert.equal(await play,true);
assert.equal(ready.downloads.length,6);assert.equal(ready.decoded(),6);
assert.equal(ready.narrator.source.playbackRate.value,1);
assert.equal((await ready.narrator.load(clips[0])).byteLength,4,'Decoding must not detach the reusable download');
const first=ready.narrator.source;ready.narrator.stop();assert.equal(first.stopped,true);
await ready.narrator.play(clips[0],{offset:.5,prepare:clips});assert.equal(ready.narrator.source.position,6);
for(let i=1;i<6;i++)await ready.narrator.play(clips[i],{prepare:clips.slice(i)});
await ready.narrator.play(clips[0],{prepare:clips});
assert.equal(ready.downloads.length,6,'Transitions and replay must reuse downloaded recordings');
assert.equal(ready.decoded(),6,'Transitions and replay must reuse decoded audio');
ready.narrator.stop();assert.equal(ready.timers.size,0);

const crowded=harness();
for(const clip of [...clips.slice(0,2),...Array.from({length:10},(_,i)=>({src:`old-${i}.mp3`}))])await crowded.narrator.play(clip);
await crowded.narrator.play(clips[0],{prepare:clips});
const downloadCount=crowded.downloads.length,decodeCount=crowded.decoded();
for(let i=0;i<6;i++)await crowded.narrator.play(clips[i],{prepare:clips.slice(i)});
assert.equal(crowded.downloads.length,downloadCount);assert.equal(crowded.decoded(),decodeCount,'Cache eviction must retain the active lesson');
crowded.narrator.stop();

const waiting=[];const slow=harness({fetchAudio(){return new Promise(resolve=>waiting.push(resolve));}});
const pending=slow.narrator.play(clips[0],{prepare:clips});await flush();
assert.equal(waiting.length,6,'Recordings must load in parallel');
assert.equal(slow.narrator.context.started.length,0,'The lesson must wait for its recordings');
slow.narrator.stop();for(const resolve of waiting)resolve(response());
assert.equal(await pending,false);assert.equal(slow.narrator.source,null,'Late downloads must never play after pause');
assert.equal(await slow.narrator.play(clips[0],{prepare:clips}),true);slow.narrator.stop();
assert.equal(slow.downloads.length,6,'Resuming must reuse completed downloads');

let finishOld;const changed=harness({fetchAudio(url){return url==='old.mp3'?new Promise(resolve=>finishOld=resolve):Promise.resolve(response());}});
const old=changed.narrator.play({src:'old.mp3'});await flush();
await changed.narrator.play({src:'new.mp3'});const currentSource=changed.narrator.source;
finishOld(response());assert.equal(await old,false);assert.equal(changed.narrator.source,currentSource);
changed.narrator.stop();

let attempts=0;const retry=harness({fetchAudio(){return ++attempts===1?Promise.resolve({ok:false}):Promise.resolve(response());}});
await assert.rejects(retry.narrator.play(clips[0]),/could not load/);
assert.equal(await retry.narrator.play(clips[0]),true);assert.equal(attempts,2);retry.narrator.stop();

let corrupt=true;const decodeRetry=harness({decodeAudio(){if(corrupt){corrupt=false;throw new Error('Invalid audio');}return {duration:12};}});
await assert.rejects(decodeRetry.narrator.play(clips[0]),/Invalid audio/);
assert.equal(await decodeRetry.narrator.play(clips[0]),true);
assert.equal(decodeRetry.downloads.length,2,'A failed decode must allow a fresh download');decodeRetry.narrator.stop();

const stalled=harness({fetchAudio(url,{signal}){return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('Audio load timed out'))));}});
const timedOut=assert.rejects(stalled.narrator.play(clips[0]),/timed out/);await flush();
for(const timer of [...stalled.timers.values()])timer();await timedOut;
assert.equal(stalled.narrator.source,null);assert.equal(stalled.timers.size,0);
console.log('PASS: recording preload, synchronous audio unlock, parallel decoding, cached transitions/replay, natural pacing, pause/resume/seek, chapter changes, download/decode retries, and timeouts.');
