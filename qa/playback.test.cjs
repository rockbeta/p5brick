const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Boot the real app with a deterministic clock and audio-output stand-in.
// No browser, voice service, packages, or network access is needed in CI.
function app({voiceDelay=1,voiceFails=false,voiceDuration=10,storage=new Map([['brick-by-brick-v1',JSON.stringify({learnerName:'Alex',namePromptSeen:true})]])}={}){
  let now=0,serial=0,frame;
  const timers=new Map(),elements=new Map(),speechCalls=[],speechRequests=[],windowEvents={};
  const canvas=new Proxy({}, {get:()=>()=>{},set:()=>true});
  function element(selector){
    if(elements.has(selector))return elements.get(selector);
    const attrs=new Map(),events={};let html='';
    const el={value:'',textContent:'',style:{},scrollTop:0,scrollLeft:0,selectionStart:0,hidden:false,htmlWrites:0,events,contentWindow:{},
      classList:{add(){},remove(){},toggle(){}},
      get innerHTML(){return html;},set innerHTML(value){html=value;this.htmlWrites++;},
      setAttribute(name,value){attrs.set(name,String(value));},getAttribute(name){return attrs.get(name)??null;},
      addEventListener(type,fn){events[type]=fn;},querySelectorAll(){return [];},getContext(){return canvas;},
      showModal(){this.open=true;},close(){this.open=false;events.close?.();},focus(){},setSelectionRange(start){this.selectionStart=start;},setCustomValidity(){},reportValidity(){},click(){events.click?.();}
    };
    elements.set(selector,el);return el;
  }
  const document={hidden:false,querySelector:element,querySelectorAll:()=>[],addEventListener(){},title:''};
  const synth={speaking:false,paused:false};
  class Narrator {
    constructor(){this.generation=0;this.source=null;}
    stop(){this.generation++;this.source=null;synth.speaking=false;}
    preload(){return Promise.resolve();}
    play(clip,options){
      if(voiceFails)throw new Error('Audio unavailable');
      speechRequests.push(options);
      const generation=this.generation,call={text:clip.text,clip,offset:options.offset};
      const start=()=>{if(generation!==this.generation)return;this.source=call;synth.speaking=true;speechCalls.push(call);options.onstart({duration:voiceDuration});};
      if(voiceDelay){const id=++serial;timers.set(id,{fn:start,at:now+voiceDelay});}else start();
      return Promise.resolve(true);
    }
  }
  const context={console,document,URL,performance:{now:()=>now},
    location:{href:'https://example.test/p5brick/',hash:'#chapter/1'},
    localStorage:{get length(){return storage.size;},key:i=>[...storage.keys()][i],getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},
    LocalNarrator:Narrator,
    setTimeout(fn,delay=0){const id=++serial;timers.set(id,{fn,at:now+delay});return id;},
    clearTimeout(id){timers.delete(id);},requestAnimationFrame(fn){frame=fn;},addEventListener(type,fn){windowEvents[type]=fn;},scrollTo(){},
  };
  context.window=context;vm.createContext(context);
  vm.runInContext(fs.readFileSync('dist/course.js','utf8'),context);
  vm.runInContext(fs.readFileSync('dist/narration.js','utf8'),context);
  vm.runInContext(fs.readFileSync('dist/history.js','utf8'),context);
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
  function frameMessage(data, runId=run('runId')){windowEvents.message({source:element('#sketch-frame').contentWindow,data:{source:'brick-sketch',runId,...data}});}
  return {run,element,synth,speechCalls,speechRequests,advance,play,finish,seek,storage,frameMessage,staleFrame:()=>frame(now-50)};
}

const repeated=app();
repeated.play();repeated.staleFrame();assert.ok(repeated.run('player.time')>=0,'A frame timestamp from before asynchronous voice startup must not rewind time');
repeated.seek(60);repeated.speechCalls.length=0;
for(let cycle=0;cycle<3;cycle++){
  const before=repeated.speechCalls.length;repeated.play();
  assert.equal(repeated.speechCalls.length,before+1,'Play/replay must queue exactly one opening sentence');
  assert.equal(repeated.speechRequests.at(-1).prepare.length,6,'Playback must buffer the full lesson before the opening sentence');
  assert.match(repeated.speechCalls.at(-1).text,/Welcome!/);
  repeated.finish();
  assert.equal(repeated.speechCalls.length,before+6,'Each complete run must speak exactly six segments');
  assert.equal(repeated.run('player.playing'),false);
  assert.equal(repeated.element('#demo-play').getAttribute('aria-label'),'Replay explanation');
  assert.equal(repeated.synth.speaking,false);
}

