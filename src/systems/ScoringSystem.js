// src/systems/ScoringSystem.js
// Handles all player scoring logic by listening to game events.

import { gameState } from '../state.js';
import { updateGameUI } from '../ui/hud.js';
import { eventBus } from './EventBus.js';
import { ASTEROID_MIN_SIZE_FOR_PICKUP } from '../constants.js';

function awardScoreToPlayer(amount, playerId) {
    const scoringPlayer = gameState.players.find(p => p.id === playerId);
    if (scoringPlayer) {
        scoringPlayer.score += amount;
    } else { // If no specific player, split score in co-op
        if (gameState.gameMode !== 'twoPlayer' || gameState.twoPlayerMode === 'coop') {
            const livingPlayers = gameState.players.filter(p => p.lives > 0);
            if (livingPlayers.length > 0) {
                const scorePerPlayer = Math.round(amount / livingPlayers.length);
                livingPlayers.forEach(p => p.score += scorePerPlayer);
            }
        }
    }
    updateGameUI();
}

function onAsteroidDestroyed(data) {
    const { r, playerId } = data;
    const score = r > ASTEROID_MIN_SIZE_FOR_PICKUP ? 20 : 50;
    awardScoreToPlayer(score, playerId);
}

function onEnemyDestroyed(data) {
    const { enemy, playerId } = data;

    let score = 0;
    switch (enemy.constructor.name) {
        case 'EnemyShip': score = 250; break;
        case 'Corvette': score = 1000; break;
        case 'Minelayer': score = 400; break;
        case 'Ace': score = 750; break;
        // Cruiser score is handled by its own events
    }
    if (score > 0) {
        awardScoreToPlayer(score, playerId);
    }
}

function onCruiserSectionDestroyed(data) {
    awardScoreToPlayer(500, data.playerId);
}

function onCruiserFinalDeath(data) {
    awardScoreToPlayer(5000, data.playerId);
}

export function initScoringSystem() {
    eventBus.on('asteroid_destroyed', onAsteroidDestroyed);
    eventBus.on('enemy_destroyed', onEnemyDestroyed);
    eventBus.on('cruiser_section_destroyed', onCruiserSectionDestroyed);
    eventBus.on('cruiser_final_death', onCruiserFinalDeath);
}