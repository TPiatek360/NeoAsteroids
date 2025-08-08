// src/campaign/MutatorManager.js
// This file defines all possible gameplay mutators for the Daily Challenge mode.

// Each mutator is an object with three properties:
// - run(state): A function that modifies the gameState or related constants to apply the effect.
// - description: A user-facing string explaining the rule.
// - conflictsWith: An array of other mutator keys that this mutator cannot be active with.

export const MUTATORS = {
    // --- Physics & Environment Mutators ---
    REVERSE_GRAVITY: {
        run: (state) => {
            // This flag will be checked in main.js's applyGravity() function.
            state.mutators.gravitySign = -1; 
        },
        description: "Gravitational bodies now push objects away.",
        conflictsWith: []
    },

    // --- Visual & UI Mutators ---
    FLASHLIGHT_MODE: {
        run: (state) => {
            // This flag will be checked by the RenderSystem to draw the overlay.
            state.mutators.isFlashlightMode = true;
        },
        description: "The battlefield is dark except for a cone of light from your ship.",
        conflictsWith: []
    },

    // --- Control Mutators ---
    REVERSE_CONTROLS: {
        run: (state) => {
            // This flag will be checked in input.js to invert control logic.
            state.mutators.areControlsReversed = true;
        },
        description: "Your directional controls are inverted.",
        conflictsWith: []
    },

    // --- Enemy Behavior Mutators ---
    STEALTH_ENEMIES: {
        run: (state) => {
            // This flag will be checked in enemies.js to enable the STEALTH state.
            state.mutators.enemiesCanStealth = true;
        },
        description: "Standard enemy fighters can turn invisible until they attack.",
        conflictsWith: ['ALL_ACES'] // An all-ace run wouldn't have "standard" fighters.
    },
    ALL_ACES: {
        run: (state) => {
            // This flag will be checked by the SpawnSystem to alter spawn pools.
            state.mutators.isAllAcesMode = true;
        },
        description: "All standard enemy spawns are replaced with Aces.",
        conflictsWith: ['STEALTH_ENEMIES']
    },
    
    // --- Player Stat Mutators ---
    GLASS_CANNON: {
        run: (state) => {
            // This flag will be checked in Player.js or where damage is calculated/lives set.
            state.mutators.isGlassCannon = true;
        },
        description: "Players have only one life but deal double damage.",
        conflictsWith: []
    },
    NEWTONIAN_ONLY: {
        run: (state) => {
            // This directly sets a game setting for the run.
            state.flightModel = 'newtonian';
        },
        description: "Flight model is locked to Newtonian (inertia).",
        conflictsWith: []
    }
};

/**
 * A helper function to add the `mutators` object to the game state if it doesn't exist.
 * This should be called before applying any mutators.
 * @param {object} state The global game state.
 */
export function initializeMutatorState(state) {
    if (!state.mutators) {
        state.mutators = {
            // This object will hold the flags set by the 'run' functions.
            // e.g., isFlashlightMode: false, gravitySign: 1, etc.
        };
    }
}