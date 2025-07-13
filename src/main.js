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
import assetManager from './systems/AssetManager.js';

// --- GLOBALS FOR CLEAN SHUTDOWN ---
let animationFrameId = null;
let keydownListener = null;
let keyupListener = null;

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
        document.getElementById('return-to-menu-btn').addEventListener('click', () => {
            destroy();
            window.location.href = 'index.html';
        }, { once: true });
    }
}

export function submitHighScore() {
    const finalInitials = gameState.initialEntryState.initials.join('');
    addHighScore(finalInitials, gameState.highScoreToSubmit);
    
    destroy();
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

            checkCollisions({ handlePlayerDeath, detonateMine });

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
            renderGame(gameState, ctx);
            handleGameOverInput();
            break;
        
        case 'enteringScore':
            renderGame(gameState, ctx);
            handleInitialEntryInput();
            break;
    }

    animationFrameId = requestAnimationFrame(gameLoop);
}

// --- CLEAN SHUTDOWN ---
export function destroy() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        console.log('Game loop stopped.');
    }

    if (keydownListener) window.removeEventListener('keydown', keydownListener);
    if (keyupListener) window.removeEventListener('keyup', keyupListener);

    console.log('Game instance destroyed.');
}

function onResize() {
    setCanvasSize(canvas);
}

function onFirstClick() {
    initAudioOnFirstInteraction();
}
function onFirstKey() {
    initAudioOnFirstInteraction();
}

// --- INITIALIZATION ---
function loadGame() {
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

    setCanvasSize(canvas);

    assetManager.loadAll().then(() => {
        console.log("All game assets loaded successfully!");
        
        ({ keydownListener, keyupListener } = setupGameEventListeners(init));
        initAudio();

        const audioCtx = window.audioContext;
        if (audioCtx && audioCtx.state === 'suspended') {
            const showOverlay = () => {
                const overlay = document.createElement('div');
                overlay.id = 'audio-overlay';
                overlay.style.cssText = `
                    position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
                    background:rgba(13,2,26,0.9); color:#00ffff; font-family:Orbitron,sans-serif;
                    z-index:9999; font-size:2em; text-shadow:0 0 10px #00ffff;
                    cursor:pointer;
                `;
                overlay.textContent = 'Tap or press any key to start audio';
                overlay.addEventListener('click', () => {
                    overlay.remove();
                    initAudioOnFirstInteraction();
                }, { once: true });
                overlay.addEventListener('keydown', (e) => {
                    overlay.remove();
                    initAudioOnFirstInteraction();
                }, { once: true });
                document.body.appendChild(overlay);
            };
            showOverlay();
        }

        init();
        requestAnimationFrame(gameLoop);

    }).catch(error => {
        console.error("Failed to load game assets:", error);
        ctx.fillStyle = '#ff0000';
        ctx.font = "24px 'Orbitron', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText("Error: Failed to load game assets.", canvas.width / 2, canvas.height / 2);
        ctx.fillText("Please refresh the page to try again.", canvas.width / 2, canvas.height / 2 + 30);
    });
}

// Only run the game initialization if we are on the game page.
if (document.getElementById('gameCanvas')) {
    loadGame();
}