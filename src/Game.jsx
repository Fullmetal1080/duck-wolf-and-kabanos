import React, { useRef, useEffect, useState } from "react";

const TILE_SIZE = 40;
const MAZE_WIDTH = 15;
const MAZE_HEIGHT = 11;
const CABANOS_COUNT = 4;
const MISSILE_WARNING_TIME = 120; // frames (~2s at 60fps)
const FPS = 60;
const MAX_STAGE = 40;

// Helper to play a simple beep sound
function beep(freq = 400, duration = 100) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = freq;
    o.connect(ctx.destination);
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, duration);
  } catch {}
}

function randomFreePosition(maze, avoid = []) {
  while (true) {
    const x = Math.floor(Math.random() * (MAZE_WIDTH - 2)) + 1;
    const y = Math.floor(Math.random() * (MAZE_HEIGHT - 2)) + 1;
    if (maze[y][x] === 0 && !avoid.some(([ax, ay]) => ax === x && ay === y)) {
      return [x, y];
    }
  }
}

function generateMaze(stage) {
  const maze = Array.from({ length: MAZE_HEIGHT }, (_, y) =>
    Array.from({ length: MAZE_WIDTH }, (_, x) =>
      x === 0 || y === 0 || x === MAZE_WIDTH - 1 || y === MAZE_HEIGHT - 1
        ? 1
        : 0
    )
  );
  for (let s = 0; s < stage + 2; s++) {
    const x = Math.floor(Math.random() * (MAZE_WIDTH - 2)) + 1;
    const y = Math.floor(Math.random() * (MAZE_HEIGHT - 2)) + 1;
    maze[y][x] = 1;
  }
  return maze;
}

function GeeseCabanosWolfGame() {
  const canvasRef = useRef();
  const [stage, setStage] = useState(1);
  const [status, setStatus] = useState(""); // "win", "lose", or ""
  const [gameState, setGameState] = useState(null);
  const [restartRequested, setRestartRequested] = useState(false);

  // Game initialization
  useEffect(() => {
    function initGame() {
      const maze = generateMaze(stage);
      const goose = randomFreePosition(maze);
      const wolf = randomFreePosition(maze, [goose]);
      let cabanos = [];
      let busy = [goose, wolf];
      while (cabanos.length < CABANOS_COUNT) {
        const c = randomFreePosition(maze, busy);
        cabanos.push(c);
        busy.push(c);
      }
      return {
        maze,
        goose,
        wolf,
        cabanos,
        missiles: [],
        missileTimer: 0,
        missileInterval: Math.max(60, 120 - stage * 2),
        keys: {},
        gooseMoveCooldown: 0,
      };
    }
    setGameState(initGame());
    setStatus("");
    setRestartRequested(false);
  }, [stage, restartRequested]);

  // Keyboard controls
  useEffect(() => {
    function handleKeyDown(e) {
      if (!gameState) return;
      let keys = { ...gameState.keys };
      if (["ArrowLeft", "a"].includes(e.key)) keys.left = true;
      if (["ArrowRight", "d"].includes(e.key)) keys.right = true;
      if (["ArrowUp", "w"].includes(e.key)) keys.up = true;
      if (["ArrowDown", "s"].includes(e.key)) keys.down = true;
      setGameState((gs) => gs && { ...gs, keys });
    }
    function handleKeyUp(e) {
      if (!gameState) return;
      let keys = { ...gameState.keys };
      if (["ArrowLeft", "a"].includes(e.key)) keys.left = false;
      if (["ArrowRight", "d"].includes(e.key)) keys.right = false;
      if (["ArrowUp", "w"].includes(e.key)) keys.up = false;
      if (["ArrowDown", "s"].includes(e.key)) keys.down = false;
      setGameState((gs) => gs && { ...gs, keys });
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gameState]);

  // Main game loop
  useEffect(() => {
    if (!gameState || status) return;
    let animationFrame;
    function gameLoop() {
      let {
        maze,
        goose,
        wolf,
        cabanos,
        missiles,
        missileTimer,
        missileInterval,
        keys,
        gooseMoveCooldown,
      } = gameState;

      // Goose movement: allow smooth movement holding the key
      let [gx, gy] = goose;
      let dx = 0, dy = 0;
      if (gooseMoveCooldown > 0) gooseMoveCooldown--;
      else if (keys.left) dx = -1;
      else if (keys.right) dx = 1;
      else if (keys.up) dy = -1;
      else if (keys.down) dy = 1;
      if (
        (dx !== 0 || dy !== 0) &&
        maze[gy + dy][gx + dx] === 0 &&
        gx + dx >= 0 &&
        gx + dx < MAZE_WIDTH &&
        gy + dy >= 0 &&
        gy + dy < MAZE_HEIGHT
      ) {
        gx += dx;
        gy += dy;
        gooseMoveCooldown = 6; // frames before next move (smooth, but not too fast)
      }

      // Wolf AI
      let [wx, wy] = wolf;
      let options = [];
      if (gx > wx && maze[wy][wx + 1] === 0) options.push([wx + 1, wy]);
      if (gx < wx && maze[wy][wx - 1] === 0) options.push([wx - 1, wy]);
      if (gy > wy && maze[wy + 1][wx] === 0) options.push([wx, wy + 1]);
      if (gy < wy && maze[wy - 1][wx] === 0) options.push([wx, wy - 1]);
      if (options.length > 0) {
        [wx, wy] = options[Math.floor(Math.random() * options.length)];
      }

      // Missile logic
      missileTimer++;
      if (missileTimer > missileInterval) {
        missileTimer = 0;
        missiles.push({
          ...randomFreePosition(maze, [goose, wolf, ...cabanos]),
          warning: MISSILE_WARNING_TIME,
        });
        beep(800, 60); // Missile warning beep
      }
      missiles = missiles.map((m) =>
        m.warning > 0 ? { ...m, warning: m.warning - 1 } : { ...m, warning: 0 }
      );

      // Collisions
      if (wx === gx && wy === gy) {
        setStatus("lose");
        beep(200, 200);
        return;
      }
      let newCabanos = cabanos.filter(([cx, cy]) => !(cx === gx && cy === gy));
      if (newCabanos.length < cabanos.length) beep(1200, 80); // Collect sound
      if (newCabanos.length === 0) {
        setStatus("win");
        beep(2200, 200);
        return;
      }
      for (let m of missiles) {
        if (m.warning === 0 && m[0] === gx && m[1] === gy) {
          setStatus("lose");
          beep(200, 200);
          return;
        }
      }

      // Draw
      drawGame(
        canvasRef.current,
        maze,
        [gx, gy],
        [wx, wy],
        newCabanos,
        missiles,
        stage,
        status
      );

      setGameState({
        maze,
        goose: [gx, gy],
        wolf: [wx, wy],
        cabanos: newCabanos,
        missiles,
        missileTimer,
        missileInterval,
        keys,
        gooseMoveCooldown,
      });

      animationFrame = requestAnimationFrame(gameLoop);
    }
    animationFrame = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationFrame);
  }, [gameState, status, stage]);

  // Handle stage change
  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => {
      if (status === "win" && stage < MAX_STAGE) setStage((s) => s + 1);
      else setRestartRequested((v) => !v); // restart
    }, 1200);
    return () => clearTimeout(timer);
  }, [status, stage]);

  return (
    <div>
      <h2>Geese, Cabanos &amp; the Big Bad Wolf</h2>
      <canvas
        ref={canvasRef}
        width={MAZE_WIDTH * TILE_SIZE}
        height={MAZE_HEIGHT * TILE_SIZE}
        style={{ border: "2px solid #888", background: "#222" }}
      />
      <div style={{ color: "#FFD700", fontWeight: "bold", margin: "10px" }}>
        Stage: {stage} | Cabanos left: {gameState?.cabanos.length || CABANOS_COUNT}
      </div>
      {status === "win" && (
        <div style={{ color: "green" }}>Stage WON! Next stage...</div>
      )}
      {status === "lose" && (
        <div style={{ color: "red" }}>Goose Eaten! Try Again...</div>
      )}
      <div>
        <b>Controls:</b> Arrow keys or WASD to move goose.
      </div>
      {(status === "lose" || status === "win") && (
        <button
          style={{
            marginTop: "10px",
            padding: "8px 16px",
            fontWeight: "bold",
            background: "#FFD700",
            border: "2px solid #888",
            borderRadius: "6px",
            cursor: "pointer",
          }}
          onClick={() => setRestartRequested((v) => !v)}
        >
          Restart Stage
        </button>
      )}
      {stage > MAX_STAGE && (
        <div style={{ color: "#FFD700", fontWeight: "bold", fontSize: "1.3em" }}>
          Congratulations! You finished all stages!
        </div>
      )}
    </div>
  );
}