const controls=app();controls.play();
assert.equal(controls.element('#narration-loading').hidden,true,'Fast cached playback must not flash the warm-up');
const profile=app();profile.run("state.learnerName='Mia';renderPersonalization();");
assert.doesNotMatch(profile.run('narrationText(0)'),/Mia|Alex|\{name\}/);
assert.equal(profile.element('#exercise-greeting').textContent,'Your turn, Mia');

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
assert.equal(controls.speechRequests.at(-1).prepare.length,4,'Seeking must prepare every remaining part');
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

const loading=app({voiceDelay:1000});
assert.equal(loading.element('#narration-loading').hidden,true,'The warm-up must stay hidden before Play');
loading.element('#demo-play').click();loading.advance(500);
assert.equal(loading.element('#narration-loading').hidden,false,'The warm-up must appear while narration loads');
assert.equal(loading.element('#concept-canvas').getAttribute('aria-hidden'),'true');
loading.speechRequests.at(-1).onprogress('Loading the lesson… 50%');
assert.equal(loading.element('#narration-loading-message').textContent,'Loading the lesson… 50%');
assert.equal(loading.run('player.time'),0,'The lesson timeline must wait for real audio preparation');
loading.advance(600);assert.equal(loading.run('player.voiceLoading'),false);assert.equal(loading.synth.speaking,true);
assert.equal(loading.element('#narration-loading').hidden,true,'Speech startup must reveal the lesson');
assert.equal(loading.element('#concept-canvas').getAttribute('aria-hidden'),'false');
loading.seek(10);
assert.equal(loading.element('#narration-loading').hidden,true,'A short audio load must not flash the warm-up');
loading.advance(250);
assert.equal(loading.element('#narration-loading').hidden,false,'Later uncached sentences must also show the warm-up');
assert.equal(loading.run('player.time'),10);
for(const cancel of [app=>app.element('#demo-play').click(),app=>app.element('#voice-toggle').click(),app=>app.element('#continue-captions').click(),app=>app.run('loadChapter(1)'),app=>app.seek(60)]){
  const pending=app({voiceDelay:1000});pending.element('#demo-play').click();
  const request=pending.speechRequests.at(-1);
  cancel(pending);
  request.onprogress('Stale download progress');request.onstart({duration:10});pending.advance(1100);
  assert.equal(pending.element('#narration-loading').hidden,true,'Canceling preparation must dismiss the warm-up and ignore late callbacks');
  assert.notEqual(pending.element('#voice-note').textContent,'Stale download progress');
  assert.equal(pending.speechCalls.length,0,'Canceled preparation must never start speech');
}
const captions=app({voiceDelay:1000});captions.element('#demo-play').click();captions.element('#continue-captions').click();captions.advance(500);
assert.equal(captions.run('player.playing'),true,'Continue with captions must keep the lesson playing');
assert.equal(captions.run('state.muted'),true);assert.ok(captions.run('player.time')>0);
assert.notEqual(captions.element('#demo-caption').textContent,'');
const timeout=app({voiceDelay:40000});timeout.element('#demo-play').click();timeout.advance(30001);
assert.equal(timeout.element('#narration-loading').hidden,true,'A timeout must dismiss the warm-up so Play can retry');
assert.match(timeout.element('#voice-note').textContent,/Press Play to retry/);
const failed=app({voiceFails:true});failed.play();assert.equal(failed.run('player.playing'),false);
assert.match(failed.element('#voice-note').textContent,/Press Play to retry/);
assert.equal(failed.element('#narration-loading').hidden,true);
const midpoint=app();midpoint.play();midpoint.seek(5);midpoint.advance(60);
assert.equal(midpoint.speechCalls.at(-1).offset,.5,'Seeking must use the corresponding real audio position');
const longVoice=app({voiceDuration:20});longVoice.play();
for(let i=0;i<100;i++)longVoice.advance(100);
assert.equal(longVoice.speechCalls.length,1,'A long sentence must finish naturally before the next segment');
for(let i=0;i<105;i++)longVoice.advance(100);
assert.equal(longVoice.speechCalls.length,2,'The next segment must play after the long sentence finishes');
assert.match(repeated.run("friendlyError('Uncaught ReferenceError: ballsize is not defined')"),/ballsize.*capital letters/);
assert.match(repeated.run("friendlyError('Uncaught TypeError: circel is not a function')"),/circel.*isn’t a function/);
assert.match(repeated.run("friendlyError(\"Uncaught SyntaxError: Failed to execute 'appendChild' on 'Node': Unexpected end of input\")"),/ended too soon/);
assert.match(repeated.run("friendlyError(\"Uncaught SyntaxError: Identifier 'score' has already been declared\")"),/score.*more than once/);
repeated.run("showError('Uncaught ReferenceError: circel is not defined', 12, '')");
assert.match(repeated.element('#runtime-message').textContent,/Look near line 12/);
console.log('PASS: three full narrated runs; stable controls; pause/resume; restart; seek; rapid clicks; mute; loading; audio failure; chapter changes; friendly error hints.');

