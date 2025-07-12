// src/ui/input.js
// Handles all player control logic.

import { gameState } from '../state.js';
import { updateInitialEntryUI } from './ui.js';
import { updateChargeBar } from './hud.js';
import { fireBullet, fireMissileSpread, dropBomb } from '../entities/weapons.js';
import {
    startChargeSound, stopChargeSound, startThrustSound,
    stopThrustSound, playShieldUpSound, playShieldDownSound, isThrustSoundActive,
    playChargeLevelUpSound, updateChargeSoundPitch
} from '../audio/audio.js';
import { MAX_CHARGE_LEVEL, MISSILE_CHARGE_TIME_PER_LEVEL } from '../constants.js';

function handleKeyboardInput1(player) {
    if (player.inputCooldown > 0) return;
    if (gameState.keys['ArrowLeft']) player.rot = -0.1;
    if (gameState.keys['ArrowRight']) player.rot = 0.1;
    player.isThrusting = player.isThrusting || gameState.keys['ArrowUp'];
    player.shieldInput = player.shieldInput || gameState.keys['ShiftRight'];
    // Firing flags are set in main.js keydown/keyup events
}

function handleKeyboardInput2(player) {
    if (player.inputCooldown > 0) return;
    if (gameState.keys['a']) player.rot = -0.1;
    if (gameState.keys['d']) player.rot = 0.1;
    player.isThrusting = player.isThrusting || gameState.keys['w'];
    player.shieldInput = player.shieldInput || gameState.keys['ShiftLeft'];
    // Firing flags are set in main.js keydown/keyup events
}

function handleGamepadInput(player, gp) {
    let command = null;
    if (!gp) return command;

    const startBtn = gp.buttons[9];
    if (startBtn?.pressed && !player.gamepadButtonsPressed[9]) {
        if (gameState.status === 'playing' && gameState.allowPause) {
            command = 'pause';
        } else if (gameState.status === 'paused') {
            command = 'resume';
        }
    }
    player.gamepadButtonsPressed[9] = startBtn?.pressed;

    if (player.inputCooldown > 0) {
        player.gamepadButtonsPressed[0] = gp.buttons[0].pressed;
        player.gamepadButtonsPressed[1] = gp.buttons[1].pressed;
        player.gamepadButtonsPressed[2] = gp.buttons[2].pressed;
        return command;
    }

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

    player.isThrusting = player.isThrusting || (gameState.currentControlScheme === 'combined' && stickMagnitude > 0.25) || gp.buttons[12].pressed || gp.buttons[6].pressed;
    player.shieldInput = player.shieldInput || gp.buttons[7].pressed;

    const missileButton = gp.buttons[0], bombButton = gp.buttons[1], shootButton = gp.buttons[2];

    if (shootButton.pressed) player.wantsToShoot = true;

    if (missileButton.pressed && !player.gamepadButtonsPressed[0]) {
        player.wantsToChargeMissile = true;
    }
    if (!missileButton.pressed && player.gamepadButtonsPressed[0]) {
        player.wantsToReleaseMissile = true;
    }
    player.gamepadButtonsPressed[0] = missileButton.pressed;

    if (bombButton.pressed && !player.gamepadButtonsPressed[1]) {
        player.wantsToDropBomb = true;
    }
    player.gamepadButtonsPressed[1] = bombButton.pressed;
    return command;
}

function processPlayerActions(player, deltaTime) {
    if (player.inputCooldown > 0) return;

    // --- Process Action Flags ---
    if (player.wantsToShoot) {
        fireBullet(player);
    }
    if (player.wantsToDropBomb) {
        dropBomb(player);
    }
    if (player.wantsToChargeMissile) {
        if (!player.isChargingMissile && player.missileCount > 0) {
            player.isChargingMissile = true;
            player.missileChargeLevel = 0;
            player.missileChargeProgress = 0;
            startChargeSound();
            updateChargeBar();
        }
    }
    if (player.wantsToReleaseMissile) {
        if (player.isChargingMissile) {
            player.isChargingMissile = false;
            stopChargeSound();
            let numToFire = player.missileChargeLevel + 1;
            numToFire = Math.min(numToFire, player.missileCount, MAX_CHARGE_LEVEL);
            if (numToFire > 0) {
                fireMissileSpread(player, numToFire);
            }
            player.missileChargeLevel = 0;
            player.missileChargeProgress = 0;
            updateChargeBar();
        }
    }

    // --- Handle continuous actions (charging) ---
    if (player.isChargingMissile && player.missileCount > 0) {
        player.missileChargeProgress += deltaTime / MISSILE_CHARGE_TIME_PER_LEVEL;
        updateChargeSoundPitch(player.missileChargeProgress, player.missileChargeLevel);
        if (player.missileChargeProgress >= 1.0) {
            if (player.missileChargeLevel < MAX_CHARGE_LEVEL - 1 && player.missileChargeLevel < player.missileCount - 1) {
                player.missileChargeLevel++;
                player.missileChargeProgress = 0;
                playChargeLevelUpSound();
            } else {
                player.missileChargeProgress = 1.0; // Clamp at max progress
            }
        }
    }

    // --- Reset one-shot flags ---
    player.wantsToShoot = false;
    player.wantsToDropBomb = false;
    player.wantsToChargeMissile = false;
    player.wantsToReleaseMissile = false;
}

