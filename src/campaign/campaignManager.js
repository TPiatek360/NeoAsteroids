// src/campaign/campaignManager.js
// Handles saving, loading, and managing campaign run slots in localStorage.

import { createNewCampaignState } from './campaignState.js';

const CAMPAIGN_KEY_PREFIX = 'neonAsteroidsCampaign_';
const CURRENT_SAVE_VERSION = "1.0"; // Define the current save version

export function loadCampaign(slotNum) {
    const key = CAMPAIGN_KEY_PREFIX + slotNum;
    const json = localStorage.getItem(key);
    if (!json) return null;

    try {
        const data = JSON.parse(json);

        // VERSION CHECK:
        // If the save doesn't have a version or the version doesn't match, it's invalid.
        if (!data.version || data.version !== CURRENT_SAVE_VERSION) {
            console.warn(`Campaign slot ${slotNum} is an outdated version. It will not be loaded.`);
            return null; // Treat outdated save as no save
        }

        return data; // Return the valid, version-matched save data
    } catch (e) {
        console.error(`Error parsing campaign data for slot ${slotNum}:`, e);
        // If parsing fails, it's definitely invalid. Clean it up.
        localStorage.removeItem(key);
        return null;
    }
}

export function saveCampaign(slotNum, campaignData) {
    const key = CAMPAIGN_KEY_PREFIX + slotNum;
    campaignData.lastSaved = new Date().toISOString();
    // Ensure the version is always current when saving
    campaignData.version = CURRENT_SAVE_VERSION;
    localStorage.setItem(key, JSON.stringify(campaignData));
    console.log(`Campaign for slot ${slotNum} saved.`);
}

export function deleteCampaign(slotNum) {
    const key = CAMPAIGN_KEY_PREFIX + slotNum;
    localStorage.removeItem(key);
    console.log(`Campaign for slot ${slotNum} deleted.`);
}

export function getCampaignSummaries() {
    const summaries = [];
    for (let i = 1; i <= 3; i++) {
        // IMPORTANT: Use our new robust loadCampaign function here
        const campaignData = loadCampaign(i);
        if (campaignData) {
            summaries.push({
                slot: i,
                level: campaignData.currentLevel,
                playerCount: campaignData.playerCount,
            });
        } else {
            summaries.push(null);
        }
    }
    return summaries;
}

// MODIFIED: Now accepts difficulty
export function startNewCampaign(slotNum, playerCount, difficulty) {
    const newCampaign = createNewCampaignState(playerCount, difficulty);
    saveCampaign(slotNum, newCampaign);
    return newCampaign;
}