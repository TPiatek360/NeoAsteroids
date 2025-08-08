// src/state/resetGameState.js
import { gameState } from './gameState.js';
import { Player } from '../entities/Player.js';
import { DIFFICULTY_SETTINGS } from '../constants.js';

/**
 * A helper function to poll for gamepads that were already connected
 * when the page loaded. The 'gamepadconnected' event doesn't fire for these.
 */
function pollForPreConnectedGamepads() {
  const gamepads = navigator.getGamepads();
  for (const gp of gamepads) {
    if (gp) {
      // Only add it if it's not already tracked from a 'gamepadconnected' event
      if (!gameState.activeGamepads[gp.index]) {
        console.log('Found pre-connected gamepad:', gp.id, 'index', gp.index);
        gameState.activeGamepads[gp.index] = gp;
      }
    }
  }
}

export function resetGameState() {
  // FIX: Manually check for existing gamepads before setting up players.
  pollForPreConnectedGamepads();

  const settings = DIFFICULTY_SETTINGS[gameState.currentDifficulty];

  // --- Core reset
  gameState.status               = 'playing';
  gameState.totalScore           = 0;
  // In an arcade game, level always starts at 1. In campaign, it's loaded from save data.
  if (gameState.gameType !== 'campaign') {
    gameState.level              = 1;
  }
  gameState.levelScale           = Math.pow(1.05, gameState.level - 1);
  gameState.lastCorvetteSpawnScore = 0;
  gameState.lastCruiserSpawnScore  = 0;
  gameState.lastMinelayerSpawnScore = 0;
  gameState.lastAceSpawnScore      = 0;
  gameState.level8LifeAwarded    = false;

  // --- Input caches
  gameState.gamepadButtonsPressed = {};

  // --- Build player array based on playerCount
  gameState.players.length = 0; // clear old refs

  // IMPORTANT: build the gamepad index list AFTER polling
  const gamepadIndices = Object.keys(gameState.activeGamepads)
                               .map(Number)
                               .sort((a, b) => a - b);

  if (gameState.playerCount === 1) {
    const cfg = gamepadIndices.length > 0
      ? { type: 'keyboard_and_gamepad', index: gamepadIndices[0] }
      : { type: 'keyboard1' };
    gameState.players.push(new Player(0, cfg, 1, '#00ffff'));
  } else { // playerCount is 2
    let p1cfg, p2cfg;
    if (gamepadIndices.length >= 2) {
      p1cfg = { type: 'gamepad', index: gamepadIndices[0] };
      p2cfg = { type: 'gamepad', index: gamepadIndices[1] };
    } else if (gamepadIndices.length === 1) {
      p1cfg = { type: 'gamepad', index: gamepadIndices[0] };
      p2cfg = { type: 'keyboard2' };
    } else {
      p1cfg = { type: 'keyboard1' };
      p2cfg = { type: 'keyboard2' };
    }
    gameState.players.push(new Player(0, p1cfg, 1, '#00ffff'));
    gameState.players.push(new Player(1, p2cfg, 2, '#7fff00'));
  }

  // NEW: Add console logging to confirm initial controller assignment
  gameState.players.forEach(p => {
    if (p.inputConfig.type.includes('gamepad')) {
        console.log(`Player ${p.playerNum} initialized with Gamepad ${p.inputConfig.index}.`);
    } else {
        console.log(`Player ${p.playerNum} initialized with Keyboard (${p.inputConfig.type}).`);
    }
  });

  // --- Clear all entity arrays
  [
    'bullets', 'asteroids', 'missilePickups', 'missiles', 'powerUps',
    'bombs', 'mines', 'enemies', 'allies', 'enemyBullets', 'enemyMissiles',
    'enemyRockets', 'particles', 'smokeParticles', 'shockwaves'
  ].forEach(key => (gameState[key].length = 0));

  gameState.enemySpawnTimer = settings.enemySpawnTimeInitial;
}