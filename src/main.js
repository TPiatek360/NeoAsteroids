// src/main.js
// The main game engine. Contains the game loop, state management, and core logic.

import { gameState, resetGameState, createPlayers } from './state.js';
import { canvas, ctx, showInGameUI, showGameOverUI, showInitialEntryScreen, showPauseScreen, hidePauseScreen, updateInitialEntryUI } from './ui/ui.js';
import { updateGameUI, updateChargeBar, setupChargeBarSegments } from './ui/hud.js';
import { addHighScore, checkIfHighScore } from './systems/HighScoreManager.js';
import { setCanvasSize, distBetweenPoints } from './utils.js';
import { updatePlayers, handleInitialEntryInput, handleGameOverInput, handlePauseInput, handleInitialEntryKeyboard } from './ui/input.js';
import { createExplosion, triggerRumble, triggerScreenShake } from './fx/effects.js';
import { createShockwave } from './fx/shockwave.js';
import { createAsteroidBelt, handleLevelEnd, destroyAsteroid, Asteroid } from './entities/environment.js';
import { renderGame } from './systems/RenderSystem.js';
import { checkCollisions } from './systems/CollisionSystem.js';
import { updateSpawning } from './systems/SpawnSystem.js';
import { initScoringSystem } from './systems/ScoringSystem.js';
import { initDevConsole, isDevConsoleFocused, loseFocus as loseDevConsoleFocus } from './systems/DevConsole.js';
import { eventBus } from './systems/EventBus.js';
import {
    initAudio, startGameMusic, startMenuMusic, stopThrustSound, stopChargeSound,
    playDeathSound, playExplosionSound, isThrustSoundActive, setMusicMuted,
    playBombDropSound, isAudioInitialized, getAudioContext, playMissileLaunchSound,
    stopShieldHumSound
} from './audio/audio.js';
import { PLAYER_RESPAWN_INVINCIBILITY, NEON_RED, MINE_BLAST_RADIUS, MINE_DAMAGE, NEON_PINK, NEON_ORANGE } from './constants.js';
import { EnemyShip, Corvette, Cruiser, Minelayer, Ace } from './entities/enemies.js';

// --- GAME LOGIC ---
function init() {
    resetGameState();
    startGameMusic();
    showInGameUI();
    updateGameUI();
    setupChargeBarSegments();
    initScoringSystem();
    setupEventListeners();

    if (gameState.gameMode !== 'twoPlayer' || gameState.twoPlayerMode !== 'vs') {
        createAsteroidBelt();
    }
}

export function pauseGame() {
    if (gameState.status !== 'playing') return;
    gameState.status = 'paused';
    stopThrustSound();
    gameState.players.forEach(p => { if (p.activeShieldHum) stopShieldHumSound(p.activeShieldHum, 0.1); });
    setMusicMuted(true);
    showPauseScreen();
}

export function resumeGame() {
    if (gameState.status !== 'paused') return;
    gameState.status = 'playing';
    lastFrameTime = performance.now(); // Reset delta time
    loseDevConsoleFocus(); // Ensure console focus is lost when resuming
    setMusicMuted(false);
    hidePauseScreen();
}

