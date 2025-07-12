// src/systems/DevConsole.js
// A simple in-game developer console for logging and commands.

import { eventBus } from './EventBus.js';
import { gameState } from '../state.js';
import { EnemyShip, Corvette, Cruiser, Minelayer, Ace } from '../entities/enemies.js';
import { Asteroid } from '../entities/environment.js';
import { MAX_LIVES } from '../constants.js';

let consoleEl;
let outputEl;
let inputEl;
let isVisible = false;
let isFocused = false;
let commandHistory = [];
let historyIndex = -1;

function logMessage(message, type = 'info') {
    if (!outputEl) return;

    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    // Use innerHTML to allow for simple formatting if needed later
    logEntry.innerHTML = `[${timestamp}] ${message}`;

    outputEl.appendChild(logEntry);
    outputEl.scrollTop = outputEl.scrollHeight;
}

function gainFocus() {
    isFocused = true;
    eventBus.dispatch('dev_console_focused'); // Main game will listen and pause
}

export function loseFocus() {
    isFocused = false;
    inputEl.blur();
}

// Renamed this function to avoid conflict with the 'isFocused' variable.
export function isDevConsoleFocused() {
    return isFocused;
}

function toggleConsole() {
    isVisible = !isVisible;
    consoleEl.classList.toggle('hidden', !isVisible);

    if (!isVisible && isFocused) {
        loseFocus();
    }
}

function executeCommand(cmdString) {
    if (!cmdString) return;

    logMessage(`> ${cmdString}`, 'system');

    // Add to history
    if (commandHistory[commandHistory.length - 1] !== cmdString) {
        commandHistory.push(cmdString);
    }
    historyIndex = commandHistory.length;

    const args = cmdString.toLowerCase().split(' ');
    const command = args.shift();

    const handler = commandHandlers[command];
    if (handler) {
        handler(args);
    } else {
        logMessage(`Error: Unknown command "${command}". Type 'help' for a list.`, 'death');
    }
}

// --- Command Implementations ---
const commandHandlers = {
    help: () => {
        let helpText = 'Available Commands:<br>';
        helpText += '&nbsp;&nbsp;god - Toggles player invulnerability.<br>';
        helpText += '&nbsp;&nbsp;killall - Destroys all enemies.<br>';
        helpText += '&nbsp;&nbsp;give &lt;item&gt; [amount] - (items: life, missiles)<br>';
        helpText += '&nbsp;&nbsp;spawn &lt;entity&gt; [count] - (entities: asteroid, fighter, corvette, etc.)';
        logMessage(helpText, 'system');
    },

    god: () => {
        const p1 = gameState.players[0];
        if (!p1) return;
        p1.isInvulnerable = !p1.isInvulnerable;
        logMessage(`Player 1 god mode ${p1.isInvulnerable ? 'ENABLED' : 'DISABLED'}.`, 'spawn');
    },

    killall: () => {
        let count = gameState.enemies.length;
        gameState.enemies.forEach(e => e.isDead = true);
        logMessage(`Killed ${count} enemies.`, 'death');
    },

    give: (args) => {
        const p1 = gameState.players[0];
        if (!p1) return;
        const item = args[0];
        const amount = parseInt(args[1] || '1', 10);
        
        switch(item) {
            case 'life':
            case 'lives':
                p1.lives = Math.min(MAX_LIVES, p1.lives + amount);
                logMessage(`Gave ${amount} life/lives. P1 now has ${p1.lives}.`, 'spawn');
                break;
            case 'missile':
            case 'missiles':
                p1.missileCount += amount;
                logMessage(`Gave ${amount} missiles. P1 now has ${p1.missileCount}.`, 'spawn');
                break;
            default:
                logMessage(`Error: Unknown item "${item}". Valid: life, missiles.`, 'death');
        }
    },

    spawn: (args) => {
        const type = args[0];
        const count = parseInt(args[1] || '1', 10);
        if (isNaN(count)) {
            logMessage('Error: Invalid count for spawn command.', 'death');
            return;
        }
        eventBus.dispatch('dev_spawn_entity', { type, count });
        logMessage(`Attempting to spawn ${count} of ${type}.`, 'system');
    }
};

function handleInputKeydown(e) {
    switch (e.key) {
        case 'Enter':
            e.preventDefault();
            executeCommand(inputEl.value);
            inputEl.value = '';
            break;
        case 'ArrowUp':
            e.preventDefault();
            if (historyIndex > 0) {
                historyIndex--;
                inputEl.value = commandHistory[historyIndex];
                inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
            }
            break;
        case 'ArrowDown':
            e.preventDefault();
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++;
                inputEl.value = commandHistory[historyIndex];
            } else {
                historyIndex = commandHistory.length;
                inputEl.value = '';
            }
            break;
    }
}

function setupEventListeners() {
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key.toLowerCase() === 'q') {
            e.preventDefault();
            toggleConsole();
        }
    });

    inputEl.addEventListener('click', gainFocus);
    inputEl.addEventListener('keydown', handleInputKeydown);

    // Logging listeners
    eventBus.on('player_spawned', data => logMessage(`Player ${data.playerNum} spawned.`, 'spawn'));
    eventBus.on('enemy_spawned', data => logMessage(`Enemy spawned: ${data.type}`, 'spawn'));
    eventBus.on('asteroid_spawned', data => logMessage(`Asteroid spawned (r: ${Math.round(data.r)}).`, 'spawn'));
    eventBus.on('pickup_spawned', data => logMessage(`Pickup spawned: ${data.type}`, 'spawn'));
    eventBus.on('player_died', data => logMessage(`Player ${data.playerNum} died. Lives left: ${data.lives}`, 'death'));
    eventBus.on('enemy_destroyed', data => {
        const killer = data.playerId > -1 ? `by Player ${data.playerId + 1}` : 'by environment';
        logMessage(`Enemy destroyed: ${data.enemy.constructor.name} ${killer}.`, 'death');
    });
    eventBus.on('asteroid_destroyed', data => {
        const killer = data.playerId > -1 ? `by Player ${data.playerId + 1}` : 'by environment';
        logMessage(`Asteroid destroyed (r: ${Math.round(data.r)}) ${killer}.`, 'death');
    });
}

export function initDevConsole() {
    consoleEl = document.getElementById('dev-console');
    outputEl = document.getElementById('console-output');
    inputEl = document.getElementById('console-input');

    if (!consoleEl || !outputEl || !inputEl) {
        console.error("Dev Console UI elements not found in HTML!");
        return;
    }
    
    logMessage("Dev console initialized. Press CTRL+Q to toggle.", "system");
    setupEventListeners();
}