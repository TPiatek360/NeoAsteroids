// src/audio/audio.js
// Manages all Web Audio API logic for sound effects and music.

import { gameState } from '../state.js';
import assetManager from '../systems/AssetManager.js';

let audioContext;
let _isAudioInitialized = false;
let activeThrustSound = null;
let noiseBuffer = null;
let activeChargeSound = null;
let sfxGainNode; 

// --- Music & Volume Variables ---
let musicElement;
let isMusicInitialized = false;
let musicFadeInterval = null;
let currentGameTrackIndex = -1;
const GAME_TRACK_KEYS = [
    'gameMusic1', 'gameMusic2', 'gameMusic3', 'gameMusic4', 'gameMusic5', 'gameMusic6'
];

export async function initAudio() {
    if (_isAudioInitialized) return;
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (!audioContext) {
            console.error("Web Audio API not supported.");
            _isAudioInitialized = true;
            return;
        }
    }
    if (audioContext.state === 'suspended') {
        try {
            await audioContext.resume();
        } catch (e) {
            console.error("Failed to resume AudioContext:", e);
            _isAudioInitialized = true;
            return;
        }
    }

    sfxGainNode = audioContext.createGain();
    sfxGainNode.gain.setValueAtTime(gameState.sfxVolume, audioContext.currentTime);
    sfxGainNode.connect(audioContext.destination);

    const bufferSize = audioContext.sampleRate * 1.0;
    noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = (Math.random() * 2 - 1) * 0.7;
    
    initMusic();
    _isAudioInitialized = true;
    console.log("Audio system (Web Audio API) initialized successfully.");
}

export function playSoundGeneric(type, freqStart, freqEnd, duration, vol, attack = 0.01, decay = 0.1, pan = 0) {
    if (!_isAudioInitialized || !audioContext) return null;
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const panner = audioContext.createStereoPanner();
    
    panner.pan.setValueAtTime(pan, now);
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
        osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration * 0.8);
    }
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain).connect(panner).connect(sfxGainNode);
    
    osc.start(now);
    osc.stop(now + duration);
    return { osc, gain };
}

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
export function playShieldZapSound(pan = 0) { if (!_isAudioInitialized || !audioContext) return; playSoundGeneric('sawtooth', 1200, 400, 0.15, 0.3, 0.005, 0.1, pan); playExplosionSound(0.2, 0.1, 3000, 1000); }

export function startChargeSound() {
    if (!_isAudioInitialized || !audioContext || activeChargeSound) return;
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.1);
    osc.connect(gain).connect(sfxGainNode);
    osc.start(now);
    activeChargeSound = { osc, gain, startTime: now };
}

export function updateChargeSoundPitch(chargeProgressRatio, chargeLevel) { if (activeChargeSound) { const now = audioContext.currentTime; const baseFreq = 100 + (chargeLevel * 150); const maxFreq = baseFreq + 200; const currentFreq = baseFreq + (maxFreq - baseFreq) * chargeProgressRatio; activeChargeSound.osc.frequency.linearRampToValueAtTime(currentFreq, now + 0.05); } }
export function stopChargeSound() { if (activeChargeSound) { const now = audioContext.currentTime; activeChargeSound.gain.gain.setValueAtTime(activeChargeSound.gain.gain.value, now); activeChargeSound.gain.gain.linearRampToValueAtTime(0, now + 0.1); activeChargeSound.osc.stop(now + 0.1); activeChargeSound = null; } }

export function startThrustSound() {
    if (!_isAudioInitialized || !audioContext || activeThrustSound || !noiseBuffer) return;
    const now = audioContext.currentTime;
    const noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    const noiseGain = audioContext.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.15, now + 0.1);
    noiseSource.connect(noiseGain).connect(sfxGainNode);
    noiseSource.start(now);

    const rumbleOscillator = audioContext.createOscillator();
    rumbleOscillator.type = 'sine';
    rumbleOscillator.frequency.setValueAtTime(45, now);
    const rumbleGain = audioContext.createGain();
    rumbleGain.gain.setValueAtTime(0, now);
    rumbleGain.gain.linearRampToValueAtTime(0.07, now + 0.15);
    rumbleOscillator.connect(rumbleGain).connect(sfxGainNode);
    rumbleOscillator.start(now);
    activeThrustSound = { noiseSource, noiseGain, rumbleOscillator, rumbleGain };
}

