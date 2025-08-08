// src/ui/ui.js
// Manages all DOM elements and UI updates.

import { gameState } from '../state.js';
import { DIFFICULTY_SETTINGS, GAME_HARD_CAP_LIVES, GAME_HARD_CAP_MISSILES } from '../constants.js';
import { executeCommand } from '../systems/DevConsole.js';

// --- Element Selectors ---
export const canvas = document.getElementById('gameCanvas') || document.getElementById('menuCanvas');
export const ctx    = canvas ? canvas.getContext('2d') : null;

// Game Page Elements
const gameOverScreenEl      = document.getElementById('game-over-screen');
const gameOverTitleEl       = document.getElementById('game-over-title');
const gameOverSubtitleEl    = document.getElementById('game-over-subtitle');
const initialEntryScreenEl  = document.getElementById('initial-entry-screen');
const finalScoreDisplayEl   = document.getElementById('final-score-display');
const charBox0              = document.getElementById('char-box-0');
const charBox1              = document.getElementById('char-box-1');
const charBox2              = document.getElementById('char-box-2');
const pauseScreenEl         = document.getElementById('pause-screen');
const hangarScreenEl        = document.getElementById('hangar-screen');
const hangarMainContentEl   = document.getElementById('hangar-main-content');
const devConsoleContainerEl = document.getElementById('dev-console-container');
const devConsoleInputEl     = document.getElementById('dev-console-input');
const devConsoleOutputEl    = document.getElementById('dev-console-output');


// --- Pause Menu Panels (dynamically created) ---
let pauseGraphicsScreen, pauseSoundScreen, pauseGameplayScreen;

// Menu Page Elements
const mainMenuEl      = document.getElementById('main-menu');
const gameplayMenuEl  = document.getElementById('gameplay-menu');
const videoMenuEl     = document.getElementById('video-menu');
const soundMenuEl     = document.getElementById('sound-menu');
const controlsMenuEl  = document.getElementById('controls-menu');
const campaignMenuEl  = document.getElementById('campaign-menu');

// Alert Screen Elements
const alertScreenEl   = document.getElementById('alert-screen');
const alertTitleEl    = document.getElementById('alert-title');
const alertMessageEl  = document.getElementById('alert-message');
const alertOkButtonEl = document.getElementById('alert-ok-button');
const alertButtonsContainerEl = document.createElement('div');
alertButtonsContainerEl.style.marginTop = '20px';
let alertCancelButtonEl = null;

// Menu Selectors
const gameWrapperEl                    = document.getElementById('game-wrapper');
const gameTypeSelectorEl               = document.getElementById('game-type-selector');
const playerCountSelectorEl            = document.getElementById('player-count-selector');
const twoPlayerModeSelectorContainerEl = document.getElementById('two-player-mode-selector-container');
const twoPlayerModeSelectorEl          = document.getElementById('two-player-mode-selector');
const difficultySelectorEl             = document.getElementById('difficulty-selector');
const flightModelSelectorEl            = document.getElementById('flight-model-selector'); // NEW
const shieldModeSelectorEl             = document.getElementById('shield-mode-selector');
const enemyFireEffectSelectorEl        = document.getElementById('enemy-fire-effect-selector');
const primaryColorModeSelectorEl       = document.getElementById('primary-color-mode-selector');
const monochromeOptionsContainerEl     = document.getElementById('monochrome-options-container');
const monochromeTypeSelectorEl         = document.getElementById('monochrome-type-selector');
const crtShaderSelectorEl              = document.getElementById('crt-shader-selector');
const filmGrainSelectorEl              = document.getElementById('film-grain-selector');
const jitterSelectorEl                 = document.getElementById('jitter-selector');
const starfieldSelectorEl              = document.getElementById('starfield-selector');
const controlSchemeSelectorEl          = document.getElementById('control-scheme-selector');
const crtOverlayEl                     = document.getElementById('crt-overlay');

// Sound & VFX Sliders (Main Menu)
const musicVolumeSlider      = document.getElementById('music-volume-slider');
const sfxVolumeSlider        = document.getElementById('sfx-volume-slider');
const scanlineSlider         = document.getElementById('scanline-slider');
const bloomSlider            = document.getElementById('bloom-slider');
const curvatureSlider        = document.getElementById('curvature-slider');
const brightnessSlider       = document.getElementById('brightness-slider');
const persistenceSlider      = document.getElementById('persistence-slider');
const highScoreListEl        = document.getElementById('high-score-list');

// --- UPGRADE SHOP DEFINITIONS ---
const UPGRADES = {
    repair: { name: 'Repair Hull (+1 Life)', cost: 500, type: 'consumable' },
    missile: { name: 'Restock Missile (+1)', cost: 100, type: 'consumable' },
    maxLives: { name: 'Reinforce Hull (+1 Max)', cost: 2500, type: 'permanent', key: 'maxLives', cap: GAME_HARD_CAP_LIVES },
    maxMissiles: { name: 'Expand Missile Bay (+1 Max)', cost: 1500, type: 'permanent', key: 'maxMissiles', cap: GAME_HARD_CAP_MISSILES }
};

