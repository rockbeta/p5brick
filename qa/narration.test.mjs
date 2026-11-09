import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {KOKORO} from '../tools/narration-config.mjs';
import {inspectMp3} from '../tools/mp3.mjs';
const root=new URL('../',import.meta.url),hash=value=>createHash('sha256').update(value).digest('hex');
const course=vm.runInNewContext(readFileSync(new URL('dist/course.js',root),'utf8')+'\nCOURSE;');
const manifest=vm.runInNewContext(readFileSync(new URL('dist/narration.js',root),'utf8')+'\nNARRATION;');
assert.equal(manifest.chapters.length,26);
const files=new Set();let totalBytes=0;
for(const lesson of course){
 const clips=manifest.chapters[lesson.id-1];assert.equal(clips.length,6);
 for(let segment=0;segment<6;segment++){
  const clip=clips[segment],text=lesson.story[segment];
  assert.ok(clip,`Missing chapter ${lesson.id}, part ${segment+1}`);
  assert.equal(clip.text,text,'Recordings and captions must use the same script');
  assert.doesNotMatch(text,/\{name\}/);
  assert.match(clip.src,/^audio\/narration\/chapter-\d{2}-part-[1-6]\.[a-f0-9]{12}\.mp3$/);
  assert.equal(clip.sourceHash,hash(JSON.stringify({text,...KOKORO,format:'mp3-mono-24000-64k-v1'})),'Changed scripts must regenerate their recordings');
  const bytes=readFileSync(new URL('dist/'+clip.src,root));
  assert.equal(bytes.length,clip.bytes);assert.equal(hash(bytes),clip.sha256);
  assert.ok(clip.src.endsWith(clip.sha256.slice(0,12)+'.mp3'),'Audio URLs must change when their content changes');
  const info=inspectMp3(bytes);assert.equal(info.sampleRate,24000);
  assert.ok(info.duration>1);assert.ok(Math.abs(info.duration-clip.duration)<.001);
  files.add(clip.src.split('/').at(-1));totalBytes+=bytes.length;
 }
}
assert.equal(files.size,156);
assert.deepEqual(readdirSync(new URL('dist/audio/narration/',root)).filter(name=>name.endsWith('.mp3')).sort(),[...files].sort());
console.log(`PASS: 156 valid MP3 recordings; matching captions, source fingerprints, content hashes, durations, and filenames; ${(totalBytes/1024/1024).toFixed(1)} MB total.`);
