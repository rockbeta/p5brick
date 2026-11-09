const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Boot the real app with a deterministic clock and native-speech stand-in.
// No browser, voice service, packages, or network access is needed in CI.
function app({startEvent=true}={}){
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
  const synth={paused:false,speaking:false,pending:false,active:null,
    getVoices:()=>[{name:'Samantha',lang:'en-US'}],
    speak(utterance){speechCalls.push(utterance);this.active=utterance;this.speaking=true;if(startEvent)utterance.onstart?.();},
    cancel(){const old=this.active;this.active=null;this.speaking=false;old?.onerror?.({error:'interrupted'});},
    pause(){this.paused=true;},resume(){this.paused=false;}
  };
  const context={console,document,URL,performance:{now:()=>now},
    location:{href:'https://example.test/p5brick/',hash:'#chapter/1'},
    localStorage:{getItem:()=>JSON.stringify({learnerName:'Alex',namePromptSeen:true}),setItem(){}},
    speechSynthesis:synth,SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},
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
  function finish(){for(let i=0;i<605&&run('player.playing');i++)advance(100);}
  function seek(time){element('#demo-seek').value=String(time);element('#demo-seek').events.input({target:element('#demo-seek')});}
  return {run,element,synth,speechCalls,advance,play,finish,seek};
}

const repeated=app();
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
controls.play();assert.equal(controls.synth.paused,false);
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
const stale=mute.speechCalls[1],active=mute.run('player.utterance');
stale.onerror?.({error:'synthesis-failed'});stale.onend?.();
assert.equal(mute.run('player.utterance'),active,'Old speech callbacks must not clear a newer replay');
assert.doesNotMatch(mute.element('#voice-note').textContent,/unavailable/);

const rapid=app();rapid.element('#demo-play').click();rapid.element('#demo-play').click();rapid.advance(100);
assert.equal(rapid.speechCalls.length,0,'An immediate pause must prevent delayed narration');
rapid.play();rapid.element('#demo-play').click();rapid.element('#demo-restart').click();
assert.equal(rapid.run('player.time'),0);assert.equal(rapid.run('player.playing'),false);
rapid.synth.paused=true;
rapid.play();assert.equal(rapid.synth.paused,false,'Restart/replay must recover a paused native speech engine');
rapid.run('loadChapter(1)');rapid.advance(100);
assert.equal(rapid.run('player.playing'),false);assert.equal(rapid.synth.speaking,false,'Changing chapters must stop previous narration');

const delayedEvents=app({startEvent:false});delayedEvents.play();delayedEvents.element('#demo-play').click();
assert.equal(delayedEvents.synth.speaking,false,'Pause must work even if the browser delays its speech start event');
delayedEvents.play();assert.equal(delayedEvents.synth.paused,false);assert.equal(delayedEvents.speechCalls.length,2);

const midpoint=app();midpoint.play();midpoint.seek(5);midpoint.advance(60);
assert.ok(midpoint.speechCalls.at(-1).text.length<midpoint.speechCalls[0].text.length,'Seeking into a sentence must align narration with the current point');
assert.ok(midpoint.speechCalls[0].text.endsWith(midpoint.speechCalls.at(-1).text));

console.log('PASS: three full narrated runs; stable controls; pause/resume; restart; seek; rapid clicks; mute/unmute; stale callbacks; chapter changes.');
