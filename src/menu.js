// src/menu.js
// Handles all logic for the main menu page (index.html).

import { gameState } from './state.js';
import { setCanvasSize } from './utils.js';
import { renderMenu } from './systems/RenderSystem.js';
import { createMenuAsteroidBelt } from './entities/environment.js';
import {
    initAudio, startMenuMusic, setMusicVolume, setSfxVolume, isAudioInitalized, getAudioContext
} from './audio/audio.js';
import {
    createGameModeButtons, selectGameMode, createTwoPlayerModeButtons, selectTwoPlayerMode,
    createDifficultyButtons, selectDifficulty, createControlSchemeButtons, selectControlScheme,
    createShieldModeButtons, selectShieldMode, displayHighScores, toggleSoundMenu, toggleGameplayMenu,
    toggleControlsMenu, updateMusicVolumeUI, updateSfxVolumeUI
} from './ui/ui.js';
import { handleMenuGamepadInput } from './ui/input.js';

const canvas = document.getElementById('menuCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const controlsSettingsButton = document.getElementById('controlsSettingsButton');
const controlsBackButton = document.getElementById('controlsBackButton');
const soundSettingsButton = document.getElementById('soundSettingsButton');
const backButton = document.getElementById('backButton');
const gameplaySettingsButton = document.getElementById('gameplaySettingsButton');
const gameplayBackButton = document.getElementById('gameplayBackButton');

function setupMenuEventListeners() {
    async function initAudioOnFirstInteraction() {
        if (isAudioInitalized()) return;
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

        if (!isAudioInitalized()) {
            await initAudioOnFirstInteraction();
        } else if (getAudioContext()?.state === 'suspended') {
            try { await getAudioContext().resume(); }
            catch (err) { console.error("Could not resume audio context", err); }
        }

        // Save settings to sessionStorage
        const gameSettings = {
            difficulty: gameState.currentDifficulty,
            gameMode: gameState.gameMode,
            twoPlayerMode: gameState.twoPlayerMode,
            controlScheme: gameState.currentControlScheme,
            shieldMode: gameState.shieldMode
        };
        sessionStorage.setItem('gameSettings', JSON.stringify(gameSettings));
        
        // Redirect to game page
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
    handleMenuGamepadInput(); // Handles gamepad navigation in the menu
    requestAnimationFrame(menuLoop);
}

// --- INITIALIZATION ---
function initMenu() {
    setCanvasSize(canvas);
    
    // Setup UI components and their default states
    createGameModeButtons(); selectGameMode(gameState.gameMode);
    createTwoPlayerModeButtons(); selectTwoPlayerMode(gameState.twoPlayerMode);
    createDifficultyButtons(); selectDifficulty(gameState.currentDifficulty);
    createControlSchemeButtons(); selectControlScheme(gameState.currentControlScheme);
    createShieldModeButtons(); selectShieldMode(gameState.shieldMode);
    
    // Restore and display volume settings from localStorage if they exist
    const savedMusicVol = localStorage.getItem('musicVolume');
    const savedSfxVol = localStorage.getItem('sfxVolume');
    if (savedMusicVol !== null) setMusicVolume(parseFloat(savedMusicVol));
    if (savedSfxVol !== null) setSfxVolume(parseFloat(savedSfxVol));
    updateMusicVolumeUI(gameState.musicVolume); // Ensure UI matches state
    updateSfxVolumeUI(gameState.sfxVolume);     // Ensure UI matches state

    displayHighScores();

    const firstVisibleButton = Array.from(document.querySelectorAll('#main-menu .menu-btn')).find(btn => btn.offsetParent !== null);
    firstVisibleButton?.classList.add('selected');

    setupMenuEventListeners();
    createMenuAsteroidBelt();
    startMenuMusic(); // Attempt to start music if audio is already initialized
    
    requestAnimationFrame(menuLoop);
}

initMenu();