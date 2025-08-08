// src/mutators/reverse-gravity.js
// This module makes gravitational bodies push entities away instead of pulling them in.

export const reverse_gravity = {
    key: 'REVERSE_GRAVITY',
    description: "Gravitational bodies now push objects away.",
    conflictsWith: [], // This mutator doesn't conflict with any others yet.
    
    /**
     * This function is run once when the daily challenge starts.
     * It sets a flag in the game state that the physics engine will check.
     * @param {object} state The global gameState object.
     */
    run: (state) => {
        state.mutators.gravitySign = -1; // Set gravity to be repulsive.
    },
};