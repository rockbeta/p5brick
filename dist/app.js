'use strict';
const $ = selector => document.querySelector(selector);
const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons = {
  play:'<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M5 3l8 5-8 5z"/></svg>',
  pause:'<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 3h3v10H4zm5 0h3v10H9z"/></svg>',
  sound:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 8h3l4-4v12l-4-4H3zM13 7q4 3 0 6m3-9q7 6 0 12"/></svg>',
  mute:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 8h3l4-4v12l-4-4H3zm10-1 5 6m0-6-5 6"/></svg>'
};
let storageAvailable = true;
let saved;
try { saved = JSON.parse(localStorage.getItem('brick-by-brick-v1') || '{}') || {}; } catch { saved = {}; storageAvailable = false; }
const state = {drafts:saved.drafts || {}, passed:saved.passed || {}, muted:!!saved.muted, learnerName:normalizeLearnerName(saved.learnerName), namePromptSeen:!!saved.namePromptSeen};
state.historyHeads = saved.historyHeads || {};
const sketchHistory = new SketchHistory();
let editorReady = false;
let current=0, expanded=new Set([0]), runId=0, runtimeError=false, runReady=false, draftTimer;
const SKETCH_START_TIMEOUT = 8000;
let sketchTimer;
let pendingChecks = new Map(), checkSerial=0;
const player = {time:0,playing:false,caption:true,segment:-1,last:0,renderedPlaying:null,renderedMuted:null,speechGeneration:0,speechTimer:null,voiceLoading:false,loadingTimer:null,segmentSeconds:10};
const narrator=new LocalNarrator();
function persist() {
  try {localStorage.setItem('brick-by-brick-v1',JSON.stringify(state));} catch {storageAvailable=false;}
  if(!storageAvailable) $('#save-status').textContent='Progress available this visit';
}
function normalizeLearnerName(value){return typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().replace(/\s+/g,' ').slice(0,32):'';}
function narrationText(segment){return COURSE[current].story[segment];}
function renderPersonalization(){
  stopNarration();
  $('#profile-label').textContent=state.learnerName || 'Your name';
  $('#profile-button').setAttribute('aria-label',state.learnerName?`Change your name, currently ${state.learnerName}`:'Set your name');
  $('#exercise-greeting').textContent=state.learnerName?`Your turn, ${state.learnerName}`:'Your turn';
  player.segment=-1;updatePlayer();
}
function openNamePrompt(){
  if(player.playing)pausePlayback();
  const input=$('#learner-name');input.value=state.learnerName;input.setCustomValidity('');
  $('#skip-name').textContent=state.learnerName?'Cancel':'Maybe later';
  $('#name-dialog').showModal();input.focus();
}
function saveDraft() {state.drafts[current+1]=$('#code-editor').value;persist();}
function completed(id){return (state.passed[id] || []).filter(Boolean).length===3;}
function updateProgress(){
  const total=COURSE.filter(l=>completed(l.id)).length;
  $('#progress-count').textContent=`${total} / 26`;
  $('#progress-fill').style.width=`${total/26*100}%`;
  $('#progress-copy').textContent=total===26?'You made a game. What will you make next?':total?`${total} ${total===1?'chapter':'chapters'} down. Keep your curiosity going.`:'Every great game starts somewhere.';
  $('#exercise-count').textContent=`${(state.passed[current+1]||[]).filter(Boolean).length} of 3 challenges complete`;
}
function renderNav(){
  $('#chapter-nav').innerHTML=UNITS.map((u,i)=>`<div class="nav-unit"><button class="unit-toggle" data-unit="${i}" aria-expanded="${expanded.has(i)}" aria-controls="unit-${i}"><span class="unit-icon">${u.icon}</span>${u.name}<span class="unit-count">${String(u.end-u.start+1).padStart(2,'0')}</span><span class="chevron">⌄</span></button><div class="chapter-links ${expanded.has(i)?'open':''}" id="unit-${i}">${COURSE.filter(l=>l.unit===i).map(l=>`<a class="chapter-link ${l.id===current+1?'active':''}" href="#chapter/${l.id}" ${l.id===current+1?'aria-current="page"':''}><span class="chapter-number">${String(l.id).padStart(2,'0')}</span>${l.short}${completed(l.id)?'<span class="chapter-check">✓</span>':''}</a>`).join('')}</div></div>`).join('');
  $('#chapter-nav').querySelectorAll('[data-unit]').forEach(b=>b.addEventListener('click',()=>{const u=+b.dataset.unit;expanded.has(u)?expanded.delete(u):expanded.add(u);renderNav();}));
}
function highlight(code){
  const pattern=/(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|(\b(?:function|let|const|if|else|for|of|return|class|constructor|new|this|true|false|break)\b)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_$][\w$]*(?=\s*\())/g;
  let out='',last=0;
  for (const m of code.matchAll(pattern)) {out+=escapeHTML(code.slice(last,m.index));const type=m[1]?'comment':m[2]?'string':m[3]?'keyword':m[4]?'number':'function';out+=`<span class="token-${type}">${escapeHTML(m[0])}</span>`;last=m.index+m[0].length;}
  return out+escapeHTML(code.slice(last))+'\n';
}
function updateEditor(){
  const value=$('#code-editor').value;
  $('#code-highlight code').innerHTML=highlight(value);
  $('#line-numbers span').textContent=Array.from({length:value.split('\n').length},(_,i)=>i+1).join('\n');
  syncScroll();updateCursor();
}
function syncScroll(){
  const { scrollLeft, scrollTop } = $('#code-editor');
  // Translate the text itself so hidden scrollbars cannot clamp the two layers differently.
  $('#code-highlight code').style.transform = `translate(${-scrollLeft}px, ${-scrollTop}px)`;
  $('#line-numbers span').style.transform = `translateY(${-scrollTop}px)`;
}
function updateCursor(){const a=$('#code-editor'),before=a.value.slice(0,a.selectionStart),lines=before.split('\n');$('#cursor-position').textContent=`Ln ${lines.length}, Col ${lines.at(-1).length+1}`;}
function renderExercises(){
  const lesson=COURSE[current];
  $('#exercise-list').innerHTML=lesson.exercises.map((e,i)=>{const done=!!state.passed[lesson.id]?.[i];return `<article class="exercise-card ${done?'passed':''}" id="exercise-${i}"><div class="exercise-card-top"><span>CHALLENGE ${String(i+1).padStart(2,'0')}</span><span class="exercise-type">${done?'✓ COMPLETE':i===0?'WARM UP':i===1?'EXPLORE':'LEVEL UP'}</span></div><h3>${e.title}</h3><p>${e.prompt}</p><div class="exercise-actions"><button class="hint-button" data-hint="${i}" aria-expanded="false" aria-controls="hint-${i}">A little hint ↗</button><button class="check-button" data-check="${i}">Check my code <span>→</span></button></div><div class="exercise-hint" id="hint-${i}" hidden>${escapeHTML(e.hint)}</div><div class="check-result ${done?'success':''}" id="result-${i}" aria-live="polite">${done?'✓ Completed. Keep experimenting!':''}</div></article>`;}).join('');
  $('#exercise-list').querySelectorAll('[data-hint]').forEach(b=>b.addEventListener('click',()=>{const hint=$(`#hint-${b.dataset.hint}`);hint.hidden=!hint.hidden;b.setAttribute('aria-expanded',String(!hint.hidden));b.textContent=hint.hidden?'A little hint ↗':'Hide hint ↙';}));
  $('#exercise-list').querySelectorAll('[data-check]').forEach(b=>b.addEventListener('click',()=>checkExercise(+b.dataset.check)));
  $('#exercise-feedback').textContent='';
}
function loadChapter(index,scroll=true){
  clearTimeout(draftTimer);
  if(editorReady)saveDraft();
  if($('#history-dialog').open)$('#history-dialog').close();
  current=Math.max(0,Math.min(COURSE.length-1,index));
  const l=COURSE[current],u=UNITS[l.unit];expanded.add(l.unit);
  if(!state.muted)narrator.preload(NARRATION.chapters[l.id-1]).catch(()=>{});
  stopNarration();player.time=0;player.segment=-1;player.playing=false;updatePlayer();
  document.title=`${l.id}. ${l.short} · Brick by Brick`;
  $('#breadcrumb-chapter').textContent=`Chapter ${String(l.id).padStart(2,'0')}`;
  $('#chapter-label').textContent=`CHAPTER ${String(l.id).padStart(2,'0')}`;
  $('#unit-label').textContent=u.name.toUpperCase();
  $('#lesson-title').textContent=l.title;
  $('#lesson-description').textContent=l.description;
  $('#lesson-tags').innerHTML=l.tags.map(t=>`<span>${escapeHTML(t)}</span>`).join('');
  $('#idea-title').textContent=l.idea;$('#idea-text').textContent=l.explanation;$('#idea-takeaway').textContent=l.takeaway;
  $('#experiment-note').innerHTML=l.note;
  $('#preview-tip').textContent=l.id>=23?'Click to launch · Move to catch':l.id===10?'Click canvas, then use ← and →':l.id>=20?'Move your pointer to catch the ball':l.id===9||l.id===19?'Move your pointer inside the canvas':l.id===18?'Click the canvas to reshuffle':'Your ideas live here. Make them yours.';
  $('#code-editor').value=state.drafts[l.id] ?? l.code;updateEditor();renderNav();renderExercises();updateProgress();
  editorReady = true;
  $('#previous-chapter').disabled=current===0;
  $('#next-title').textContent=COURSE[current+1]?.short || 'Your next big idea';
  $('#next-kicker').textContent=current===25?'YOU MADE IT':'UP NEXT';
  $('#next-chapter').innerHTML=current===25?'Explore the course <span>↗</span>':'Next chapter <span>→</span>';
  $('#sidebar').classList.remove('mobile-open');
  if(scroll)window.scrollTo({top:0,behavior:'instant'});
  runSketch();drawConcept(performance.now());
}
function goChapter(id){if(location.hash===`#chapter/${id}`)loadChapter(id-1);else location.hash=`chapter/${id}`;}
function route(){const match=location.hash.match(/^#chapter\/(\d+)$/);const n=match?+match[1]:1;if(n<1||n>26){location.replace('#chapter/1');return;}loadChapter(n-1);}

// User code only runs in a new opaque-origin sandbox, never in the course page.
function frameDocument(code,id){
  const p5url=new URL('vendor/p5.min.js',location.href).href;
  const payload=JSON.stringify(code).replace(/</g,'\\u003c');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}body{display:flex;align-items:center;justify-content:center}main{display:contents}canvas{display:block;max-width:100%!important;max-height:100%!important;object-fit:contain;width:auto!important;height:auto!important;border-radius:5px;box-shadow:0 4px 20px #46503708}canvas:focus{outline:0}</style><script>
    const __runId=${id};
    const __send=(type,data={})=>parent.postMessage({...data,source:'brick-sketch',runId:__runId,type},'*');
    let __hasError=false;
    let __sketchUrl='';
    function __reportError(message, filename='', line=0){
      if(__hasError)return;
      __hasError=true;
      __send('error',{message:String(message),filename:String(filename),line});
    }
    function __reportException(error, message, filename, line){
      // p5 may surface a sketch error through a rejected promise. Its stack still
      // points to the sketch even when the event itself has no source location.
      if(__sketchUrl&&error?.stack){
        const marker=__sketchUrl+':';
        const frame=String(error.stack).split('\\n').find(entry=>entry.includes(marker));
        const sketchLine=frame?.slice(frame.indexOf(marker)+marker.length).match(/^[0-9]+/)?.[0];
        if(sketchLine){filename=__sketchUrl;line=Number(sketchLine);}
      }
      __reportError(message,filename,line);
    }
    window.onerror=(message,filename,line,column,error)=>{__reportException(error,message,filename,line);return true;};
    window.addEventListener('unhandledrejection',e=>__reportException(e.reason,e.reason?.message||e.reason));
    window.__calls={};window.__setupCalls={};
    const __tracked=['circle','rect','fill','background','frameRate','random','createCanvas','text','line'];
    for(const n of __tracked){window.__calls[n]=[];window.__setupCalls[n]=[];}
    let __recordSetup=true,__fill='';
    // Each recorded circle/rect remembers the fill color it was drawn with.
    function __instrument(){for(const n of __tracked){const original=window[n];window[n]=function(...args){if(n==='fill')__fill=args.map(String).join(',');if(n==='circle'||n==='rect')args.fill=__fill;const store=__recordSetup?window.__setupCalls:window.__calls;if(store[n].length<10000)store[n].push(args);return original.apply(this,args);};}}
    window.addEventListener('message',e=>{if(e.source!==parent||e.data?.type!=='inspect'||e.data.runId!==__runId)return;let results=e.data.tests.map(test=>{try{return !__hasError&&Boolean((0,eval)(test));}catch{return false;}});__send('checks',{request:e.data.request,results});});
    window.addEventListener('load',()=>{setTimeout(()=>{const canvas=document.querySelector('canvas');if(canvas){canvas.tabIndex=0;canvas.setAttribute('aria-label','Interactive p5.js canvas. Click to focus.');canvas.addEventListener('pointerdown',()=>canvas.focus());}if(!__hasError)__send('ready',{width:window.width,height:window.height});},120);});
  <\/script><script src="${escapeHTML(p5url)}" onerror="__reportError('The p5.js library could not load. Try Run code again.')"><\/script><script>
    // A classic script keeps the sketch's globals available to p5 and exercise checks.
    // Creating the URL inside this frame lets WebKit report the sketch's own errors.
    if(!__hasError){
      const __script=document.createElement('script');
      __sketchUrl=URL.createObjectURL(new Blob([${payload}],{type:'text/javascript'}));
      __script.src=__sketchUrl;
      __script.onload=()=>{
        URL.revokeObjectURL(__sketchUrl);
        if(__hasError)return;
        const __originalSetup=window.setup;
        const __originalDraw=window.draw;
        if(__originalSetup)window.setup=function(){__instrument();__originalSetup();__recordSetup=false;};
        if(__originalDraw)window.draw=function(){for(const n of __tracked)window.__calls[n]=[];__originalDraw();};
      };
      __script.onerror=()=>{
        URL.revokeObjectURL(__sketchUrl);
        __reportError('The sketch could not load. Try Run code again.');
      };
      document.head.appendChild(__script);
    }
  <\/script></head><body></body></html>`;
}
function runSketch(){
  saveDraft();runId++;runtimeError=false;runReady=false;
  clearTimeout(sketchTimer);
  for(const request of pendingChecks.values()){clearTimeout(request.timer);request.resolve(null);}pendingChecks.clear();
  $('#runtime-message').classList.remove('visible');$('#runtime-message').textContent='';$('#run-status').textContent='Starting…';
  const frame = $('#sketch-frame');
  sketchTimer = setTimeout(() => {
    frame.srcdoc = '';
    showRunProblem('The preview took too long to start. Check your connection and try Run code again.');
  }, SKETCH_START_TIMEOUT);
  frame.srcdoc=frameDocument($('#code-editor').value,runId);
}

function starterVersion(chapter) {
  return { id: 'starter', code: COURSE[chapter - 1].code, label: 'Starter code' };
}

function currentVersion(chapter) {
  return sketchHistory.get(chapter, state.historyHeads[chapter]) || starterVersion(chapter);
}

function saveVersion(chapter, code, parentId, label) {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const version = { id, parentId, code, label, createdAt: Date.now() };
  if (!sketchHistory.save(chapter, version)) {
    $('#history-storage-note').hidden = false;
    toast('This version could only be saved for this visit.');
  }
  state.historyHeads[chapter] = version.id;
  return version;
}

function runAndSaveVersion() {
  const chapter = current + 1, code = $('#code-editor').value;
  const parent = currentVersion(chapter), changes = sketchChanges(parent.code, code);
  const version = saveVersion(chapter, code, parent.id, sketchChangeLabel(changes));
  runSketch();
  void modelSketchLabel(changes).then(label => {
    if (!label) return;
    version.label = label;
    sketchHistory.save(chapter, version);
    if (current + 1 !== chapter || !$('#history-dialog').open) return;
    const button = [...$('#history-versions').querySelectorAll('button')].find(item => item.dataset.versionId === version.id);
    if (button) button.querySelector('strong').textContent = label;
    if (historySelection?.id === version.id) {
      historySelection.label = label;
      $('#history-selection').textContent = label;
    }
  });
}

let historySelection;
let historyVersionNames;

function selectHistoryVersion(version) {
  historySelection = version;
  for (const button of $('#history-versions').querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.versionId === version.id));
  }
  $('#history-selection').textContent = version.label;
  const savedAt = version.createdAt ? new Date(version.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const details = $('#history-details');
  details.hidden = version.id === 'starter';
  details.textContent = [historyVersionNames.get(version.id), savedAt].filter(Boolean).join(' · ');
  $('#history-code').textContent = version.code;
  const base = currentVersion(current + 1);
  const editorCode = $('#code-editor').value;
  $('#restore-version').disabled = version.id === base.id && editorCode === version.code;
  $('#restore-version').textContent = editorCode === base.code ? 'Restore version' : 'Save edits and restore';
}

function showHistory() {
  const chapter = current + 1, starter = starterVersion(chapter);
  const versions = sketchHistory.list(chapter);
  const base = currentVersion(chapter);
  historyVersionNames = new Map(versions.map((version, i) => [version.id, `Version ${i + 1}`]));
  historyVersionNames.set(starter.id, starter.label);
  const children = new Map();
  for (const version of versions) {
    const parent = historyVersionNames.has(version.parentId) ? version.parentId : starter.id;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(version);
  }

  const rows = document.createDocumentFragment();
  const pending = [{ version: starter, depth: 0 }];
  while (pending.length) {
    const { version, depth } = pending.pop();
    const row = document.createElement('li');
    row.style.setProperty('--history-depth', String(Math.min(depth, 4)));
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.versionId = version.id;
    if (version.id === base.id) button.setAttribute('aria-current', 'true');
    const label = document.createElement('strong');
    label.textContent = version.label;
    const parent = historyVersionNames.get(version.parentId);
    const details = [version.id !== starter.id && historyVersionNames.get(version.id), parent && `From ${parent.toLowerCase()}`, version.id === base.id && 'Current'].filter(Boolean).join(' · ');
    button.append(label);
    if (details) {
      const subtitle = document.createElement('span');
      subtitle.textContent = details;
      button.append(subtitle);
    }
    button.addEventListener('click', () => selectHistoryVersion(version));
    row.append(button);
    rows.append(row);
    for (const child of children.get(version.id) || []) pending.push({ version: child, depth: depth + 1 });
  }
  $('#history-versions').replaceChildren(rows);
  selectHistoryVersion(base);
  $('#history-dialog').showModal();
  $('#history-versions').querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest' });
}

function restoreHistoryVersion() {
  if (!historySelection) return;
  const chapter = current + 1, base = currentVersion(chapter), editor = $('#code-editor');
  if (editor.value !== base.code) saveVersion(chapter, editor.value, base.id, 'Save draft before restoring.');
  state.historyHeads[chapter] = historySelection.id;
  clearTimeout(draftTimer);
  editor.value = historySelection.code;
  editor.setSelectionRange(0, 0);
  updateEditor();
  runSketch();
  $('#history-dialog').close();
  editor.focus();
}
// Turn common JavaScript errors into hints a young coder can act on.
function friendlyError(message){
  const m=String(message).replace(/^Uncaught\s+/,'').replace(/^\w*Error:\s*/,'').replace(/^Failed to execute '\w+' on '\w+':\s*/,'');
  let r;
  if((r=m.match(/^(?:Can't find variable: )?([\w$]+)(?: is not defined)?$/))&&/not defined|Can't find variable/.test(m))return `JavaScript doesn’t know the word “${r[1]}”. Check its spelling and capital letters: ballSize and ballsize are different words to a computer. If it’s a new variable, create it first with let.`;
  if((r=m.match(/^(.+?) is not a function/)))return `“${r[1]}” isn’t a function JavaScript knows. Check the spelling of the name just before the ( bracket.`;
  if((r=m.match(/Identifier '(.+?)' has already been declared|redeclaration of \w+ (\S+)/)))return `You created “${r[1]||r[2]}” with let more than once. Use let only the first time. After that, just write ${r[1]||r[2]} = …`;
  if(/Unexpected end of input|end of script|Unexpected EOF/i.test(m))return 'Your code ended too soon. A closing } or ) is probably missing. Every { needs a matching }, and every ( needs a ).';
  if(/missing \) after argument list/i.test(m))return 'A ) is missing, or two values are missing a comma between them, like circle(240 160, 80).';
  if(/Invalid or unexpected token|unterminated string|Unterminated string/i.test(m))return 'A quote may be missing. Every \' needs a partner, like \'#ec693f\'.';
  if(/Unexpected (number|string|identifier)/i.test(m))return 'Two things are touching that need something between them. Look for a missing comma, bracket, or + sign.';
  if(/Unexpected token|expected expression|Unexpected keyword/i.test(m))return 'Something is in the wrong place, like an extra or missing bracket ( ) { } [ ], comma, or semicolon.';
  if((r=m.match(/Cannot read propert(?:y|ies) of (?:undefined|null)(?: \(reading '(.+?)'\))?|(?:undefined|null) is not an object/)))return `You asked for ${r[1]?`.${r[1]}`:'a property'} of something that doesn’t exist yet. Check the spelling, and remember that array indexes start at 0.`;
  if(/Maximum call stack|too much recursion/i.test(m))return 'A function keeps calling itself forever. Make sure a function doesn’t call its own name.';
  if(/Assignment to constant/i.test(m))return 'You tried to change a const. Use let for values that change.';
  return '';
}
function showRunProblem(message) {
  clearTimeout(sketchTimer);
  runtimeError=true;runReady=false;$('#run-status').textContent='Let’s fix this';
  $('#runtime-message').textContent=message;
  $('#runtime-message').classList.add('visible');
}
function showError(message,line,filename=''){
  const clean=String(message).replace(/^Uncaught\s+/,'').replace(/Failed to execute '\w+' on '\w+':\s*/,'');
  const hint=friendlyError(message);
  const where=line>0&&!/p5(\.min)?\.js/.test(filename)?`Look near line ${line}.\n`:'';
  showRunProblem(`${hint?`💡 ${hint}\n`:''}${where}A clue from JavaScript: ${clean}${hint?'':'\nCheck your spelling, brackets, and quotes, then try Run code again.'}`);
}
window.addEventListener('message',e=>{
  const d=e.data;if(e.source!==$('#sketch-frame').contentWindow||d?.source!=='brick-sketch'||d.runId!==runId)return;
  if(d.type==='error'&&!runtimeError)showError(d.message,d.line,d.filename);
  if(d.type==='ready'&&!runtimeError){clearTimeout(sketchTimer);runReady=true;$('#run-status').textContent='Running';$('#canvas-size').textContent=`${d.width || 480} × ${d.height || 320}`;}
  if(d.type==='checks'){const req=pendingChecks.get(d.request);if(req){clearTimeout(req.timer);pendingChecks.delete(d.request);req.resolve(d.results);}}
});
function inspect(tests){return new Promise(resolve=>{const request=++checkSerial;const timer=setTimeout(()=>{pendingChecks.delete(request);resolve(null);},3000);pendingChecks.set(request,{resolve,timer});$('#sketch-frame').contentWindow.postMessage({type:'inspect',runId,request,tests},'*');});}
async function checkExercise(i){
  const chapter=current,lesson=COURSE[current],result=$(`#result-${i}`),button=$(`[data-check="${i}"]`);
  if($('#code-editor').value!==state.drafts[current+1])saveDraft();
  // Always run the current editor contents so feedback never checks an old preview.
  button.disabled=true;button.textContent='Running…';result.className='check-result';result.textContent='Trying your latest sketch…';runSketch();
  const expectedRun=runId,start=performance.now();
  while(!runReady&&!runtimeError&&runId===expectedRun&&performance.now()-start<SKETCH_START_TIMEOUT)await new Promise(r=>setTimeout(r,60));
  if(current!==chapter)return;
  let response=null;if(runReady&&!runtimeError&&runId===expectedRun)response=await inspect([lesson.exercises[i].test]);
  if(current!==chapter)return;
  // Some checks play a few test frames. Restart so the learner sees a fresh sketch.
  if(response&&/\b(draw|mousePressed|keyPressed|burst)\(/.test(lesson.exercises[i].test))runSketch();
  button.disabled=false;button.innerHTML='Check my code <span>→</span>';
  if(response?.[0]){
    if(!state.passed[lesson.id])state.passed[lesson.id]=[false,false,false];state.passed[lesson.id][i]=true;persist();
    result.className='check-result success';result.textContent='✓ '+lesson.exercises[i].success;
    $(`#exercise-${i}`).classList.add('passed');$(`#exercise-${i} .exercise-type`).textContent='✓ COMPLETE';
    updateProgress();renderNav();
    if(completed(lesson.id)){$('#exercise-feedback').textContent=lesson.id===26?'✦ You completed your brick breaker adventure. Download your sketch and keep building!':'✦ Three discoveries, one new superpower. You’re ready for the next chapter.';}
  }else{
    result.textContent=runtimeError?'Fix the JavaScript clue above, then check again.':!response?'The canvas did not respond yet. Try Run code, wait a moment, and check again.':'Not quite yet. Compare your change with the goal, or open the hint. You’re learning by experimenting.';
  }
}

function setVoiceLoading(loading,message='Loading the lesson…'){
  player.voiceLoading=loading;
  if(!loading){
    clearTimeout(player.loadingTimer);player.loadingTimer=null;
    $('#narration-loading').hidden=true;
    $('#concept-canvas').setAttribute('aria-hidden','false');
    return;
  }
  $('#narration-loading-message').textContent=message;
  $('#voice-note').textContent=message;
  // Cached recordings start immediately; show the warm-up only on a slow load.
  if(player.loadingTimer===null&&$('#narration-loading').hidden){
    player.loadingTimer=setTimeout(()=>{
      player.loadingTimer=null;
      if(!player.voiceLoading)return;
      $('#narration-loading').hidden=false;
      $('#concept-canvas').setAttribute('aria-hidden','true');
    },200);
  }
}
function stopNarration(){
  player.speechGeneration++;
  clearTimeout(player.speechTimer);player.speechTimer=null;
  setVoiceLoading(false);narrator.stop();
}
function speakSegment(){
  stopNarration();if(state.muted||!player.playing)return;
  const generation=player.speechGeneration;
  const segment=Math.min(5,Math.floor(player.time/10)),clips=NARRATION.chapters[current];
  const clip=clips[segment],prepare=clips.slice(segment);
  setVoiceLoading(true);
  const failed=()=>{
    if(generation!==player.speechGeneration)return;
    player.playing=false;stopNarration();updatePlayer();
    $('#voice-note').textContent='Audio could not load. Press Play to retry · Captions are available';
  };
  player.speechTimer=setTimeout(failed,30000);
  try{
    // play() unlocks audio synchronously, then decodes the small recordings.
    narrator.play(clip,{offset:(player.time%10)/10,prepare,onprogress:message=>{
      if(generation!==player.speechGeneration||!player.voiceLoading)return;
      setVoiceLoading(true,message);
      clearTimeout(player.speechTimer);player.speechTimer=setTimeout(failed,30000);
    },onstart:(audio={})=>{
      if(generation!==player.speechGeneration)return;
      clearTimeout(player.speechTimer);player.speechTimer=null;
      setVoiceLoading(false);player.last=performance.now();
      player.segmentSeconds=Math.max(10,audio.duration||10);
      $('#voice-note').textContent='Narration on · Captions always available';
    }}).catch(failed);
  }catch{failed();}
}
function updatePlayer(){
  // Preserve the actual click targets between pointerdown and pointerup.
  if(player.renderedPlaying!==player.playing){$('#demo-play').innerHTML=player.playing?icons.pause:icons.play;player.renderedPlaying=player.playing;}
  $('#demo-play').setAttribute('aria-label',player.playing?'Pause explanation':player.time>=60?'Replay explanation':'Play one-minute explanation');
  if(player.renderedMuted!==state.muted){
    $('#voice-toggle').innerHTML=state.muted?icons.mute:icons.sound;player.renderedMuted=state.muted;
    if(state.muted)$('#voice-note').textContent='Voice off · Captions always available';
    else if(!player.voiceLoading)$('#voice-note').textContent='Voice ready · Press Play to listen';
  }
  $('#voice-toggle').setAttribute('aria-label',state.muted?'Turn narration on':'Mute narration');$('#voice-toggle').setAttribute('aria-pressed',String(state.muted));
  $('#demo-time').innerHTML=`${Math.floor(player.time/60)}:${String(Math.floor(player.time%60)).padStart(2,'0')} <span>/ 1:00</span>`;$('#demo-seek').value=player.time;
  const seg=Math.min(5,Math.floor(player.time/10));
  const sentence=narrationText(seg);
  $('#demo-caption').textContent=player.caption?sentence:'';
  $('#concept-canvas').setAttribute('aria-label',sentence);
  player.segment=seg;
}
function pausePlayback(){
  player.playing=false;stopNarration();updatePlayer();
  if(!state.muted)$('#voice-note').textContent='Voice paused · Press Play to continue';
}
function togglePlayback(){
  if(player.playing){pausePlayback();return;}
  if(player.time>=60)player.time=0;
  player.playing=true;player.last=performance.now();updatePlayer();
  speakSegment();
}
function seekPlayback(time){
  player.time=Math.max(0,Math.min(60,Number(time)||0));player.last=performance.now();
  if(player.time>=60)player.playing=false;
  updatePlayer();
  if(player.playing)speakSegment();else stopNarration();
  if(!player.playing&&!state.muted)$('#voice-note').textContent=player.time>=60?'Ready to replay · Press Play to listen again':'Voice ready · Press Play to listen';
}

// Purpose-built canvas diagrams; animation is rendered locally, with no video service.
const conceptCanvas=$('#concept-canvas'),ctx=conceptCanvas.getContext('2d');
function rounded(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke();}}
function label(text,x,y,size=17,color='#817696',align='left',font='DM Sans'){ctx.font=`${size}px "${font}", sans-serif`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(text,x,y);}
function ball(x,y,r,color='#ec693f'){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
function arrow(x1,y1,x2,y2,color='#b5abc9'){ctx.strokeStyle=color;ctx.lineWidth=1.7;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(x2-7,y2-5);ctx.lineTo(x2,y2);ctx.lineTo(x2-7,y2+5);ctx.stroke();}
function drawConcept(now){
  // Keep the illustration large enough to read when its card is narrow.
  const compact=conceptCanvas.clientWidth<620,width=compact?450:900;
  if(conceptCanvas.width!==width){conceptCanvas.width=width;conceptCanvas.style.aspectRatio=`${width}/350`;}
  const c=COURSE[current].concept, t=player.time, phase=Math.min(5,Math.floor(t/10));
  const movement=t;
  ctx.clearRect(0,0,width,350);
  const codes={canvas:['function setup() {','  createCanvas(480, 320);','}','circle(240, 160, 80);'],coordinates:['x → across','y ↓ down','circle(x, y, size);'],color:["fill('#ec693f');",'circle(240, 160, 80);',"fill('#7e73bd');"],loop:['setup()  →  once','draw()   →  again','         ↳ again ↺'],variables:['let ballSize = 60;','', 'circle(x, y, ballSize);'],movement:['let speed = 2;','x += speed;','circle(x, 160, 40);'],conditions:['if (x > threshold) {',"  fill('#ec693f');",'} else { /* purple */ }'],bounce:['if (touchingWall) {','  speed *= -1;','}'],mouse:['mouseX → x','mouseY → y','circle(mouseX, mouseY, 40);'],keyboard:['if (keyIsDown(→)) {','  paddleX += speed;','}'],functions:['function drawBall() {','  // your recipe','}','drawBall();'],parameters:['drawBall(120, 160, 40);','drawBall(240, 160, 65);','drawBall(360, 160, 90);'],for:['for (let i = 0;','     i < 5; i++) {','  circle(60+i*75,160,30);','}'],arrays:['let sizes = [25,40,60,80];','sizes[0] → 25','sizes.length → 4'],grid:['for (each row) {','  for (each column) {','    draw a brick','  }','}'],objects:['ball = {','  x: 240, y: 160,','  size: 60','}'],classes:['class Ball { ... }','new Ball(130,160,40);','new Ball(350,160,80);'],random:['random(50, 430)','random(15, 45)','// a new possibility'],collision:['nearest = constrain(...)','gap = dist(ball, nearest)','touching = gap < radius'],paddle:['if (touchingPaddle) {','  speedY = -abs(speedY);','}'],bricks:['if (hit && brick.alive) {','  brick.alive = false;','}'],score:['score += 10;','lives -= 1;','text(score, 20, 24);'],states:["state = 'ready';","click → 'playing'","no lives → 'over'"],particles:['particles.push({...});','life -= 1;','// move, fade, remove'],levels:['if (allBricksGone) {','  level += 1;','  makeBricks();','}'],game:['curiosity + small steps','        ↓','your very own game.']};
  const lines=codes[c]||codes.canvas;
  if(!compact){
    rounded(25,67,305,202,9,'#f8f6fd','#ddd6ed');
    ball(43,84,3,'#d3c7e5');ball(55,84,3,'#d3c7e5');ball(67,84,3,'#d3c7e5');
    lines.forEach((line,i)=>label(line,43,116+i*28,18,line.startsWith('//')?'#81748e':i%2?'#916342':'#75618e','left','IBM Plex Mono'));
    label('a few instructions',177,303,17,'#81748e','center');
    arrow(344,170,391,170);
  }
  ctx.save();if(compact)ctx.translate(-392,0);
  rounded(410,45,415,245,8,'#faf9f4','#d4cee4');
  ctx.save();ctx.beginPath();ctx.rect(411,46,413,243);ctx.clip();
  const ox=410,oy=45,w=415,h=245;
  for(let x=ox+15;x<ox+w;x+=20)for(let y=oy+15;y<oy+h;y+=20)ball(x,y,.7,'#ddd9df');
  const bx=ox+w/2,by=oy+h/2;
  if(['grid','bricks','score','states','particles','levels','game','paddle'].includes(c)){
    const brickRows=c==='paddle'?0:3;
    for(let r=0;r<brickRows;r++)for(let col=0;col<6;col++){
      if(['bricks','particles','game'].includes(c)&&col===3&&r===2&&phase>1)continue;
      rounded(ox+25+col*62,oy+29+r*24,55,16,3,r===0?'#ae9bc9':r===1?'#beaaca':'#d1bbd3');
    }
    const px=bx+Math.sin(movement*.6)*80;
    rounded(px-42,oy+h-25,84,8,4,'#9bb38e');
    ball(bx+Math.sin(movement*1.4)*120,oy+100+Math.abs(Math.sin(movement*1.3))*100,9);
    if(c==='score')label('SCORE  30      LIVES  3',ox+25,oy+19,15,'#6f7e62','left','IBM Plex Mono');
    if(c==='levels')label('LEVEL  '+(phase>3?'2':'1'),bx,oy+168,20,'#81708f','center','IBM Plex Mono');
    if(c==='states'&&phase<3){rounded(ox+70,oy+107,275,57,6,'#faf9f4ee');label(phase<1?'READY':'CLICK TO LAUNCH',bx,oy+143,18,'#8c7a9e','center','IBM Plex Mono');}
    if(c==='particles')for(let i=0;i<10;i++){const a=i*.628,rad=15+(movement*25+i*3)%60;ball(bx+Math.cos(a)*rad,oy+100+Math.sin(a)*rad,2.8,'#e5ad8b');}
  }else if(['for','arrays','parameters','classes'].includes(c)){
    const n=c==='for'?5:c==='arrays'?4:3;
    for(let i=0;i<n;i++){const r=c==='for'?14:12+i*9;ball(ox+65+i*(w-110)/(n-1),by,r,i%2?'#9e8abc':'#ec906f');if(c==='arrays')label('['+i+']',ox+65+i*(w-110)/(n-1),oy+h-39,17,'#81708f','center','IBM Plex Mono');}
  }else if(c==='random'){
    for(let i=0;i<8;i++){const seed=i*7+(phase+1)*3;ball(ox+30+(Math.sin(seed)*.5+.5)*(w-65),oy+28+(Math.cos(seed*3)*.5+.5)*(h-60),8+(Math.sin(seed*2)*.5+.5)*13,'#b09bc9');}
  }else if(c==='collision'){
    const x=bx+Math.sin(movement*.9)*130;rounded(bx-70,by-20,140,40,4,Math.abs(x-bx)<92?'#ec906f':'#a7bc99');ball(x,by-36,19,'#a391c2');
  }else if(c==='keyboard'){
    const px=bx+Math.sin(movement)*100;rounded(px-45,by+35,90,12,5,'#99b18d');label('←    →',bx,by-17,28,'#b1a4c6','center','IBM Plex Mono');
  }else if(c==='objects'){
    ball(bx,by,35);arrow(bx+40,by,bx+95,by);label('ball.size',bx+103,by+5,17,'#81708f','left','IBM Plex Mono');
  }else if(c==='color'){
    ball(bx-26,by,55,'#a897be');ball(bx+40,by,42,'#ec906f');if(phase>3)ball(bx+5,by+23,20,'#e4c885');
  }else{
    let x=bx,y=by,r=c==='variables'?25+phase*6:35;
    if(['movement','bounce','conditions'].includes(c)){x=ox+35+(c==='bounce'?(1+Math.sin(movement*1.1))*.5:(movement*.19)%1)*(w-70);r=20;}
    if(c==='loop'){x=ox+45+((movement*.15)%1)*(w-90);r=22;}
    if(c==='mouse'){x=bx+Math.sin(movement)*80;y=by+Math.cos(movement)*40;r=20;}
    if(c==='canvas'&&phase>=4)r=50;
    ball(x,y,r,c==='conditions'&&x<bx?'#a493bf':'#ec906f');
    if(['canvas','coordinates','variables'].includes(c)){
      ctx.setLineDash([4,5]);ctx.strokeStyle='#cfc5d8';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,oy+10);ctx.lineTo(x,y-r-10);ctx.moveTo(ox+10,y);ctx.lineTo(x-r-10,y);ctx.stroke();ctx.setLineDash([]);
      label('x: 240',x,oy+22,17,'#81708f','center','IBM Plex Mono');label('y: 160',ox+15,y-13,17,'#81708f','left','IBM Plex Mono');
    }
    if(c==='mouse'){ctx.beginPath();ctx.moveTo(x+9,y+6);ctx.lineTo(x+9,y+28);ctx.lineTo(x+16,y+22);ctx.lineTo(x+24,y+22);ctx.closePath();ctx.fillStyle='#f7f3fc';ctx.fill();ctx.strokeStyle='#9686a6';ctx.stroke();}
  }
  ctx.restore();
  label('a world of possibilities',617,324,17,'#81748e','center');
  label('↗',842,72,25,'#c5bcd5');
  ctx.restore();
}
function animationFrame(now){
  if(player.playing&&!player.voiceLoading){
    const delta=Math.max(0,Math.min((now-player.last)/1000,.2))*10/player.segmentSeconds;player.time=Math.min(60,player.time+delta);
    const segmentChanged=Math.min(5,Math.floor(player.time/10))!==player.segment;
    if(player.time>=60){player.playing=false;stopNarration();if(!state.muted)$('#voice-note').textContent='Ready to replay · Press Play to listen again';}
    updatePlayer();
    if(player.playing&&segmentChanged)speakSegment();
  }
  player.last=now;drawConcept(now);requestAnimationFrame(animationFrame);
}

function showMap(){
  $('#map-content').innerHTML=UNITS.map((u,i)=>`<section class="map-unit"><h3>${String(i+1).padStart(2,'0')} / ${u.name.toUpperCase()} — ${u.subtitle}</h3><div>${COURSE.filter(l=>l.unit===i).map(l=>`<button class="map-chapter ${l.id===current+1?'active':''}" data-chapter="${l.id}"><span>${String(l.id).padStart(2,'0')}</span>${l.short}<i>${completed(l.id)?'✓':'→'}</i></button>`).join('')}</div></section>`).join('');
  $('#map-content').querySelectorAll('[data-chapter]').forEach(b=>b.addEventListener('click',()=>{$('#course-dialog').close();goChapter(+b.dataset.chapter);}));
  $('#course-dialog').showModal();
}
let toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
$('#code-editor').addEventListener('input',()=>{updateEditor();clearTimeout(draftTimer);draftTimer=setTimeout(saveDraft,300);$('#run-status').textContent='Changes to run';});
$('#code-editor').addEventListener('scroll',syncScroll);$('#code-editor').addEventListener('click',updateCursor);$('#code-editor').addEventListener('keyup',updateCursor);
$('#code-editor').addEventListener('keydown',e=>{
  if(e.key==='Tab'){e.preventDefault();const a=e.target,start=a.selectionStart,end=a.selectionEnd;a.setRangeText('  ',start,end,'end');a.dispatchEvent(new Event('input'));}
  if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();runAndSaveVersion();}
});
$('#run-code').addEventListener('click',runAndSaveVersion);$('#restart-preview').addEventListener('click',runSketch);
$('#code-history').addEventListener('click',showHistory);
$('#close-history').addEventListener('click',()=>$('#history-dialog').close());
$('#restore-version').addEventListener('click',restoreHistoryVersion);
$('#reset-code').addEventListener('click',()=>{$('#reset-dialog').showModal();});$('#cancel-reset').addEventListener('click',()=>$('#reset-dialog').close());
$('#confirm-reset').addEventListener('click',()=>{$('#code-editor').value=COURSE[current].code;updateEditor();runSketch();$('#reset-dialog').close();toast('Starter code restored. A fresh place to experiment.');});
$('#fullscreen-preview').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('#preview-stage').requestFullscreen)await $('#preview-stage').requestFullscreen();else toast('Use your browser’s zoom to expand this canvas.');}catch{toast('Full screen is unavailable. You can use your browser’s zoom.');}});
$('#demo-play').addEventListener('click',togglePlayback);
$('#demo-restart').addEventListener('click',()=>seekPlayback(0));
$('#demo-seek').addEventListener('input',e=>seekPlayback(e.target.value));
$('#voice-toggle').addEventListener('click',()=>{state.muted=!state.muted;persist();state.muted?stopNarration():speakSegment();updatePlayer();});
$('#continue-captions').addEventListener('click',()=>{state.muted=true;persist();stopNarration();updatePlayer();});
$('#captions-toggle').addEventListener('click',()=>{player.caption=!player.caption;$('#captions-toggle').setAttribute('aria-pressed',String(player.caption));updatePlayer();});
$('#map-button').addEventListener('click',showMap);$('#close-map').addEventListener('click',()=>$('#course-dialog').close());
$('#profile-button').addEventListener('click',openNamePrompt);
$('#learner-name').addEventListener('input',e=>e.target.setCustomValidity(''));
$('#name-form').addEventListener('submit',e=>{
  e.preventDefault();const input=$('#learner-name'),name=normalizeLearnerName(input.value);
  if(!name){input.setCustomValidity('Try a first name or nickname, or choose Maybe later.');input.reportValidity();return;}
  state.learnerName=name;state.namePromptSeen=true;persist();renderPersonalization();$('#name-dialog').close();
});
$('#skip-name').addEventListener('click',()=>$('#name-dialog').close());
$('#name-dialog').addEventListener('close',()=>{state.namePromptSeen=true;persist();});
$('#previous-chapter').addEventListener('click',()=>goChapter(current));$('#next-chapter').addEventListener('click',()=>current===25?showMap():goChapter(current+2));
$('#final-project').addEventListener('click',()=>goChapter(26));$('#mobile-menu').addEventListener('click',()=>$('#sidebar').classList.toggle('mobile-open'));
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#sidebar')&&!e.target.closest('#mobile-menu'))$('#sidebar').classList.remove('mobile-open');});
$('#download-code').addEventListener('click',()=>{saveDraft();const url=URL.createObjectURL(new Blob([$('#code-editor').value],{type:'text/javascript'}));const a=document.createElement('a');a.href=url;a.download=`brick-by-brick-chapter-${current+1}.js`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Sketch downloaded. Try it at editor.p5js.org!');});
window.addEventListener('hashchange',route);window.addEventListener('pagehide',()=>{saveDraft();stopNarration();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&player.playing)pausePlayback();});
for(const d of document.querySelectorAll('dialog'))d.addEventListener('click',e=>{if(e.target===d){const b=d.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)d.close();}});
persist();route();renderPersonalization();
if(!state.learnerName&&!state.namePromptSeen)openNamePrompt();
requestAnimationFrame(animationFrame);