function setupEventListeners() {
    // These listeners are set once the game starts
    gameState.keys = {
        'ArrowUp': false, 'ArrowLeft': false, 'ArrowRight': false, ' ': false, 'm': false, 'b': false, 'ShiftRight': false,
        'w': false, 'a': false, 'd': false, 'Tab': false, 'g': false, 'f': false, 'ShiftLeft': false, 'p': false,
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
}

function removeEventListeners() {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
}

function handleKeyDown(e) {
    // The master check to block all game input if the console is focused
    if (isDevConsoleFocused()) return;

    const key = e.key;
    const p1 = gameState.players.find(p => p.inputConfig.type === 'keyboard1' || p.inputConfig.type === 'keyboard_and_gamepad');
    const p2 = gameState.players.find(p => p.inputConfig.type === 'keyboard2');

    if (gameState.status === 'playing' && key.toLowerCase() === 'p' && gameState.allowPause) {
        pauseGame();
        e.preventDefault();
        return;
    }
    if (gameState.status === 'paused' && key.toLowerCase() === 'p') {
        resumeGame();
        e.preventDefault();
        return;
    }
    if (gameState.status === 'enteringScore') {
        if (handleInitialEntryKeyboard(e) === 'submit') {
            submitHighScore();
        }
        return;
    }
    if (gameState.status !== 'playing') return;

    if (gameState.keys.hasOwnProperty(key)) gameState.keys[key] = true;
    if (e.code === 'Space') gameState.keys[' '] = true;
    if (e.code === 'ShiftRight') gameState.keys['ShiftRight'] = true;
    if (e.code === 'ShiftLeft') gameState.keys['ShiftLeft'] = true;

    if (!e.repeat) {
        if (p1 && key.toLowerCase() === 'm') p1.wantsToChargeMissile = true;
        if (p2 && key.toLowerCase() === 'g') p2.wantsToChargeMissile = true;

        if (p1 && e.code === 'Space') p1.wantsToShoot = true;
        if (p2 && e.key === 'Tab') p2.wantsToShoot = true;

        if (p1 && key.toLowerCase() === 'b') p1.wantsToDropBomb = true;
        if (p2 && key.toLowerCase() === 'f') p2.wantsToDropBomb = true;
    }
    if (e.key !== 'F5' && e.key !== 'F12' && !(e.ctrlKey && e.key.toLowerCase() === 'q')) {
        e.preventDefault();
    }
}

function handleKeyUp(e) {
    // The master check to block all game input if the console is focused
    if (isDevConsoleFocused()) return;
    
    if (gameState.status !== 'playing') return;
    const key = e.key;
    const p1 = gameState.players.find(p => p.inputConfig.type === 'keyboard1' || p.inputConfig.type === 'keyboard_and_gamepad');
    const p2 = gameState.players.find(p => p.inputConfig.type === 'keyboard2');

    if (gameState.keys.hasOwnProperty(key)) gameState.keys[key] = false;
    if (e.code === 'Space') gameState.keys[' '] = false;
    if (e.code === 'ShiftRight') gameState.keys['ShiftRight'] = false;
    if (e.code === 'ShiftLeft') gameState.keys['ShiftLeft'] = false;

    if (p1 && key.toLowerCase() === 'm') p1.wantsToReleaseMissile = true;
    if (p2 && key.toLowerCase() === 'g') p2.wantsToReleaseMissile = true;
}

function setupInitialEventListeners(initGameCallback) {
    // These listeners are for the very first user interaction to enable audio
    async function initAudioOnFirstInteraction() {
        if (isAudioInitialized() && getAudioContext()?.state === 'running') return;
        try {
            await initAudio();
            initGameCallback();
        } catch (err) {
            console.error("Failed to initialize audio.", err);
        }
        // Remove these listeners after the first interaction
        window.removeEventListener('click', initAudioOnFirstInteraction);
        window.removeEventListener('keydown', initAudioOnFirstInteraction);
    }

    window.addEventListener('click', initAudioOnFirstInteraction, { once: true });
    window.addEventListener('keydown', initAudioOnFirstInteraction, { once: true });

    // General listeners that are always active
    document.getElementById('resume-btn')?.addEventListener('click', resumeGame);
    document.getElementById('quit-btn')?.addEventListener('click', () => window.location.href = 'index.html');
    window.addEventListener('resize', () => setCanvasSize(document.getElementById('gameCanvas')));
}

export function handlePlayerDeath(player) {
    if (!player || player.lives <= 0 || player.isInvulnerable) return;

    player.hitFlashTimer = 30;
    triggerScreenShake(10, 30);
    triggerRumble(0.8, 0.5, 300);
    player.lives--;

    eventBus.dispatch('player_died', { playerNum: player.playerNum, lives: player.lives });

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
    } else if (gameState.gameMode === 'twoPlayer' && gameState.twoPlayerMode === 'vs' && livingPlayers === 1) {
        gameOver();
    }
}

function gameOver() {
    gameState.status = 'gameOver';
    startMenuMusic();
    if (isThrustSoundActive()) stopThrustSound();

    gameState.players.forEach(p => {
        if (p.isChargingMissile) stopChargeSound();
        p.isChargingMissile = false;
        if (p.activeShieldHum) stopShieldHumSound(p.activeShieldHum);
        p.activeShieldHum = null;
    });

    gameState.totalScore = gameState.players.reduce((sum, p) => sum + p.score, 0);

    if (checkIfHighScore(gameState.totalScore)) {
        gameState.status = 'enteringScore';
        gameState.highScoreToSubmit = gameState.totalScore;
        showInitialEntryScreen();
    } else {
        removeEventListeners(); // Remove listeners only if not entering high score
        showGameOverUI();
    }
}

