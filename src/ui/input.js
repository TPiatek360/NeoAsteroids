// src/ui/input.js
// Handles all keyboard and gamepad input for the main game page.

import { gameState } from '../state.js';
import { setCanvasSize } from '../utils.js';
import { submitHighScore, destroy } from '../main.js';
import {
    initAudio, isAudioInitialized, playShootSound, startChargeSound,
    stopChargeSound, playBombDropSound, startThrustSound, stopThrustSound,
    isThrustSoundActive, playShieldUpSound, playShieldDownSound, playMenuSelectSound,
    playChargeLevelUpSound, updateChargeSoundPitch
} from '../audio/audio.js';
import {
    updateInitialEntryUI,
    togglePauseScreen,
    toggleDevConsole,
    unpauseGame,
    showPauseGraphicsOptions,
    showPauseSoundOptions,
    showPauseGameplayOptions,
    closePauseOptions
} from './ui.js';
import { fireBullet, fireMissileSpread } from '../entities/weapons.js';
import { Bomb } from '../entities/weapons.js';
import { MAX_CHARGE_LEVEL, MISSILE_CHARGE_TIME_PER_LEVEL } from '../constants.js';
import { createStarfield } from '../entities/environment.js';

function setupGamepadListeners() {
    window.addEventListener('gamepadconnected', (e) => {
        console.log('Gamepad connected:', e.gamepad.id, 'index', e.gamepad.index);
        gameState.activeGamepads[e.gamepad.index] = e.gamepad;
        if (gameState.playerCount === 1 && gameState.players.length > 0) {
            const p1 = gameState.players[0];
            if (p1.inputConfig.type === 'keyboard1') {
                p1.inputConfig = { type: 'keyboard_and_gamepad', index: e.gamepad.index };
                console.log(`Live-upgraded Player 1 to use Gamepad ${e.gamepad.index}`);
            }
        }
    });

    window.addEventListener('gamepaddisconnected', (e) => {
        console.log('Gamepad disconnected:', e.gamepad.id, 'index', e.gamepad.index);
        delete gameState.activeGamepads[e.gamepad.index];
        gameState.players.forEach(p => {
            if (p.inputConfig.type === 'gamepad' && p.inputConfig.index === e.gamepad.index) {
                console.log(`Player ${p.playerNum} controller disconnected.`);
            }
            if (p.inputConfig.type === 'keyboard_and_gamepad' && p.inputConfig.index === e.gamepad.index) {
                p.inputConfig = { type: 'keyboard1' };
                console.log(`Player ${p.playerNum} controller disconnected, reverting to keyboard.`);
            }
        });
    });
}

function navigatePauseMenu(direction) {
    const buttons = Array.from(document.querySelectorAll('#pause-screen .menu-btn'));
    if (buttons.length <= 1) return;

    let currentIndex = buttons.findIndex(btn => btn.classList.contains('selected'));
    if (currentIndex === -1) currentIndex = 0;

    buttons[currentIndex].classList.remove('selected');

    let nextIndex = currentIndex + (direction === 'down' ? 1 : -1);
    if (nextIndex < 0) nextIndex = buttons.length - 1;
    if (nextIndex >= buttons.length) nextIndex = 0;

    buttons[nextIndex].classList.add('selected');
    playMenuSelectSound();
}

// Generic panel navigation for pause sub-menus
function navigatePanel(panelId, direction) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const items = Array.from(panel.querySelectorAll('.menu-btn, .slider-container'));
    if (items.length === 0) return;

    let idx = items.findIndex(b => b.classList.contains('selected'));
    if (idx === -1) { // If nothing is selected, select the first or last
        idx = direction === 'down' ? 0 : items.length - 1;
    } else {
        items[idx].classList.remove('selected');
        idx += (direction === 'down' ? 1 : -1);
        idx = (idx + items.length) % items.length; // Wrap around
    }

    const newItem = items[idx];
    newItem.classList.add('selected');

    // BUG FIX: Replace scrollIntoView with manual panel scrolling
    const containerRect = panel.getBoundingClientRect();
    const itemRect = newItem.getBoundingClientRect();

    if (itemRect.bottom > containerRect.bottom) {
        panel.scrollTop += itemRect.bottom - containerRect.bottom;
    } else if (itemRect.top < containerRect.top) {
        panel.scrollTop -= containerRect.top - itemRect.top;
    }

    playMenuSelectSound();
}

