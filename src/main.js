// src/main.js
// The main game engine. Contains the game loop, state management, and core logic.

import { gameState, resetGameState } from './state.js';
import {
    canvas, ctx, showInGameUI, showGameOverUI, setupChargeBarSegments, updateGameUI,
    updateChargeBar, checkIfHighScore, showInitialEntryScreen,
    updateInitialEntryUI, addHighScore, hideInitialEntryScreen
} from './ui/ui.js';
import { setCanvasSize, distBetweenPoints } from './utils.js';
import { setupGameEventListeners, updatePlayers, handleInitialEntryInput, handleGameOverInput } from './ui/input.js';
import { createExplosion, triggerRumble, triggerScreenShake } from './fx/effects.js';
import { createShockwave } from './fx/shockwave.js';
import { createAsteroidBelt, handleLevelEnd, destroyAsteroid } from './entities/environment.js';
import { renderGame } from './systems/RenderSystem.js';
import { checkCollisions } from './systems/CollisionSystem.js';
import { updateSpawning } from './systems/SpawnSystem.js';
import {
    initAudio, startGameMusic, startMenuMusic, stopThrustSound, stopChargeSound,
    updateChargeSoundPitch, playChargeLevelUpSound, playDeathSound, playExplosionSound,
    isThrustSoundActive
} from './audio/audio.js';
import {
    PLAYER_RESPAWN_INVINCIBILITY,
    NEON_RED,
    MINE_BLAST_RADIUS,
    MINE_DAMAGE
} from './constants.js';

// --- GAME LOGIC ---
function init() {
    resetGameState();
    startGameMusic();
    showInGameUI();
    updateGameUI();
    setupChargeBarSegments();
    if (gameState.gameMode !== 'twoPlayer' || gameState.twoPlayerMode !== 'vs') {
        createAsteroidBelt();
    }
}

export function handlePlayerDeath(player) {
    if (!player || player.lives <= 0) return;

    player.hitFlashTimer = 30;
    triggerScreenShake(10, 30);
    triggerRumble(0.8, 0.5, 300);
    player.lives--;
    
    if (gameState.gameMode === 'twoPlayer' && gameState.twoPlayerMode === 'vs') {
        const otherPlayer = gameState.players.find(p => p.id !== player.id);
        if (otherPlayer) {
            otherPlayer.score += 1000;
        }
    }

    updateGameUI();
    
    if (player.lives <= 0) {
        checkGameOver();
    } else {
        player.invincibilityFrames = PLAYER_RESPAWN_INVINCIBILITY;
    }
    createExplosion(player.x, player.y, player.color, 50, 4);
    createShockwave(player.x, player.y, 200, player.color, 8, 3);
    playDeathSound();
}

function checkGameOver() {
    const livingPlayers = gameState.players.filter(p => p.lives > 0).length;

    if (livingPlayers === 0) {
        gameOver();
    }
    else if (gameState.gameMode === 'twoPlayer' && gameState.twoPlayerMode === 'vs' && livingPlayers === 1) {
        gameOver();
    }
}

function gameOver() {
    gameState.status = 'gameOver';
    startMenuMusic(); // Play menu music on game over screen
    if (isThrustSoundActive()) stopThrustSound();
    
    gameState.players.forEach(p => {
        if (p.isChargingMissile) stopChargeSound();
        p.isChargingMissile = false;
    });
    
    // Clear only things that shouldn't persist on the Game Over screen
    gameState.enemies = [];
    gameState.enemyMissiles = [];
    gameState.enemyRockets = [];
    gameState.missiles = [];
    gameState.bullets = [];

    gameState.totalScore = gameState.players.reduce((sum, p) => sum + p.score, 0);

    if (checkIfHighScore(gameState.totalScore)) {
        gameState.status = 'enteringScore';
        gameState.highScoreToSubmit = gameState.totalScore;
        showInitialEntryScreen();
    } else {
        showGameOverUI();
    }
}

export function submitHighScore() {
    // Save the score
    const finalInitials = gameState.initialEntryState.initials.join('');
    addHighScore(finalInitials, gameState.highScoreToSubmit);
    
    // THE FIX: Immediately return to the main menu.
    window.location.href = 'index.html';
}