// --- HELPER to make UI functions work for both menus ---
function getEl(id, prefix = '') { return document.getElementById(`${prefix}${id}`); }

// --- PAUSE MENU PANEL CREATION ---
function createPauseMenuPanels() {
    if (document.getElementById('pause-graphics-screen')) return; 

    // Graphics Panel
    pauseGraphicsScreen = document.createElement('div');
    pauseGraphicsScreen.id = 'pause-graphics-screen';
    pauseGraphicsScreen.className = 'pause-options-screen hidden';
    pauseGraphicsScreen.innerHTML = `
      <div id="pause-graphics-panel" class="menu-panel">
        <h1 style="font-size: 2.5em; margin-bottom: 20px;">Graphics Options</h1>
        <div class="menu-section"><p class="menu-section-title">DISPLAY MODE</p><div id="pause-primary-color-mode-selector"></div></div>
        <div id="pause-monochrome-options-container" class="hidden">
            <div class="menu-section"><p class="menu-section-title">MONOCHROME TYPE</p><div id="pause-monochrome-type-selector"></div></div>
            <div id="pause-brightness-slider-container" class="slider-container">
                <label for="pause-brightness-slider">Brightness <span id="pause-brightness-value-text" class="value-text"></span></label>
                <div class="slider-wrapper"><div id="pause-brightness-fill" class="slider-fill"></div><input type="range" id="pause-brightness-slider" class="custom-slider" min="0.7" max="1.8" step="0.05"></div>
            </div>
        </div>
        <div class="menu-section"><p class="menu-section-title" style="margin-bottom: 10px;">CRT SCANLINES</p><div id="pause-crt-shader-selector"></div></div>
        <div class="menu-section"><p class="menu-section-title" style="margin-bottom: 10px;">FILM GRAIN & SCRATCHES</p><div id="pause-film-grain-selector"></div></div>
        <div class="menu-section"><p class="menu-section-title" style="margin-bottom: 10px;">CRT JITTER</p><div id="pause-jitter-selector"></div></div>
        <div class="menu-section"><p class="menu-section-title" style="margin-bottom: 10px;">PARALLAX STARFIELD</p><div id="pause-starfield-selector"></div></div>
        <div class="slider-container"><label for="pause-scanline-slider">Scanline Intensity <span id="pause-scanline-value-text" class="value-text"></span></label><div class="slider-wrapper"><div id="pause-scanline-fill" class="slider-fill"></div><input type="range" id="pause-scanline-slider" class="custom-slider" min="0" max="1" step="0.05"></div></div>
        <div class="slider-container"><label for="pause-bloom-slider">Bloom <span id="pause-bloom-value-text" class="value-text"></span></label><div class="slider-wrapper"><div id="pause-bloom-fill" class="slider-fill"></div><input type="range" id="pause-bloom-slider" class="custom-slider" min="0" max="5" step="0.1"></div></div>
        <div class="slider-container"><label for="pause-curvature-slider">Screen Curvature <span id="pause-curvature-value-text" class="value-text"></span></label><div class="slider-wrapper"><div id="pause-curvature-fill" class="slider-fill"></div><input type="range" id="pause-curvature-slider" class="custom-slider" min="0" max="0.1" step="0.005"></div></div>
        <div class="slider-container"><label for="pause-persistence-slider">Phosphor Decay <span id="pause-persistence-value-text" class="value-text"></span></label><div class="slider-wrapper"><div id="pause-persistence-fill" class="slider-fill"></div><input type="range" id="pause-persistence-slider" class="custom-slider" min="0" max="0.95" step="0.05"></div></div>
        <button id="pause-graphics-done" class="menu-btn" style="margin-top: 30px;">Done</button>
      </div>
    `;
    
    // Sound Panel
    pauseSoundScreen = document.createElement('div');
    pauseSoundScreen.id = 'pause-sound-screen';
    pauseSoundScreen.className = 'pause-options-screen hidden';
    pauseSoundScreen.innerHTML = `
      <div id="pause-sound-panel" class="menu-panel">
        <h1 style="font-size: 2.5em; margin-bottom: 40px;">Sound Options</h1>
        <div class="slider-container"><label for="pause-music-volume-slider">Music Volume</label><div class="slider-wrapper"><div id="pause-music-volume-fill" class="slider-fill"></div><span id="pause-music-volume-text" class="volume-text"></span><input type="range" id="pause-music-volume-slider" class="custom-slider" min="0" max="1" step="0.05"></div></div>
        <div class="slider-container"><label for="pause-sfx-volume-slider">SFX Volume</label><div class="slider-wrapper"><div id="pause-sfx-volume-fill" class="slider-fill"></div><span id="pause-sfx-volume-text" class="volume-text"></span><input type="range" id="pause-sfx-volume-slider" class="custom-slider" min="0" max="1" step="0.05"></div></div>
        <button id="pause-sound-done" class="menu-btn" style="margin-top: 30px;">Done</button>
      </div>
    `;

    // Gameplay Panel
    pauseGameplayScreen = document.createElement('div');
    pauseGameplayScreen.id = 'pause-gameplay-screen';
    pauseGameplayScreen.className = 'pause-options-screen hidden';
    pauseGameplayScreen.innerHTML = `
      <div id="pause-gameplay-panel" class="menu-panel">
        <h1 style="font-size: 2.5em; margin-bottom: 20px;">Gameplay Options</h1>
        <div class="menu-section"><p class="menu-section-title">DIFFICULTY</p><div id="pause-difficulty-selector"></div></div>
        <div class="menu-section"><p class="menu-section-title">FLIGHT MODEL</p><div id="pause-flight-model-selector"></div></div>
        <div class="menu-section"><p class="menu-section-title">SHIELD MODE</p><div id="pause-shield-mode-selector"></div></div>
        <div class="menu-section"><p class="menu-section-title">ENEMY FIRE EFFECTS</p><div id="pause-enemy-fire-effect-selector"></div></div>
        <button id="pause-gameplay-done" class="menu-btn" style="margin-top: 30px;">Done</button>
      </div>
    `;

    const wrapper = document.getElementById('game-wrapper');
    if (wrapper) {
        wrapper.appendChild(pauseGraphicsScreen);
        wrapper.appendChild(pauseSoundScreen);
        wrapper.appendChild(pauseGameplayScreen);

        getEl('pause-graphics-done')?.addEventListener('click', closePauseOptions);
        getEl('pause-sound-done')?.addEventListener('click', closePauseOptions);
        getEl('pause-gameplay-done')?.addEventListener('click', closePauseOptions);

        getEl('pause-scanline-slider')?.addEventListener('input', (e) => setScanlineIntensity(e.target.value));
        getEl('pause-bloom-slider')?.addEventListener('input', (e) => setBloom(e.target.value));
        getEl('pause-curvature-slider')?.addEventListener('input', (e) => setCurvature(e.target.value));
        getEl('pause-brightness-slider')?.addEventListener('input', (e) => setMonoBrightness(e.target.value));
        getEl('pause-persistence-slider')?.addEventListener('input', (e) => setPersistence(e.target.value));
        
        getEl('pause-music-volume-slider')?.addEventListener('input', async (e) => {
            const audioModule = await import('../audio/audio.js');
            audioModule.setMusicVolume(e.target.value);
            updateMusicVolumeUI(e.target.value, 'pause-');
        });
        getEl('pause-sfx-volume-slider')?.addEventListener('input', async (e) => {
            const audioModule = await import('../audio/audio.js');
            audioModule.setSfxVolume(e.target.value);
            updateSfxVolumeUI(e.target.value, 'pause-');
        });
        
        createButtons(getEl('pause-difficulty-selector'), Object.fromEntries(Object.keys(DIFFICULTY_SETTINGS).map(key => [key, DIFFICULTY_SETTINGS[key].label])), (key) => selectDifficulty(key, 'pause-'));
        createButtons(getEl('pause-flight-model-selector'), { 'arcade': 'Arcade', 'newtonian': 'Newtonian' }, (key) => selectFlightModel(key, 'pause-'));
        createButtons(getEl('pause-shield-mode-selector'), { 'regenerate': 'Regenerating Shield', 'pickup': 'Shield Pickups Only' }, (key) => selectShieldMode(key, 'pause-'));
        createButtons(getEl('pause-enemy-fire-effect-selector'), { 'passes': 'Passes Through Asteroids', 'blocked': 'Blocked By Asteroids', 'destroys': 'Destroys Asteroids' }, (key) => selectEnemyFireEffect(key, 'pause-'));
        createButtons(getEl('pause-primary-color-mode-selector'), { 'color': 'Color', 'mono': 'Monochrome' }, (key) => selectPrimaryColorMode(key, 'pause-'));
        createButtons(getEl('pause-monochrome-type-selector'), { 'bw': 'Black & White', 'green': 'Green Phosphor', 'amber': 'Amber Phosphor' }, (key) => selectMonochromeType(key, 'pause-'));
        createButtons(getEl('pause-crt-shader-selector'), { 'true': 'On', 'false': 'Off' }, (key) => selectCrtShader(key === 'true'));
        createButtons(getEl('pause-film-grain-selector'), { 'true': 'On', 'false': 'Off' }, (key) => selectFilmGrain(key === 'true'));
        createButtons(getEl('pause-jitter-selector'), { 'true': 'On', 'false': 'Off' }, (key) => selectJitter(key === 'true'));
        createButtons(getEl('pause-starfield-selector'), { 'true': 'On', 'false': 'Off' }, (key) => selectStarfield(key === 'true'));
    }
}

