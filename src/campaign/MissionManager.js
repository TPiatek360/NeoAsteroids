// src/campaign/MissionManager.js
// Manages objectives, setup, and win/loss conditions for campaign missions.

import { gameState } from '../state.js';
import { Corvette, Cruiser, EnemyShip, Ace, Minelayer } from '../entities/enemies.js';
import { updateSpawning } from '../systems/SpawnSystem.js';

// Define the types of missions that can be randomly generated.
const MISSION_TYPES = [
    'ClearZone',    // A standard level with asteroids and random spawns.
    'Skirmish',     // Fight a small, pre-defined wave of enemies.
    'Assault',      // Hunt and destroy a specific capital ship.
    'Battle'        // NEW: A large-scale fight between allied and enemy forces.
];

// Data structure for hand-crafted checkpoint missions at specific levels.
const CHECKPOINT_MISSIONS = {
    5: { type: 'CorvetteAssault' },
    10: { type: 'CruiserBoss' },
    // Future checkpoint missions can be added here (e.g., Level 15, 20)
};


class MissionManager {
    constructor() {
        this.currentMission = null;
        this.isComplete = false;
    }

    isMissionActive() {
        return this.currentMission !== null;
    }

    startLevel(level) {
        this.currentMission = null;
        this.isComplete = false;

        const checkpoint = CHECKPOINT_MISSIONS[level];
        if (checkpoint) {
            console.log(`Starting checkpoint mission for Level ${level}: ${checkpoint.type}`);
            this.setupMission(checkpoint.type);
            return;
        }

        // For non-checkpoint levels, pick a random mission type.
        // Let's make the first couple of levels always standard asteroid fields.
        if (level > 2) {
            const missionType = MISSION_TYPES[Math.floor(Math.random() * MISSION_TYPES.length)];
            this.setupMission(missionType);
        } else {
            this.setupMission('ClearZone');
        }
    }

    setupMission(type) {
        console.log(`Setting up mission: ${type}`);
        gameState.enemies = []; // Always clear enemies before a new mission setup.
        gameState.allies = [];  // And allies too.

        switch (type) {
            case 'ClearZone':
                // For a standard level, we let the normal spawn system take over.
                this.currentMission = null;
                break;
            case 'Skirmish':
                this.setupSkirmishMission();
                break;
            case 'Assault':
                this.setupAssaultMission();
                break;
            case 'Battle':
                this.setupBattleMission();
                break;
            case 'CorvetteAssault':
                this.setupCorvetteAssaultMission();
                break;
            case 'CruiserBoss':
                this.setupCruiserBossMission();
                break;
            default:
                console.warn(`Unknown mission type: ${type}`);
                this.currentMission = null;
        }
    }

    setupSkirmishMission() {
        const enemyCount = Math.floor(Math.random() * 3) + 2; // 2 to 4 enemies
        for (let i = 0; i < enemyCount; i++) {
            gameState.enemies.push(new EnemyShip('enemy'));
        }
        this.currentMission = {
            type: 'Skirmish',
            objective: `Destroy the enemy squadron (${enemyCount} hostiles).`,
        };
    }

    setupAssaultMission() {
        // Randomly choose a capital ship to be the target
        const capitalShips = [Corvette, Ace, Minelayer];
        const TargetClass = capitalShips[Math.floor(Math.random() * capitalShips.length)];
        const target = new TargetClass('enemy');
        gameState.enemies.push(target);

        // Add a couple of escorts
        gameState.enemies.push(new EnemyShip('enemy'));
        gameState.enemies.push(new EnemyShip('enemy'));
        
        this.currentMission = {
            type: 'Assault',
            objective: `Destroy the enemy ${TargetClass.name}.`,
            target: target,
        };
    }
    
    setupCorvetteAssaultMission() {
        const target = new Corvette('enemy');
        gameState.enemies.push(target);
        this.currentMission = {
            type: 'Assault',
            objective: 'Destroy the enemy Corvette.',
            target: target,
        };
    }

    setupCruiserBossMission() {
        const target = new Cruiser('enemy');
        gameState.enemies.push(target);
        this.currentMission = {
            type: 'Assault',
            objective: 'Destroy the enemy Cruiser flagship.',
            target: target,
        };
    }

    setupBattleMission() {
        // Spawn a large wave of enemies
        const enemyCount = Math.floor(Math.random() * 4) + 5; // 5-8 enemies
        for (let i = 0; i < enemyCount; i++) {
            gameState.enemies.push(new EnemyShip('enemy'));
        }

        // Spawn a contingent of allies
        const allyCount = Math.floor(Math.random() * 2) + 2; // 2-3 allies
        for (let i = 0; i < allyCount; i++) {
            gameState.allies.push(new EnemyShip('ally'));
        }
        
        this.currentMission = {
            type: 'Battle',
            objective: `Win the battle! (Surviving hostiles: ${gameState.enemies.length})`,
            initialEnemyCount: gameState.enemies.length,
        };
    }

    update() {
        if (!this.isMissionActive() || this.isComplete) {
            return;
        }

        switch (this.currentMission.type) {
            case 'Assault':
                if (this.currentMission.target.isDead) {
                    console.log("Mission Objective Complete: Target Destroyed!");
                    this.isComplete = true;
                }
                break;
            case 'Skirmish':
            case 'Battle':
                // Win condition for both is eliminating all enemies.
                const remainingEnemies = gameState.enemies.filter(e => !e.isDead).length;
                if (this.currentMission.type === 'Battle') {
                    this.currentMission.objective = `Win the battle! (Surviving hostiles: ${remainingEnemies})`;
                }

                if (remainingEnemies === 0) {
                    console.log("Mission Objective Complete: All hostiles eliminated!");
                    this.isComplete = true;
                }
                break;
        }
    }
}

const missionManager = new MissionManager();
export default missionManager;