// Draw everything on canvas
function drawGame(
  canvas,
  maze,
  goose,
  wolf,
  cabanos,
  missiles,
  stage,
  status
) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Maze
  for (let y = 0; y < MAZE_HEIGHT; y++) {
    for (let x = 0; x < MAZE_WIDTH; x++) {
      if (maze[y][x] === 1) {
        ctx.fillStyle = "#FFF";
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }
  // Cabanos
  for (let [x, y] of cabanos) {
    ctx.fillStyle = "#AAA";
    ctx.fillRect(x * TILE_SIZE + 10, y * TILE_SIZE + 10, TILE_SIZE - 20, TILE_SIZE - 20);
  }
  // Goose
  ctx.fillStyle = "#0F0";
  ctx.beginPath();
  ctx.arc(
    goose[0] * TILE_SIZE + TILE_SIZE / 2,
    goose[1] * TILE_SIZE + TILE_SIZE / 2,
    TILE_SIZE / 2 - 4,
    0,
    2 * Math.PI
  );
  ctx.fill();
  // Wolf
  ctx.fillStyle = "#08F";
  ctx.beginPath();
  ctx.arc(
    wolf[0] * TILE_SIZE + TILE_SIZE / 2,
    wolf[1] * TILE_SIZE + TILE_SIZE / 2,
    TILE_SIZE / 2 - 4,
    0,
    2 * Math.PI
  );
  ctx.fill();
  // Missiles
  for (let m of missiles) {
    if (m.warning > 0) {
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(m[0] * TILE_SIZE + TILE_SIZE / 2, m[1] * TILE_SIZE + 8);
      ctx.lineTo(m[0] * TILE_SIZE + TILE_SIZE / 2, m[1] * TILE_SIZE + TILE_SIZE - 8);
      ctx.moveTo(m[0] * TILE_SIZE + 8, m[1] * TILE_SIZE + TILE_SIZE / 2);
      ctx.lineTo(m[0] * TILE_SIZE + TILE_SIZE - 8, m[1] * TILE_SIZE + TILE_SIZE / 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#F00";
      ctx.beginPath();
      ctx.arc(
        m[0] * TILE_SIZE + TILE_SIZE / 2,
        m[1] * TILE_SIZE + TILE_SIZE / 2,
        TILE_SIZE / 2 - 3,
        0,
        2 * Math.PI
      );
      ctx.fill();
    }
  }
  // Flash loss/win
  if (status === "lose" || status === "win") {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = status === "win" ? "#0F0" : "#F00";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1.0;
  }
}

export default GeeseCabanosWolfGame;