// --- UPGRADED ALERT SYSTEM ---

if (alertScreenEl && !document.getElementById('alert-buttons-container')) {
    alertButtonsContainerEl.id = 'alert-buttons-container';
    alertScreenEl.appendChild(alertButtonsContainerEl);
}

export function showInGameAlert(title, message, options = {}) {
    if (!alertScreenEl) return;
    
    const wasInGame = gameState.status === 'playing';
    if (wasInGame) gameState.status = 'paused'; 
    gameState.uiMode = 'alert';
    
    alertTitleEl.textContent = title;
    alertMessageEl.textContent = message;

    const {
        onConfirm,
        onCancel,
        confirmText = 'OK',
        cancelText = null, 
    } = options;

    alertButtonsContainerEl.innerHTML = '';

    const okBtn = document.createElement('button');
    okBtn.id = 'alert-ok-button';
    okBtn.className = 'menu-btn';
    okBtn.textContent = confirmText;
    alertButtonsContainerEl.appendChild(okBtn);
    
    const cleanup = () => {
        alertScreenEl.classList.add('hidden');
        if (wasInGame) unpauseGame(); 
        gameState.uiMode = document.getElementById('main-menu')?.classList.contains('hidden') ? 'game' : 'menu';
    };
    
    const confirmAction = () => {
        cleanup();
        if (onConfirm) onConfirm();
    };
    
    okBtn.addEventListener('click', confirmAction, { once: true });
    
    if (cancelText) {
        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'alert-cancel-button';
        cancelBtn.className = 'menu-btn';
        cancelBtn.textContent = cancelText;
        alertButtonsContainerEl.prepend(cancelBtn);
        
        const cancelAction = () => {
            cleanup();
            if (onCancel) onCancel();
        };
        cancelBtn.addEventListener('click', cancelAction, { once: true });
        
        okBtn.classList.add('selected');

    } else {
        okBtn.classList.add('selected');
    }
    
    alertScreenEl.classList.remove('hidden');
}

