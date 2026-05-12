/**
 * Maze Intelligence Visualizer — Labyrinth
 * Maze: recursive backtracking + extra passages.
 * Modes: Player (manual traversal + BFS hints), BFS/DFS/Dijkstra visualization, Comparison.
 */

(function () {
  "use strict";

  const DIRS = [
    { name: "N", dr: -1, dc: 0, wall: "N", opp: "S" },
    { name: "E", dr: 0, dc: 1, wall: "E", opp: "W" },
    { name: "S", dr: 1, dc: 0, wall: "S", opp: "N" },
    { name: "W", dr: 0, dc: -1, wall: "W", opp: "E" },
  ];

  function randInt(n) {
    return Math.floor(Math.random() * n);
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function keyRC(r, c) {
    return r + "," + c;
  }

  function parseKey(k) {
    const [r, c] = k.split(",").map(Number);
    return { r, c };
  }

  function edgeKey(r1, c1, r2, c2) {
    if (r1 < r2 || (r1 === r2 && c1 < c2)) return r1 + "," + c1 + "~" + r2 + "," + c2;
    return r2 + "," + c2 + "~" + r1 + "," + c1;
  }

  function createGrid(rows, cols) {
    return Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => ({
        r,
        c,
        walls: { N: true, E: true, S: true, W: true },
      }))
    );
  }

  function inBounds(r, c, rows, cols) {
    return r >= 0 && r < rows && c >= 0 && c < cols;
  }

  function neighborsForCarve(cell, grid, rows, cols) {
    const out = [];
    for (const d of DIRS) {
      const nr = cell.r + d.dr;
      const nc = cell.c + d.dc;
      if (!inBounds(nr, nc, rows, cols)) continue;
      const n = grid[nr][nc];
      if (!n._carveVisited) out.push({ next: n, dir: d });
    }
    return out;
  }

  function removeWallBetween(a, b, dirFromAToB) {
    a.walls[dirFromAToB.wall] = false;
    b.walls[dirFromAToB.opp] = false;
  }

  function generateMazeRecursiveBacktracker(rows, cols) {
    const grid = createGrid(rows, cols);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) grid[r][c]._carveVisited = false;
    }
    const stack = [];
    const start = grid[0][0];
    start._carveVisited = true;
    stack.push(start);

    while (stack.length) {
      const current = stack[stack.length - 1];
      const opts = neighborsForCarve(current, grid, rows, cols).filter((x) => !x.next._carveVisited);
      if (opts.length) {
        const pick = opts[randInt(opts.length)];
        const { next, dir } = pick;
        const dmeta = DIRS.find((d) => d.name === dir.name);
        removeWallBetween(current, next, dmeta);
        next._carveVisited = true;
        stack.push(next);
      } else {
        stack.pop();
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) delete grid[r][c]._carveVisited;
    }
    return grid;
  }

  function addExtraPassages(grid, rows, cols, targetRemovals) {
    const candidates = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        for (const d of DIRS) {
          if (d.name === "S" || d.name === "E") {
            const nr = r + d.dr;
            const nc = c + d.dc;
            if (!inBounds(nr, nc, rows, cols)) continue;
            if (grid[r][c].walls[d.wall]) {
              candidates.push({ r, c, d });
            }
          }
        }
      }
    }
    shuffle(candidates);
    let removed = 0;
    for (const item of candidates) {
      if (removed >= targetRemovals) break;
      const { r, c, d } = item;
      const cell = grid[r][c];
      if (!cell.walls[d.wall]) continue;
      const nr = r + d.dr;
      const nc = c + d.dc;
      removeWallBetween(cell, grid[nr][nc], d);
      removed++;
    }
  }

  function buildEdgeWeights(grid, rows, cols) {
    const weights = new Map();
    function wBetween(r1, c1, r2, c2) {
      let h = (r1 * 73856093) ^ (c1 * 19349663) ^ (r2 * 83492791) ^ (c2 * 50331653);
      h = Math.imul(h ^ (h >>> 15), h | 1);
      h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
      const val = ((h ^ (h >>> 14)) >>> 0) % 9;
      return val + 1;
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        for (const d of DIRS) {
          if (d.name === "S" || d.name === "E") {
            const nr = r + d.dr;
            const nc = c + d.dc;
            if (!inBounds(nr, nc, rows, cols)) continue;
            if (!grid[r][c].walls[d.wall]) {
              const k = edgeKey(r, c, nr, nc);
              if (!weights.has(k)) weights.set(k, wBetween(r, c, nr, nc));
            }
          }
        }
      }
    }
    return weights;
  }

  function getPassageNeighbors(grid, rows, cols, r, c) {
    const list = [];
    const cell = grid[r][c];
    for (const d of DIRS) {
      if (cell.walls[d.wall]) continue;
      const nr = r + d.dr;
      const nc = c + d.dc;
      if (!inBounds(nr, nc, rows, cols)) continue;
      list.push({ r: nr, c: nc, d });
    }
    return list;
  }

  /** Fast BFS — returns shortest path cells from (sr,sc) to (er,ec), or null */
  function bfsShortestPath(grid, rows, cols, sr, sc, er, ec) {
    const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
    const parent = new Map();
    const queue = [{ r: sr, c: sc }];
    const sk = keyRC(sr, sc);
    const ek = keyRC(er, ec);
    visited[sr][sc] = true;

    while (queue.length) {
      const u = queue.shift();
      if (u.r === er && u.c === ec) {
        return reconstructPath(parent, sk, ek);
      }
      for (const nb of getPassageNeighbors(grid, rows, cols, u.r, u.c)) {
        if (visited[nb.r][nb.c]) continue;
        visited[nb.r][nb.c] = true;
        parent.set(keyRC(nb.r, nb.c), keyRC(u.r, u.c));
        queue.push({ r: nb.r, c: nb.c });
      }
    }
    return null;
  }

  class MinHeap {
    constructor() {
      this.a = [];
    }
    push(item) {
      const a = this.a;
      a.push(item);
      this._up(a.length - 1);
    }
    pop() {
      const a = this.a;
      if (!a.length) return null;
      const top = a[0];
      const last = a.pop();
      if (a.length) {
        a[0] = last;
        this._down(0);
      }
      return top;
    }
    get size() {
      return this.a.length;
    }
    _up(i) {
      const a = this.a;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (a[i][0] >= a[p][0]) break;
        [a[i], a[p]] = [a[p], a[i]];
        i = p;
      }
    }
    _down(i) {
      const a = this.a;
      const n = a.length;
      for (;;) {
        let m = i;
        const l = i * 2 + 1;
        const r = l + 1;
        if (l < n && a[l][0] < a[m][0]) m = l;
        if (r < n && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
  }

  function reconstructPath(parentMap, sk, ek) {
    const path = [];
    let k = ek;
    const guard = new Set();
    while (k && k !== sk && !guard.has(k)) {
      guard.add(k);
      path.push(parseKey(k));
      k = parentMap.get(k);
    }
    path.push(parseKey(sk));
    path.reverse();
    return path;
  }

  function cloneVisitedMask(visited) {
    return visited.map((row) => row.slice());
  }

  function makeVisited(rows, cols) {
    return Array.from({ length: rows }, () => Array(cols).fill(false));
  }

  function frontierPreview(list, maxCells) {
    const lim = maxCells ?? 36;
    const cells = list.slice(0, lim).map((x) => "(" + x.r + "," + x.c + ")");
    let s = cells.join(" ");
    if (list.length > lim) s += " … +" + (list.length - lim) + " more";
    return s || "∅";
  }

  function runBFS(grid, rows, cols, sr, sc, er, ec) {
    const visited = makeVisited(rows, cols);
    const parent = new Map();
    const steps = [];
    const queue = [{ r: sr, c: sc }];
    const sk = keyRC(sr, sc);
    const ek = keyRC(er, ec);

    steps.push({
      algo: "bfs",
      phase: "init",
      visited: cloneVisitedMask(visited),
      frontier: queue.map((x) => ({ ...x })),
      frontierText: frontierPreview(queue),
      current: null,
      visitedCount: 0,
      path: null,
      totalCost: null,
    });

    visited[sr][sc] = true;

    while (queue.length) {
      const u = queue.shift();
      steps.push({
        algo: "bfs",
        phase: "visit",
        visited: cloneVisitedMask(visited),
        frontier: queue.map((x) => ({ ...x })),
        frontierText: frontierPreview(queue),
        current: { ...u },
        visitedCount: visited.flat().filter(Boolean).length,
        path: null,
        totalCost: null,
      });

      if (u.r === er && u.c === ec) {
        const path = reconstructPath(parent, sk, ek);
        steps.push({
          algo: "bfs",
          phase: "done",
          visited: cloneVisitedMask(visited),
          frontier: [],
          frontierText: "∅",
          current: { ...u },
          visitedCount: visited.flat().filter(Boolean).length,
          path,
          totalCost: path.length - 1,
        });
        break;
      }

      const nbrs = shuffle(getPassageNeighbors(grid, rows, cols, u.r, u.c));
      for (const nb of nbrs) {
        if (visited[nb.r][nb.c]) continue;
        visited[nb.r][nb.c] = true;
        parent.set(keyRC(nb.r, nb.c), keyRC(u.r, u.c));
        queue.push({ r: nb.r, c: nb.c });
      }

      steps.push({
        algo: "bfs",
        phase: "enqueue",
        visited: cloneVisitedMask(visited),
        frontier: queue.map((x) => ({ ...x })),
        frontierText: frontierPreview(queue),
        current: { ...u },
        visitedCount: visited.flat().filter(Boolean).length,
        path: null,
        totalCost: null,
      });
    }

    const last = steps[steps.length - 1];
    if (!last || last.phase !== "done") {
      steps.push({
        algo: "bfs",
        phase: "fail",
        visited: cloneVisitedMask(visited),
        frontier: [],
        frontierText: "∅",
        current: null,
        visitedCount: visited.flat().filter(Boolean).length,
        path: null,
        totalCost: null,
      });
    }

    const visitedTotal = visited.flat().filter(Boolean).length;
    const doneStep = steps.find((s) => s.phase === "done");
    const pathLen = doneStep && doneStep.path ? doneStep.path.length : 0;
    return {
      steps,
      stats: {
        visitedNodes: visitedTotal,
        pathCells: pathLen,
        pathEdges: pathLen ? pathLen - 1 : 0,
        executionSteps: steps.length - 1,
        totalCost: pathLen ? pathLen - 1 : null,
      },
    };
  }

  function runDFS(grid, rows, cols, sr, sc, er, ec) {
    const visited = makeVisited(rows, cols);
    const parent = new Map();
    const steps = [];
    const stack = [{ r: sr, c: sc }];
    const sk = keyRC(sr, sc);
    const ek = keyRC(er, ec);

    steps.push({
      algo: "dfs",
      phase: "init",
      visited: cloneVisitedMask(visited),
      frontier: stack.map((x) => ({ ...x })),
      frontierText: "stack " + frontierPreview(stack),
      current: null,
      visitedCount: 0,
      path: null,
      totalCost: null,
    });

    while (stack.length) {
      const u = stack.pop();
      if (visited[u.r][u.c]) {
        steps.push({
          algo: "dfs",
          phase: "skip",
          visited: cloneVisitedMask(visited),
          frontier: stack.map((x) => ({ ...x })),
          frontierText: "stack " + frontierPreview(stack),
          current: { ...u },
          visitedCount: visited.flat().filter(Boolean).length,
          path: null,
          totalCost: null,
        });
        continue;
      }

      visited[u.r][u.c] = true;

      steps.push({
        algo: "dfs",
        phase: "visit",
        visited: cloneVisitedMask(visited),
        frontier: stack.map((x) => ({ ...x })),
        frontierText: "stack " + frontierPreview(stack),
        current: { ...u },
        visitedCount: visited.flat().filter(Boolean).length,
        path: null,
        totalCost: null,
      });

      if (u.r === er && u.c === ec) {
        const path = reconstructPath(parent, sk, ek);
        steps.push({
          algo: "dfs",
          phase: "done",
          visited: cloneVisitedMask(visited),
          frontier: [],
          frontierText: "stack ∅",
          current: { ...u },
          visitedCount: visited.flat().filter(Boolean).length,
          path,
          totalCost: path.length - 1,
        });
        break;
      }

      const nbrs = shuffle(getPassageNeighbors(grid, rows, cols, u.r, u.c));
      for (let i = nbrs.length - 1; i >= 0; i--) {
        const nb = nbrs[i];
        if (!visited[nb.r][nb.c]) {
          parent.set(keyRC(nb.r, nb.c), keyRC(u.r, u.c));
          stack.push({ r: nb.r, c: nb.c });
        }
      }

      steps.push({
        algo: "dfs",
        phase: "push",
        visited: cloneVisitedMask(visited),
        frontier: stack.map((x) => ({ ...x })),
        frontierText: "stack " + frontierPreview(stack),
        current: { ...u },
        visitedCount: visited.flat().filter(Boolean).length,
        path: null,
        totalCost: null,
      });
    }

    if (!steps.some((s) => s.phase === "done")) {
      steps.push({
        algo: "dfs",
        phase: "fail",
        visited: cloneVisitedMask(visited),
        frontier: [],
        frontierText: "stack ∅",
        current: null,
        visitedCount: visited.flat().filter(Boolean).length,
        path: null,
        totalCost: null,
      });
    }

    const visitedTotal = visited.flat().filter(Boolean).length;
    const doneStep = steps.find((s) => s.phase === "done");
    const pathLen = doneStep && doneStep.path ? doneStep.path.length : 0;
    return {
      steps,
      stats: {
        visitedNodes: visitedTotal,
        pathCells: pathLen,
        pathEdges: pathLen ? pathLen - 1 : 0,
        executionSteps: steps.length - 1,
        totalCost: pathLen ? pathLen - 1 : null,
      },
    };
  }

  function runDijkstra(grid, rows, cols, sr, sc, er, ec, edgeWeights) {
    const INF = 1e15;
    const dist = Array.from({ length: rows }, () => Array(cols).fill(INF));
    const settled = makeVisited(rows, cols);
    const parent = new Map();
    const steps = [];
    const heap = new MinHeap();
    const sk = keyRC(sr, sc);
    const ek = keyRC(er, ec);

    dist[sr][sc] = 0;
    heap.push([0, sr, sc]);

    steps.push({
      algo: "dijkstra",
      phase: "init",
      visited: cloneVisitedMask(settled),
      frontier: [{ r: sr, c: sc, d: 0 }],
      frontierText: "PQ: (0 @ " + sr + "," + sc + ")",
      current: null,
      visitedCount: 0,
      path: null,
      totalCost: null,
      distSnapshot: dist.map((row) => row.slice()),
    });

    while (heap.size) {
      const item = heap.pop();
      const [d0, r, c] = item;
      if (d0 !== dist[r][c]) continue;

      settled[r][c] = true;

      steps.push({
        algo: "dijkstra",
        phase: "visit",
        visited: cloneVisitedMask(settled),
        frontier: heap.a.map((x) => ({ r: x[1], c: x[2], d: x[0] })),
        frontierText:
          "PQ " +
          heap.size +
          ": " +
          heap.a
            .slice(0, 12)
            .map((x) => x[0] + "@(" + x[1] + "," + x[2] + ")")
            .join(" ") +
          (heap.size > 12 ? " …" : ""),
        current: { r, c },
        visitedCount: settled.flat().filter(Boolean).length,
        path: null,
        totalCost: d0,
        distSnapshot: dist.map((row) => row.slice()),
      });

      if (r === er && c === ec) {
        const path = reconstructPath(parent, sk, ek);
        steps.push({
          algo: "dijkstra",
          phase: "done",
          visited: cloneVisitedMask(settled),
          frontier: [],
          frontierText: "PQ ∅",
          current: { r, c },
          visitedCount: settled.flat().filter(Boolean).length,
          path,
          totalCost: d0,
          distSnapshot: dist.map((row) => row.slice()),
        });
        break;
      }

      for (const nb of getPassageNeighbors(grid, rows, cols, r, c)) {
        const w = edgeWeights.get(edgeKey(r, c, nb.r, nb.c)) ?? 1;
        const nd = d0 + w;
        if (nd < dist[nb.r][nb.c]) {
          dist[nb.r][nb.c] = nd;
          parent.set(keyRC(nb.r, nb.c), keyRC(r, c));
          heap.push([nd, nb.r, nb.c]);
        }
      }

      steps.push({
        algo: "dijkstra",
        phase: "relax",
        visited: cloneVisitedMask(settled),
        frontier: heap.a.map((x) => ({ r: x[1], c: x[2], d: x[0] })),
        frontierText:
          "PQ " +
          heap.size +
          ": " +
          heap.a
            .slice(0, 12)
            .map((x) => x[0] + "@(" + x[1] + "," + x[2] + ")")
            .join(" ") +
          (heap.size > 12 ? " …" : ""),
        current: { r, c },
        visitedCount: settled.flat().filter(Boolean).length,
        path: null,
        totalCost: d0,
        distSnapshot: dist.map((row) => row.slice()),
      });
    }

    if (!steps.some((s) => s.phase === "done")) {
      steps.push({
        algo: "dijkstra",
        phase: "fail",
        visited: cloneVisitedMask(settled),
        frontier: [],
        frontierText: "PQ ∅",
        current: null,
        visitedCount: settled.flat().filter(Boolean).length,
        path: null,
        totalCost: null,
        distSnapshot: dist.map((row) => row.slice()),
      });
    }

    const visitedTotal = settled.flat().filter(Boolean).length;
    const doneStep = steps.find((s) => s.phase === "done");
    let pathLen = 0;
    let edgeCost = null;
    if (doneStep && doneStep.path && doneStep.path.length) {
      pathLen = doneStep.path.length;
      edgeCost = doneStep.totalCost;
    }
    return {
      steps,
      stats: {
        visitedNodes: visitedTotal,
        pathCells: pathLen,
        pathEdges: pathLen ? pathLen - 1 : 0,
        executionSteps: steps.length - 1,
        totalCost: edgeCost,
      },
    };
  }

  /** ---------- DOM & state ---------- */
  const els = {
    landing: document.getElementById("landing-page"),
    game: document.getElementById("game-page"),
    btnStart: document.getElementById("btn-start-simulation"),
    btnBack: document.getElementById("btn-back-landing"),
    selectSize: document.getElementById("select-size"),
    selectMode: document.getElementById("select-mode"),
    solverControls: document.getElementById("solver-controls"),
    playerControls: document.getElementById("player-controls"),
    solverStatBlock: document.getElementById("solver-stat-block"),
    playerLiveStats: document.getElementById("player-live-stats"),
    rangeSpeed: document.getElementById("range-speed"),
    speedLabel: document.getElementById("speed-label"),
    btnGen: document.getElementById("btn-generate"),
    btnRun: document.getElementById("btn-run"),
    btnStep: document.getElementById("btn-step"),
    btnPause: document.getElementById("btn-pause"),
    btnResetView: document.getElementById("btn-reset-view"),
    btnHintPath: document.getElementById("btn-hint-path"),
    btnHintStep: document.getElementById("btn-hint-step"),
    btnDismissHints: document.getElementById("btn-dismiss-hints"),
    btnEnterMaze: document.getElementById("btn-enter-maze"),
    enterOverlay: document.getElementById("enter-overlay"),
    mazeStage: document.getElementById("maze-stage"),
    mazeZoom: document.getElementById("maze-zoom"),
    dustCanvas: document.getElementById("dust-canvas"),
    chkAmbient: document.getElementById("chk-ambient"),
    mazeGrid: document.getElementById("maze-grid"),
    frontierContent: document.getElementById("frontier-content"),
    statAlgo: document.getElementById("stat-algo"),
    statVisited: document.getElementById("stat-visited"),
    statPath: document.getElementById("stat-path"),
    statSteps: document.getElementById("stat-steps"),
    statTime: document.getElementById("stat-time"),
    statPlayerMoves: document.getElementById("stat-player-moves"),
    statPlayerElapsed: document.getElementById("stat-player-elapsed"),
    statCost: document.getElementById("stat-cost"),
    dijkStatsRow: document.getElementById("dijk-stats-row"),
    compareBox: document.getElementById("comparison-box"),
    compareBody: document.getElementById("compare-body"),
    winOverlay: document.getElementById("win-overlay"),
    winMoves: document.getElementById("win-moves"),
    winTime: document.getElementById("win-time"),
    winOptimal: document.getElementById("win-optimal"),
    winEfficiency: document.getElementById("win-efficiency"),
    winPlayAgain: document.getElementById("win-play-again"),
    winClose: document.getElementById("win-close"),
  };

  let state = {
    rows: 20,
    cols: 20,
    grid: null,
    edgeWeights: null,
    sr: 0,
    sc: 0,
    er: 0,
    ec: 0,
    animSteps: [],
    animIndex: 0,
    playing: false,
    pauseFlag: false,
    timerId: null,
    simTime: 0,
    currentAlgo: "bfs",
    comparisonResults: null,
    playerR: 0,
    playerC: 0,
    playerMoves: 0,
    playerStartedAt: null,
    elapsedTimerId: null,
    trails: [],
    enteredMaze: false,
    gameWon: false,
    optimalMoves: null,
    dustRaf: null,
    audioCtx: null,
    audioGain: null,
    audioNoise: null,
  };

  function gameMode() {
    return els.selectMode.value;
  }

  function isPlayerMode() {
    return gameMode() === "player";
  }

  let landingAmbienceRestart = null;
  let landingCleanup = function () {};

  function showLanding() {
    els.landing.classList.add("active");
    els.landing.removeAttribute("hidden");
    els.game.classList.remove("active");
    els.game.setAttribute("hidden", "");
    stopAnimation();
    stopElapsedTicker();
    teardownAmbient();
    if (state.dustRaf) {
      cancelAnimationFrame(state.dustRaf);
      state.dustRaf = null;
    }
    window.scrollTo(0, 0);
    if (typeof landingAmbienceRestart === "function") landingAmbienceRestart();
  }

  function showGame() {
    landingCleanup();
    els.landing.classList.remove("active");
    els.landing.setAttribute("hidden", "");
    els.game.classList.add("active");
    els.game.removeAttribute("hidden");
    if (!state.grid) regenerateMaze();
    syncModeUI();
    els.enterOverlay.classList.remove("hidden");
    els.mazeStage.classList.add("maze-stage--intro");
    els.mazeStage.classList.remove("maze-stage--entered");
    state.enteredMaze = false;
    state.gameWon = false;
    hideWinOverlay();
    resizeDustCanvas();
    startDustLoop();
  }

  function cellSizeFor(dim) {
    if (dim <= 10) return 28;
    if (dim <= 20) return 18;
    return 12;
  }

  function renderMazeStructure() {
    const { rows, cols, grid, sr, sc, er, ec } = state;
    const cellPx = cellSizeFor(rows);
    els.mazeGrid.style.gridTemplateColumns = "repeat(" + cols + ", " + cellPx + "px)";
    els.mazeGrid.innerHTML = "";

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        const div = document.createElement("div");
        div.className = "cell";
        div.dataset.r = String(r);
        div.dataset.c = String(c);
        div.style.width = cellPx + "px";
        div.style.height = cellPx + "px";
        if (cell.walls.N) div.classList.add("wall-n");
        if (cell.walls.E) div.classList.add("wall-e");
        if (cell.walls.S) div.classList.add("wall-s");
        if (cell.walls.W) div.classList.add("wall-w");
        if (r === sr && c === sc) div.classList.add("start");
        if (r === er && c === ec) div.classList.add("end");
        els.mazeGrid.appendChild(div);
      }
    }
    updatePlayerVisual();
    resizeDustCanvas();
  }

  function getCellEl(r, c) {
    return els.mazeGrid.querySelector('.cell[data-r="' + r + '"][data-c="' + c + '"]');
  }

  function clearSolverVisualization() {
    els.mazeGrid.querySelectorAll(".cell").forEach((el) => {
      el.classList.remove(
        "visited-bfs",
        "visited-dfs",
        "visited-dijkstra",
        "frontier",
        "current",
        "path-final",
        "path-final-bfs",
        "path-final-dfs",
        "path-final-dij"
      );
    });
  }

  function clearHints() {
    els.mazeGrid.querySelectorAll(".cell").forEach((el) => {
      el.classList.remove("hint-path", "hint-next");
    });
  }

  function clearPlayerTrail() {
    els.mazeGrid.querySelectorAll(".player-trail").forEach((el) => el.classList.remove("player-trail"));
  }

  function updatePlayerVisual() {
    els.mazeGrid.querySelectorAll(".cell.player").forEach((el) => el.classList.remove("player"));
    const el = getCellEl(state.playerR, state.playerC);
    if (el) el.classList.add("player");
  }

  function syncModeUI() {
    const mode = gameMode();
    const player = mode === "player";
    const comparison = mode === "comparison";

    els.solverControls.classList.toggle("hidden", player);
    els.playerControls.classList.toggle("hidden", !player);
    els.solverStatBlock.classList.toggle("hidden", player);
    els.playerLiveStats.classList.toggle("hidden", !player);

    els.btnRun.disabled = player;
    els.btnStep.disabled = player || comparison || state.animSteps.length === 0;
    els.btnPause.disabled = player || comparison || !state.playing;

    if (player) {
      els.statAlgo.textContent = "Player Mode";
      els.frontierContent.textContent = state.enteredMaze
        ? "Arrow keys traverse the graph — hints use BFS."
        : "Cross the threshold to begin.";
    }

    if (comparison) {
      els.statAlgo.textContent = "Comparison";
    }
  }

  function applyStep(step, algo) {
    clearSolverVisualization();
    const visClass =
      algo === "bfs" ? "visited-bfs" : algo === "dfs" ? "visited-dfs" : "visited-dijkstra";

    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        if (!step.visited[r][c]) continue;
        const el = getCellEl(r, c);
        if (el && !(r === state.sr && c === state.sc) && !(r === state.er && c === state.ec)) {
          el.classList.add(visClass);
        }
      }
    }

    if (step.frontier && step.frontier.length) {
      for (const f of step.frontier) {
        if (f.r === undefined) continue;
        const el = getCellEl(f.r, f.c);
        if (el && !(f.r === state.sr && f.c === state.sc) && !(f.r === state.er && f.c === state.ec)) {
          el.classList.add("frontier");
        }
      }
    }

    if (step.current) {
      const el = getCellEl(step.current.r, step.current.c);
      if (el) el.classList.add("current");
    }

    if (step.phase === "done" && step.path) {
      const pc =
        algo === "bfs" ? "path-final-bfs" : algo === "dfs" ? "path-final-dfs" : "path-final-dij";
      for (const p of step.path) {
        const el = getCellEl(p.r, p.c);
        if (el) el.classList.add(pc);
      }
    }

    els.frontierContent.textContent = step.frontierText || "—";
    updatePlayerVisual();
  }

  function updateStatsFromStep(step, algoLabel) {
    els.statAlgo.textContent = algoLabel;
    const vc =
      step.phase === "done"
        ? step.visitedCount
        : step.visited.flat().filter(Boolean).length;
    els.statVisited.textContent = String(vc);
    els.statSteps.textContent = String(state.animIndex);

    if (step.phase === "done" && step.path) {
      els.statPath.textContent = String(step.path.length);
      if (step.totalCost != null && algoLabel.indexOf("Dijkstra") !== -1) {
        els.dijkStatsRow.classList.remove("hidden");
        els.statCost.textContent = String(step.totalCost);
      } else {
        els.dijkStatsRow.classList.add("hidden");
      }
    } else {
      els.statPath.textContent = "—";
      els.dijkStatsRow.classList.add("hidden");
    }

    els.statTime.textContent = String(state.simTime);
  }

  function speedDelayMs() {
    const v = Number(els.rangeSpeed.value);
    const base = 220;
    return Math.max(8, Math.round(base / v));
  }

  function setSpeedLabel() {
    const v = Number(els.rangeSpeed.value);
    let t = "medium";
    if (v <= 3) t = "slow";
    else if (v >= 8) t = "fast";
    els.speedLabel.textContent = t;
  }

  function stopAnimation() {
    if (state.timerId) {
      clearTimeout(state.timerId);
      state.timerId = null;
    }
    state.playing = false;
    state.pauseFlag = false;
    els.btnPause.textContent = "Pause";
    syncModeUI();
  }

  function scheduleNext() {
    state.timerId = setTimeout(tick, speedDelayMs());
  }

  function tick() {
    if (!state.playing) return;
    if (state.pauseFlag) {
      scheduleNext();
      return;
    }
    if (state.animIndex >= state.animSteps.length - 1) {
      finishAnimation();
      return;
    }
    state.animIndex++;
    state.simTime++;
    const step = state.animSteps[state.animIndex];
    applyStep(step, state.currentAlgo);
    updateStatsFromStep(step, labelForAlgo(state.currentAlgo));
    scheduleNext();
  }

  function labelForAlgo(a) {
    if (a === "bfs") return "BFS Solver";
    if (a === "dfs") return "DFS Explorer";
    return "Dijkstra";
  }

  function finishAnimation() {
    stopAnimation();
    const last = state.animSteps[state.animSteps.length - 1];
    if (last) {
      applyStep(last, state.currentAlgo);
      updateStatsFromStep(last, labelForAlgo(state.currentAlgo));
    }
    els.btnRun.disabled = gameMode() === "player";
    els.btnStep.disabled =
      gameMode() === "player" || state.animSteps.length === 0;
  }

  function prepareRun() {
    if (gameMode() === "player") return;
    stopAnimation();
    clearSolverVisualization();
    clearHints();
    state.simTime = 0;
    state.animIndex = 0;
    const rows = state.rows;
    const cols = state.cols;
    const g = state.grid;
    const ew = state.edgeWeights;
    const mode = gameMode();

    if (mode === "comparison") {
      runComparison();
      return;
    }

    let algo = mode;
    state.currentAlgo = algo;
    let pack;
    if (algo === "bfs") pack = runBFS(g, rows, cols, state.sr, state.sc, state.er, state.ec);
    else if (algo === "dfs") pack = runDFS(g, rows, cols, state.sr, state.sc, state.er, state.ec);
    else pack = runDijkstra(g, rows, cols, state.sr, state.sc, state.er, state.ec, ew);

    state.animSteps = pack.steps;
    if (!state.animSteps.length) return;

    applyStep(state.animSteps[0], algo);
    updateStatsFromStep(state.animSteps[0], labelForAlgo(algo));
    els.compareBox.classList.add("hidden");

    els.btnStep.disabled = false;
    els.btnPause.disabled = false;
    els.btnRun.disabled = true;
    state.playing = true;
    state.pauseFlag = false;
    els.btnPause.textContent = "Pause";
    scheduleNext();
  }

  function runComparison() {
    stopAnimation();
    const rows = state.rows;
    const cols = state.cols;
    const g = state.grid;
    const ew = state.edgeWeights;

    const bfs = runBFS(g, rows, cols, state.sr, state.sc, state.er, state.ec);
    const dfs = runDFS(g, rows, cols, state.sr, state.sc, state.er, state.ec);
    const dij = runDijkstra(g, rows, cols, state.sr, state.sc, state.er, state.ec, ew);

    state.comparisonResults = { bfs, dfs, dij };

    els.compareBox.classList.remove("hidden");
    els.compareBody.innerHTML = "";

    function row(name, cls, pathCells, visited, execSteps) {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="' +
        cls +
        '">' +
        name +
        "</td>" +
        "<td>" +
        pathCells +
        "</td>" +
        "<td>" +
        visited +
        "</td>" +
        "<td>" +
        execSteps +
        "</td>";
      els.compareBody.appendChild(tr);
    }

    row("BFS", "algo-bfs", bfs.stats.pathCells || "—", bfs.stats.visitedNodes, bfs.stats.executionSteps);
    row("DFS", "algo-dfs", dfs.stats.pathCells || "—", dfs.stats.visitedNodes, dfs.stats.executionSteps);
    row(
      "Dijkstra",
      "algo-dij",
      (dij.stats.pathCells || "—") +
        (dij.stats.totalCost != null
          ? ' <span class="muted">(Σ ' + dij.stats.totalCost + ")</span>"
          : ""),
      dij.stats.visitedNodes,
      dij.stats.executionSteps
    );

    els.statAlgo.textContent = "Comparison";
    els.statVisited.textContent = "—";
    els.statPath.textContent = "—";
    els.statSteps.textContent =
      bfs.stats.executionSteps + " / " + dfs.stats.executionSteps + " / " + dij.stats.executionSteps;
    els.statTime.textContent = "0";
    els.dijkStatsRow.classList.remove("hidden");
    els.statCost.textContent =
      "BFS hops " +
      (bfs.stats.pathEdges ?? "—") +
      " · Dijkstra cost " +
      (dij.stats.totalCost ?? "—");

    clearSolverVisualization();
    els.frontierContent.textContent =
      "Comparison ready — switch to BFS / DFS / Dijkstra to animate one algorithm.";

    els.btnRun.disabled = gameMode() === "player";
    els.btnStep.disabled = true;
    els.btnPause.disabled = true;
  }

  function stepOnce() {
    if (!state.animSteps.length) return;
    if (state.playing && !state.pauseFlag) return;
    if (state.animIndex >= state.animSteps.length - 1) return;
    state.animIndex++;
    state.simTime++;
    const step = state.animSteps[state.animIndex];
    applyStep(step, state.currentAlgo);
    updateStatsFromStep(step, labelForAlgo(state.currentAlgo));
  }

  function computeOptimalMoves() {
    const p = bfsShortestPath(
      state.grid,
      state.rows,
      state.cols,
      state.sr,
      state.sc,
      state.er,
      state.ec
    );
    if (!p || p.length < 2) return 0;
    return p.length - 1;
  }

  function resetPlayerState() {
    state.playerR = state.sr;
    state.playerC = state.sc;
    state.playerMoves = 0;
    state.playerStartedAt = null;
    state.trails = [];
    clearPlayerTrail();
    clearHints();
    els.statPlayerMoves.textContent = "0";
    els.statPlayerElapsed.textContent = "0.0s";
  }

  function beginPlayerSession() {
    state.enteredMaze = true;
    state.gameWon = false;
    resetPlayerState();
    state.playerStartedAt = performance.now();
    startElapsedTicker();
    els.frontierContent.textContent = "Walk the ruins — ↑↓←→ · graph edges only.";
    syncModeUI();
    updatePlayerVisual();
  }

  function dismissEnterOverlay() {
    els.enterOverlay.classList.add("hidden");
    els.mazeStage.classList.remove("maze-stage--intro");
    els.mazeStage.classList.add("maze-stage--entered");
    if (isPlayerMode()) {
      beginPlayerSession();
    } else {
      state.enteredMaze = false;
      els.frontierContent.textContent =
        gameMode() === "comparison"
          ? "Press Run visualization to compare BFS, DFS, and Dijkstra."
          : "Press Run visualization to watch the algorithm.";
      syncModeUI();
    }
  }

  function startElapsedTicker() {
    stopElapsedTicker();
    state.elapsedTimerId = window.setInterval(updatePlayerElapsed, 100);
  }

  function stopElapsedTicker() {
    if (state.elapsedTimerId) {
      clearInterval(state.elapsedTimerId);
      state.elapsedTimerId = null;
    }
  }

  function updatePlayerElapsed() {
    if (!isPlayerMode() || !state.enteredMaze || state.gameWon || !state.playerStartedAt) return;
    const sec = (performance.now() - state.playerStartedAt) / 1000;
    els.statPlayerElapsed.textContent = sec.toFixed(1) + "s";
  }

  function tryPlayerMove(dr, dc) {
    if (!isPlayerMode() || !state.enteredMaze || state.gameWon) return;
    const nr = state.playerR + dr;
    const nc = state.playerC + dc;
    if (!inBounds(nr, nc, state.rows, state.cols)) return;
    const cell = state.grid[state.playerR][state.playerC];
    let ok = false;
    if (dr === -1 && !cell.walls.N && nr === state.playerR - 1) ok = true;
    if (dr === 1 && !cell.walls.S && nr === state.playerR + 1) ok = true;
    if (dc === -1 && !cell.walls.W && nc === state.playerC - 1) ok = true;
    if (dc === 1 && !cell.walls.E && nc === state.playerC + 1) ok = true;
    if (!ok) return;

    const prevEl = getCellEl(state.playerR, state.playerC);
    if (
      prevEl &&
      !(state.playerR === state.sr && state.playerC === state.sc) &&
      !(state.playerR === state.er && state.playerC === state.ec)
    ) {
      prevEl.classList.add("player-trail");
    }

    state.playerR = nr;
    state.playerC = nc;
    state.playerMoves++;
    els.statPlayerMoves.textContent = String(state.playerMoves);
    updatePlayerVisual();

    if (state.playerR === state.er && state.playerC === state.ec) {
      playerWin();
    }
  }

  function playerWin() {
    state.gameWon = true;
    stopElapsedTicker();
    const optimal = computeOptimalMoves();
    state.optimalMoves = optimal;
    const elapsedMs = state.playerStartedAt ? performance.now() - state.playerStartedAt : 0;
    const playerMoves = state.playerMoves;
    const effPct =
      playerMoves > 0 && optimal >= 0
        ? Math.min(100, Math.floor((optimal / playerMoves) * 100))
        : 100;

    els.winMoves.textContent = String(playerMoves);
    els.winTime.textContent = (elapsedMs / 1000).toFixed(2) + " s";
    els.winOptimal.textContent = String(optimal);
    els.winEfficiency.textContent = effPct + "%";

    els.winOverlay.classList.remove("hidden");
    els.frontierContent.textContent = "You escaped — BFS optimal: " + optimal + " moves.";
  }

  function hideWinOverlay() {
    els.winOverlay.classList.add("hidden");
  }

  function showHintPath() {
    if (!isPlayerMode() || !state.enteredMaze || state.gameWon) return;
    clearHints();
    const path = bfsShortestPath(
      state.grid,
      state.rows,
      state.cols,
      state.playerR,
      state.playerC,
      state.er,
      state.ec
    );
    if (!path) return;
    for (const p of path) {
      const el = getCellEl(p.r, p.c);
      if (
        el &&
        !(p.r === state.playerR && p.c === state.playerC) &&
        !(p.r === state.er && p.c === state.ec)
      ) {
        el.classList.add("hint-path");
      }
    }
    els.frontierContent.textContent = "Hint: BFS shortest path overlay (cyan).";
  }

  function showHintStep() {
    if (!isPlayerMode() || !state.enteredMaze || state.gameWon) return;
    clearHints();
    const path = bfsShortestPath(
      state.grid,
      state.rows,
      state.cols,
      state.playerR,
      state.playerC,
      state.er,
      state.ec
    );
    if (!path || path.length < 2) return;
    const next = path[1];
    const el = getCellEl(next.r, next.c);
    if (el) el.classList.add("hint-next");
    els.frontierContent.textContent = "Next BFS step toward exit highlighted.";
  }

  function regenerateMaze() {
    stopAnimation();
    hideWinOverlay();
    els.btnPause.textContent = "Pause";
    const n = Number(els.selectSize.value);
    state.rows = n;
    state.cols = n;
    state.grid = generateMazeRecursiveBacktracker(n, n);
    const extra = Math.max(4, Math.floor(n * n * 0.025));
    addExtraPassages(state.grid, n, n, extra);
    state.edgeWeights = buildEdgeWeights(state.grid, n, n);
    state.sr = 0;
    state.sc = 0;
    state.er = n - 1;
    state.ec = n - 1;
    state.animSteps = [];
    state.animIndex = 0;
    state.simTime = 0;
    state.gameWon = false;
    stopElapsedTicker();
    resetPlayerState();

    renderMazeStructure();
    clearSolverVisualization();

    els.statAlgo.textContent = "—";
    els.statVisited.textContent = "0";
    els.statPath.textContent = "—";
    els.statSteps.textContent = "0";
    els.statTime.textContent = "0";
    els.statCost.textContent = "—";
    els.dijkStatsRow.classList.add("hidden");
    els.frontierContent.textContent = "—";
    els.compareBox.classList.add("hidden");

    if (els.game.classList.contains("active")) {
      els.enterOverlay.classList.remove("hidden");
      els.mazeStage.classList.add("maze-stage--intro");
      els.mazeStage.classList.remove("maze-stage--entered");
      state.enteredMaze = false;
    }

    syncModeUI();
    els.btnRun.disabled = gameMode() === "player";
    els.btnStep.disabled = true;
    els.btnPause.disabled = true;
  }

  /** Dust particles */
  const dustParticles = [];

  function resizeDustCanvas() {
    const s = els.mazeStage;
    if (!s || !els.dustCanvas) return;
    const r = s.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    els.dustCanvas.width = Math.floor(r.width * dpr);
    els.dustCanvas.height = Math.floor(r.height * dpr);
    els.dustCanvas.style.width = r.width + "px";
    els.dustCanvas.style.height = r.height + "px";
    const ctx = els.dustCanvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (dustParticles.length === 0 && r.width > 0) {
      for (let i = 0; i < 48; i++) {
        dustParticles.push({
          x: Math.random() * r.width,
          y: Math.random() * r.height,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.25) * 0.25,
          r: 0.6 + Math.random() * 1.8,
          a: 0.08 + Math.random() * 0.12,
        });
      }
    }
  }

  function startDustLoop() {
    if (state.dustRaf) {
      cancelAnimationFrame(state.dustRaf);
      state.dustRaf = null;
    }
    const ctx = els.dustCanvas.getContext("2d");
    if (!ctx) return;

    function frame() {
      if (!els.game.classList.contains("active")) return;
      const r = els.mazeStage.getBoundingClientRect();
      ctx.clearRect(0, 0, r.width, r.height);
      ctx.fillStyle = "rgba(212, 196, 168, 0.35)";
      for (const p of dustParticles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = r.width;
        if (p.x > r.width) p.x = 0;
        if (p.y < 0) p.y = r.height;
        if (p.y > r.height) p.y = 0;
        ctx.globalAlpha = p.a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      state.dustRaf = requestAnimationFrame(frame);
    }
    frame();
  }

  /** Optional ambient wind (Web Audio noise) */
  function setupAmbient() {
    if (state.audioCtx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    state.audioCtx = new AC();
    const bufferSize = 2 * state.audioCtx.sampleRate;
    const buffer = state.audioCtx.createBuffer(1, bufferSize, state.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = state.audioCtx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const filter = state.audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 600;
    state.audioGain = state.audioCtx.createGain();
    state.audioGain.gain.value = 0;
    noise.connect(filter);
    filter.connect(state.audioGain);
    state.audioGain.connect(state.audioCtx.destination);
    noise.start();
    state.audioNoise = noise;
  }

  function setAmbient(on) {
    if (!on) {
      if (state.audioGain) state.audioGain.gain.setTargetAtTime(0, state.audioCtx.currentTime, 0.05);
      return;
    }
    setupAmbient();
    if (!state.audioCtx) return;
    if (state.audioCtx.state === "suspended") state.audioCtx.resume();
    state.audioGain.gain.setTargetAtTime(0.04, state.audioCtx.currentTime, 0.3);
  }

  function teardownAmbient() {
    if (state.audioGain) state.audioGain.gain.value = 0;
  }

  /** ---------- Interactive landing (story + mini demos) ---------- */
  function initLandingExperience() {
    const lp = document.getElementById("landing-page");
    if (!lp || !lp.classList.contains("landing-experience")) return;

    const LD_ROWS = 5;
    const LD_COLS = 5;
    const ldGrid = generateMazeRecursiveBacktracker(LD_ROWS, LD_COLS);
    addExtraPassages(ldGrid, LD_ROWS, LD_COLS, 3);
    const ldWeights = buildEdgeWeights(ldGrid, LD_ROWS, LD_COLS);
    const ldSr = 0;
    const ldSc = 0;
    const ldEr = LD_ROWS - 1;
    const ldEc = LD_COLS - 1;

    let demoTimers = [];
    let compareTimers = [];
    let landingMapRaf = null;

    function cancelDemoTimers() {
      demoTimers.forEach(clearTimeout);
      demoTimers = [];
    }

    function cancelCompareTimers() {
      compareTimers.forEach(clearTimeout);
      compareTimers = [];
    }

    function cellPxForLanding(rows) {
      return rows <= 5 ? 26 : 21;
    }

    function mountLandingGrid(container, grid, rows, cols) {
      if (!container) return [];
      const px = cellPxForLanding(rows);
      container.style.gridTemplateColumns = "repeat(" + cols + ", " + px + "px)";
      container.innerHTML = "";
      const matrix = [];
      for (let r = 0; r < rows; r++) {
        matrix[r] = [];
        for (let c = 0; c < cols; c++) {
          const cell = grid[r][c];
          const d = document.createElement("div");
          d.className = "landing-cell";
          d.dataset.r = String(r);
          d.dataset.c = String(c);
          d.style.width = px + "px";
          d.style.height = px + "px";
          if (cell.walls.N) d.classList.add("w-n");
          if (cell.walls.E) d.classList.add("w-e");
          if (cell.walls.S) d.classList.add("w-s");
          if (cell.walls.W) d.classList.add("w-w");
          container.appendChild(d);
          matrix[r][c] = d;
        }
      }
      return matrix;
    }

    function paintLandingBase(matrix, grid, rows, cols, sr, sc, er, ec) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const el = matrix[r][c];
          el.classList.remove("start", "end", "v-bfs", "v-dfs", "v-dij", "frontier", "current", "path", "backtrack");
          el.textContent = "";
          if (r === sr && c === sc) el.classList.add("start");
          else if (r === er && c === ec) el.classList.add("end");
        }
      }
    }

    function captionForLandingStep(s, algo) {
      if (s.phase === "init") return algo === "dijkstra" ? "PQ seeded from start" : "Frontier initialized";
      if (s.phase === "visit") return "Visit (" + s.current.r + "," + s.current.c + ")";
      if (s.phase === "enqueue") return "Enqueue neighbors (layers)";
      if (s.phase === "push") return "Push deeper on stack";
      if (s.phase === "skip") return "Backtrack — pop stack";
      if (s.phase === "relax") return "Relax weighted edges";
      if (s.phase === "done") return "Goal reached — path glow";
      return s.phase;
    }

    function paintLandingStep(matrix, step, algoName, rows, cols, sr, sc, er, ec) {
      paintLandingBase(matrix, ldGrid, rows, cols, sr, sc, er, ec);
      const vc = algoName === "bfs" ? "v-bfs" : algoName === "dfs" ? "v-dfs" : "v-dij";
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!step.visited[r][c]) continue;
          const el = matrix[r][c];
          if ((r === sr && c === sc) || (r === er && c === ec)) continue;
          el.classList.add(vc);
        }
      }
      if (step.frontier && step.frontier.length) {
        for (let i = 0; i < step.frontier.length; i++) {
          const f = step.frontier[i];
          if (f.r === undefined) continue;
          const el = matrix[f.r][f.c];
          if (el && !(f.r === sr && f.c === sc) && !(f.r === er && f.c === ec)) el.classList.add("frontier");
        }
      }
      if (step.current) {
        const cur = matrix[step.current.r][step.current.c];
        if (cur) cur.classList.add("current");
      }
      if (algoName === "dfs" && step.phase === "skip" && step.current) {
        const bt = matrix[step.current.r][step.current.c];
        if (bt) bt.classList.add("backtrack");
      }
      if (step.phase === "done" && step.path) {
        for (let p = 0; p < step.path.length; p++) {
          const pt = step.path[p];
          const el = matrix[pt.r][pt.c];
          if (el) el.classList.add("path");
        }
      }
      if (algoName === "dijkstra" && step.distSnapshot && step.current) {
        const d = step.distSnapshot[step.current.r][step.current.c];
        if (d < 1e14) matrix[step.current.r][step.current.c].textContent = String(Math.round(d));
      }
    }

    const elsBfs = mountLandingGrid(document.getElementById("landing-demo-bfs"), ldGrid, LD_ROWS, LD_COLS);
    const elsDfs = mountLandingGrid(document.getElementById("landing-demo-dfs"), ldGrid, LD_ROWS, LD_COLS);
    const elsDij = mountLandingGrid(document.getElementById("landing-demo-dij"), ldGrid, LD_ROWS, LD_COLS);
    paintLandingBase(elsBfs, ldGrid, LD_ROWS, LD_COLS, ldSr, ldSc, ldEr, ldEc);
    paintLandingBase(elsDfs, ldGrid, LD_ROWS, LD_COLS, ldSr, ldSc, ldEr, ldEc);
    paintLandingBase(elsDij, ldGrid, LD_ROWS, LD_COLS, ldSr, ldSc, ldEr, ldEc);

    const cmpBfsEls = mountLandingGrid(document.getElementById("landing-compare-bfs"), ldGrid, LD_ROWS, LD_COLS);
    const cmpDfsEls = mountLandingGrid(document.getElementById("landing-compare-dfs"), ldGrid, LD_ROWS, LD_COLS);
    paintLandingBase(cmpBfsEls, ldGrid, LD_ROWS, LD_COLS, ldSr, ldSc, ldEr, ldEc);
    paintLandingBase(cmpDfsEls, ldGrid, LD_ROWS, LD_COLS, ldSr, ldSc, ldEr, ldEc);

    const bfsSteps = runBFS(ldGrid, LD_ROWS, LD_COLS, ldSr, ldSc, ldEr, ldEc).steps;
    const dfsSteps = runDFS(ldGrid, LD_ROWS, LD_COLS, ldSr, ldSc, ldEr, ldEc).steps;
    const dijSteps = runDijkstra(ldGrid, LD_ROWS, LD_COLS, ldSr, ldSc, ldEr, ldEc, ldWeights).steps;

    function demoDelayMs() {
      const el = document.getElementById("landing-compare-speed");
      const v = el ? Number(el.value) : 5;
      return Math.max(85, 480 - v * 42);
    }

    function runCardDemo(algo) {
      cancelDemoTimers();
      let steps;
      let matrix;
      let name;
      let capEl;
      if (algo === "bfs") {
        steps = bfsSteps;
        matrix = elsBfs;
        name = "bfs";
        capEl = document.getElementById("landing-demo-bfs-caption");
      } else if (algo === "dfs") {
        steps = dfsSteps;
        matrix = elsDfs;
        name = "dfs";
        capEl = document.getElementById("landing-demo-dfs-caption");
      } else {
        steps = dijSteps;
        matrix = elsDij;
        name = "dijkstra";
        capEl = document.getElementById("landing-demo-dij-caption");
      }
      let i = 0;
      function tick() {
        if (i >= steps.length) return;
        const s = steps[i];
        paintLandingStep(matrix, s, name, LD_ROWS, LD_COLS, ldSr, ldSc, ldEr, ldEc);
        if (capEl) capEl.textContent = captionForLandingStep(s, name);
        i++;
        demoTimers.push(window.setTimeout(tick, demoDelayMs()));
      }
      tick();
    }

    document.querySelectorAll("[data-card]").forEach(function (card) {
      card.addEventListener("click", function () {
        runCardDemo(card.getAttribute("data-card"));
      });
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          card.click();
        }
      });
    });

    document.querySelectorAll("[data-run-demo]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        runCardDemo(btn.getAttribute("data-run-demo"));
      });
    });

    function compareDelayMs() {
      return demoDelayMs();
    }

    let cmpIB = 0;
    let cmpID = 0;

    function runCompareTwin() {
      cancelCompareTimers();
      cmpIB = 0;
      cmpID = 0;
      paintLandingBase(cmpBfsEls, ldGrid, LD_ROWS, LD_COLS, ldSr, ldSc, ldEr, ldEc);
      paintLandingBase(cmpDfsEls, ldGrid, LD_ROWS, LD_COLS, ldSr, ldSc, ldEr, ldEc);
      function tick() {
        const delay = compareDelayMs();
        if (cmpIB < bfsSteps.length) {
          paintLandingStep(cmpBfsEls, bfsSteps[cmpIB], "bfs", LD_ROWS, LD_COLS, ldSr, ldSc, ldEr, ldEc);
          cmpIB++;
        }
        if (cmpID < dfsSteps.length) {
          paintLandingStep(cmpDfsEls, dfsSteps[cmpID], "dfs", LD_ROWS, LD_COLS, ldSr, ldSc, ldEr, ldEc);
          cmpID++;
        }
        if (cmpIB < bfsSteps.length || cmpID < dfsSteps.length) {
          compareTimers.push(window.setTimeout(tick, delay));
        }
      }
      tick();
    }

    const speedEl = document.getElementById("landing-compare-speed");
    const speedValEl = document.getElementById("landing-compare-speed-val");
    if (speedEl) {
      speedEl.addEventListener("input", function () {
        const v = Number(speedEl.value);
        if (speedValEl) speedValEl.textContent = v <= 4 ? "slow" : v <= 7 ? "medium" : "fast";
        runCompareTwin();
      });
    }

    const cmpSection = document.getElementById("story-compare");
    if (cmpSection) {
      const ioCmp = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) runCompareTwin();
          });
        },
        { threshold: 0.18 }
      );
      ioCmp.observe(cmpSection);
    }

    const PG = 6;
    let pgGrid = generateMazeRecursiveBacktracker(PG, PG);
    addExtraPassages(pgGrid, PG, PG, 4);
    let pgWeights = buildEdgeWeights(pgGrid, PG, PG);
    let pgSr = 0;
    let pgSc = 0;
    let pgEr = PG - 1;
    let pgEc = PG - 1;
    let pgPick = 0;
    const pgContainer = document.getElementById("landing-playground-grid");
    const pgStatus = document.getElementById("landing-pg-status");
    const pgHint = document.getElementById("landing-pg-hint");
    let pgMatrix = [];

    function regenPlayground() {
      cancelDemoTimers();
      pgGrid = generateMazeRecursiveBacktracker(PG, PG);
      addExtraPassages(pgGrid, PG, PG, 4);
      pgWeights = buildEdgeWeights(pgGrid, PG, PG);
      pgSr = 0;
      pgSc = 0;
      pgEr = PG - 1;
      pgEc = PG - 1;
      pgPick = 0;
      pgMatrix = mountLandingGrid(pgContainer, pgGrid, PG, PG);
      paintLandingBase(pgMatrix, pgGrid, PG, PG, pgSr, pgSc, pgEr, pgEc);
      if (pgStatus) pgStatus.textContent = "";
      if (pgHint) pgHint.textContent = "First click: start · Second: exit";
    }

    if (pgContainer) {
      pgContainer.addEventListener("click", function (e) {
        const cell = e.target.closest(".landing-cell");
        if (!cell || !pgContainer.contains(cell)) return;
        const r = Number(cell.dataset.r);
        const c = Number(cell.dataset.c);
        if (pgPick === 0 || pgPick === 2) {
          pgSr = r;
          pgSc = c;
          pgPick = 1;
        } else {
          pgEr = r;
          pgEc = c;
          pgPick = 2;
        }
        paintLandingBase(pgMatrix, pgGrid, PG, PG, pgSr, pgSc, pgEr, pgEc);
        if (pgStatus) pgStatus.textContent = "Start (" + pgSr + "," + pgSc + ") · Exit (" + pgEr + "," + pgEc + ")";
      });
    }

    const pgReset = document.getElementById("landing-pg-reset");
    if (pgReset) pgReset.addEventListener("click", regenPlayground);
    regenPlayground();

    function runPlayground(algo) {
      cancelDemoTimers();
      const pack =
        algo === "bfs"
          ? runBFS(pgGrid, PG, PG, pgSr, pgSc, pgEr, pgEc)
          : algo === "dfs"
            ? runDFS(pgGrid, PG, PG, pgSr, pgSc, pgEr, pgEc)
            : runDijkstra(pgGrid, PG, PG, pgSr, pgSc, pgEr, pgEc, pgWeights);
      const steps = pack.steps;
      const name = algo === "bfs" ? "bfs" : algo === "dfs" ? "dfs" : "dijkstra";
      let i = 0;
      function tick() {
        if (i >= steps.length) {
          if (pgStatus) pgStatus.textContent = algo.toUpperCase() + " finished.";
          return;
        }
        paintLandingStep(pgMatrix, steps[i], name, PG, PG, pgSr, pgSc, pgEr, pgEc);
        if (pgStatus) pgStatus.textContent = steps[i].phase + " · step " + (i + 1) + "/" + steps.length;
        i++;
        demoTimers.push(window.setTimeout(tick, 52));
      }
      tick();
    }

    const pgBfs = document.getElementById("landing-pg-bfs");
    const pgDfs = document.getElementById("landing-pg-dfs");
    const pgDij = document.getElementById("landing-pg-dij");
    if (pgBfs) pgBfs.addEventListener("click", function () { runPlayground("bfs"); });
    if (pgDfs) pgDfs.addEventListener("click", function () { runPlayground("dfs"); });
    if (pgDij) pgDij.addEventListener("click", function () { runPlayground("dijkstra"); });

    document.querySelectorAll(".story-reveal").forEach(function (el) {
      if (el.classList.contains("landing-hero")) return;
      const io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) el.classList.add("story-reveal--visible");
          });
        },
        { threshold: 0.1, rootMargin: "0px 0px -8% 0px" }
      );
      io.observe(el);
    });

    const para = document.querySelector(".landing-parallax-layer");
    window.addEventListener(
      "scroll",
      function () {
        if (!lp.classList.contains("active")) return;
        const y = window.scrollY;
        if (para) para.style.transform = "translateY(" + y * 0.07 + "px)";
      },
      { passive: true }
    );

    const mapCv = document.getElementById("landing-map-canvas");
    let mapT = 0;

    function drawLandingMap() {
      if (!mapCv || !lp.classList.contains("active")) {
        landingMapRaf = null;
        return;
      }
      mapT += 0.014;
      const rect = mapCv.getBoundingClientRect();
      const wCss = Math.max(rect.width, 320);
      const hCss = Math.max(rect.height, 400);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      mapCv.width = Math.floor(wCss * dpr);
      mapCv.height = Math.floor(hCss * dpr);
      const ctx = mapCv.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, wCss, hCss);
      ctx.strokeStyle = "rgba(168, 152, 126, 0.07)";
      ctx.lineWidth = 1;
      const off = Math.sin(mapT) * 10;
      for (let gx = -48; gx < wCss + 60; gx += 42) {
        ctx.beginPath();
        for (let y = 0; y < hCss; y += 14) {
          ctx.moveTo(gx + off * 0.4 + (y % 28) * 0.15, y);
          ctx.lineTo(gx + 24 + off * 0.35, y + 14);
        }
        ctx.stroke();
      }
      landingMapRaf = requestAnimationFrame(drawLandingMap);
    }

    function startLandingMap() {
      if (landingMapRaf) cancelAnimationFrame(landingMapRaf);
      drawLandingMap();
    }

    landingAmbienceRestart = startLandingMap;
    landingCleanup = function () {
      cancelDemoTimers();
      cancelCompareTimers();
      if (landingMapRaf) {
        cancelAnimationFrame(landingMapRaf);
        landingMapRaf = null;
      }
    };

    window.addEventListener("resize", function () {
      if (lp.classList.contains("active")) startLandingMap();
    });

    const tooltip = document.getElementById("kw-tooltip");
    const kwTitles = {
      bfs: "FIFO queue",
      dfs: "LIFO stack",
      dijkstra: "Priority queue",
    };

    function moveKwTooltip(ev) {
      if (!tooltip || tooltip.hidden) return;
      const pad = 16;
      let x = ev.clientX + pad;
      let y = ev.clientY + pad;
      const tw = tooltip.offsetWidth;
      const th = tooltip.offsetHeight;
      if (x + tw > window.innerWidth - 8) x = ev.clientX - tw - pad;
      if (y + th > window.innerHeight - 8) y = ev.clientY - th - pad;
      tooltip.style.left = x + "px";
      tooltip.style.top = y + "px";
    }

    document.querySelectorAll(".kw-term[data-kw]").forEach(function (el) {
      el.addEventListener("mouseenter", function (ev) {
        const k = el.getAttribute("data-kw");
        if (!tooltip) return;
        tooltip.hidden = false;
        tooltip.setAttribute("data-show", k);
        const tit = tooltip.querySelector(".kw-tooltip__title");
        if (tit) tit.textContent = kwTitles[k] || k;
        moveKwTooltip(ev);
      });
      el.addEventListener("mousemove", moveKwTooltip);
      el.addEventListener("mouseleave", function () {
        if (tooltip) tooltip.hidden = true;
      });
    });

    startLandingMap();
  }

  /** Keyboard */
  function onKeyDown(e) {
    if (!els.game.classList.contains("active")) return;
    if (!isPlayerMode() || !state.enteredMaze || state.gameWon) return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;

    let dr = 0;
    let dc = 0;
    if (e.key === "ArrowUp") dr = -1;
    else if (e.key === "ArrowDown") dr = 1;
    else if (e.key === "ArrowLeft") dc = -1;
    else if (e.key === "ArrowRight") dc = 1;
    else return;

    e.preventDefault();
    tryPlayerMove(dr, dc);
  }

  /** Events */
  els.btnStart.addEventListener("click", function () {
    const trans = document.getElementById("landing-enter-transition");
    if (!trans) {
      showGame();
      return;
    }
    trans.removeAttribute("hidden");
    trans.setAttribute("aria-hidden", "false");
    requestAnimationFrame(function () {
      trans.classList.add("landing-enter-transition--active");
    });
    window.setTimeout(function () {
      showGame();
      trans.classList.remove("landing-enter-transition--active");
      trans.setAttribute("hidden", "");
      trans.setAttribute("aria-hidden", "true");
    }, 1450);
  });
  els.btnBack.addEventListener("click", showLanding);
  els.btnGen.addEventListener("click", regenerateMaze);
  els.btnRun.addEventListener("click", prepareRun);
  els.btnStep.addEventListener("click", stepOnce);
  els.btnPause.addEventListener("click", () => {
    state.pauseFlag = !state.pauseFlag;
    els.btnPause.textContent = state.pauseFlag ? "Resume" : "Pause";
  });
  els.btnResetView.addEventListener("click", () => {
    clearSolverVisualization();
    clearHints();
    state.animIndex = 0;
    state.simTime = 0;
    els.statSteps.textContent = "0";
    els.statTime.textContent = "0";
    els.frontierContent.textContent = isPlayerMode() ? "Overlays cleared." : "—";
    if (!isPlayerMode() && state.animSteps.length) {
      applyStep(state.animSteps[0], state.currentAlgo);
      const st = state.animSteps[0];
      els.statVisited.textContent = String(st.visited.flat().filter(Boolean).length);
    }
    updatePlayerVisual();
  });

  els.selectMode.addEventListener("change", () => {
    stopAnimation();
    clearSolverVisualization();
    clearHints();
    if (isPlayerMode()) {
      resetPlayerState();
      if (state.enteredMaze) {
        state.playerStartedAt = performance.now();
        startElapsedTicker();
      }
    }
    syncModeUI();
    els.compareBox.classList.add("hidden");
    els.dijkStatsRow.classList.add("hidden");
    els.statPath.textContent = "—";
    els.statVisited.textContent = "0";
    els.statSteps.textContent = "0";
    els.statTime.textContent = "0";
    els.frontierContent.textContent = "—";
  });

  els.btnHintPath.addEventListener("click", showHintPath);
  els.btnHintStep.addEventListener("click", showHintStep);
  els.btnDismissHints.addEventListener("click", () => {
    clearHints();
    els.frontierContent.textContent = "Hints hidden.";
  });

  els.btnEnterMaze.addEventListener("click", () => {
    dismissEnterOverlay();
  });

  els.winPlayAgain.addEventListener("click", () => {
    hideWinOverlay();
    regenerateMaze();
  });

  els.winClose.addEventListener("click", () => {
    hideWinOverlay();
  });

  els.chkAmbient.addEventListener("change", () => {
    setAmbient(els.chkAmbient.checked);
  });

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", resizeDustCanvas);

  els.rangeSpeed.addEventListener("input", setSpeedLabel);

  setSpeedLabel();
  initLandingExperience();
  showLanding();
})();