export function detonateMine(index) {
    const mine = gameState.mines[index];
    if (!mine) return;

    triggerScreenShake(15, 20);
    triggerRumble(0.7, 0.7, 250);
    playExplosionSound(0.6, 0.4, 1800, 120);
    createExplosion(mine.x, mine.y, NEON_RED, 30, 3);
    createShockwave(mine.x, mine.y, MINE_BLAST_RADIUS * 1.5, NEON_RED, 7, 2);
    
    for(const player of gameState.players) {
        if (player.lives > 0 && distBetweenPoints(player.x, player.y, mine.x, mine.y) < player.r + MINE_BLAST_RADIUS) {
            if (!player.shieldActive && player.invincibilityFrames <= 0) {
                 if (gameState.gameMode === 'twoPlayer' && gameState.twoPlayerMode === 'vs' && mine.ownerId === player.id) {
                 } else {
                    handlePlayerDeath(player);
                 }
            }
        }
    }

    for (let i = gameState.asteroids.length - 1; i >= 0; i--) {
        const a = gameState.asteroids[i];
        if (distBetweenPoints(a.x, a.y, mine.x, mine.y) < a.r + MINE_BLAST_RADIUS) {
            destroyAsteroid(i, true, -1);
        }
    }
    
    for(const enemy of gameState.enemies) {
        if (enemy.takeDamage) {
             enemy.takeDamage(MINE_DAMAGE, mine.x, mine.y, true, -1);
        }
    }

    gameState.mines.splice(index, 1);
}

// --- THE GAME LOOP ---
let lastFrameTime = performance.now();
function gameLoop(currentTime) {
    const deltaTime = (currentTime - lastFrameTime);
    lastFrameTime = currentTime;

    switch (gameState.status) {
        case 'playing':
            updatePlayers(deltaTime);

            const allOtherEntities = [
                ...gameState.bullets, ...gameState.enemyBullets, ...gameState.missiles,
                ...gameState.enemyMissiles, ...gameState.enemyRockets, ...gameState.smokeParticles,
                ...gameState.missilePickups, ...gameState.powerUps, ...gameState.particles,
                ...gameState.bombs, ...gameState.mines, ...gameState.asteroids, ...gameState.enemies,
                ...gameState.shockwaves
            ];
            allOtherEntities.forEach(item => { if (item?.update) item.update(deltaTime); });

            if (gameState.gameMode !== 'twoPlayer' || gameState.twoPlayerMode !== 'vs') {
                updateSpawning(gameState, deltaTime);
                handleLevelEnd();
            }

            checkCollisions();

            gameState.bullets = gameState.bullets.filter(b => b.x > -5 && b.x < canvas.width + 5 && b.y > -5 && b.y < canvas.height + 5);
            gameState.enemyBullets = gameState.enemyBullets.filter(b => b.x > -5 && b.x < canvas.width + 5 && b.y > -5 && b.y < canvas.height + 5);
            gameState.missiles = gameState.missiles.filter(m => m.life > 0);
            gameState.enemyMissiles = gameState.enemyMissiles.filter(m => m.life > 0);
            gameState.smokeParticles = gameState.smokeParticles.filter(s => s.life > 0);
            gameState.missilePickups = gameState.missilePickups.filter(p => p.life > 0);
            gameState.powerUps = gameState.powerUps.filter(p => p.life > 0);
            gameState.enemyRockets = gameState.enemyRockets.filter(r => r.x > -50 && r.x < canvas.width + 50 && r.y > -50 && r.y < canvas.height + 50);
            gameState.particles = gameState.particles.filter(p => p.life > 0);
            gameState.mines = gameState.mines.filter(m => m.life > 0);
            gameState.enemies = gameState.enemies.filter(e => !e.isDead);
            gameState.shockwaves = gameState.shockwaves.filter(s => s.life > 0);

            renderGame(gameState, ctx);
            updateGameUI();
            break;

        case 'gameOver':
            // Game is paused, render is static
            renderGame(gameState, ctx);
            // Handle gamepad input for the "Return to Menu" button
            handleGameOverInput();
            break;
        
        case 'enteringScore':
            // Can have a background render if desired
            renderGame(gameState, ctx);
            handleInitialEntryInput(); // Handles keyboard/gamepad for initials
            break;
    }

    requestAnimationFrame(gameLoop);
}

// --- INITIALIZATION ---
function loadGame() {
    // Load settings from sessionStorage
    const settingsJSON = sessionStorage.getItem('gameSettings');
    if (!settingsJSON) {
        // If no settings, they came here directly. Send them back to the menu.
        window.location.href = 'index.html';
        return;
    }
    const settings = JSON.parse(settingsJSON);

    // Apply settings to gameState
    gameState.currentDifficulty = settings.difficulty;
    gameState.gameMode = settings.gameMode;
    gameState.twoPlayerMode = settings.twoPlayerMode;
    gameState.currentControlScheme = settings.controlScheme;
    gameState.shieldMode = settings.shieldMode;

    setCanvasSize(canvas);
    setupGameEventListeners(init); // Pass init to be called after first user interaction
    initAudio(); // Initialize audio context immediately
    init(); // Start the game
    
    requestAnimationFrame(gameLoop);
}

// Only run the game initialization if we are on the game page.
// This prevents the redirect loop caused by circular dependencies.
if (document.getElementById('gameCanvas')) {
    loadGame();
}