// NEW: Navigation logic specifically for the hangar/store
function navigateHangarMenu(direction) {
    playMenuSelectSound();
    const hangarScreen = document.getElementById('hangar-screen');
    if (!hangarScreen) return;

    // 1. Build the navigation grid from visible, enabled buttons
    const navGrid = [];
    const playerColumns = hangarScreen.querySelectorAll('.hangar-player-column');
    playerColumns.forEach(column => {
        // Only include buttons that are not disabled
        const buttons = Array.from(column.querySelectorAll('.shop-btn:not(:disabled)'));
        if (buttons.length > 0) navGrid.push(buttons);
    });
    // The "Proceed" button is always its own final column
    const proceedBtn = hangarScreen.querySelector('#proceed-to-next-level-btn');
    if (proceedBtn) navGrid.push([proceedBtn]);

    if (navGrid.length === 0) return; // Nothing to navigate to

    // 2. Find the currently selected item's position
    let currentColumnIndex = -1;
    let currentRowIndex = -1;
    let currentSelection = null;

    for (let i = 0; i < navGrid.length; i++) {
        const col = navGrid[i];
        const j = col.findIndex(btn => btn.classList.contains('selected'));
        if (j !== -1) {
            currentColumnIndex = i;
            currentRowIndex = j;
            currentSelection = col[j];
            break;
        }
    }

    // 3. If nothing is selected, select the very first available item
    if (!currentSelection) {
        navGrid[0][0].classList.add('selected');
        return;
    }

    currentSelection.classList.remove('selected');

    // 4. Calculate the next position based on direction
    let nextColumnIndex = currentColumnIndex;
    let nextRowIndex = currentRowIndex;

    switch (direction) {
        case 'up':
            nextRowIndex = (currentRowIndex - 1 + navGrid[currentColumnIndex].length) % navGrid[currentColumnIndex].length;
            break;
        case 'down':
            nextRowIndex = (currentRowIndex + 1) % navGrid[currentColumnIndex].length;
            break;
        case 'left':
            nextColumnIndex = (currentColumnIndex - 1 + navGrid.length) % navGrid.length;
            // Try to keep the same row index, otherwise clamp to the new column's max index
            nextRowIndex = Math.min(currentRowIndex, navGrid[nextColumnIndex].length - 1);
            break;
        case 'right':
            nextColumnIndex = (currentColumnIndex + 1) % navGrid.length;
            nextRowIndex = Math.min(currentRowIndex, navGrid[nextColumnIndex].length - 1);
            break;
    }
    
    // 5. Apply the 'selected' class to the new item
    navGrid[nextColumnIndex][nextRowIndex].classList.add('selected');
}


// Handle keyboard input inside option panels
function handlePauseOptionsKeyboard(e) {
    const activePanelScreenId = ['pause-graphics-screen', 'pause-sound-screen', 'pause-gameplay-screen']
        .find(id => {
            const el = document.getElementById(id);
            return el && !el.classList.contains('hidden');
        });

    if (!activePanelScreenId) return;
    
    const activePanelId = activePanelScreenId.replace('-screen', '-panel');

    e.preventDefault();

    switch (e.key) {
        case 'ArrowDown':
            navigatePanel(activePanelId, 'down');
            break;
        case 'ArrowUp':
            navigatePanel(activePanelId, 'up');
            break;
        case 'Enter':
            const selected = document.querySelector(`#${activePanelId} .selected`);
            if (selected && selected.classList.contains('slider-container')) {
                // Future enhancement
            } else {
                selected?.click();
            }
            break;
        case 'Escape':
            closePauseOptions();
            break;
    }
}


