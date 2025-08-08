// src/mutators/reverse-controls.js
// This module inverts the player's primary movement controls.

export const reverse_controls = {
    key: 'REVERSE_CONTROLS',
    description: "Your directional controls are inverted.",
    conflictsWith: [],
    
    /**
     * Sets a flag that the input.js file will check to invert control logic.
     * @param {object} state The global gameState object.
     */
    run: (state) => {
        state.mutators.areControlsReversed = true;
    },
};