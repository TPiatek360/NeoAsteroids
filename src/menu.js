// src/menu.js
// Handles all logic for the main menu page (index.html).

import assetManager from './systems/AssetManager.js';
import { gameState } from './state.js';
import { setCanvasSize } from './utils.js';
import { renderMenu } from './systems/RenderSystem.js';
import { createMenuAsteroidBelt, createStarfield } from './entities/environment.js';
import {
    initAudio, startMenuMusic, setMusicVolume, setSfxVolume, isAudioInitialized, getAudioContext, playMenuSelectSound
} from './audio/audio.js';
import {
    createGameTypeButtons,
    createPlayerCountButtons, selectPlayerCount,
    createTwoPlayerModeButtons, selectTwoPlayerMode,
    createDifficultyButtons, selectDifficulty,
    createFlightModelButtons, selectFlightModel, // NEW
    createControlSchemeButtons, selectControlScheme,
    createShieldModeButtons, selectShieldMode,
    createEnemyFireEffectButtons, selectEnemyFireEffect,
    createPrimaryColorModeButtons,
    createMonochromeTypeButtons,
    selectPrimaryColorMode,
    selectMonochromeType,
    createCrtShaderButtons, selectCrtShader,
    createFilmGrainButtons, selectFilmGrain,
    createJitterButtons, selectJitter,
    createStarfieldButtons, selectStarfield,
    displayHighScores,
    updateMusicVolumeUI, updateSfxVolumeUI,
    applyVisualSettings, updateVFXSliderUI, setScanlineIntensity, setBloom, setCurvature, setMonoBrightness, setPersistence,
    updateChosenButton,
    getMainMenuElement, getGameplayMenuElement, getVideoMenuElement, 
    getSoundMenuElement, getControlsMenuElement, getCampaignMenuElement,
    showInGameAlert
} from './ui/ui.js';
import {
    getCampaignSummaries, startNewCampaign, loadCampaign, deleteCampaign
} from './campaign/campaignManager.js';
import { MUTATORS } from './mutators/index.js'; // CHANGED

const canvas = document.getElementById('menuCanvas');
const ctx = canvas.getContext('2d');

const startButton = document.getElementById('startButton');
const dailyChallengeButton = document.getElementById('dailyChallengeButton');
const gameplaySettingsButton = document.getElementById('gameplaySettingsButton');
const videoSettingsButton = document.getElementById('videoSettingsButton');
const soundSettingsButton = document.getElementById('soundSettingsButton');
const controlsSettingsButton = document.getElementById('controlsSettingsButton');
const gameplayBackButton = document.getElementById('gameplayBackButton');
const videoBackButton = document.getElementById('videoBackButton');
const soundBackButton = document.getElementById('backButton');
const controlsBackButton = document.getElementById('controlsBackButton');
const campaignBackButton = document.getElementById('campaignBackButton');
const campaignPlayerSelectorEl = document.getElementById('campaign-player-selector');
const campaignSlotButtons = [
    document.getElementById('campaign-slot-1'),
    document.getElementById('campaign-slot-2'),
    document.getElementById('campaign-slot-3')
];
const campaign1pButton = document.getElementById('campaign-1p-button');
const campaign2pButton = document.getElementById('campaign-2p-button');

const allMenuPanels = [
    getMainMenuElement(), getGameplayMenuElement(), getVideoMenuElement(),
    getSoundMenuElement(), getControlsMenuElement(), getCampaignMenuElement()
];

// --- NEW: Elements for the Load/Delete prompt and its overlay ---
let slotActionMenuEl = null; 
let menuOverlayEl = null;

const SETTINGS_KEY_PREFIX = 'neonAsteroidsSettings_';
const defaultSettings = {
    gameplay: { gameType: 'modern', playerCount: 1, twoPlayerMode: 'coop', currentDifficulty: 'normal', flightModel: 'arcade', shieldMode: 'regenerate', enemyFireEffect: 'passes' },
    video: { colorMode: 'color', shaders: { crt: false, scanlines: 0.2, bloom: 0, curvature: 0.03, filmGrain: false, jitter: false, starfield: true, persistence: 0 } },
    sound: { musicVolume: 0.4, sfxVolume: 1.0 },
    controls: { currentControlScheme: 'default' }
};