export function setupGameEventListeners(initGameCallback) {
    gameState.keys = {
        ArrowUp: false, ArrowLeft: false, ArrowRight: false, ' ': false,
        m: false, b: false, ShiftRight: false,
        w: false, a: false, d: false, Tab: false,
        g: false, f: false, ShiftLeft: false
    };

    async function initAudioOnFirstInteraction() {
        if (isAudioInitialized()) return;
        try {
            await initAudio();
            initGameCallback();
        } catch (err) {
            console.error('Failed to initialize audio.', err);
        }
    }

    const keydownListener = (e) => {
        if (e.ctrlKey && e.key.toLowerCase() === 'q') {
            e.preventDefault();
            if (gameState.status === 'playing') {
                gameState.status = 'devConsole';
                toggleDevConsole(true);
                if (isThrustSoundActive()) stopThrustSound();
                stopChargeSound();
            } else if (gameState.status === 'devConsole') {
                gameState.status = 'playing';
                toggleDevConsole(false);
            }
            return;
        }
        
        const isSubPanelOpen = ['pause-graphics-screen', 'pause-sound-screen', 'pause-gameplay-screen'].some(id => {
            const el = document.getElementById(id);
            return el && !el.classList.contains('hidden');
        });

        if (e.key === 'Escape') {
            e.preventDefault();
            if (gameState.status === 'devConsole') {
                gameState.status = 'playing';
                toggleDevConsole(false);
                return;
            }
            
            if (isSubPanelOpen) {
                closePauseOptions();
                return;
            }

            if (gameState.status === 'playing') {
                gameState.status = 'paused';
                togglePauseScreen(true);
                if (isThrustSoundActive()) stopThrustSound();
                stopChargeSound();
            } else if (gameState.status === 'paused') {
                unpauseGame();
            }
            return;
        }

        if (isSubPanelOpen) {
            handlePauseOptionsKeyboard(e);
            return;
        }
        
        if (gameState.status === 'paused') {
            if (e.key === 'ArrowUp')   { e.preventDefault(); navigatePauseMenu('up');   return; }
            if (e.key === 'ArrowDown') { e.preventDefault(); navigatePauseMenu('down'); return; }
            if (e.key === 'Enter') {
                e.preventDefault();
                const selected = document.querySelector('#pause-screen .selected');
                selected?.click();
                return;
            }
        }
        
        if (gameState.status === 'hangar') {
            switch(e.key) {
                case 'ArrowUp': e.preventDefault(); navigateHangarMenu('up'); break;
                case 'ArrowDown': e.preventDefault(); navigateHangarMenu('down'); break;
                case 'ArrowLeft': e.preventDefault(); navigateHangarMenu('left'); break;
                case 'ArrowRight': e.preventDefault(); navigateHangarMenu('right'); break;
                case 'Enter':
                    e.preventDefault();
                    const selected = document.querySelector('#hangar-screen .selected');
                    selected?.click();
                    break;
            }
            return;
        }

        if (gameState.status === 'gameOver') {
            if (e.key === 'Enter') {
                e.preventDefault();
                const selectedButton = document.querySelector('#game-over-screen .menu-btn.selected');
                selectedButton?.click();
            }
            return;
        }

        if (gameState.status === 'enteringScore') {
            handleInitialEntryKeyboard(e);
            e.preventDefault();
            return;
        }

        if (gameState.status !== 'playing') return;

        const key = e.key.toLowerCase();
        if (gameState.keys.hasOwnProperty(e.key)) gameState.keys[e.key] = true;
        if (e.code === 'Space') gameState.keys[' '] = true;
        if (e.code === 'ShiftRight') gameState.keys.ShiftRight = true;
        if (e.code === 'ShiftLeft')  gameState.keys.ShiftLeft  = true;

        const p1 = gameState.players.find(p => p.inputConfig.type === 'keyboard1' || p.inputConfig.type === 'keyboard_and_gamepad');
        const p2 = gameState.players.find(p => p.inputConfig.type === 'keyboard2');

        if (!e.repeat) {
            if (p1 && p1.inputCooldown <= 0 && key === 'm' && !p1.isChargingMissile && p1.missileCount > 0) {
                p1.isChargingMissile = true;
                p1.missileChargeLevel = 0;
                p1.missileChargeProgress = 0;
                startChargeSound();
            }
            if (p2 && p2.inputCooldown <= 0 && key === 'g' && !p2.isChargingMissile && p2.missileCount > 0) {
                p2.isChargingMissile = true;
                p2.missileChargeLevel = 0;
                p2.missileChargeProgress = 0;
                startChargeSound();
            }
            if (p1 && p1.inputCooldown <= 0 && e.code === 'Space') fireBullet(p1);
            if (p2 && p2.inputCooldown <= 0 && key === 'tab') fireBullet(p2);
            if (p1 && p1.inputCooldown <= 0 && key === 'b' && p1.missileCount > 0) {
                p1.missileCount--;
                const rearX = p1.x - p1.r * 1.5 * Math.cos(p1.a);
                const rearY = p1.y - p1.r * 1.5 * Math.sin(p1.a);
                gameState.bombs.push(new Bomb(rearX, rearY, p1.id));
                playBombDropSound();
            }
            if (p2 && p2.inputCooldown <= 0 && key === 'f' && p2.missileCount > 0) {
                p2.missileCount--;
                const rearX = p2.x - p2.r * 1.5 * Math.cos(p2.a);
                const rearY = p2.y - p2.r * 1.5 * Math.sin(p2.a);
                gameState.bombs.push(new Bomb(rearX, rearY, p2.id));
                playBombDropSound();
            }
        }
        if (!['F5', 'F12'].includes(e.key.toUpperCase())) e.preventDefault();
    };

    const keyupListener = (e) => {
        if (gameState.status !== 'playing') return;
        const key = e.key.toLowerCase();
        if (gameState.keys.hasOwnProperty(e.key)) gameState.keys[e.key] = false;
        if (e.code === 'Space') gameState.keys[' '] = false;
        if (e.code === 'ShiftRight') gameState.keys.ShiftRight = false;
        if (e.code === 'ShiftLeft')  gameState.keys.ShiftLeft  = false;

        const p1 = gameState.players.find(p => p.inputConfig.type === 'keyboard1' || p.inputConfig.type === 'keyboard_and_gamepad');
        const p2 = gameState.players.find(p => p.inputConfig.type === 'keyboard2');

        if (p1 && p1.inputCooldown <= 0 && key === 'm' && p1.isChargingMissile) {
            p1.isChargingMissile = false;
            stopChargeSound();
            const num = Math.min(p1.missileChargeLevel + 1, p1.missileCount, MAX_CHARGE_LEVEL);
            if (num > 0) fireMissileSpread(p1, num);
            p1.missileChargeLevel = 0;
            p1.missileChargeProgress = 0;
        }
        if (p2 && p2.inputCooldown <= 0 && key === 'g' && p2.isChargingMissile) {
            p2.isChargingMissile = false;
            stopChargeSound();
            const num = Math.min(p2.missileChargeLevel + 1, p2.missileCount, MAX_CHARGE_LEVEL);
            if (num > 0) fireMissileSpread(p2, num);
            p2.missileChargeLevel = 0;
            p2.missileChargeProgress = 0;
        }
    };

    document.getElementById('pause-graphics-btn')?.addEventListener('click', showPauseGraphicsOptions);
    document.getElementById('pause-sound-btn')?.addEventListener('click', showPauseSoundOptions);
    document.getElementById('pause-gameplay-btn')?.addEventListener('click', showPauseGameplayOptions);
    
    const gameOverReturnBtn = document.getElementById('game-over-return-btn');
    if (gameOverReturnBtn) {
        gameOverReturnBtn.addEventListener('click', () => {
            destroy();
            window.location.href = 'index.html';
        });
    }

    window.addEventListener('keydown', initAudioOnFirstInteraction, { once: true });
    window.addEventListener('keydown', keydownListener);
    window.addEventListener('keyup',   keyupListener);
    window.addEventListener('resize', () => {
        setCanvasSize(document.getElementById('gameCanvas'));
        if (gameState.shaders.starfield) createStarfield();
    });
    setupGamepadListeners();
    return { keydownListener, keyupListener };
}

