// src/mutators/enemy-override.js
// This module replaces all enemy spawns with a single type chosen at the start of the run.

import { EnemyShip, Corvette, Cruiser, Minelayer, Ace } from '../entities/enemies.js';

// The list of enemies that can be chosen for the override.
const POSSIBLE_ENEMIES = [EnemyShip, Corvette, Cruiser, Minelayer, Ace];

export const enemy_override = {
    key: 'ENEMY_OVERRIDE',
    description: "All enemies are replaced by a single, randomly chosen type. Good luck.",
    conflictsWith: ['ALL_ACES', 'STEALTH_ENEMIES'], // Redundant with ALL_ACES, conflicts with STEALTH
    
    /**
     * This function runs once when the daily challenge starts.
     * It randomly selects an enemy class and stores it in the gameState.
     * @param {object} state The global gameState object.
     */
    run: (state) => {
        // Use a simple Math.random(). The daily seed has already made this deterministic for the day.
        const chosenClass = POSSIBLE_ENEMIES[Math.floor(Math.random() * POSSIBLE_ENEMIES.length)];
        state.mutators.enemyOverrideClass = chosenClass;
        console.log(`Enemy Override Mutator selected: All spawns will be ${chosenClass.name}.`);
    },
};