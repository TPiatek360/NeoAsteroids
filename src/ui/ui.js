// src/ui/ui.js
// Manages all DOM elements and UI updates.

import { gameState } from '../state.js';
import { DIFFICULTY_SETTINGS, MAX_CHARGE_LEVEL, SHIELD_MAX_ENERGY } from '../constants.js';

// --- Element Selectors ---
export const canvas = document.getElementById('gameCanvas') || document.getElementById('menuCanvas');
export const ctx = canvas ? canvas.getContext('2d') : null;

// Game Page Elements
const gameUIEl = document.getElementById('game-ui');
const levelEl = document.getElementById('level');
const gameOverScreenEl = document.getElementById('game-over-screen');
const gameOverTitleEl = document.getElementById('game-over-title');
const gameOverSubtitleEl = document.getElementById('game-over-subtitle');
const returnToMenuBtn = document.getElementById('return-to-menu-btn');
const initialEntryScreenEl = document.getElementById('initial-entry-screen');
const finalScoreDisplayEl = document.getElementById('final-score-display');
const charBox0 = document.getElementById('char-box-0');
const charBox1 = document.getElementById('char-box-1');
const charBox2 = document.getElementById('char-box-2');

// Player 1 HUD
const p1HUD = {
    container: document.getElementById('player1-hud'),
    score: document.getElementById('p1-score'),
    lives: document.getElementById('p1-lives'),
    missiles: document.getElementById('p1-missiles-ui'),
    chargeBarFill: document.getElementById('p1-charge-bar-fill'),
    chargeBarSegments: document.getElementById('p1-charge-bar-segments'),
    shieldBarFill: document.getElementById('p1-shield-bar-fill'),
    powerupStatus: document.getElementById('p1-powerup-status'),
};

// Player 2 HUD
const p2HUD = {
    container: document.getElementById('player2-hud'),
    score: document.getElementById('p2-score'),
    lives: document.getElementById('p2-lives'),
    missiles: document.getElementById('p2-missiles-ui'),
    chargeBarFill: document.getElementById('p2-charge-bar-fill'),
    chargeBarSegments: document.getElementById('p2-charge-bar-segments'),
    shieldBarFill: document.getElementById('p2-shield-bar-fill'),
    powerupStatus: document.getElementById('p2-powerup-status'),
};

const playerHUDs = [p1HUD, p2HUD];

// --- Menu Page Elements ---
const difficultySelectorEl = document.getElementById('difficulty-selector');
const controlSchemeSelectorEl = document.getElementById('control-scheme-selector');
const gameModeSelectorEl = document.getElementById('game-mode-selector');
const twoPlayerModeSelectorContainerEl = document.getElementById('two-player-mode-selector-container');
const twoPlayerModeSelectorEl = document.getElementById('two-player-mode-selector');
const mainMenuEl = document.getElementById('main-menu');
const controlsMenuEl = document.getElementById('controls-menu');
const soundMenuEl = document.getElementById('sound-menu');
const gameplayMenuEl = document.getElementById('gameplay-menu');
const shieldModeSelectorEl = document.getElementById('shield-mode-selector');
const musicVolumeFill = document.getElementById('music-volume-fill');
const musicVolumeText = document.getElementById('music-volume-text');
const sfxVolumeFill = document.getElementById('sfx-volume-fill');
const sfxVolumeText = document.getElementById('sfx-volume-text');
const highScoreListEl = document.getElementById('high-score-list');

// --- GAME UI FUNCTIONS (for game.html) ---

