// src/audio/audio.js
// Manages all Web Audio API logic for sound effects and music.

import { updateMusicVolumeUI, updateSfxVolumeUI } from '../ui/ui.js';
import { gameState } from '../state.js';

let audioContext;
let audioInitialized = false;
let activeThrustSound = null;
let noiseBuffer = null;
let activeChargeSound = null;

// --- Music & Volume Variables ---
let musicElement;
let isMusicInitialized = false;
let musicFadeInterval = null;
let currentGameTrackIndex = -1;
const MENU_MUSIC_SRC = "music/Mesmerizing Galaxy Loop.mp3";
const GAME_TRACKS = [
    "music/Galactic Rap.mp3", "music/Voxel Revolution.mp3", "music/Bleeping Demo.mp3",
    "music/Deep and Dirty.mp3", "music/Raving Energy.mp3", "music/Raving Energy (faster).mp3"
];

export async function initAudio() {
    if (audioInitialized) return;
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') { await audioContext.resume(); }
        const bufferSize = audioContext.sampleRate * 1.0;
        noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) output[i] = (Math.random() * 2 - 1) * 0.7;
        initMusic();
        console.log("Audio system (Web Audio API) initialized successfully.");
    } catch (e) { console.error("Web Audio API could not be initialized:", e); }
    audioInitialized = true;
}

