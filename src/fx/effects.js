// src/fx/effects.js
// Contains functions for creating explosions, screen shake, and other visual effects.

import { gameState } from '../state.js';
import { Particle } from './particles.js';

/**
 * Creates a number of particle effects at a given location.
 * @param {number} x - The x-coordinate of the explosion.
 * @param {number} y - The y-coordinate of the explosion.
 * @param {string} color - The color of the particles.
 * @param {number} count - The number of particles to create.
 * @param {number} maxSpeed - The maximum speed of the particles.
 */
export function createExplosion(x, y, color, count, maxSpeed) {
    for (let i = 0; i < count; i++) {
        gameState.particles.push(new Particle(x, y, color, maxSpeed));
    }
}

/**
 * Triggers a screen shake effect.
 * @param {number} magnitude - The intensity of the shake.
 * @param {number} duration - The duration of the shake in frames.
 */
export function triggerScreenShake(magnitude, duration) {
    gameState.shakeMagnitude = magnitude;
    gameState.shakeDuration = duration;
}

/**
 * Triggers a gamepad rumble effect.
 * @param {number} strongMagnitude - The magnitude for the strong (low-frequency) motor.
 * @param {number} weakMagnitude - The magnitude for the weak (high-frequency) motor.
 * @param {number} duration - The duration of the rumble in milliseconds.
 */
export function triggerRumble(strongMagnitude, weakMagnitude, duration) {
    if (!gameState.activeGamepad) return;

    const gp = navigator.getGamepads()[gameState.activeGamepad.index];
    if (!gp || !gp.vibrationActuator || gp.vibrationActuator.type !== 'dual-rumble') {
        return;
    }

    gp.vibrationActuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration: duration,
        weakMagnitude: weakMagnitude,
        strongMagnitude: strongMagnitude
    }).catch(() => { /* Ignore errors, e.g. if context is lost */ });
}