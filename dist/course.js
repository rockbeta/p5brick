/* The curriculum is plain JavaScript so lessons can be edited without a build tool. */
const UNITS = [
  { name: 'The foundations', subtitle: 'Meet your canvas', icon: '◈', start: 1, end: 6 },
  { name: 'Take control', subtitle: 'Make your code think', icon: '⌘', start: 7, end: 12 },
  { name: 'Your coding toolkit', subtitle: 'Build bigger ideas', icon: '⊞', start: 13, end: 18 },
  { name: 'Build your arcade', subtitle: 'Put it all together', icon: '⚑', start: 19, end: 26 }
];
const E = (title, prompt, hint, test, success) => ({title,prompt,hint,test,success:success || 'You did it! Your running sketch matches the goal.'});
const base = (body, setup = '') => `function setup() {\n  createCanvas(480, 320);\n  noStroke();${setup ? '\n  '+setup : ''}\n}\n\nfunction draw() {\n  background('#f5f3eb');\n${body}\n}`;

// Chapters 20-26 build one arcade game. Each chapter starts from the finished
// code of the chapter before, marks what is new, and leaves a TODO for the key idea.
function gameCode(stage) {
  const has = s => stage >= s;
  const fresh = s => stage === s && stage < 26;
  const mark = s => fresh(s) ? ' // ✨ NEW' : '';
  const block = s => fresh(s) ? '// ✨ NEW in this chapter\n' : '';
  // A TODO replaces the solution only in the chapter that teaches it.
  const todo = (s, pad, task, solution) => fresh(s) ? `${pad}// TODO: ${task}` : solution.split('\n').map(l => pad + l).join('\n');
  const lines = (...parts) => parts.filter(p => p !== false).join('\n');
  const p = has(23) ? '    ' : '  ';
  const ended = has(25) ? "state === 'over'" : "state === 'over' || state === 'won'";

  const header = lines(
    '// Your arcade, built one idea at a time.',
    stage > 20 && stage < 26 && '// Look for ✨ NEW to see what this chapter adds.',
    '',
    'let ballX = 240, ballY = 230;',
    'let speedX = 3, speedY = -3;',
    'let ballSize = 14;',
    'let paddleX = 195;',
    'let paddleY = 288;',
    'let paddleWidth = 90;',
    "let paddleColor = '#6e8a69';",
    has(21) && 'let columns = 6, rows = 3;' + mark(21),
    has(21) && "let brickColor = '#ec693f';" + mark(21),
    has(21) && 'let bricks = [];' + mark(21),
    has(22) && 'let score = 0;' + mark(22),
    has(22) && 'let startingLives = 3;' + mark(22),
    has(22) && 'let lives = startingLives;' + mark(22),
    has(22) && 'let pointsPerBrick = 10;' + mark(22),
    has(23) && "let state = 'ready';" + mark(23),
    has(24) && 'let particles = [];' + mark(24),
    has(24) && 'let particleCount = 12;' + mark(24),
    has(25) && 'let level = 1;' + mark(25),
    has(25) && 'let levelBoost = 0.5;' + mark(25)
  );

  const brickClass = has(21) ? `

${block(21)}// The blueprint for every brick (chapter 17).
class Brick {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.alive = true;
  }

  display() {
    fill(brickColor);
    rect(this.x, this.y, this.w, this.h, 3);
  }
}` : '';

  const particleClass = has(24) ? `

${block(24)}// A tiny spark that flies, fades, and disappears.
class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = random(-3, 3);
    this.vy = random(-3, 3);
    this.life = 30;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= 1;
  }

  display() {
    // The 4th fill number is see-through-ness. It fades as life runs out.
    fill(236, 105, 63, this.life * 8);
    circle(this.x, this.y, 4);
  }
}` : '';

  const setup = `

function setup() {
  createCanvas(480, 320);
  noStroke();
  textFont('monospace');${has(21) ? '\n  makeBricks();' + mark(21) : ''}
}`;

  const draw = `

// draw() reads like a to-do list. Each job has its own function.
function draw() {
  background('#f5f3eb');
  movePaddle();
${lines(
    has(23) && "  if (state === 'playing') {" + mark(23),
    p + 'moveBall();',
    p + 'bounceOffPaddle();',
    has(21) && p + 'breakBricks();' + mark(21),
    p + 'checkMiss();',
    has(21) && p + 'checkWallCleared();' + mark(21),
    has(23) && '  }' + mark(23),
    has(21) && '  drawBricks();' + mark(21),
    '  drawPaddleAndBall();',
    has(24) && '  drawParticles();' + mark(24),
    has(22) && '  drawScore();' + mark(22),
    has(23) && '  drawMessage();' + mark(23)
  )}
}`;

  const movement = `

function movePaddle() {
  // Mouse or touch steers the paddle. constrain() keeps it on the canvas.
  paddleX = constrain(mouseX - paddleWidth / 2, 0, width - paddleWidth);
}

function moveBall() {
  ballX += speedX;
  ballY += speedY;
  let radius = ballSize / 2;
  // || means OR: touching either side wall counts.
  if (ballX < radius || ballX > width - radius) {
    speedX *= -1;
    ballX = constrain(ballX, radius, width - radius);
  }
  if (ballY < radius) {
    // abs() removes a minus sign, so the ball heads down.
    speedY = abs(speedY);
  }
}

function bounceOffPaddle() {
  let radius = ballSize / 2;
  let movingDown = speedY > 0;
  let lowEnough = ballY + radius >= paddleY && ballY - radius <= paddleY + 9;
  let overPaddle = ballX + radius > paddleX && ballX - radius < paddleX + paddleWidth;
  // && means AND: all three must be true to catch the ball.
  if (movingDown && lowEnough && overPaddle) {
${todo(20, '    ', 'Send the ball back up. Make speedY negative.', 'speedY = -abs(speedY);')}
    ballY = paddleY - radius;
    // Hitting near an edge of the paddle sends the ball sideways.
    speedX = (ballX - (paddleX + paddleWidth / 2)) / 10;
  }
}`;

  const bricks = has(21) ? `

${block(21)}// Nested loops build the wall (chapter 15).
function makeBricks() {
  bricks = [];
  let brickWidth = 440 / columns;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      bricks.push(new Brick(20 + col * brickWidth, 45 + row * 24, brickWidth - 6, 17));
    }
  }
}

${block(21)}function breakBricks() {
  let radius = ballSize / 2;
  for (let brick of bricks) {
    // The nearest-point test from chapter 19.
    let nearX = constrain(ballX, brick.x, brick.x + brick.w);
    let nearY = constrain(ballY, brick.y, brick.y + brick.h);
    if (brick.alive && dist(ballX, ballY, nearX, nearY) < radius) {
${lines(
    todo(21, '      ', 'Break the brick. Set its alive property to false.', 'brick.alive = false;'),
    '      speedY *= -1;',
    has(22) && todo(22, '      ', 'Add pointsPerBrick to the score.', 'score += pointsPerBrick;'),
    has(24) && '      burst(ballX, ballY);' + mark(24),
    '      // break stops the loop, so the ball only hits one brick per frame.',
    '      break;'
  )}
    }
  }
}

${block(21)}function checkWallCleared() {
  // Count the bricks that are still alive.
  let bricksLeft = 0;
  for (let brick of bricks) {
    if (brick.alive) {
      bricksLeft += 1;
    }
  }
  if (bricksLeft === 0) {
${has(25) ? lines(
    todo(25, '    ', 'Go to the next level. Add 1 to level.', 'level += 1;'),
    '    // Each level is a little faster than the last.' + mark(25),
    '    speedY = -(3 + (level - 1) * levelBoost);' + mark(25),
    '    makeBricks();',
    '    resetBall();',
    "    state = 'ready';"
  ) : has(23) ? "    state = 'won';" + mark(23) : '    makeBricks();\n    resetBall();'}
  }
}

${block(21)}function drawBricks() {
  for (let brick of bricks) {
    if (brick.alive) {
      brick.display();
    }
  }
}` : '';

  const miss = `

function checkMiss() {
  if (ballY > height + ballSize / 2) {
${lines(
    has(22) && todo(22, '    ', 'The ball fell. Take away one life.', 'lives -= 1;'),
    stage === 22 && '    if (lives <= 0) {\n      restartGame();\n    }',
    has(23) && `    if (lives <= 0) {${mark(23)}\n${todo(23, '      ', "No lives left. Set state to 'over'.", "state = 'over';")}\n    } else {\n      state = 'ready';\n    }`,
    '    resetBall();'
  )}
  }
}

function resetBall() {
  ballX = width / 2;
  ballY = 230;
  // -abs() always gives a negative number, so the ball starts by going up.
  speedY = -abs(speedY);
}`;

  const restart = has(22) ? `

${block(22)}function restartGame() {
${lines(
    '  score = 0;',
    '  lives = startingLives;',
    has(25) && '  level = 1;' + mark(25),
    has(25) && '  speedY = -3;' + mark(25),
    '  makeBricks();',
    '  resetBall();'
  )}
}` : '';

  const drawing = `

function drawPaddleAndBall() {
  fill(paddleColor);
  rect(paddleX, paddleY, paddleWidth, 9, 5);
  fill('#ec693f');
  circle(ballX, ballY, ballSize);
}${has(24) ? `

${block(24)}function burst(x, y) {
  for (let i = 0; i < particleCount; i++) {
${todo(24, '    ', 'Add a new Particle at (x, y) to the particles array.', 'particles.push(new Particle(x, y));')}
  }
}

${block(24)}function drawParticles() {
  // Keep only the sparks that still have some life left.
  let stillAlive = [];
  for (let p of particles) {
    p.update();
    p.display();
    if (p.life > 0) {
      stillAlive.push(p);
    }
  }
  particles = stillAlive;
}` : ''}${has(22) ? `

${block(22)}function drawScore() {
  fill('#75846a');
  textAlign(LEFT);
  text('SCORE ' + score + '    LIVES ' + lives${has(25) ? " + '    LEVEL ' + level" : ''}, 20, 24);
}` : ''}${has(23) ? `

${block(23)}function drawMessage() {
  textAlign(CENTER);
  if (state === 'ready') {
    fill('#66775d');
    text('CLICK TO LAUNCH', width / 2, 190);
  }
  if (${ended}) {
    fill('#f5f3ebdd');
    rect(0, 120, width, 110);
    fill('#526348');
${has(25) ? "    text('GOOD GAME!', width / 2, 165);" : "    if (state === 'won') {\n      text('YOU DID IT!', width / 2, 165);\n    } else {\n      text('GOOD GAME!', width / 2, 165);\n    }"}
    text('Click to play again', width / 2, 194);
  }
}

${block(23)}// mousePressed() runs once every time the player clicks.
function mousePressed() {
  if (state === 'ready') {
${todo(23, '    ', "Launch the ball! Set state to 'playing'.", "state = 'playing';")}
  } else if (${ended}) {
    restartGame();
    state = 'ready';
  }
}

// Stops the page from scrolling while you play on a touch screen.
function touchMoved() {
  return false;
}` : ''}`;

  return header + brickClass + particleClass + setup + draw + movement + bricks + miss + restart + drawing + '\n';
}