// --- GAME UI FUNCTIONS (for game.html) ---

export function showGameOverUI() { if (!gameOverScreenEl) return; gameOverScreenEl.classList.remove('hidden'); const difficultyLabel = DIFFICULTY_SETTINGS[gameState.currentDifficulty].label; let subText = ''; if (gameState.playerCount === 2 && gameState.twoPlayerMode === 'vs') { const p1 = gameState.players[0]; const p2 = gameState.players[1]; const winner = p1.lives > 0 ? p1 : (p2?.lives > 0 ? p2 : null); subText = winner ? `PLAYER ${winner.playerNum} WINS!` : `IT'S A DRAW!`; } else { subText = `Final Score: ${gameState.totalScore} on ${difficultyLabel}`; } gameOverSubtitleEl.innerHTML = subText; }
export function showInitialEntryScreen() { if (!initialEntryScreenEl) return; initialEntryScreenEl.classList.remove('hidden'); finalScoreDisplayEl.textContent = `SCORE: ${gameState.highScoreToSubmit}`; gameState.initialEntryState.initials = ['A', 'A', 'A']; gameState.initialEntryState.activeIndex = 0; updateInitialEntryUI(); }
export function hideInitialEntryScreen() { if (initialEntryScreenEl) initialEntryScreenEl.classList.add('hidden'); }
export function updateInitialEntryUI() { if (!initialEntryScreenEl) return; const {initials, activeIndex} = gameState.initialEntryState; charBox0.textContent = initials[0]; charBox1.textContent = initials[1]; charBox2.textContent = initials[2]; document.querySelectorAll('.initial-char-box').forEach((box, index) => { box.classList.toggle('selected', index === activeIndex); }); }

export function togglePauseScreen(show) {
    if (pauseScreenEl) {
        createPauseMenuPanels();
        pauseScreenEl.classList.toggle('hidden', !show);
        if (show) {
            const buttons = pauseScreenEl.querySelectorAll('.menu-btn');
            buttons.forEach(btn => btn.classList.remove('selected'));
            if (buttons.length > 0) buttons[0].classList.add('selected');
        }
    }
}

function purchaseUpgrade(player, upgradeKey, scoresEarned) {
    const upgrade = UPGRADES[upgradeKey];
    if (!player || !upgrade || player.currency < upgrade.cost) {
        return;
    }

    if (upgrade.type === 'permanent') {
        const currentMax = (upgrade.key === 'maxLives') ? player.getMaxLives() : player.getMaxMissiles();
        if (currentMax >= upgrade.cap) {
            return; 
        }
    }

    player.currency -= upgrade.cost;
    const maxLives = player.getMaxLives();
    const maxMissiles = player.getMaxMissiles();

    switch (upgradeKey) {
        case 'repair':
            player.lives = Math.min(player.lives + 1, maxLives);
            break;
        case 'missile':
            player.missileCount = Math.min(player.missileCount + 1, maxMissiles);
            break;
        case 'maxLives':
        case 'maxMissiles':
            player.upgrades[upgrade.key] = (player.upgrades[upgrade.key] || 0) + 1;
            break;
    }
    
    toggleHangarScreen(true, scoresEarned);
}

