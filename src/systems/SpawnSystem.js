// src/systems/SpawnSystem.js
// Handles the logic for when and how to spawn new enemies.

import { gameState } from '../state.js';
import { DIFFICULTY_SETTINGS, ACE_SPAWN_LEVEL } from '../constants.js';
import { EnemyShip, Corvette, Cruiser, Minelayer, Ace } from '../entities/enemies.js';
import { eventBus } from './EventBus.js';

/**
 * Checks game conditions and spawns enemies accordingly.
 * @param {object} state - The game state object.
 * @param {number} deltaTime - The time since the last frame.
 */
export function updateSpawning(state, deltaTime) {
    const settings = DIFFICULTY_SETTINGS[state.currentDifficulty];
    const levelScale = Math.pow(1.05, state.level - 1);
    
    // Base spawning on the combined score of all players.
    const currentScore = state.players.reduce((sum, p) => sum + p.score, 0);

    const isCorvetteActive = state.enemies.some(e => e.constructor.name === 'Corvette');
    if (isCorvetteActive) {
        return;
    }

    const isCruiserActive = state.enemies.some(e => e.constructor.name === 'Cruiser');
    
    const scaledCruiserInterval = settings.cruiserSpawnInterval ? settings.cruiserSpawnInterval / levelScale : null;
    const scaledCorvetteInterval = settings.corvetteSpawnInterval / levelScale;
    const scaledMinelayerInterval = settings.minelayerSpawnInterval ? settings.minelayerSpawnInterval / levelScale : null;
    const scaledAceInterval = settings.aceSpawnInterval ? settings.aceSpawnInterval / levelScale : null;

    if (!isCruiserActive && scaledCruiserInterval && currentScore > state.lastCruiserSpawnScore + scaledCruiserInterval) {
        state.enemies.push(new Cruiser());
        eventBus.dispatch('enemy_spawned', { type: 'Cruiser' });
        state.lastCruiserSpawnScore = currentScore;
        state.lastCorvetteSpawnScore = currentScore;
        state.lastMinelayerSpawnScore = currentScore;
        state.lastAceSpawnScore = currentScore; // Also reset Ace timer
    }
    else if (scaledMinelayerInterval && currentScore > state.lastMinelayerSpawnScore + scaledMinelayerInterval) {
        state.enemies.push(new Minelayer());
        eventBus.dispatch('enemy_spawned', { type: 'Minelayer' });
        state.lastMinelayerSpawnScore = currentScore;
    }
    else if (scaledCorvetteInterval && currentScore > state.lastCorvetteSpawnScore + scaledCorvetteInterval) {
        state.enemies.push(new Corvette());
        eventBus.dispatch('enemy_spawned', { type: 'Corvette' });
        state.lastCorvetteSpawnScore = currentScore;
    }
    else if (scaledAceInterval && state.level >= ACE_SPAWN_LEVEL && currentScore > state.lastAceSpawnScore + scaledAceInterval) {
        state.enemies.push(new Ace());
        eventBus.dispatch('enemy_spawned', { type: 'Ace' });
        state.lastAceSpawnScore = currentScore;
    }
    else {
        // If no capital ships are spawning, manage the basic enemy timer.
        state.enemySpawnTimer -= deltaTime;
        if (state.enemySpawnTimer <= 0) {
            state.enemies.push(new EnemyShip());
            eventBus.dispatch('enemy_spawned', { type: 'EnemyShip' });
            // Reset timer for the next spawn
            state.enemySpawnTimer = (settings.enemySpawnTimeInterval + Math.random() * 10000) / levelScale;
        }
    }
}