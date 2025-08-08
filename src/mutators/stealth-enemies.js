// src/mutators/stealth-enemies.js
// This module gives standard enemy fighters the ability to turn invisible.

export const stealth_enemies = {
    key: 'STEALTH_ENEMIES',
    description: "Standard enemy fighters can turn invisible until they attack.",
    conflictsWith: ['ALL_ACES', 'ENEMY_OVERRIDE'], // Can't have stealth fighters if there are no standard fighters.
    
    /**
     * Sets a flag that the EnemyShip class will check to enable stealth logic.
     * @param {object} state The global gameState object.
     */
    run: (state) => {
        state.mutators.enemiesCanStealth = true;
    },

    // This mutator doesn't have a permanent visual overlay, so it doesn't need a drawOverlay function.
    // The stealth effect itself is handled within the EnemyShip's draw method.
};