function updatePlayerHUD(player, hud) {
    if (!player || !hud.container) return; // Exit if hud elements don't exist
    
    hud.container.classList.remove('hidden');

    if (player.lives <= 0) {
        hud.container.style.opacity = '0.4';
        hud.score.textContent = `SCORE: ${player.score}`;
        hud.lives.textContent = 'GAME OVER';
        hud.missiles.textContent = '';
        hud.powerupStatus.textContent = '';
        hud.shieldBarFill.style.width = '0%';
        hud.chargeBarFill.style.width = '0%';
        return;
    }

    hud.container.style.opacity = '1';
    hud.score.textContent = `SCORE: ${player.score}`;
    let livesString = '';
    for (let i = 0; i < player.lives; i++) livesString += '▲ ';
    hud.lives.textContent = `LIVES: ${livesString}`;
    hud.missiles.textContent = `MISSILES: ${player.missileCount}`;
    
    hud.shieldBarFill.style.width = `${player.shieldEnergy / SHIELD_MAX_ENERGY * 100}%`;
    let powerupText = '';
    if (player.powerupTimers.rapidFire > 0) powerupText += `RAPID FIRE: ${Math.ceil(player.powerupTimers.rapidFire / 1000)}s `;
    if (player.powerupTimers.spreadShot > 0) powerupText += `SPREAD SHOT: ${Math.ceil(player.powerupTimers.spreadShot / 1000)}s`;
    hud.powerupStatus.textContent = powerupText;
}

export function updateGameUI() {
    if (levelEl) levelEl.textContent = `LEVEL: ${gameState.level}`;
    if (gameState.players[0]) updatePlayerHUD(gameState.players[0], p1HUD);
    if (gameState.players[1]) updatePlayerHUD(gameState.players[1], p2HUD);
}

function setupChargeBarSegmentsForPlayer(hud) {
    if (!hud.chargeBarSegments) return;
    hud.chargeBarSegments.innerHTML = '';
    for (let i = 1; i < MAX_CHARGE_LEVEL; i++) {
        const segment = document.createElement('div');
        segment.style.position = 'absolute';
        segment.style.left = `${(i / MAX_CHARGE_LEVEL) * 100}%`;
        segment.style.top = '0';
        segment.style.width = '1px';
        segment.style.height = '100%';
        segment.style.backgroundColor = 'rgba(255, 170, 0, 0.5)';
        hud.chargeBarSegments.appendChild(segment);
    }
}
export function setupChargeBarSegments() {
    playerHUDs.forEach(setupChargeBarSegmentsForPlayer);
}

function updateChargeBarForPlayer(player, hud) {
    if (!player || !hud.chargeBarFill || !player.isChargingMissile || player.missileCount === 0) {
        if (hud.chargeBarFill) hud.chargeBarFill.style.width = '0%';
        return;
    }
    const totalProgress = player.missileChargeLevel + player.missileChargeProgress;
    const fillPercentage = (totalProgress / MAX_CHARGE_LEVEL) * 100;
    hud.chargeBarFill.style.width = `${Math.min(100, fillPercentage)}%`;
}
export function updateChargeBar() {
    if (gameState.players[0]) updateChargeBarForPlayer(gameState.players[0], p1HUD);
    if (gameState.players[1]) updateChargeBarForPlayer(gameState.players[1], p2HUD);
}

export function showInGameUI() {
    if (gameUIEl) gameUIEl.classList.add('in-game');
}

export function showGameOverUI() {
    if (!gameOverScreenEl) return;
    
    gameOverScreenEl.classList.remove('hidden');
    gameUIEl.classList.remove('in-game');
    
    const difficultyLabel = DIFFICULTY_SETTINGS[gameState.currentDifficulty].label;
    let subText = '';

    if (gameState.gameMode === 'twoPlayer' && gameState.twoPlayerMode === 'vs') {
        const p1 = gameState.players[0];
        const p2 = gameState.players[1];
        const winner = p1.lives > 0 ? p1 : (p2?.lives > 0 ? p2 : null);
        if (winner) {
            subText = `PLAYER ${winner.playerNum} WINS!`;
        } else {
            subText = `IT'S A DRAW!`;
        }
    } else {
        subText = `Final Score: ${gameState.totalScore} on ${difficultyLabel}`;
    }

    gameOverSubtitleEl.innerHTML = subText;
    returnToMenuBtn.onclick = () => window.location.href = 'index.html';
}

