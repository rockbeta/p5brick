import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {KOKORO} from '../dist/kokoro-config.mjs';
const require=createRequire(import.meta.url);
const {KokoroTTS}=require('kokoro-js');
const kokoroRequire=createRequire(require.resolve('kokoro-js'));
const {env}=kokoroRequire('@huggingface/transformers');
env.allowRemoteModels=false;env.localModelPath=new URL('../dist/models/',import.meta.url).pathname;
const manifest=JSON.parse(readFileSync(new URL('../dist/models/kokoro/manifest.json',import.meta.url)));
assert.equal(manifest.model,KOKORO.modelId);
for(const [file,entry] of Object.entries(manifest.files)){const bytes=readFileSync(new URL('../dist/models/kokoro/'+file,import.meta.url));assert.equal(bytes.length,entry.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);}
const model=await KokoroTTS.from_pretrained('kokoro',{device:'cpu',dtype:KOKORO.dtype});
const voice={async synthesize(text){const audio=await model.generate(text,{voice:KOKORO.voice,speed:KOKORO.speed});return {samples:audio.audio,sampleRate:audio.sampling_rate};}};
const curriculum=vm.createContext({});vm.runInContext(readFileSync(new URL('../dist/course.js',import.meta.url),'utf8'),curriculum);
const lessons=vm.runInContext('COURSE',curriculum);
let rendered=0;
const selected=[lessons[0].story[0],lessons[3].story[2],lessons[8].story[0],lessons[16].story[0],lessons[20].story[3],lessons[25].story[5]];
for(const sentence of selected){
  const audio=await voice.synthesize(sentence.replaceAll('{name}','Alex'));
  assert.equal(audio.sampleRate,24000);assert.ok(audio.samples.length>24000,'Every sentence must produce real speech');
  let energy=0;for(const value of audio.samples){assert.ok(Number.isFinite(value));energy+=value*value;}
  assert.ok(Math.sqrt(energy/audio.samples.length)>.001,'Speech must contain non-silent samples, not just queued events');rendered++;
}
assert.ok((await voice.synthesize('Welcome, Léa!')).samples.length>16000);

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
assert.equal(first.playbackRate.value,1,'Kokoro audio must keep its natural pitch and pacing');
narrator.stop();assert.equal(first.stopped,true);
await narrator.play('Welcome, Alex!',{offset:.5});assert.ok(narrator.source.position>0,'Resume must start at a real sample offset');
narrator.stop();await narrator.play('Welcome, Alex!');assert.equal(narrator.source.position,0,'Replay must start from the beginning');
let resolve;const waiting=new LocalNarrator();waiting.ready=new Promise(done=>resolve=done);
const pending=waiting.play('Do not speak after Pause.');waiting.stop();resolve(voice);
assert.equal(await pending,false);assert.equal(waiting.source,null,'Late synthesis completion must not play after Pause');
console.log(`PASS: ${rendered} real, non-silent Kokoro narrated sentences; personalized names; real audio buffers; synchronous audio unlock; stop, resume, replay, and canceled loading.`);
