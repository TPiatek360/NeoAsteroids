// src/main.js
// The main game engine. Contains the game loop, state management, and core logic.

import { gameState, resetGameState } from './state.js';
import {
    canvas, ctx, showGameOverUI, checkIfHighScore, showInitialEntryScreen,
    updateInitialEntryUI, addHighScore, hideInitialEntryScreen, togglePauseScreen, toggleDevConsole,
    applyVisualSettings, unpauseGame, toggleHangarScreen
} from './ui/ui.js';
import { setCanvasSize, distBetweenPoints } from './utils.js';
import { setupGameEventListeners, updatePlayers, handleInitialEntryInput, handleGameOverInput, handlePauseInput, handleHangarInput } from './ui/input.js';
import { createExplosion, triggerRumble, triggerScreenShake } from './fx/effects.js';
import { createShockwave } from './fx/shockwave.js';
import { createAsteroidBelt, handleLevelEnd, destroyAsteroid, createStarfield } from './entities/environment.js';
import { renderGame, renderBackground, renderStarfield } from './systems/RenderSystem.js';
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
    MINE_DAMAGE,
	GRAVITATIONAL_CONSTANT
} from './constants.js';
import assetManager from './systems/AssetManager.js';
import { saveCampaign, loadCampaign } from './campaign/campaignManager.js';
import missionManager from './campaign/MissionManager.js';
import { MUTATORS } from './campaign/MutatorManager.js';

let animationFrameId = null;
let keydownListener = null;
let keyupListener = null;
let campaignDataForInit = null;
let activeCampaignSlot = null;
let loadingLoopId = null; // NEW: ID for the loading screen's render loop

// --- Launch Sequence Logic ---
let launchSequenceActive = false;
let currentTaskIndex = 0;

const LAUNCH_SEQUENCE_TASKS = [
    { type: 'text', text: 'Initiating launch sequence...' },
    { type: 'delay', duration: 500 },
    { type: 'text', text: '> Accessing main bus...' },
    { type: 'text', text: '> Power routing confirmed.' },
    { type: 'delay', duration: 300 },
    { type: 'progress', text: 'Loading antimatter drive', duration: 1500 },
    { type: 'text', text: '....Drive online.' },
    { type: 'delay', duration: 300 },
    { type: 'progress', text: 'Calibrating navigation', duration: 1200 },
    { type: 'text', text: '....Star charts locked.' },
    { type: 'delay', duration: 300 },
    { type: 'text', text: '> Fitting ordnance...' },
    { type: 'progress', text: 'Loading missile tubes', duration: 1000 },
    { type: 'progress', text: 'Arming plasma cannons', duration: 800 },
    { type: 'text', text: '....Weapons hot.' },
    { type: 'delay', duration: 300 },
    { type: 'progress', text: 'Performing sensor checks', duration: 2000 },
    { type: 'text', text: '....All systems nominal.' },
    { type: 'delay', duration: 500 },
    { type: 'text', text: 'Launch vehicle ready.' },
    { type: 'text', text: 'Awaiting asset compilation...' },
    { type: 'delay', duration: 2000 },
];

function runProgressBar(task, onComplete) {
    const launchLogEl = document.getElementById('launch-log');
    if (!launchLogEl) return;

    const barId = `bar-${Date.now()}`;
    const textId = `text-${Date.now()}`;

    const progressContainer = document.createElement('div');
    progressContainer.innerHTML = `
        <span>${task.text}</span>
        <div class="progress-bar-container">
            <div class="progress-bar"><div id="${barId}" class="progress-bar-fill"></div></div>
            <span id="${textId}" class="progress-bar-text">0%</span>
        </div>
    `;
    launchLogEl.appendChild(progressContainer);
    
    const barEl = document.getElementById(barId);
    const textEl = document.getElementById(textId);

    let progress = 0;
    const startTime = performance.now();

    function update() {
        const elapsedTime = performance.now() - startTime;
        progress = Math.min(100, (elapsedTime / task.duration) * 100);
        
        if (barEl) barEl.style.width = `${progress}%`;
        if (textEl) textEl.textContent = `${Math.floor(progress)}%`;
        launchLogEl.scrollTop = launchLogEl.scrollHeight;

        if (progress < 100 && launchSequenceActive) {
            requestAnimationFrame(update);
        } else {
            setTimeout(onComplete, 100);
        }
    }
    requestAnimationFrame(update);
}