const history = app();
const editor = history.element('#code-editor');
assert.equal(history.run('sketchHistory.list(1).length'), 0, 'Automatic preview must not create versions');
editor.value = editor.value.replace('160, 80', '160, 120');
history.element('#run-code').click();
const firstVersion = history.run('currentVersion(1).id');
assert.equal(history.run('currentVersion(1).label'), 'Change the circle size from 80 to 120.');
editor.value = editor.value.replace('160, 120', '160, 140');
editor.events.keydown({ key: 'Enter', ctrlKey: true, preventDefault() {} });
const originalBranch = history.run('currentVersion(1).id');
editor.value += '\n// Unrun edit';
history.run(`historySelection = sketchHistory.get(1, ${JSON.stringify(firstVersion)}); restoreHistoryVersion()`);
assert.match(editor.value, /160, 120/);
assert.equal(history.run('sketchHistory.list(1).find(node => node.label === "Save draft before restoring.").parentId'), originalBranch);
editor.value = editor.value.replace('160, 120', '160, 160');
history.element('#run-code').click();
assert.equal(history.run('currentVersion(1).parentId'), firstVersion);
assert.equal(history.run(`sketchHistory.get(1, ${JSON.stringify(originalBranch)}).code.includes('160, 140')`), true);
history.element('#run-code').click();
assert.equal(history.run('currentVersion(1).label'), 'Run the same code again.');
history.element('#restart-preview').click();
assert.equal(history.run('sketchHistory.list(1).length'), 5);
const reopened = app({ storage: history.storage });
assert.equal(reopened.run('sketchHistory.list(1).length'), 5);
assert.equal(reopened.element('#code-editor').value, editor.value);
assert.equal(reopened.run('currentVersion(1).id'), history.run('currentVersion(1).id'));
reopened.run('loadChapter(1)');
assert.equal(reopened.run('sketchHistory.list(2).length'), 0);
console.log('PASS: Run snapshots, keyboard shortcut, diff labels, draft preservation, branching, replay, and chapter isolation after reload.');

const runner=app(), status=runner.element('#run-status'), feedback=runner.element('#runtime-message');
const preview=runner.run('frameDocument("some random words", 1)');
for(const [,script] of preview.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(script);
const previousRun=runner.run('runId');
runner.element('#run-code').click();
runner.frameMessage({type:'ready',width:480,height:320},previousRun);
assert.equal(status.textContent,'Starting…','An old preview must not mark a new run ready');
runner.frameMessage({type:'error',message:"Unexpected identifier 'random'",filename:'blob:null/sketch',line:2});
assert.match(feedback.textContent,/Look near line 2/);
runner.advance(8001);
assert.match(feedback.textContent,/Unexpected identifier/,'A reported error must cancel the startup timeout');
runner.element('#run-code').click();runner.advance(8001);
assert.match(feedback.textContent,/took too long to start/);
runner.element('#run-code').click();
runner.frameMessage({type:'ready',width:480,height:320});runner.advance(8001);
assert.equal(status.textContent,'Running');assert.equal(feedback.textContent,'');
console.log('PASS: sketch error routing, startup timeout, stale frame messages, and successful retry.');
