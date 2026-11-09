const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const curriculum = vm.createContext({});
vm.runInContext(fs.readFileSync('dist/course.js','utf8'),curriculum);
const lessons = vm.runInContext('COURSE',curriculum);
const tracked=['circle','rect','fill','background','frameRate','random','createCanvas','text','line'];
// Mirrors the browser sandbox: calls are recorded per frame, and each circle/rect remembers its fill.
function sketch(code){
  const context={console,Math,width:480,height:320,mouseX:240,mouseY:260,mouseIsPressed:false,frameCount:1,LEFT_ARROW:37,RIGHT_ARROW:39,UP_ARROW:38,DOWN_ARROW:40,CENTER:'center',LEFT:'left',key:'',keyCode:0};
  let setup=true,seed=42,fillState='';
  context.__calls=Object.fromEntries(tracked.map(n=>[n,[]]));context.__setupCalls=Object.fromEntries(tracked.map(n=>[n,[]]));
  context.__resetCalls=()=>{for(const n of tracked)context.__calls[n]=[];};
  for(const name of tracked)context[name]=(...a)=>{
    if(name==='fill')fillState=a.map(String).join(',');
    if(name==='circle'||name==='rect')a.fill=fillState;
    (setup?context.__setupCalls:context.__calls)[name].push(a);
    if(name==='createCanvas'){context.width=a[0];context.height=a[1];}
    if(name==='random'){seed=(seed*1664525+1013904223)>>>0;const t=seed/2**32;if(Array.isArray(a[0]))return a[0][Math.floor(t*a[0].length)];return a.length===2?a[0]+t*(a[1]-a[0]):t*a[0];}
  };
  Object.assign(context,{noStroke(){},textFont(){},textAlign(){},keyIsDown(){return false},abs:Math.abs,max:Math.max,min:Math.min,constrain:(x,a,b)=>Math.max(a,Math.min(b,x)),dist:(a,b,c,d)=>Math.hypot(a-c,b-d),map:(n,a,b,c,d)=>c+(n-a)/(b-a)*(d-c)});
  vm.createContext(context);vm.runInContext(code,context,{timeout:1000});vm.runInContext('setup()',context,{timeout:1000});setup=false;
  const run=s=>vm.runInContext(s,context,{timeout:1000});
  // Like the sandbox, draw() starts each frame with empty call records.
  run('var __userDraw=draw;draw=function(){__resetCalls();__userDraw();};');
  const draw=()=>{run('draw()');context.frameCount++;};
  // Like the sandbox, a check that throws counts as not passed yet.
  const check=t=>{try{return Boolean(run(t));}catch{return false;}};
  draw();draw();return {context,run,draw,check};
}
// Each fixture is a real learner edit. Exercise success must depend on execution.
const T20='// TODO: Send the ball back up. Make speedY negative.';
const T21='// TODO: Break the brick. Set its alive property to false.';
const T22a='// TODO: Add pointsPerBrick to the score.',T22b='// TODO: The ball fell. Take away one life.';
const T23a="// TODO: Launch the ball! Set state to 'playing'.",T23b="// TODO: No lives left. Set state to 'over'.";
const T24='// TODO: Add a new Particle at (x, y) to the particles array.',T25='// TODO: Go to the next level. Add 1 to level.';
const edits=[
  [['circle(240, 160, 80)','circle(240, 160, 120)'],["fill('#ec693f')","fill('#7e73bd')"],['circle(240, 160, 80);',"circle(240, 160, 80);\n  fill('#242b2c');\n  circle(225, 150, 12);\n  circle(255, 150, 12);"]],
  [['circle(120, 100, 60)','circle(240, 160, 60)'],['rect(260, 180, 100, 50)','rect(260, 180, 160, 50)'],['rect(260, 180, 100, 50);','rect(260, 180, 100, 50);\n  circle(20, 20, 10); circle(460, 20, 10); circle(20, 300, 10); circle(460, 300, 10);']],
  [["background('#f5f3eb')","background('#242b2c')"],["fill('#7e73bd')","fill('#9eb994')"],['circle(280, 160, 90);',"circle(280, 160, 90);\n  fill('#7e73bd'); circle(100, 80, 60);\n  fill('#e6bd58'); circle(100, 80, 40);\n  fill('#ec693f'); circle(100, 80, 20);"]],
  [['frameRate(30)','frameRate(15)'],['160, 40)','160, 70)'],['circle(frameCount % width, 160, 40);','circle(frameCount % width, 160, 40);\n  circle(100, frameCount % height, 20);']],
  [['ballSize = 60','ballSize = 100'],['ballX = 240','ballX = 100'],[['let ballSize = 60;','let ballSize = 60;\nlet eyeSize = 12;'],['circle(ballX, ballY, ballSize);',"circle(ballX, ballY, ballSize);\n  fill('#242b2c');\n  circle(ballX - 12, ballY - 8, eyeSize);\n  circle(ballX + 12, ballY - 8, eyeSize);"]]],
  [['speed = 2','speed = 5'],['speed = 2','speed = -3'],[['let lane = 160;','let lane = 160;\nlet y = 40;\nlet speedY = 1;'],['x += speed;','x += speed;\n  y += speedY;'],['width, lane, ballSize','width, y, ballSize']]],
  [['threshold = 240','threshold = 120'],["fastColor = '#ec693f'","fastColor = '#6e8a69'"],['if (x > threshold) {\n    fill(fastColor);\n  }',"if (x > 400) {\n    fill('#e6bd58');\n  } else if (x > threshold) {\n    fill(fastColor);\n  }"]],
  [['speed = 3','speed = 6'],['ballSize = 40','ballSize = 90'],[['let lane = 160;','let lane = 160;\nlet y = 160;\nlet speedY = 2;'],["  fill('#ec693f');\n  circle(x, lane, ballSize);","  y += speedY;\n  if (y > height - radius || y < radius) {\n    speedY *= -1;\n    y = constrain(y, radius, height - radius);\n  }\n  fill('#ec693f');\n  circle(x, y, ballSize);"]]],
  [['cursorSize = 40','cursorSize = 80'],['offset = 65','offset = 30'],['  fill(cursorColor);',"  if (mouseIsPressed) { fill('#7e73bd'); } else { fill(cursorColor); }"]],
  [['speed = 4','speed = 8'],['paddleWidth = 90','paddleWidth = 140'],['  paddleX = constrain(','  if (keyIsDown(UP_ARROW)) paddleY -= speed;\n  if (keyIsDown(DOWN_ARROW)) paddleY += speed;\n  paddleX = constrain(']],
  [['ballSize = 50','ballSize = 90'],['paddleWidth = 100','paddleWidth = 150'],[['  drawPaddle();','  drawPaddle();\n  drawSun();'],['function drawBall() {',"function drawSun() {\n  fill('#e6bd58');\n  circle(400, 60, 50);\n}\n\nfunction drawBall() {"]]],
  [['drawBall(120, 160, 40)','drawBall(120, 160, 20)'],['drawBall(240, 160, 65)','drawBall(240, 90, 65)'],[["function drawBall(x, y, size) {\n  fill('#ec693f');",'function drawBall(x, y, size, ballColor) {\n  fill(ballColor);'],['drawBall(120, 160, 40)',"drawBall(120, 160, 40, '#ec693f')"],['drawBall(240, 160, 65)',"drawBall(240, 160, 65, '#7e73bd')"],['drawBall(360, 160, 90)',"drawBall(360, 160, 90, '#e6bd58')"]]],
  [['count = 5','count = 7'],['spacing = 75','spacing = 55'],['circle(60 + i * spacing, 160, dotSize)','circle(60 + i * spacing, 160, 20 + i * 8)']],
  [['[25, 40, 60, 80]','[70, 40, 60, 80]'],['[25, 40, 60, 80]','[25, 40, 60, 80, 30]'],[['let color = ',"let colors = ['#ec693f', '#7e73bd', '#e6bd58', '#6e8a69'];\nlet color = "],['circle(75 + i * 95','fill(colors[i]);\n    circle(75 + i * 95']]],
  [['rows = 3','rows = 5'],['columns = 6','columns = 4'],['      rect(25',"      if ((row + col) % 2 === 0) { fill('#ec693f'); } else { fill('#7e73bd'); }\n      rect(25"]],
  [['size: 60','size: 100'],[['x: 240','x: 100'],['y: 160','y: 220']],[["  color: '#ec693f'","  color: '#ec693f',\n  speed: 2"],['  fill(ball.color);','  ball.x += ball.speed;\n  fill(ball.color);']]],
  [['new Ball(130, 160, 40)','new Ball(130, 160, 90)'],['new Ball(350, 160, 80)','new Ball(350, 160, 80), new Ball(240, 260, 30)'],[['  display() {','  move() {\n    this.y += 1;\n  }\n\n  display() {'],['    ball.display();','    ball.move();\n    ball.display();']]],
  [['count = 8','count = 15'],['minSize = 15','minSize = 30'],[['size: random(minSize, maxSize)',"size: random(minSize, maxSize), color: random(['#ec693f', '#7e73bd', '#e6bd58', '#6e8a69'])"],['    circle(ball.x, ball.y, ball.size);','    fill(ball.color);\n    circle(ball.x, ball.y, ball.size);']]],
  [['ballSize = 40','ballSize = 80'],["hitColor = '#ec693f'","hitColor = '#7e73bd'"],['    fill(hitColor);',"    fill(hitColor);\n    text('HIT!', 20, 30);"]],
  [[T20,'speedY = -abs(speedY);'],['paddleWidth = 90','paddleWidth = 150'],[['let paddleWidth = 90;','let paddleWidth = 90;\nlet catches = 0;'],['    ballY = paddleY - radius;','    catches += 1;\n    ballY = paddleY - radius;'],['  circle(ballX, ballY, ballSize);',"  circle(ballX, ballY, ballSize);\n  text('CATCHES ' + catches, 20, 24);"]]],
  [[T21,'brick.alive = false;'],['rows = 3','rows = 4'],[['    this.alive = true;','    this.alive = true;\n    this.hits = 2;'],[T21,'brick.hits -= 1;\n      if (brick.hits <= 0) { brick.alive = false; }']]],
  [[T22a,'score += pointsPerBrick;'],[T22b,'lives -= 1;'],[T22a,'if (brick.y === 45) { score += pointsPerBrick * 2; } else { score += pointsPerBrick; }']],
  [[T23a,"state = 'playing';"],[T23b,"state = 'over';"],['function touchMoved() {',"function keyPressed() {\n  if (key === 'p') {\n    if (state === 'playing') { state = 'paused'; } else if (state === 'paused') { state = 'playing'; }\n  }\n}\n\nfunction touchMoved() {"]],
  [[T24,'particles.push(new Particle(x, y));'],['particleCount = 12','particleCount = 24'],['    this.life -= 1;','    this.life -= 1;\n    this.vy += 0.15;']],
  [[T25,'level += 1;'],['levelBoost = 0.5','levelBoost = 0.25'],['    // Each level is a little faster','    paddleWidth = max(50, paddleWidth - 10);\n    // Each level is a little faster']],
  [[["brickColor = '#ec693f'","brickColor = '#7e73bd'"],["paddleColor = '#6e8a69'","paddleColor = '#e6bd58'"]],[['rows = 3','rows = 5'],['columns = 6','columns = 7']],[['let paddleWidth = 90;','let paddleWidth = 90;\nlet highScore = 0;'],["  background('#f5f3eb');","  background('#f5f3eb');\n  if (score > highScore) { highScore = score; }"],['20, 24);',"20, 24);\n  text('BEST ' + highScore, 380, 24);"]]]
];
assert.equal(lessons.length,26);let verified=0;
for(const [i,lesson] of lessons.entries()){
  assert.equal(lesson.story.length,6);assert.equal(lesson.exercises.length,3);
  const starter=sketch(lesson.code);
  for(const [j,exercise] of lesson.exercises.entries()){
    assert.equal(starter.check(exercise.test),false,`Chapter ${i+1} exercise ${j+1} must require a change`);
    let code=lesson.code;const edit=edits[i][j];
    for(const [from,to] of (Array.isArray(edit[0])?edit:[edit])){assert.equal(code.split(from).length,2,`Fixture ${i+1}/${j+1} must match exactly once: ${from}`);code=code.replace(from,to);}
    const edited=sketch(code);assert.equal(edited.check(exercise.test),true,`Chapter ${i+1} exercise ${j+1} should accept the learner's edit`);verified++;
  }
}
// Common mistakes must not pass the write-it-yourself challenges.
const wrongEdits=[
  [1,2,[['circle(240, 160, 80);',"circle(225, 150, 12);\n  circle(255, 150, 12);\n  circle(240, 160, 80);"]],'eyes hidden behind the face'],
  [7,2,[['if (x > threshold) {\n    fill(fastColor);\n  }',"if (x > threshold) {\n    fill(fastColor);\n  } else if (x > 400) {\n    fill('#e6bd58');\n  }"]],'else if in an order that can never run'],
  [11,2,[['function drawBall() {',"function drawSun() {\n  circle(400, 60, 50);\n}\n\nfunction drawBall() {"]],'function written but never called'],
  [21,2,[['    this.alive = true;','    this.alive = true;\n    this.hits = 2;'],[T21,'brick.hits -= 1;\n      brick.alive = false;']],'brick still breaks on the first hit'],
  [23,2,[['function touchMoved() {',"function keyPressed() {\n  if (key === 'p') { state = 'paused'; }\n}\n\nfunction touchMoved() {"]],'pause that can never be undone'],
  [25,2,[['    // Each level is a little faster','    paddleWidth -= 10;\n    // Each level is a little faster']],'paddle shrinks with no lower limit']
];
for(const [id,j,changes,why] of wrongEdits){
  let code=lessons[id-1].code;
  for(const [from,to] of changes){assert.equal(code.split(from).length,2,`Wrong-edit fixture ${id}: ${from}`);code=code.replace(from,to);}
  assert.equal(sketch(code).check(lessons[id-1].exercises[j].test),false,`Chapter ${id} exercise ${j+1} must reject: ${why}`);
}
// The game chapters build on each other: each one leaves TODOs only for its new idea.
for(const id of [20,21,22,23,24,25])assert.ok(lessons[id-1].code.includes('// TODO:'),`Chapter ${id} should leave a TODO for the learner`);
for(const id of [21,22,23,24,25])assert.ok(lessons[id-1].code.includes('✨ NEW'),`Chapter ${id} should mark its new lines`);
assert.ok(!/TODO|✨/.test(lessons[25].code),'The final game is complete and unmarked');
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
