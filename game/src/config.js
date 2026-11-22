// The Velvet Vault — tuning numbers, palette and the three heist rooms.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720, wall: 24 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

export const THIEF = {
  radius: 13,
  walkSpeed: 175,
  sneakSpeed: 88,
  // A sneaking thief is harder to spot: cones reach less far and the alarm
  // climbs slower.
  sneakRangeFactor: 0.55,
  sneakAlarmFactor: 0.6,
};

export const GUARD = {
  radius: 15,
  // How far a guard's cone reaches, and how wide it is (half-angle).
  viewRange: 230,
  viewHalfAngle: 0.62,
  // Touching a guard ends the heist at once.
  catchRadius: 28,
  // Alarm gained per second while the thief stands in a guard's cone.
  alarmRate: 26,
  // Seconds a guard waits at each waypoint, scanning the room.
  waitTime: 1.6,
  // Seconds a guard studies a spot it was sent to investigate.
  investigateTime: 2.2,
};

export const CAMERA = {
  viewRange: 270,
  viewHalfAngle: 0.5,
  alarmRate: 20,
};

export const ALARM = {
  // Alarm decay per second while nobody can see the thief.
  decay: 9,
  // At this level the nearest guard leaves its patrol to investigate.
  investigateAt: 55,
  // At this level the heist is blown.
  bustedAt: 100,
};

export const VAULT = {
  // Seconds stood beside the vault to crack it open.
  crackSeconds: 1.6,
  // How close the thief must stand to crack it.
  crackRadius: 80,
  score: 500,
};

export const LOOT = { sideScore: 100, pickupRadius: 30 };

export const COINS = { perLevel: 3, throwRange: 340, hearRadius: 280 };

export const SCORE = {
  stealthBonus: 150, // finished a level with the alarm never passing 30
  stealthCeiling: 30,
  timeBonusBase: 900,
  timeBonusPerSecond: 5,
};

