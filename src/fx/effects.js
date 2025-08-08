// src/fx/effects.js
// Contains functions for creating explosions, screen shake, and other visual effects.

import { gameState } from '../state.js';
import { Particle, Spark, DamageSmoke } from './particles.js';
import { CapitalExplosion } from './capitalExplosion.js';
import { IonEffect } from './ionEffect.js';
import { getDynamicColor } from '../utils.js';

/**
 * Creates a number of particle effects at a given location.
 * @param {number} x - The x-coordinate of the explosion.
 * @param {number} y - The y-coordinate of the explosion.
 * @param {string} color - The color of the particles.
 * @param {number} count - The number of particles to create.
 * @param {number} maxSpeed - The maximum speed of the particles.
 * @param {number | null} lifetime - The lifetime of the particles in milliseconds.
 */
export function createExplosion(x, y, color, count, maxSpeed, lifetime = null) {
    const dynamicColor = getDynamicColor(color);
    for (let i = 0; i < count; i++) {
        gameState.particles.push(new Particle(x, y, dynamicColor, maxSpeed, lifetime));
    }
}

/**
 * Creates a large, multi-stage capital ship explosion.
 * @param {number} x - The x-coordinate of the explosion.
 * @param {number} y - The y-coordinate of the explosion.
 * @param {number} radius - The maximum radius of the explosion.
 */
export function createCapitalExplosion(x, y, radius) {
    gameState.capitalExplosions.push(new CapitalExplosion(x, y, radius));
}

/**
 * Creates a puff of damage smoke on a ship.
 * @param {object} ship - The ship entity that is smoking.
 */
export function createDamageSmoke(ship) {
    gameState.damageSmoke.push(new DamageSmoke(ship));
}

/**
 * Creates a burst of sparks at a specific location.
 * @param {number} x - The x-coordinate for the spark burst.
 * @param {number} y - The y-coordinate for the spark burst.
 * @param {number} count - The number of sparks to create.
 */
export function createSparks(x, y, count) {
    for (let i = 0; i < count; i++) {
        gameState.sparks.push(new Spark(x, y));
    }
}

/**
 * Creates a temporary ion/electrical effect on a ship.
 * @param {object} ship - The ship entity to apply the effect to.
 */
export function createIonEffect(ship) {
    // Prevent stacking multiple ion effects on the same ship
    const existingEffect = gameState.ionEffects.find(e => e.parent === ship);
    if (existingEffect) {
        existingEffect.life = existingEffect.initialLife; // Just reset the timer
    } else {
        gameState.ionEffects.push(new IonEffect(ship));
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