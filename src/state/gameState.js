// src/state/gameState.js
// Pure data, no logic.

import { Player } from '../entities/Player.js';
import { DIFFICULTY_SETTINGS } from '../constants.js';

export const gameState = {
  // --- Core game flow
  status: 'menu',               // 'menu' | 'playing' | 'gameOver' | 'enteringScore' | 'hangar'
  totalScore: 0,
  level: 0,
  levelScale: 1,
  highScoreToSubmit: 0,

  // --- Score gates for enemy spawning
  lastCorvetteSpawnScore: 0,
  lastCruiserSpawnScore: 0,
  lastMinelayerSpawnScore: 0,
  lastAceSpawnScore: 0,
  level8LifeAwarded: false,

  // --- Entity buckets
  players: [],
  bullets: [],
  asteroids: [],
  planetoids: [],
  missilePickups: [],
  missiles: [],
  powerUps: [],
  bombs: [],
  mines: [],
  enemies: [],
  allies: [], 
  enemyBullets: [],
  enemyMissiles: [],
  enemyRockets: [],

  // --- FX / background
  particles: [],
  smokeParticles: [],
  shockwaves: [],
  capitalExplosions: [], // NEW
  damageSmoke: [],       // NEW
  sparks: [],            // NEW
  ionEffects: [],        // NEW
  menuAsteroids: [],
  starfield: [],

  // --- Settings & tunables
  enemySpawnTimer: 0,
  shakeDuration: 0,
  shakeMagnitude: 0,
  
  // --- Menu Settings ---
  currentDifficulty: 'normal',
  currentControlScheme: 'default',
  flightModel: 'arcade', // 'arcade' or 'newtonian'
  shieldMode: 'regenerate',
  gameType: 'modern', // 'classic', 'modern', 'campaign'
  playerCount: 1, // 1 or 2
  twoPlayerMode: 'coop', // 'coop' or 'vs'
  enemyFireEffect: 'passes', // 'blocked', 'destroys'
  colorMode: 'color', // 'color', 'bw', 'green', 'amber'
  shaders: {
      crt: false,
      scanlines: 0.2,
      bloom: 0,
      curvature: 0.03,
      filmGrain: false,
      jitter: false,
      starfield: true,
      monoBrightness: 1.0,
      persistence: 0,
  },
  musicVolume: 0.4,
  sfxVolume: 1.0,

  // --- Input & UI
  keys: {},
  activeGamepads: {},
  gamepadButtonsPressed: {},
  menuInputMode: 'navigate', // 'navigate' or 'editSlider'
  mutators: {}, // ADDED: Will hold flags and descriptions for the daily run.
  initialEntryState: {
    initials: ['A', 'A', 'A'],
    activeIndex: 0,
  },
  alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
};