const COURSE = [
  {
    title: 'Say hello to your canvas.', short: 'Hello, canvas!', description: 'Every game begins with a blank canvas. Let’s turn yours into something with a little personality.', tags: ['Your first sketch', 'createCanvas()', 'circle()'], concept: 'canvas',
    idea: 'Code is a set of creative instructions.', explanation: 'You tell the computer what to draw, where to draw it, and how it should look. It follows your instructions, one line at a time.', takeaway: 'You’re the creator. The computer is your very fast paintbrush.', note: 'Try changing the last number in <code>circle()</code>. What do you think will happen?',
    story: ['Welcome, {name}! Every game you have ever played began with a small idea and a few instructions. Today, your idea starts here.', 'This rectangle is your canvas. Think of it as a tiny digital art studio. You decide what appears inside it.', 'The setup function gets your studio ready. createCanvas makes a space four hundred eighty pixels wide, and three hundred twenty pixels tall.', 'The draw function paints the picture. background chooses the paper color. fill chooses the paint. circle draws your first shape.', 'The three numbers in circle mean horizontal position, vertical position, and size. Change the last number and watch the circle grow.', 'You do not need to memorize everything. Change one number, run the code, and notice what happens. That is how programmers discover things.'],
    code: `// A tiny canvas. A world of possibilities.\n\nfunction setup() {\n  createCanvas(480, 320);\n  noStroke();\n}\n\nfunction draw() {\n  background('#f5f3eb');\n\n  // Pick a color. Draw your first shape.\n  fill('#ec693f');\n  circle(240, 160, 80);\n}`,
    exercises: [E('Go a little bigger', 'Make the circle <code>120</code> pixels wide.', 'The third number in circle(240, 160, 80) is the diameter. Replace 80 with 120.', '__calls.circle.some(a => a[2] === 120)'), E('A whole new color', 'Give your circle a purple coat of paint using <code>\'#7e73bd\'</code>.', "Change fill('#ec693f') to fill('#7e73bd'). Keep the quotes!", "__calls.fill.some(a => a[0] === '#7e73bd')"), E('Give it a face', 'Turn your circle into a face! Draw two small eyes <em>inside</em> the big circle, in a different color so you can see them.', `Choose a new color, like fill('#242b2c');, then add two small circles such as circle(225, 150, 12); and circle(255, 150, 12);. Draw them after the big circle so they land on top.`, `(()=>{const c=__calls.circle;if(c.length<3)return false;const big=c.reduce((m,a)=>a[2]>m[2]?a:m);return c.filter(a=>a!==big&&a[2]<big[2]&&c.indexOf(a)>c.indexOf(big)&&dist(a[0],a[1],big[0],big[1])<big[2]/2&&a.fill!==big.fill).length>=2;})()`, 'Hello, new friend! Shapes drawn later sit on top of earlier ones.')]
  },
  {
    title: 'Find your place in space.', short: 'Coordinates & shapes', description: 'Your canvas has an invisible map. Learn to use x and y to put every shape right where you want it.', tags: ['Coordinates', 'x & y', 'rect()'], concept: 'coordinates', idea: 'Every pixel has an address.', explanation: 'x moves across the canvas. y moves down it. The top-left corner is (0, 0), and bigger numbers take you farther right or down.', takeaway: 'Across is x. Down is y. You’ve got the map.', note: 'Can you predict where <code>circle(100, 250, 40)</code> will appear?',
    story: ['Imagine sending a letter to one tiny spot on your canvas. It needs an address, and that address is made of two numbers.', 'The first number is x. It measures how far right you go, starting at the left edge of the canvas.', 'The second number is y. It measures how far down you go, starting at the top. That might feel different from math class.', 'The top left corner has the address zero, zero. The middle of our canvas is two hundred forty, one hundred sixty.', 'A circle uses its center as its address. A rectangle usually uses its top left corner, followed by width and height.', 'Try moving a shape before you run the code. Make a prediction, test it, and compare. You are already thinking like a programmer.'],
    code: base("  fill('#ec693f');\n  circle(120, 100, 60);\n\n  fill('#7e73bd');\n  rect(260, 180, 100, 50);"),
    exercises: [E('Find the center', 'Move the circle to <code>(240, 160)</code>.', 'Change the first two numbers in circle() to 240 and 160.', '__calls.circle.some(a=>a[0]===240&&a[1]===160)'), E('Stretch it out', 'Make the rectangle <code>160</code> pixels wide.', 'rect(x, y, width, height): the third number controls width.', '__calls.rect.some(a=>a[2]===160)'), E('Four corners', 'Put a small circle in <em>each</em> of the four corners of the canvas. The canvas is 480 wide and 320 tall.', `Top-left is near (20, 20) and top-right is near (460, 20). Can you work out the two bottom corners?`, `[[0,0],[480,0],[0,320],[480,320]].every(([cx,cy])=>__calls.circle.some(a=>Math.abs(a[0]-cx)<=60&&Math.abs(a[1]-cy)<=60))`, 'You can find any spot on the map. That is real coordinate thinking!')]
  },
  {
    title: 'Make a little color magic.', short: 'Color your world', description: 'Mix colors, choose a background, and discover why the order of your instructions matters.', tags: ['fill()', 'background()', 'Drawing order'], concept: 'color', idea: 'Your code has a paint palette.', explanation: 'fill() sets the color for shapes that come after it. background() paints the whole canvas. Later shapes are painted on top of earlier ones.', takeaway: 'Choose your paint before you make your mark.', note: 'Move <code>background()</code> to the end of draw(). Why do your shapes disappear?',
    story: ['A game needs a personality, and color is a wonderful place to start. Your code has its own paint palette.', 'background paints over the entire canvas. That is why we usually put it first, before drawing any shapes.', 'fill picks the paint for the shapes that follow. It keeps using that color until you choose another one.', 'A color can be a name, like coral, or a six digit code. You can also mix red, green, and blue with numbers.', 'The drawing order matters. The computer paints from top to bottom, so a later shape can cover an earlier shape.', 'Try making a sunset, a planet, or a team color palette. There is no single right look. You get to choose.'],
    code: base("  fill('#7e73bd');\n  circle(210, 160, 120);\n  fill('#ec693f');\n  circle(280, 160, 90);"),
    exercises: [E('After dark', 'Change the background to <code>\'#242b2c\'</code>.', "Replace the color inside background() with '#242b2c'.", "__calls.background.some(a=>a[0]==='#242b2c')"), E('Mint condition', 'Use <code>\'#9eb994\'</code> as one of your shape colors.', "Put fill('#9eb994'); before one of your circles.", "__calls.fill.some(a=>a[0]==='#9eb994')"), E('Bullseye!', 'Draw a target: three circles with the <em>same center</em>, each smaller than the one before, each in its own color.', `Draw the biggest circle first, then a medium one, then the smallest, all at the same x and y. Pick a new fill() before each one. What happens if you draw the small one first?`, `(()=>{const c=__calls.circle;return c.some(a=>{const s=c.filter(b=>b[0]===a[0]&&b[1]===a[1]);return s.length>=3&&s.every((b,i)=>i===0||(b[2]<s[i-1][2]&&b.fill!==s[i-1].fill));});})()`, 'Bullseye! Drawing order decides what ends up on top.')]
  },
  {
    title: 'Once. Again. And again.', short: 'setup() & draw()', description: 'Meet the two functions behind every p5.js sketch: one gets things ready, and one keeps the world alive.', tags: ['setup()', 'draw()', 'frameCount'], concept: 'loop', idea: 'Set the stage. Then keep playing.', explanation: 'setup() runs once when your sketch starts. draw() runs again and again, usually around 60 times every second. Each run is a new frame.', takeaway: 'setup is the starting whistle. draw is the heartbeat.', note: 'Remove <code>background()</code> from draw() to leave a trail behind your moving circle.',
    story: ['How does a still picture become a game? The secret is to draw lots of pictures, very quickly, with tiny changes between them.', 'setup runs once at the beginning. It prepares the canvas, chooses starting settings, and gets everything ready.', 'draw runs over and over. Each time it runs, it paints one frame. Many frames together create the feeling of movement.', 'frameCount is a number p5 gives us. It increases each time draw runs, so we can use it to move our circle.', 'background clears away the last frame. Without it, the old circles stay behind and make a trail, like a long exposure photo.', 'Move an instruction between setup and draw, then restart. Ask yourself whether it should happen once, or keep happening.'],
    code: base("  fill('#ec693f');\n  circle(frameCount % width, 160, 40);", 'frameRate(30);'),
    exercises: [E('Slow motion', 'Set the frame rate to <code>15</code> frames per second.', 'Change frameRate(30) inside setup() to frameRate(15).', '__setupCalls.frameRate.some(a=>a[0]===15)'), E('A thicker trail', 'Make the moving circle <code>70</code> pixels wide.', 'The third circle() argument is the diameter.', '__calls.circle.some(a=>a[2]===70)'), E('Rain drop', 'Add a second circle that falls from the top toward the bottom. Use <code>frameCount</code> for its y position.', `Add a new circle inside draw() whose second number uses frameCount, like circle(100, frameCount % height, 20);`, `(()=>{draw();const a=__calls.circle;frameCount+=1;draw();const b=__calls.circle;return b.some((c,i)=>a[i]&&c[0]===a[i][0]&&c[1]!==a[i][1]);})()`, 'Drip, drop! Each frame draws the drop a little lower.')]
  },
  {
    title: 'Give your ideas a name.', short: 'Meet variables', description: 'Store a number in a named container, then use it to change your sketch from one easy-to-find place.', tags: ['let', 'Variables', 'Values'], concept: 'variables', idea: 'A variable remembers something.', explanation: 'A variable is a name for a value. It can hold a position, a size, a score, or a color. Use let to create one and = to put a value inside.', takeaway: 'A good name makes your code tell a story.', note: 'Try changing <code>ballSize</code>. One edit can change every circle that uses it.',
    story: ['Imagine a small labeled box. You can put a number inside, look at it later, and replace it whenever you need. That is a variable.', 'The word let creates a variable. After it comes a name, an equals sign, and the value you want to store.', 'Our ballX variable remembers where the ball belongs. ballSize remembers how big it should be. Clear names help us understand the code.', 'When the computer sees ballSize inside circle, it looks up the number in that box and uses that number to draw.', 'A single variable can appear in many places. Change its starting value once, and all those places use the new value.', 'Later, variables will remember the score and how many lives remain. For now, experiment with position and size. Your boxes are ready.'],
    code: `let ballX = 240;\nlet ballY = 160;\nlet ballSize = 60;\n\n`+base("  fill('#ec693f');\n  circle(ballX, ballY, ballSize);"),
    exercises: [E('Think big', 'Set <code>ballSize</code> to <code>100</code>.', 'At the top of the sketch, change let ballSize = 60 to let ballSize = 100.', 'ballSize===100&&__calls.circle.some(a=>a[2]===100)'), E('Head left', 'Set <code>ballX</code> to <code>100</code>.', 'Change the number stored in ballX at the top.', 'ballX===100&&__calls.circle.some(a=>a[0]===100)'), E('Make your own variable', 'Create a new variable named <code>eyeSize</code> and use it to draw two eyes on the ball.', `At the top, add let eyeSize = 12;. Then at the end of draw(), add fill('#242b2c'); and two circles that use eyeSize as their size, like circle(ballX - 12, ballY - 8, eyeSize);`, `typeof eyeSize==='number'&&__calls.circle.filter(a=>a[2]===eyeSize).length>=2`, 'You made a variable from scratch and put it to work.')]
  },
  {
    title: 'A small change. A moving ball.', short: 'Make things move', description: 'Update a variable every frame and turn a still circle into your first animation.', tags: ['Animation', 'Speed', '+='], concept: 'movement', idea: 'Motion is a position that keeps changing.', explanation: 'Each time draw() runs, add a little to x. A bigger step means faster movement. A negative step moves in the opposite direction.', takeaway: 'position = position + speed. A tiny equation, a huge possibility.', note: 'The <code>% width</code> wraps the ball around. We’ll learn bouncing soon.',
    story: ['You already know how to place a circle. To make it move, we need to change that position each time a new frame is drawn.', 'The variable x stores the current position. The variable speed stores how many pixels the ball should move during each frame.', 'The instruction x plus equals speed means take the old x, add speed, and store the result back in x.', 'Now draw repeats the same three steps. Clear the canvas, update the position, and paint the ball in its new spot.', 'Bigger steps make faster movement. A negative speed moves left instead of right. The percent operator lets this example wrap around.', 'This is a simple simulation: a little state changing over time. Soon this same moving circle will become the ball in your game.'],
    code: `let x = 0;\nlet speed = 2;\nlet ballSize = 40;\nlet lane = 160;\n\n`+base("  x += speed;\n  fill('#ec693f');\n  circle((x % width + width) % width, lane, ballSize);"),
    exercises: [E('Pick up the pace', 'Set <code>speed</code> to <code>5</code>.', 'Change the starting value of speed at the top. Watch how much farther each frame travels.', 'speed===5'), E('Reverse course', 'Set <code>speed</code> to <code>-3</code> and watch it move left.', 'Put a minus sign before 3: let speed = -3;', 'speed===-3'), E('Go diagonal', 'Make the ball move down as well as across. Create <code>y</code> and <code>speedY</code> variables, and change <code>y</code> every frame.', `Add let y = 40; and let speedY = 1; at the top. In draw(), add y += speedY; and use y instead of lane inside circle().`, `typeof speedY==='number'&&speedY!==0&&(()=>{draw();const a=__calls.circle[0];draw();const b=__calls.circle[0];return !!a&&!!b&&b[1]!==a[1];})()`, 'Two speeds, one diagonal path. That is how game balls travel!')]
  },
  {
    title: 'Teach your code to choose.', short: 'If this, then that', description: 'Give your sketch a decision to make. A simple if statement is the beginning of game logic.', tags: ['if / else', 'Conditions', 'Comparisons'], concept: 'conditions', idea: 'An if statement asks a question.', explanation: 'Is x past the middle? If the answer is true, run one set of instructions. Otherwise, use else. The comparison > means “greater than”.', takeaway: 'Games are full of little questions and decisions.', note: 'Change <code>threshold</code> and watch where the color changes.',
    story: ['A game constantly asks questions. Did the ball hit a wall? Is the player out of lives? An if statement lets your code make decisions.', 'A condition is a question that has a true or false answer. For example, is x greater than the middle of the canvas?', 'When the answer is true, the instructions inside the first pair of curly brackets run. When it is false, they are skipped.', 'An else block gives your code another path. In this sketch, the ball gets one color before the threshold, and another after it.', 'The greater than symbol compares two numbers. Two equals signs, or three equals signs for strict equality, ask whether values match.', 'Move the threshold or choose different colors. Watch the moment your condition changes its answer. You have just created a rule.'],
    code: `let x = 0;\nlet threshold = 240;\nlet fastColor = '#ec693f';\nlet slowColor = '#7e73bd';\n\n`+base("  x = (x + 2) % width;\n  if (x > threshold) {\n    fill(fastColor);\n  } else {\n    fill(slowColor);\n  }\n  circle(x, 160, 50);"),
    exercises: [E('Decide sooner', 'Move <code>threshold</code> to <code>120</code>.', 'Change let threshold = 240 to let threshold = 120.', 'threshold===120'), E('The green light', 'Make <code>fastColor</code> equal <code>\'#6e8a69\'</code>.', "Set let fastColor = '#6e8a69';", "fastColor==='#6e8a69'"), E('A third choice', "Add an <code>else if</code> so the ball turns gold (<code>'#e6bd58'</code>) when <code>x</code> is greater than 400.", `Put the new check first: if (x > 400) { fill('#e6bd58'); } else if (x > threshold) { fill(fastColor); } else { fill(slowColor); }. The computer stops at the first true answer, so the order matters!`, `(()=>{x=410;draw();const gold=__calls.fill.some(a=>a[0]==='#e6bd58');x=Math.min(threshold+20,380);draw();const mid=__calls.fill.some(a=>a[0]===fastColor);x=0;draw();const low=__calls.fill.some(a=>a[0]===slowColor);return gold&&mid&&low;})()`, 'Three paths! Your code now picks between more than two choices.')]
  },
  {
    title: 'Meet the bounce.', short: 'Bouncing off walls', description: 'Combine movement and decisions to keep a ball inside the canvas. Your first piece of game physics!', tags: ['Velocity', 'Boundaries', '*= -1'], concept: 'bounce', idea: 'A bounce is a change in direction.', explanation: 'When the ball reaches an edge, flip the sign of its speed. Positive becomes negative. Negative becomes positive. Use its radius to keep the entire ball inside.', takeaway: 'The wall stays still. The velocity changes.', note: 'Try a bigger <code>ballSize</code>. Notice that the boundary checks still work.',
    story: ['Our ball can move, but a game ball should not disappear through the wall. Let us give the canvas some boundaries.', 'Velocity tells us how fast something moves and which direction it is going. A positive horizontal velocity moves right; a negative one moves left.', 'We check whether the center is closer to a wall than the ball radius. The radius is half the diameter of the circle.', 'At an edge, multiplying speed by negative one reverses the direction. The next frame moves the ball back into the canvas.', 'We also clamp the position inside the boundary. This keeps the ball from getting stuck beyond the edge and flipping direction forever.', 'Try a different starting speed or a much bigger ball. One rule handles all of them. This is a small, useful model of physics.'],
    code: `let x = 240;\nlet speed = 3;\nlet ballSize = 40;\nlet lane = 160;\n\n`+base("  x += speed;\n  let radius = ballSize / 2;\n  if (x > width - radius || x < radius) {\n    speed *= -1;\n    x = constrain(x, radius, width - radius);\n  }\n  fill('#ec693f');\n  circle(x, lane, ballSize);"),
    exercises: [E('Double the energy', 'Make the ball move at <code>6</code> pixels per frame.', 'Start speed at 6. It becomes -6 when it bounces; the size of its speed stays 6.', 'Math.abs(speed)===6'), E('Giant bounce', 'Set <code>ballSize</code> to <code>90</code>.', 'Change the variable at the top. The radius calculation adjusts automatically.', 'ballSize===90&&__calls.circle.some(a=>a[2]===90)'), E('Bounce in 2D', 'Make the ball bounce off the top and bottom too. Add <code>y</code> and <code>speedY</code> variables, move <code>y</code> every frame, and flip <code>speedY</code> at the top and bottom edges.', `Copy the idea of the x bounce: y += speedY; then if (y > height - radius || y < radius) { speedY *= -1; }. Draw the circle at y instead of lane.`, `typeof speedY==='number'&&typeof y==='number'&&(()=>{speedY=Math.abs(speedY)||3;y=height-ballSize/2-1;draw();return speedY<0&&__calls.circle.some(a=>a[1]===y);})()`, 'A ball that bounces off all four walls. Your first full physics engine!')]
  },
  {
    title: 'You’re in control.', short: 'Follow the mouse', description: 'Turn your sketch into something you can interact with. Your mouse becomes part of the program.', tags: ['mouseX', 'mouseY', 'Input'], concept: 'mouse', idea: 'Input connects you to your code.', explanation: 'p5 keeps track of mouseX and mouseY for you. Put them into a drawing instruction, and your shape follows the pointer in real time.', takeaway: 'Input → code → a response. That’s interaction.', note: 'Move your pointer inside the canvas. On a touch screen, drag your finger.',
    story: ['A picture becomes interactive when it responds to something you do. That something is called input. Let us start with your mouse.', 'p5 updates two special variables for us: mouseX and mouseY. They store the pointer position relative to the canvas, not the whole page.', 'Use mouseX as the circle x coordinate, and mouseY as its y coordinate. Now the circle follows you each frame.', 'This little connection is the beginning of a game controller. Your hand moves, the values change, and the canvas responds.', 'You can follow only one direction, or add an offset to draw a companion shape nearby. Input is just another number you can use.', 'Move the pointer around your canvas after running the code. Try making a giant cursor, a tiny cursor, or two shapes that travel together.'],
    code: `let cursorSize = 40;\nlet offset = 65;\nlet cursorColor = '#ec693f';\n\n`+base("  fill(cursorColor);\n  circle(mouseX, mouseY, cursorSize);\n  fill('#b9c9ac');\n  circle(mouseX + offset, mouseY, 16);"),
    exercises: [E('A giant cursor', 'Set <code>cursorSize</code> to <code>80</code>.', 'Change the first variable, then move your pointer over the preview.', 'cursorSize===80&&__calls.circle.some(a=>a[2]===80)'), E('A close companion', 'Move the small companion to an <code>offset</code> of <code>30</code>.', 'The second circle adds offset to mouseX. Change that named value to 30.', 'offset===30'), E('Click to change', 'Make the cursor change color while you hold the mouse button down. Use <code>mouseIsPressed</code> inside an if.', `mouseIsPressed is true while the button is held down. Try: if (mouseIsPressed) { fill('#7e73bd'); } else { fill(cursorColor); } in place of the first fill().`, `(()=>{mouseIsPressed=false;draw();const up=__calls.circle.map(c=>c.fill).join('|');mouseIsPressed=true;draw();const down=__calls.circle.map(c=>c.fill).join('|');mouseIsPressed=false;return up!==down;})()`, 'Input plus a decision. Your sketch reacts to clicks now!')]
  },
  {
    title: 'Press play. Literally.', short: 'Keyboard controls', description: 'Use arrow keys to move a paddle. Now your sketch starts to feel like an arcade.', tags: ['keyIsDown()', 'Arrow keys', 'constrain()'], concept: 'keyboard', idea: 'A held key is a question you can ask.', explanation: 'keyIsDown(LEFT_ARROW) is true while the left arrow is pressed. Check it every frame and move the paddle. constrain() keeps it on the canvas.', takeaway: 'Check the input. Update the position. Draw the result.', note: 'Click the canvas first so it can receive your keyboard input.',
    story: ['A keyboard is another way for a player to speak to a game. Today the left and right arrow keys will steer a paddle.', 'First, click inside the canvas so it receives your key presses. Then hold an arrow and watch the paddle move.', 'keyIsDown asks whether a particular key is currently held. We ask that question inside draw, so the movement continues every frame.', 'If the left arrow is down, subtract speed from the paddle position. If the right arrow is down, add speed instead.', 'constrain keeps the paddle position between zero and the canvas width minus the paddle width. That way the whole paddle stays visible.', 'Try a speedy paddle or a wider one. Think about how each choice changes the feeling of control for a player.'],
    code: `let paddleX = 195;\nlet paddleWidth = 90;\nlet paddleY = 260;\nlet speed = 4;\n\n`+base("  if (keyIsDown(LEFT_ARROW)) paddleX -= speed;\n  if (keyIsDown(RIGHT_ARROW)) paddleX += speed;\n  paddleX = constrain(paddleX, 0, width - paddleWidth);\n  fill('#6e8a69');\n  rect(paddleX, paddleY, paddleWidth, 12, 6);")+`\n\nfunction keyPressed() {\n  if (keyCode === LEFT_ARROW || keyCode === RIGHT_ARROW) return false;\n}`,
    exercises: [E('Quick reflexes', 'Set paddle <code>speed</code> to <code>8</code>.', 'The speed variable controls how many pixels each key press moves per frame.', 'speed===8'), E('More room to catch', 'Set <code>paddleWidth</code> to <code>140</code>.', 'Change the named width at the top, then run.', 'paddleWidth===140&&__calls.rect.some(a=>a[2]===140)'), E('Up and away', 'Make the ↑ and ↓ arrow keys move the paddle up and down by changing <code>paddleY</code>.', `Copy the left and right lines, but use UP_ARROW and DOWN_ARROW and change paddleY instead of paddleX. Remember: going up means a smaller y!`, `(()=>{const real=keyIsDown;const y0=paddleY;keyIsDown=k=>k===UP_ARROW;draw();const up=paddleY<y0;keyIsDown=k=>k===DOWN_ARROW;draw();draw();const down=paddleY>y0;keyIsDown=real;return up&&down;})()`, 'Four-way controls! You wrote new input rules yourself.')]
  },
  {
    title: 'One idea. One useful function.', short: 'Your own functions', description: 'Give a group of instructions a name. Call that name whenever you want the computer to do the whole job.', tags: ['Functions', 'Reuse', 'Organization'], concept: 'functions', idea: 'A function is a recipe you can reuse.', explanation: 'Write your drawing steps inside a function. Calling the function runs those steps. You’ve already used functions like circle(); now you can make your own.', takeaway: 'Name a job. Write its steps. Call it when you need it.', note: 'Try calling <code>drawBall()</code> after <code>drawPaddle()</code>. Drawing order still matters.',
    story: ['Imagine writing the same recipe every time you want a sandwich. A function lets you write the recipe once and give it a name.', 'We create a function with the word function, a name, parentheses, and curly brackets. Inside the brackets are its instructions.', 'Defining the function does not run it yet. Calling its name, with parentheses, tells the computer to follow the recipe.', 'Our draw function calls drawBall and drawPaddle. Each name tells us what that part of the program is responsible for.', 'Smaller functions make a bigger game easier to understand. If the ball looks wrong, you know which recipe to investigate.', 'Try changing just the ball recipe or the paddle recipe. Organizing your code is a creative skill, just like choosing a color.'],
    code: `let ballSize = 50;\nlet paddleWidth = 100;\nlet ballColor = '#ec693f';\n\n`+base('  drawBall();\n  drawPaddle();')+`\n\nfunction drawBall() {\n  fill(ballColor);\n  circle(240, 140, ballSize);\n}\n\nfunction drawPaddle() {\n  fill('#6e8a69');\n  rect(190, 260, paddleWidth, 12, 6);\n}`,
    exercises: [E('A bigger recipe', 'Make <code>drawBall()</code> draw a <code>90</code>-pixel ball.', 'drawBall uses ballSize. Set ballSize = 90 at the top.', 'ballSize===90&&__calls.circle.some(a=>a[2]===90)'), E('Remix the paddle', 'Make your paddle <code>150</code> pixels wide.', 'drawPaddle uses paddleWidth. Change its starting value to 150.', 'paddleWidth===150&&__calls.rect.some(a=>a[2]===150)'), E('Write a new recipe', 'Write your own function called <code>drawSun()</code> that draws a sun, then call it from <code>draw()</code>.', `Below the other functions, write: function drawSun() { fill('#e6bd58'); circle(400, 60, 50); }. Then add drawSun(); inside draw(). A recipe does nothing until you call it!`, `typeof drawSun==='function'&&__calls.circle.length>=2`, 'You wrote and called your very own function.')]
  },
  {
    title: 'Same recipe. New ingredients.', short: 'Function parameters', description: 'Make your function flexible by giving it values to work with. One function can draw a whole team of shapes.', tags: ['Parameters', 'Arguments', 'Reusable code'], concept: 'parameters', idea: 'Parameters are the ingredients you pass in.', explanation: 'A function can accept named inputs between its parentheses. Each call supplies values for those inputs. Same instructions, different results.', takeaway: 'One flexible recipe beats a hundred copied recipes.', note: 'Try adding your own fourth call to <code>drawBall(x, y, size)</code>.',
    story: ['A recipe becomes more useful when you can change its ingredients. Function parameters let the same instructions work with different values.', 'Our drawBall function accepts three parameters: x, y, and size. They are like empty spaces waiting for ingredients.', 'When we call drawBall with numbers, those numbers become the parameter values for that particular call. These supplied values are called arguments.', 'The first call might draw a small ball on the left. The next can draw a giant ball on the right using the same recipe.', 'The names inside the function belong to that function. Each call gets its own inputs, so one call does not change another.', 'Add a new call and choose three new numbers. Instead of copying drawing steps, you are describing what you want your reusable tool to make.'],
    code: base("  drawBall(120, 160, 40);\n  drawBall(240, 160, 65);\n  drawBall(360, 160, 90);")+`\n\nfunction drawBall(x, y, size) {\n  fill('#ec693f');\n  circle(x, y, size);\n}`,
    exercises: [E('One tiny ingredient', 'Make the left ball at <code>(120, 160)</code> just <code>20</code> pixels wide.', 'Change the third argument in the first drawBall call to 20.', '__calls.circle.some(a=>a[0]===120&&a[1]===160&&a[2]===20)'), E('Rise above', 'Move the middle ball to <code>(240, 90)</code>.', 'In the second call, change the y argument from 160 to 90.', '__calls.circle.some(a=>a[0]===240&&a[1]===90)'), E('A colorful team', 'Add a fourth parameter, <code>ballColor</code>, to <code>drawBall</code>. Then give each ball its own color.', `Change the first line to function drawBall(x, y, size, ballColor) and use fill(ballColor);. Then add a color to every call, like drawBall(120, 160, 40, '#7e73bd');`, `drawBall.length===4&&new Set(__calls.circle.map(c=>c.fill)).size>=3`, 'One recipe, many results. That is the power of parameters.')]
  },
  {
    title: 'Let the computer do the repeating.', short: 'The power of loops', description: 'Draw a row of shapes with just a few lines. A for loop turns repeated work into one clear instruction.', tags: ['for loops', 'Counters', 'Repetition'], concept: 'for', idea: 'A loop repeats a job with a small change.', explanation: 'A for loop starts a counter, checks a condition, runs its instructions, then updates the counter. It keeps going until the condition becomes false.', takeaway: 'Start. Check. Do. Update. Repeat.', note: 'The counter <code>i</code> starts at 0. Five repeats use 0, 1, 2, 3, and 4.',
    story: ['Drawing one circle is easy. Drawing a hundred by copying the same line is a lot of work. A loop lets the computer handle the repeating.', 'A for loop has three controls. The first creates a counter, usually called i, and chooses where it starts.', 'The second is a condition. As long as the condition is true, the instructions inside the loop run again.', 'The third updates the counter. i plus plus adds one. Then the computer checks the condition and begins the next repeat.', 'We use the changing counter to choose each circle position. The same drawing instruction makes a neat row of different circles.', 'Always make sure a loop can finish. Start with a small count, look at the result, and build up your pattern one repeat at a time.'],
    code: `let count = 5;\nlet spacing = 75;\nlet dotSize = 30;\n\n`+base("  fill('#ec693f');\n  for (let i = 0; i < count; i++) {\n    circle(60 + i * spacing, 160, dotSize);\n  }"),
    exercises: [E('Two more friends', 'Draw <code>7</code> circles by changing <code>count</code>.', 'Set count = 7. The loop will automatically make two more circles.', 'count===7&&__calls.circle.length===7'), E('Room for everyone', 'Set <code>spacing</code> to <code>55</code> so seven circles fit.', 'Change the distance between neighboring circles to 55.', 'spacing===55&&__calls.circle.length>1&&__calls.circle[1][0]-__calls.circle[0][0]===55'), E('Growing pattern', 'Make each circle bigger than the one before it. Use <code>i</code> to calculate the size.', `Replace dotSize inside circle() with something that grows with i, like 20 + i * 8. When i is 0 the size is 20, when i is 1 it is 28, and so on.`, `__calls.circle.length>=3&&__calls.circle.every((a,i,c)=>i===0||a[2]>c[i-1][2])`, 'The counter is more than a counter. It can shape your pattern!')]
  },
  {
    title: 'Give your values a team.', short: 'Arrays: a list of ideas', description: 'Keep related values together in an array. Then loop through your list to draw something for every item.', tags: ['Arrays', 'Indexes', 'length'], concept: 'arrays', idea: 'An array keeps a whole list in one place.', explanation: 'Use square brackets to make a list. Each item has a numbered index, starting at zero. The length property tells you how many items are in the list.', takeaway: 'One variable can hold a whole team.', note: 'Add another number to <code>sizes</code>. The loop notices the new length all by itself.',
    story: ['You have stored one number in a variable. But what if you want to remember a different size for every ball? An array keeps a list.', 'Write the list inside square brackets and separate the items with commas. Our sizes array holds several different circle diameters.', 'Every item has an address called an index. The first item is at index zero, the second at one, and so on.', 'sizes with i in square brackets looks up the item at index i. A loop can visit each item and use its value.', 'The length property tells us how many items the array contains. Use it as the loop limit, so adding an item also adds a drawing.', 'Try making a pattern with small and big values. Your array is a tiny collection of creative choices that your loop brings to life.'],
    code: `let sizes = [25, 40, 60, 80];\nlet color = '#7e73bd';\n\n`+base("  fill(color);\n  for (let i = 0; i < sizes.length; i++) {\n    circle(75 + i * 95, 160, sizes[i]);\n  }"),
    exercises: [E('Start big', 'Change the first item in <code>sizes</code> to <code>70</code>.', 'The first item is at index 0. Edit the first number inside the brackets.', 'sizes[0]===70&&__calls.circle.some(a=>a[0]===75&&a[2]===70)'), E('Grow the list', 'Add a fifth size, <code>30</code>, at the end of the array.', 'Put a comma after 80, then 30, before the closing square bracket.', 'sizes.length===5&&sizes[4]===30&&__calls.circle.length===5'), E('A color for everyone', 'Create a <code>colors</code> array and use <code>colors[i]</code> so every circle gets its own color.', `Add let colors = ['#ec693f', '#7e73bd', '#e6bd58', '#6e8a69']; at the top. Inside the loop, before circle(), add fill(colors[i]);. Make sure colors has at least as many items as sizes!`, `Array.isArray(colors)&&__calls.circle.length>=3&&new Set(__calls.circle.map(c=>c.fill)).size>=3&&__calls.circle.every(c=>colors.map(String).includes(c.fill))`, 'Two lists working together, matched by the same index.')]
  },
  {
    title: 'Build a wall, one loop at a time.', short: 'Loops inside loops', description: 'Combine rows and columns to make a grid. You’ve just discovered how to build a wall of game bricks.', tags: ['Nested loops', 'Rows', 'Columns'], concept: 'grid', idea: 'One loop for rows. One for columns.', explanation: 'For every row, the inner loop visits every column. Use row to find y and column to find x. Together, they create a whole grid.', takeaway: 'rows × columns = how many bricks you build.', note: 'Keep your grid under 7 columns and 7 rows so every brick stays on the canvas.',
    story: ['A brick breaker needs a whole wall of bricks. One loop can make a row, but two loops working together can make the entire wall.', 'The outer loop counts the rows. Each time it runs, it starts the inner loop from the beginning.', 'The inner loop counts the columns. It draws one brick for each column, then finishes so the outer loop can move to the next row.', 'Use the column number to calculate x, and the row number to calculate y. Multiplication creates the spacing between neighboring bricks.', 'Three rows of six columns gives eighteen bricks. Changing either number changes the whole wall, without copying any drawing instructions.', 'Try a tall wall or a wide wall. Nested loops are useful for maps, board games, pixel art, and all kinds of repeating worlds.'],
    code: `let rows = 3;\nlet columns = 6;\nlet brickHeight = 20;\n\n`+base("  fill('#ec693f');\n  for (let row = 0; row < rows; row++) {\n    for (let col = 0; col < columns; col++) {\n      rect(25 + col * 72, 65 + row * 32, 64, brickHeight, 3);\n    }\n  }"),
    exercises: [E('Build up', 'Make <code>5</code> rows of bricks.', 'Change rows = 3 to rows = 5. Leave the inner loop alone.', 'rows===5&&__calls.rect.length===rows*columns'), E('A shorter wall', 'Make <code>4</code> columns of bricks.', 'The columns variable controls the inner loop.', 'columns===4&&__calls.rect.length===rows*columns'), E('Checkerboard', 'Make the bricks alternate between two colors like a checkerboard. <code>(row + col) % 2</code> gives the remainder after dividing by 2, so it flips between 0 and 1 for every neighbor.', `Inside the inner loop, before rect(), add: if ((row + col) % 2 === 0) { fill('#ec693f'); } else { fill('#7e73bd'); }`, `(()=>{const r=__calls.rect;if(r.length<4)return false;for(let i=0;i<r.length;i++){if(r[i+1]&&r[i+1][1]===r[i][1]&&r[i+1].fill===r[i].fill)return false;if(r[i+columns]&&r[i+columns].fill===r[i].fill)return false;}return new Set(r.map(a=>a.fill)).size>=2;})()`, 'A perfect checkerboard, built from two loops and one clever rule.')]
  },
  {
    title: 'Everything a ball needs to know.', short: 'Meet objects', description: 'Keep a ball’s position, size, and color together in one object. Related information belongs together.', tags: ['Objects', 'Properties', 'Dot notation'], concept: 'objects', idea: 'An object groups the details of one thing.', explanation: 'An object has named properties, like x, y, and size. Dot notation, such as ball.x, reads one detail. Your game can have ball, paddle, and brick objects.', takeaway: 'Many details. One thing. One object.', note: 'Compare <code>ball.x</code> with a separate <code>ballX</code> variable. Which feels clearer?',
    story: ['Our ball needs a position, a size, a color, and eventually a velocity. An object keeps those related details together as one thing.', 'Create an object with curly brackets. Inside, give each property a name, a colon, and a value, separating the properties with commas.', 'The property x belongs to the ball object. We write ball dot x to read it. That dot means look inside this object.', 'You can change a property just like a variable. Updating ball dot x moves the ball without changing its size or color.', 'An array can hold objects too. Soon, each brick in our wall will have its own position and a property that remembers whether it is alive.', 'Try changing a few ball properties. Notice how the drawing code stays clear: it describes the ball using the information the ball already owns.'],
    code: `let ball = {\n  x: 240,\n  y: 160,\n  size: 60,\n  color: '#ec693f'\n};\n\n`+base('  fill(ball.color);\n  circle(ball.x, ball.y, ball.size);'),
    exercises: [E('A bigger personality', 'Set <code>ball.size</code> to <code>100</code>.', 'Inside the object, change size: 60 to size: 100.', 'ball.size===100&&__calls.circle.some(a=>a[2]===100)'), E('A new address', 'Set <code>ball.x</code> to <code>100</code> and <code>ball.y</code> to <code>220</code>.', 'Change the x and y properties inside the object. Keep the commas.', 'ball.x===100&&ball.y===220&&__calls.circle.some(a=>a[0]===100&&a[1]===220)'), E('Give it motion', 'Add a <code>speed</code> property to the ball object, and make the ball move by adding it to <code>ball.x</code> every frame.', `Add speed: 2, inside the object (watch the commas!). Then in draw(), add ball.x += ball.speed; before drawing the circle.`, `typeof ball.speed==='number'&&ball.speed!==0&&(()=>{const x0=ball.x;draw();return ball.x!==x0;})()`, 'Your object now owns its position and its speed.')]
  },
  {
    title: 'One blueprint. A whole world.', short: 'Classes & blueprints', description: 'Create a class that knows how to make and draw a ball. Then build several independent balls from the same blueprint.', tags: ['Classes', 'constructor', 'this'], concept: 'classes', idea: 'A class is a blueprint for making objects.', explanation: 'The constructor sets up a new object. this refers to that particular object. Methods are functions that belong to it, like display().', takeaway: 'The blueprint is shared. Each object has its own details.', note: 'Each <code>new Ball()</code> creates a separate ball with its own position and size.',
    story: ['An object describes one thing. A class is a blueprint that helps us create many similar things, each with its own information.', 'The constructor runs when we use new Ball. It receives the starting values and saves them on the new object.', 'The word this means this particular object. this dot size is the size of the ball we are working with, not every ball.', 'A method is a function inside a class. Our display method knows how to draw a ball using its own position and size.', 'We create several balls and store them in an array. Then a loop asks each ball to display itself. Each object follows the same blueprint.', 'Try changing one ball size, then adding another ball. Blueprints make it easier to create a whole cast of characters without copying all their instructions.'],
    code: `class Ball {\n  constructor(x, y, size) {\n    this.x = x;\n    this.y = y;\n    this.size = size;\n  }\n\n  display() {\n    fill('#7e73bd');\n    circle(this.x, this.y, this.size);\n  }\n}\n\nlet balls = [\n  new Ball(130, 160, 40),\n  new Ball(240, 160, 60),\n  new Ball(350, 160, 80)\n];\n\n`+base('  for (let ball of balls) {\n    ball.display();\n  }'),
    exercises: [E('Grow one ball', 'Make the first ball <code>90</code> pixels wide.', 'Change new Ball(130, 160, 40) to new Ball(130, 160, 90).', 'balls[0].size===90&&__calls.circle.some(a=>a[0]===130&&a[2]===90)'), E('Another from the blueprint', 'Add <code>new Ball(240, 260, 30)</code> to the array.', 'Add a comma after the third Ball, then a fourth new Ball call.', 'balls.length===4&&balls[3].x===240&&balls[3].y===260&&__calls.circle.length===4'), E('Teach it a new trick', 'Add a <code>move()</code> method to the Ball class that makes each ball fall slowly. Then call <code>ball.move()</code> in the loop.', `Inside the class, after display(), add: move() { this.y += 1; }. In draw(), call ball.move(); right before ball.display();`, `typeof balls[0].move==='function'&&(()=>{const y0=balls.map(b=>b.y);draw();return balls.every((b,i)=>b.y!==y0[i]);})()`, 'One new method, and every ball from the blueprint learned it.')]
  },
  {
    title: 'Make room for surprise.', short: 'A little randomness', description: 'Use random() to make a different result each time. Add surprise while keeping the experience under your control.', tags: ['random()', 'Ranges', 'Click events'], concept: 'random', idea: 'Random does not have to mean anything goes.', explanation: 'random(min, max) picks a number from a range, including min but not max. Choose sensible limits so surprises stay inside your game world.', takeaway: 'You set the boundaries. The computer chooses a possibility.', note: 'Click the canvas to reshuffle. Random choices in setup happen once; in draw they happen every frame.',
    story: ['Games become more interesting when something unexpected can happen. random lets your computer choose a number from a range you decide.', 'random with two numbers chooses a value starting at the first number and stopping just short of the second. The answer can include decimals.', 'Pick the position inside the canvas edges, and a ball will always appear on screen. Boundaries make randomness useful instead of confusing.', 'We make our random choices in a function called shuffle. setup calls it once, and mousePressed calls it again whenever you click.', 'If you put random directly inside draw, you choose a new value every frame. That can create flicker instead of a stable surprise.', 'Click to generate several arrangements. Then change the limits. You are not choosing every result, but you are designing the space of possible results.'],
    code: `let balls = [];\nlet count = 8;\nlet minSize = 15;\nlet maxSize = 45;\n\nfunction setup() {\n  createCanvas(480, 320);\n  noStroke();\n  shuffleBalls();\n}\n\nfunction shuffleBalls() {\n  balls = [];\n  for (let i = 0; i < count; i++) {\n    balls.push({x: random(50, 430), y: random(50, 270), size: random(minSize, maxSize)});\n  }\n}\n\nfunction draw() {\n  background('#f5f3eb');\n  fill('#7e73bd');\n  for (let ball of balls) {\n    circle(ball.x, ball.y, ball.size);\n  }\n}\n\nfunction mousePressed() { shuffleBalls(); }`,
    exercises: [E('A bigger surprise party', 'Create <code>15</code> random balls.', 'Change count to 15. setup will create the array again when you run.', 'count===15&&balls.length===15&&__calls.circle.length===15'), E('No tiny guests', 'Set <code>minSize</code> to <code>30</code>.', 'Change the lower size boundary to 30. Keep maxSize greater than minSize.', 'minSize===30&&balls.every(b=>b.size>=30)'), E('Surprise colors', 'Give each ball a random color. Hint: <code>random()</code> can also pick one item from an array!', `In shuffleBalls, add a color property: color: random(['#ec693f', '#7e73bd', '#e6bd58', '#6e8a69']). Then use fill(ball.color); inside the loop, before circle().`, `new Set(__calls.circle.map(c=>c.fill)).size>=2`, 'Every click mixes a new palette. Controlled surprise!')]
  },
  {
    title: 'When two worlds touch.', short: 'Collision detection', description: 'Find out when a ball touches a brick. A little geometry gives your game a way to sense contact.', tags: ['Collision', 'dist()', 'true / false'], concept: 'collision', idea: 'Touching is a question made of numbers.', explanation: 'Find the closest point on the brick to the ball’s center. If that distance is less than the ball’s radius, the two shapes overlap, and touching becomes true.', takeaway: 'Draw the shapes. Measure the gap. Decide what happens.', note: 'Move your pointer over the brick. It changes color when the ball touches it.',
    story: ['A brick cannot break until the game knows it has been touched. Collision detection is how we turn touching into a question our code can answer.', 'The circle has a center and a radius. The rectangle has edges. First, find the point on the rectangle closest to the circle center.', 'constrain clamps the circle x coordinate between the left and right edges. Do the same with y between the top and bottom edges.', 'Now dist measures the distance from the ball center to that nearest point. If it is smaller than the radius, the variable touching becomes true.', 'A variable can hold true or false, just like it holds a number. Our if statement reads touching and picks the brick color.', 'Move the ball around the corners as well as the sides. Testing edges and corners helps us discover whether a collision rule works everywhere.'],
    code: `let ballSize = 40;\nlet brick = {x: 160, y: 140, w: 160, h: 40};\nlet hitColor = '#ec693f';\n\n`+base("  let nearX = constrain(mouseX, brick.x, brick.x + brick.w);\n  let nearY = constrain(mouseY, brick.y, brick.y + brick.h);\n  // touching holds true or false: the answer to a question.\n  let touching = dist(mouseX, mouseY, nearX, nearY) < ballSize / 2;\n  if (touching) {\n    fill(hitColor);\n  } else {\n    fill('#a9bc9a');\n  }\n  rect(brick.x, brick.y, brick.w, brick.h, 4);\n  fill('#7e73bd');\n  circle(mouseX, mouseY, ballSize);"),
    exercises: [E('A bigger contact zone', 'Set <code>ballSize</code> to <code>80</code>.', 'The collision uses ballSize / 2, so it automatically matches the new drawing.', '__calls.circle.some(a=>a[2]===80)&&ballSize===80'), E('Purple means contact', 'Set <code>hitColor</code> to <code>\'#7e73bd\'</code>.', 'Update hitColor, then move the ball onto the brick to see the contact color.', "hitColor==='#7e73bd'"), E('Say HIT!', 'When the ball touches the brick, write the word <code>HIT!</code> on the canvas with <code>text()</code>. When it does not touch, show nothing.', `Inside the if (touching) block, add text('HIT!', 20, 30);. It only runs when touching is true.`, `(()=>{mouseX=brick.x+brick.w/2;mouseY=brick.y+brick.h/2;draw();const hit=__calls.text.length>0;mouseX=5;mouseY=5;draw();const miss=__calls.text.length===0;return hit&&miss;})()`, 'Your code noticed the touch and told the player about it.')]
  },
  {
    title: 'Catch it. Send it flying.', short: 'Ball meets paddle', description: 'Put a moving ball, mouse input, and a collision rule together. Then write the line that makes the paddle bounce the ball back.', tags: ['Paddle collision', '&& (and)', 'Your first TODO'], concept: 'paddle', idea: 'A collision needs a response.', explanation: 'Three questions must all be true for a catch: is the ball moving down, is it low enough, and is it over the paddle? && means AND. When all three are true, send the ball back up.', takeaway: 'Detect the touch. Change the motion. Keep playing.', note: 'Find the <code>// TODO</code> in <code>bounceOffPaddle()</code>. From now on, every chapter leaves a key line or two for you to write.',
    story: ['It is time to combine our ideas. A moving ball, a paddle that follows your mouse, and a collision rule. Together they become the start of your game.', 'Look at draw. It reads like a to do list: move the paddle, move the ball, check the paddle, check for a miss. Each job is its own function.', 'The ball has two speeds. speedX moves it across, and speedY moves it up or down. Adding both every frame makes it travel diagonally.', 'In bounceOffPaddle, three true or false questions must all be true. Is the ball moving down? Is it low enough? Is it over the paddle?', 'Right now the ball does not bounce. Your job is to write the missing line: make speedY negative, so the ball flies back up.', 'Do not worry if you miss. The ball resets so you can try again. Change the paddle width and discover how small choices change the challenge.'],
    code: gameCode(20),
    exercises: [E('Catch!', 'Find the TODO in <code>bounceOffPaddle()</code> and make the ball bounce back up.', 'speedY is positive while the ball moves down. Replace the TODO line with speedY = -abs(speedY); so it always becomes negative.', `(()=>{mouseX=240;ballX=240;ballY=282;speedX=0;speedY=3;draw();return speedY<0;})()`, 'Nice catch! A collision plus a response makes a bounce.'), E('Easy mode', 'Make <code>paddleWidth</code> equal <code>150</code>.', 'A wider paddle gives you more room to catch the ball.', 'paddleWidth===150&&__calls.rect.some(a=>a[2]===150)'), E('Count your catches', 'Create a <code>catches</code> variable that goes up by 1 every time the paddle bounces the ball. Show it on the canvas with <code>text()</code>.', `Add let catches = 0; at the top. Inside the if in bounceOffPaddle, add catches += 1;. In drawPaddleAndBall, add text('CATCHES ' + catches, 20, 24);`, `(()=>{if(typeof catches!=='number')return false;const c0=catches;mouseX=240;ballX=240;ballY=282;speedX=0;speedY=3;draw();return catches===c0+1&&__calls.text.length>0;})()`, 'You added a brand-new feature to a game. That is game development!')]
  },
  {
    title: 'Let’s break some bricks.', short: 'Bricks that can break', description: 'Every brick is built from a Brick class. Write the line that breaks a brick when the ball hits it.', tags: ['Brick class', 'Object arrays', 'break'], concept: 'bricks', idea: 'A brick remembers whether it still exists.', explanation: 'Each Brick has an alive property. drawBricks() only draws living bricks. On a hit, set alive to false and the brick vanishes from your world.', takeaway: 'A change in data becomes a change in your world.', note: 'Lines marked <code>// ✨ NEW</code> were added in this chapter. Clearing the wall builds a new one. Scores are coming next.',
    story: ['Your ball has a purpose now: clear a wall of bricks. Every brick is made from a Brick class, the blueprint idea from chapter seventeen.', 'Each brick remembers its position, its size, and an alive property that starts as true. makeBricks uses nested loops to build the whole wall.', 'In breakBricks, we visit every brick and use our nearest point test. If the ball overlaps a living brick, that brick has been hit.', 'Your job is to finish the hit. Set the brick alive property to false. Then drawBricks skips it, and it disappears from the world.', 'The word break stops the loop after one hit. That way the ball cannot bounce twice in one frame when it touches two bricks.', 'checkWallCleared counts the bricks that are still alive. When the count reaches zero, a fresh wall appears. Try different rows and columns!'],
    code: gameCode(21),
    exercises: [E('Break it!', 'Finish the TODO in <code>breakBricks()</code> so a brick disappears when the ball hits it.', 'Each brick has an alive property. Replace the TODO line with brick.alive = false;', `(()=>{const b=bricks[0];ballX=b.x+b.w/2;ballY=b.y+b.h+5;speedX=0;speedY=-3;draw();return b.alive===false;})()`, 'Crunch! Changing one property changed your whole world.'), E('One more row', 'Build <code>4</code> rows of bricks.', 'Change rows = 3 to rows = 4 near the top of the sketch.', 'rows===4&&bricks.length===rows*columns'), E('Tough bricks', 'Make every brick take <em>two</em> hits to break. Give each Brick a <code>hits</code> property that starts at 2.', 'In the Brick constructor, add this.hits = 2;. In breakBricks, take 1 away from brick.hits on every hit, and only set alive to false when hits reaches 0: if (brick.hits <= 0) { brick.alive = false; }', `(()=>{const b=bricks[0];ballX=b.x+b.w/2;ballY=b.y+b.h+5;speedX=0;speedY=-3;draw();const first=b.alive;ballX=b.x+b.w/2;ballY=b.y+b.h+5;speedY=-3;draw();return first===true&&b.alive===false;})()`, 'Tough bricks! You changed the rules of your own game.')]
  },
  {
    title: 'Make every hit count.', short: 'Score & second chances', description: 'Write the lines that keep score and count lives. Now the player has something to aim for.', tags: ['Score', 'Lives', 'text()'], concept: 'score', idea: 'Variables can remember your progress.', explanation: 'Add points when a brick breaks. Take away a life when the ball falls. drawScore() shows both, so the player always knows how they’re doing.', takeaway: 'Good feedback makes the rules visible.', note: 'Two TODOs this time: one in <code>breakBricks()</code> and one in <code>checkMiss()</code>. Running out of lives starts a fresh game.',
    story: ['Breaking bricks is satisfying, but how do you know how well you are doing? A score turns your progress into a number you can see.', 'The score variable starts at zero. Your first job: when a brick breaks, add pointsPerBrick to score, right where the brick is hit.', 'The lives variable remembers how many chances remain. Your second job: take away one life when the ball falls below the canvas.', 'drawScore uses text to show the numbers. The plus sign joins words and numbers together into one message for the player.', 'startingLives remembers how many lives a new game begins with. When lives reach zero, restartGame uses it to start fresh.', 'Try changing the reward for a brick or giving yourself more lives. Notice how visible feedback helps you understand what your code is doing.'],
    code: gameCode(22),
    exercises: [E('Keep score', 'Finish the TODO in <code>breakBricks()</code>: add <code>pointsPerBrick</code> to the score whenever a brick breaks.', 'Replace the TODO with score += pointsPerBrick;', `(()=>{score=0;const b=bricks[0];ballX=b.x+b.w/2;ballY=b.y+b.h+5;speedX=0;speedY=-3;draw();return score===pointsPerBrick;})()`), E('Count your lives', 'Finish the TODO in <code>checkMiss()</code>: take away one life when the ball falls off the bottom.', 'Replace the TODO with lives -= 1;', `(()=>{lives=3;ballY=height+20;speedY=3;draw();return lives===2;})()`), E('Bonus row', 'Make bricks in the top row worth <em>double</em> points. Top-row bricks have a <code>y</code> of 45.', 'Use an if/else where the score goes up: if (brick.y === 45) { score += pointsPerBrick * 2; } else { score += pointsPerBrick; }', `(()=>{score=0;const top=bricks[0],low=bricks[bricks.length-1];ballX=top.x+top.w/2;ballY=top.y+top.h+5;speedX=0;speedY=-3;draw();const a=score;ballX=low.x+low.w/2;ballY=low.y+low.h+5;speedY=-3;draw();return a===2*pointsPerBrick&&score-a===pointsPerBrick;})()`, 'Bonus points! Now players have a reason to aim high.')]
  },
  {
    title: 'Ready. Playing. Game over.', short: 'Game states & restart', description: 'Let the game know which moment it is in. Write the lines that launch the ball and end the game.', tags: ['State machine', 'Strings', 'mousePressed()'], concept: 'states', idea: 'A game has different modes of being.', explanation: 'A state variable holds ready, playing, over, or won. The ball only moves while playing. Clicks and lost lives move the game from one state to another.', takeaway: 'Decide which state you’re in before deciding what to do.', note: 'The ball will not launch until you finish the TODO in <code>mousePressed()</code>. Then click the canvas to play.',
    story: ['A game needs a beginning, a middle, and an ending. A state variable remembers which part of the experience is happening right now.', 'Our states are ready, playing, over, and won. They are strings, words inside quotes, that our if statements can compare.', 'Look at draw. The ball only moves when state is playing. In the ready state, the game waits and shows a message instead.', 'mousePressed runs once every time you click. Your first job: when state is ready, a click should change state to playing.', 'Your second job: when lives run out, set state to over. drawMessage notices and shows the ending screen. Another click starts again.', 'Follow each change from one state to the next. States are like rooms in a house, and your code decides which door leads where.'],
    code: gameCode(23),
    exercises: [E('Launch!', 'Finish the TODO in <code>mousePressed()</code> so a click changes <code>state</code> from ready to playing.', "Replace the TODO with state = 'playing'; then click the canvas to launch.", `(()=>{state='ready';mousePressed();return state==='playing';})()`), E('Game over', 'Finish the TODO in <code>checkMiss()</code>: when lives run out, set <code>state</code> to over.', "Replace the TODO with state = 'over';. drawMessage() already knows how to show the ending screen.", `(()=>{state='playing';lives=1;ballY=height+20;speedY=3;draw();return state==='over';})()`), E('Pause button', "Add a pause: pressing <code>p</code> switches between 'playing' and 'paused'. Nothing moves while paused.", "Write a new function: function keyPressed() { if (key === 'p') { if (state === 'playing') { state = 'paused'; } else if (state === 'paused') { state = 'playing'; } } }. Click the canvas first, then press p.", `(()=>{if(typeof keyPressed!=='function')return false;state='playing';key='p';keyCode=80;keyPressed();const paused=state==='paused';const y0=ballY;draw();const still=ballY===y0;keyPressed();return paused&&still&&state==='playing';})()`, 'A brand-new state that you designed yourself!')]
  },
  {
    title: 'A little pop. A lot of delight.', short: 'Particles & game feel', description: 'Make each hit burst into tiny sparks. Combine a class, randomness, and an array to give the game personality.', tags: ['Particle class', 'push()', 'Lifetime'], concept: 'particles', idea: 'An effect is a tiny simulation of its own.', explanation: 'Each Particle has a position, a random velocity, and a short life. Push new ones into an array on every hit, and keep only the ones that still have life.', takeaway: 'Small feedback can make a big moment feel great.', note: 'Finish the TODO in <code>burst()</code>, then launch the ball and break a brick to see the sparks.',
    story: ['The rules work, but a great game also feels good. Let us add a burst of tiny sparks whenever the ball breaks a brick.', 'Each spark is made from the Particle class. It has a position, a random speed, and a life counter that starts at thirty.', 'burst runs a loop when a brick breaks. Your job is to fill that loop: push a new Particle into the particles array each time around.', 'Every frame, each particle moves and loses one life. The fourth fill number is see through-ness, so the sparks fade as life runs out.', 'drawParticles keeps only the sparks that still have life, in a new array called stillAlive. The old sparks are left behind and disappear.', 'Try a bigger burst and watch the effect. Good game feel uses a little feedback to make a small moment feel clear and rewarding.'],
    code: gameCode(24),
    exercises: [E('Make sparks', 'Finish the TODO in <code>burst()</code>: add a new Particle to the <code>particles</code> array each time the loop runs.', 'Replace the TODO with particles.push(new Particle(x, y));. push() adds an item to the end of an array.', `(()=>{particles=[];burst(100,100);return particles.length===particleCount&&particles[0] instanceof Particle;})()`, 'Pop! Every hit now celebrates.'), E('A bigger celebration', 'Make <code>particleCount</code> equal <code>24</code>.', 'The burst loop creates particleCount sparks. Double the starting value from 12 to 24.', 'particleCount===24'), E('Add gravity', 'Make the sparks fall like real ones: add a little to each particle’s <code>vy</code> every frame.', 'In the Particle update() method, add this.vy += 0.15;. A downward speed that keeps growing is what gravity looks like in code.', `(()=>{particles=[new Particle(100,100)];particles[0].vy=0;draw();draw();return particles.length>0&&particles[0].vy>0;})()`, 'Gravity in one line. You are writing physics now!')]
  },
  {
    title: 'Ready for the next level?', short: 'Levels & difficulty', description: 'Count the bricks that are left, build a new wall, and make each level a little more challenging.', tags: ['Counting', 'Progression', 'Difficulty'], concept: 'levels', idea: 'A level is a fresh world with new settings.', explanation: 'Count the living bricks. When none are left, add one to level, build a new wall, and make the ball a little faster.', takeaway: 'A good challenge grows with the player.', note: 'Finish the TODO in <code>checkWallCleared()</code>. Testing tip: set <code>rows</code> to 1 so you can clear a wall quickly.',
    story: ['You can finish a wall. What happens next? Levels give the player a new goal and let the game grow a little more challenging.', 'checkWallCleared counts the bricks that are still alive. The counter starts at zero and adds one for every living brick it finds.', 'When the count is zero, the wall is clear. Your job is to add one to level. Then the game builds a new wall and resets the ball.', 'The new speed uses the level number and levelBoost. A small boost makes each level a gentle step up instead of a sudden jump.', 'The game returns to ready before the next launch. That short pause gives the player time to notice the new level and get ready.', 'Try a very small boost, then a larger one. Test the feeling, not just the numbers. Difficulty is something you design for a person.'],
    code: gameCode(25),
    exercises: [E('Next level', 'Finish the TODO in <code>checkWallCleared()</code>: add 1 to <code>level</code> when the wall is clear.', 'Replace the TODO with level += 1;. The next line already uses level to speed up the ball.', `(()=>{level=1;state='playing';for(const b of bricks)b.alive=false;draw();return level===2;})()`), E('A gentler climb', 'Set <code>levelBoost</code> to <code>0.25</code>.', 'This value is multiplied by level minus one when a new wall begins.', 'levelBoost===0.25'), E('Shrinking paddle', 'Make the paddle 10 pixels narrower every new level, but never narrower than 50.', 'Inside if (bricksLeft === 0), add paddleWidth = max(50, paddleWidth - 10);. max() picks the bigger of two numbers, so the paddle never drops below 50.', `(()=>{const w0=paddleWidth;state='playing';for(const b of bricks)b.alive=false;draw();if(!(paddleWidth<w0))return false;for(let i=0;i<20;i++){state='playing';for(const b of bricks)b.alive=false;draw();}return paddleWidth>=50;})()`, 'Every level now asks a little more of the player.')]
  },
  {
    title: 'You built this. Make it yours.', short: 'Your brick breaker', description: 'From a single circle to a complete game. Customize your arcade, add your own feature, and share your sketch with someone.', tags: ['Final project', 'Playtest', 'Make it yours'], concept: 'game', idea: 'You’re a programmer. Keep experimenting.', explanation: 'Your game brings together variables, loops, functions, classes, input, physics, and states. Every part started as one small idea you learned to control.', takeaway: 'Big projects are small, understandable pieces working together.', note: 'Download your sketch and paste it into the p5.js web editor to share your creation.',
    story: ['Look at what you have built. Your first circle has become a complete brick breaker, with a paddle, collisions, scores, lives, levels, and sparks.', 'Variables remember the world. Arrays collect the bricks. Classes are blueprints for bricks and sparks. Functions give every job a name.', 'The draw loop brings those pieces to life. Input lets you play, collision rules create consequences, and states give the game a beginning and an ending.', 'Now make it yours. Choose your colors, change the wall, and decide what kind of challenge you want another player to experience.', 'Ask someone to play. Watch where they smile and where they seem confused. Their experience can teach you what to improve next.', 'You do not have to know everything to make something wonderful. Keep asking what happens if, change one idea, and build your next project one brick at a time.'],
    code: gameCode(26),
    exercises: [E('Your signature palette', 'Set <code>brickColor</code> to <code>\'#7e73bd\'</code> and <code>paddleColor</code> to <code>\'#e6bd58\'</code>.', 'Find both color variables at the top. Change their quoted values, then run.', "brickColor==='#7e73bd'&&paddleColor==='#e6bd58'&&__calls.fill.some(a=>a[0]==='#e6bd58')"), E('Design your arena', 'Create <code>5</code> rows and <code>7</code> columns of bricks.', 'Set rows = 5 and columns = 7. You should see 35 bricks in your wall.', 'rows===5&&columns===7&&bricks.length===35'), E('High score', 'Add a <code>highScore</code> that remembers your best score, even after game over, and show it on the canvas.', "Add let highScore = 0; at the top. In draw(), add if (score > highScore) { highScore = score; }. In drawScore(), add text('BEST ' + highScore, 380, 24);", `(()=>{if(typeof highScore!=='number')return false;state='playing';score=120;lives=1;ballY=height+20;speedY=3;draw();mousePressed();draw();return state==='ready'&&score===0&&highScore>=120&&__calls.text.some(a=>String(a[0]).includes(String(highScore)));})()`, 'A high score gives every player a reason to try one more time!')]
  }
];
COURSE.forEach((lesson, index) => {lesson.id=index+1;lesson.unit=UNITS.findIndex(u=>lesson.id>=u.start&&lesson.id<=u.end);});