export function toggleHangarScreen(show, scoresEarned = null) {
    if (!hangarScreenEl || !hangarMainContentEl) return;

    hangarScreenEl.classList.toggle('hidden', !show);

    if (show) {
        hangarMainContentEl.innerHTML = ''; 

        gameState.players.forEach(player => {
            const column = document.createElement('div');
            column.className = 'hangar-player-column';
            column.id = `player-column-${player.playerNum}`;

            const earned = scoresEarned ? (scoresEarned[player.id] || 0) : 0;
            const maxLives = player.getMaxLives();
            const maxMissiles = player.getMaxMissiles();

            let statsHTML = `
                <div class="player-stats">
                    <h2>PLAYER ${player.playerNum}</h2>
                    <p>Credits Earned: <span>${earned}</span></p>
                    <p>Hull Integrity: <span>${player.lives} / ${maxLives}</span></p>
                    <p>Missile Stock: <span>${player.missileCount} / ${maxMissiles}</span></p>
                    <p class="currency-display">Total Credits: ${player.currency}</p>
                </div>
                <div class="hangar-shop">
            `;

            for (const key in UPGRADES) {
                const upgrade = UPGRADES[key];
                let isDisabled = player.currency < upgrade.cost;
                if (key === 'repair' && player.lives >= maxLives) isDisabled = true;
                if (key === 'missile' && player.missileCount >= maxMissiles) isDisabled = true;
                if (upgrade.type === 'permanent') {
                    const currentMax = (upgrade.key === 'maxLives') ? maxLives : maxMissiles;
                    if (currentMax >= upgrade.cap) {
                        isDisabled = true;
                    }
                }
                
                statsHTML += `
                    <button class="shop-btn" id="shop-${key}-${player.playerNum}" data-cost="${upgrade.cost}c" ${isDisabled ? 'disabled' : ''}>
                        ${upgrade.name}
                    </button>
                `;
            }

            statsHTML += `</div>`;
            column.innerHTML = statsHTML;
            hangarMainContentEl.appendChild(column);

            for (const key in UPGRADES) {
                const btn = column.querySelector(`#shop-${key}-${player.playerNum}`);
                btn?.addEventListener('click', () => purchaseUpgrade(player, key, scoresEarned));
            }
        });

        const allButtons = hangarScreenEl.querySelectorAll('.shop-btn, #proceed-to-next-level-btn');
        allButtons.forEach(btn => btn.classList.remove('selected'));
        const firstVisibleButton = hangarScreenEl.querySelector('.shop-btn:not(:disabled), #proceed-to-next-level-btn');
        firstVisibleButton?.classList.add('selected');
    }
}

function showPauseOptions(screenElement, panelId) {
    if (screenElement) {
        screenElement.classList.remove('hidden');
        togglePauseScreen(false);
        updateUIFromState(panelId);

        const panel = document.getElementById(panelId);
        if (panel) {
            panel.scrollTop = 0;
            const items = panel.querySelectorAll('.menu-btn, .slider-container');
            items.forEach(item => item.classList.remove('selected'));
            if(items.length > 0) items[0].classList.add('selected');
        }
    }
}

export function showPauseGraphicsOptions() { showPauseOptions(pauseGraphicsScreen, 'pause-graphics-panel'); }
export function showPauseSoundOptions() { showPauseOptions(pauseSoundScreen, 'pause-sound-panel'); }
export function showPauseGameplayOptions() { showPauseOptions(pauseGameplayScreen, 'pause-gameplay-panel'); }

export function closePauseOptions() {
    if (pauseGraphicsScreen) pauseGraphicsScreen.classList.add('hidden');
    if (pauseSoundScreen) pauseSoundScreen.classList.add('hidden');
    if (pauseGameplayScreen) pauseGameplayScreen.classList.add('hidden');
    togglePauseScreen(true);
}

export function unpauseGame() {
    if (gameState.status !== 'paused') return;
    gameState.status = 'playing';
    gameState.players.forEach(p => { if (p.lives > 0) p.inputCooldown = 150; });

    if (pauseScreenEl) pauseScreenEl.classList.add('hidden');
    if (pauseGraphicsScreen) pauseGraphicsScreen.classList.add('hidden');
    if (pauseSoundScreen) pauseSoundScreen.classList.add('hidden');
    if (pauseGameplayScreen) pauseGameplayScreen.classList.add('hidden');
}

export function toggleDevConsole(show) { if (!devConsoleContainerEl) return; devConsoleContainerEl.classList.toggle('hidden', !show); if (show) { devConsoleInputEl.focus(); devConsoleInputEl.value = ''; devConsoleOutputEl.textContent = ''; } }
if (devConsoleInputEl) { devConsoleInputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const command = devConsoleInputEl.value; const result  = executeCommand(command); devConsoleOutputEl.textContent = result; devConsoleInputEl.value = ''; setTimeout(() => devConsoleInputEl.focus(), 0); } else if (e.key === 'Escape') { gameState.status = 'playing'; toggleDevConsole(false); } e.stopPropagation(); }); }

function createButtons(selectorEl, options, clickHandler) { if (!selectorEl) return; selectorEl.innerHTML = ''; Object.entries(options).forEach(([key, text]) => { const button = document.createElement('button'); button.textContent = text; button.className = 'menu-btn'; button.dataset.key = key; button.addEventListener('click', () => clickHandler(key)); selectorEl.appendChild(button); }); }
export function updateChosenButton(selectorEl, chosenKey) { if (!selectorEl) return; selectorEl.querySelectorAll('.menu-btn').forEach(btn => { btn.classList.toggle('chosen', btn.dataset.key === chosenKey); }); }