export function stopThrustSound() { if (!_isAudioInitialized || !audioContext || !activeThrustSound) return; const now = audioContext.currentTime; const { noiseSource, noiseGain, rumbleOscillator, rumbleGain } = activeThrustSound; noiseGain.gain.setValueAtTime(noiseGain.gain.value, now); noiseGain.gain.linearRampToValueAtTime(0, now + 0.15); noiseSource.stop(now + 0.15); rumbleGain.gain.setValueAtTime(rumbleGain.gain.value, now); rumbleGain.gain.linearRampToValueAtTime(0, now + 0.2); rumbleOscillator.stop(now + 0.2); activeThrustSound = null; }

export function playExplosionSound(volume = 0.5, duration = 0.4, filterStart = 2000, filterEnd = 100) {
    if (!_isAudioInitialized || !audioContext || !noiseBuffer) return;
    const now = audioContext.currentTime;
    const noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
    const filter = audioContext.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(filterStart, now);
    filter.frequency.exponentialRampToValueAtTime(filterEnd, now + duration * 0.75);
    filter.Q.setValueAtTime(1, now);
    noiseSource.connect(filter).connect(gainNode).connect(sfxGainNode);
    noiseSource.start(now);
    setTimeout(() => { try { noiseSource.stop(); } catch (e) { } }, duration * 1000 + 50);
}

export function playDeathSound() { if (!_isAudioInitialized || !audioContext || !noiseBuffer) return; playExplosionSound(0.4, 0.6, 1500, 80); playSoundGeneric('sine', 500, 80, 0.8, 0.3); }

// --- Music Functions ---
export function initMusic() { if (isMusicInitialized) return; musicElement = assetManager.getAsset('menuMusic'); musicElement.addEventListener('ended', () => { if (!musicElement.loop) { playNextGameTrack(false); } }); isMusicInitialized = true; }
function fadeAudio(targetVolume, duration = 2000, onComplete = null) { if (!musicElement) return; clearInterval(musicFadeInterval); const startVolume = musicElement.volume; const stepTime = 50; const steps = duration / stepTime; let currentStep = 0; const volumeStep = (targetVolume - startVolume) / steps; musicFadeInterval = setInterval(() => { currentStep++; if (currentStep >= steps) { clearInterval(musicFadeInterval); musicFadeInterval = null; musicElement.volume = targetVolume; if (targetVolume === 0) musicElement.pause(); if (onComplete) onComplete(); return; } musicElement.volume += volumeStep; }, stepTime); }
function switchTrack(assetKey, loop) { fadeAudio(0, 1500, () => { if (musicElement) { musicElement.pause(); musicElement.currentTime = 0; } musicElement = assetManager.getAsset(assetKey); musicElement.loop = loop; musicElement.play().catch(e => console.error("Music playback failed:", e)); fadeAudio(gameState.musicVolume); }); }
export function startMenuMusic() { if (!isMusicInitialized) initMusic(); if (musicElement === assetManager.getAsset('menuMusic') && !musicElement.paused) return; switchTrack('menuMusic', true); }
export function startGameMusic() { if (!isMusicInitialized) initMusic(); playNextGameTrack(true); }
export function playNextGameTrack(isCrossfade = true) { if (!isMusicInitialized) initMusic(); let newIndex; do { newIndex = Math.floor(Math.random() * GAME_TRACK_KEYS.length); } while (GAME_TRACK_KEYS.length > 1 && newIndex === currentGameTrackIndex); currentGameTrackIndex = newIndex; const nextTrackKey = GAME_TRACK_KEYS[currentGameTrackIndex]; if (isCrossfade) { switchTrack(nextTrackKey, false); } else { musicElement = assetManager.getAsset(nextTrackKey); musicElement.loop = false; musicElement.play().catch(e => console.error("Music playback failed:", e)); } }

// --- Volume Control Functions ---
export function setMusicVolume(vol) {
    gameState.musicVolume = Math.max(0, Math.min(1, parseFloat(vol)));

    // FIX: If a fade is happening, cancel it. The user's input takes priority.
    if (musicFadeInterval) {
        clearInterval(musicFadeInterval);
        musicFadeInterval = null;
    }

    if (musicElement) {
        musicElement.volume = gameState.musicVolume;
    }
}

export function setSfxVolume(vol) {
    gameState.sfxVolume = Math.max(0, Math.min(1, parseFloat(vol)));
    if (sfxGainNode) {
        sfxGainNode.gain.setTargetAtTime(gameState.sfxVolume, audioContext.currentTime, 0.01);
    }
}

export function getMusicVolume() { return gameState.musicVolume; }
export function getSfxVolume() { return gameState.sfxVolume; }

export function getAudioContext() { return audioContext; }
export function isAudioInitialized() { return _isAudioInitialized; }
export function isThrustSoundActive() { return activeThrustSound !== null; }