// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens: title,
// play, paused, busted, level won and heist won.
// Sneak is a toggle: press Shift (or C) to slip into a crouch, press it
// again to stand back up. Click anywhere in the room to toss a coin there.
//
// ?seed=N fixes the guards' and cameras' starting phase. ?shot=start|play|end
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_BUSTED,
  EVENT_COIN,
  EVENT_LEVEL_WIN,
  EVENT_PICKUP,
  EVENT_SPOTTED,
  EVENT_VAULT,
  createWorld,
} from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_PAUSE,
  ACTION_SNEAK,
  ACTION_TOSS,
  createInput,
} from './input.js';
import { createAudio } from './audio.js';
import {
  SCREEN_HEIST_WIN,
  SCREEN_LEVEL_WIN,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score lasts this visit.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, '');
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (x, y) => renderer.toField(x, y));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let sneaking = false;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers hear the screen changes and each pickup.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    sneaking = false;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${world.state.level.name}. Crack the vault, then reach the exit.`);
  }

  function endGame(busted) {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(busted
      ? `Busted. ${world.state.bustedReason || 'The heist is blown.'} Score ${world.state.score}. Best ${best}.`
      : `Game over. Score ${world.state.score}.`);
  }

  function finishHeist() {
    world.state.heistWon = true;
    screen = SCREEN_HEIST_WIN;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    audio.win();
    announce(`Heist complete. Score ${world.state.score}. Best ${best}.`);
  }

  function handleEvents(events) {
    if (events & EVENT_SPOTTED) {
      audio.spotted();
      announce('Spotted! The alarm is climbing.');
    }
    if (events & EVENT_PICKUP) {
      audio.pickup();
      announce(`Loot grabbed. $${world.state.loot} so far.`);
    }
    if (events & EVENT_COIN) audio.coin();
    if (events & EVENT_VAULT) {
      audio.vaultOpen();
      announce('Vault cracked! Get to the green exit.');
    }
    if (events & EVENT_BUSTED) {
      audio.busted();
      endGame(true);
    } else if (events & EVENT_LEVEL_WIN) {
      audio.win();
      screen = SCREEN_LEVEL_WIN;
      announce(`${world.state.level.name} cleared. Score ${world.state.score}.`);
    }
  }

  // One frame's one-shot presses, read once and shared by step() and
  // handleActions() so a press is never lost and never counted twice.
  function handleActions(actions) {
    if (actions & ACTION_SNEAK && screen === SCREEN_PLAY) {
      sneaking = !sneaking;
      announce(sneaking ? 'Sneaking.' : 'Walking.');
    }
    if (actions & ACTION_CONFIRM && screen === SCREEN_TITLE) startGame();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_OVER) startGame();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_LEVEL_WIN) {
      if (world.state.levelIndex + 1 >= world.levelCount) finishHeist();
      else {
        world.nextLevel();
        sneaking = false;
        screen = SCREEN_PLAY;
        announce(`Playing. ${world.state.level.name}.`);
      }
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_HEIST_WIN) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, false, null);
      return;
    }
    // A toss click is only spent while playing.
    const toss = (actions & ACTION_TOSS) ? input.takeTossPoint() : null;
    const events = world.step(STEP, input.direction(), sneaking, toss);
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    // Keys first, like the starter: a confirm pressed while playing must
    // not restart the game in the same frame the thief gets busted.
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    audio.alarmDrone(screen === SCREEN_PLAY ? world.state.alarm / 100 : 0);
    const extra = screen === SCREEN_HEIST_WIN
      ? `Three rooms, one crew, $${world.state.loot} of loot.`
      : '';
    renderer.draw(world.state, screen, best, extra);
  }

  // Leaving the tab pauses a running game rather than letting the alarm climb unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('The Velvet Vault. Press Space or click to start the heist.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
