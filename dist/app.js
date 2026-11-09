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
try { saved = JSON.parse(localStorage.getItem('brick-by-brick-v1') || '{}'); } catch { saved = {}; storageAvailable = false; }
const state = {drafts:saved.drafts || {}, passed:saved.passed || {}, muted:!!saved.muted};
let current=0, expanded=new Set([0]), runId=0, runtimeError=false, runReady=false, draftTimer;
let pendingChecks = new Map(), checkSerial=0;
const player = {time:0,playing:false,caption:true,segment:-1,last:0};
function persist() {
  try {localStorage.setItem('brick-by-brick-v1',JSON.stringify(state));} catch {storageAvailable=false;}
  if(!storageAvailable) $('#save-status').textContent='Progress available this visit';
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
  $('#line-numbers').textContent=Array.from({length:value.split('\n').length+1},(_,i)=>i+1).join('\n');
  syncScroll();updateCursor();
}
function syncScroll(){const el=$('#code-editor');$('#code-highlight').scrollTop=el.scrollTop;$('#code-highlight').scrollLeft=el.scrollLeft;$('#line-numbers').scrollTop=el.scrollTop;}
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
  if($('#code-editor').value)saveDraft();
  current=Math.max(0,Math.min(COURSE.length-1,index));
  const l=COURSE[current],u=UNITS[l.unit];expanded.add(l.unit);
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
    const __send=(type,data={})=>parent.postMessage({source:'brick-sketch',runId:__runId,type,...data},'*');
    let __hasError=false;
    window.onerror=(message,source,line,column)=>{__hasError=true;__send('error',{message:String(message),line,column});return true;};
    window.onunhandledrejection=e=>{__hasError=true;__send('error',{message:String(e.reason?.message||e.reason)});};
    window.__calls={};window.__setupCalls={};
    const __tracked=['circle','rect','fill','background','frameRate','random','createCanvas','text','line'];
    for(const n of __tracked){window.__calls[n]=[];window.__setupCalls[n]=[];}
    let __recordSetup=true;
    function __instrument(){for(const n of __tracked){const original=window[n];window[n]=function(...args){const store=__recordSetup?window.__setupCalls:window.__calls;if(store[n].length<10000)store[n].push(args);return original.apply(this,args);};}}
    window.addEventListener('message',e=>{if(e.source!==parent||e.data?.type!=='inspect'||e.data.runId!==__runId)return;let results=e.data.tests.map(test=>{try{return !__hasError&&Boolean((0,eval)(test));}catch{return false;}});__send('checks',{request:e.data.request,results});});
    window.addEventListener('load',()=>{setTimeout(()=>{const canvas=document.querySelector('canvas');if(canvas){canvas.tabIndex=0;canvas.setAttribute('aria-label','Interactive p5.js canvas. Click to focus.');canvas.addEventListener('pointerdown',()=>canvas.focus());}if(!__hasError)__send('ready',{width:window.width,height:window.height});},120);});
  <\/script><script src="${escapeHTML(p5url)}" onerror="__send('error',{message:'The p5.js library could not load. Reload this page and try again.'})"><\/script><script>
    const __script=document.createElement('script');__script.textContent=${payload};document.head.appendChild(__script);
    const __originalSetup=window.setup;
    const __originalDraw=window.draw;
    if(__originalSetup)window.setup=function(){__instrument();__originalSetup();__recordSetup=false;};
    if(__originalDraw)window.draw=function(){for(const n of __tracked)window.__calls[n]=[];__originalDraw();};
  <\/script></head><body></body></html>`;
}
function runSketch(){
  saveDraft();runId++;runtimeError=false;runReady=false;
  for(const request of pendingChecks.values()){clearTimeout(request.timer);request.resolve(null);}pendingChecks.clear();
  $('#runtime-message').classList.remove('visible');$('#runtime-message').textContent='';$('#run-status').textContent='Starting…';
  const code=$('#code-editor').value;
  try {new Function(code);}catch(e){showError(e.message);return;}
  $('#sketch-frame').srcdoc=frameDocument(code,runId);
}
function showError(message){runtimeError=true;runReady=false;$('#run-status').textContent='Let’s fix this';$('#runtime-message').textContent=`A clue from JavaScript: ${message}\nCheck your spelling, brackets, and quotes, then try Run code again.`;$('#runtime-message').classList.add('visible');}
window.addEventListener('message',e=>{
  const d=e.data;if(e.source!==$('#sketch-frame').contentWindow||d?.source!=='brick-sketch'||d.runId!==runId)return;
  if(d.type==='error')showError(d.message);
  if(d.type==='ready'&&!runtimeError){runReady=true;$('#run-status').textContent='Running';$('#canvas-size').textContent=`${d.width || 480} × ${d.height || 320}`;}
  if(d.type==='checks'){const req=pendingChecks.get(d.request);if(req){clearTimeout(req.timer);pendingChecks.delete(d.request);req.resolve(d.results);}}
});
function inspect(tests){return new Promise(resolve=>{const request=++checkSerial;const timer=setTimeout(()=>{pendingChecks.delete(request);resolve(null);},3000);pendingChecks.set(request,{resolve,timer});$('#sketch-frame').contentWindow.postMessage({type:'inspect',runId,request,tests},'*');});}
async function checkExercise(i){
  const chapter=current,lesson=COURSE[current],result=$(`#result-${i}`),button=$(`[data-check="${i}"]`);
  if($('#code-editor').value!==state.drafts[current+1])saveDraft();
  // Always run the current editor contents so feedback never checks an old preview.
  button.disabled=true;button.textContent='Running…';result.className='check-result';result.textContent='Trying your latest sketch…';runSketch();
  const expectedRun=runId,start=performance.now();
  while(!runReady&&!runtimeError&&runId===expectedRun&&performance.now()-start<4500)await new Promise(r=>setTimeout(r,60));
  if(current!==chapter)return;
  let response=null;if(runReady&&!runtimeError&&runId===expectedRun)response=await inspect([lesson.exercises[i].test]);
  if(current!==chapter)return;
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

