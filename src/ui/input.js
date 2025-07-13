// src/ui/input.js
// Handles all keyboard input and event listener setup.

import { gameState } from '../state.js';
import { setCanvasSize } from '../utils.js';
import { submitHighScore } from '../main.js';
import {
    initAudio, isAudioInitialized, playShootSound, startChargeSound,
    stopChargeSound, playBombDropSound, startThrustSound, stopThrustSound,
    isThrustSoundActive, playShieldUpSound, playShieldDownSound, playMenuSelectSound,
    playChargeLevelUpSound, updateChargeSoundPitch
} from '../audio/audio.js';
import {
    getMainMenuElement, getControlsMenuElement, getSoundMenuElement, getGameplayMenuElement,
    updateInitialEntryUI, updateChargeBar
} from './ui.js';
import { fireBullet, fireMissileSpread } from '../entities/weapons.js';
import { Bomb } from '../entities/weapons.js';
import { MAX_CHARGE_LEVEL, MISSILE_CHARGE_TIME_PER_LEVEL } from '../constants.js';

// ---------- GAMEPAD CACHE ----------
// This function is now the key to solving the race condition.
function setupGamepadListeners() {
    window.addEventListener('gamepadconnected', (e) => {
        console.log('Gamepad connected:', e.gamepad.id, 'index', e.gamepad.index);
        // Add the gamepad to our cache for future game starts.
        gameState.activeGamepads[e.gamepad.index] = e.gamepad;

        // --- FIX: Check if we can upgrade a current player ---
        // If we are in a single-player game and a player exists...
        if (gameState.gameMode === 'singlePlayer' && gameState.players.length > 0) {
            const p1 = gameState.players[0];
            // ...and that player is currently keyboard-only...
            if (p1.inputConfig.type === 'keyboard1') {
                // ...upgrade their input configuration on the fly!
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

// ---------- GAME PAGE EVENT LISTENERS ----------
export function setupGameEventListeners(initGameCallback) {
    gameState.keys = {
        'ArrowUp': false, 'ArrowLeft': false, 'ArrowRight': false, ' ': false, 'm': false, 'b': false, 'ShiftRight': false,
        'w': false, 'a': false, 'd': false, 'Tab': false, 'g': false, 'f': false, 'ShiftLeft': false
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
        if (gameState.status === 'enteringScore') {
            handleInitialEntryKeyboard(e);
            e.preventDefault();
            return;
        }
        if (gameState.status !== 'playing') return;

        const key = e.key.toLowerCase();
        if (gameState.keys.hasOwnProperty(e.key)) gameState.keys[e.key] = true;
        if (e.code === 'Space') gameState.keys[' '] = true;
        if (e.code === 'ShiftRight') gameState.keys['ShiftRight'] = true;
        if (e.code === 'ShiftLeft') gameState.keys['ShiftLeft'] = true;

        const p1 = gameState.players.find(p => p.inputConfig.type === 'keyboard1' || p.inputConfig.type === 'keyboard_and_gamepad');
        const p2 = gameState.players.find(p => p.inputConfig.type === 'keyboard2');

        if (!e.repeat) {
            if (p1 && p1.inputCooldown <= 0 && key === 'm' && !p1.isChargingMissile && p1.missileCount > 0) {
                p1.isChargingMissile = true; p1.missileChargeLevel = 0; p1.missileChargeProgress = 0;
                startChargeSound(); updateChargeBar();
            }
            if (p2 && p2.inputCooldown <= 0 && key === 'g' && !p2.isChargingMissile && p2.missileCount > 0) {
                p2.isChargingMissile = true; p2.missileChargeLevel = 0; p2.missileChargeProgress = 0;
                startChargeSound(); updateChargeBar();
            }

            if (p1 && p1.inputCooldown <= 0 && e.code === 'Space') fireBullet(p1);
            if (p2 && p2.inputCooldown <= 0 && key === 'tab') fireBullet(p2);

            if (p1 && p1.inputCooldown <= 0 && key === 'b' && p1.missileCount > 0) {
                p1.missileCount--;
                const rearX = p1.x - (p1.r * 1.5) * Math.cos(p1.a);
                const rearY = p1.y - (p1.r * 1.5) * Math.sin(p1.a);
                gameState.bombs.push(new Bomb(rearX, rearY, p1.id));
                playBombDropSound();
            }
            if (p2 && p2.inputCooldown <= 0 && key === 'f' && p2.missileCount > 0) {
                p2.missileCount--;
                const rearX = p2.x - (p2.r * 1.5) * Math.cos(p2.a);
                const rearY = p2.y - (p2.r * 1.5) * Math.sin(p2.a);
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
        if (e.code === 'ShiftRight') gameState.keys['ShiftRight'] = false;
        if (e.code === 'ShiftLeft') gameState.keys['ShiftLeft'] = false;

        const p1 = gameState.players.find(p => p.inputConfig.type === 'keyboard1' || p.inputConfig.type === 'keyboard_and_gamepad');
        const p2 = gameState.players.find(p => p.inputConfig.type === 'keyboard2');

        if (p1 && p1.inputCooldown <= 0 && key === 'm' && p1.isChargingMissile) {
            p1.isChargingMissile = false; stopChargeSound();
            let num = Math.min(p1.missileChargeLevel + 1, p1.missileCount, MAX_CHARGE_LEVEL);
            if (num > 0) fireMissileSpread(p1, num);
            p1.missileChargeLevel = 0; p1.missileChargeProgress = 0; updateChargeBar();
        }
        if (p2 && p2.inputCooldown <= 0 && key === 'g' && p2.isChargingMissile) {
            p2.isChargingMissile = false; stopChargeSound();
            let num = Math.min(p2.missileChargeLevel + 1, p2.missileCount, MAX_CHARGE_LEVEL);
            if (num > 0) fireMissileSpread(p2, num);
            p2.missileChargeLevel = 0; p2.missileChargeProgress = 0; updateChargeBar();
        }
    };

    window.addEventListener('keydown', initAudioOnFirstInteraction, { once: true });
    window.addEventListener('keydown', keydownListener);
    window.addEventListener('keyup', keyupListener);

    window.addEventListener('resize', () => setCanvasSize(document.getElementById('gameCanvas')));

    setupGamepadListeners();

    return { keydownListener, keyupListener };
}

// ---------- PLAYER UPDATE ----------
function handleKeyboardInput1(player) {
    if (player.inputCooldown > 0) return;
    if (gameState.keys['ArrowLeft']) player.rot = -0.1;
    if (gameState.keys['ArrowRight']) player.rot = 0.1;
    player.isThrusting = player.isThrusting || gameState.keys['ArrowUp'];
    player.shieldInput = player.shieldInput || gameState.keys['ShiftRight'];
}

function handleKeyboardInput2(player) {
    if (player.inputCooldown > 0) return;
    if (gameState.keys['a']) player.rot = -0.1;
    if (gameState.keys['d']) player.rot = 0.1;
    player.isThrusting = player.isThrusting || gameState.keys['w'];
    player.shieldInput = player.shieldInput || gameState.keys['ShiftLeft'];
}

function handleGamepadInput(player, gp) {
    if (!gp) return;
    let gamepadAiming = false;
    const stickX = gp.axes[0], stickY = gp.axes[1];
    const stickMagnitude = Math.sqrt(stickX * stickX + stickY * stickY);
    if (stickMagnitude > 0.25) {
        gamepadAiming = true;
        player.a = Math.atan2(stickY, stickX);
        player.rot = 0;
    }
    if (!gamepadAiming) {
        if (gp.buttons[14].pressed) player.rot = -0.1;
        if (gp.buttons[15].pressed) player.rot = 0.1;
    }
    player.isThrusting = player.isThrusting ||
        (gameState.currentControlScheme === 'combined' && stickMagnitude > 0.25) ||
        gp.buttons[12].pressed || gp.buttons[6].pressed;
    player.shieldInput = player.shieldInput || gp.buttons[7].pressed;

    const missileButton = gp.buttons[0], bombButton = gp.buttons[1], shootButton = gp.buttons[2];

    if (player.powerupTimers.rapidFire > 0) {
        if (shootButton.pressed) fireBullet(player);
    } else {
        if (shootButton.pressed && !player.gamepadButtonsPressed[2]) fireBullet(player);
    }
    player.gamepadButtonsPressed[2] = shootButton.pressed;

    if (missileButton.pressed && !player.gamepadButtonsPressed[0] && !player.isChargingMissile && player.missileCount > 0) {
        player.isChargingMissile = true; player.missileChargeLevel = 0; player.missileChargeProgress = 0;
        startChargeSound(); updateChargeBar();
    }
    if (!missileButton.pressed && player.gamepadButtonsPressed[0] && player.isChargingMissile) {
        player.isChargingMissile = false; stopChargeSound();
        let num = Math.min(player.missileChargeLevel + 1, player.missileCount, MAX_CHARGE_LEVEL);
        if (num > 0) fireMissileSpread(player, num);
        player.missileChargeLevel = 0;
        player.missileChargeProgress = 0; 
        updateChargeBar();
    }
    player.gamepadButtonsPressed[0] = missileButton.pressed;

    if (bombButton.pressed && !player.gamepadButtonsPressed[1] && player.missileCount > 0) {
        player.missileCount--;
        const rearX = player.x - (player.r * 1.5) * Math.cos(player.a);
        const rearY = player.y - (player.r * 1.5) * Math.sin(player.a);
        gameState.bombs.push(new Bomb(rearX, rearY, player.id));
        playBombDropSound();
    }
    player.gamepadButtonsPressed[1] = bombButton.pressed;
}

export function updatePlayers(deltaTime) {
    for (const player of gameState.players) {
        if (player.lives <= 0) { player.isThrusting = false; continue; }
        player.update(deltaTime);
        player.rot = 0; player.isThrusting = false; player.shieldInput = false;

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
                    player.missileChargeLevel++; player.missileChargeProgress = 0;
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
    if (anyPlayerThrusting && !isThrustSoundActive()) {
        startThrustSound();
    } else if (!anyPlayerThrusting && isThrustSoundActive()) {
        stopThrustSound();
    }

    updateChargeBar();
}

// ---------- MENU / UI INPUT ----------
export function handleMenuGamepadInput() {
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
    }
    updateInitialEntryUI();
}

export function handleInitialEntryInput() {
    const gamepads = Array.from(navigator.getGamepads()).filter(gp => gp);
    if (gamepads.length === 0) return;
    const gp = gamepads[0];
    if (!gp) return;

    const dpadUp = gp.buttons[12];
    const dpadDown = gp.buttons[13];
    const dpadLeft = gp.buttons[14];
    const dpadRight = gp.buttons[15];
    const confirmBtn = gp.buttons[0];
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
    if (confirmBtn?.pressed && !gameState.gamepadButtonsPressed[0]) {
        submitHighScore();
    }
    gameState.gamepadButtonsPressed[0] = confirmBtn?.pressed;
    gameState.gamepadButtonsPressed[12] = dpadUp?.pressed;
    gameState.gamepadButtonsPressed[13] = dpadDown?.pressed;
    gameState.gamepadButtonsPressed[14] = dpadLeft?.pressed;
    gameState.gamepadButtonsPressed[15] = dpadRight?.pressed;
}

export function handleGameOverInput() {
    const gamepads = Array.from(navigator.getGamepads()).filter(gp => gp);
    if (gamepads.length === 0) return;
    const gp = gamepads[0];
    if (!gp) return;

    const confirmBtn = gp.buttons[0]; // A button
    const startBtn = gp.buttons[9];   // Start button

    if ((confirmBtn?.pressed && !gameState.gamepadButtonsPressed[0]) || (startBtn?.pressed && !gameState.gamepadButtonsPressed[9])) {
        const returnBtn = document.getElementById('return-to-menu-btn');
        returnBtn?.click();
    }

    gameState.gamepadButtonsPressed[0] = confirmBtn?.pressed;
    gameState.gamepadButtonsPressed[9] = startBtn?.pressed;
}