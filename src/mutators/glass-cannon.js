// src/mutators/glass-cannon.js
// This module sets the player to have only one life but deal increased damage.

export const glass_cannon = {
    key: 'GLASS_CANNON',
    description: "Players have only one life but deal double damage.",
    conflictsWith: [],
    
    /**
     * Directly modifies player stats at the beginning of the run.
     * @param {object} state The global gameState object.
     */
    run: (state) => {
        state.mutators.isGlassCannon = true; // Flag for damage calculation
        
        // This logic runs after players are created but before the game starts.
        state.players.forEach(p => {
            p.lives = 1;
            // We'll add a property to the player that the collision system can check.
            p.damageMultiplier = 2; 
        });
        console.log("Glass Cannon Mutator: Players set to 1 life and 2x damage.");
    },
};