// src/systems/SpawnSystem.js
// Handles the logic for when and how to spawn new enemies.

import { gameState } from '../state.js';
import { DIFFICULTY_SETTINGS, ACE_SPAWN_LEVEL } from '../constants.js';
import { EnemyShip, Corvette, Cruiser, Minelayer, Ace } from '../entities/enemies.js';

/**
 * Spawns a coordinated squadron of ships for a given faction.
 * @param {string} faction - 'enemy' or 'ally'.
 */
function spawnSquadron(faction = 'enemy') {
    const squadId = `squad_${Date.now()}`;
    const wingmanCount = Math.random() < 0.5 ? 1 : 2; // 1 or 2 wingmen

    // 1. Create the leader
    const leader = new EnemyShip(faction);
    leader.isLeader = true;
    leader.squadId = squadId;
    
    const targetArray = faction === 'ally' ? gameState.allies : gameState.enemies;
    targetArray.push(leader);

    // 2. Create wingmen
    for (let i = 0; i < wingmanCount; i++) {
        const wingman = new EnemyShip(faction);
        wingman.leader = leader;
        wingman.squadId = squadId;
        wingman.state = 'FORMATION';
        
        // Position them off to the side of the leader
        const offsetX = -60;
        const offsetY = (i === 0) ? -50 : 50; // First wingman on one side, second on the other
        wingman.formationOffset = { x: offsetX, y: offsetY };
        
        // Start the wingman near where their formation spot will be
        const cosA = Math.cos(leader.a);
        const sinA = Math.sin(leader.a);
        wingman.x = leader.x + (offsetX * cosA - offsetY * sinA);
        wingman.y = leader.y + (offsetX * sinA + offsetY * cosA);
        
        targetArray.push(wingman);
    }
}
// START: New Function
/**
 * A dedicated spawning logic function for the ENEMY_OVERRIDE mutator.
 * It bypasses all normal spawning rules.
 * @param {object} state - The game state object.
 * @param {number} deltaTime - The time since the last frame.
 */
function handleEnemyOverrideSpawning(state, deltaTime) {
    state.enemySpawnTimer -= deltaTime;
    if (state.enemySpawnTimer <= 0) {
        const EnemyClass = state.mutators.enemyOverrideClass;
        
        // Don't spawn too many capital ships at once.
        const capitalShipCount = state.enemies.filter(e => e.isBoss).length;
        if (EnemyClass === Cruiser && capitalShipCount >= 1) return;
        if (EnemyClass === Corvette && capitalShipCount >= 2) return;

        const newEnemy = new EnemyClass('enemy');
        state.enemies.push(newEnemy);

        // Set a longer cooldown for more powerful enemies.
        let cooldown = 10000;
        switch (EnemyClass.name) {
            case 'Cruiser':   cooldown = 25000; break;
            case 'Corvette':  cooldown = 18000; break;
            case 'Ace':       cooldown = 9000;  break;
            case 'Minelayer': cooldown = 12000; break;
            case 'EnemyShip': cooldown = 5000;  break;
        }
        state.enemySpawnTimer = cooldown / state.levelScale;
    }
}
// END: New Function

/**
 * Checks game conditions and spawns entities accordingly.
 * This function now handles both enemy and allied ship spawning.
 * @param {object} state - The game state object.
 * @param {number} deltaTime - The time since the last frame.
 */
export function updateSpawning(state, deltaTime) {
    // In arcade or daily mode, only spawn enemies.
    if (state.gameType !== 'campaign') {
        updateArcadeSpawning(state, deltaTime);
        return;
    }

    // In campaign mode, spawn both enemies and allies.
    // Note: Battle missions might override this with their own logic.
    updateCampaignSpawning(state, deltaTime);
}

/**
 * Spawning logic for Arcade mode (enemies only).
 */