/**
 * A simple seeded pseudo-random number generator (Mulberry32).
 * @param {number} seed - The integer seed.
 * @returns {function} A function that returns a pseudo-random number between 0 and 1.
 */
function mulberry32(seed) {
    return function() {
      var t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

// --- NEW/MODIFIED: Functions to manage the slot action menu and overlay ---

function createSlotActionMenu() {
    if (document.getElementById('slot-action-menu')) return;

    // Create the overlay element
    menuOverlayEl = document.createElement('div');
    menuOverlayEl.id = 'menu-overlay';
    menuOverlayEl.className = 'hidden';
    document.body.appendChild(menuOverlayEl);

    // Create the menu panel itself
    slotActionMenuEl = document.createElement('div');
    slotActionMenuEl.id = 'slot-action-menu';
    slotActionMenuEl.className = 'menu-panel hidden';
    slotActionMenuEl.style.position = 'fixed';
    slotActionMenuEl.style.width = '300px';
    slotActionMenuEl.style.top = '50%';
    slotActionMenuEl.style.left = '50%';
    slotActionMenuEl.style.transform = 'translate(-50%, -50%)';
    slotActionMenuEl.style.zIndex = '100';

    slotActionMenuEl.innerHTML = `
        <h2 style="margin-bottom: 20px;">Slot Action</h2>
        <button id="slot-action-load" class="menu-btn">Load Game</button>
        <button id="slot-action-delete" class="menu-btn">Delete Save</button>
        <button id="slot-action-cancel" class="menu-btn" style="margin-top: 20px;">Cancel</button>
    `;
    
    document.body.appendChild(slotActionMenuEl);

    document.getElementById('slot-action-load').addEventListener('click', () => {
        const slot = parseInt(slotActionMenuEl.dataset.slot, 10);
        if (!slot) return;
        const campaignData = loadCampaign(slot);
        if (campaignData) {
            launchCampaign(campaignData, slot);
        }
        hideSlotActionMenu();
    });

    document.getElementById('slot-action-delete').addEventListener('click', () => {
        const slot = parseInt(slotActionMenuEl.dataset.slot, 10);
        if (!slot) return;
        
        hideSlotActionMenu();
        showInGameAlert(
            'Confirm Deletion',
            `Are you sure you want to permanently delete the save in Slot ${slot}? This cannot be undone.`,
            {
                onConfirm: () => {
                    deleteCampaign(slot);
                    updateCampaignSlotUI();
                },
                confirmText: 'DELETE',
                cancelText: 'CANCEL'
            }
        );
    });

    document.getElementById('slot-action-cancel').addEventListener('click', hideSlotActionMenu);
}

function showSlotActionMenu(slot) {
    if (!slotActionMenuEl || !menuOverlayEl) return;
    menuOverlayEl.classList.remove('hidden'); // Show the overlay
    slotActionMenuEl.dataset.slot = slot;
    slotActionMenuEl.classList.remove('hidden');
    gameState.uiMode = 'slotAction';

    const buttons = slotActionMenuEl.querySelectorAll('.menu-btn');
    buttons.forEach(b => b.classList.remove('selected'));
    buttons[0]?.classList.add('selected');
}

function hideSlotActionMenu() {
    if (!slotActionMenuEl || !menuOverlayEl) return;
    menuOverlayEl.classList.add('hidden'); // Hide the overlay
    slotActionMenuEl.classList.add('hidden');
    gameState.uiMode = 'menu';
}

function navigateSlotActionMenu(direction) {
    playMenuSelectSound();
    const visibleItems = Array.from(slotActionMenuEl.querySelectorAll('.menu-btn'));
    if (visibleItems.length === 0) return;

    let currentIndex = visibleItems.findIndex(item => item.classList.contains('selected'));
    if (currentIndex !== -1) {
        visibleItems[currentIndex].classList.remove('selected');
    } else {
        currentIndex = direction === 'down' ? -1 : 1;
    }

    let nextIndex = currentIndex + (direction === 'down' ? 1 : -1);
    nextIndex = (nextIndex + visibleItems.length) % visibleItems.length;
    visibleItems[nextIndex].classList.add('selected');
}

function showMenuPanel(panelIdToShow) {
    allMenuPanels.forEach(panel => {
        if (panel) panel.classList.toggle('hidden', panel.id !== panelIdToShow);
    });

    if (panelIdToShow === 'campaign-menu') {
        updateCampaignSlotUI();
        campaignPlayerSelectorEl.classList.add('hidden');
    }

    const panelToShowEl = document.getElementById(panelIdToShow);
    if (panelToShowEl) {
        document.querySelectorAll('.menu-btn.selected, .slider-container.selected').forEach(b => b.classList.remove('selected'));
        const firstVisibleButton = Array.from(panelToShowEl.querySelectorAll('.menu-btn, .slider-container')).find(btn => btn.offsetParent !== null);
        firstVisibleButton?.classList.add('selected');
    }
}

function getCurrentMenu() {
    return allMenuPanels.find(panel => panel && !panel.classList.contains('hidden'));
}

function navigateMenu(direction) {
    playMenuSelectSound();
    const scrollContainer = getCurrentMenu();
    if (!scrollContainer) return;

    const allItems = Array.from(scrollContainer.querySelectorAll('.menu-btn, .slider-container'));
    const visibleItems = allItems.filter(item => item.offsetParent !== null);
    if (visibleItems.length === 0) return;

    let currentIndex = visibleItems.findIndex(item => item.classList.contains('selected'));
    if (currentIndex !== -1) {
        visibleItems[currentIndex].classList.remove('selected');
    } else {
        currentIndex = direction === 'down' ? -1 : 1;
    }

    let nextIndex = currentIndex + (direction === 'down' ? 1 : -1);
    nextIndex = (nextIndex + visibleItems.length) % visibleItems.length;
    const newItem = visibleItems[nextIndex];
    newItem.classList.add('selected');

    const containerRect = scrollContainer.getBoundingClientRect();
    const itemRect = newItem.getBoundingClientRect();

    if (itemRect.bottom > containerRect.bottom) {
        scrollContainer.scrollTop += itemRect.bottom - containerRect.bottom;
    } else if (itemRect.top < containerRect.top) {
        scrollContainer.scrollTop -= containerRect.top - itemRect.top;
    }
}

function handleMenuInteraction() {
    const selectedItem = document.querySelector('.menu-panel:not(.hidden) .selected, #slot-action-menu:not(.hidden) .selected');
    if (!selectedItem) return;
    if (selectedItem.classList.contains('slider-container')) {
        gameState.menuInputMode = 'editSlider';
        selectedItem.classList.add('editing');
        playMenuSelectSound();
    } else {
        selectedItem.click();
    }
}

function handleBackButton() {
    if (gameState.uiMode === 'slotAction') {
        hideSlotActionMenu();
        return;
    }
    const currentMenu = getCurrentMenu();
    if (!currentMenu) return;
    if (currentMenu.id === 'campaign-menu') {
        showMenuPanel('gameplay-menu');
        return;
    }
    const backButton = currentMenu.querySelector('.menu-btn[id$="BackButton"], .menu-btn[id$="backButton"]');
    if (backButton) {
        backButton.click();
    } else {
        showMenuPanel('main-menu');
    }
}

function launchCampaign(campaignData, slotNum) {
    sessionStorage.setItem('campaignRunData', JSON.stringify(campaignData));
    sessionStorage.setItem('activeCampaignSlot', slotNum);

    const gameSettings = {
        gameType: 'campaign',
        controlScheme: gameState.currentControlScheme,
        colorMode: gameState.colorMode,
        shaders: gameState.shaders,
        flightModel: gameState.flightModel // Ensure this is carried over
    };
    sessionStorage.setItem('gameSettings', JSON.stringify(gameSettings));

    window.location.href = 'game.html';
}

function updateCampaignSlotUI() {
    const summaries = getCampaignSummaries();
    summaries.forEach((summary, index) => {
        const button = campaignSlotButtons[index];
        if (button) {
            if (summary) {
                button.textContent = `Level: ${summary.level} - ${summary.playerCount}P`;
                button.dataset.hasSave = "true";
            } else {
                button.textContent = 'New Game';
                button.dataset.hasSave = "false";
            }
        }
    });
}

function handleNewCampaignStart(playerCount) {
    const slot = parseInt(campaignPlayerSelectorEl.dataset.slot, 10);
    if (!slot) return;
    const campaignData = startNewCampaign(slot, playerCount, gameState.currentDifficulty);
    launchCampaign(campaignData, slot);
}

function showNotification(message, isSuccess = true) {
    const subTitle = document.getElementById('sub-title');
    if (!subTitle || subTitle.dataset.isNotifying) return;
    const originalText = subTitle.textContent;
    const originalColor = subTitle.style.color;
    const originalShadow = subTitle.style.textShadow;
    subTitle.dataset.isNotifying = 'true';
    subTitle.textContent = message;
    subTitle.style.color = isSuccess ? '#7fff00' : '#ffaa00';
    subTitle.style.textShadow = isSuccess ? '0 0 5px #7fff00' : '0 0 5px #ffaa00';
    setTimeout(() => {
        subTitle.textContent = originalText;
        subTitle.style.color = originalColor;
        subTitle.style.textShadow = originalShadow;
        delete subTitle.dataset.isNotifying;
    }, 2000);
}

function saveSettings(category) {
    const settingsToSave = {};
    for (const key in defaultSettings[category]) {
        if (key === 'shaders') {
            settingsToSave.shaders = { ...gameState.shaders };
        } else {
            settingsToSave[key] = gameState[key];
        }
    }
    localStorage.setItem(SETTINGS_KEY_PREFIX + category, JSON.stringify(settingsToSave));
}

function loadAllSettings() {
    for (const category in defaultSettings) {
        const categoryDefaults = JSON.parse(JSON.stringify(defaultSettings[category]));
        Object.assign(gameState, categoryDefaults);
        if (categoryDefaults.shaders) {
            Object.assign(gameState.shaders, categoryDefaults.shaders);
        }
        try {
            const savedJSON = localStorage.getItem(SETTINGS_KEY_PREFIX + category);
            if (savedJSON) {
                const savedSettings = JSON.parse(savedJSON);
                Object.assign(gameState, savedSettings);
                if (savedSettings.shaders) {
                    gameState.shaders = { ...categoryDefaults.shaders, ...savedSettings.shaders };
                }
            }
        } catch (e) {
            console.error(`Failed to load ${category} settings, using defaults.`, e);
            localStorage.removeItem(SETTINGS_KEY_PREFIX + category);
        }
    }
}

function restoreDefaults(category) {
    const defaults = defaultSettings[category];
    const defaultsCopy = JSON.parse(JSON.stringify(defaults));
    Object.assign(gameState, defaultsCopy);
    if (defaultsCopy.shaders) {
        Object.assign(gameState.shaders, defaultsCopy.shaders);
    }
    updateUIFromState();
    showNotification('Defaults Restored!');
}

function updateUIFromState() {
    updateChosenButton(document.getElementById('game-type-selector'), gameState.gameType);
    selectPlayerCount(gameState.playerCount);
    selectTwoPlayerMode(gameState.twoPlayerMode);
    selectDifficulty(gameState.currentDifficulty);
    selectFlightModel(gameState.flightModel); // NEW
    selectShieldMode(gameState.shieldMode);
    selectEnemyFireEffect(gameState.enemyFireEffect);
    
    if (gameState.colorMode === 'color') {
        selectPrimaryColorMode('color');
    } else {
        selectPrimaryColorMode('mono');
        selectMonochromeType(gameState.colorMode);
    }

    selectCrtShader(gameState.shaders.crt);
    selectFilmGrain(gameState.shaders.filmGrain);
    selectJitter(gameState.shaders.jitter);
    selectStarfield(gameState.shaders.starfield);
    updateVFXSliderUI();
    applyVisualSettings();
    
    setMusicVolume(gameState.musicVolume);
    setSfxVolume(gameState.sfxVolume);
    updateMusicVolumeUI(gameState.musicVolume);
    updateSfxVolumeUI(gameState.sfxVolume);

    selectControlScheme(gameState.currentControlScheme);
}

function handleMenuGamepadInput() {
    const gp = navigator.getGamepads()[0];
    if (!gp) return;
    
    if (gameState.uiMode === 'alert') {
        const confirmBtn = gp.buttons[0];
        const backBtn = gp.buttons[1];
        if (confirmBtn?.pressed && !gameState.gamepadButtonsPressed[0]) {
            document.querySelector('#alert-screen .menu-btn.selected')?.click();
        }
        if (backBtn?.pressed && !gameState.gamepadButtonsPressed[1]) {
            document.getElementById('alert-cancel-button')?.click();
        }
        gameState.gamepadButtonsPressed[0] = confirmBtn?.pressed;
        gameState.gamepadButtonsPressed[1] = backBtn?.pressed;
        return;
    }

    if (gameState.uiMode === 'slotAction') {
        const confirmBtn = gp.buttons[0];
        const backBtn = gp.buttons[1];
        const dpadUp = gp.buttons[12];
        const dpadDown = gp.buttons[13];
        if (dpadUp?.pressed && !gameState.gamepadButtonsPressed[12]) navigateSlotActionMenu('up');
        if (dpadDown?.pressed && !gameState.gamepadButtonsPressed[13]) navigateSlotActionMenu('down');
        if (confirmBtn?.pressed && !gameState.gamepadButtonsPressed[0]) document.querySelector('#slot-action-menu .selected')?.click();
        if (backBtn?.pressed && !gameState.gamepadButtonsPressed[1]) hideSlotActionMenu();
        gameState.gamepadButtonsPressed[0] = confirmBtn?.pressed;
        gameState.gamepadButtonsPressed[1] = backBtn?.pressed;
        gameState.gamepadButtonsPressed[12] = dpadUp?.pressed;
        gameState.gamepadButtonsPressed[13] = dpadDown?.pressed;
        return;
    }

    const confirmBtn = gp.buttons[0];
    const backBtn = gp.buttons[1];
    const startBtn = gp.buttons[9];
    const dpadUp = gp.buttons[12];
    const dpadDown = gp.buttons[13];
    const dpadLeft = gp.buttons[14];
    const dpadRight = gp.buttons[15];
    if (gameState.menuInputMode === 'editSlider') {
        const activeSliderContainer = document.querySelector('.slider-container.editing');
        if (!activeSliderContainer) {
            gameState.menuInputMode = 'navigate';
            return;
        }
        const slider = activeSliderContainer.querySelector('.custom-slider');
        if (dpadLeft?.pressed) {
            slider.stepDown();
            slider.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (dpadRight?.pressed) {
            slider.stepUp();
            slider.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if ((backBtn?.pressed && !gameState.gamepadButtonsPressed[1]) || (confirmBtn?.pressed && !gameState.gamepadButtonsPressed[0])) {
            gameState.menuInputMode = 'navigate';
            activeSliderContainer.classList.remove('editing');
            playMenuSelectSound();
        }
    } else {
        if (dpadUp?.pressed && !gameState.gamepadButtonsPressed[12]) navigateMenu('up');
        if (dpadDown?.pressed && !gameState.gamepadButtonsPressed[13]) navigateMenu('down');
        if ((startBtn?.pressed && !gameState.gamepadButtonsPressed[9]) || (confirmBtn?.pressed && !gameState.gamepadButtonsPressed[0])) handleMenuInteraction();
        if (backBtn?.pressed && !gameState.gamepadButtonsPressed[1]) handleBackButton();
    }
    gameState.gamepadButtonsPressed[0] = confirmBtn?.pressed;
    gameState.gamepadButtonsPressed[1] = backBtn?.pressed;
    gameState.gamepadButtonsPressed[9] = startBtn?.pressed;
    gameState.gamepadButtonsPressed[12] = dpadUp?.pressed;
    gameState.gamepadButtonsPressed[13] = dpadDown?.pressed;
    gameState.gamepadButtonsPressed[14] = dpadLeft?.pressed;
    gameState.gamepadButtonsPressed[15] = dpadRight?.pressed;
}

function menuLoop() {
    if (gameState.shaders.starfield) {
        for (const star of gameState.starfield) {
            star.x += star.dx;
            star.y += star.dy;
            if (star.x < 0) star.x = canvas.width;
            if (star.x > canvas.width) star.x = 0;
            if (star.y < 0) star.y = canvas.height;
            if (star.y > canvas.height) star.y = 0;
        }
    }
    handleMenuGamepadInput();
    renderMenu(gameState, ctx);
    requestAnimationFrame(menuLoop);
}

function setupMenuEventListeners() {
    async function initAudioOnFirstInteraction() {
        if (isAudioInitialized()) return;
        try { await initAudio(); startMenuMusic(); }
        catch (err) { console.error("Failed to initialize audio.", err); }
    }

    window.addEventListener('keydown', (e) => {
        initAudioOnFirstInteraction();
        if (gameState.uiMode === 'alert') {
            if (e.key === 'Escape') {
                 e.preventDefault();
                 document.getElementById('alert-cancel-button')?.click();
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                document.querySelector('#alert-screen .menu-btn.selected')?.click();
            }
            if(e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                 e.preventDefault();
                 const buttons = Array.from(document.querySelectorAll('#alert-screen .menu-btn:not(.hidden)'));
                 const currentIndex = buttons.findIndex(b => b.classList.contains('selected'));
                 if (currentIndex !== -1) {
                     buttons[currentIndex].classList.remove('selected');
                     const nextIndex = (currentIndex + 1) % buttons.length;
                     buttons[nextIndex].classList.add('selected');
                 }
            }
            return;
        }
        if (gameState.uiMode === 'slotAction') {
            switch(e.key) {
                case 'ArrowUp': e.preventDefault(); navigateSlotActionMenu('up'); break;
                case 'ArrowDown': e.preventDefault(); navigateSlotActionMenu('down'); break;
                case 'Enter': e.preventDefault(); document.querySelector('#slot-action-menu .selected')?.click(); break;
                case 'Escape': e.preventDefault(); hideSlotActionMenu(); break;
            }
            return;
        }
        if (gameState.menuInputMode === 'editSlider') return;
        switch(e.key) {
            case 'ArrowUp': e.preventDefault(); navigateMenu('up'); break;
            case 'ArrowDown': e.preventDefault(); navigateMenu('down'); break;
            case 'Enter': e.preventDefault(); handleMenuInteraction(); break;
            case 'Escape': e.preventDefault(); handleBackButton(); break;
        }
    });

    window.addEventListener('click', initAudioOnFirstInteraction, { once: true });

    startButton.addEventListener('click', async () => {
        if (startButton.disabled) return;
        
        const launchingScreen = document.getElementById('launching-screen');
        if (launchingScreen) {
            launchingScreen.classList.remove('hidden');
        }

        gameState.gameType = 'modern';

        startButton.disabled = true;
        if (!isAudioInitialized()) { await initAudioOnFirstInteraction(); }
        else if (getAudioContext()?.state === 'suspended') {
            try { await getAudioContext().resume(); }
            catch (err) { console.error("Could not resume audio context", err); }
        }
        const gameSettings = {
            difficulty: gameState.currentDifficulty,
            flightModel: gameState.flightModel, // NEW
            controlScheme: gameState.currentControlScheme,
            shieldMode: gameState.shieldMode,
            enemyFireEffect: gameState.enemyFireEffect,
            gameType: gameState.gameType,
            playerCount: gameState.playerCount,
            twoPlayerMode: gameState.twoPlayerMode,
            colorMode: gameState.colorMode,
            shaders: gameState.shaders,
        };
        sessionStorage.setItem('gameSettings', JSON.stringify(gameSettings));
        window.location.href = 'game.html';
    });

    dailyChallengeButton.addEventListener('click', () => {
        // 1. Create a seed from the current date (UTC)
        const dateSeedStr = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
        let numSeed = 0;
        for (let i = 0; i < dateSeedStr.length; i++) {
            numSeed = (numSeed << 5) - numSeed + dateSeedStr.charCodeAt(i);
            numSeed |= 0; // Convert to 32bit integer
        }
        
        const prng = mulberry32(numSeed);
        
        // 2. Get and shuffle all possible mutator keys using the seeded PRNG
        const allMutatorKeys = Object.keys(MUTATORS);
        for (let i = allMutatorKeys.length - 1; i > 0; i--) {
            const j = Math.floor(prng() * (i + 1));
            [allMutatorKeys[i], allMutatorKeys[j]] = [allMutatorKeys[j], allMutatorKeys[i]];
        }
        
        // 3. Select 2-3 compatible mutators
        const selectedMutators = [];
        const conflicted = new Set();
        const numToSelect = Math.floor(prng() * 2) + 2; // Select 2 or 3

        for (const key of allMutatorKeys) {
            if (selectedMutators.length >= numToSelect) break;

            if (!conflicted.has(key)) {
                selectedMutators.push({
                    key: key,
                    description: MUTATORS[key].description
                });
                // Add its conflicts to the set for future checks
                MUTATORS[key].conflictsWith.forEach(conflictKey => conflicted.add(conflictKey));
            }
        }
        
        console.log("Daily Challenge Mutators for " + dateSeedStr, selectedMutators);
        
        // 4. Launch the game with these settings
        const gameSettings = {
			gameType: 'daily',
			// CHANGED: We now only need to store the KEYS of the selected mutators.
			activeMutatorKeys: selectedMutators.map(m => m.key),  // Pass keys and descriptions
            // Carry over player's standard settings
            difficulty: gameState.currentDifficulty,
            flightModel: gameState.flightModel,
            controlScheme: gameState.currentControlScheme,
            shieldMode: gameState.shieldMode,
            enemyFireEffect: gameState.enemyFireEffect,
            colorMode: gameState.colorMode,
            shaders: gameState.shaders,
            playerCount: 1, // Dailies are single-player for leaderboard integrity
        };
        sessionStorage.setItem('gameSettings', JSON.stringify(gameSettings));
		window.location.href = 'game.html';
    });

    gameplaySettingsButton.addEventListener('click', () => showMenuPanel('gameplay-menu'));
    gameplayBackButton.addEventListener('click', () => showMenuPanel('main-menu'));
    videoSettingsButton.addEventListener('click', () => showMenuPanel('video-menu'));
    videoBackButton.addEventListener('click', () => showMenuPanel('main-menu'));
    soundSettingsButton.addEventListener('click', () => showMenuPanel('sound-menu'));
    soundBackButton.addEventListener('click', () => showMenuPanel('main-menu'));
    controlsSettingsButton.addEventListener('click', () => showMenuPanel('controls-menu'));
    controlsBackButton.addEventListener('click', () => showMenuPanel('main-menu'));
    campaignBackButton.addEventListener('click', () => showMenuPanel('gameplay-menu'));

    campaignSlotButtons.forEach(button => {
        button.addEventListener('click', () => {
            const hasSave = button.dataset.hasSave === "true";
            const slot = parseInt(button.id.split('-')[2], 10);
            
            if (hasSave) {
                showSlotActionMenu(slot);
            } else {
                campaignPlayerSelectorEl.classList.remove('hidden');
                campaignPlayerSelectorEl.dataset.slot = slot;
            }
        });
    });

    campaign1pButton.addEventListener('click', () => handleNewCampaignStart(1));
    campaign2pButton.addEventListener('click', () => handleNewCampaignStart(2));

    window.addEventListener('resize', () => { setCanvasSize(canvas); if (gameState.shaders.starfield) createStarfield(); });
    document.getElementById('scanline-slider')?.addEventListener('input', (e) => setScanlineIntensity(e.target.value));
    document.getElementById('bloom-slider')?.addEventListener('input', (e) => setBloom(e.target.value));
    document.getElementById('curvature-slider')?.addEventListener('input', (e) => setCurvature(e.target.value));
    document.getElementById('brightness-slider')?.addEventListener('input', (e) => setMonoBrightness(e.target.value));
    document.getElementById('persistence-slider')?.addEventListener('input', (e) => setPersistence(e.target.value));

    document.getElementById('music-volume-slider')?.addEventListener('input', (e) => {
        setMusicVolume(e.target.value);
        updateMusicVolumeUI(e.target.value);
    });
    document.getElementById('sfx-volume-slider')?.addEventListener('input', (e) => {
        setSfxVolume(e.target.value);
        updateSfxVolumeUI(e.target.value);
    });
    
    window.addEventListener('settingChanged', (e) => {
        if (e.detail && e.detail.category) {
            saveSettings(e.detail.category);
        }
    });

    document.getElementById('saveGameplayButton')?.addEventListener('click', () => { saveSettings('gameplay'); showNotification('Settings Saved!'); });
    document.getElementById('defaultsGameplayButton')?.addEventListener('click', () => restoreDefaults('gameplay'));
    document.getElementById('saveVideoButton')?.addEventListener('click', () => { saveSettings('video'); showNotification('Settings Saved!'); });
    document.getElementById('defaultsVideoButton')?.addEventListener('click', () => restoreDefaults('video'));
    document.getElementById('saveControlsButton')?.addEventListener('click', () => { saveSettings('controls'); showNotification('Settings Saved!'); });
    document.getElementById('defaultsControlsButton')?.addEventListener('click', () => restoreDefaults('controls'));
    document.getElementById('saveSoundButton')?.addEventListener('click', () => { saveSettings('sound'); showNotification('Settings Saved!'); });
    document.getElementById('defaultsSoundButton')?.addEventListener('click', () => restoreDefaults('sound'));
}

function initMenu() {
    setCanvasSize(canvas);
    loadAllSettings();
    createSlotActionMenu();
    const gameTypeClickHandler = (key) => {
        gameState.gameType = key;
        updateChosenButton(document.getElementById('game-type-selector'), key);
        if (key === 'campaign') {
            showMenuPanel('campaign-menu');
        }
    };
    createGameTypeButtons(gameTypeClickHandler);
    createPlayerCountButtons();
    createTwoPlayerModeButtons();
    createDifficultyButtons();
    createFlightModelButtons(); // NEW
    createShieldModeButtons();
    createEnemyFireEffectButtons();
    createPrimaryColorModeButtons();
    createMonochromeTypeButtons();
    createCrtShaderButtons();
    createFilmGrainButtons();
    createJitterButtons();
    createStarfieldButtons();
    createControlSchemeButtons();
    updateUIFromState();
    displayHighScores();
    setupMenuEventListeners();
    createMenuAsteroidBelt();
    requestAnimationFrame(menuLoop);
    const subTitle = document.getElementById('sub-title');
    const startButton = document.getElementById('startButton');
    assetManager.loadAll().then(() => {
        console.log("All assets loaded successfully!");
        subTitle.textContent = 'Select Options';
        startButton.disabled = false;
        showMenuPanel('main-menu');
        startMenuMusic();
    }).catch(error => {
        console.error("Failed to load assets:", error);
        subTitle.textContent = "Error: Failed to load assets. Please refresh.";
        subTitle.style.color = "#ff0000";
    });
}

document.addEventListener('DOMContentLoaded', initMenu);