export function showInitialEntryScreen() {
    if (!initialEntryScreenEl) return;
    initialEntryScreenEl.classList.remove('hidden');
    finalScoreDisplayEl.textContent = `SCORE: ${gameState.highScoreToSubmit}`;
    gameState.initialEntryState.initials = ['A', 'A', 'A'];
    gameState.initialEntryState.activeIndex = 0;
    updateInitialEntryUI(); 
}

export function hideInitialEntryScreen() { if (initialEntryScreenEl) initialEntryScreenEl.classList.add('hidden'); }
export function updateInitialEntryUI() { 
    if (!initialEntryScreenEl) return;
    const {initials, activeIndex} = gameState.initialEntryState; 
    charBox0.textContent = initials[0]; 
    charBox1.textContent = initials[1]; 
    charBox2.textContent = initials[2]; 
    document.querySelectorAll('.initial-char-box').forEach((box, index) => { box.classList.toggle('selected', index === activeIndex); }); 
}


// --- MENU UI FUNCTIONS (for index.html) ---

export function createGameModeButtons() {
    if (!gameModeSelectorEl) return;
    gameModeSelectorEl.innerHTML = '';
    const modes = { 'singlePlayer': 'Single Player', 'twoPlayer': 'Two Player' };
    Object.keys(modes).forEach(key => {
        const button = document.createElement('button');
        button.textContent = modes[key];
        button.className = 'menu-btn';
        button.dataset.mode = key;
        button.addEventListener('click', () => selectGameMode(key));
        gameModeSelectorEl.appendChild(button);
    });
}

export function selectGameMode(key) {
    gameState.gameMode = key;
    document.querySelectorAll('#game-mode-selector .menu-btn').forEach(btn => {
        btn.classList.toggle('chosen', btn.dataset.mode === key);
    });
    if (twoPlayerModeSelectorContainerEl) {
        twoPlayerModeSelectorContainerEl.classList.toggle('hidden', key !== 'twoPlayer');
    }
}

export function createTwoPlayerModeButtons() {
    if (!twoPlayerModeSelectorEl) return;
    twoPlayerModeSelectorEl.innerHTML = '';
    const modes = { 'coop': 'Co-op', 'vs': 'Versus' };
    Object.keys(modes).forEach(key => {
        const button = document.createElement('button');
        button.textContent = modes[key];
        button.className = 'menu-btn';
        button.dataset.mode = key;
        button.addEventListener('click', () => selectTwoPlayerMode(key));
        twoPlayerModeSelectorEl.appendChild(button);
    });
}

export function selectTwoPlayerMode(key) {
    gameState.twoPlayerMode = key;
    document.querySelectorAll('#two-player-mode-selector .menu-btn').forEach(btn => {
        btn.classList.toggle('chosen', btn.dataset.mode === key);
    });
}

export function createDifficultyButtons() {
    if (!difficultySelectorEl) return;
    difficultySelectorEl.innerHTML = '';
    Object.keys(DIFFICULTY_SETTINGS).forEach(key => {
        const button = document.createElement('button');
        button.textContent = DIFFICULTY_SETTINGS[key].label;
        button.className = 'menu-btn';
        button.dataset.difficulty = key;
        button.addEventListener('click', () => selectDifficulty(key));
        difficultySelectorEl.appendChild(button);
    });
}

export function selectDifficulty(key) {
    gameState.currentDifficulty = key;
    document.querySelectorAll('#difficulty-selector .menu-btn').forEach(btn => {
        btn.classList.toggle('chosen', btn.dataset.difficulty === key);
    });
}

export function createControlSchemeButtons() {
    if (!controlSchemeSelectorEl) return;
    controlSchemeSelectorEl.innerHTML = '';
    const schemes = { 'default': 'Default (Aim Stick, Thrust Button)', 'combined': 'Combined (Move & Aim with Stick)' };
    Object.keys(schemes).forEach(key => {
        const button = document.createElement('button');
        button.textContent = schemes[key];
        button.className = 'menu-btn';
        button.dataset.scheme = key;
        button.addEventListener('click', () => selectControlScheme(key));
        controlSchemeSelectorEl.appendChild(button);
    });
}

