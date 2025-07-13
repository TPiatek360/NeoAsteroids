// src/audio/audio.js
// Manages all Web Audio API logic for sound effects and music.

import { updateMusicVolumeUI, updateSfxVolumeUI } from '../ui/ui.js';
import { gameState } from '../state.js';
import assetManager from '../systems/AssetManager.js'; // <<< ADD THIS IMPORT

let audioContext;
let _isAudioInitialized = false;
let activeThrustSound = null;
let noiseBuffer = null;
let activeChargeSound = null;

// --- Music & Volume Variables ---
let musicElement;
let isMusicInitialized = false;
let musicFadeInterval = null;
let currentGameTrackIndex = -1;
// <<< REMOVE THE OLD CONSTANTS
const GAME_TRACK_KEYS = [
    'gameMusic1', 'gameMusic2', 'gameMusic3', 'gameMusic4', 'gameMusic5', 'gameMusic6'
];

gameState.musicVolume = 0.4;
gameState.sfxVolume = 1.0;

export async function initAudio() { if (_isAudioInitialized) return; if (!audioContext) { audioContext = new (window.AudioContext || window.webkitAudioContext)(); if (!audioContext) { console.error("Web Audio API not supported."); _isAudioInitialized = true; return; } } if (audioContext.state === 'suspended') { try { await audioContext.resume(); } catch (e) { console.error("Failed to resume AudioContext:", e); _isAudioInitialized = true; return; } } const bufferSize = audioContext.sampleRate * 1.0; noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate); const output = noiseBuffer.getChannelData(0); for (let i = 0; i < bufferSize; i++) output[i] = (Math.random() * 2 - 1) * 0.7; initMusic(); _isAudioInitialized = true; console.log("Audio system (Web Audio API) initialized successfully."); }
// ... (all the playSoundGeneric, playShootSound, etc. functions remain unchanged) ...
export function playSoundGeneric(type, freqStart, freqEnd, duration, vol, attack = 0.01, decay = 0.1, pan = 0) { if (!_isAudioInitialized || !audioContext) return null; const now = audioContext.currentTime; const osc = audioContext.createOscillator(); const gain = audioContext.createGain(); const panner = audioContext.createStereoPanner(); panner.pan.setValueAtTime(pan, now); osc.type = type; osc.frequency.setValueAtTime(freqStart, now); if (freqEnd !== freqStart) { osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration * 0.8); } gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(vol * gameState.sfxVolume, now + attack); gain.gain.exponentialRampToValueAtTime(0.001, now + duration); osc.connect(gain).connect(panner).connect(audioContext.destination); osc.start(now); osc.stop(now + duration); return { osc, gain }; }
export function playShootSound() { playSoundGeneric('triangle', 1000, 200, 0.15, 0.25); }
export function playMissileLaunchSound(pan = 0) { playSoundGeneric('sawtooth', 150, 400, 0.5, 0.35, 0.05, 0.4, pan); }
export function playBombDropSound() { playSoundGeneric('square', 300, 150, 0.3, 0.4); }
export function playRocketLaunchSound() { playSoundGeneric('sawtooth', 200, 50, 0.6, 0.4); }
export function playMissilePickupSound() { playSoundGeneric('sine', 400, 800, 0.3, 0.3, 0.02, 0.25); }
export function playChargeLevelUpSound() { playSoundGeneric('square', 600, 900, 0.1, 0.25, 0.01, 0.08); }
export function playEnemyShootSound() { playSoundGeneric('square', 400, 100, 0.2, 0.25); }
export function playWarpInSound() { playSoundGeneric('sawtooth', 50, 1000, 1.0, 0.4, 0.01, 0.5); }
export function playPowerupPickupSound() { playSoundGeneric('sine', 800, 1200, 0.2, 0.4, 0.01, 0.1); }
export function playShieldUpSound() { playSoundGeneric('sine', 300, 500, 0.1, 0.2); }
export function playShieldDownSound() { playSoundGeneric('sine', 500, 300, 0.1, 0.2); }
export function playMenuSelectSound() { playSoundGeneric('sine', 1200, 1200, 0.05, 0.2, 0.001, 0.04); }
export function playShieldHitSound() { playSoundGeneric('triangle', 600, 800, 0.1, 0.3, 0.005, 0.08); }
export function startChargeSound() { if (!_isAudioInitialized || !audioContext || activeChargeSound) return; const now = audioContext.currentTime; const osc = audioContext.createOscillator(); const gain = audioContext.createGain(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, now); gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.15 * gameState.sfxVolume, now + 0.1); osc.connect(gain).connect(audioContext.destination); osc.start(now); activeChargeSound = { osc, gain, startTime: now }; }
export function updateChargeSoundPitch(chargeProgressRatio, chargeLevel) { if (activeChargeSound) { const now = audioContext.currentTime; const baseFreq = 100 + (chargeLevel * 150); const maxFreq = baseFreq + 200; const currentFreq = baseFreq + (maxFreq - baseFreq) * chargeProgressRatio; activeChargeSound.osc.frequency.linearRampToValueAtTime(currentFreq, now + 0.05); } }
export function stopChargeSound() { if (activeChargeSound) { const now = audioContext.currentTime; activeChargeSound.gain.gain.setValueAtTime(activeChargeSound.gain.gain.value, now); activeChargeSound.gain.gain.linearRampToValueAtTime(0, now + 0.1); activeChargeSound.osc.stop(now + 0.1); activeChargeSound = null; } }
export function startThrustSound() { if (!_isAudioInitialized || !audioContext || activeThrustSound || !noiseBuffer) return; const now = audioContext.currentTime; const noiseSource = audioContext.createBufferSource(); noiseSource.buffer = noiseBuffer; noiseSource.loop = true; const noiseGain = audioContext.createGain(); noiseGain.gain.setValueAtTime(0, now); noiseGain.gain.linearRampToValueAtTime(0.15 * gameState.sfxVolume, now + 0.1); noiseSource.connect(noiseGain).connect(audioContext.destination); noiseSource.start(now); const rumbleOscillator = audioContext.createOscillator(); rumbleOscillator.type = 'sine'; rumbleOscillator.frequency.setValueAtTime(45, now); const rumbleGain = audioContext.createGain(); rumbleGain.gain.setValueAtTime(0, now); rumbleGain.gain.linearRampToValueAtTime(0.07 * gameState.sfxVolume, now + 0.15); rumbleOscillator.connect(rumbleGain).connect(audioContext.destination); rumbleOscillator.start(now); activeThrustSound = { noiseSource, noiseGain, rumbleOscillator, rumbleGain }; }
export function stopThrustSound() { if (!_isAudioInitialized || !audioContext || !activeThrustSound) return; const now = audioContext.currentTime; const { noiseSource, noiseGain, rumbleOscillator, rumbleGain } = activeThrustSound; noiseGain.gain.setValueAtTime(noiseGain.gain.value, now); noiseGain.gain.linearRampToValueAtTime(0, now + 0.15); noiseSource.stop(now + 0.15); rumbleGain.gain.setValueAtTime(rumbleGain.gain.value, now); rumbleGain.gain.linearRampToValueAtTime(0, now + 0.2); rumbleOscillator.stop(now + 0.2); activeThrustSound = null; }
export function playExplosionSound(volume = 0.5, duration = 0.4, filterStart = 2000, filterEnd = 100) { if (!_isAudioInitialized || !audioContext || !noiseBuffer) return; const now = audioContext.currentTime; const noiseSource = audioContext.createBufferSource(); noiseSource.buffer = noiseBuffer; const gainNode = audioContext.createGain(); gainNode.gain.setValueAtTime(volume * gameState.sfxVolume, now); gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration); const filter = audioContext.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.setValueAtTime(filterStart, now); filter.frequency.exponentialRampToValueAtTime(filterEnd, now + duration * 0.75); filter.Q.setValueAtTime(1, now); noiseSource.connect(filter).connect(gainNode).connect(audioContext.destination); noiseSource.start(now); setTimeout(() => { try { noiseSource.stop(); } catch (e) { } }, duration * 1000 + 50); }
export function playDeathSound() { if (!_isAudioInitialized || !audioContext || !noiseBuffer) return; playExplosionSound(0.4, 0.6, 1500, 80); playSoundGeneric('sine', 500, 80, 0.8, 0.3); }

