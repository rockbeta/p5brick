const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const curriculum = vm.createContext({});
vm.runInContext(fs.readFileSync('dist/course.js','utf8'),curriculum);
const lessons = vm.runInContext('COURSE',curriculum);
const tracked=['circle','rect','fill','background','frameRate','random','createCanvas','text','line'];
function sketch(code){
  const context={console,Math,width:480,height:320,mouseX:240,mouseY:260,frameCount:1,LEFT_ARROW:37,RIGHT_ARROW:39,CENTER:'center',LEFT:'left',keyCode:0};
  let setup=true,seed=42;
  context.__calls=Object.fromEntries(tracked.map(n=>[n,[]]));context.__setupCalls=Object.fromEntries(tracked.map(n=>[n,[]]));
  for(const name of tracked)context[name]=(...a)=>{
    (setup?context.__setupCalls:context.__calls)[name].push(a);
    if(name==='createCanvas'){context.width=a[0];context.height=a[1];}
    if(name==='random'){seed=(seed*1664525+1013904223)>>>0;return a.length===2?a[0]+seed/2**32*(a[1]-a[0]):seed/2**32*a[0];}
  };
  Object.assign(context,{noStroke(){},textFont(){},textAlign(){},keyIsDown(){return false},abs:Math.abs,constrain:(x,a,b)=>Math.max(a,Math.min(b,x)),dist:(a,b,c,d)=>Math.hypot(a-c,b-d),map:(n,a,b,c,d)=>c+(n-a)/(b-a)*(d-c)});
  vm.createContext(context);vm.runInContext(code,context,{timeout:1000});vm.runInContext('setup()',context,{timeout:1000});setup=false;
  const run=s=>vm.runInContext(s,context,{timeout:1000});
  const draw=()=>{for(const n of tracked)context.__calls[n]=[];run('draw()');context.frameCount++;};
  draw();return {context,run,draw};
}
// Each fixture is a real learner edit. Exercise success must depend on execution.
const edits=[
  [['circle(240, 160, 80)','circle(240, 160, 120)'],["fill('#ec693f')","fill('#7e73bd')"],['circle(240, 160, 80);','circle(240, 160, 80); rect(200, 240, 80, 12);']],
  [['circle(120, 100, 60)','circle(240, 160, 60)'],['rect(260, 180, 100, 50)','rect(260, 180, 160, 50)'],['circle(120, 100, 60);','circle(120, 100, 60); circle(40, 40, 20);']],
  [["background('#f5f3eb')","background('#242b2c')"],["fill('#7e73bd')","fill('#9eb994')"],['circle(280, 160, 90);',"circle(280, 160, 90); fill('#e6bd58'); circle(240, 160, 40);"]],
  [['frameRate(30)','frameRate(15)'],['160, 40)','160, 70)'],['% width, 160','% width, 240']],
  [['ballSize = 60','ballSize = 100'],['ballX = 240','ballX = 100'],['ballY = 160','ballY = 240']],
  [['speed = 2','speed = 5'],['speed = 2','speed = -3'],[['ballSize = 40','ballSize = 70'],['lane = 160','lane = 100']]],
  [['threshold = 240','threshold = 120'],["fastColor = '#ec693f'","fastColor = '#6e8a69'"],["slowColor = '#7e73bd'","slowColor = '#e6bd58'"]],
  [['speed = 3','speed = 6'],['ballSize = 40','ballSize = 90'],['lane = 160','lane = 250']],
  [['cursorSize = 40','cursorSize = 80'],['offset = 65','offset = 30'],["cursorColor = '#ec693f'","cursorColor = '#7e73bd'"]],
  [['speed = 4','speed = 8'],['paddleWidth = 90','paddleWidth = 140'],['paddleY = 260','paddleY = 210']],
  [['ballSize = 50','ballSize = 90'],['paddleWidth = 100','paddleWidth = 150'],["ballColor = '#ec693f'","ballColor = '#7e73bd'"]],
  [['drawBall(120, 160, 40)','drawBall(120, 160, 20)'],['drawBall(240, 160, 65)','drawBall(240, 90, 65)'],['drawBall(360, 160, 90);','drawBall(360, 160, 90); drawBall(240, 260, 35);']],
  [['count = 5','count = 7'],['spacing = 75','spacing = 55'],['dotSize = 30','dotSize = 45']],
  [['[25, 40, 60, 80]','[70, 40, 60, 80]'],['[25, 40, 60, 80]','[25, 40, 60, 80, 30]'],["color = '#7e73bd'","color = '#ec693f'"]],
  [['rows = 3','rows = 5'],['columns = 6','columns = 4'],['brickHeight = 20','brickHeight = 12']],
  [['size: 60','size: 100'],[['x: 240','x: 100'],['y: 160','y: 220']],["color: '#ec693f'","color: '#7e73bd'"]],
  [['new Ball(130, 160, 40)','new Ball(130, 160, 90)'],['new Ball(350, 160, 80)','new Ball(350, 160, 80), new Ball(240, 260, 30)'],['new Ball(350, 160, 80)','new Ball(350, 80, 80)']],
  [['count = 8','count = 15'],['minSize = 15','minSize = 30'],['maxSize = 45','maxSize = 80']],
  [['ballSize = 40','ballSize = 80'],['w: 160','w: 80'],["hitColor = '#ec693f'","hitColor = '#7e73bd'"]],
  [['paddleWidth = 90','paddleWidth = 150'],['ballSize = 16','ballSize = 30'],["paddleColor = '#6e8a69'","paddleColor = '#7e73bd'"]],
  [['rows = 3','rows = 4'],['columns = 6','columns = 5'],["brickColor = '#ec693f'","brickColor = '#7e73bd'"]],
  [['pointsPerBrick = 10','pointsPerBrick = 25'],['lives = 3','lives = 5'],['ballSize = 14','ballSize = 24']],
  [["state = 'ready'","state = 'playing'"],['lives = 3','lives = 1'],['paddleWidth = 90','paddleWidth = 130']],
  [['particleCount = 12','particleCount = 24'],["brickColor = '#ec693f'","brickColor = '#e6bd58'"],['speedX = 3','speedX = 5']],
  [['levelBoost = 0.5','levelBoost = 0.25'],['rows = 3','rows = 4'],['pointsPerBrick = 10','pointsPerBrick = 50']],
  [[["brickColor = '#ec693f'","brickColor = '#7e73bd'"],["paddleColor = '#6e8a69'","paddleColor = '#e6bd58'"]],[['rows = 3','rows = 5'],['columns = 6','columns = 7']],[['paddleWidth = 90','paddleWidth = 110'],['pointsPerBrick = 10','pointsPerBrick = 20']]]
];
assert.equal(lessons.length,26);let verified=0;
for(const [i,lesson] of lessons.entries()){
  assert.equal(lesson.story.length,6);assert.equal(lesson.exercises.length,3);
  const starter=sketch(lesson.code);
  for(const [j,exercise] of lesson.exercises.entries()){
    assert.equal(starter.run(exercise.test),false,`Chapter ${i+1} exercise ${j+1} must require a change`);
    let code=lesson.code;const edit=edits[i][j];
    for(const [from,to] of (Array.isArray(edit[0])?edit:[edit])){assert.ok(code.includes(from),`Missing fixture ${i+1}/${j+1}: ${from}`);code=code.replace(from,to);}
    const edited=sketch(code);assert.equal(edited.run(exercise.test),true,`Chapter ${i+1} exercise ${j+1} should accept the learner's edit`);verified++;
  }
}
// Check the complete game through actual state transitions and physics events.
const game=sketch(lessons[25].code);
assert.equal(game.run('state'),'ready');
const start=game.run('ballY');game.draw();assert.equal(game.run('ballY'),start,'Ready state must not move the ball');
game.run('mousePressed()');assert.equal(game.run('state'),'playing');game.draw();assert.notEqual(game.run('ballY'),start);
game.run('ballX=bricks[0].x+bricks[0].w/2; ballY=bricks[0].y+bricks[0].h+5; speedX=0; speedY=-3');game.draw();
assert.equal(game.run('bricks[0].alive'),false);assert.equal(game.run('score'),10);assert.ok(game.run('speedY')>0);assert.ok(game.run('particles.length')>0);
game.run('ballX=240;ballY=284;speedX=0;speedY=3');game.draw();assert.ok(game.run('speedY')<0,'Paddle must bounce a descending ball upward');
game.run('lives=1;ballY=340;speedY=3');game.draw();assert.equal(game.run('state'),'over');assert.equal(game.run('lives'),0);
game.run('mousePressed()');assert.equal(game.run('state'),'ready');assert.equal(game.run('lives'),3);assert.equal(game.run('score'),0);
game.run("mousePressed(); score=100; bricks.forEach(b=>b.alive=false)");game.draw();assert.equal(game.run('level'),2);assert.equal(game.run('score'),100);assert.equal(game.run('state'),'ready');assert.equal(game.run('bricks.length'),18);assert.equal(game.run('speedY'),-3.5);
game.run('particles.forEach(p=>p.life=1)');game.draw();assert.equal(game.run('particles.length'),0,'Expired particles must be removed');
console.log(`PASS: 26 starter sketches; ${verified} exercises reject unchanged code and accept correct edits; final-game launch, hit, paddle bounce, game over, restart, level progression, and particle cleanup.`);
