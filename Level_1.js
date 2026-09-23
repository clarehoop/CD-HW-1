const Level1 = function () {
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");

  //set my game play constants and variables
  const SPEED = 0.15;        
  const TRACK_LENGTH = 60;    
  const HIT_DISTANCE = 1.5;
  const hazardModels = ["cliffs", "coral", "fish"];

  let objects, camera, startCam, health, score, pause, gameOver, restartTimer, flashTimer, invulnTimer;
  let animationId;

  //reuse of draw function from HW1 with some tweaks
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let obj of objects) {
      let model = models[obj.model];
      let projectedVertices = [];

      for (let v of model.vertices) {
        let ocean = {
          x: v.x * obj.scale + obj.position.x, //changed to allow for objects to be scaled and moved
          y: v.y * obj.scale + obj.position.y,
          z: v.z * obj.scale + obj.position.z
        };
        let camVert = {
          x: ocean.x - camera.x,
          y: ocean.y - camera.y,
          z: ocean.z - camera.z
        };

        //had to add so that when im passing objects they dont extend towards origin
        if (camVert.z <= 0.1) { projectedVertices.push(null); continue; }

        let canvasPos = {};
        canvasPos.u = (camVert.x / camVert.z) * canvas.width + canvas.width / 2;
        canvasPos.v = (camVert.y / camVert.z) * canvas.height + canvas.height / 2;
        projectedVertices.push(canvasPos);
      }

      for (let e of model.edges) {
        let p1 = projectedVertices[e[0]]; 
        let p2 = projectedVertices[e[1]];
        if (!p1 || !p2) continue; // skip edges touching a near-clipped vertex so doesnt extend towards origin

        let u1 = p1.u, v1 = canvas.height - p1.v;
        let u2 = p2.u, v2 = canvas.height - p2.v;
        drawLine(u1, v1, u2, v2, obj.color);
      }
    }

    drawCockpit();
    drawHUD();
  }

  function drawLine(x1, y1, x2, y2, color) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = color || "white";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  //cockpit overlay so it can look similar to the star wars trench run we saw in class
  function drawCockpit() {
    const w = canvas.width;
    const h = canvas.height;
    const cockpitColor = "#2f6fb0";
    const panelColor = "#3b82a0";

    ctx.save();
    ctx.strokeStyle = cockpitColor;
    ctx.lineWidth = 3;

    // top + bottom lines converging at the same point on each side
    line(0, 0, w * 0.22, h * 0.65);
    line(0, h, w * 0.22, h * 0.65);
    line(w, 0, w * 0.78, h * 0.65);
    line(w, h, w * 0.78, h * 0.65);

    // horizontal frame connecting the lower view
    line(w * 0.22, h * 0.65, w * 0.78, h * 0.65);

    // lower control panel
    ctx.strokeRect(w * 0.15, h * 0.65, w * 0.70, h * 0.35);

    // left & right instrument gauges
    ctx.strokeStyle = panelColor;
    ctx.strokeRect(w * 0.18, h * 0.70, w * 0.20, h * 0.22);
    ctx.strokeRect(w * 0.62, h * 0.70, w * 0.20, h * 0.22);

    // center dash scan lines
    for (let y = h * 0.72; y <= h * 0.88; y += 4) {
      line(w * 0.42, y, w * 0.58, y);
    }

    // hit flash when hazard obj hit across the windshield area
    if (flashTimer > 0) {
      ctx.fillStyle = `rgba(255, 40, 40, ${(flashTimer / 15) * 0.35})`;
      ctx.fillRect(0, 0, w, h * 0.65);
      flashTimer--;
    }

    ctx.restore();

    function line(x1, y1, x2, y2) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  // HUD si game players knows how many lives they have and also their score.
  function drawHUD() {
    const w = canvas.width, h = canvas.height;
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
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
  // constantly update the camera and score so that it appears to the user that they are "flying" thru my game
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

  //game function added so that if a player hits a hazard object (fish,coral,rock) they are penalized
  function checkCollisions() {
    if (pause || gameOver) return;
    if (invulnTimer > 0) { invulnTimer--; return; }

    for (let obj of objects) {
      if (!hazardModels.includes(obj.model)) continue;

      //calcute position of my objects so that i know how close they are to my camera
      let dx = obj.position.x - camera.x;
      let dy = obj.position.y - camera.y;
      let dz = obj.position.z - camera.z;
      let dist = Math.sqrt(dx * dx + dy * dy + dz * dz) / obj.scale;
      //if they are closer than the hit dist const, they are penalized and then if they lose all 3 lives, GAME OVER 
      if (dist < HIT_DISTANCE) {
        health = health - 1;
        flashTimer = 15;
        invulnTimer = 45;
        if (health <= 0) {
          gameOver = true;
          restartTimer = 10;
        }
        break;
      }
    }
  }
  //reset game basically just to begining presets so users can play multiple rounds
  function resetGame() {
    camera = { ...startCam };
    health = 3;
    score = 0;
    flashTimer = 0;
    invulnTimer = 0;
    pause = false;
    gameOver = false;
    restartTimer = 0;
    for (let obj of objects) {
      if (hazardModels.includes(obj.model)) {
        obj.position.z += TRACK_LENGTH;
      }
    }
  }
// my key bindings! similar to HW1 but adding funtionality for pause and R now calls my reset game function
  function handleKeyDown(event) {
    event.preventDefault();
    switch (event.code) {
      case "ArrowLeft":  camera.x -= 0.5; break;
      case "ArrowRight": camera.x += 0.5; break;
      case "ArrowDown":  camera.y -= 0.5; break;
      case "ArrowUp":    camera.y += 0.5; break;
      case "Space":
        if (!gameOver) pause = !pause;
        return;
      case "KeyR":
        resetGame();
        break;
      default: return;
    }
  }
  //game loop needed to control all my functions into final playable game
  function gameLoop() {
    if (gameOver) {
      restartTimer--;
      if (restartTimer <= 0) resetGame();
    } else {
      update();
      checkCollisions();
    }
    draw();
    animationId = requestAnimationFrame(gameLoop);
  }

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  //init needed so that i could abstract all my levels out of the html
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
        objects.push({
          model: "floorTile",
          position: { x: col * 6, y: -3.5, z: z },
          scale: 6,
          color: "#1c4d5c"
        });
      }
    }

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