function handleKeyboardInput1(player) {
    if (player.inputCooldown > 0) return;
    
    const isReversed = gameState.mutators?.areControlsReversed || false;
    const left = isReversed ? 'ArrowRight' : 'ArrowLeft';
    const right = isReversed ? 'ArrowLeft' : 'ArrowRight';

    if (gameState.keys[left])  player.rot = -0.1;
    if (gameState.keys[right]) player.rot =  0.1;
    player.isThrusting  = player.isThrusting  || gameState.keys.ArrowUp;
    player.shieldInput  = player.shieldInput  || gameState.keys.ShiftRight;
}

function handleKeyboardInput2(player) {
    if (player.inputCooldown > 0) return;

    const isReversed = gameState.mutators?.areControlsReversed || false;
    const left = isReversed ? 'd' : 'a';
    const right = isReversed ? 'a' : 'd';

    if (gameState.keys[left]) player.rot = -0.1;
    if (gameState.keys[right]) player.rot =  0.1;
    player.isThrusting  = player.isThrusting  || gameState.keys.w;
    player.shieldInput  = player.shieldInput  || gameState.keys.ShiftLeft;
}

function handleGamepadInput(player, gp) {
    if (!gp || player.inputCooldown > 0) return;

    const isReversed = gameState.mutators?.areControlsReversed || false;
    const reverseMultiplier = isReversed ? -1 : 1;

    let gamepadAiming = false;
    const stickX = gp.axes[0] * reverseMultiplier;
    const stickY = gp.axes[1];
    const stickMagnitude = Math.sqrt(stickX * stickX + stickY * stickY);

    if (stickMagnitude > 0.25) {
        gamepadAiming = true;
        player.a = Math.atan2(stickY, stickX);
        player.rot = 0;
    }
    if (!gamepadAiming) {
        if (gp.buttons[14].pressed) player.rot = -0.1 * reverseMultiplier;
        if (gp.buttons[15].pressed) player.rot =  0.1 * reverseMultiplier;
    }

    player.isThrusting = player.isThrusting ||
        (gameState.currentControlScheme === 'combined' && stickMagnitude > 0.25) ||
        gp.buttons[12].pressed || gp.buttons[6].pressed;
    player.shieldInput = player.shieldInput || gp.buttons[7].pressed;

    const missileBtn = gp.buttons[0], bombBtn = gp.buttons[1], shootBtn = gp.buttons[2];

    if (player.powerupTimers.rapidFire > 0) {
        if (shootBtn.pressed) fireBullet(player);
    } else {
        if (shootBtn.pressed && !player.gamepadButtonsPressed[2]) fireBullet(player);
    }
    player.gamepadButtonsPressed[2] = shootBtn.pressed;

    if (missileBtn.pressed && !player.gamepadButtonsPressed[0] && !player.isChargingMissile && player.missileCount > 0) {
        player.isChargingMissile = true;
        player.missileChargeLevel = 0;
        player.missileChargeProgress = 0;
        startChargeSound();
    }
    if (!missileBtn.pressed && player.gamepadButtonsPressed[0] && player.isChargingMissile) {
        player.isChargingMissile = false;
        stopChargeSound();
        const num = Math.min(player.missileChargeLevel + 1, player.missileCount, MAX_CHARGE_LEVEL);
        if (num > 0) fireMissileSpread(player, num);
        player.missileChargeLevel = 0;
        player.missileChargeProgress = 0;
    }
    player.gamepadButtonsPressed[0] = missileBtn.pressed;

    if (bombBtn.pressed && !player.gamepadButtonsPressed[1] && player.missileCount > 0) {
        player.missileCount--;
        const rearX = player.x - player.r * 1.5 * Math.cos(player.a);
        const rearY = player.y - player.r * 1.5 * Math.sin(player.a);
        gameState.bombs.push(new Bomb(rearX, rearY, player.id));
        playBombDropSound();
    }
    player.gamepadButtonsPressed[1] = bombBtn.pressed;
}

