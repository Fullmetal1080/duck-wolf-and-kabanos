import React from 'react';

export default function Game() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Goose, Kabanos and the Evil Wolf </h1>

const GRID_SIZE = 21;
const MAX_LEVELS = 40;

const generateMaze = () => {
  const maze = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(1));

  const carve = (x, y) => {
    maze[y][x] = 0;
    const directions = [
      [0, -2], [0, 2], [-2, 0], [2, 0]
    ].sort(() => Math.random() - 0.5);

    for (const [dx, dy] of directions) {
      const nx = x + dx, ny = y + dy;
      if (
        nx > 0 && nx < GRID_SIZE - 1 &&
        ny > 0 && ny < GRID_SIZE - 1 &&
        maze[ny][nx] === 1
      ) {
        maze[y + dy / 2][x + dx / 2] = 0;
        carve(nx, ny);
      }
    }
  };

  carve(1, 1);

  // Add extra junctions
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(Math.random() * (GRID_SIZE - 2)) + 1;
    const y = Math.floor(Math.random() * (GRID_SIZE - 2)) + 1;
    if (maze[y][x] === 1 && (x % 2 === 1 || y % 2 === 1)) {
      maze[y][x] = 0;
    }
  }

  return maze;
};

const getRandomOpenCell = (maze) => {
  const open = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (maze[y][x] === 0) open.push([x, y]);
    }
  }
  return open[Math.floor(Math.random() * open.length)];
};

const isSame = (a, b) => a[0] === b[0] && a[1] === b[1];

const getNeighbors = ([x, y], maze) => [
  [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]
].filter(([nx, ny]) => maze[ny]?.[nx] === 0);

const bfsPath = (start, goal, maze) => {
  const queue = [[start]];
  const visited = new Set([start.toString()]);
  while (queue.length) {
    const path = queue.shift();
    const current = path[path.length - 1];
    if (isSame(current, goal)) return path;
    for (const neighbor of getNeighbors(current, maze)) {
      const key = neighbor.toString();
      if (!visited.has(key)) {
        visited.add(key);
        queue.push([...path, neighbor]);
      }
    }
  }
  return null;
};

export default function Game() {
  const [maze, setMaze] = useState(generateMaze());
  const [goose, setGoose] = useState([1, 1]);
  const [wolf, setWolf] = useState([GRID_SIZE - 2, GRID_SIZE - 2]);
  const [kabanos, setKabanos] = useState([]);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [missile, setMissile] = useState(null);
  const [warning, setWarning] = useState(null);

  const resetLevel = () => {
    const newMaze = generateMaze();
    const newGoose = [1, 1];
    const newWolf = [GRID_SIZE - 2, GRID_SIZE - 2];
    const kb = [];
    while (kb.length < 4) {
      const pos = getRandomOpenCell(newMaze);
      if (!kb.some((p) => isSame(p, pos)) && !isSame(pos, newGoose) && !isSame(pos, newWolf)) {
        kb.push(pos);
      }
    }
    setMaze(newMaze);
    setGoose(newGoose);
    setWolf(newWolf);
    setKabanos(kb);
    setGameOver(false);
  };

  useEffect(() => {
    resetLevel();
  }, [level]);

  const move = (dx, dy) => {
    if (gameOver) return;
    const [x, y] = goose;
    const nx = x + dx;
    const ny = y + dy;
    if (maze[ny]?.[nx] === 0) setGoose([nx, ny]);
  };

  const moveWolf = () => {
    const path = bfsPath(wolf, goose, maze);
    if (path && path.length > 1) setWolf(path[1]);
  };

  useEffect(() => {
    const listener = (e) => {
      if (e.key === "ArrowUp") move(0, -1);
      if (e.key === "ArrowDown") move(0, 1);
      if (e.key === "ArrowLeft") move(-1, 0);
      if (e.key === "ArrowRight") move(1, 0);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [goose, gameOver]);

  useEffect(() => {
    if (!gameOver && (isSame(goose, wolf) || (missile && isSame(goose, missile)))) {
      setGameOver(true);
      setTimeout(resetLevel, 1000);
    }
    if (kabanos.some((k) => isSame(k, goose))) {
      setKabanos(prev => prev.filter(k => !isSame(k, goose)));
    }
  }, [goose, wolf, missile]);

  useEffect(() => {
    if (!kabanos.length && !gameOver) {
      if (level >= MAX_LEVELS) {
        alert("ניצחת את כל השלבים!");
        return;
      }
      setLevel(l => l + 1);
    }
  }, [kabanos]);

  useEffect(() => {
    const interval = setInterval(moveWolf, Math.max(500 - level * 10, 150));
    return () => clearInterval(interval);
  }, [wolf, goose, level]);

  useEffect(() => {
    const missileInterval = setInterval(() => {
      const warn = getRandomOpenCell(maze);
      setWarning(warn);
      setTimeout(() => {
        setWarning(null);
        setMissile(warn);
        setTimeout(() => setMissile(null), 500);
      }, 2000);
    }, Math.max(6000 - level * 100, 1000));
    return () => clearInterval(missileInterval);
  }, [level, maze]);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">אווזים, קבנוס והזאב המרושע</h1>
      <p className="mb-2">שלב: {level}</p>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}>
        {maze.flatMap((row, y) =>
          row.map((cell, x) => {
            const here = [x, y];
            const isGoose = isSame(here, goose);
            const isWolf = isSame(here, wolf);
            const isKabanos = kabanos.some((k) => isSame(k, here));
            const isMissile = missile && isSame(here, missile);
            const isWarning = warning && isSame(here, warning);

            return (
              <div
                key={`${x},${y}`}
                className={`w-6 h-6 border text-xs flex items-center justify-center
                ${cell === 1 ? "bg-gray-800" : "bg-white"}
                ${isGoose ? "bg-yellow-300" : ""}
                ${isWolf ? "bg-red-600 text-white" : ""}
                ${isKabanos ? "bg-green-500" : ""}
                ${isMissile ? "bg-black" : ""}
                ${isWarning ? "bg-yellow-400 animate-ping" : ""}`}
              >
                {isGoose ? "🪿" : isWolf ? "🐺" : isKabanos ? "🥓" : ""}
              </div>
            );
          })
        )}
      </div>
      {gameOver && <p className="text-red-600 mt-4 font-bold">המשחק נגמר! השלב מתחיל מחדש...</p>}
    </div>
  );
}
.</p>
    </div>
  );
}
