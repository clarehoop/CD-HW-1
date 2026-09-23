const Level1 = function () {
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");

  const SPEED = 0.15;          // automatic forward speed (units/frame)
  const TRACK_LENGTH = 60;     // how far ahead the world extends before recycling
  const HIT_DISTANCE = 1.5;
  const hazardModels = ["cliffs", "coral", "fish"];

  let objects, camera, startCam, health, score, pause, gameOver, restartTimer, flashTimer, invulnTimer;
  let animationId;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let obj of objects) {
      let model = models[obj.model];
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

        if (camVert.z <= 0.1) { projectedVertices.push(null); continue; }

        let canvasPos = {};
        canvasPos.u = (camVert.x / camVert.z) * canvas.width + canvas.width / 2;
        canvasPos.v = (camVert.y / camVert.z) * canvas.height + canvas.height / 2;
        projectedVertices.push(canvasPos);
      }

      for (let e of model.edges) {
        let p1 = projectedVertices[e[0]];
        let p2 = projectedVertices[e[1]];
        if (!p1 || !p2) continue; // skip edges touching a near-clipped vertex

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

  // -----------------------------------------------------------------
  // COCKPIT OVERLAY -- same geometry/proportions as Level 2 & 3's
  // drawCockpit(), just issued as direct ctx calls (moveTo/lineTo/
  // strokeRect) instead of the pixel rasterizer, since Level 1 draws
  // straight to the real canvas rather than a 320x200 logical grid.
  // -----------------------------------------------------------------
  function drawCockpit() {
    const w = canvas.width;
    const h = canvas.height;
    const cockpitColor = "#2f6fb0";
    const panelColor = "#3b82a0";

    ctx.save();
    ctx.strokeStyle = cockpitColor;
    ctx.lineWidth = 3;

    // top + bottom struts converging at the same point on each side
    // (the "hourglass" frame shape used in Levels 2 & 3)
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

    // hit flash across the windshield area
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

  // matches Level 2/3's drawHUD() layout exactly: top-center
  // SCORE/HEALTH line, centered PAUSED / GAME OVER text
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