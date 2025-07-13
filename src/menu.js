// src/menu.js
// Handles all logic for the main menu page (index.html).

import assetManager from './systems/AssetManager.js';
import { gameState } from './state.js';
import { setCanvasSize } from './utils.js';
import { renderMenu } from './systems/RenderSystem.js';
import { createMenuAsteroidBelt } from './entities/environment.js';
// <<< THIS LINE IS FIXED
import {
    initAudio, startMenuMusic, setMusicVolume, setSfxVolume, isAudioInitialized, getAudioContext
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
        if (isAudioInitialized()) return; // <<< This now matches the corrected import
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

        if (!isAudioInitialized()) { // <<< This now matches the corrected import
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
    
    // Setup UI components and their default states (this is safe to do before loading)
    createGameModeButtons(); selectGameMode(gameState.gameMode);
    createTwoPlayerModeButtons(); selectTwoPlayerMode(gameState.twoPlayerMode);
    createDifficultyButtons(); selectDifficulty(gameState.currentDifficulty);
    createControlSchemeButtons(); selectControlScheme(gameState.currentControlScheme);
    createShieldModeButtons(); selectShieldMode(gameState.shieldMode);
    
    displayHighScores();
    setupMenuEventListeners();
    createMenuAsteroidBelt();

    // Start the main menu loop for background animation
    requestAnimationFrame(menuLoop);
    
    // --- New Loading Logic ---
    const subTitle = document.getElementById('sub-title');
    const startButton = document.getElementById('startButton');

    assetManager.loadAll().then(() => {
        console.log("All assets loaded successfully!");
        
        // Restore and display volume settings from localStorage
        const savedMusicVol = localStorage.getItem('musicVolume');
        const savedSfxVol = localStorage.getItem('sfxVolume');
        if (savedMusicVol !== null) setMusicVolume(parseFloat(savedMusicVol));
        if (savedSfxVol !== null) setSfxVolume(parseFloat(savedSfxVol));
        updateMusicVolumeUI(gameState.musicVolume);
        updateSfxVolumeUI(gameState.sfxVolume);

        // Update the UI to show that loading is complete
        subTitle.textContent = 'Select Options';
        startButton.disabled = false;
        
        // Add the 'selected' class to the first button
        const firstVisibleButton = Array.from(document.querySelectorAll('#main-menu .menu-btn')).find(btn => btn.offsetParent !== null);
        firstVisibleButton?.classList.add('selected');
        
        // Attempt to start music only after assets are loaded and user has interacted
        startMenuMusic();
        
    }).catch(error => {
        console.error("Failed to load assets:", error);
        subTitle.textContent = "Error: Failed to load assets. Please refresh.";
        subTitle.style.color = "#ff0000";
    });
}

initMenu();