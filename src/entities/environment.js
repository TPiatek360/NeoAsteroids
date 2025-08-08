// src/entities/environment.js
// Defines classes for asteroids, pickups, and other environmental objects.

import { gameState } from '../state.js';
import { ctx, canvas, toggleHangarScreen } from '../ui/ui.js';
import { createExplosion, triggerRumble } from '../fx/effects.js';
import { playExplosionSound, playNextGameTrack, stopThrustSound, stopChargeSound, isThrustSoundActive } from '../audio/audio.js';
import { distBetweenPoints, getDynamicColor } from '../utils.js';
import {
    DIFFICULTY_SETTINGS,
    NEON_PINK,
    ASTEROID_VERTICES,
    ASTEROID_JAG,
    MISSILE_PICKUP_SIZE,
    MISSILE_PICKUP_DURATION,
    NEON_ORANGE,
    POWERUP_DURATION,
    NEON_LIME,
    ASTEROID_MIN_SIZE_FOR_PICKUP,
    MISSILE_PICKUP_CHANCE,
    POWERUP_DROP_CHANCE,
    EXTRA_LIFE_DROP_CHANCE,
    GUARANTEED_LIFE_LEVEL,
    NEON_BLUE // Import the new color
} from '../constants.js';
import missionManager from '../campaign/MissionManager.js';

// Constants for the anti-stuck logic
const SLOW_SPEED_THRESHOLD = 0.5;
const STUCK_ASTEROID_BOOST = 0.01;


// --- NEW PLANETOID CLASS ---
export class Planetoid {
    constructor(x, y, r) {
        this.r = r || Math.random() * 60 + 80; // Random radius between 80 and 140
        this.x = x || Math.random() * (canvas.width - this.r * 2) + this.r;
        this.y = y || Math.random() * (canvas.height - this.r * 2) + this.r;
        
        this.mass = Math.PI * this.r * this.r; // Mass for gravity calculation
        this.a = Math.random() * Math.PI * 2; // Initial rotation
        this.rot = (Math.random() - 0.5) * 0.0005; // Slow, random rotation speed
    }

    draw() {
        const dynamicColor = getDynamicColor(NEON_BLUE);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.a);

        // 1. Draw the atmospheric glow
        const glowRadius = this.r * 1.3;
        const gradient = ctx.createRadialGradient(0, 0, this.r * 0.8, 0, 0, glowRadius);
        gradient.addColorStop(0, getDynamicColor('rgba(0, 170, 255, 0.4)'));
        gradient.addColorStop(1, getDynamicColor('rgba(0, 170, 255, 0)'));
        
        ctx.fillStyle = gradient;
        ctx.shadowColor = dynamicColor;
        ctx.shadowBlur = 30;

        ctx.beginPath();
        ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // 2. Draw the solid planet body
        ctx.beginPath();
        ctx.arc(0, 0, this.r, 0, Math.PI * 2);
        ctx.fillStyle = getDynamicColor('rgba(13, 2, 26, 1)'); // Use the background color for the body
        ctx.strokeStyle = dynamicColor;
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();

        // 3. Placeholder for future "continents"
        // This is where you would draw shapes/patterns that rotate with the planet.
        // For now, we can add a simple line to show the rotation.
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.r, 0);
        ctx.stroke();

        ctx.restore();
    }

    update() {
        // Planetoids only rotate, they do not move.
        this.a += this.rot;
    }
}


export class Asteroid {
    constructor(x, y, r, speedMultiplier = 1) {
        this.x = x || Math.random() * canvas.width;
        this.y = y || Math.random() * canvas.height;
        const settings = DIFFICULTY_SETTINGS[gameState.currentDifficulty];
        this.r = r || Math.random() * (settings.asteroidSize / 2) + (settings.asteroidSize / 2);

        const baseSpeed = settings.asteroidSpeed * speedMultiplier;
        const speed = (Math.random() * 0.7 + 0.3) * baseSpeed;
        const angle = Math.random() * Math.PI * 2;
        this.xv = Math.cos(angle) * speed;
        this.yv = Math.sin(angle) * speed;

        this.a = 0;
        this.vert = Math.floor(Math.random() * (ASTEROID_VERTICES + 1) + ASTEROID_VERTICES / 2);
        this.offs = [];
        for (let i = 0; i < this.vert; i++) {
            this.offs.push(Math.random() * ASTEROID_JAG * 2 + 1 - ASTEROID_JAG);
        }
    }
    