export function updatePlayers(deltaTime) {
    let command = null;
    for (const player of gameState.players) {
        if (player.lives <= 0) {
            player.isThrusting = false;
            continue;
        };

        player.update(deltaTime);

        // This logic handles gamepad button history even when paused, to prevent stale inputs
        const gp = navigator.getGamepads()[player.inputConfig.index];
        if (gp) {
            player.gamepadButtonsPressed[9] = gp.buttons[9].pressed;
        }

        if (gameState.status !== 'playing') continue;

        // Reset movement/state flags
        player.rot = 0;
        player.isThrusting = false;
        player.shieldInput = false;

        // Gather input from all sources
        let playerCommand = null;
        if (player.inputConfig.type === 'keyboard1') handleKeyboardInput1(player);
        if (player.inputConfig.type === 'keyboard2') handleKeyboardInput2(player);
        if (player.inputConfig.type === 'gamepad' || player.inputConfig.type === 'keyboard_and_gamepad') {
            handleKeyboardInput1(player); // Also apply keyboard 1 for this hybrid scheme
            playerCommand = handleGamepadInput(player, gp);
        }
        if (playerCommand) command = playerCommand; // Prioritize the command from this player

        // Process all gathered input flags into actions
        processPlayerActions(player, deltaTime);

        if (player.shieldInput && !player.shieldWasActive) playShieldUpSound();
        else if (!player.shieldInput && player.shieldWasActive) playShieldDownSound();
        player.shieldWasActive = player.shieldInput;
    }

    // Handle global sounds
    const anyPlayerThrusting = gameState.players.some(p => p.isThrusting);
    if (anyPlayerThrusting && !isThrustSoundActive()) {
        startThrustSound();
    } else if (!anyPlayerThrusting && isThrustSoundActive()) {
        stopThrustSound();
    }

    updateChargeBar();
    return command;
}

export function handleInitialEntryKeyboard(e) {
    let charIndex = gameState.alphabet.indexOf(gameState.initialEntryState.initials[gameState.initialEntryState.activeIndex]);
    let command = null;
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
            command = 'submit';
            break;
    }
    updateInitialEntryUI();
    return command;
}

export function handleInitialEntryInput() {
    // This is called from the game loop, so we need to check for gamepads.
    const gamepads = Array.from(navigator.getGamepads()).filter(gp => gp);
    if (gamepads.length === 0) return null;
    const gp = gamepads[0];
    if (!gp) return null;

    const dpadUp = gp.buttons[12];
    const dpadDown = gp.buttons[13];
    const dpadLeft = gp.buttons[14];
    const dpadRight = gp.buttons[15];
    const confirmBtn = gp.buttons[0];
    let charIndex = gameState.alphabet.indexOf(gameState.initialEntryState.initials[gameState.initialEntryState.activeIndex]);
    let command = null;

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
        command = 'submit';
    }
    gameState.gamepadButtonsPressed[0] = confirmBtn?.pressed;
    gameState.gamepadButtonsPressed[12] = dpadUp?.pressed;
    gameState.gamepadButtonsPressed[13] = dpadDown?.pressed;
    gameState.gamepadButtonsPressed[14] = dpadLeft?.pressed;
    gameState.gamepadButtonsPressed[15] = dpadRight?.pressed;
    return command;
}

export function handleGameOverInput() {
    const gamepads = Array.from(navigator.getGamepads()).filter(gp => gp);
    if (gamepads.length === 0) return null;
    const gp = gamepads[0];
    if (!gp) return null;

    const confirmBtn = gp.buttons[0];
    const startBtn = gp.buttons[9];
    let command = null;

    if ((confirmBtn?.pressed && !gameState.gamepadButtonsPressed[0]) || (startBtn?.pressed && !gameState.gamepadButtonsPressed[9])) {
        command = 'quit';
    }

    gameState.gamepadButtonsPressed[0] = confirmBtn?.pressed;
    gameState.gamepadButtonsPressed[9] = startBtn?.pressed;
    return command;
}

export function handlePauseInput() {
    const gamepads = Array.from(navigator.getGamepads()).filter(gp => gp);
    if (gamepads.length === 0) return null;
    const gp = gamepads[0];
    if (!gp) return null;

    const resumeBtn = gp.buttons[9]; // Start
    const confirmBtn = gp.buttons[0]; // A
    const quitBtn = gp.buttons[8]; // Select/Back
    let command = null;

    if ((resumeBtn?.pressed && !gameState.gamepadButtonsPressed[9]) || (confirmBtn?.pressed && !gameState.gamepadButtonsPressed[0])) {
        command = 'resume';
    }
    if (quitBtn?.pressed && !gameState.gamepadButtonsPressed[8]) {
        command = 'quit';
    }

    gameState.gamepadButtonsPressed[0] = confirmBtn?.pressed;
    gameState.gamepadButtonsPressed[8] = quitBtn?.pressed;
    gameState.gamepadButtonsPressed[9] = resumeBtn?.pressed;
    return command;
}