// --- Music Functions ---
// <<< REPLACE initMusic >>>
export function initMusic() {
    if (isMusicInitialized) return;
    // We now just grab the first music track to use as our "musicElement"
    musicElement = assetManager.getAsset('menuMusic'); 
    musicElement.addEventListener('ended', () => {
        if (!musicElement.loop) {
            playNextGameTrack(false);
        }
    });
    isMusicInitialized = true;
}

function fadeAudio(targetVolume, duration = 2000, onComplete = null) { if (!musicElement) return; clearInterval(musicFadeInterval); const startVolume = musicElement.volume; const stepTime = 50; const steps = duration / stepTime; let currentStep = 0; const volumeStep = (targetVolume - startVolume) / steps; musicFadeInterval = setInterval(() => { currentStep++; if (currentStep >= steps) { clearInterval(musicFadeInterval); musicElement.volume = targetVolume; if (targetVolume === 0) musicElement.pause(); if (onComplete) onComplete(); return; } musicElement.volume += volumeStep; }, stepTime); }

// <<< REPLACE switchTrack >>>
function switchTrack(assetKey, loop) {
    fadeAudio(0, 1500, () => {
        // Stop the current track
        if (musicElement) {
            musicElement.pause();
            musicElement.currentTime = 0;
        }

        // Get the new, pre-loaded track from the asset manager
        musicElement = assetManager.getAsset(assetKey);
        musicElement.loop = loop;
        musicElement.play().catch(e => console.error("Music playback failed:", e));

        fadeAudio(gameState.musicVolume);
    });
}