    draw(isMenuAsteroid = false) {
        ctx.save();

        if (isMenuAsteroid) {
            const dynamicColor = getDynamicColor(NEON_PINK);
            ctx.filter = 'blur(2px)';

            // Adjust alpha based on brightness slider for real-time feedback in the menu
            let brightnessAlpha = 0.3; // Base alpha for menu asteroids
            if (gameState.colorMode === 'bw' || gameState.colorMode === 'green' || gameState.colorMode === 'amber') {
                // Map the slider's 0.7-1.8 range to a new 0.1-0.6 alpha range
                const multiplier = (gameState.shaders.monoBrightness - 0.7) / (1.8 - 0.7); // scale to 0-1
                brightnessAlpha = 0.1 + multiplier * 0.5; // map to a visible alpha range
            }

            ctx.globalAlpha = brightnessAlpha;
            ctx.strokeStyle = dynamicColor;
            ctx.shadowColor = dynamicColor;
            ctx.shadowBlur = 15;
            ctx.lineWidth = 1.5;
        } else {
            const dynamicColor = getDynamicColor(NEON_PINK);
            ctx.filter = 'none';
            ctx.strokeStyle = dynamicColor;
            ctx.lineWidth = 2;
            ctx.shadowColor = dynamicColor;
            ctx.shadowBlur = 20;
        }
        
        ctx.beginPath();
        ctx.moveTo(
            this.x + this.r * this.offs[0] * Math.cos(this.a),
            this.y + this.r * this.offs[0] * Math.sin(this.a)
        );
        for (let i = 1; i < this.vert; i++) {
            ctx.lineTo(
                this.x + this.r * this.offs[i] * Math.cos(this.a + i * Math.PI * 2 / this.vert),
                this.y + this.r * this.offs[i] * Math.sin(this.a + i * Math.PI * 2 / this.vert)
            );
        }
        ctx.closePath();
        ctx.stroke();

        ctx.restore();
    }
    
    update() { 
        this.x += this.xv; 
        this.y += this.yv; 
        this.handleScreenWrap(); 
    }

    handleScreenWrap() { 
        if (this.x < 0 - this.r) this.x = canvas.width + this.r; 
        if (this.x > canvas.width + this.r) this.x = 0 - this.r; 
        if (this.y < 0 - this.r) this.y = canvas.height + this.r; 
        if (this.y > canvas.height + this.r) this.y = 0 - this.r;

        const speed = Math.sqrt(this.xv * this.xv + this.yv * this.yv);
        if (speed < SLOW_SPEED_THRESHOLD) {
            const isOffscreen = this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height;
            if (isOffscreen) {
                if (this.x < canvas.width / 2) {
                    this.xv += STUCK_ASTEROID_BOOST;
                } else {
                    this.xv -= STUCK_ASTEROID_BOOST;
                }
                if (this.y < canvas.height / 2) {
                    this.yv += STUCK_ASTEROID_BOOST;
                } else {
                    this.yv -= STUCK_ASTEROID_BOOST;
                }
            }
        }
    }
}

export class MissilePickup {
    constructor(x, y) { this.x = x; this.y = y; this.r = MISSILE_PICKUP_SIZE; this.life = MISSILE_PICKUP_DURATION; this.pulseRate = 0.05; this.pulsePhase = Math.random() * Math.PI * 2; }
    draw() {
        const dynamicColor = getDynamicColor(NEON_ORANGE);
        this.pulsePhase += this.pulseRate;
        const currentRadius = this.r * (1 + 0.15 * Math.sin(this.pulsePhase));
        const currentOpacity = 0.7 + 0.3 * Math.sin(this.pulsePhase + Math.PI / 2);
        ctx.save();
        ctx.globalAlpha = currentOpacity;
        ctx.fillStyle = dynamicColor;
        ctx.shadowColor = dynamicColor;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = getDynamicColor(`rgba(50, 20, 0, ${currentOpacity * 1.2 > 1 ? 1 : currentOpacity * 1.2})`);
        ctx.lineWidth = 2;
        ctx.shadowBlur = 0;
        const iconSize = this.r * 0.6;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - iconSize * 0.7);
        ctx.lineTo(this.x - iconSize * 0.5, this.y + iconSize * 0.5);
        ctx.lineTo(this.x + iconSize * 0.5, this.y + iconSize * 0.5);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }
    update() { this.life--; }
}

