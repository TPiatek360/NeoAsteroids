// src/systems/DevConsole.js
// Handles parsing and execution of developer commands.

import { gameState } from '../state.js';
import { Asteroid } from '../entities/environment.js';
import { EnemyShip, Corvette, Cruiser, Minelayer, Ace } from '../entities/enemies.js';
import { canvas } from '../ui/ui.js';
import { degToRad } from '../utils.js';
import { MUTATORS } from '../mutators/index.js'; // IMPORT the master list of mutators

// A map of spawnable entities, linking string names to class constructors.
const SPAWNABLE_ENTITIES = {
    'asteroid': Asteroid,
    'enemyship': EnemyShip, // Use a consistent name for the base ship
    'corvette': Corvette,
    'cruiser': Cruiser,
    'minelayer': Minelayer,
    'ace': Ace,
};

// --- Command Definitions ---

const COMMANDS = {
    help: () => {
        const commandList = [
            'Available Commands:',
            '  god - Toggles invincibility for all players.',
            '  clear <target> - Clears entities (all, enemies, allies, asteroids, projectiles).',
            '  level <number> - Sets the current game level.',
            '  help - Displays this list.',
            '',
            'Spawn Command:',
            '  spawn <type> [count] [options...]',
            '    <type>: ' + Object.keys(SPAWNABLE_ENTITIES).join(', '),
            '    [count]: Number to spawn (default: 1)',
            '    [options]: Key-value pairs:',
            '      faction=ally|enemy (default: enemy)',
            '      pos=x%,y% (e.g., pos=50,50 for center)',
            '      heading=degrees (e.g., heading=90 for down)',
            '      vel=speed (e.g., vel=5)',
            '    Example: spawn ace 2 faction=ally pos=50,90 vel=3',
            '',
            'Mutator Command:',
            '  mutator <sub-command> [MUTATOR_KEY]',
            '    <sub-command>: list, activate, deactivate, clear'
        ];
        return commandList.join('\n');
    },

    god: () => {
        let isNowInvincible = !gameState.players[0]?.isInvincible;
        gameState.players.forEach(p => p.isInvincible = isNowInvincible);
        const status = isNowInvincible ? 'ENABLED' : 'DISABLED';
        return `God mode ${status}.`;
    },

    clear: (args) => {
        const target = args[0] || 'all';
        if (target === 'projectiles' || target === 'all') {
            gameState.bullets = [];
            gameState.enemyBullets = [];
            gameState.missiles = [];
            gameState.enemyMissiles = [];
            gameState.enemyRockets = [];
            gameState.bombs = [];
            gameState.mines = [];
        }
        if (target === 'enemies' || target === 'all') {
            gameState.enemies = [];
        }
        if (target === 'allies' || target === 'all') {
            gameState.allies = [];
        }
        if (target === 'asteroids' || target === 'all') {
            gameState.asteroids = [];
        }
        return `Cleared ${target}.`;
    },

    spawn: (args) => {
        const type = args[0]?.toLowerCase();
        if (!type) return "Error: No entity type specified. Type 'help' for options.";

        const EntityClass = SPAWNABLE_ENTITIES[type];
        if (!EntityClass) {
            return `Error: Unknown entity type '${type}'. Type 'help' for options.`;
        }
        
        // --- Argument Parsing ---
        let count = 1;
        const options = {
            faction: 'enemy', // Default to enemy
            pos: null,
            heading: null,
            vel: null
        };

        // First argument after type can be a number for count.
        if (args.length > 1 && !isNaN(parseInt(args[1], 10)) && !args[1].includes('=')) {
            count = parseInt(args[1], 10);
            args = args.slice(1); // Consume the count argument
        }

        // Parse remaining key=value options
        args.slice(1).forEach(arg => {
            const parts = arg.split('=');
            if (parts.length !== 2) return;
            const key = parts[0].toLowerCase();
            const value = parts[1];

            switch (key) {
                case 'faction':
                    if (value.toLowerCase() === 'ally') {
                        options.faction = 'ally';
                    }
                    break;
                case 'pos':
                    const coords = value.split(',');
                    if (coords.length === 2) {
                        options.pos = { x: parseFloat(coords[0]), y: parseFloat(coords[1]) };
                    }
                    break;
                case 'heading':
                    options.heading = parseFloat(value);
                    break;
                case 'vel':
                    options.vel = parseFloat(value);
                    break;
            }
        });

        // --- Entity Creation Loop ---
        for (let i = 0; i < count; i++) {
            let entity;

            // Asteroids don't have factions, so they have a different constructor.
            if (type === 'asteroid') {
                entity = new EntityClass();
            } else {
                entity = new EntityClass(options.faction);
            }

            // Apply custom position if specified
            if (options.pos && options.pos.x !== null && options.pos.y !== null) {
                entity.x = canvas.width * (options.pos.x / 100);
                entity.y = canvas.height * (options.pos.y / 100);
            }

            // Apply custom heading if specified
            if (options.heading !== null) {
                entity.a = degToRad(options.heading);
            }

            // Apply custom velocity if specified
            if (options.vel !== null) {
                const angle = entity.a; // Use the (potentially modified) heading
                if (entity.thrust) { // For ships with thrust objects
                    entity.thrust.x = options.vel * Math.cos(angle);
                    entity.thrust.y = options.vel * Math.sin(angle);
                } else if (entity.xv !== undefined) { // For entities with direct velocity
                    entity.xv = options.vel * Math.cos(angle);
                    entity.yv = options.vel * Math.sin(angle);
                }
            }
            
            // Add the entity to the correct game state array
            if (type === 'asteroid') {
                gameState.asteroids.push(entity);
            } else if (entity.faction === 'ally') {
                gameState.allies.push(entity);
            } else {
                gameState.enemies.push(entity);
            }
        }

        return `Spawned ${count} ${options.faction} ${type}(s).`;
    },

    mutator: (args) => {
        const subCommand = args[0]?.toLowerCase();
        const mutatorKey = args[1]?.toUpperCase();

        if (!gameState.mutators.active) {
            gameState.mutators.active = [];
        }

        switch (subCommand) {
            case 'list': {
                let available = 'Available Mutators:\n  ' + Object.keys(MUTATORS).join('\n  ');
                let active = 'Active Mutators:\n  ' + (gameState.mutators.active.map(m => m.key).join('\n  ') || 'None');
                return available + '\n\n' + active;
            }

            case 'activate': {
                if (!mutatorKey) return "Usage: mutator activate <MUTATOR_KEY>";
                if (!MUTATORS[mutatorKey]) return `Error: Mutator '${mutatorKey}' not found.`;
                if (gameState.mutators.active.some(m => m.key === mutatorKey)) return `Warning: Mutator '${mutatorKey}' is already active.`;

                const mutator = MUTATORS[mutatorKey];
                mutator.run(gameState);
                gameState.mutators.active.push(mutator);
                return `Activated mutator: ${mutatorKey}`;
            }

            case 'deactivate': {
                if (!mutatorKey) return "Usage: mutator deactivate <MUTATOR_KEY>";
                const mutatorIndex = gameState.mutators.active.findIndex(m => m.key === mutatorKey);
                if (mutatorIndex === -1) return `Error: Mutator '${mutatorKey}' is not active.`;

                const mutator = gameState.mutators.active[mutatorIndex];
                if (mutator.deactivate) {
                    mutator.deactivate(gameState);
                }
                gameState.mutators.active.splice(mutatorIndex, 1);
                return `Deactivated mutator: ${mutatorKey}. Note: Some effects may require a game restart to fully clear.`;
            }

            case 'clear': {
                // Deactivate in reverse order
                for (let i = gameState.mutators.active.length - 1; i >= 0; i--) {
                    const mutator = gameState.mutators.active[i];
                    if (mutator.deactivate) {
                        mutator.deactivate(gameState);
                    }
                }
                gameState.mutators.active = [];
                return "All active mutators cleared. Note: Some effects may require a game restart to fully clear.";
            }

            default:
                return "Unknown mutator command. Use: list, activate, deactivate, clear";
        }
    }
};

/**
 * Parses a raw input string from the dev console and executes the corresponding command.
 * @param {string} inputString The raw string from the console input.
 * @returns {string} A message to display indicating the result of the command.
 */
export function executeCommand(inputString) {
    if (!inputString) return '';

    const parts = inputString.trim().split(' ');
    const commandName = parts[0].toLowerCase();
    const args = parts.slice(1);

    const commandFunc = COMMANDS[commandName];
    if (commandFunc) {
        try {
            return commandFunc(args);
        } catch (e) {
            console.error(`Error executing command: ${commandName}`, e);
            return `Error: ${e.message}`;
        }
    } else {
        return `Error: Unknown command '${commandName}'. Type 'help' for a list.`;
    }
}