function stopNarration(){if('speechSynthesis'in window)speechSynthesis.cancel();}
function speakSegment(){
  stopNarration();if(state.muted||!player.playing)return;
  if(!('speechSynthesis'in window)||!('SpeechSynthesisUtterance'in window)){$('#voice-note').textContent='Your browser has no narration voice · Follow the captions below the animation';return;}
  const sentence=COURSE[current].story[Math.min(5,Math.floor(player.time/10))];
  const utterance=new SpeechSynthesisUtterance(sentence);utterance.lang='en-US';utterance.rate=Math.max(1,Math.min(1.3,sentence.split(/\s+/).length/24));
  const voices=speechSynthesis.getVoices();const voice=voices.find(v=>v.lang==='en-US'&&/samantha|aria|jenny|google us/i.test(v.name)) || voices.find(v=>v.lang.startsWith('en'));
  if(voice)utterance.voice=voice;
  utterance.onerror=e=>{if(!['interrupted','canceled'].includes(e.error))$('#voice-note').textContent='Voice is unavailable in this browser · Follow the captions below the animation';};
  speechSynthesis.speak(utterance);
}
function updatePlayer(){
  $('#demo-play').innerHTML=player.playing?icons.pause:icons.play;
  $('#demo-play').setAttribute('aria-label',player.playing?'Pause explanation':player.time>=60?'Replay explanation':'Play one-minute explanation');
  $('#voice-toggle').innerHTML=state.muted?icons.mute:icons.sound;$('#voice-toggle').setAttribute('aria-label',state.muted?'Turn narration on':'Mute narration');$('#voice-toggle').setAttribute('aria-pressed',String(state.muted));
  $('#demo-time').innerHTML=`${Math.floor(player.time/60)}:${String(Math.floor(player.time%60)).padStart(2,'0')} <span>/ 1:00</span>`;$('#demo-seek').value=player.time;
  const seg=Math.min(5,Math.floor(player.time/10));
  $('#demo-caption').textContent=player.caption?COURSE[current].story[seg]:'';
  $('#concept-canvas').setAttribute('aria-label',COURSE[current].story[seg]);
  if(seg!==player.segment){player.segment=seg;if(player.playing)speakSegment();}
}
function togglePlayback(){if(player.time>=60){player.time=0;player.segment=-1;}player.playing=!player.playing;player.last=performance.now();if(player.playing)speakSegment();else stopNarration();updatePlayer();}

