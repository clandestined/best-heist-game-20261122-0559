// The heist rules and state, with no drawing and no browser in it: the thief,
// the patrolling guards and their vision cones, the sweeping cameras, the
// vault, the loot and the alarm meter. step() advances one fixed step and
// returns what happened as bit flags, so the caller can react (sounds,
// screens) without the world knowing about them. Nothing here allocates
// after createWorld returns.

import {
  ALARM,
  CAMERA,
  COINS,
  FIELD,
  GUARD,
  LEVELS,
  LOOT,
  SCORE,
  THIEF,
  VAULT,
} from './config.js';

export const EVENT_PICKUP = 1;
export const EVENT_VAULT = 2;
export const EVENT_BUSTED = 4;
export const EVENT_LEVEL_WIN = 8;
export const EVENT_SPOTTED = 16;
export const EVENT_COIN = 32;
export const EVENT_CRACK = 64;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** True when the segment p->q crosses the rectangle (slab test). */
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

/** True when nothing solid stands between eye and target. */
function lineOfSight(eye, target, blockers) {
  for (let i = 0; i < blockers.length; i += 1) {
    if (segmentHitsRect(eye.x, eye.y, target.x, target.y, blockers[i])) return false;
  }
  return true;
}

/**
 * True when `target` stands inside a cone from `eye`, facing `facing`,
 * reaching `range` and opening `halfAngle` each side — and the line of
 * sight is clear. Returns the distance, or -1 when unseen.
 */
function coneDistance(eye, facing, range, halfAngle, target, blockers) {
  const dx = target.x - eye.x;
  const dy = target.y - eye.y;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return -1;
  if (dist > 1 && Math.abs(angleDiff(Math.atan2(dy, dx), facing)) > halfAngle) return -1;
  if (!lineOfSight(eye, target, blockers)) return -1;
  return dist;
}

/** Circle-vs-rectangle push-out: keeps a circle out of solid rectangles. */
function collideCircle(pos, radius, blockers) {
  for (let i = 0; i < blockers.length; i += 1) {
    const r = blockers[i];
    const nearestX = clamp(pos.x, r.x, r.x + r.w);
    const nearestY = clamp(pos.y, r.y, r.y + r.h);
    const dx = pos.x - nearestX;
    const dy = pos.y - nearestY;
    const distSq = dx * dx + dy * dy;
    if (distSq >= radius * radius) continue;
    if (distSq === 0) {
      // Centre inside the rectangle: push out along the smallest overlap.
      const left = pos.x - r.x;
      const right = r.x + r.w - pos.x;
      const top = pos.y - r.y;
      const bottom = r.y + r.h - pos.y;
      const min = Math.min(left, right, top, bottom);
      if (min === left) pos.x = r.x - radius;
      else if (min === right) pos.x = r.x + r.w + radius;
      else if (min === top) pos.y = r.y - radius;
      else pos.y = r.y + r.h + radius;
    } else {
      const dist = Math.sqrt(distSq);
      pos.x = nearestX + (dx / dist) * radius;
      pos.y = nearestY + (dy / dist) * radius;
    }
  }
  pos.x = clamp(pos.x, FIELD.wall + radius, FIELD.width - FIELD.wall - radius);
  pos.y = clamp(pos.y, FIELD.wall + radius, FIELD.height - FIELD.wall - radius);
}

