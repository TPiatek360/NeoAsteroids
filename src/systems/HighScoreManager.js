// src/systems/HighScoreManager.js
// Manages all high score logic, including saving and retrieving from localStorage.

import { gameState } from '../state.js';
import { DIFFICULTY_SETTINGS } from '../constants.js';

function getHighScoreKey() {
    const difficulty = gameState.currentDifficulty;
    if (gameState.gameMode === 'singlePlayer') {
        return `neonScores_${difficulty}_single`;
    }
    if (gameState.gameMode === 'twoPlayer') {
        if (gameState.twoPlayerMode === 'coop') {
            return `neonScores_${difficulty}_coop`;
        }
    }
    // 'vs' mode does not have a high score list
    return null;
}

export function getHighScores() {
    const key = getHighScoreKey();
    if (!key) return [];

    const scoresJSON = localStorage.getItem(key);
    if (!scoresJSON) return [];
    try {
        const scores = JSON.parse(scoresJSON);
        // Ensure it's always sorted
        return scores.sort((a, b) => b.score - a.score);
    } catch (e) {
        console.error("Could not parse high scores:", e);
        return [];
    }
}

export function saveHighScores(scores) {
    const key = getHighScoreKey();
    if (key) {
        localStorage.setItem(key, JSON.stringify(scores));
    }
}

export function checkIfHighScore(score) {
    const key = getHighScoreKey();
    // No score, or no high score list for this mode (e.g., 'vs')
    if (score === 0 || !key) return false;

    const highScores = getHighScores();
    return highScores.length < 10 || score > highScores[highScores.length - 1].score;
}

export function addHighScore(initials, score) {
    const key = getHighScoreKey();
    if (!key) return; // Don't save if there's no category

    let highScores = getHighScores();
    highScores.push({ initials, score });
    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, 10);
    saveHighScores(highScores);
}