export function updatePlayers(deltaTime) {
    const gamepads = Array.from(navigator.getGamepads()).filter(Boolean);
    if (gamepads.length) {
        const gp = gamepads[0];
        const startBtn = gp.buttons[9];
        if (startBtn?.pressed && !gameState.gamepadButtonsPressed[9]) {
            const isSubPanelOpen = ['pause-graphics-screen', 'pause-sound-screen', 'pause-gameplay-screen'].some(id => {
                const el = document.getElementById(id);
                return el && !el.classList.contains('hidden');
            });
            if (isSubPanelOpen) {
                closePauseOptions();
            } else if (gameState.status === 'playing') {
                gameState.status = 'paused';
                togglePauseScreen(true);
                if (isThrustSoundActive()) stopThrustSound();
                stopChargeSound();
            } else if (gameState.status === 'paused') {
                unpauseGame();
            }
        }
        gameState.gamepadButtonsPressed[9] = startBtn?.pressed;
    }

    for (const player of gameState.players) {
        if (player.lives <= 0) { player.isThrusting = false; continue; }

        player.update(deltaTime);

        player.rot = 0;
        player.isThrusting = false;
        player.shieldInput = false;

        if (player.inputConfig.type === 'keyboard1') handleKeyboardInput1(player);
        if (player.inputConfig.type === 'keyboard2') handleKeyboardInput2(player);
        if (player.inputConfig.type === 'gamepad') handleGamepadInput(player, navigator.getGamepads()[player.inputConfig.index]);
        if (player.inputConfig.type === 'keyboard_and_gamepad') {
            handleKeyboardInput1(player);
            handleGamepadInput(player, navigator.getGamepads()[player.inputConfig.index]);
        }

        if (player.isChargingMissile && player.missileCount > 0) {
            player.missileChargeProgress += deltaTime / MISSILE_CHARGE_TIME_PER_LEVEL;
            updateChargeSoundPitch(player.missileChargeProgress, player.missileChargeLevel);
            if (player.missileChargeProgress >= 1.0) {
                if (player.missileChargeLevel < MAX_CHARGE_LEVEL - 1 && player.missileChargeLevel < player.missileCount - 1) {
                    player.missileChargeLevel++;
                    player.missileChargeProgress = 0;
                    playChargeLevelUpSound();
                } else {
                    player.missileChargeProgress = 1.0;
                }
            }
        }

        if (player.shieldInput && !player.shieldWasActive) playShieldUpSound();
        else if (!player.shieldInput && player.shieldWasActive) playShieldDownSound();
        player.shieldWasActive = player.shieldInput;
    }

    const anyPlayerThrusting = gameState.players.some(p => p.isThrusting);
    if (anyPlayerThrusting && !isThrustSoundActive()) startThrustSound();
    else if (!anyPlayerThrusting && isThrustSoundActive()) stopThrustSound();
}