export function createGameTypeButtons(clickHandler) { createButtons(gameTypeSelectorEl, { 'modern': 'Arcade', 'campaign': 'Campaign' }, clickHandler); }
export function createPlayerCountButtons() { createButtons(playerCountSelectorEl, { 1: '1 Player', 2: '2 Players' }, (key) => selectPlayerCount(parseInt(key))); }
export function createTwoPlayerModeButtons() { createButtons(twoPlayerModeSelectorEl, { 'coop': 'Co-op', 'vs': 'Versus' }, selectTwoPlayerMode); }
export function createDifficultyButtons() { const difficulties = Object.fromEntries(Object.keys(DIFFICULTY_SETTINGS).map(key => [key, DIFFICULTY_SETTINGS[key].label])); createButtons(difficultySelectorEl, difficulties, selectDifficulty); }
export function createFlightModelButtons() { createButtons(flightModelSelectorEl, { 'arcade': 'Arcade (Friction)', 'newtonian': 'Newtonian (Inertia)' }, selectFlightModel); } // NEW
export function createShieldModeButtons() { createButtons(shieldModeSelectorEl, { 'regenerate': 'Regenerating Shield', 'pickup': 'Shield Pickups Only' }, selectShieldMode); }
export function createEnemyFireEffectButtons() { createButtons(enemyFireEffectSelectorEl, { 'passes': 'Passes Through Asteroids', 'blocked': 'Blocked By Asteroids', 'destroys': 'Destroys Asteroids' }, selectEnemyFireEffect); }
export function createPrimaryColorModeButtons() { createButtons(primaryColorModeSelectorEl, { 'color': 'Color', 'mono': 'Monochrome' }, selectPrimaryColorMode); }
export function createMonochromeTypeButtons() { createButtons(monochromeTypeSelectorEl, { 'bw': 'Black & White', 'green': 'Green Phosphor', 'amber': 'Amber Phosphor' }, selectMonochromeType); }
export function createCrtShaderButtons() { createButtons(crtShaderSelectorEl, { 'true': 'On', 'false': 'Off' }, (key) => selectCrtShader(key === 'true')); }
export function createFilmGrainButtons() { createButtons(filmGrainSelectorEl, { 'true': 'On', 'false': 'Off' }, (key) => selectFilmGrain(key === 'true')); }
export function createJitterButtons() { createButtons(jitterSelectorEl, { 'true': 'On', 'false': 'Off' }, (key) => selectJitter(key === 'true')); }
export function createStarfieldButtons() { createButtons(starfieldSelectorEl, { 'true': 'On', 'false': 'Off' }, (key) => selectStarfield(key === 'true')); }
export function createControlSchemeButtons() { createButtons(controlSchemeSelectorEl, { 'default': 'Default (Aim Stick, Thrust Button)', 'combined': 'Combined (Move & Aim with Stick)' }, selectControlScheme); }

export function selectPlayerCount(count, prefix = '') { gameState.playerCount = count; updateChosenButton(getEl('player-count-selector', prefix), count.toString()); window.dispatchEvent(new CustomEvent('settingChanged', { detail: { category: 'gameplay' } })); const twoPlayerContainer = getEl('two-player-mode-selector-container', prefix); if (twoPlayerContainer) { twoPlayerContainer.classList.toggle('hidden', count !== 2); } }
export function selectTwoPlayerMode(key, prefix = '') { gameState.twoPlayerMode = key; updateChosenButton(getEl('two-player-mode-selector', prefix), key); window.dispatchEvent(new CustomEvent('settingChanged', { detail: { category: 'gameplay' } })); }
export function selectDifficulty(key, prefix = '') { gameState.currentDifficulty = key; updateChosenButton(getEl('difficulty-selector', prefix), key); window.dispatchEvent(new CustomEvent('settingChanged', { detail: { category: 'gameplay' } })); }
export function selectFlightModel(key, prefix = '') { gameState.flightModel = key; updateChosenButton(getEl('flight-model-selector', prefix), key); window.dispatchEvent(new CustomEvent('settingChanged', { detail: { category: 'gameplay' } })); } // NEW
export function selectShieldMode(key, prefix = '') { gameState.shieldMode = key; updateChosenButton(getEl('shield-mode-selector', prefix), key); window.dispatchEvent(new CustomEvent('settingChanged', { detail: { category: 'gameplay' } })); }
export function selectEnemyFireEffect(key, prefix = '') { gameState.enemyFireEffect = key; updateChosenButton(getEl('enemy-fire-effect-selector', prefix), key); window.dispatchEvent(new CustomEvent('settingChanged', { detail: { category: 'gameplay' } })); }
export function selectControlScheme(key) { gameState.currentControlScheme = key; updateChosenButton(getEl('control-scheme-selector'), key); window.dispatchEvent(new CustomEvent('settingChanged', { detail: { category: 'controls' } })); }

