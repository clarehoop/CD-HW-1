const Level3 = function () {

    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");

    //consts and variables again
    const cols = 320;
    const rows = 200;
    let PIXEL_SIZE = 5;
    const SPEED = 0.15;
    const TRACK_LENGTH = 60;
    const HIT_DISTANCE = 1.5;
    const hazardModels = ["cliffs", "coral", "fish"];
  
    let objects, initialHazardPositions, pixelGrid, depthBuffer;
    let camera, startCam, health, score, pause, gameOver, restartTimer, flashTimer, invulnTimer;
    let animationId;
  
// still 320x200 grid again, same as Level 2, just drawn bigger with PIXEL_SIZE squares 
// depthBuffer is a second grid the same size that keeps track of how close the closest thing drawn
// at each pixel is, so closer stuff can draw over farther stuff
//
// im storing 1/z instead of z (bigger number = closer to camera)
// Starts at 0 everywhere (nothing drawn yet / "infinitely far"), so
// literally anything real will beat it the first time something tries to draw there.

    function clearBuffers() {
      for (let u = 0; u < cols; u++) {
        pixelGrid[u].fill("#050510");
        depthBuffer[u].fill(0);
      }
    }
  
    // same as level 2
    function setPixelColor(u, v, color) {
      u = Math.round(u);
      v = Math.round(v);
      if (u < 0 || u >= cols || v < 0 || v >= rows) return;
      pixelGrid[u][v] = color;
    }
  
    // reusing my level 2 makepixelated line and drawing only for the cockpit overlay here;
    // 3D scene is drawn  via filled triangles below
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
    function cockpitLine(x1, y1, x2, y2, color) {
      makePixelatedLine(Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2), color);
    }
    function cockpitRect(x, y, width, height, color) {
      cockpitLine(x, y, x + width, y, color);
      cockpitLine(x + width, y, x + width, y + height, color);
      cockpitLine(x + width, y + height, x, y + height, color);
      cockpitLine(x, y + height, x, y, color);
    }
    function drawCockpit() {
      const w = cols, h = rows;
      const cockpitColor = "#2f6fb0";
      const panelColor = "#3b82a0";
  
      cockpitLine(0, 0, w * 0.22, h * 0.65, cockpitColor);
      cockpitLine(0, h, w * 0.22, h * 0.65, cockpitColor);
      cockpitLine(w, 0, w * 0.78, h * 0.65, cockpitColor);
      cockpitLine(w, h, w * 0.78, h * 0.65, cockpitColor);
      cockpitLine(w * 0.22, h * 0.65, w * 0.78, h * 0.65, cockpitColor);
  
      cockpitRect(w * 0.15, h * 0.65, w * 0.70, h * 0.35, cockpitColor);
      cockpitRect(w * 0.18, h * 0.70, w * 0.20, h * 0.22, panelColor);
      cockpitRect(w * 0.62, h * 0.70, w * 0.20, h * 0.22, panelColor);
  
      for (let y = h * 0.72; y <= h * 0.88; y += 4) {
        cockpitLine(w * 0.42, y, w * 0.58, y, panelColor);
      }
    }
  
    
  // ok for level 3 we need to use triangles to fill
  //  im using  3 half planes approach from class and HW
  // 1. so a has triangle p0, p1, p2 and some point p, i'll split p into 3 smaller triangles: (p1,p2,p), (p2,p0,p), (p0,p1,p) 
  // 2. each of the smaller triangles have an area, and that area will tells me which side of that edge p is on
  //(positive or negative) 
  // so if all the areas are the same sign i can cover that pixel bc it is in the triangle, if they're not then i know it's outside the triangle

  //then i need to find my barycentric  coordinates by taking those 3 half plane areas divided by whole triangle area for future coloring and depth
  // for depth i decided to interpolate 1/z not z, as z could make it appear warped as camera is moving
  // 1/z will interpolate the bcs to use as my z buffer value (basically bigger invz is closer to camera)

    function edgeFn(ax, ay, bx, by, px, py) {
      return (px - ax) * (by - ay) - (py - ay) * (bx - ax);
    }
  
    function fillTriangle(p0, p1, p2, color) {
      const area = edgeFn(p0.u, p0.v, p1.u, p1.v, p2.u, p2.v); //get my FULL triangle are
      if (area === 0) return; 
      
      //set my box to check in (don't want to check full screen)
      const minU = Math.max(0, Math.floor(Math.min(p0.u, p1.u, p2.u)));
      const maxU = Math.min(cols - 1, Math.ceil(Math.max(p0.u, p1.u, p2.u)));
      const minV = Math.max(0, Math.floor(Math.min(p0.v, p1.v, p2.v)));
      const maxV = Math.min(rows - 1, Math.ceil(Math.max(p0.v, p1.v, p2.v)));
      //start my planing and barycentric coordinate find
      for (let v = minV; v <= maxV; v++) {
        for (let u = minU; u <= maxU; u++) {
          const px = u + 0.5, py = v + 0.5; // pixel centers
          
          //find my areas of my three half planes
          let bc0 = edgeFn(p1.u, p1.v, p2.u, p2.v, px, py);
          let bc1 = edgeFn(p2.u, p2.v, p0.u, p0.v, px, py);
          let bc2 = edgeFn(p0.u, p0.v, p1.u, p1.v, px, py);
  
          // check if they all share same sign 
          //if they do continue
          const inside = area > 0
            ? (bc0 >= 0 &&bc1 >= 0 && bc2 >= 0)
            : (bc0 <= 0 && bc1 <= 0 && bc2 <= 0);
          if (!inside) continue;
          //now set the areas over the full triangle to get barcyentric coordinates
          bc0 = bc0 / area; 
          bc1 = bc1 / area; 
          bc2 = bc2/ area;
  
          //interpolate inverse depth across the triangle
          const invZ = w0 * p0.invZ + w1 * p1.invZ + w2 * p2.invZ;
  
          // i need a depth test to only draw if this surface is closer than whatever is already stored at this pixel
          if (invZ > depthBuffer[u][v]) {
            depthBuffer[u][v] = invZ;
            pixelGrid[u][v] = color;
          }
        }
      }
    }
  
    // simple flat shading basically darken a hex color by a
    // 0..1 factor, so faces angled away from the light read as dimmer
    function shade(hex, factor) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const f = Math.max(0.35, Math.min(1, factor));
      return `rgb(${Math.round(r * f)}, ${Math.round(g * f)}, ${Math.round(b * f)})`;
    }
    // set my light direction so i know where to shade as well
    const LIGHT_DIR = normalize({ x: 0.4, y: 0.8, z: -0.4 });

    //normalize my vector so i can dot product it with light dir and for faces
    function normalize(v) {
      const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
      return { x: v.x / len, y: v.y / len, z: v.z / len };
    }
    // reused
    function drawPixelGrid() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#050510";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
  
      for (let v = 0; v < rows; v++) {
        for (let u = 0; u < cols; u++) {
          ctx.fillStyle = pixelGrid[u][v];
          ctx.fillRect(u * PIXEL_SIZE, v * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
        }
      }
    }
    // reused
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
    // now time to draw
    function draw() {
      clearBuffers();
  
      for (let obj of objects) {
        const model = models[obj.model];
        if (!model || !model.faces) continue;
  
        // project every vertex once per object (not once per face)
        const projected = [];
        let skipObject = false;
  
        for (const v of model.vertices) {
          const world = {
            x: v.x * obj.scale + obj.position.x,
            y: v.y * obj.scale + obj.position.y,
            z: v.z * obj.scale + obj.position.z
          };
          const camVert = {
            x: world.x - camera.x,
            y: world.y - camera.y,
            z: world.z - camera.z
          };
  
          // so to deal with near planing i just decided to skip the whole object if any vertice is behind camera
          if (camVert.z <= 0.1) { skipObject = true; break; }
  
          const invZ = 1 / camVert.z;
          projected.push({
            u: (camVert.x * invZ) * cols + cols / 2,
            v: rows / 2 - (camVert.y * invZ) * rows,
            invZ: invZ,
            world: world
          });
        }
  
        if (skipObject) continue;
  
        for (const face of model.faces) {
          const p0 = projected[face[0]];
          const p1 = projected[face[1]];
          const p2 = projected[face[2]];
  
          // flat shading get the face normal from the world space
          // triangle edges, then modulate brightness by how much it faces
          // the light direction (dot product)
          const e1 = {
            x: p1.world.x - p0.world.x,
            y: p1.world.y - p0.world.y,
            z: p1.world.z - p0.world.z
          };
          const e2 = {
            x: p2.world.x - p0.world.x,
            y: p2.world.y - p0.world.y,
            z: p2.world.z - p0.world.z
          };
          const normal = normalize({
            x: e1.y * e2.z - e1.z * e2.y,
            y: e1.z * e2.x - e1.x * e2.z,
            z: e1.x * e2.y - e1.y * e2.x
          });
          const brightness = 0.5 + 0.5 * Math.abs(
            normal.x * LIGHT_DIR.x + normal.y * LIGHT_DIR.y + normal.z * LIGHT_DIR.z
          );
  
          fillTriangle(p0, p1, p2, shade(obj.color, brightness));
        }
      }
  
      drawCockpit();  
      drawPixelGrid();
      drawHUD();
    }
  
  // ok back to reused game play functions as level 1 and 2
    function update() {
      if (pause || gameOver) return;
      camera.z += SPEED;
      score += SPEED;
  
      for (let obj of objects) {
        const dz = obj.position.z - camera.z;
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
  
        const dx = obj.position.x - camera.x;
        const dy = obj.position.y - camera.y;
        const dz = obj.position.z - camera.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) / obj.scale;
  
        if (dist < HIT_DISTANCE) {
          health = health - 1;
          flashTimer = 15;
          invulnTimer = 45;
          if (health <= 0) { gameOver = true; restartTimer = 10; }
          break;
        }
      }
    }
  
    function resetGame() {
      camera = { ...startCam };
      health = 3; score = 0;
      flashTimer = 0; invulnTimer = 0;
      pause = false; gameOver = false; restartTimer = 0;
  
      for (let item of initialHazardPositions) {
        item.obj.position.x = item.x;
        item.obj.position.y = item.y;
        item.obj.position.z = item.z;
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
      const availableW = window.innerWidth;
      const availableH = window.innerHeight - 60;
      PIXEL_SIZE = Math.max(2, Math.min(
        Math.floor(availableW / cols),
        Math.floor(availableH / rows)
      ));
      canvas.width = cols * PIXEL_SIZE;
      canvas.height = rows * PIXEL_SIZE;
    }
  //and again init function for abstraction
    function init() {
      camera = { x: 0, y: 0, z: -10 };
      startCam = { x: 0, y: 0, z: -10 };
      health = 3; score = 0; pause = false; gameOver = false;
      restartTimer = 0; flashTimer = 0; invulnTimer = 0;
  
      objects = [
        { model: "cliffs", position: { x: -3, y: -2, z: 10 }, scale: 1.5, color: "#B22222" },
        { model: "cliffs", position: { x:  3, y: -2, z: 16 }, scale: 2.0, color: "#B22222" },
        { model: "coral",  position: { x: -3, y: 0,  z: 28 }, scale: 0.8, color: "#ff6ec7" },
        { model: "coral",  position: { x:  2, y: 0,  z: 12 }, scale: 1.0, color: "#c56cf0" },
        { model: "fish",   position: { x:  2, y: -1, z: 4  }, scale: 0.5, color: "#8fe3ff" },
        { model: "fish",   position: { x: -2, y: -1, z: 7  }, scale: 0.5, color: "#8fe3ff" }
      ];
  
      for (let col of [-0.5, 0.5]) {
        for (let z = 0; z < TRACK_LENGTH; z += 6) {
          objects.push({
            model: "floorTile",
            position: { x: col * 6, y: -3.5, z },
            scale: 6,
            color: "#1c4d5c"
          });
        }
      }
  
      initialHazardPositions = objects
        .filter(obj => hazardModels.includes(obj.model))
        .map(obj => ({ obj, x: obj.position.x, y: obj.position.y, z: obj.position.z }));
  
      pixelGrid = Array.from({ length: cols }, () => Array(rows).fill("#050510"));
      depthBuffer = Array.from({ length: cols }, () => Array(rows).fill(0));
  
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