// Purpose-built canvas diagrams; animation is rendered locally, with no video service.
const ctx=$('#concept-canvas').getContext('2d');
function rounded(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke();}}
function label(text,x,y,size=17,color='#817696',align='left',font='DM Sans'){ctx.font=`${size}px "${font}", sans-serif`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(text,x,y);}
function ball(x,y,r,color='#ec693f'){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
function arrow(x1,y1,x2,y2,color='#b5abc9'){ctx.strokeStyle=color;ctx.lineWidth=1.7;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(x2-7,y2-5);ctx.lineTo(x2,y2);ctx.lineTo(x2-7,y2+5);ctx.stroke();}
function drawConcept(now){
  const c=COURSE[current].concept, t=player.time, phase=Math.min(5,Math.floor(t/10));
  const movement=player.playing?t:0;
  ctx.clearRect(0,0,900,350);
  const codes={canvas:['function setup() {','  createCanvas(480, 320);','}','circle(240, 160, 80);'],coordinates:['x → across','y ↓ down','circle(x, y, size);'],color:["fill('#ec693f');",'circle(240, 160, 80);',"fill('#7e73bd');"],loop:['setup()  →  once','draw()   →  again','         ↳ again ↺'],variables:['let ballSize = 60;','', 'circle(x, y, ballSize);'],movement:['let speed = 2;','x += speed;','circle(x, 160, 40);'],conditions:['if (x > threshold) {',"  fill('#ec693f');",'} else { /* purple */ }'],bounce:['if (touchingWall) {','  speed *= -1;','}'],mouse:['mouseX → x','mouseY → y','circle(mouseX, mouseY, 40);'],keyboard:['if (keyIsDown(→)) {','  paddleX += speed;','}'],functions:['function drawBall() {','  // your recipe','}','drawBall();'],parameters:['drawBall(120, 160, 40);','drawBall(240, 160, 65);','drawBall(360, 160, 90);'],for:['for (let i = 0;','     i < 5; i++) {','  circle(60+i*75,160,30);','}'],arrays:['let sizes = [25,40,60,80];','sizes[0] → 25','sizes.length → 4'],grid:['for (each row) {','  for (each column) {','    draw a brick','  }','}'],objects:['ball = {','  x: 240, y: 160,','  size: 60','}'],classes:['class Ball { ... }','new Ball(130,160,40);','new Ball(350,160,80);'],random:['random(50, 430)','random(15, 45)','// a new possibility'],collision:['nearest = constrain(...)','gap = dist(ball, nearest)','touching = gap < radius'],paddle:['if (touchingPaddle) {','  speedY = -abs(speedY);','}'],bricks:['if (hit && brick.alive) {','  brick.alive = false;','}'],score:['score += 10;','lives -= 1;','text(score, 20, 24);'],states:["state = 'ready';","click → 'playing'","no lives → 'over'"],particles:['particles.push({...});','life -= 1;','// move, fade, remove'],levels:['if (allBricksGone) {','  level += 1;','  makeBricks();','}'],game:['curiosity + small steps','        ↓','your very own game.']};
  const lines=codes[c]||codes.canvas;
  rounded(25,67,305,202,9,'#f8f6fd','#ddd6ed');
  ball(43,84,3,'#d3c7e5');ball(55,84,3,'#d3c7e5');ball(67,84,3,'#d3c7e5');
  lines.forEach((line,i)=>label(line,43,116+i*26,14,line.startsWith('//')?'#aaa1b6':i%2?'#a27b5c':'#8a79a5','left','IBM Plex Mono'));
  label('a few instructions',177,303,13,'#aaa0bc','center');
  arrow(344,170,391,170);
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
    if(c==='score')label('SCORE  30      LIVES  3',ox+25,oy+19,10,'#8b9480','left','IBM Plex Mono');
    if(c==='levels')label('LEVEL  '+(phase>3?'2':'1'),bx,oy+168,17,'#9e91ae','center','IBM Plex Mono');
    if(c==='states'&&phase<3){rounded(ox+70,oy+107,275,57,6,'#faf9f4ee');label(phase<1?'READY':'CLICK TO LAUNCH',bx,oy+143,16,'#8c7a9e','center','IBM Plex Mono');}
    if(c==='particles')for(let i=0;i<10;i++){const a=i*.628,rad=15+(movement*25+i*3)%60;ball(bx+Math.cos(a)*rad,oy+100+Math.sin(a)*rad,2.8,'#e5ad8b');}
  }else if(['for','arrays','parameters','classes'].includes(c)){
    const n=c==='for'?5:c==='arrays'?4:3;
    for(let i=0;i<n;i++){const r=c==='for'?14:12+i*9;ball(ox+65+i*(w-110)/(n-1),by,r,i%2?'#9e8abc':'#ec906f');if(c==='arrays')label('['+i+']',ox+65+i*(w-110)/(n-1),oy+h-39,13,'#aaa0b3','center','IBM Plex Mono');}
  }else if(c==='random'){
    for(let i=0;i<8;i++){const seed=i*7+(phase+1)*3;ball(ox+30+(Math.sin(seed)*.5+.5)*(w-65),oy+28+(Math.cos(seed*3)*.5+.5)*(h-60),8+(Math.sin(seed*2)*.5+.5)*13,'#b09bc9');}
  }else if(c==='collision'){
    const x=bx+Math.sin(movement*.9)*130;rounded(bx-70,by-20,140,40,4,Math.abs(x-bx)<92?'#ec906f':'#a7bc99');ball(x,by-36,19,'#a391c2');
  }else if(c==='keyboard'){
    const px=bx+Math.sin(movement)*100;rounded(px-45,by+35,90,12,5,'#99b18d');label('←    →',bx,by-17,28,'#b1a4c6','center','IBM Plex Mono');
  }else if(c==='objects'){
    ball(bx,by,35);arrow(bx+40,by,bx+95,by);label('ball.size',bx+103,by+5,13,'#a392b6','left','IBM Plex Mono');
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
      label('x: 240',x,oy+22,11,'#aea1ba','center','IBM Plex Mono');label('y: 160',ox+15,y-13,11,'#aea1ba','left','IBM Plex Mono');
    }
    if(c==='mouse'){ctx.beginPath();ctx.moveTo(x+9,y+6);ctx.lineTo(x+9,y+28);ctx.lineTo(x+16,y+22);ctx.lineTo(x+24,y+22);ctx.closePath();ctx.fillStyle='#f7f3fc';ctx.fill();ctx.strokeStyle='#9686a6';ctx.stroke();}
  }
  ctx.restore();
  label('a world of possibilities',617,324,13,'#aaa0bc','center');
  label('↗',842,72,25,'#c5bcd5');
}
function animationFrame(now){
  if(player.playing){const delta=Math.min((now-player.last)/1000,.2);player.time=Math.min(60,player.time+delta);if(player.time>=60){player.playing=false;stopNarration();}updatePlayer();}
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
  if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();runSketch();}
});
$('#run-code').addEventListener('click',runSketch);$('#restart-preview').addEventListener('click',runSketch);
$('#reset-code').addEventListener('click',()=>{$('#reset-dialog').showModal();});$('#cancel-reset').addEventListener('click',()=>$('#reset-dialog').close());
$('#confirm-reset').addEventListener('click',()=>{$('#code-editor').value=COURSE[current].code;updateEditor();runSketch();$('#reset-dialog').close();toast('Starter code restored. A fresh place to experiment.');});
$('#fullscreen-preview').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('#preview-stage').requestFullscreen)await $('#preview-stage').requestFullscreen();else toast('Use your browser’s zoom to expand this canvas.');}catch{toast('Full screen is unavailable. You can use your browser’s zoom.');}});
$('#demo-play').addEventListener('click',togglePlayback);
$('#demo-restart').addEventListener('click',()=>{player.time=0;player.segment=-1;player.last=performance.now();stopNarration();updatePlayer();});
$('#demo-seek').addEventListener('input',e=>{player.time=+e.target.value;player.segment=-1;player.last=performance.now();stopNarration();updatePlayer();});
$('#voice-toggle').addEventListener('click',()=>{state.muted=!state.muted;persist();state.muted?stopNarration():speakSegment();updatePlayer();});
$('#captions-toggle').addEventListener('click',()=>{player.caption=!player.caption;$('#captions-toggle').setAttribute('aria-pressed',String(player.caption));updatePlayer();});
$('#map-button').addEventListener('click',showMap);$('#close-map').addEventListener('click',()=>$('#course-dialog').close());
$('#previous-chapter').addEventListener('click',()=>goChapter(current));$('#next-chapter').addEventListener('click',()=>current===25?showMap():goChapter(current+2));
$('#final-project').addEventListener('click',()=>goChapter(26));$('#mobile-menu').addEventListener('click',()=>$('#sidebar').classList.toggle('mobile-open'));
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#sidebar')&&!e.target.closest('#mobile-menu'))$('#sidebar').classList.remove('mobile-open');});
$('#download-code').addEventListener('click',()=>{saveDraft();const url=URL.createObjectURL(new Blob([$('#code-editor').value],{type:'text/javascript'}));const a=document.createElement('a');a.href=url;a.download=`brick-by-brick-chapter-${current+1}.js`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Sketch downloaded. Try it at editor.p5js.org!');});
window.addEventListener('hashchange',route);window.addEventListener('pagehide',()=>{saveDraft();stopNarration();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&player.playing){player.playing=false;stopNarration();updatePlayer();}});
for(const d of document.querySelectorAll('dialog'))d.addEventListener('click',e=>{if(e.target===d){const b=d.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)d.close();}});
persist();route();requestAnimationFrame(animationFrame);