export function selectPrimaryColorMode(key, prefix = '') { const isMono = key === 'mono'; const monoOptions = getEl('monochrome-options-container', prefix); if (monoOptions) monoOptions.classList.toggle('hidden', !isMono); if (isMono) { if (gameState.colorMode === 'color') selectMonochromeType('bw', prefix); else selectMonochromeType(gameState.colorMode, prefix); } else { selectMonochromeType('color', prefix); } updateChosenButton(getEl('primary-color-mode-selector', prefix), key); }
export function selectMonochromeType(key, prefix = '') { gameState.colorMode = key; if (key !== 'color') { updateChosenButton(getEl('monochrome-type-selector', prefix), key); } document.body.classList.remove('bw-mode', 'green-mode', 'amber-mode'); if (key === 'bw') document.body.classList.add('bw-mode'); else if (key === 'green') document.body.classList.add('green-mode'); else if (key === 'amber') document.body.classList.add('amber-mode'); applyVisualSettings(); window.dispatchEvent(new CustomEvent('settingChanged', { detail: { category: 'video' } })); }

export function selectCrtShader(isOn) { gameState.shaders.crt = isOn; updateChosenButton(getEl('crt-shader-selector'), isOn.toString()); updateChosenButton(getEl('crt-shader-selector', 'pause-'), isOn.toString()); window.dispatchEvent(new CustomEvent('settingChanged', { detail: { category: 'video' } })); applyVisualSettings(); }
export function selectFilmGrain(isOn) { gameState.shaders.filmGrain = isOn; updateChosenButton(getEl('film-grain-selector'), isOn.toString()); updateChosenButton(getEl('film-grain-selector', 'pause-'), isOn.toString()); window.dispatchEvent(new CustomEvent('settingChanged', { detail: { category: 'video' } })); applyVisualSettings(); }
export function selectJitter(isOn) { gameState.shaders.jitter = isOn; updateChosenButton(getEl('jitter-selector'), isOn.toString()); updateChosenButton(getEl('jitter-selector', 'pause-'), isOn.toString()); window.dispatchEvent(new CustomEvent('settingChanged', { detail: { category: 'video' } })); applyVisualSettings(); }
export function selectStarfield(isOn) { gameState.shaders.starfield = isOn; updateChosenButton(getEl('starfield-selector'), isOn.toString()); updateChosenButton(getEl('starfield-selector', 'pause-'), isOn.toString()); window.dispatchEvent(new CustomEvent('settingChanged', { detail: { category: 'video' } })); }

export function setScanlineIntensity(value) { gameState.shaders.scanlines = parseFloat(value); applyVisualSettings(); updateVFXSliderUI(); updateVFXSliderUI('pause-'); window.dispatchEvent(new CustomEvent('settingChanged', { detail: { category: 'video' } })); }
export function setBloom(value) { gameState.shaders.bloom = parseFloat(value); applyVisualSettings(); updateVFXSliderUI(); updateVFXSliderUI('pause-'); window.dispatchEvent(new CustomEvent('settingChanged', { detail: { category: 'video' } })); }
export function setCurvature(value) { gameState.shaders.curvature = parseFloat(value); applyVisualSettings(); updateVFXSliderUI(); updateVFXSliderUI('pause-'); window.dispatchEvent(new CustomEvent('settingChanged', { detail: { category: 'video' } })); }
export function setMonoBrightness(value) { gameState.shaders.monoBrightness = parseFloat(value); applyVisualSettings(); updateVFXSliderUI(); updateVFXSliderUI('pause-'); window.dispatchEvent(new CustomEvent('settingChanged', { detail: { category: 'video' } })); }
export function setPersistence(value) { gameState.shaders.persistence = parseFloat(value); updateVFXSliderUI(); updateVFXSliderUI('pause-'); window.dispatchEvent(new CustomEvent('settingChanged', { detail: { category: 'video' } })); }

export function updateVFXSliderUI(prefix = '') { const _scanlineSlider = getEl('scanline-slider', prefix); if (_scanlineSlider) { _scanlineSlider.value = gameState.shaders.scanlines; getEl('scanline-fill', prefix).style.width = `${(gameState.shaders.scanlines / _scanlineSlider.max) * 100}%`; getEl('scanline-value-text', prefix).textContent = gameState.shaders.scanlines.toFixed(2); } const _bloomSlider = getEl('bloom-slider', prefix); if (_bloomSlider) { _bloomSlider.value = gameState.shaders.bloom; getEl('bloom-fill', prefix).style.width = `${(gameState.shaders.bloom / _bloomSlider.max) * 100}%`; getEl('bloom-value-text', prefix).textContent = `${gameState.shaders.bloom.toFixed(1)}px`; } const _curvatureSlider = getEl('curvature-slider', prefix); if (_curvatureSlider) { _curvatureSlider.value = gameState.shaders.curvature; getEl('curvature-fill', prefix).style.width = `${(gameState.shaders.curvature / _curvatureSlider.max) * 100}%`; getEl('curvature-value-text', prefix).textContent = `${(gameState.shaders.curvature * 100).toFixed(1)}%`; } const _brightnessSlider = getEl('brightness-slider', prefix); if (_brightnessSlider) { _brightnessSlider.value = gameState.shaders.monoBrightness; const min = parseFloat(_brightnessSlider.min), max = parseFloat(_brightnessSlider.max); getEl('brightness-fill', prefix).style.width = `${((gameState.shaders.monoBrightness - min) / (max - min)) * 100}%`; getEl('brightness-value-text', prefix).textContent = `${Math.round(gameState.shaders.monoBrightness * 100)}%`; } const _persistenceSlider = getEl('persistence-slider', prefix); if (_persistenceSlider) { _persistenceSlider.value = gameState.shaders.persistence; getEl('persistence-fill', prefix).style.width = `${(gameState.shaders.persistence / _persistenceSlider.max) * 100}%`; getEl('persistence-value-text', prefix).textContent = `${Math.round(gameState.shaders.persistence * 100)}%`; } }
export function applyVisualSettings() { if (!gameWrapperEl) return; const rootStyle = document.documentElement.style; crtOverlayEl?.classList.toggle('crt-on', gameState.shaders.crt); gameWrapperEl.classList.toggle('bloom-on', gameState.shaders.bloom > 0); gameWrapperEl.classList.toggle('curvature-on', gameState.shaders.curvature > 0); document.getElementById('noise-overlay')?.classList.toggle('noise-on', gameState.shaders.filmGrain); gameWrapperEl.classList.toggle('jitter-on', gameState.shaders.jitter); rootStyle.setProperty('--scanline-intensity', gameState.shaders.scanlines); rootStyle.setProperty('--bloom-amount', `${gameState.shaders.bloom}px`); rootStyle.setProperty('--curvature-amount', gameState.shaders.curvature); rootStyle.setProperty('--mono-brightness', gameState.shaders.monoBrightness); }