export function playSoundGeneric(type, freqStart, freqEnd, duration, vol, attack = 0.01, decay = 0.1, pan = 0) {
    if (!audioInitialized || !audioContext) return null;
    const now = audioContext.currentTime; const osc = audioContext.createOscillator();
    const gain = audioContext.createGain(); const panner = audioContext.createStereoPanner();
    panner.pan.setValueAtTime(pan, now); osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) { osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration * 0.8); }
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(vol * gameState.sfxVolume, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain).connect(panner).connect(audioContext.destination);
    osc.start(now); osc.stop(now + duration); return { osc, gain };
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
export function playShieldImpactSound() {
    if (!audioInitialized || !audioContext) return;
    // Zap
    playSoundGeneric('triangle', 600, 800, 0.1, 0.3, 0.005, 0.08);
    // Sizzle
    const now = audioContext.currentTime; const noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer; const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(0, now); gainNode.gain.linearRampToValueAtTime(0.2 * gameState.sfxVolume, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    const filter = audioContext.createBiquadFilter(); filter.type = "bandpass"; filter.frequency.setValueAtTime(4000, now);
    noiseSource.connect(filter).connect(gainNode).connect(audioContext.destination);
    noiseSource.start(now); noiseSource.stop(now + 0.15);
}
export function playShieldBreakSound() {
    if (!audioInitialized || !audioContext) return;
    // Static chirp rising and falling
    playSoundGeneric('sawtooth', 600, 2500, 0.2, 0.35, 0.01, 0.15);
    setTimeout(() => playSoundGeneric('sawtooth', 2500, 400, 0.15, 0.35, 0.01, 0.1), 180);
}
export function startShieldHumSound() {
    if (!audioInitialized || !audioContext) return null;
    const now = audioContext.currentTime;
    // Low hum oscillator
    const humOsc = audioContext.createOscillator(); const humGain = audioContext.createGain();
    humOsc.type = 'sine'; humOsc.frequency.setValueAtTime(80, now);
    humGain.gain.setValueAtTime(0, now); humGain.gain.linearRampToValueAtTime(0.1 * gameState.sfxVolume, now + 0.2);
    humOsc.connect(humGain).connect(audioContext.destination); humOsc.start(now);
    // High sizzle noise
    const sizzleSource = audioContext.createBufferSource(); const sizzleGain = audioContext.createGain();
    const sizzleFilter = audioContext.createBiquadFilter();
    sizzleSource.buffer = noiseBuffer; sizzleSource.loop = true;
    sizzleFilter.type = 'highpass'; sizzleFilter.frequency.setValueAtTime(3000, now);
    sizzleGain.gain.setValueAtTime(0, now); sizzleGain.gain.linearRampToValueAtTime(0.05 * gameState.sfxVolume, now + 0.2);
    sizzleSource.connect(sizzleFilter).connect(sizzleGain).connect(audioContext.destination); sizzleSource.start(now);
    return { humOsc, humGain, sizzleSource, sizzleGain };
}
export function stopShieldHumSound(sound, duration = 0.2) {
    if (!sound) return;
    const now = audioContext.currentTime;
    sound.humGain.gain.cancelScheduledValues(now);
    sound.humGain.gain.setValueAtTime(sound.humGain.gain.value, now);
    sound.humGain.gain.linearRampToValueAtTime(0, now + duration);
    sound.humOsc.stop(now + duration);
    sound.sizzleGain.gain.cancelScheduledValues(now);
    sound.sizzleGain.gain.setValueAtTime(sound.sizzleGain.gain.value, now);
    sound.sizzleGain.gain.linearRampToValueAtTime(0, now + duration);
    sound.sizzleSource.stop(now + duration);
}
export function startChargeSound() {
    if (!audioInitialized || !audioContext || activeChargeSound) return;
    const now = audioContext.currentTime; const osc = audioContext.createOscillator(); const gain = audioContext.createGain();
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, now);
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.15 * gameState.sfxVolume, now + 0.1);
    osc.connect(gain).connect(audioContext.destination); osc.start(now);
    activeChargeSound = { osc, gain, startTime: now };
}
export function updateChargeSoundPitch(chargeProgressRatio, chargeLevel) {
    if (!activeChargeSound) return; const now = audioContext.currentTime;
    const baseFreq = 100 + (chargeLevel * 150); const maxFreq = baseFreq + 200;
    const currentFreq = baseFreq + (maxFreq - baseFreq) * chargeProgressRatio;
    activeChargeSound.osc.frequency.linearRampToValueAtTime(currentFreq, now + 0.05);
}
export function stopChargeSound() {
    if (!activeChargeSound) return; const now = audioContext.currentTime;
    activeChargeSound.gain.gain.setValueAtTime(activeChargeSound.gain.gain.value, now);
    activeChargeSound.gain.gain.linearRampToValueAtTime(0, now + 0.1);
    activeChargeSound.osc.stop(now + 0.1); activeChargeSound = null;
}
export function startThrustSound() {
    if (!audioInitialized || !audioContext || activeThrustSound || !noiseBuffer) return;
    const now = audioContext.currentTime; const noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer; noiseSource.loop = true; const noiseGain = audioContext.createGain();
    noiseGain.gain.setValueAtTime(0, now); noiseGain.gain.linearRampToValueAtTime(0.15 * gameState.sfxVolume, now + 0.1);
    noiseSource.connect(noiseGain).connect(audioContext.destination); noiseSource.start(now);
    const rumbleOscillator = audioContext.createOscillator(); rumbleOscillator.type = 'sine';
    rumbleOscillator.frequency.setValueAtTime(45, now); const rumbleGain = audioContext.createGain();
    rumbleGain.gain.setValueAtTime(0, now); rumbleGain.gain.linearRampToValueAtTime(0.07 * gameState.sfxVolume, now + 0.15);
    rumbleOscillator.connect(rumbleGain).connect(audioContext.destination); rumbleOscillator.start(now);
    activeThrustSound = { noiseSource, noiseGain, rumbleOscillator, rumbleGain };
}
export function stopThrustSound() {
    if (!audioInitialized || !audioContext || !activeThrustSound) return;
    const now = audioContext.currentTime; const { noiseSource, noiseGain, rumbleOscillator, rumbleGain } = activeThrustSound;
    noiseGain.gain.setValueAtTime(noiseGain.gain.value, now); noiseGain.gain.linearRampToValueAtTime(0, now + 0.15);
    noiseSource.stop(now + 0.15); rumbleGain.gain.setValueAtTime(rumbleGain.gain.value, now);
    rumbleGain.gain.linearRampToValueAtTime(0, now + 0.2); rumbleOscillator.stop(now + 0.2);
    activeThrustSound = null;
}
export function playExplosionSound(volume = 0.5, duration = 0.4, filterStart = 2000, filterEnd = 100) {
    if (!audioInitialized || !audioContext || !noiseBuffer) return;
    const now = audioContext.currentTime; const noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer; const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(volume * gameState.sfxVolume, now); gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
    const filter = audioContext.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.setValueAtTime(filterStart, now);
    filter.frequency.exponentialRampToValueAtTime(filterEnd, now + duration * 0.75);
    filter.Q.setValueAtTime(1, now); noiseSource.connect(filter).connect(gainNode).connect(audioContext.destination);
    noiseSource.start(now); setTimeout(() => { try { noiseSource.stop(); } catch (e) { } }, duration * 1000 + 50);
}
export function playDeathSound() { playExplosionSound(0.4, 0.6, 1500, 80); playSoundGeneric('sine', 500, 80, 0.8, 0.3); }