function runNextTask() {
    if (!launchSequenceActive) return;
    const launchLogEl = document.getElementById('launch-log');
    if (!launchLogEl) return;

    if (currentTaskIndex >= LAUNCH_SEQUENCE_TASKS.length) {
        currentTaskIndex = 0; // Loop the sequence
        setTimeout(() => {
            if (!launchSequenceActive) return;
            const recheckLine = document.createElement('span');
            recheckLine.textContent = 'Re-checking asset status...';
            launchLogEl.appendChild(recheckLine);
            launchLogEl.appendChild(document.createElement('br'));
            launchLogEl.scrollTop = launchLogEl.scrollHeight;
            setTimeout(runNextTask, 1000);
        }, 1500);
        return;
    }

    const task = LAUNCH_SEQUENCE_TASKS[currentTaskIndex];

    const existingCursor = launchLogEl.querySelector('.cursor');
    if (existingCursor) existingCursor.remove();

    const callback = () => {
        const lastLine = launchLogEl.lastChild?.previousSibling; // Get the span before the <br>
        if (lastLine && task.type === 'text') {
            const cursor = document.createElement('span');
            cursor.className = 'cursor';
            cursor.textContent = '_';
            lastLine.appendChild(cursor);
        }
        launchLogEl.scrollTop = launchLogEl.scrollHeight;
        currentTaskIndex++;
        runNextTask();
    };

    switch (task.type) {
        case 'text':
            setTimeout(() => {
                const line = document.createElement('span');
                line.textContent = task.text;
                launchLogEl.appendChild(line);
                launchLogEl.appendChild(document.createElement('br'));
                callback();
            }, 60);
            break;
        case 'progress':
            runProgressBar(task, callback);
            break;
        case 'delay':
            setTimeout(callback, task.duration);
            break;
    }
}

function startLaunchSequence() {
    const launchLogEl = document.getElementById('launch-log');
    if (!launchLogEl || launchSequenceActive) return;
    launchSequenceActive = true;
    launchLogEl.innerHTML = '';
    currentTaskIndex = 0;
    runNextTask();
}

function stopLaunchSequence() {
    launchSequenceActive = false;
}
// --- End Launch Sequence Logic ---


function init() {
    resetGameState();

    if (campaignDataForInit) {
        gameState.players.forEach(player => {
            const playerData = campaignDataForInit.players.find(p => p.playerNum === player.playerNum);
            if (playerData) {
                player.lives = playerData.baseLives;
                player.missileCount = playerData.baseMissiles;
                player.currency = playerData.currency || 0;
                player.upgrades = playerData.upgrades || {};
            }
        });
        campaignDataForInit = null;
    }

    if (gameState.gameType === 'campaign') {
        missionManager.startLevel(gameState.level);
    }

    startGameMusic();
    createStarfield();

    if (!missionManager.isMissionActive()) {
        if (gameState.playerCount === 2 && gameState.twoPlayerMode === 'vs') {
        } else {
            createAsteroidBelt();
        }
    }
}