function handleInitialEntryKeyboard(e) {
    let charIndex = gameState.alphabet.indexOf(gameState.initialEntryState.initials[gameState.initialEntryState.activeIndex]);
    switch (e.key) {
        case 'ArrowUp':
            charIndex = (charIndex + 1) % gameState.alphabet.length;
            gameState.initialEntryState.initials[gameState.initialEntryState.activeIndex] = gameState.alphabet[charIndex];
            break;
        case 'ArrowDown':
            charIndex = (charIndex - 1 + gameState.alphabet.length) % gameState.alphabet.length;
            gameState.initialEntryState.initials[gameState.initialEntryState.activeIndex] = gameState.alphabet[charIndex];
            break;
        case 'ArrowLeft':
            gameState.initialEntryState.activeIndex = (gameState.initialEntryState.activeIndex - 1 + 3) % 3;
            break;
        case 'ArrowRight':
            gameState.initialEntryState.activeIndex = (gameState.initialEntryState.activeIndex + 1) % 3;
            break;
        case 'Enter':
            submitHighScore();
            break;
        case 'Escape':
            // Allow user to back out without saving
            destroy();
            window.location.href = 'index.html';
            break;
    }
    updateInitialEntryUI();
}

export function handleInitialEntryInput() {
    const gp = navigator.getGamepads()[0];
    if (!gp) return;
    const dpadUp   = gp.buttons[12];
    const dpadDown = gp.buttons[13];
    const dpadLeft = gp.buttons[14];
    const dpadRight= gp.buttons[15];
    const confirm  = gp.buttons[0];

    let charIndex = gameState.alphabet.indexOf(gameState.initialEntryState.initials[gameState.initialEntryState.activeIndex]);

    if (dpadUp?.pressed && !gameState.gamepadButtonsPressed[12]) {
        charIndex = (charIndex + 1) % gameState.alphabet.length;
        gameState.initialEntryState.initials[gameState.initialEntryState.activeIndex] = gameState.alphabet[charIndex];
        updateInitialEntryUI();
    }
    if (dpadDown?.pressed && !gameState.gamepadButtonsPressed[13]) {
        charIndex = (charIndex - 1 + gameState.alphabet.length) % gameState.alphabet.length;
        gameState.initialEntryState.initials[gameState.initialEntryState.activeIndex] = gameState.alphabet[charIndex];
        updateInitialEntryUI();
    }
    if (dpadLeft?.pressed && !gameState.gamepadButtonsPressed[14]) {
        gameState.initialEntryState.activeIndex = (gameState.initialEntryState.activeIndex - 1 + 3) % 3;
        updateInitialEntryUI();
    }
    if (dpadRight?.pressed && !gameState.gamepadButtonsPressed[15]) {
        gameState.initialEntryState.activeIndex = (gameState.initialEntryState.activeIndex + 1) % 3;
        updateInitialEntryUI();
    }
    if (confirm?.pressed && !gameState.gamepadButtonsPressed[0]) {
        submitHighScore();
    }
    gameState.gamepadButtonsPressed[0]  = confirm?.pressed;
    gameState.gamepadButtonsPressed[12] = dpadUp?.pressed;
    gameState.gamepadButtonsPressed[13] = dpadDown?.pressed;
    gameState.gamepadButtonsPressed[14] = dpadLeft?.pressed;
    gameState.gamepadButtonsPressed[15] = dpadRight?.pressed;
}