// --- Music Functions ---
export function initMusic() { if (isMusicInitialized || typeof Audio === 'undefined') return; musicElement = new Audio(); musicElement.volume = 0; musicElement.addEventListener('ended', () => { if (!musicElement.loop) { playNextGameTrack(false); } }); isMusicInitialized = true; }
function fadeAudio(targetVolume, duration = 2000, onComplete = null) {
    if (!isMusicInitialized || !musicElement) return; clearInterval(musicFadeInterval);
    const startVolume = musicElement.volume; const stepTime = 50; const steps = duration / stepTime;
    let currentStep = 0; const volumeStep = (targetVolume - startVolume) / steps;
    musicFadeInterval = setInterval(() => {
        currentStep++; if (currentStep >= steps) {
            clearInterval(musicFadeInterval); musicElement.volume = targetVolume;
            if (targetVolume === 0 && musicElement.pause) musicElement.pause();
            if (onComplete) onComplete(); return;
        } musicElement.volume += volumeStep;
    }, stepTime);
}
function switchTrack(src, loop, isGameTrack = false) {
    if (!isMusicInitialized || !musicElement) return;
    fadeAudio(0, 1500, () => {
        musicElement.src = src; musicElement.loop = loop; musicElement.load();
        if (isGameTrack) {
            let newIndex; do { newIndex = Math.floor(Math.random() * GAME_TRACKS.length); } while (GAME_TRACKS.length > 1 && newIndex === currentGameTrackIndex);
            currentGameTrackIndex = newIndex; musicElement.src = GAME_TRACKS[currentGameTrackIndex];
        } musicElement.play().catch(e => console.error("Music playback failed:", e));
        fadeAudio(gameState.musicVolume);
    });
}
export function startMenuMusic() { if (!isMusicInitialized) initMusic(); if (!musicElement || (musicElement.src.includes(MENU_MUSIC_SRC) && !musicElement.paused)) return; switchTrack(MENU_MUSIC_SRC, true); }
export function startGameMusic() { if (!isMusicInitialized) initMusic(); if (!musicElement) return; playNextGameTrack(true); }
export function playNextGameTrack(isCrossfade = true) {
    if (!isMusicInitialized || !musicElement) return; const nextTrackIndex = (currentGameTrackIndex + 1) % GAME_TRACKS.length;
    if (isCrossfade) { switchTrack(GAME_TRACKS[nextTrackIndex], false, true); }
    else {
        let newIndex; do { newIndex = Math.floor(Math.random() * GAME_TRACKS.length); } while (GAME_TRACKS.length > 1 && newIndex === currentGameTrackIndex);
        currentGameTrackIndex = newIndex; musicElement.src = GAME_TRACKS[currentGameTrackIndex];
        musicElement.loop = false; musicElement.load(); musicElement.play().catch(e => console.error("Music playback failed:", e));
    }
}

// --- Volume Control Functions ---
export function setMusicVolume(vol) { gameState.musicVolume = Math.max(0, Math.min(1, vol)); if (musicElement && !musicFadeInterval) { musicElement.volume = gameState.musicVolume; } localStorage.setItem('musicVolume', String(gameState.musicVolume)); updateMusicVolumeUI(gameState.musicVolume); }
export function setSfxVolume(vol) { gameState.sfxVolume = Math.max(0, Math.min(1, vol)); localStorage.setItem('sfxVolume', String(gameState.sfxVolume)); updateSfxVolumeUI(gameState.sfxVolume); }
export function setMusicMuted(isMuted) { if (musicElement) { musicElement.volume = isMuted ? gameState.musicVolume * 0.2 : gameState.musicVolume; } }
export function getAudioContext() { return audioContext; }
export function isAudioInitialized() { return audioInitialized; }
export function isThrustSoundActive() { return activeThrustSound !== null; }