export function createWorld(random) {
  const levelCount = LEVELS.length;
  const state = {
    levelIndex: 0,
    level: LEVELS[0],
    thief: { x: 0, y: 0, sneaking: false, moving: false },
    guards: [],
    cameras: [],
    sideLoot: [],
    solids: [], // blockers plus the vault: solid for movement and sight
    alarm: 0,
    peakAlarm: 0,
    seen: false,
    loot: 0,
    score: 0,
    coins: COINS.perLevel,
    vaultOpen: false,
    vaultProgress: 0,
    exitActive: false,
    elapsed: 0,
    coin: null, // { x, y, ttl } — a tossed coin lying on the floor
    busted: false,
    bustedReason: '',
    levelWon: false,
    heistWon: false,
  };

  function loadLevel(index) {
    const level = LEVELS[index];
    state.levelIndex = index;
    state.level = level;
    state.thief.x = level.thiefStart.x;
    state.thief.y = level.thiefStart.y;
    state.thief.sneaking = false;
    state.thief.moving = false;
    state.guards = level.guards.map((g) => ({
      x: g.path[0][0],
      y: g.path[0][1],
      path: g.path,
      leg: 0,
      forward: true,
      speed: g.speed,
      face: Math.atan2(g.path[1][1] - g.path[0][1], g.path[1][0] - g.path[0][0]),
      wait: 0,
      scanBase: 0,
      scanTime: 0,
      mode: 'patrol',
      target: null,
      investigateWait: 0,
      resumeLeg: 0,
    }));
    state.cameras = level.cameras.map((c) => ({
      x: c.x,
      y: c.y,
      baseAngle: c.baseAngle,
      sweep: c.sweep,
      sweepSpeed: c.sweepSpeed,
      angle: c.baseAngle,
      time: random() * 10,
    }));
    state.sideLoot = level.sideLoot.map((item) => ({ ...item, taken: false }));
    // The vault is furniture too: the thief cracks it from beside it, never
    // by standing inside it.
    state.solids = level.blockers.concat([level.vault]);
    state.alarm = 0;
    state.peakAlarm = 0;
    state.seen = false;
    state.coins = COINS.perLevel;
    state.vaultOpen = false;
    state.vaultProgress = 0;
    state.exitActive = false;
    state.elapsed = 0;
    state.coin = null;
    state.busted = false;
    state.bustedReason = '';
    state.levelWon = false;
    state.heistWon = false;
  }

  function reset() {
    state.score = 0;
    state.loot = 0;
    loadLevel(0);
  }

  function nextLevel() {
    if (state.levelIndex + 1 >= levelCount) {
      state.heistWon = true;
      return false;
    }
    loadLevel(state.levelIndex + 1);
    return true;
  }

  function guardInvestigate(point) {
    let nearest = null;
    let nearestDist = Infinity;
    for (let i = 0; i < state.guards.length; i += 1) {
      const guard = state.guards[i];
      if (guard.mode !== 'patrol') continue;
      const dist = Math.hypot(guard.x - point.x, guard.y - point.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = guard;
      }
    }
    if (nearest) {
      nearest.mode = 'investigate';
      nearest.target = { x: point.x, y: point.y };
      nearest.investigateWait = 0;
    }
  }

  function moveGuard(guard, dt) {
    const level = state.level;
    if (guard.mode === 'investigate' || guard.mode === 'return') {
      const target = guard.mode === 'investigate' ? guard.target : { x: guard.path[guard.resumeLeg][0], y: guard.path[guard.resumeLeg][1] };
      const dx = target.x - guard.x;
      const dy = target.y - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 6) {
        if (guard.mode === 'investigate') {
          guard.investigateWait += dt;
          guard.face = guard.scanBase + Math.sin(guard.investigateWait * 2.4) * 0.9;
          if (guard.investigateWait >= GUARD.investigateTime) {
            guard.mode = 'return';
            // Resume from the nearest waypoint.
            let best = 0;
            let bestDist = Infinity;
            for (let i = 0; i < guard.path.length; i += 1) {
              const d = Math.hypot(guard.x - guard.path[i][0], guard.y - guard.path[i][1]);
              if (d < bestDist) { bestDist = d; best = i; }
            }
            guard.resumeLeg = best;
          }
        } else {
          guard.mode = 'patrol';
          guard.leg = guard.resumeLeg;
          guard.forward = true;
          guard.wait = 0;
        }
        return;
      }
      const step = Math.min(dist, guard.speed * 1.15 * dt);
      guard.face = Math.atan2(dy, dx);
      guard.x += (dx / dist) * step;
      guard.y += (dy / dist) * step;
      collideCircle(guard, GUARD.radius, state.solids);
      return;
    }
    // Patrol: walk the waypoints, ping-pong, waiting and scanning at each end.
    if (guard.wait > 0) {
      guard.wait -= dt;
      guard.scanTime += dt;
      guard.face = guard.scanBase + Math.sin(guard.scanTime * 1.8) * 0.85;
      return;
    }
    const nextIndex = guard.forward ? guard.leg + 1 : guard.leg - 1;
    const target = guard.path[nextIndex];
    const dx = target[0] - guard.x;
    const dy = target[1] - guard.y;
    const dist = Math.hypot(dx, dy);
    const step = guard.speed * dt;
    if (dist <= step) {
      guard.x = target[0];
      guard.y = target[1];
      guard.leg = nextIndex;
      if (nextIndex === guard.path.length - 1) guard.forward = false;
      else if (nextIndex === 0) guard.forward = true;
      guard.wait = GUARD.waitTime;
      guard.scanTime = 0;
      guard.scanBase = Math.atan2(dy, dx);
      guard.face = guard.scanBase;
      return;
    }
    guard.face = Math.atan2(dy, dx);
    guard.x += (dx / dist) * step;
    guard.y += (dy / dist) * step;
    collideCircle(guard, GUARD.radius, state.solids);
  }

  /**
   * One fixed step. `dir` is { x, y } of -1/0/1; `sneaking` halves the
   * thief's speed and shrinks every cone. `toss` is a playfield point to
   * throw a coin at, or null. Returns EVENT_* flags.
   */
  function step(dt, dir, sneaking, toss) {
    let events = 0;
    if (state.busted || state.levelWon || state.heistWon) return events;
    state.elapsed += dt;
    const level = state.level;
    const thief = state.thief;

    // --- the thief moves -------------------------------------------------
    const speed = sneaking ? THIEF.sneakSpeed : THIEF.walkSpeed;
    let mx = dir.x;
    let my = dir.y;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
    }
    thief.moving = len > 0;
    thief.sneaking = sneaking && len > 0;
    thief.x += mx * speed * dt;
    thief.y += my * speed * dt;
    collideCircle(thief, THIEF.radius, state.solids);

    // --- a tossed coin ---------------------------------------------------
    if (toss && state.coins > 0) {
      const dx = toss.x - thief.x;
      const dy = toss.y - thief.y;
      const dist = Math.hypot(dx, dy);
      const range = Math.min(dist, COINS.throwRange);
      const landing = dist === 0
        ? { x: thief.x, y: thief.y }
        : { x: thief.x + (dx / dist) * range, y: thief.y + (dy / dist) * range };
      state.coin = { x: landing.x, y: landing.y, ttl: 2.5 };
      state.coins -= 1;
      events |= EVENT_COIN;
      for (let i = 0; i < state.guards.length; i += 1) {
        const guard = state.guards[i];
        if (Math.hypot(guard.x - landing.x, guard.y - landing.y) < COINS.hearRadius) {
          guard.mode = 'investigate';
          guard.target = { x: landing.x, y: landing.y };
          guard.investigateWait = 0;
        }
      }
    }
    if (state.coin) {
      state.coin.ttl -= dt;
      if (state.coin.ttl <= 0) state.coin = null;
    }

    // --- guards patrol, cameras sweep ------------------------------------
    for (let i = 0; i < state.guards.length; i += 1) moveGuard(state.guards[i], dt);
    for (let i = 0; i < state.cameras.length; i += 1) {
      const camera = state.cameras[i];
      camera.time += dt;
      camera.angle = camera.baseAngle + Math.sin(camera.time * camera.sweepSpeed) * camera.sweep;
    }

    // --- who can see the thief? ------------------------------------------
    const rangeFactor = sneaking ? THIEF.sneakRangeFactor : 1;
    const alarmFactor = sneaking ? THIEF.sneakAlarmFactor : 1;
    let gain = 0;
    let seenNow = false;
    for (let i = 0; i < state.guards.length; i += 1) {
      const guard = state.guards[i];
      const dist = coneDistance(
        guard, guard.face, GUARD.viewRange * rangeFactor, GUARD.viewHalfAngle, thief, state.solids,
      );
      if (dist >= 0) {
        seenNow = true;
        gain += GUARD.alarmRate * alarmFactor * (1 + 0.5 * (1 - dist / (GUARD.viewRange * rangeFactor)));
      }
      if (Math.hypot(guard.x - thief.x, guard.y - thief.y) < GUARD.catchRadius) {
        state.busted = true;
        state.bustedReason = 'A guard grabbed you in the open.';
        events |= EVENT_BUSTED;
        return events;
      }
    }
    for (let i = 0; i < state.cameras.length; i += 1) {
      const camera = state.cameras[i];
      const dist = coneDistance(
        camera, camera.angle, CAMERA.viewRange * rangeFactor, CAMERA.viewHalfAngle, thief, state.solids,
      );
      if (dist >= 0) {
        seenNow = true;
        gain += CAMERA.alarmRate * alarmFactor * (1 + 0.5 * (1 - dist / (CAMERA.viewRange * rangeFactor)));
      }
    }
    if (seenNow && !state.seen) events |= EVENT_SPOTTED;
    state.seen = seenNow;
    if (seenNow) {
      state.alarm = Math.min(ALARM.bustedAt, state.alarm + Math.min(gain, 60) * dt);
      // A loud alarm sends the nearest patrolling guard to look.
      if (state.alarm >= ALARM.investigateAt) guardInvestigate({ x: thief.x, y: thief.y });
    } else {
      state.alarm = Math.max(0, state.alarm - ALARM.decay * dt);
    }
    state.peakAlarm = Math.max(state.peakAlarm, state.alarm);
    if (state.alarm >= ALARM.bustedAt) {
      state.busted = true;
      state.bustedReason = 'The alarm hit 100 and the crew scattered.';
      events |= EVENT_BUSTED;
      return events;
    }

    // --- side loot --------------------------------------------------------
    for (let i = 0; i < state.sideLoot.length; i += 1) {
      const item = state.sideLoot[i];
      if (!item.taken && Math.hypot(item.x - thief.x, item.y - thief.y) < LOOT.pickupRadius) {
        item.taken = true;
        state.loot += LOOT.sideScore;
        state.score += LOOT.sideScore;
        events |= EVENT_PICKUP;
      }
    }

    // --- the vault ---------------------------------------------------------
    const vault = level.vault;
    const vaultCentre = { x: vault.x + vault.w / 2, y: vault.y + vault.h / 2 };
    if (!state.vaultOpen) {
      if (Math.hypot(vaultCentre.x - thief.x, vaultCentre.y - thief.y) < VAULT.crackRadius) {
        state.vaultProgress += dt / VAULT.crackSeconds;
        events |= EVENT_CRACK;
        if (state.vaultProgress >= 1) {
          state.vaultOpen = true;
          state.exitActive = true;
          state.loot += VAULT.score;
          state.score += VAULT.score;
          events |= EVENT_VAULT;
        }
      } else {
        state.vaultProgress = Math.max(0, state.vaultProgress - dt * 0.5);
      }
    }

    // --- the exit ----------------------------------------------------------
    if (state.exitActive) {
      const exit = level.exit;
      if (
        thief.x > exit.x - 6 && thief.x < exit.x + exit.w + 6
        && thief.y > exit.y - 10 && thief.y < exit.y + exit.h + 10
      ) {
        const timeBonus = Math.max(0, Math.round(SCORE.timeBonusBase - state.elapsed * SCORE.timeBonusPerSecond));
        const stealthBonus = state.peakAlarm <= SCORE.stealthCeiling ? SCORE.stealthBonus : 0;
        state.score += timeBonus + stealthBonus;
        state.levelWon = true;
        events |= EVENT_LEVEL_WIN;
      }
    }
    return events;
  }

  reset();
  return { state, reset, step, nextLevel, levelCount };
}