export function handleGameOverInput() {
    const gp = navigator.getGamepads()[0];
    if (!gp) return;
    const confirm = gp.buttons[0];
    const start   = gp.buttons[9];
    if ((confirm?.pressed && !gameState.gamepadButtonsPressed[0]) || (start?.pressed && !gameState.gamepadButtonsPressed[9])) {
        // Click the currently selected button, not a hardcoded ID.
        const selectedButton = document.querySelector('#game-over-screen .menu-btn.selected');
        selectedButton?.click();
    }
    gameState.gamepadButtonsPressed[0] = confirm?.pressed;
    gameState.gamepadButtonsPressed[9] = start?.pressed;
}

export function handleHangarInput() {
    const gp = navigator.getGamepads()?.[0];
    if (!gp) return;

    const confirmBtn = gp.buttons[0];
    const dpadUp = gp.buttons[12];
    const dpadDown = gp.buttons[13];
    const dpadLeft = gp.buttons[14];
    const dpadRight = gp.buttons[15];

    if (dpadUp?.pressed && !gameState.gamepadButtonsPressed[12]) navigateHangarMenu('up');
    if (dpadDown?.pressed && !gameState.gamepadButtonsPressed[13]) navigateHangarMenu('down');
    if (dpadLeft?.pressed && !gameState.gamepadButtonsPressed[14]) navigateHangarMenu('left');
    if (dpadRight?.pressed && !gameState.gamepadButtonsPressed[15]) navigateHangarMenu('right');

    if (confirmBtn?.pressed && !gameState.gamepadButtonsPressed[0]) {
        const selectedButton = document.querySelector('#hangar-screen .selected');
        selectedButton?.click();
    }

    gameState.gamepadButtonsPressed[0] = confirmBtn?.pressed;
    gameState.gamepadButtonsPressed[12] = dpadUp?.pressed;
    gameState.gamepadButtonsPressed[13] = dpadDown?.pressed;
    gameState.gamepadButtonsPressed[14] = dpadLeft?.pressed;
    gameState.gamepadButtonsPressed[15] = dpadRight?.pressed;
}

