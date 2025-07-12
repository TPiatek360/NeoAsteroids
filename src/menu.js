// src/menu.js
// Handles all logic for the main menu page (index.html).

import { gameState } from './state.js';
import { setCanvasSize } from './utils.js';
import { renderMenu } from './systems/RenderSystem.js';
import { createMenuAsteroidBelt } from './entities/environment.js';
import { initAudio, startMenuMusic, setMusicVolume, setSfxVolume, isAudioInitialized, getAudioContext, playMenuSelectSound } from './audio/audio.js';
import {
    createGameModeButtons, selectGameMode, createTwoPlayerModeButtons, selectTwoPlayerMode,
    createDifficultyButtons, selectDifficulty, createControlSchemeButtons, selectControlScheme,
    createShieldModeButtons, selectShieldMode, createPauseModeButtons, selectPauseMode,
    createEnemyAsteroidCollisionButtons, selectEnemyAsteroidCollisionMode,
    displayHighScores, toggleSoundMenu, toggleGameplayMenu,
    toggleControlsMenu, updateMusicVolumeUI, updateSfxVolumeUI,
    getMainMenuElement, getControlsMenuElement, getSoundMenuElement, getGameplayMenuElement
} from './ui/ui.js';

const canvas = document.getElementById('menuCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const controlsSettingsButton = document.getElementById('controlsSettingsButton');
const controlsBackButton = document.getElementById('controlsBackButton');
const soundSettingsButton = document.getElementById('soundSettingsButton');
const backButton = document.getElementById('backButton');
const gameplaySettingsButton = document.getElementById('gameplaySettingsButton');
const gameplayBackButton = document.getElementById('gameplayBackButton');

function handleMenuGamepadInput() {
    const gamepads = Array.from(navigator.getGamepads()).filter(gp => gp);
    if (gamepads.length === 0) return;

    const gp = gamepads[0];
    const startBtn = gp.buttons[9];
    const confirmBtn = gp.buttons[0];
    const dpadUp = gp.buttons[12];
    const dpadDown = gp.buttons[13];

    const controlsMenuVisible = !getControlsMenuElement()?.classList.contains('hidden');
    const soundMenuVisible = !getSoundMenuElement()?.classList.contains('hidden');
    const gameplayMenuVisible = !getGameplayMenuElement()?.classList.contains('hidden');

    let currentMenu = getMainMenuElement();
    if (controlsMenuVisible) currentMenu = getControlsMenuElement();
    else if (soundMenuVisible) currentMenu = getSoundMenuElement();
    else if (gameplayMenuVisible) currentMenu = getGameplayMenuElement();

    const allButtons = Array.from(currentMenu.querySelectorAll('.menu-btn'));
    const buttons = allButtons.filter(btn => btn.offsetParent !== null);
    if (buttons.length === 0) return;

    const currentFocusIndex = buttons.findIndex(btn => btn.classList.contains('selected'));

    if ((startBtn?.pressed && !gameState.gamepadButtonsPressed[9]) || (confirmBtn?.pressed && !gameState.gamepadButtonsPressed[0])) {
        const targetIndex = currentFocusIndex > -1 ? currentFocusIndex : 0;
        buttons[targetIndex]?.click();
    }
    if (dpadUp?.pressed && !gameState.gamepadButtonsPressed[12]) {
        if (currentFocusIndex > -1) buttons[currentFocusIndex].classList.remove('selected');
        const newIndex = currentFocusIndex > -1 ? (currentFocusIndex - 1 + buttons.length) % buttons.length : 0;
        buttons[newIndex].classList.add('selected');
        playMenuSelectSound();
    }
    if (dpadDown?.pressed && !gameState.gamepadButtonsPressed[13]) {
        if (currentFocusIndex > -1) buttons[currentFocusIndex].classList.remove('selected');
        const newIndex = currentFocusIndex > -1 ? (currentFocusIndex + 1) % buttons.length : 0;
        buttons[newIndex].classList.add('selected');
        playMenuSelectSound();
    }
    gameState.gamepadButtonsPressed[0] = confirmBtn?.pressed;
    gameState.gamepadButtonsPressed[9] = startBtn?.pressed;
    gameState.gamepadButtonsPressed[12] = dpadUp?.pressed;
    gameState.gamepadButtonsPressed[13] = dpadDown?.pressed;
}

function setupMenuEventListeners() {
    async function initAudioOnFirstInteraction() {
        if (isAudioInitialized()) return;
        try {
            await initAudio();
            startMenuMusic();
        } catch (err) {
            console.error("Failed to initialize audio.", err);
        }
    }

    window.addEventListener('click', initAudioOnFirstInteraction, { once: true });
    window.addEventListener('keydown', initAudioOnFirstInteraction, { once: true });

    startButton.addEventListener('click', async () => {
        if (startButton.disabled) return;
        startButton.disabled = true;

        if (!isAudioInitialized()) {
            await initAudioOnFirstInteraction();
        } else if (getAudioContext()?.state === 'suspended') {
            try { await getAudioContext().resume(); }
            catch (err) { console.error("Could not resume audio context", err); }
        }

        const gameSettings = {
            difficulty: gameState.currentDifficulty,
            gameMode: gameState.gameMode,
            twoPlayerMode: gameState.twoPlayerMode,
            controlScheme: gameState.currentControlScheme,
            shieldMode: gameState.shieldMode,
            allowPause: gameState.allowPause,
            enemyFireDestroysAsteroids: gameState.enemyFireDestroysAsteroids,
        };
        sessionStorage.setItem('gameSettings', JSON.stringify(gameSettings));

        window.location.href = 'game.html';
    });

    controlsSettingsButton.addEventListener('click', () => toggleControlsMenu(true));
    controlsBackButton.addEventListener('click', () => toggleControlsMenu(false));
    soundSettingsButton.addEventListener('click', () => toggleSoundMenu(true));
    backButton.addEventListener('click', () => toggleSoundMenu(false));
    gameplaySettingsButton.addEventListener('click', () => toggleGameplayMenu(true));
    gameplayBackButton.addEventListener('click', () => toggleGameplayMenu(false));

    window.addEventListener('resize', () => setCanvasSize(canvas));
}

function menuLoop() {
    renderMenu(gameState, ctx);
    handleMenuGamepadInput();
    requestAnimationFrame(menuLoop);
}

function initMenu() {
    setCanvasSize(canvas);

    createGameModeButtons(); selectGameMode(gameState.gameMode);
    createTwoPlayerModeButtons(); selectTwoPlayerMode(gameState.twoPlayerMode);
    createDifficultyButtons(); selectDifficulty(gameState.currentDifficulty);
    createControlSchemeButtons(); selectControlScheme(gameState.currentControlScheme);
    createShieldModeButtons(); selectShieldMode(gameState.shieldMode);
    createPauseModeButtons(); selectPauseMode(gameState.allowPause);
    createEnemyAsteroidCollisionButtons(); selectEnemyAsteroidCollisionMode(gameState.enemyFireDestroysAsteroids);

    const savedMusicVol = localStorage.getItem('musicVolume');
    const savedSfxVol = localStorage.getItem('sfxVolume');
    if (savedMusicVol !== null) setMusicVolume(parseFloat(savedMusicVol));
    if (savedSfxVol !== null) setSfxVolume(parseFloat(savedSfxVol));
    updateMusicVolumeUI(gameState.musicVolume);
    updateSfxVolumeUI(gameState.sfxVolume);

    displayHighScores();

    const firstVisibleButton = Array.from(document.querySelectorAll('#main-menu .menu-btn')).find(btn => btn.offsetParent !== null);
    firstVisibleButton?.classList.add('selected');

    setupMenuEventListeners();
    createMenuAsteroidBelt();
    startMenuMusic();

    requestAnimationFrame(menuLoop);
}

initMenu();