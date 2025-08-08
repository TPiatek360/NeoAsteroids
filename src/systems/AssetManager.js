// src/systems/AssetManager.js

class AssetManager {
    constructor() {
        this.assets = {}; // This will store our loaded assets (e.g., Audio objects)
        this.promises = []; // An array to keep track of all loading promises
    }

    /**
     * A generic loader that returns a Promise which resolves when the asset is loaded.
     * @param {string} key - A unique name to store the asset under (e.g., 'menuMusic').
     * @param {string} path - The path to the asset file.
     * @param {function} loaderFunc - The function to use for loading (e.g., this.loadAudio).
     */
    addAsset(key, path, loaderFunc) {
        const promise = loaderFunc.call(this, path).then(asset => {
            this.assets[key] = asset;
            console.log(`Loaded asset: ${key}`);
        });
        this.promises.push(promise);
    }

    /**
     * Loads an audio file robustly, handling cached files.
     * @param {string} path - The path to the audio file.
     * @returns {Promise<HTMLAudioElement>} - A promise that resolves with the loaded Audio element.
     */
    loadAudio(path) {
        return new Promise((resolve, reject) => {
            const audio = new Audio();

            const onCanPlay = () => {
                // Remove listeners to prevent memory leaks
                audio.removeEventListener('canplaythrough', onCanPlay);
                audio.removeEventListener('error', onError);
                resolve(audio);
            };

            const onError = (e) => {
                audio.removeEventListener('canplaythrough', onCanPlay);
                audio.removeEventListener('error', onError);
                reject(new Error(`Failed to load audio: ${path}`), e);
            };

            audio.addEventListener('canplaythrough', onCanPlay, { once: true });
            audio.addEventListener('error', onError, { once: true });

            audio.src = path;
            audio.load(); // Important for some browsers

            // Check if the audio is already loaded from cache.
            // readyState 4 means there's enough data to play the whole file.
            if (audio.readyState >= 4) {
                // Manually trigger the resolution if the event already fired.
                onCanPlay();
            }
        });
    }

    /**
     * Call this to load all registered assets.
     * @returns {Promise<void>} - A promise that resolves when all assets are loaded.
     */
    loadAll() {
        return Promise.all(this.promises);
    }

    /**
     * Retrieves a loaded asset by its key.
     * @param {string} key - The key of the asset to retrieve.
     * @returns {any} - The loaded asset.
     */
    getAsset(key) {
        if (!this.assets[key]) {
            throw new Error(`Asset not found: ${key}`);
        }
        return this.assets[key];
    }
}

// Create a single, global instance of the Asset Manager for our game
const assetManager = new AssetManager();

// --- Define All Game Assets Here ---
// This is now the single source of truth for all external files.

// Music
assetManager.addAsset('menuMusic', 'music/Mesmerizing Galaxy Loop.mp3', assetManager.loadAudio);
assetManager.addAsset('gameMusic1', 'music/Galactic Rap.mp3', assetManager.loadAudio);
assetManager.addAsset('gameMusic2', 'music/Voxel Revolution.mp3', assetManager.loadAudio);
assetManager.addAsset('gameMusic3', 'music/Bleeping Demo.mp3', assetManager.loadAudio);
assetManager.addAsset('gameMusic4', 'music/Deep and Dirty.mp3', assetManager.loadAudio);
assetManager.addAsset('gameMusic5', 'music/Raving Energy.mp3', assetManager.loadAudio);
assetManager.addAsset('gameMusic6', 'music/Raving Energy (faster).mp3', assetManager.loadAudio);

export default assetManager;