// <<< REPLACE startMenuMusic >>>
export function startMenuMusic() {
    if (!isMusicInitialized) initMusic();
    if (musicElement === assetManager.getAsset('menuMusic') && !musicElement.paused) return;
    switchTrack('menuMusic', true);
}

// <<< REPLACE startGameMusic >>>
export function startGameMusic() {
    if (!isMusicInitialized) initMusic();
    playNextGameTrack(true);
}

// <<< REPLACE playNextGameTrack >>>
export function playNextGameTrack(isCrossfade = true) {
    if (!isMusicInitialized) initMusic();
    
    let newIndex;
    do {
        newIndex = Math.floor(Math.random() * GAME_TRACK_KEYS.length);
    } while (GAME_TRACK_KEYS.length > 1 && newIndex === currentGameTrackIndex);
    
    currentGameTrackIndex = newIndex;
    const nextTrackKey = GAME_TRACK_KEYS[currentGameTrackIndex];

    if (isCrossfade) {
        switchTrack(nextTrackKey, false);
    } else {
        musicElement = assetManager.getAsset(nextTrackKey);
        musicElement.loop = false;
        musicElement.play().catch(e => console.error("Music playback failed:", e));
    }
}

// --- Volume Control Functions ---
export function setMusicVolume(vol) { gameState.musicVolume = Math.max(0, Math.min(1, vol)); if (musicElement && !musicFadeInterval) { musicElement.volume = gameState.musicVolume; } localStorage.setItem('musicVolume', gameState.musicVolume); updateMusicVolumeUI(gameState.musicVolume); }
export function setSfxVolume(vol) { gameState.sfxVolume = Math.max(0, Math.min(1, vol)); localStorage.setItem('sfxVolume', gameState.sfxVolume); updateSfxVolumeUI(gameState.sfxVolume); }
export function getAudioContext() { return audioContext; }
export function isAudioInitialized() { return _isAudioInitialized; }
export function isThrustSoundActive() { return activeThrustSound !== null; }