export function submitHighScore() {
    removeEventListeners(); // Remove listeners after input is complete
    const finalInitials = gameState.initialEntryState.initials.join('');
    addHighScore(finalInitials, gameState.highScoreToSubmit);
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

    for (const player of gameState.players) {
        if (player.lives > 0 && !player.isInvulnerable && distBetweenPoints(player.x, player.y, mine.x, mine.y) < player.r + MINE_BLAST_RADIUS) {
            if (!player.shieldActive && player.invincibilityFrames <= 0) {
                if (gameState.gameMode === 'twoPlayer' && gameState.twoPlayerMode === 'vs' && mine.ownerId === player.id) {
                    // No self-damage in VS mode from own mines
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
    for (const enemy of gameState.enemies) {
        if (enemy.takeDamage) {
            enemy.takeDamage(MINE_DAMAGE, mine.x, mine.y, true, -1);
        }
    }

    gameState.mines.splice(index, 1);
}

// --- THE GAME LOOP ---
let lastFrameTime = performance.now();
function gameLoop(currentTime) {
    let command;

    switch (gameState.status) {
        case 'playing':
            if (gameState.players.length === 0) {
                createPlayers();
                updateGameUI(); // Initial UI draw with correct player count
            }

            const deltaTime = (currentTime - lastFrameTime);
            lastFrameTime = currentTime;

            command = updatePlayers(deltaTime);
            if (command === 'pause') pauseGame();
            if (command === 'resume') resumeGame();

            // --- Update all entities ---
            const allEntities = [
                ...gameState.bullets, ...gameState.enemyBullets, ...gameState.missiles,
                ...gameState.enemyMissiles, ...gameState.enemyRockets, ...gameState.smokeParticles,
                ...gameState.missilePickups, ...gameState.powerUps, ...gameState.particles,
                ...gameState.bombs, ...gameState.mines, ...gameState.asteroids, ...gameState.enemies,
                ...gameState.shockwaves
            ];
            allEntities.forEach(item => { if (item?.update) item.update(deltaTime); });

            if (gameState.gameMode !== 'twoPlayer' || gameState.twoPlayerMode !== 'vs') {
                updateSpawning(gameState, deltaTime);
                handleLevelEnd();
            }

            checkCollisions();

            // --- Prune dead/expired entities (Optimized with in-place splice) ---
            for (let i = gameState.bullets.length - 1; i >= 0; i--) {
                const b = gameState.bullets[i];
                if (b.x < -5 || b.x > canvas.width + 5 || b.y < -5 || b.y > canvas.height + 5) {
                    gameState.bullets.splice(i, 1);
                }
            }
            for (let i = gameState.enemyBullets.length - 1; i >= 0; i--) {
                const b = gameState.enemyBullets[i];
                if (b.x < -5 || b.x > canvas.width + 5 || b.y < -5 || b.y > canvas.height + 5) {
                    gameState.enemyBullets.splice(i, 1);
                }
            }
            for (let i = gameState.missiles.length - 1; i >= 0; i--) { if (gameState.missiles[i].life <= 0) gameState.missiles.splice(i, 1); }
            for (let i = gameState.enemyMissiles.length - 1; i >= 0; i--) { if (gameState.enemyMissiles[i].life <= 0) gameState.enemyMissiles.splice(i, 1); }
            for (let i = gameState.smokeParticles.length - 1; i >= 0; i--) { if (gameState.smokeParticles[i].life <= 0) gameState.smokeParticles.splice(i, 1); }
            for (let i = gameState.missilePickups.length - 1; i >= 0; i--) { if (gameState.missilePickups[i].life <= 0) gameState.missilePickups.splice(i, 1); }
            for (let i = gameState.powerUps.length - 1; i >= 0; i--) { if (gameState.powerUps[i].life <= 0) gameState.powerUps.splice(i, 1); }
            for (let i = gameState.enemyRockets.length - 1; i >= 0; i--) {
                const r = gameState.enemyRockets[i];
                if (r.x < -50 || r.x > canvas.width + 50 || r.y < -50 || r.y > canvas.height + 50) {
                    gameState.enemyRockets.splice(i, 1);
                }
            }
            for (let i = gameState.particles.length - 1; i >= 0; i--) { if (gameState.particles[i].life <= 0) gameState.particles.splice(i, 1); }
            for (let i = gameState.mines.length - 1; i >= 0; i--) { if (gameState.mines[i].life <= 0) gameState.mines.splice(i, 1); }
            for (let i = gameState.enemies.length - 1; i >= 0; i--) { if (gameState.enemies[i].isDead) gameState.enemies.splice(i, 1); }
            for (let i = gameState.shockwaves.length - 1; i >= 0; i--) { if (gameState.shockwaves[i].life <= 0) gameState.shockwaves.splice(i, 1); }

            renderGame(gameState, ctx);
            updateGameUI();
            break;

        case 'paused':
            renderGame(gameState, ctx);
            command = handlePauseInput();
            if (command === 'resume') resumeGame();
            else if (command === 'quit') document.getElementById('quit-btn')?.click();
            break;

        case 'gameOver':
            renderGame(gameState, ctx);
            command = handleGameOverInput();
            if (command === 'quit') document.getElementById('return-to-menu-btn')?.click();
            break;

        case 'enteringScore':
            renderGame(gameState, ctx);
            command = handleInitialEntryInput();
            if (command === 'submit') submitHighScore();
            break;
    }

    requestAnimationFrame(gameLoop);
}

function setupGamepadListeners() {
    const gamepads = navigator.getGamepads();
    for (const gamepad of gamepads) {
        if (gamepad) {
            console.log("Found pre-existing gamepad at index %d: %s.", gamepad.index, gamepad.id);
            gameState.activeGamepads[gamepad.index] = gamepad;
        }
    }
    window.addEventListener("gamepadconnected", (e) => {
        console.log("Gamepad connected at index %d: %s.", e.gamepad.index, e.gamepad.id);
        gameState.activeGamepads[e.gamepad.index] = e.gamepad;
    });
    window.addEventListener("gamepaddisconnected", (e) => {
        console.log("Gamepad disconnected from index %d: %s", e.gamepad.index, e.gamepad.id);
        delete gameState.activeGamepads[e.gamepad.index];
    });
}

function setupGlobalEventBusListeners() {
    eventBus.on('asteroid_destroyed', (data) => {
        if (data.destroyedByMissile) {
            triggerRumble(0.3, 0.3, 150);
        } else {
            triggerRumble(0.1, 0.2, 100);
        }
        playExplosionSound(data.destroyedByMissile ? 0.7 : 0.5, data.destroyedByMissile ? 0.6 : 0.4);
        createExplosion(data.x, data.y, NEON_PINK, 10 + Math.floor(data.r / 5), 2.5);
    });

    eventBus.on('enemy_destroyed', (data) => {
        triggerRumble(0.6, 0.3, 200);
        playExplosionSound(0.6, 0.5);
        createExplosion(data.x, data.y, NEON_ORANGE, 30, 3.5);
    });

    eventBus.on('missile_launched', (data) => {
        playMissileLaunchSound(data.pan);
    });

    eventBus.on('dev_console_focused', pauseGame);

    eventBus.on('dev_spawn_entity', ({ type, count }) => {
        for (let i = 0; i < count; i++) {
            switch (type) {
                case 'asteroid':
                    gameState.asteroids.push(new Asteroid());
                    break;
                case 'fighter':
                    gameState.enemies.push(new EnemyShip());
                    break;
                case 'corvette':
                    gameState.enemies.push(new Corvette());
                    break;
                 case 'cruiser':
                    gameState.enemies.push(new Cruiser());
                    break;
                case 'minelayer':
                    gameState.enemies.push(new Minelayer());
                    break;
                case 'ace':
                    gameState.enemies.push(new Ace());
                    break;
            }
        }
    });
}

async function loadGame() {
    const settingsJSON = sessionStorage.getItem('gameSettings');
    if (!settingsJSON) {
        window.location.href = 'index.html';
        return;
    }
    const settings = JSON.parse(settingsJSON);

    gameState.currentDifficulty = settings.difficulty;
    gameState.gameMode = settings.gameMode;
    gameState.twoPlayerMode = settings.twoPlayerMode;
    gameState.currentControlScheme = settings.controlScheme;
    gameState.shieldMode = settings.shieldMode;
    gameState.allowPause = settings.allowPause;
    gameState.enemyFireDestroysAsteroids = settings.enemyFireDestroysAsteroids;

    setCanvasSize(canvas);
    initDevConsole();
    setupGamepadListeners();
    setupInitialEventListeners(init);
    setupGlobalEventBusListeners();

    await initAudio();
    if (getAudioContext()?.state === 'running') {
        init();
    }
    requestAnimationFrame(gameLoop);
}

if (document.getElementById('gameCanvas')) {
    loadGame();
}