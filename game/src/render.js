// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred, the
// margin filled with the backdrop colour. Vision cones are painted before
// the furniture, so a crate or pillar covers the part of a cone behind it.
// Canvas shapes and text only — every pixel is the game's own art.

import { CAMERA, FIELD, FONT, GUARD, PALETTE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_LEVEL_WIN = 'levelwin';
export const SCREEN_HEIST_WIN = 'heistwin';
// The cover frame: the live room with the HUD, named for the game, used
// only by the staged ?shot=start scene — the room, cones, vault, loot and
// alarm meter all stay visible, with no panel over them.
export const SCREEN_COVER = 'cover';

const PANEL = { width: 640, top: 150, line: 32, bottom: 76 };
const TILE = 80;

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function formatTime(seconds) {
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest < 10 ? '0' : ''}${rest}`;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const lootLabel = cachedLabel('LOOT $');
  const coinsLabel = cachedLabel('COINS ');
  const scoreLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, baseline = 'alphabetic') {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline;
    context.fillText(value, x, y);
  }

  function drawFloor() {
    for (let ty = 0; ty < FIELD.height / TILE; ty += 1) {
      for (let tx = 0; tx < FIELD.width / TILE; tx += 1) {
        context.fillStyle = (tx + ty) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        context.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }
    context.strokeStyle = PALETTE.floorLine;
    context.lineWidth = 1;
    for (let x = 0; x <= FIELD.width; x += TILE) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, FIELD.height);
      context.stroke();
    }
    for (let y = 0; y <= FIELD.height; y += TILE) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(FIELD.width, y);
      context.stroke();
    }
    // The outer walls, with a gold trim on the inside edge.
    context.fillStyle = PALETTE.wall;
    context.fillRect(0, 0, FIELD.width, FIELD.wall);
    context.fillRect(0, FIELD.height - FIELD.wall, FIELD.width, FIELD.wall);
    context.fillRect(0, 0, FIELD.wall, FIELD.height);
    context.fillRect(FIELD.width - FIELD.wall, 0, FIELD.wall, FIELD.height);
    context.fillStyle = PALETTE.wallTrim;
    context.fillRect(FIELD.wall, FIELD.wall, FIELD.width - FIELD.wall * 2, 2);
    context.fillRect(FIELD.wall, FIELD.height - FIELD.wall - 2, FIELD.width - FIELD.wall * 2, 2);
    context.fillRect(FIELD.wall, FIELD.wall, 2, FIELD.height - FIELD.wall * 2);
    context.fillRect(FIELD.width - FIELD.wall - 2, FIELD.wall, 2, FIELD.height - FIELD.wall * 2);
  }

  function drawCone(eye, facing, range, halfAngle, fill, edge) {
    context.fillStyle = fill;
    context.beginPath();
    context.moveTo(eye.x, eye.y);
    context.arc(eye.x, eye.y, range, facing - halfAngle, facing + halfAngle);
    context.closePath();
    context.fill();
    context.strokeStyle = edge;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(eye.x, eye.y);
    context.lineTo(eye.x + Math.cos(facing - halfAngle) * range, eye.y + Math.sin(facing - halfAngle) * range);
    context.moveTo(eye.x, eye.y);
    context.lineTo(eye.x + Math.cos(facing + halfAngle) * range, eye.y + Math.sin(facing + halfAngle) * range);
    context.stroke();
  }

  function drawBlocker(b) {
    if (b.kind === 'crate') {
      context.fillStyle = PALETTE.crate;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.strokeStyle = PALETTE.crateEdge;
      context.lineWidth = 3;
      context.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3);
      context.beginPath();
      context.moveTo(b.x, b.y);
      context.lineTo(b.x + b.w, b.y + b.h);
      context.moveTo(b.x + b.w, b.y);
      context.lineTo(b.x, b.y + b.h);
      context.stroke();
    } else if (b.kind === 'case') {
      context.fillStyle = PALETTE.displayCase;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = PALETTE.caseGlass;
      context.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      context.strokeStyle = PALETTE.wallTrim;
      context.lineWidth = 2;
      context.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    } else {
      // pillar
      context.fillStyle = PALETTE.pillar;
      context.beginPath();
      context.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.wallTrim;
      context.lineWidth = 2;
      context.stroke();
    }
  }

  function drawVault(state) {
    const vault = state.level.vault;
    const cx = vault.x + vault.w / 2;
    const cy = vault.y + vault.h / 2;
    if (state.vaultOpen) {
      context.save();
      context.shadowColor = PALETTE.vaultGlow;
      context.shadowBlur = 24;
      context.fillStyle = PALETTE.vaultGlow;
      context.fillRect(vault.x, vault.y, vault.w, vault.h);
      context.restore();
    }
    context.fillStyle = PALETTE.vault;
    context.fillRect(vault.x, vault.y, vault.w, vault.h);
    context.strokeStyle = PALETTE.vaultDoor;
    context.lineWidth = 3;
    context.strokeRect(vault.x + 1.5, vault.y + 1.5, vault.w - 3, vault.h - 3);
    context.fillStyle = state.vaultOpen ? '#1c2030' : PALETTE.vaultDoor;
    context.beginPath();
    context.arc(cx, cy, 14, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = state.vaultOpen ? PALETTE.vaultGlow : '#1c2030';
    context.beginPath();
    context.arc(cx, cy, 6, 0, Math.PI * 2);
    context.fill();
    if (!state.vaultOpen && state.vaultProgress > 0) {
      context.strokeStyle = PALETTE.vaultGlow;
      context.lineWidth = 5;
      context.beginPath();
      context.arc(cx, cy, 24, -Math.PI / 2, -Math.PI / 2 + state.vaultProgress * Math.PI * 2);
      context.stroke();
    }
    // The label sits beside the vault, never over the objective line above it.
    text(state.vaultOpen ? 'OPEN' : 'VAULT', vault.x + vault.w + 10, cy + 5, 15, PALETTE.vaultDoor, 'left');
  }

  function drawExit(state) {
    const exit = state.level.exit;
    const active = state.exitActive;
    const pulse = active ? 0.6 + 0.4 * Math.sin(performance.now() / 180) : 0;
    context.fillStyle = active ? PALETTE.exit : '#243024';
    context.fillRect(exit.x, exit.y, exit.w, exit.h);
    context.strokeStyle = active ? PALETTE.exitGlow : PALETTE.muted;
    context.lineWidth = active ? 3 + pulse : 2;
    context.strokeRect(exit.x + 1, exit.y + 1, exit.w - 2, exit.h - 2);
    text(active ? 'EXIT →' : 'EXIT', exit.x + exit.w / 2, exit.y + exit.h + 18, 15, active ? PALETTE.exitGlow : PALETTE.muted, 'center');
  }

  function drawSideLoot(state) {
    for (let i = 0; i < state.sideLoot.length; i += 1) {
      const item = state.sideLoot[i];
      if (item.taken) continue;
      const twinkle = 0.7 + 0.3 * Math.sin(performance.now() / 240 + i * 2);
      context.save();
      context.globalAlpha = twinkle;
      context.shadowColor = PALETTE.loot;
      context.shadowBlur = 14;
      context.fillStyle = PALETTE.loot;
      context.beginPath();
      context.moveTo(item.x, item.y - 12);
      context.lineTo(item.x + 10, item.y);
      context.lineTo(item.x, item.y + 12);
      context.lineTo(item.x - 10, item.y);
      context.closePath();
      context.fill();
      context.restore();
      text(item.label, item.x, item.y + 30, 13, PALETTE.muted, 'center');
    }
  }

  function drawCoin(state) {
    if (!state.coin) return;
    context.fillStyle = PALETTE.coin;
    context.beginPath();
    context.arc(state.coin.x, state.coin.y, 6, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.coin;
    context.lineWidth = 2;
    context.globalAlpha = Math.max(0, state.coin.ttl / 2.5);
    context.beginPath();
    context.arc(state.coin.x, state.coin.y, 6 + (2.5 - state.coin.ttl) * 22, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = 1;
  }

  function drawCameras(state) {
    for (let i = 0; i < state.cameras.length; i += 1) {
      const camera = state.cameras[i];
      drawCone(camera, camera.angle, CAMERA.viewRange, CAMERA.viewHalfAngle, PALETTE.cameraCone, PALETTE.cameraConeEdge);
    }
    for (let i = 0; i < state.cameras.length; i += 1) {
      const camera = state.cameras[i];
      context.fillStyle = '#1c2030';
      context.fillRect(camera.x - 12, camera.y - 8, 24, 16);
      context.fillStyle = PALETTE.camera;
      context.beginPath();
      context.arc(camera.x + Math.cos(camera.angle) * 8, camera.y + Math.sin(camera.angle) * 8, 6, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawGuards(state) {
    for (let i = 0; i < state.guards.length; i += 1) {
      const guard = state.guards[i];
      const alerted = guard.mode !== 'patrol';
      drawCone(
        guard, guard.face, GUARD.viewRange, GUARD.viewHalfAngle,
        alerted ? PALETTE.coneAlert : PALETTE.cone,
        alerted ? PALETTE.coneAlertEdge : PALETTE.coneEdge,
      );
    }
    for (let i = 0; i < state.guards.length; i += 1) {
      const guard = state.guards[i];
      const alerted = guard.mode !== 'patrol';
      context.fillStyle = PALETTE.guardSuit;
      context.beginPath();
      context.arc(guard.x, guard.y, 15, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = alerted ? PALETTE.guardAlert : PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, 10, 0, Math.PI * 2);
      context.fill();
      // The direction the guard is looking.
      context.strokeStyle = PALETTE.guard;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.lineTo(guard.x + Math.cos(guard.face) * 18, guard.y + Math.sin(guard.face) * 18);
      context.stroke();
      if (alerted) text('!', guard.x, guard.y - 22, 22, PALETTE.guardAlert, 'center');
    }
  }

  function drawThief(state) {
    const thief = state.thief;
    const r = thief.sneaking ? 10 : 13;
    context.fillStyle = PALETTE.thiefCloak;
    context.beginPath();
    context.arc(thief.x, thief.y, r + 3, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = thief.sneaking ? PALETTE.thiefSneak : PALETTE.thief;
    context.beginPath();
    context.arc(thief.x, thief.y, r, 0, Math.PI * 2);
    context.fill();
    // The mask: two dark eyes on the pale face.
    context.fillStyle = '#141724';
    context.beginPath();
    context.arc(thief.x - 4, thief.y - 2, 2.2, 0, Math.PI * 2);
    context.arc(thief.x + 4, thief.y - 2, 2.2, 0, Math.PI * 2);
    context.fill();
  }

  function drawHud(state, titleOverride) {
    context.fillStyle = 'rgba(11, 13, 22, 0.82)';
    context.fillRect(0, 0, FIELD.width, 52);
    text(titleOverride || state.level.name, 24, 33, 20, PALETTE.text, 'left');
    text(formatTime(state.elapsed), FIELD.width / 2, 33, 20, PALETTE.text, 'center');
    text(lootLabel(state.loot), FIELD.width - 24, 33, 20, PALETTE.loot, 'right');
    // The alarm meter: a bar that fills green, then gold, then red.
    const barX = FIELD.width / 2 - 170;
    const barY = 56;
    const barW = 340;
    const barH = 12;
    text('ALARM', barX - 10, barY + 10, 14, state.alarm > 55 ? PALETTE.alarmHigh : PALETTE.muted, 'right');
    context.fillStyle = '#0b0d16';
    context.fillRect(barX, barY, barW, barH);
    const fill = state.alarm >= 100 ? PALETTE.alarmHigh : state.alarm >= 55 ? PALETTE.alarmMid : PALETTE.alarmLow;
    context.fillStyle = fill;
    context.fillRect(barX, barY, barW * (state.alarm / 100), barH);
    context.strokeStyle = PALETTE.muted;
    context.lineWidth = 1;
    context.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);
    text(coinsLabel(state.coins), barX + barW + 16, barY + 10, 14, PALETTE.coin, 'left');
    const objective = !state.vaultOpen
      ? 'Crack the vault — stand beside it'
      : state.exitActive ? 'Vault cracked! Get to the green EXIT' : '';
    if (objective) text(objective, FIELD.width / 2, 96, 17, state.exitActive ? PALETTE.exitGlow : PALETTE.vaultGlow, 'center');
    // A red wash creeps in as the alarm climbs.
    if (state.alarm > 25) {
      context.fillStyle = `rgba(255, 46, 46, ${((state.alarm - 25) / 75) * 0.16})`;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(11, 13, 22, 0.58)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 3;
    context.strokeRect(x + 1.5, y + 1.5, PANEL.width - 3, height - 3);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 22, PALETTE.vaultGlow, 'center');
  }

  function drawField(state) {
    drawFloor();
    drawCameras(state);
    drawGuards(state);
    const blockers = state.level.blockers;
    for (let i = 0; i < blockers.length; i += 1) drawBlocker(blockers[i]);
    drawVault(state);
    drawExit(state);
    drawSideLoot(state);
    drawCoin(state);
    drawThief(state);
  }

  /** Paint one frame: the room, then the HUD or a panel for the screen. */
  function draw(state, screen, best, extra) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawField(state);
    if (screen === SCREEN_COVER) {
      // The cover: the live room and the full HUD, named for the game, with
      // no panel hiding the cones, the vault or the loot.
      drawHud(state, 'The Velvet Vault');
      return;
    }
    if (screen === SCREEN_TITLE) {
      drawPanel(
        'The Velvet Vault',
        [
          'A top-down stealth heist in three rooms.',
          'Dodge the guards’ vision cones and the sweeping cameras.',
          'Crack the vault, grab the loot, slip out the green door.',
          'Move with WASD or arrows · press Shift to sneak.',
          'Click to toss a coin and lure a guard away.',
          best > 0 ? bestLabel(best) : 'No crew has ever finished all three rooms.',
        ],
        'Press Space or click to start the heist',
      );
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The guards will wait for you. Probably.'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      drawPanel(
        'BUSTED',
        [
          state.bustedReason || 'The alarm hit 100 and the crew scattered.',
          scoreLabel(state.score),
          bestLabel(best),
        ],
        'Press Space or click to try again',
        PALETTE.alarmHigh,
      );
    } else if (screen === SCREEN_LEVEL_WIN) {
      drawPanel(
        'Clean getaway',
        [
          `${state.level.name} — vault emptied.`,
          scoreLabel(state.score),
          'One room down. The next one is harder.',
        ],
        'Press Space or click for the next room',
        PALETTE.exitGlow,
      );
    } else if (screen === SCREEN_HEIST_WIN) {
      drawPanel(
        'THE VELVET VAULT',
        [
          'All three rooms emptied. The crew retires rich.',
          scoreLabel(state.score),
          bestLabel(best),
          extra || '',
        ],
        'Press Space or click to run it again',
        PALETTE.vaultGlow,
      );
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return {
    draw,
    /** Convert a client (mouse) point to playfield coordinates, or null outside. */
    toField(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * FIELD.width;
      const y = ((clientY - rect.top) / rect.height) * FIELD.height;
      if (x < 0 || x > FIELD.width || y < 0 || y > FIELD.height) return null;
      return { x, y };
    },
  };
}