export function handlePauseInput() {
    const gp = navigator.getGamepads()[0];
    if (!gp) return;

    const confirmBtn = gp.buttons[0];
    const backBtn    = gp.buttons[1];
    const dpadUp     = gp.buttons[12];
    const dpadDown   = gp.buttons[13];
    const dpadLeft   = gp.buttons[14];
    const dpadRight  = gp.buttons[15];
    
    const activePanelScreenId = ['pause-graphics-screen', 'pause-sound-screen', 'pause-gameplay-screen']
        .find(id => {
            const el = document.getElementById(id);
            return el && !el.classList.contains('hidden');
        });

    if (activePanelScreenId) {
        const activePanelId = activePanelScreenId.replace('-screen', '-panel');

        if (backBtn?.pressed && !gameState.gamepadButtonsPressed[1]) {
            closePauseOptions();
        }
        if (dpadUp?.pressed && !gameState.gamepadButtonsPressed[12]) {
            navigatePanel(activePanelId, 'up');
        }
        if (dpadDown?.pressed && !gameState.gamepadButtonsPressed[13]) {
            navigatePanel(activePanelId, 'down');
        }
        if (confirmBtn?.pressed && !gameState.gamepadButtonsPressed[0]) {
            const selected = document.querySelector(`#${activePanelId} .selected`);
            if (selected && selected.classList.contains('slider-container')) {
                // Future enhancement
            } else {
                selected?.click();
            }
        }

        const activeSlider = document.querySelector(`#${activePanelId} .selected.slider-container input`);
        if (activeSlider) {
            if(dpadLeft?.pressed) {
                activeSlider.stepDown();
                activeSlider.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if(dpadRight?.pressed) {
                activeSlider.stepUp();
                activeSlider.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
        
    } else { // We are on the main pause screen
        if (backBtn?.pressed && !gameState.gamepadButtonsPressed[1]) {
            unpauseGame();
        }
        if (dpadUp?.pressed && !gameState.gamepadButtonsPressed[12]) {
            navigatePauseMenu('up');
        }
        if (dpadDown?.pressed && !gameState.gamepadButtonsPressed[13]) {
            navigatePauseMenu('down');
        }
        if (confirmBtn?.pressed && !gameState.gamepadButtonsPressed[0]) {
            const selected = document.querySelector('#pause-screen .selected');
            selected?.click();
        }
    }

    // Update button pressed states at the end
    gameState.gamepadButtonsPressed[0]  = confirmBtn?.pressed;
    gameState.gamepadButtonsPressed[1]  = backBtn?.pressed;
    gameState.gamepadButtonsPressed[12] = dpadUp?.pressed;
    gameState.gamepadButtonsPressed[13] = dpadDown?.pressed;
    gameState.gamepadButtonsPressed[14] = dpadLeft?.pressed;
    gameState.gamepadButtonsPressed[15] = dpadRight?.pressed;
}