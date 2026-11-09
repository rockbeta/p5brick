import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createPicoVoice} from '../dist/pico.mjs';

const base=new URL('../dist/vendor/pico/',import.meta.url);
const voice=await createPicoVoice({wasmBinary:readFileSync(new URL('svoxpico.wasm',base)),resources:Object.fromEntries(['en-US_ta.bin','en-US_lh0_sg.bin'].map(file=>[file,readFileSync(new URL(file,base))]))});
const curriculum=vm.createContext({});vm.runInContext(readFileSync(new URL('../dist/course.js',import.meta.url),'utf8'),curriculum);
const lessons=vm.runInContext('COURSE',curriculum);
let rendered=0;
for(const lesson of lessons)for(const sentence of lesson.story){
  const audio=voice.synthesize(sentence.replaceAll('{name}','Alex'));
  assert.equal(audio.sampleRate,16000);assert.ok(audio.samples.length>16000,'Every sentence must produce real speech');
  let energy=0;for(const value of audio.samples){assert.ok(Number.isFinite(value));energy+=value*value;}
  assert.ok(Math.sqrt(energy/audio.samples.length)>.001,'Speech must contain non-silent samples, not just queued events');rendered++;
}
assert.ok(voice.synthesize('Welcome, Léa!').samples.length>16000);

// Run the actual playback adapter against real synthesized samples.
class AudioContext {
  constructor(){this.state='suspended';this.destination={};this.started=[];}
  resume(){this.state='running';return Promise.resolve();}
  createGain(){return {connect(){},disconnect(){}};}
  createBuffer(channels,length,sampleRate){return {duration:length/sampleRate,copyToChannel(samples){this.samples=samples;}};}
  createBufferSource(){const context=this;return {playbackRate:{value:1},connect(){},disconnect(){},stop(){this.stopped=true;},start(when,position){this.position=position;context.started.push(this);}};}
}
const LocalNarrator=vm.runInNewContext(readFileSync(new URL('../dist/voice.js',import.meta.url),'utf8')+'\nLocalNarrator;',{window:{AudioContext},Promise,Map});
const narrator=new LocalNarrator();narrator.ready=Promise.resolve(voice);
const request=narrator.play('Welcome, Alex!');
assert.equal(narrator.context.state,'running','Audio must be unlocked synchronously in the Play gesture');
assert.equal(await request,true);const first=narrator.source;
assert.ok(first.buffer.samples.some(sample=>Math.abs(sample)>.01));
narrator.stop();assert.equal(first.stopped,true);
await narrator.play('Welcome, Alex!',{offset:.5});assert.ok(narrator.source.position>0,'Resume must start at a real sample offset');
narrator.stop();await narrator.play('Welcome, Alex!');assert.equal(narrator.source.position,0,'Replay must start from the beginning');
let resolve;const waiting=new LocalNarrator();waiting.ready=new Promise(done=>resolve=done);
const pending=waiting.play('Do not speak after Pause.');waiting.stop();resolve(voice);
assert.equal(await pending,false);assert.equal(waiting.source,null,'Late synthesis completion must not play after Pause');
console.log(`PASS: ${rendered} real, non-silent narrated sentences; personalized names; real audio buffers; synchronous audio unlock; stop, resume, replay, and canceled loading.`);
