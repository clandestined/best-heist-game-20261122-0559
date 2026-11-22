// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by an
// autopilot that pathfinds on a coarse grid (Dijkstra over 40 px cells,
// routing around the furniture and charging a heavy toll for any cell a
// vision cone covers), so the frame is what a short game really looks like
// and the same seed always gives the same frame.

import { FIELD, STEP, THIEF } from './config.js';
import { SCREEN_LEVEL_WIN, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { EVENT_BUSTED, EVENT_LEVEL_WIN } from './world.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 14;
const END_LIMIT_SECONDS = 150;
const CELL = 20;
const COLS = Math.ceil(FIELD.width / CELL);
const ROWS = Math.ceil(FIELD.height / CELL);
// How often the autopilot re-plans, in steps: the guards keep moving, so a
// plan made a second ago can walk the thief into a cone.
const REPLAN_EVERY = 30;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function segmentHitsRect(px, py, qx, qy, rect) {
  const dx = qx - px;
  const dy = qy - py;
  let tMin = 0;
  let tMax = 1;
  if (dx === 0) {
    if (px < rect.x || px > rect.x + rect.w) return false;
  } else {
    let t1 = (rect.x - px) / dx;
    let t2 = (rect.x + rect.w - px) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  if (dy === 0) {
    if (py < rect.y || py > rect.y + rect.h) return false;
  } else {
    let t1 = (rect.y - py) / dy;
    let t2 = (rect.y + rect.h - py) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  return true;
}

function inCone(eye, facing, range, halfAngle, target, solids) {
  const dx = target.x - eye.x;
  const dy = target.y - eye.y;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist > 1 && Math.abs(angleDiff(Math.atan2(dy, dx), facing)) > halfAngle) return false;
  for (let i = 0; i < solids.length; i += 1) {
    if (segmentHitsRect(eye.x, eye.y, target.x, target.y, solids[i])) return false;
  }
  return true;
}

function cellBlocked(cx, cy, solids) {
  const x = cx * CELL + CELL / 2;
  const y = cy * CELL + CELL / 2;
  if (x < FIELD.wall + THIEF.radius || x > FIELD.width - FIELD.wall - THIEF.radius
    || y < FIELD.wall + THIEF.radius || y > FIELD.height - FIELD.wall - THIEF.radius) return true;
  for (let i = 0; i < solids.length; i += 1) {
    const r = solids[i];
    const nearestX = Math.max(r.x, Math.min(x, r.x + r.w));
    const nearestY = Math.max(r.y, Math.min(y, r.y + r.h));
    if (Math.hypot(x - nearestX, y - nearestY) < THIEF.radius + 2) return true;
  }
  return false;
}

/** The toll of standing in a cell: high inside a cone, higher near a guard. */
function cellCost(cx, cy, state) {
  const point = { x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2 };
  let cost = 1;
  for (let i = 0; i < state.guards.length; i += 1) {
    const guard = state.guards[i];
    if (inCone(guard, guard.face, 230, 0.62, point, state.solids)) cost += 60;
    const dist = Math.hypot(guard.x - point.x, guard.y - point.y);
    if (dist < 70) cost += 30 * (70 - dist) / 70;
  }
  for (let i = 0; i < state.cameras.length; i += 1) {
    const camera = state.cameras[i];
    if (inCone(camera, camera.angle, 270, 0.5, point, state.solids)) cost += 50;
  }
  return cost;
}

/**
 * The cheapest route from `from` to `to` as a list of cell centres, or null
 * when no route exists. Dijkstra over the grid, eight neighbours, diagonal
 * steps cost a little more than straight ones.
 */
function findPath(from, to, state) {
  const startX = Math.floor(from.x / CELL);
  const startY = Math.floor(from.y / CELL);
  const goalX = Math.floor(to.x / CELL);
  const goalY = Math.floor(to.y / CELL);
  if (cellBlocked(goalX, goalY, state.solids)) return null;
  const key = (x, y) => y * COLS + x;
  const dist = new Map([[key(startX, startY), 0]]);
  const prev = new Map();
  const open = [[0, startX, startY]];
  const DIRS = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, 1.5], [1, -1, 1.5], [-1, 1, 1.5], [-1, -1, 1.5],
  ];
  while (open.length > 0) {
    let bestIndex = 0;
    for (let i = 1; i < open.length; i += 1) if (open[i][0] < open[bestIndex][0]) bestIndex = i;
    const [d, x, y] = open.splice(bestIndex, 1)[0];
    if (d !== dist.get(key(x, y))) continue;
    if (x === goalX && y === goalY) {
      const path = [];
      let cx = x;
      let cy = y;
      while (cx !== startX || cy !== startY) {
        path.unshift({ x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2 });
        const p = prev.get(key(cx, cy));
        cx = p[0];
        cy = p[1];
      }
      return path;
    }
    for (let i = 0; i < DIRS.length; i += 1) {
      const nx = x + DIRS[i][0];
      const ny = y + DIRS[i][1];
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (cellBlocked(nx, ny, state.solids)) continue;
      const nd = d + DIRS[i][2] * cellCost(nx, ny, state);
      if (nd < (dist.get(key(nx, ny)) ?? Infinity)) {
        dist.set(key(nx, ny), nd);
        prev.set(key(nx, ny), [x, y]);
        open.push([nd, nx, ny]);
      }
    }
  }
  return null;
}

/** Where the autopilot is headed: beside the vault, or the exit once cracked. */
function autopilotTarget(state) {
  const level = state.level;
  if (!state.vaultOpen) {
    const vault = level.vault;
    return { x: vault.x + vault.w / 2, y: vault.y + vault.h + 20 };
  }
  const exit = level.exit;
  return { x: exit.x + exit.w / 2, y: exit.y - 4 };
}

export function createAutopilot() {
  let path = null;
  let stepsSincePlan = 0;
  let lastTarget = null;
  return function autopilot(state) {
    const target = autopilotTarget(state);
    stepsSincePlan += 1;
    if (
      path === null || stepsSincePlan >= REPLAN_EVERY
      || lastTarget === null || Math.hypot(target.x - lastTarget.x, target.y - lastTarget.y) > 1
    ) {
      path = findPath(state.thief, target, state);
      stepsSincePlan = 0;
      lastTarget = target;
    }
    const nearWatcher = state.guards.some((g) => Math.hypot(g.x - state.thief.x, g.y - state.thief.y) < 320)
      || state.cameras.some((c) => Math.hypot(c.x - state.thief.x, c.y - state.thief.y) < 320);
    if (!path || path.length === 0) return { dir: { x: 0, y: 0 }, sneak: nearWatcher };
    const next = path[0];
    const dx = next.x - state.thief.x;
    const dy = next.y - state.thief.y;
    if (Math.hypot(dx, dy) < 8) path.shift();
    const len = Math.hypot(dx, dy) || 1;
    return { dir: { x: dx / len, y: dy / len }, sneak: nearWatcher };
  };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, { x: 0, y: 0 }, false, null);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const autopilot = createAutopilot();
  let events = 0;
  for (let index = 0; index < limit / STEP; index += 1) {
    const move = autopilot(world.state);
    events = world.step(STEP, move.dir, move.sneak, null);
    if (events & EVENT_BUSTED) break;
    if (events & EVENT_LEVEL_WIN) break;
  }
  if (world.state.busted) return { screen: SCREEN_OVER, best: world.state.score };
  if (world.state.levelWon) return { screen: SCREEN_LEVEL_WIN, best: world.state.score };
  return { screen: SCREEN_PLAY, best: world.state.score };
}
