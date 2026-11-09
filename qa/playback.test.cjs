const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Boot the real app with a deterministic clock and audio-output stand-in.
// No browser, voice service, packages, or network access is needed in CI.
function app({voiceDelay=1,voiceFails=false}={}){
  let now=0,serial=0,frame;
  const timers=new Map(),elements=new Map(),speechCalls=[];
  const canvas=new Proxy({}, {get:()=>()=>{},set:()=>true});
  function element(selector){
    if(elements.has(selector))return elements.get(selector);
    const attrs=new Map(),events={};let html='';
    const el={value:'',textContent:'',style:{},scrollTop:0,scrollLeft:0,selectionStart:0,hidden:false,htmlWrites:0,events,
      classList:{add(){},remove(){},toggle(){}},
      get innerHTML(){return html;},set innerHTML(value){html=value;this.htmlWrites++;},
      setAttribute(name,value){attrs.set(name,String(value));},getAttribute(name){return attrs.get(name)??null;},
      addEventListener(type,fn){events[type]=fn;},querySelectorAll(){return [];},getContext(){return canvas;},
      showModal(){this.open=true;},close(){this.open=false;events.close?.();},focus(){},setCustomValidity(){},reportValidity(){},click(){events.click?.();}
    };
    elements.set(selector,el);return el;
  }
  const document={hidden:false,querySelector:element,querySelectorAll:()=>[],addEventListener(){},title:''};
  const synth={speaking:false,paused:false};
  class Narrator {
    constructor(){this.generation=0;this.source=null;}
    stop(){this.generation++;this.source=null;synth.speaking=false;}
    play(text,options){
      if(voiceFails)throw new Error('Audio unavailable');
      const generation=this.generation,call={text,offset:options.offset};
      const start=()=>{if(generation!==this.generation)return;this.source=call;synth.speaking=true;speechCalls.push(call);options.onstart();};
      if(voiceDelay){const id=++serial;timers.set(id,{fn:start,at:now+voiceDelay});}else start();
      return Promise.resolve(true);
    }
  }
  const context={console,document,URL,performance:{now:()=>now},
    location:{href:'https://example.test/p5brick/',hash:'#chapter/1'},
    localStorage:{getItem:()=>JSON.stringify({learnerName:'Alex',namePromptSeen:true}),setItem(){}},
    LocalNarrator:Narrator,
    setTimeout(fn,delay=0){const id=++serial;timers.set(id,{fn,at:now+delay});return id;},
    clearTimeout(id){timers.delete(id);},requestAnimationFrame(fn){frame=fn;},addEventListener(){},scrollTo(){},
  };
  context.window=context;vm.createContext(context);
  vm.runInContext(fs.readFileSync('dist/course.js','utf8'),context);
  vm.runInContext(fs.readFileSync('dist/app.js','utf8'),context);
  const run=code=>vm.runInContext(code,context);
  // Canvas geometry has separate course checks; these tests isolate playback.
  run('drawConcept=()=>{}');
  function advance(ms){
    now+=ms;
    for(const [id,timer] of [...timers])if(timer.at<=now){timers.delete(id);timer.fn();}
    frame?.(now);
  }
  function play(){element('#demo-play').click();advance(60);}
  function finish(){for(let i=0;i<620&&run('player.playing');i++)advance(100);}
  function seek(time){element('#demo-seek').value=String(time);element('#demo-seek').events.input({target:element('#demo-seek')});}
  return {run,element,synth,speechCalls,advance,play,finish,seek,staleFrame:()=>frame(now-50)};
}

const repeated=app();
repeated.play();repeated.staleFrame();assert.ok(repeated.run('player.time')>=0,'A frame timestamp from before asynchronous voice startup must not rewind time');
repeated.seek(60);repeated.speechCalls.length=0;
for(let cycle=0;cycle<3;cycle++){
  const before=repeated.speechCalls.length;repeated.play();
  assert.equal(repeated.speechCalls.length,before+1,'Play/replay must queue exactly one opening sentence');
  assert.match(repeated.speechCalls.at(-1).text,/Welcome, Alex!/);
  repeated.finish();
  assert.equal(repeated.speechCalls.length,before+6,'Each complete run must speak exactly six segments');
  assert.equal(repeated.run('player.playing'),false);
  assert.equal(repeated.element('#demo-play').getAttribute('aria-label'),'Replay explanation');
  assert.equal(repeated.synth.speaking,false);
}

