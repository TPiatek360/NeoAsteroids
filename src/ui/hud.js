// src/ui/hud.js
// Manages all DOM elements and UI updates for the in-game Heads-Up Display.

import { gameState } from '../state.js';
import { MAX_CHARGE_LEVEL, SHIELD_MAX_ENERGY } from '../constants.js';

// --- Element Selectors ---
const levelEl = document.getElementById('level');

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

// --- HUD Update Functions ---

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

    hud.shieldBarFill.style.width = `${(player.shieldEnergy / SHIELD_MAX_ENERGY) * 100}%`;
    let powerupText = '';
    if (player.powerupTimers.rapidFire > 0) powerupText += `RAPID FIRE: ${Math.ceil(player.powerupTimers.rapidFire / 1000)}s `;
    if (player.powerupTimers.spreadShot > 0) powerupText += `SPREAD SHOT: ${Math.ceil(player.powerupTimers.spreadShot / 1000)}s`;
    hud.powerupStatus.textContent = powerupText;
}

export function updateGameUI() {
    if (levelEl) levelEl.textContent = `LEVEL: ${gameState.level}`;
    if (gameState.players[0]) updatePlayerHUD(gameState.players[0], p1HUD);
    // Only show P2 HUD if they exist
    if (gameState.players[1]) {
        p2HUD.container.classList.remove('hidden');
        updatePlayerHUD(gameState.players[1], p2HUD);
    } else {
        p2HUD.container.classList.add('hidden');
    }
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