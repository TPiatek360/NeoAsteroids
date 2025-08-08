// src/campaign/campaignState.js
// Defines the default structure for a new campaign/run save file.

export function createNewCampaignState(playerCount = 1, difficulty = 'normal') {
    const players = [];
    for (let i = 0; i < playerCount; i++) {
        players.push({
            playerNum: i + 1,
            currency: 0, // This is now a standard part of the save
            baseLives: 3,
            baseMissiles: 3,
            upgrades: {}
        });
    }

    return {
        version: "1.0", // NEW: Version number for the save structure
        lastSaved: new Date().toISOString(),
        currentLevel: 1,
        playerCount: playerCount,
        difficulty: difficulty,
        players: players,
    };
}