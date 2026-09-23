//basically copy paste from level 1
//game play stays the same but my line drawing changes to pixelation functino
const Level2 = function () {


const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

//consts for screen set up and game play like b4
const cols = 320;
const rows = 200;
let  PIXEL_SIZE = 5;
const SPEED = 0.15;          
const TRACK_LENGTH = 60;     
const HIT_DISTANCE = 1.5;
const hazardModels = ["cliffs", "coral", "fish"];

let objects, initialHazardPositions, pixelGrid;
let camera, startCam, health, score, pause, gameOver, restartTimer, flashTimer, invulnTimer;
let animationId;


function clearPixelGrid() {
    for (let u = 0; u < cols; u++) {
      pixelGrid[u].fill("#050510");
    }
}
//function to decide if i should "turn on" a pixel inspiration taken from the inclass activity
function setPixelColor(u, v, color) {
    u = Math.round(u);
    v = Math.round(v);
    if (u < 0 || u >= cols || v < 0 || v >= rows) return;
    pixelGrid[u][v] = color;
}
  
  
// replacing my draw line function for requirements for level 2 (also took some help from the inclass activity here) 
function makePixelatedLine(u1, v1, u2, v2, color) {
    let du = u2 - u1;
    let dv = v2 - v1;
    
    if (Math.abs(du) >= Math.abs(dv)) {
  
      if (u1 > u2) {
        [u1, u2] = [u2, u1];
        [v1, v2] = [v2, v1];
  
        du = u2 - u1;
        dv = v2 - v1;
      }
  
      const m = du === 0 ? 0 : dv / du;
  
      let v = v1;
  
      for (let u = u1; u <= u2; u++) {
        setPixelColor(u, Math.round(v), color);
        v += m;
      }
  
    } else {
  
      if (v1 > v2) {
        [u1, u2] = [u2, u1];
        [v1, v2] = [v2, v1];
  
        du = u2 - u1;
        dv = v2 - v1;
      }
  
      const mInv = dv === 0 ? 0 : du / dv;
  
      let u = u1;
  
      for (let v = v1; v <= v2; v++) {
        setPixelColor(Math.round(u), v, color);
        u += mInv;
      }
    }
}
  // also needed to change how i would draw my cockpit so now draw the line using logical pixel coordinates
function cockpitLine(x1, y1, x2, y2, color) {
    makePixelatedLine(
      Math.round(x1),
      Math.round(y1),
      Math.round(x2),
      Math.round(y2),
      color
    );
  }
  
  // again as stated above need to 'draw' the cockpit rectangle with pixel coordinates
  function cockpitRect(x, y, width, height, color) {
    cockpitLine(x, y, x + width, y, color);
    cockpitLine(x + width, y, x + width, y + height, color);
    cockpitLine(x + width, y + height, x, y + height, color);
    cockpitLine(x, y + height, x, y, color);
  }
  //now can re draw my cockpit
  function drawCockpit() {
    
    const w = cols;
    const h = rows;
  
    const cockpitColor = "#2f6fb0";
    const panelColor = "#3b82a0";

  // left diagonal line 
  cockpitLine(0, 0, w * 0.22, h * 0.65, cockpitColor);
  cockpitLine(0, h, w * 0.22, h * 0.65, cockpitColor);

  // right diagonal line
  cockpitLine(w, 0, w * 0.78, h * 0.65, cockpitColor);
  cockpitLine(w, h, w * 0.78, h * 0.65, cockpitColor);

  // horizontal frame connecting lower view
  cockpitLine(w * 0.22, h * 0.65, w * 0.78, h * 0.65, cockpitColor);


  // lower control panek
  cockpitRect(w * 0.15, h * 0.65, w * 0.70, h * 0.35, cockpitColor);

  // left & right instrument gauges
  cockpitRect(w * 0.18, h * 0.70, w * 0.20, h * 0.22, panelColor);
  cockpitRect(w * 0.62, h * 0.70, w * 0.20, h * 0.22, panelColor);

  // center dash scan lines
  for (let y = h * 0.72; y <= h * 0.88; y += 4) {
    cockpitLine(w * 0.42, y, w * 0.58, y, panelColor);
  }
  }

//drawing 5 x 5 pixel grid
// i did abstract the 5 into pixel size for clarity from in class activity
function drawPixelGrid() {
  // Clear the entire canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#050510";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.lineWidth = 1;
  ctx.strokeStyle = "#444444";

  for (let v = 0; v < rows; v++) {
    for (let u = 0; u < cols; u++) {
      ctx.fillStyle = pixelGrid[u][v];

      // Each logical pixel is exactly 5x5
      ctx.fillRect(
        u * PIXEL_SIZE,
        v * PIXEL_SIZE,
        PIXEL_SIZE,
        PIXEL_SIZE
      );

      
  }}}
  //same as level 1: game play for user to track score and health
  function drawHUD() {
    const w = canvas.width;
    const h = canvas.height;
  
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
  
    // Score & Health Bar rendered relative to full canvas size
    ctx.fillText(`SCORE: ${Math.floor(score)}   HEALTH: ${health}/3`, w / 2, 20);
  
    if (pause) {
      ctx.font = "bold 40px monospace";
      ctx.fillText("PAUSED", w / 2, h / 2 - 20);
    }
  
    if (gameOver) {
      ctx.fillStyle = "#ff4444";
      ctx.font = "bold 40px monospace";
      ctx.fillText("SUBMARINE DESTROYED", w / 2, h / 2 - 20);
    }
    ctx.restore();
  }
  //basically level 1 but again implementing new pixelated line function
  function draw() {

    clearPixelGrid();
  
    for (let obj of objects) {
  
      let model = models[obj.model];
  
      if (!model) continue;
  
      let projectedVertices = [];
  
      for (let v of model.vertices) {
  
        let ocean = {
          x: v.x * obj.scale + obj.position.x,
          y: v.y * obj.scale + obj.position.y,
          z: v.z * obj.scale + obj.position.z
        };
  
        let camVert = {
          x: ocean.x - camera.x,
          y: ocean.y - camera.y,
          z: ocean.z - camera.z
        };
  
        if (camVert.z <= 0.1) {
          projectedVertices.push(null);
          continue;
        }
  
        
        let u = (camVert.x / camVert.z) * cols + cols / 2;
  
        let vScreen = rows / 2 -
          (camVert.y / camVert.z) * rows;
  
        projectedVertices.push({
          u: u,
          v: vScreen
        });
      }
  
      for (let e of model.edges) {
  
        let p1 = projectedVertices[e[0]];
        let p2 = projectedVertices[e[1]];
  
        if (!p1 || !p2) continue;
  
        makePixelatedLine(
          p1.u,
          p1.v,
          p2.u,
          p2.v,
          obj.color
        );
      }
    }
    drawCockpit();


    drawPixelGrid();
    
    drawHUD();
   
    
  }
  //gameplay function from level 1
function update() {
  if (pause || gameOver) return;
  camera.z += SPEED;
  score += SPEED;

  for (let obj of objects) {
    let dz = obj.position.z - camera.z;
    if (dz < -2) {
      obj.position.z += TRACK_LENGTH;
      
      if (hazardModels.includes(obj.model)) {
        obj.position.x = Math.random() * 8 - 4;
      }
    }
  }
}

//game play function from level 1
function checkCollisions() {
if (pause || gameOver) return;

  if (invulnTimer > 0) { invulnTimer--; return; }

  for (let obj of objects) {
    if (!hazardModels.includes(obj.model)) continue;

    let dx = obj.position.x - camera.x;
    let dy = obj.position.y - camera.y;
    let dz = obj.position.z - camera.z;

    let dist = Math.sqrt(dx * dx + dy * dy + dz * dz) / obj.scale;

    if (dist < HIT_DISTANCE) {
      health =  health - 1;
      flashTimer = 15;
      invulnTimer = 45; 
      if (health <= 0 ){
        gameOver = true;
        restartTimer = 10;
      }
      break;
    }
  }
}

//game play function from level 1
function resetGame(){
  camera = {...startCam};

  health =3;
  score =0;
  flashTimer = 0;
  invulnTimer = 0;
  pause =false;
  gameOver =false;
  restartTimer = 0;
  for (let item of initialHazardPositions) {

    item.obj.position.x = item.x;
    item.obj.position.y = item.y;
    item.obj.position.z = item.z;
  }
}
//resize canvas but keeping in mind pixel grid
function resizeCanvas(){
    const availableW = window.innerWidth;
    const availableH = window.innerHeight - 60;
    PIXEL_SIZE = Math.max(2, Math.min(
      Math.floor(availableW / cols),
      Math.floor(availableH / rows)
    ));
    canvas.width = cols * PIXEL_SIZE;
    canvas.height = rows * PIXEL_SIZE;
}
//key bindings are the same
function handleKeyDown(event) {
    event.preventDefault();
    switch (event.code) {
      case "ArrowLeft":  camera.x -= 0.5; break; 
      case "ArrowRight": camera.x += 0.5; break;
      case "ArrowDown": camera.y -= 0.5; break;
      case "ArrowUp": camera.y += 0.5; break;
      case "Space": 
      if (!gameOver){
        pause = !pause;
      }
      return;
      case "KeyR":
        resetGame();
        break;
      default: return;
    }
  }
  //game play loop
function gameLoop() {
    if (gameOver) {
      restartTimer--;
  
      if (restartTimer <= 0) {
        resetGame();
      }
    } else {
      update();
      checkCollisions();
    }
  
    draw();
  
    animationID = requestAnimationFrame(gameLoop);
  }
//init function for abstraction from html
function init() {
    camera = { x: 0, y: 0, z: -10 };
    startCam = { x: 0, y: 0, z: -10 };
    health = 3; score = 0; pause = false; gameOver = false;
    restartTimer = 0; flashTimer = 0; invulnTimer = 0;

    objects = [
        { model: "cliffs", position: { x: -3, y: -2, z: 10 }, scale: 1.5, color: "#B22222" },
        { model: "cliffs", position: { x:  3, y: -2, z: 16 }, scale: 2.0, color: "#B22222" },
        { model: "coral",  position: { x: -3, y: 0,  z: 28 }, scale: 0.8, color: "#B22222" },
        { model: "coral",  position: { x:  2, y: 0,  z: 12 }, scale: 1.0, color: "#B22222" },
        { model: "fish",   position: { x:  2, y: -1, z: 4  }, scale: 0.5, color: "#B22222" },
        { model: "fish",   position: { x: -2, y: -1, z: 7  }, scale: 0.5, color: "#B22222" }
      ];

    for (let col of [-0.5, 0.5]) {
      for (let z = 0; z < TRACK_LENGTH; z += 6) {
        objects.push({ model: "floorTile", position: { x: col * 6, y: -3.5, z }, scale: 6, color: "#1c4d5c" });
      }
    }
    initialHazardPositions = objects
      .filter(obj => hazardModels.includes(obj.model))
      .map(obj => ({ obj, x: obj.position.x, y: obj.position.y, z: obj.position.z }));

    pixelGrid = Array.from({ length: cols }, () => Array(rows).fill("#050510"));

    window.addEventListener("resize", resizeCanvas);
    document.addEventListener("keydown", handleKeyDown);
    resizeCanvas();
    gameLoop();
  }

  function cleanup() {
    cancelAnimationFrame(animationId);
    window.removeEventListener("resize", resizeCanvas);
    document.removeEventListener("keydown", handleKeyDown);
  }

  return { init, cleanup };
}();