function updateArcadeSpawning(state, deltaTime) {
      if (state.mutators?.enemyOverrideClass) {
        handleEnemyOverrideSpawning(state, deltaTime);
        return; // IMPORTANT: This bypasses all normal logic
    }
	const settings = DIFFICULTY_SETTINGS[state.currentDifficulty];
    const levelScale = state.levelScale;
    
    // Base spawning on the combined score of all players.
    const currentScore = state.players.reduce((sum, p) => sum + p.score, 0);

    // Capital ships pause other major spawns.
    const isCapitalShipActive = state.enemies.some(e => e.isBoss);
    if (isCapitalShipActive) {
        return;
    }
    
    // --- ACE SPAWNING ---
    const scaledAceInterval = settings.aceSpawnInterval ? settings.aceSpawnInterval / levelScale : null;
    if (scaledAceInterval && state.level >= ACE_SPAWN_LEVEL && currentScore > state.lastAceSpawnScore + scaledAceInterval) {
        state.enemies.push(new Ace('enemy'));
        state.lastAceSpawnScore = currentScore;
    }
    
    // --- OTHER CAPITAL & BASIC SHIP SPAWNING ---
    const scaledCruiserInterval = settings.cruiserSpawnInterval ? settings.cruiserSpawnInterval / levelScale : null;
    const scaledCorvetteInterval = settings.corvetteSpawnInterval / levelScale;
    const scaledMinelayerInterval = settings.minelayerSpawnInterval ? settings.minelayerSpawnInterval / levelScale : null;

    if (scaledCruiserInterval && currentScore > state.lastCruiserSpawnScore + scaledCruiserInterval) {
        state.enemies.push(new Cruiser('enemy'));
        state.lastCruiserSpawnScore = currentScore;
        state.lastCorvetteSpawnScore = currentScore;
        state.lastMinelayerSpawnScore = currentScore;
    }
    else if (scaledMinelayerInterval && currentScore > state.lastMinelayerSpawnScore + scaledMinelayerInterval) {
        state.enemies.push(new Minelayer('enemy'));
        state.lastMinelayerSpawnScore = currentScore;
    }
    else if (scaledCorvetteInterval && currentScore > state.lastCorvetteSpawnScore + scaledCorvetteInterval) {
        state.enemies.push(new Corvette('enemy'));
        state.lastCorvetteSpawnScore = currentScore;
    }
    else {
        state.enemySpawnTimer -= deltaTime;
        if (state.enemySpawnTimer <= 0) {
            if (Math.random() < 0.4) {
                spawnSquadron('enemy');
            } else {
                state.enemies.push(new EnemyShip('enemy'));
            }
            state.enemySpawnTimer = (settings.enemySpawnTimeInterval + Math.random() * 10000) / levelScale;
        }
    }
}

/**
 * Spawning logic for Campaign mode (enemies and allies).
 * This is simpler and runs on timers, not score.
 */
function updateCampaignSpawning(state, deltaTime) {
    // A simple timer-based approach for continuous reinforcement feel.
    state.enemySpawnTimer -= deltaTime;
	if (state.mutators?.enemyOverrideClass) {
        handleEnemyOverrideSpawning(state, deltaTime); // Note: this will only spawn enemies, not allies.
        return; // IMPORTANT: This bypasses all normal logic
    }
    if (state.enemySpawnTimer <= 0) {
        // Spawn an enemy group
        if (state.enemies.length < 8) { // Cap enemies to prevent overwhelming the player
            if (Math.random() < 0.3) {
                spawnSquadron('enemy');
            } else {
                state.enemies.push(new EnemyShip('enemy'));
            }
        }
        
        // Have a chance to spawn an allied group as well
        if (state.allies.length < 4 && Math.random() < 0.25) { // Allies are rarer and capped lower
             if (Math.random() < 0.5) {
                spawnSquadron('ally');
            } else {
                state.allies.push(new EnemyShip('ally'));
            }
        }

        // Reset timer
        const settings = DIFFICULTY_SETTINGS[state.currentDifficulty];
        const levelScale = state.levelScale;
        state.enemySpawnTimer = (settings.enemySpawnTimeInterval * 0.8 + Math.random() * 8000) / levelScale;
    }
}