export function updateMusicVolumeUI(volume, prefix = '') { const slider = getEl('music-volume-slider', prefix); if (!slider) return; const pct = Math.round(volume * 100); getEl('music-volume-fill', prefix).style.width = `${pct}%`; const textEl = getEl('music-volume-text', prefix); if (textEl) textEl.textContent = `${pct}%`; slider.value = volume; }
export function updateSfxVolumeUI(volume, prefix = '') { const slider = getEl('sfx-volume-slider', prefix); if (!slider) return; const pct = Math.round(volume * 100); getEl('sfx-volume-fill', prefix).style.width = `${pct}%`; const textEl = getEl('sfx-volume-text', prefix); if (textEl) textEl.textContent = `${pct}%`; slider.value = volume; }

function updateUIFromState(panelId) {
    const prefix = panelId && panelId.includes('pause') ? 'pause-' : '';

    if (panelId === 'pause-gameplay-panel' || !panelId) {
        selectDifficulty(gameState.currentDifficulty, prefix);
        selectFlightModel(gameState.flightModel, prefix);
        selectShieldMode(gameState.shieldMode, prefix);
        selectEnemyFireEffect(gameState.enemyFireEffect, prefix);
    }
    
    if (panelId === 'pause-graphics-panel' || !panelId) {
        if (gameState.colorMode === 'color') selectPrimaryColorMode('color', prefix); else { selectPrimaryColorMode('mono', prefix); selectMonochromeType(gameState.colorMode, prefix); }
        selectCrtShader(gameState.shaders.crt);
        selectFilmGrain(gameState.shaders.filmGrain);
        selectJitter(gameState.shaders.jitter);
        selectStarfield(gameState.shaders.starfield);
    }
    
    if (panelId === 'pause-sound-panel' || !panelId) {
        updateMusicVolumeUI(gameState.musicVolume, prefix);
        updateSfxVolumeUI(gameState.sfxVolume, prefix);
    }
    
    updateVFXSliderUI(prefix);
}

const HIGH_SCORE_KEY = 'neonAsteroidsHighScores';
export function getHighScores() { const scoresJSON = localStorage.getItem(HIGH_SCORE_KEY); if (!scoresJSON) return []; try { const scores = JSON.parse(scoresJSON); return scores.sort((a, b) => b.score - a.score); } catch (e) { return []; } }
export function saveHighScores(scores) { localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(scores)); }
export function checkIfHighScore(score) { if (score === 0) return false; if (gameState.playerCount === 2 && gameState.twoPlayerMode === 'vs') return false; const highScores = getHighScores(); return highScores.length < 10 || score > highScores[highScores.length - 1].score; }
export function addHighScore(initials, score) { let highScores = getHighScores(); highScores.push({ initials, score }); highScores.sort((a, b) => b.score - a.score); highScores = highScores.slice(0, 10); saveHighScores(highScores); }
export function displayHighScores() { if (!highScoreListEl) return; const highScores = getHighScores(); highScoreListEl.innerHTML = ''; if (highScores.length === 0) { highScoreListEl.innerHTML = '<li>No scores yet!</li>'; } else { highScores.forEach((score) => { const li = document.createElement('li'); li.textContent = `${score.initials} - ${score.score}`; highScoreListEl.appendChild(li); }); } }

export function getMainMenuElement() { return mainMenuEl; }
export function getGameplayMenuElement() { return gameplayMenuEl; }
export function getVideoMenuElement() { return videoMenuEl; }
export function getControlsMenuElement() { return controlsMenuEl; }
export function getSoundMenuElement() { return soundMenuEl; }
export function getCampaignMenuElement() { return campaignMenuEl; }