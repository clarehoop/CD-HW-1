const Level3 = function () {

    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
  
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
  
    // -----------------------------------------------------------------
    // PIXEL BUFFER -- same idea as Level 2: a 320x200 logical grid,
    // drawn as PIXEL_SIZE x PIXEL_SIZE rects. depthBuffer is a second
    // grid of the same size, storing 1/z (inverse camera-space depth)
    // per pixel -- LARGER invZ means CLOSER to the camera. Starting it
    // at 0 means "nothing drawn here yet / infinitely far away", so any
    // real surface (invZ > 0) will beat it on the first write.
    // -----------------------------------------------------------------
    function clearBuffers() {
      for (let u = 0; u < cols; u++) {
        pixelGrid[u].fill("#050510");
        depthBuffer[u].fill(0);
      }
    }
  
    function setPixelColor(u, v, color) {
      u = Math.round(u);
      v = Math.round(v);
      if (u < 0 || u >= cols || v < 0 || v >= rows) return;
      pixelGrid[u][v] = color;
    }
  
    // Custom line rasterizer -- used only for the cockpit overlay here;
    // the 3D scene itself is drawn entirely via filled triangles below.
    function makePixelatedLine(u1, v1, u2, v2, color) {
      let du = u2 - u1;
      let dv = v2 - v1;
  
      if (Math.abs(du) >= Math.abs(dv)) {
        if (u1 > u2) { [u1, u2] = [u2, u1]; [v1, v2] = [v2, v1]; du = u2 - u1; dv = v2 - v1; }
        const m = du === 0 ? 0 : dv / du;
        let v = v1;
        for (let u = u1; u <= u2; u++) { setPixelColor(u, Math.round(v), color); v += m; }
      } else {
        if (v1 > v2) { [u1, u2] = [u2, u1]; [v1, v2] = [v2, v1]; du = u2 - u1; dv = v2 - v1; }
        const mInv = dv === 0 ? 0 : du / dv;
        let u = u1;
        for (let v = v1; v <= v2; v++) { setPixelColor(Math.round(u), v, color); u += mInv; }
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
  
    // -----------------------------------------------------------------
    // TRIANGLE FILL -- edge-function rasterization with a depth test.
    //
    // For three 2D screen points a, b, c, the "edge function"
    //   E(a,b,p) = (p.u-a.u)*(b.v-a.v) - (p.v-a.v)*(b.u-a.u)
    // is proportional to twice the signed area of triangle (a,b,p).
    // Its SIGN tells you which side of line a->b the point p is on.
    // A point is inside the triangle exactly when it's on the same
    // side of all 3 edges -- i.e. E(a,b,p), E(b,c,p), E(c,a,p) all
    // share the same sign (or are zero, meaning "on the edge").
    //
    // Those same 3 edge-function values, once normalized by the
    // triangle's total area, ARE the barycentric weights (w0,w1,w2)
    // -- they tell you how much each of the 3 corners contributes to
    // point p. That's what lets us interpolate depth smoothly across
    // the triangle's interior instead of only knowing depth at the
    // 3 corners.
    //
    // Depth itself is interpolated as 1/z (inverse depth) rather than
    // z directly, because 1/z is linear (affine) in screen space under
    // a perspective projection, while z itself is not -- interpolating
    // z directly would warp faces that are angled toward the camera.
    // -----------------------------------------------------------------
    function edgeFn(ax, ay, bx, by, px, py) {
      return (px - ax) * (by - ay) - (py - ay) * (bx - ax);
    }
  
    function fillTriangle(p0, p1, p2, color) {
      const area = edgeFn(p0.u, p0.v, p1.u, p1.v, p2.u, p2.v);
      if (area === 0) return; // degenerate (zero-area) triangle -- skip
  
      const minU = Math.max(0, Math.floor(Math.min(p0.u, p1.u, p2.u)));
      const maxU = Math.min(cols - 1, Math.ceil(Math.max(p0.u, p1.u, p2.u)));
      const minV = Math.max(0, Math.floor(Math.min(p0.v, p1.v, p2.v)));
      const maxV = Math.min(rows - 1, Math.ceil(Math.max(p0.v, p1.v, p2.v)));
  
      for (let v = minV; v <= maxV; v++) {
        for (let u = minU; u <= maxU; u++) {
          const px = u + 0.5, py = v + 0.5; // sample pixel centers
  
          let w0 = edgeFn(p1.u, p1.v, p2.u, p2.v, px, py);
          let w1 = edgeFn(p2.u, p2.v, p0.u, p0.v, px, py);
          let w2 = edgeFn(p0.u, p0.v, p1.u, p1.v, px, py);
  
          // inside test: all 3 weights must share the triangle's winding sign
          const inside = area > 0
            ? (w0 >= 0 && w1 >= 0 && w2 >= 0)
            : (w0 <= 0 && w1 <= 0 && w2 <= 0);
          if (!inside) continue;
  
          w0 /= area; w1 /= area; w2 /= area;
  
          // interpolate inverse depth across the triangle
          const invZ = w0 * p0.invZ + w1 * p1.invZ + w2 * p2.invZ;
  
          // depth test: only draw if this surface is closer than
          // whatever is already stored at this pixel
          if (invZ > depthBuffer[u][v]) {
            depthBuffer[u][v] = invZ;
            pixelGrid[u][v] = color;
          }
        }
      }
    }
  
    // simple flat (Lambertian-style) shading: darken a hex color by a
    // 0..1 factor, so faces angled away from the light read as dimmer
    function shade(hex, factor) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const f = Math.max(0.35, Math.min(1, factor));
      return `rgb(${Math.round(r * f)}, ${Math.round(g * f)}, ${Math.round(b * f)})`;
    }
  
    const LIGHT_DIR = normalize({ x: 0.4, y: 0.8, z: -0.4 });
    function normalize(v) {
      const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
      return { x: v.x / len, y: v.y / len, z: v.z / len };
    }
  
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
  
          // simple near-plane handling: if ANY vertex of this object is
          // behind the camera, skip the whole object this frame rather
          // than attempting per-triangle clipping (a known simplification --
          // fine for this project's scope, worth noting in documentation)
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
  
          // flat shading: approximate the face normal from the world-space
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
  
      drawCockpit();  // written directly into pixelGrid, on top of everything,
                       // ignoring depth -- it's a fixed 2D overlay, not part
                       // of the 3D scene
      drawPixelGrid();
      drawHUD();
    }
  
    // -----------------------------------------------------------------
    // MOTION, COLLISION, RESET -- identical logic to Levels 1 & 2
    // -----------------------------------------------------------------
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