export class PowerUp {
    constructor(x, y, type = null) { this.x = x; this.y = y; this.r = 12; this.life = POWERUP_DURATION; this.types = ['rapidFire', 'spreadShot', 'shieldBoost', 'extraLife']; this.type = type || this.types[Math.floor(Math.random() * (this.types.length - 1))]; this.pulse = 0; }
    draw() {
        this.pulse += 0.1;
        const r = this.r + Math.sin(this.pulse) * 2;
        ctx.save();
        let letter = '?';
        let color = NEON_LIME;
        if (this.type === 'rapidFire') { color = NEON_LIME; letter = 'R'; }
        else if (this.type === 'spreadShot') { color = NEON_LIME; letter = 'S'; }
        else if (this.type === 'shieldBoost') { color = NEON_LIME; letter = '+'; }
        else if (this.type === 'extraLife') { color = NEON_PINK; letter = '▲'; }

        const dynamicColor = getDynamicColor(color);
        ctx.strokeStyle = dynamicColor;
        ctx.fillStyle = getDynamicColor(`rgba(127, 255, 0, ${0.4 + Math.sin(this.pulse) * 0.2})`);
        ctx.shadowColor = dynamicColor;

        ctx.lineWidth = 2;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = `bold ${this.type === 'extraLife' ? '20px' : '14px'} 'Orbitron', sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(letter, this.x, this.y + (this.type === 'extraLife' ? 1 : 0));
        ctx.restore();
    }
    update(deltaTime) { this.life -= deltaTime; }
}

export function createStarfield() {
    const starCount = 300;
    gameState.starfield.length = 0; // Clear existing stars
    for (let i = 0; i < starCount; i++) {
        const z = Math.random() < 0.5 ? 1 : 2; // Two layers
        gameState.starfield.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            z: z,
            dx: (Math.random() - 0.5) * 0.05, // Idle drift X
            dy: (Math.random() - 0.5) * 0.05, // Idle drift Y
            r: z === 1 ? 0.7 : 1.2,
            opacity: z === 1 ? 0.4 : 0.8
        });
    }
}

export function createAsteroidBelt() {
    const settings = DIFFICULTY_SETTINGS[gameState.currentDifficulty];
    const asteroidCountScale = Math.pow(1.25, gameState.level - 1);
    const speedScale = gameState.levelScale;
    let currentAsteroidCount = Math.round(settings.asteroidNum * asteroidCountScale);

    // --- NEW: Planetoid Spawning Logic ---
    gameState.planetoids = [];
    if (Math.random() < 0.2) { // 20% chance for the first planetoid
        let x, y, r;
        do {
            r = Math.random() * 60 + 80;
            x = Math.random() * (canvas.width - r * 2) + r;
            y = Math.random() * (canvas.height - r * 2) + r;
        } while (gameState.players.some(p => p.lives > 0 && distBetweenPoints(p.x, p.y, x, y) < r * 2));
        gameState.planetoids.push(new Planetoid(x, y, r));

        if (Math.random() < 0.25) { // 25% chance for a second one *if* the first spawns
            let x2, y2, r2;
            let attempts = 0;
            do {
                r2 = Math.random() * 60 + 80;
                x2 = Math.random() * (canvas.width - r2 * 2) + r2;
                y2 = Math.random() * (canvas.height - r2 * 2) + r2;
                attempts++;
            } while (
                (gameState.players.some(p => p.lives > 0 && distBetweenPoints(p.x, p.y, x2, y2) < r2 * 2) ||
                distBetweenPoints(x, y, x2, y2) < (r + r2) * 1.5) && // Ensure they aren't too close
                attempts < 10 // Prevent infinite loop
            );
            if(attempts < 10) gameState.planetoids.push(new Planetoid(x2, y2, r2));
        }
    }


    for (let i = 0; i < currentAsteroidCount; i++) {
        let x, y;
        do {
            x = Math.random() * canvas.width;
            y = Math.random() * canvas.height;
        } while (
            gameState.players.some(p => p.lives > 0 && distBetweenPoints(p.x, p.y, x, y) < settings.asteroidSize * 2 + p.r) ||
            gameState.planetoids.some(p => distBetweenPoints(p.x, p.y, x, y) < p.r * 1.5) // Don't spawn inside planetoids
        );
        gameState.asteroids.push(new Asteroid(x, y, undefined, speedScale));
    }
}

export function createMenuAsteroidBelt() {
    gameState.menuAsteroids = [];
    for (let i = 0; i < 15; i++) {
        gameState.menuAsteroids.push(new Asteroid());
    }
    createStarfield();
}

export function destroyAsteroid(index, destroyedByMissile = false, playerId = -1) {
    const a = gameState.asteroids[index];
    if (!a) return;
    if (destroyedByMissile) { triggerRumble(0.3, 0.3, 150); } else { triggerRumble(0.1, 0.2, 100); }
    playExplosionSound(destroyedByMissile ? 0.7 : 0.5, destroyedByMissile ? 0.6 : 0.4);
    createExplosion(a.x, a.y, NEON_PINK, 10 + Math.floor(a.r / 5), 2.5);
    
    const scoringPlayer = gameState.players.find(p => p.id === playerId);

    if (a.r > ASTEROID_MIN_SIZE_FOR_PICKUP) {
        if (scoringPlayer) scoringPlayer.score += 20;
        const speedScale = gameState.levelScale;
        gameState.asteroids.push(new Asteroid(a.x, a.y, a.r / 2, speedScale));
        gameState.asteroids.push(new Asteroid(a.x, a.y, a.r / 2, speedScale));
    } else {
        if (scoringPlayer) scoringPlayer.score += 50;
        if (Math.random() < EXTRA_LIFE_DROP_CHANCE) { gameState.powerUps.push(new PowerUp(a.x, a.y, 'extraLife')); } 
        else if (Math.random() < MISSILE_PICKUP_CHANCE) { gameState.missilePickups.push(new MissilePickup(a.x, a.y)); } 
        else if (Math.random() < POWERUP_DROP_CHANCE) { gameState.powerUps.push(new PowerUp(a.x, a.y)); }
    }
    gameState.asteroids.splice(index, 1);
}

export function handleLevelEnd() {
    const isStandardLevelClear = !missionManager.isMissionActive() && gameState.asteroids.length === 0 && gameState.enemies.length === 0;
    const isMissionComplete = missionManager.isMissionActive() && missionManager.isComplete;

    if (gameState.status === 'playing' && (isStandardLevelClear || isMissionComplete)) {
        const livingPlayers = gameState.players.filter(p => p.lives > 0);
        if (livingPlayers.length === 0) return;

        if (gameState.gameType === 'campaign') {
            const scores = {};
            livingPlayers.forEach(p => {
                const scoreEarned = p.score;
                scores[p.id] = scoreEarned;
                p.currency += scoreEarned;
                p.score = 0;
            });
            
            gameState.level++;
            gameState.levelScale = Math.pow(1.05, gameState.level - 1);

            // --- FIX: Stop active sounds before going to the hangar ---
            if (isThrustSoundActive()) {
                stopThrustSound();
            }
            // Also stop any potential charging sounds from players
            gameState.players.forEach(p => {
                if (p.isChargingMissile) {
                    stopChargeSound();
                    p.isChargingMissile = false; // also reset player state to be safe
                }
            });
            
            gameState.status = 'hangar';
            toggleHangarScreen(true, scores);

        } else { // Arcade Mode
            const levelBonus = 1000 * livingPlayers.length;
            const scorePerPlayer = Math.round(levelBonus / livingPlayers.length);
            livingPlayers.forEach(p => p.score += scorePerPlayer);
            
            gameState.level++;
            gameState.levelScale = Math.pow(1.05, gameState.level - 1);
            
            if (gameState.level === GUARANTEED_LIFE_LEVEL && !gameState.level8LifeAwarded) {
                gameState.powerUps.push(new PowerUp(canvas.width / 2, canvas.height / 2, 'extraLife'));
                gameState.level8LifeAwarded = true;
            }

            playNextGameTrack();
            createAsteroidBelt();
            gameState.players.forEach(p => { 
                if (p.lives > 0) p.invincibilityFrames = 180;
            });
        }
    }
}