const controls=app();controls.play();
const playWrites=controls.element('#demo-play').htmlWrites,muteWrites=controls.element('#voice-toggle').htmlWrites;
for(let i=0;i<25;i++)controls.advance(16);
assert.equal(controls.element('#demo-play').htmlWrites,playWrites,'Frames must preserve the pause icon click target');
assert.equal(controls.element('#voice-toggle').htmlWrites,muteWrites,'Frames must preserve the mute icon click target');
const utterance=controls.speechCalls.at(-1),time=controls.run('player.time');
controls.element('#demo-play').click();controls.advance(1000);
assert.equal(controls.run('player.time'),time,'Pause must freeze the animation clock');
assert.equal(controls.synth.speaking,false,'Pause must stop the current narration');
controls.play();assert.equal(controls.synth.speaking,true);
assert.notEqual(controls.speechCalls.at(-1),utterance,'Resume must use a fresh utterance rather than a paused native queue');
assert.equal(controls.speechCalls.length,2,'Resume must queue exactly one fresh utterance');
controls.element('#demo-restart').click();controls.advance(60);
assert.equal(controls.speechCalls.length,3,'Restart while playing must speak one fresh opening sentence');
controls.seek(20);controls.advance(60);
assert.equal(controls.speechCalls.length,4);assert.match(controls.speechCalls.at(-1).text,/setup function/);
controls.seek(30);controls.element('#demo-play').click();controls.advance(100);
assert.equal(controls.speechCalls.length,4,'Pausing before queued speech starts must cancel that pending speech');
controls.play();assert.equal(controls.speechCalls.length,5);

const mute=app();mute.play();mute.element('#voice-toggle').click();
assert.equal(mute.synth.speaking,false);assert.equal(mute.run('player.playing'),true);
mute.element('#voice-toggle').click();mute.advance(60);assert.equal(mute.speechCalls.length,2);
mute.seek(60);assert.equal(mute.run('player.playing'),false);mute.play();assert.equal(mute.speechCalls.length,3);
assert.ok(mute.run('narrator.source'),'Replay must retain its active audio source');
assert.doesNotMatch(mute.element('#voice-note').textContent,/unavailable/);

const rapid=app({voiceDelay:50});rapid.element('#demo-play').click();rapid.element('#demo-play').click();rapid.advance(100);
assert.equal(rapid.speechCalls.length,0,'An immediate pause must prevent delayed narration');
rapid.play();rapid.element('#demo-play').click();rapid.element('#demo-restart').click();
assert.equal(rapid.run('player.time'),0);assert.equal(rapid.run('player.playing'),false);
rapid.play();assert.equal(rapid.synth.speaking,true,'Restart/replay must start a fresh audio source');
rapid.run('loadChapter(1)');rapid.advance(100);
assert.equal(rapid.run('player.playing'),false);assert.equal(rapid.synth.speaking,false,'Changing chapters must stop previous narration');

const loading=app({voiceDelay:1000});loading.element('#demo-play').click();loading.advance(500);
assert.equal(loading.run('player.time'),0,'The animation must wait for real audio preparation');
loading.advance(600);assert.equal(loading.run('player.voiceLoading'),false);assert.equal(loading.synth.speaking,true);
const failed=app({voiceFails:true});failed.play();assert.equal(failed.run('player.playing'),false);
assert.match(failed.element('#voice-note').textContent,/Press Play to retry/);
const midpoint=app();midpoint.play();midpoint.seek(5);midpoint.advance(60);
assert.equal(midpoint.speechCalls.at(-1).offset,.5,'Seeking must use the corresponding real audio position');
console.log('PASS: three full narrated runs; stable controls; pause/resume; restart; seek; rapid clicks; mute; loading; audio failure; chapter changes.');