export function selectControlScheme(key) {
    gameState.currentControlScheme = key;
    document.querySelectorAll('#control-scheme-selector .menu-btn').forEach(btn => {
        btn.classList.toggle('chosen', btn.dataset.scheme === key);
    });
}

function toggleMenu(main, sub, show) {
    if (!main || !sub) return;
    main.classList.toggle('hidden', show);
    sub.classList.toggle('hidden', !show);
    document.querySelectorAll('.menu-btn.selected').forEach(b => b.classList.remove('selected'));
    const firstVisibleButton = Array.from((show ? sub : main).querySelectorAll('.menu-btn')).find(btn => btn.offsetParent !== null);
    firstVisibleButton?.classList.add('selected');
}

export function toggleControlsMenu(show) { toggleMenu(mainMenuEl, controlsMenuEl, show); }
export function toggleGameplayMenu(show) { toggleMenu(mainMenuEl, gameplayMenuEl, show); }
export function toggleSoundMenu(show) { toggleMenu(mainMenuEl, soundMenuEl, show); }

export function createShieldModeButtons() {
    if (!shieldModeSelectorEl) return;
    shieldModeSelectorEl.innerHTML = '';
    const modes = { 'regenerate': 'Regenerating Shield', 'pickup': 'Shield Pickups Only' };
    Object.keys(modes).forEach(key => {
        const button = document.createElement('button');
        button.textContent = modes[key];
        button.className = 'menu-btn';
        button.dataset.mode = key;
        button.addEventListener('click', () => selectShieldMode(key));
        shieldModeSelectorEl.appendChild(button);
    });
}

export function selectShieldMode(key) {
    gameState.shieldMode = key;
    document.querySelectorAll('#shield-mode-selector .menu-btn').forEach(btn => {
        btn.classList.toggle('chosen', btn.dataset.mode === key);
    });
}

export function updateMusicVolumeUI(volume) { 
    if (!musicVolumeFill || !musicVolumeText) return;
    const percentage = Math.round(volume * 100); 
    musicVolumeFill.style.width = `${percentage}%`; 
    musicVolumeText.textContent = `${percentage}%`; 
}
export function updateSfxVolumeUI(volume) { 
    if (!sfxVolumeFill || !sfxVolumeText) return;
    const percentage = Math.round(volume * 100); 
    sfxVolumeFill.style.width = `${percentage}%`; 
    sfxVolumeText.textContent = `${percentage}%`; 
}


// --- SHARED/GENERAL UI FUNCTIONS ---

const HIGH_SCORE_KEY = 'neonAsteroidsHighScores';
export function getHighScores() { const scoresJSON = localStorage.getItem(HIGH_SCORE_KEY); if (!scoresJSON) return []; try { const scores = JSON.parse(scoresJSON); return scores.sort((a, b) => b.score - a.score); } catch (e) { return []; } }
export function saveHighScores(scores) { localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(scores)); }

export function checkIfHighScore(score) {
    if (score === 0) return false;
    if (gameState.gameMode === 'twoPlayer' && gameState.twoPlayerMode === 'vs') return false;
    const highScores = getHighScores();
    return highScores.length < 10 || score > highScores[highScores.length - 1].score;
}

export function addHighScore(initials, score) { let highScores = getHighScores(); highScores.push({ initials, score }); highScores.sort((a, b) => b.score - a.score); highScores = highScores.slice(0, 10); saveHighScores(highScores); }

export function displayHighScores() {
    if (!highScoreListEl) return;
    const highScores = getHighScores();
    highScoreListEl.innerHTML = '';
    if (highScores.length === 0) {
        highScoreListEl.innerHTML = '<li>No scores yet!</li>';
    } else {
        highScores.forEach((score) => {
            const li = document.createElement('li');
            li.textContent = `${score.initials} - ${score.score}`;
            highScoreListEl.appendChild(li);
        });
    }
}

// --- Getter functions for menu navigation ---
export function getMainMenuElement() { return mainMenuEl; }
export function getControlsMenuElement() { return controlsMenuEl; }
export function getSoundMenuElement() { return soundMenuEl; }
export function getGameplayMenuElement() { return gameplayMenuEl; }