export const PALETTE = {
  backdrop: '#0b0d16',
  floorA: '#171a26',
  floorB: '#1c2030',
  floorLine: '#232839',
  wall: '#2e3350',
  wallTrim: '#c9a227',
  crate: '#3a2f22',
  crateEdge: '#6b5433',
  displayCase: '#27354d',
  caseGlass: '#4d6f8e',
  pillar: '#3d3a4a',
  vault: '#4a4030',
  vaultDoor: '#c9a227',
  vaultGlow: '#ffd75e',
  exit: '#1f7a4d',
  exitGlow: '#39d98a',
  thief: '#e8e6df',
  thiefCloak: '#23232e',
  thiefSneak: '#9aa0b5',
  guard: '#b03030',
  guardSuit: '#3a2026',
  guardAlert: '#ff2e2e',
  cone: 'rgba(255, 214, 92, 0.16)',
  coneEdge: 'rgba(255, 214, 92, 0.45)',
  coneAlert: 'rgba(255, 46, 46, 0.20)',
  coneAlertEdge: 'rgba(255, 46, 46, 0.55)',
  cameraCone: 'rgba(255, 140, 66, 0.14)',
  cameraConeEdge: 'rgba(255, 140, 66, 0.45)',
  camera: '#ff8c42',
  loot: '#ffd75e',
  coin: '#e8c15a',
  panel: '#141724',
  panelEdge: '#c9a227',
  text: '#eef1f5',
  muted: '#9aa0b5',
  alarmLow: '#39d98a',
  alarmMid: '#ffd75e',
  alarmHigh: '#ff2e2e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'velvet-vault.best';

// One blocker: { x, y, w, h, kind } — kind is 'crate' | 'case' | 'pillar' | 'wall'.
// Blockers stop the thief and the guards, and block every line of sight.
function blocker(x, y, w, h, kind) {
  return { x, y, w, h, kind };
}

export const LEVELS = [
  {
    name: 'Heist 1 · The Gallery',
    briefing: 'Lift the Star of Merdeka from the gallery vault, then slip out the green door.',
    thiefStart: { x: 110, y: 640 },
    vault: { x: 590, y: 84, w: 100, h: 56 },
    exit: { x: 590, y: 668, w: 100, h: 28 },
    blockers: [
      blocker(300, 200, 120, 70, 'case'),
      blocker(860, 200, 120, 70, 'case'),
      blocker(300, 430, 120, 70, 'case'),
      blocker(860, 430, 120, 70, 'case'),
      blocker(620, 330, 40, 40, 'pillar'),
    ],
    sideLoot: [
      { x: 92, y: 360, label: 'Portrait' },
      { x: 1188, y: 360, label: 'Gold bar' },
    ],
    guards: [
      // The top patrol dips around the vault instead of walking into it:
      // the vault is solid, so a straight lane would pin the guard against
      // its side for the whole heist.
      { path: [[200, 120], [520, 120], [520, 180], [760, 180], [760, 120], [1080, 120]], speed: 72 },
      { path: [[980, 560], [420, 560]], speed: 72 },
    ],
    cameras: [
      { x: 640, y: 26, baseAngle: Math.PI / 2, sweep: 0.6, sweepSpeed: 0.45 },
    ],
  },
  {
    name: 'Heist 2 · The Vault',
    briefing: 'Two cameras now, three guards, and a vault that takes longer to crack. Bring coins.',
    thiefStart: { x: 110, y: 640 },
    vault: { x: 590, y: 84, w: 100, h: 56 },
    exit: { x: 590, y: 668, w: 100, h: 28 },
    blockers: [
      blocker(220, 180, 110, 60, 'crate'),
      blocker(950, 180, 110, 60, 'crate'),
      blocker(220, 460, 110, 60, 'crate'),
      blocker(950, 460, 110, 60, 'crate'),
      blocker(560, 300, 60, 60, 'pillar'),
      blocker(660, 300, 60, 60, 'pillar'),
      blocker(420, 320, 90, 44, 'case'),
      blocker(770, 320, 90, 44, 'case'),
    ],
    sideLoot: [
      { x: 92, y: 200, label: 'Jade vase' },
      { x: 1188, y: 200, label: 'Gold bar' },
      { x: 640, y: 520, label: 'Emerald' },
    ],
    guards: [
      // Top patrol dips around the vault; the middle patrol dips below the
      // two display cases, which sit on its lane; the vertical patrol runs
      // at x=750 so it clears the case corner instead of sliding on it.
      { path: [[180, 130], [520, 130], [520, 180], [760, 180], [760, 130], [1100, 130]], speed: 82 },
      { path: [[1100, 360], [900, 360], [900, 420], [380, 420], [380, 360], [180, 360]], speed: 82 },
      { path: [[750, 540], [750, 220]], speed: 76 },
    ],
    cameras: [
      { x: 90, y: 26, baseAngle: Math.PI / 2, sweep: 0.7, sweepSpeed: 0.55 },
      { x: 1254, y: 360, baseAngle: Math.PI, sweep: 0.7, sweepSpeed: 0.5 },
    ],
  },
  {
    name: 'Heist 3 · The Penthouse',
    briefing: 'Four guards, three cameras, no patience. Crack the vault, grab the Crown Jewel, vanish.',
    thiefStart: { x: 110, y: 640 },
    vault: { x: 590, y: 84, w: 100, h: 56 },
    exit: { x: 590, y: 668, w: 100, h: 28 },
    blockers: [
      blocker(180, 170, 100, 56, 'crate'),
      blocker(1000, 170, 100, 56, 'crate'),
      blocker(180, 480, 100, 56, 'crate'),
      blocker(1000, 480, 100, 56, 'crate'),
      blocker(420, 250, 80, 80, 'pillar'),
      blocker(780, 250, 80, 80, 'pillar'),
      blocker(420, 420, 80, 80, 'pillar'),
      blocker(780, 420, 80, 80, 'pillar'),
      blocker(590, 330, 100, 44, 'case'),
    ],
    sideLoot: [
      { x: 92, y: 360, label: 'Crown Jewel' },
      { x: 1188, y: 360, label: 'Gold bar' },
      { x: 640, y: 180, label: 'Ruby' },
    ],
    guards: [
      // Top patrol dips around the vault; the middle patrol dips below the
      // centre case, which sits on its lane.
      { path: [[170, 130], [520, 130], [520, 190], [760, 190], [760, 130], [1110, 130]], speed: 92 },
      { path: [[980, 560], [420, 560]], speed: 92 },
      { path: [[300, 360], [520, 360], [520, 440], [760, 440], [760, 360], [980, 360]], speed: 86 },
      { path: [[760, 540], [760, 210]], speed: 86 },
    ],
    cameras: [
      { x: 640, y: 26, baseAngle: Math.PI / 2, sweep: 0.8, sweepSpeed: 0.65 },
      { x: 26, y: 360, baseAngle: 0, sweep: 0.7, sweepSpeed: 0.55 },
      { x: 1254, y: 360, baseAngle: Math.PI, sweep: 0.7, sweepSpeed: 0.55 },
    ],
  },
];
