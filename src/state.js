// src/state.js
// A single source of truth for the entire game's live data.

import { Player } from './entities/Player.js';
import { DIFFICULTY_SETTINGS, PLAYER_RESPAWN_INVINCIBILITY, NEON_CYAN, NEON_LIME } from './constants.js';

// The main state object. Everything that changes during gameplay goes in here.
export const gameState = {
    // --- Core State ---
    status: 'menu', // 'menu', 'playing', 'gameOver', 'enteringScore'
    totalScore: 0,
    level: 0,
    highScoreToSubmit: 0,
    lastCorvetteSpawnScore: 0,
    lastCruiserSpawnScore: 0,
    lastMinelayerSpawnScore: 0,
    lastAceSpawnScore: 0,
    level8LifeAwarded: false,

    // --- Player State (Now an array) ---
    players: [],

    // --- Entity Arrays ---
    bullets: [],
    asteroids: [],
    missilePickups: [],
    missiles: [],
    powerUps: [],
    bombs: [],
    mines: [],
    enemies: [], // A single array for ALL enemy types
    enemyBullets: [],
    enemyMissiles: [],
    enemyRockets: [],

    // --- FX & Background Arrays ---
    particles: [],
    smokeParticles: [],
    shockwaves: [],
    menuAsteroids: [],

    // --- Timers & Settings ---
    enemySpawnTimer: 0,
    shakeDuration: 0,
    shakeMagnitude: 0,
    currentDifficulty: 'normal',
    currentControlScheme: 'default',
    shieldMode: 'regenerate',
    gameMode: 'singlePlayer',
    twoPlayerMode: 'coop',
    musicVolume: 0.4, // Moved from audio.js
    sfxVolume: 1.0,   // Moved from audio.js
    
    // --- Input & UI State ---
    keys: {},
    activeGamepads: {}, // Store all active gamepads by index
    gamepadButtonsPressed: {},
    initialEntryState: {
        initials: ['A', 'A', 'A'],
        activeIndex: 0
    },
    alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
};

// Resets the state for a new game.
export function resetGameState() {
    const settings = DIFFICULTY_SETTINGS[gameState.currentDifficulty];

    gameState.status = 'playing';
    gameState.totalScore = 0;
    gameState.level = 1;
    gameState.lastCorvetteSpawnScore = 0;
    gameState.lastCruiserSpawnScore = 0;
    gameState.lastMinelayerSpawnScore = 0;
    gameState.lastAceSpawnScore = 0;
    gameState.level8LifeAwarded = false;

    gameState.gamepadButtonsPressed = {};

    gameState.players = [];
    // THE FIX: Use the reliably-populated activeGamepads object instead of polling the navigator directly.
    // This avoids the race condition on page load.
    const gamepadIndices = Object.keys(gameState.activeGamepads).map(Number).sort();

    if (gameState.gameMode === 'singlePlayer') {
        let p1_inputConfig;
        // In 1P mode, if a gamepad is present, we assign BOTH keyboard and gamepad.
        if (gamepadIndices.length > 0) {
            p1_inputConfig = { type: 'keyboard_and_gamepad', index: gamepadIndices[0] };
            console.log("Assigning Keyboard 1 and Gamepad 0 to Player 1");
        } else {
            p1_inputConfig = { type: 'keyboard1' };
             console.log("Assigning Keyboard 1 to Player 1");
        }
        gameState.players.push(new Player(0, p1_inputConfig, 1, NEON_CYAN));
    } else { // twoPlayer mode
        let p1_inputConfig, p2_inputConfig;

        if (gamepadIndices.length >= 2) {
            p1_inputConfig = { type: 'gamepad', index: gamepadIndices[0] };
            p2_inputConfig = { type: 'gamepad', index: gamepadIndices[1] };
            console.log("Assigning Gamepad 0 to P1, Gamepad 1 to P2");
        } else if (gamepadIndices.length === 1) {
            p1_inputConfig = { type: 'gamepad', index: gamepadIndices[0] };
            p2_inputConfig = { type: 'keyboard2' };
            console.log("Assigning Gamepad 0 to P1, Keyboard 2 to P2");
        } else {
            p1_inputConfig = { type: 'keyboard1' };
            p2_inputConfig = { type: 'keyboard2' };
            console.log("Assigning Keyboard 1 to P1, Keyboard 2 to P2");
        }
        
        gameState.players.push(new Player(0, p1_inputConfig, 1, NEON_CYAN));
        gameState.players.push(new Player(1, p2_inputConfig, 2, NEON_LIME));
    }
    
    // Reset all entity arrays
    gameState.bullets = [];
    gameState.asteroids = [];
    gameState.missilePickups = [];
    gameState.missiles = [];
    gameState.powerUps = [];
    gameState.bombs = [];
    gameState.mines = [];
    gameState.enemies = [];
    gameState.enemyBullets = [];
    gameState.enemyMissiles = [];
    gameState.enemyRockets = [];
    gameState.particles = [];
    gameState.smokeParticles = [];
    gameState.shockwaves = [];

    gameState.enemySpawnTimer = settings.enemySpawnTimeInitial;
}