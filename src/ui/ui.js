// src/ui/ui.js
// Manages all DOM elements and UI updates for menus and high-level screen states.

import { gameState } from '../state.js';
import { DIFFICULTY_SETTINGS } from '../constants.js';
import { getHighScores } from '../systems/HighScoreManager.js';

// --- Element Selectors ---
export const canvas = document.getElementById('gameCanvas') || document.getElementById('menuCanvas');
export const ctx = canvas ? canvas.getContext('2d') : null;

// Game Page Elements
const gameUIEl = document.getElementById('game-ui');
const gameOverScreenEl = document.getElementById('game-over-screen');
const gameOverTitleEl = document.getElementById('game-over-title');
const gameOverSubtitleEl = document.getElementById('game-over-subtitle');
const returnToMenuBtn = document.getElementById('return-to-menu-btn');
const initialEntryScreenEl = document.getElementById('initial-entry-screen');
const finalScoreDisplayEl = document.getElementById('final-score-display');
const charBox0 = document.getElementById('char-box-0');
const charBox1 = document.getElementById('char-box-1');
const charBox2 = document.getElementById('char-box-2');
const pauseScreenEl = document.getElementById('pause-screen');

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
const pauseModeSelectorEl = document.getElementById('pause-mode-selector');
const enemyAsteroidCollisionSelectorEl = document.getElementById('enemy-asteroid-collision-selector');
const musicVolumeFill = document.getElementById('music-volume-fill');
const musicVolumeText = document.getElementById('music-volume-text');
const sfxVolumeFill = document.getElementById('sfx-volume-fill');
const sfxVolumeText = document.getElementById('sfx-volume-text');
const highScoreListEl = document.getElementById('high-score-list');
const highScoreListContainerEl = document.getElementById('high-score-list-container');
const highScoreListTitleEl = highScoreListContainerEl ? highScoreListContainerEl.querySelector('h2') : null;


// --- GAME UI FUNCTIONS (for game.html) ---

export function showInGameUI() {
    if (gameUIEl) gameUIEl.classList.add('in-game');
}

export function showGameOverUI() {
    if (!gameOverScreenEl) return;

    gameOverScreenEl.classList.remove('hidden');
    if (gameUIEl) gameUIEl.classList.remove('in-game');

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

export function updateInitialEntryUI() {
    if (!initialEntryScreenEl) return;
    const { initials, activeIndex } = gameState.initialEntryState;
    charBox0.textContent = initials[0];
    charBox1.textContent = initials[1];
    charBox2.textContent = initials[2];
    document.querySelectorAll('.initial-char-box').forEach((box, index) => {
        box.classList.toggle('selected', index === activeIndex);
    });
}

export function showPauseScreen() { if (pauseScreenEl) pauseScreenEl.classList.remove('hidden'); }
export function hidePauseScreen() { if (pauseScreenEl) pauseScreenEl.classList.add('hidden'); }


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
    displayHighScores(); // Update high scores when mode changes
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
    displayHighScores(); // Update high scores when sub-mode changes
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
    displayHighScores(); // Update high scores when difficulty changes
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

export function createPauseModeButtons() {
    if (!pauseModeSelectorEl) return;
    pauseModeSelectorEl.innerHTML = '';
    const modes = { 'true': 'Pause Enabled', 'false': 'Pause Disabled' };
    Object.keys(modes).forEach(key => {
        const button = document.createElement('button');
        button.textContent = modes[key];
        button.className = 'menu-btn';
        button.dataset.mode = key;
        button.addEventListener('click', () => selectPauseMode(key === 'true'));
        pauseModeSelectorEl.appendChild(button);
    });
}

export function selectPauseMode(isEnabled) {
    gameState.allowPause = isEnabled;
    document.querySelectorAll('#pause-mode-selector .menu-btn').forEach(btn => {
        btn.classList.toggle('chosen', btn.dataset.mode === String(isEnabled));
    });
}

export function createEnemyAsteroidCollisionButtons() {
    if (!enemyAsteroidCollisionSelectorEl) return;
    enemyAsteroidCollisionSelectorEl.innerHTML = '';
    const modes = { 'true': 'Enabled', 'false': 'Disabled' };
    Object.keys(modes).forEach(key => {
        const button = document.createElement('button');
        button.textContent = modes[key];
        button.className = 'menu-btn';
        button.dataset.mode = key;
        button.addEventListener('click', () => selectEnemyAsteroidCollisionMode(key === 'true'));
        enemyAsteroidCollisionSelectorEl.appendChild(button);
    });
}

export function selectEnemyAsteroidCollisionMode(isEnabled) {
    gameState.enemyFireDestroysAsteroids = isEnabled;
    document.querySelectorAll('#enemy-asteroid-collision-selector .menu-btn').forEach(btn => {
        btn.classList.toggle('chosen', btn.dataset.mode === String(isEnabled));
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

export function displayHighScores() {
    if (!highScoreListContainerEl) return;

    const highScores = getHighScores();
    if (highScores === null || highScores.length < 0) { // No high score list for this mode, or empty list
        highScoreListContainerEl.classList.add('hidden');
        return;
    }

    highScoreListContainerEl.classList.remove('hidden');

    const difficultyLabel = DIFFICULTY_SETTINGS[gameState.currentDifficulty].label.toUpperCase();
    let modeLabel = "SINGLE PLAYER";
    if (gameState.gameMode === 'twoPlayer' && gameState.twoPlayerMode === 'coop') {
        modeLabel = "CO-OP";
    }
    highScoreListTitleEl.textContent = `HIGH SCORES - ${difficultyLabel} (${modeLabel})`;

    if (highScores.length === 0) {
        highScoreListEl.innerHTML = '<li>No scores yet!</li>';
    } else {
        highScoreListEl.innerHTML = '';
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