export function handlePlayerDeath(player) {
    if (!player || player.lives <= 0 || player.isInvincible) return;
    player.hitFlashTimer = 30;
    triggerScreenShake(10, 30);
    triggerRumble(0.8, 0.5, 300);
    player.lives--;
    if (gameState.playerCount === 2 && gameState.twoPlayerMode === 'vs') {
        const otherPlayer = gameState.players.find(p => p.id !== player.id);
        if (otherPlayer) {
            otherPlayer.score += 1000;
        }
    }
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
    } else if (gameState.playerCount === 2 && gameState.twoPlayerMode === 'vs' && livingPlayers === 1) {
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
    });
    togglePauseScreen(false);
    toggleDevConsole(false);
    gameState.totalScore = gameState.players.reduce((sum, p) => sum + p.score, 0);
    
    if (gameState.gameType !== 'campaign' && checkIfHighScore(gameState.totalScore)) {
        gameState.status = 'enteringScore';
        gameState.highScoreToSubmit = gameState.totalScore;
        showInitialEntryScreen();
        
        // Add a robust click listener as a fallback to ensure the player can always submit.
        const entryScreen = document.getElementById('initial-entry-screen');
        if (entryScreen) {
            entryScreen.addEventListener('click', submitHighScore, { once: true });
        }

    } else {
        showGameOverUI();
        // Set the default selected button for keyboard/gamepad navigation.
        // The actual event listener is now handled reliably in input.js.
        const returnBtn = document.getElementById('game-over-return-btn');
        if (returnBtn) {
            returnBtn.classList.add('selected');
        }
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
        if (player.lives > 0 && !player.isInvincible && distBetweenPoints(player.x, player.y, mine.x, mine.y) < player.r + MINE_BLAST_RADIUS) {
            if (!player.shieldActive && player.invincibilityFrames <= 0) {
                 if (gameState.playerCount === 2 && gameState.twoPlayerMode === 'vs' && mine.ownerId === player.id) {
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
    const allShips = [...gameState.enemies, ...gameState.allies];
    for(const ship of allShips) {
        if (ship.takeDamage && distBetweenPoints(ship.x, ship.y, mine.x, mine.y) < (ship.r || 20) + MINE_BLAST_RADIUS) {
             ship.takeDamage(MINE_DAMAGE, mine.x, mine.y, true, -1);
        }
    }
    gameState.mines.splice(index, 1);
}

function quitGame() {
    if (gameState.gameType === 'campaign' && activeCampaignSlot) {
        console.log(`Saving campaign progress to slot ${activeCampaignSlot}...`);
        
        const campaignSave = loadCampaign(activeCampaignSlot);
        if (campaignSave) {
            campaignSave.currentLevel = gameState.level;
            campaignSave.players = gameState.players.map(p => ({
                playerNum: p.playerNum,
                currency: p.currency,
                baseLives: p.lives,
                baseMissiles: p.missileCount,
                upgrades: p.upgrades || {}
            }));
            saveCampaign(activeCampaignSlot, campaignSave);
        }
    }
    destroy();
    window.location.href = 'index.html';
}

function applyGravity() {
    if (gameState.planetoids.length === 0) return;

    // Check for the mutator flag, default to 1 (normal gravity) if not present.
    const gravitySign = gameState.mutators?.gravitySign || 1;

    const affectedEntities = [
        ...gameState.players,
        ...gameState.enemies,
        ...gameState.allies, 
        ...gameState.asteroids,
        ...gameState.missiles,
        ...gameState.enemyMissiles,
        ...gameState.enemyRockets,
        ...gameState.powerUps,
        ...gameState.missilePickups,
    ];

    for (const planetoid of gameState.planetoids) {
        for (const entity of affectedEntities) {
            if (entity.lives <= 0 || entity.isInvincible) continue;

            const dist = distBetweenPoints(planetoid.x, planetoid.y, entity.x, entity.y);
            
            if (dist < planetoid.r) continue;

            const angle = Math.atan2(planetoid.y - entity.y, planetoid.x - entity.x);
            
            const minGravityDist = planetoid.r * 1.5;
            const effectiveDist = Math.max(dist, minGravityDist);
            const force = (GRAVITATIONAL_CONSTANT * planetoid.mass) / (effectiveDist * effectiveDist);

            // Apply the gravitySign to the force calculation.
            if (entity.thrust) {
                entity.thrust.x += force * gravitySign * Math.cos(angle);
                entity.thrust.y += force * gravitySign * Math.sin(angle);
            } else if (entity.xv !== undefined && entity.yv !== undefined) {
                entity.xv += force * gravitySign * Math.cos(angle);
                entity.yv += force * gravitySign * Math.sin(angle);
            }
        }
    }
}

let lastFrameTime = performance.now();
function gameLoop(currentTime) {
    const deltaTime = (currentTime - lastFrameTime);
    lastFrameTime = currentTime;

    if (gameState.mutators?.displayTimer > 0) {
        gameState.mutators.displayTimer -= deltaTime;
    }

    switch (gameState.status) {
        case 'playing':
            updatePlayers(deltaTime);
            applyGravity();
            missionManager.update();
            const allOtherEntities = [
                ...gameState.bullets, ...gameState.enemyBullets, ...gameState.missiles,
                ...gameState.enemyMissiles, ...gameState.enemyRockets, ...gameState.smokeParticles,
                ...gameState.missilePickups, ...gameState.powerUps, ...gameState.particles,
                ...gameState.bombs, ...gameState.mines, ...gameState.asteroids, 
                ...gameState.enemies, ...gameState.allies, ...gameState.shockwaves, 
                ...gameState.planetoids, ...gameState.capitalExplosions, ...gameState.damageSmoke,
                ...gameState.sparks, ...gameState.ionEffects
            ];
            allOtherEntities.forEach(item => { if (item?.update) item.update(deltaTime); });

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
            gameState.allies = gameState.allies.filter(a => !a.isDead);
            gameState.shockwaves = gameState.shockwaves.filter(s => s.life > 0);
            gameState.capitalExplosions = gameState.capitalExplosions.filter(e => e.life > 0);
            gameState.damageSmoke = gameState.damageSmoke.filter(s => s.life > 0 && !s.parent.isDead);
            gameState.sparks = gameState.sparks.filter(s => s.life > 0);
            gameState.ionEffects = gameState.ionEffects.filter(e => e.life > 0 && !e.parent.isDead);

            if (gameState.playerCount === 2 && gameState.twoPlayerMode === 'vs') {
            } else {
                if (!missionManager.isMissionActive()) {
                    updateSpawning(gameState, deltaTime);
                }
                handleLevelEnd();
            }

            if (gameState.shaders.starfield) {
                const livingPlayers = gameState.players.filter(p => p.lives > 0);
                const avgPlayerVelocity = livingPlayers.length > 0
                    ? livingPlayers.reduce((acc, p) => ({
                        x: acc.x + p.thrust.x / livingPlayers.length,
                        y: acc.y + p.thrust.y / livingPlayers.length
                    }), { x: 0, y: 0 })
                    : { x: 0, y: 0 };
                for (const star of gameState.starfield) {
                    const parallaxSpeed = star.z === 1 ? 0.2 : 0.4;
                    star.x -= (avgPlayerVelocity.x * parallaxSpeed) + star.dx;
                    star.y -= (avgPlayerVelocity.y * parallaxSpeed) + star.dy;
                    if (star.x < 0) star.x = canvas.width;
                    if (star.x > canvas.width) star.x = 0;
                    if (star.y < 0) star.y = canvas.height;
                    if (star.y > canvas.height) star.y = 0;
                }
            }

            renderGame(gameState, ctx);
            break;
        case 'paused':
            renderGame(gameState, ctx);
            handlePauseInput();
            break;
        case 'hangar':
            handleHangarInput();
            break;
        case 'devConsole':
            renderGame(gameState, ctx);
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

export function destroy() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        console.log('Game loop stopped.');
    }
    // NEW: Stop loading loop if it's running
    if (loadingLoopId) {
        cancelAnimationFrame(loadingLoopId);
        loadingLoopId = null;
    }
    stopLaunchSequence();
    if (keydownListener) window.removeEventListener('keydown', keydownListener);
    if (keyupListener) window.removeEventListener('keyup', keyupListener);
    console.log('Game instance destroyed.');
}

function proceedToNextLevel() {
    toggleHangarScreen(false);

    if (gameState.gameType === 'campaign' && activeCampaignSlot) {
        console.log(`Saving progress for slot ${activeCampaignSlot} before next level.`);
        const campaignData = loadCampaign(activeCampaignSlot);
        if (campaignData) {
            campaignData.currentLevel = gameState.level;
            campaignData.players = gameState.players.map(p => ({
                playerNum: p.playerNum,
                currency: p.currency,
                baseLives: p.lives,
                baseMissiles: p.missileCount,
                upgrades: p.upgrades || {}
            }));
            saveCampaign(activeCampaignSlot, campaignData);
        }
    }
    
    [
        'bullets', 'asteroids', 'missilePickups', 'missiles', 'powerUps',
        'bombs', 'mines', 'enemies', 'allies', 'enemyBullets', 'enemyMissiles',
        'enemyRockets', 'particles', 'smokeParticles', 'shockwaves', 'planetoids',
        'capitalExplosions', 'damageSmoke', 'sparks', 'ionEffects'
    ].forEach(key => (gameState[key].length = 0));

    missionManager.startLevel(gameState.level);

    if (!missionManager.isMissionActive()) {
        createAsteroidBelt();
    }
    
    gameState.players.forEach(p => { 
        if (p.lives > 0) {
            p.invincibilityFrames = 180;
            p.inputCooldown = 150;
        }
    });
    
    gameState.status = 'playing';
}

// NEW: A dedicated render loop for the loading screen
function loadingLoop() {
    // This loop just draws the background elements, not game entities.
    renderBackground(ctx, gameState);
    renderStarfield(gameState, ctx);
    loadingLoopId = requestAnimationFrame(loadingLoop);
}

function loadGame() {
    const campaignJSON = sessionStorage.getItem('campaignRunData');
    const settingsJSON = sessionStorage.getItem('gameSettings');
    const slotJSON = sessionStorage.getItem('activeCampaignSlot');

    if (!campaignJSON && !settingsJSON) {
        console.error('No game settings or campaign data found in sessionStorage');
        window.location.href = 'index.html';
        return;
    }

    if (settingsJSON) {
        const settings = JSON.parse(settingsJSON);
        Object.assign(gameState, settings);
        if (settings.shaders) {
            Object.assign(gameState.shaders, settings.shaders);
        }

        // Apply mutators if this is a daily challenge run
        if (settings.gameType === 'daily' && settings.activeMutatorKeys) {
            console.log("Applying Daily Challenge mutators...");
            gameState.mutators.active = []; // Store the full, active mutator objects
            gameState.mutators.descriptions = [];
            gameState.mutators.displayTimer = 10000;

            settings.activeMutatorKeys.forEach(key => {
                const mutator = MUTATORS[key];
                if (mutator) {
                    mutator.run(gameState); // Run its setup logic
                    gameState.mutators.active.push(mutator); // Store the whole object
                    gameState.mutators.descriptions.push(mutator.description);
                    console.log(`- Applied: ${key}`);
                }
            });
        }
    }
    
    (function earlyGamepadScan() {
      const pads = navigator.getGamepads();
      for (let i = 0; i < pads.length; i++) {
        if (pads[i] && !gameState.activeGamepads[i]) {
          console.log('Found pre-connected gamepad during early scan:', pads[i].id);
          gameState.activeGamepads[i] = pads[i];
        }
      }
    })();


    if (gameState.gameType === 'campaign' && campaignJSON && slotJSON) {
        console.log("Loading campaign run data...");
        const campaignData = JSON.parse(campaignJSON);
        campaignDataForInit = campaignData;
        activeCampaignSlot = parseInt(slotJSON, 10);
        gameState.playerCount = campaignData.playerCount;
        gameState.level = campaignData.currentLevel;
        gameState.currentDifficulty = campaignData.difficulty || 'normal';
    } else {
        console.log("Loading standard arcade game settings...");
        activeCampaignSlot = null;
    }

    sessionStorage.removeItem('campaignRunData');
    sessionStorage.removeItem('gameSettings');
    sessionStorage.removeItem('activeCampaignSlot');
    
    setCanvasSize(canvas);
    document.body.classList.remove('bw-mode', 'green-mode', 'amber-mode');
    if (gameState.colorMode === 'bw') {
        document.body.classList.add('bw-mode');
    } else if (gameState.colorMode === 'green') {
        document.body.classList.add('green-mode');
    } else if (gameState.colorMode === 'amber') {
        document.body.classList.add('amber-mode');
    }
    // This needs to be called *before* the loading loop starts
    applyVisualSettings();

    // The starfield needs to be created before it can be rendered
    if (gameState.shaders.starfield) {
        createStarfield(); 
    }

    const launchingScreen = document.getElementById('launching-screen');
    startLaunchSequence();

    // START a render loop for the background while loading
    loadingLoop();

    const SETTINGS_KEY_PREFIX = 'neonAsteroidsSettings_';
    const settingsCategories = {
        gameplay: ['currentDifficulty', 'shieldMode', 'enemyFireEffect'],
        video: ['colorMode', 'shaders'],
        sound: ['musicVolume', 'sfxVolume'],
        controls: ['currentControlScheme']
    };

    function saveSettings(category) {
        if (!settingsCategories[category]) return;
        
        const settingsToSave = {};
        for (const key of settingsCategories[category]) {
            if (key === 'shaders') {
                settingsToSave.shaders = { ...gameState.shaders };
            } else {
                settingsToSave[key] = gameState[key];
            }
        }
        localStorage.setItem(SETTINGS_KEY_PREFIX + category, JSON.stringify(settingsToSave));
        console.log(`${category} settings saved from pause menu.`);
    }
    
    window.addEventListener('settingChanged', (e) => {
        if (e.detail && e.detail.category) {
            saveSettings(e.detail.category);
        }
    });

    const minLoadTime = new Promise(resolve => setTimeout(resolve, 3000));
    const assetsLoaded = assetManager.loadAll();

    Promise.all([assetsLoaded, minLoadTime]).then(() => {
        // Assets are loaded, STOP the loading loop
        cancelAnimationFrame(loadingLoopId);
        loadingLoopId = null;

        stopLaunchSequence();
        if (launchingScreen) {
            launchingScreen.style.opacity = '0';
            setTimeout(() => {
                launchingScreen.classList.add('hidden');
            }, 500); 
        }

        setCanvasSize(canvas);
        // The starfield is already created, no need to do it again here.

        console.log("All game assets loaded successfully!");
        ({ keydownListener, keyupListener } = setupGameEventListeners(init));
        
        document.getElementById('quit-to-menu-btn')?.addEventListener('click', quitGame);
        document.getElementById('return-to-game-btn')?.addEventListener('click', unpauseGame);
        document.getElementById('proceed-to-next-level-btn')?.addEventListener('click', proceedToNextLevel);

        const initAudioOnFirstInteraction = async () => {
            if (window.audioContext && window.audioContext.state === 'suspended') {
                await window.audioContext.resume();
            }
            initAudio();
        };
        const audioCtx = window.audioContext;
        if (audioCtx && audioCtx.state === 'suspended') {
            const overlay = document.createElement('div');
            overlay.id = 'audio-overlay';
            overlay.style.cssText = `position:fixed; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(13,2,26,0.9); color:#00ffff; font-family:Orbitron,sans-serif; z-index:9999; font-size:2em; text-shadow:0 0 10px #00ffff; cursor:pointer;`;
            overlay.textContent = 'Tap or press any key to start audio';
            const startAudio = (e) => {
                e.preventDefault();
                overlay.remove();
                initAudioOnFirstInteraction();
                window.removeEventListener('click', startAudio);
                window.removeEventListener('keydown', startAudio);
            };
            overlay.addEventListener('click', startAudio, { once: true });
            window.addEventListener('keydown', startAudio, { once: true });
            document.body.appendChild(overlay);
        } else {
             initAudio();
        }
        init();
        // Start the MAIN game loop
        requestAnimationFrame(gameLoop);
    }).catch(error => {
        if (launchingScreen) {
            launchingScreen.classList.add('hidden');
        }
        console.error("Failed to load game assets:", error);
        ctx.fillStyle = '#ff0000';
        ctx.font = "24px 'Orbitron', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText("Error: Failed to load game assets.", canvas.width / 2, canvas.height / 2);
        ctx.fillText("Please refresh the page to try again.", canvas.width / 2, canvas.height / 2 + 30);
    });
}

if (document.getElementById('gameCanvas')) {
    loadGame();
}