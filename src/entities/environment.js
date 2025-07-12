// src/entities/environment.js
// Defines classes for asteroids, pickups, and other environmental objects.

import { gameState } from '../state.js';
import { ctx, canvas } from '../ui/ui.js';
import { updateGameUI } from '../ui/hud.js';
import { playNextGameTrack } from '../audio/audio.js';
import { distBetweenPoints } from '../utils.js';
import { eventBus } from '../systems/EventBus.js';
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
    GUARANTEED_LIFE_LEVEL
} from '../constants.js';

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
            ctx.filter = 'blur(2px)';
            ctx.strokeStyle = 'rgba(255, 0, 255, 0.3)';
            ctx.shadowColor = 'rgba(255, 0, 255, 0.5)';
            ctx.shadowBlur = 15;
            ctx.lineWidth = 1.5;
        } else {
            ctx.filter = 'none';
            ctx.strokeStyle = NEON_PINK;
            ctx.lineWidth = 2;
            ctx.shadowColor = NEON_PINK;
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

    update() { this.x += this.xv; this.y += this.yv; this.handleScreenWrap(); }
    handleScreenWrap() { if (this.x < 0 - this.r) this.x = canvas.width + this.r; if (this.x > canvas.width + this.r) this.x = 0 - this.r; if (this.y < 0 - this.r) this.y = canvas.height + this.r; if (this.y > canvas.height + this.r) this.y = 0 - this.r; }
}

export class MissilePickup {
    constructor(x, y) { this.x = x; this.y = y; this.r = MISSILE_PICKUP_SIZE; this.life = MISSILE_PICKUP_DURATION; this.pulseRate = 0.05; this.pulsePhase = Math.random() * Math.PI * 2; }
    draw() { this.pulsePhase += this.pulseRate; const currentRadius = this.r * (1 + 0.15 * Math.sin(this.pulsePhase)); const currentOpacity = 0.7 + 0.3 * Math.sin(this.pulsePhase + Math.PI / 2); ctx.save(); ctx.globalAlpha = currentOpacity; ctx.fillStyle = NEON_ORANGE; ctx.shadowColor = NEON_ORANGE; ctx.shadowBlur = 15; ctx.beginPath(); ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = `rgba(50, 20, 0, ${currentOpacity * 1.2 > 1 ? 1 : currentOpacity * 1.2})`; ctx.lineWidth = 2; ctx.shadowBlur = 0; const iconSize = this.r * 0.6; ctx.beginPath(); ctx.moveTo(this.x, this.y - iconSize * 0.7); ctx.lineTo(this.x - iconSize * 0.5, this.y + iconSize * 0.5); ctx.lineTo(this.x + iconSize * 0.5, this.y + iconSize * 0.5); ctx.closePath(); ctx.stroke(); ctx.restore(); }
    update(deltaTime) { this.life -= deltaTime; }
}

export class PowerUp {
    constructor(x, y, type = null) { this.x = x; this.y = y; this.r = 12; this.life = POWERUP_DURATION; this.types = ['rapidFire', 'spreadShot', 'shieldBoost', 'extraLife']; this.type = type || this.types[Math.floor(Math.random() * (this.types.length - 1))]; this.pulse = 0; }
    draw() { this.pulse += 0.1; const r = this.r + Math.sin(this.pulse) * 2; ctx.save(); let letter = '?'; if (this.type === 'rapidFire') { ctx.strokeStyle = NEON_LIME; ctx.fillStyle = `rgba(127, 255, 0, ${0.4 + Math.sin(this.pulse) * 0.2})`; ctx.shadowColor = NEON_LIME; letter = 'R'; } else if (this.type === 'spreadShot') { ctx.strokeStyle = NEON_LIME; ctx.fillStyle = `rgba(127, 255, 0, ${0.4 + Math.sin(this.pulse) * 0.2})`; ctx.shadowColor = NEON_LIME; letter = 'S'; } else if (this.type === 'shieldBoost') { ctx.strokeStyle = NEON_LIME; ctx.fillStyle = `rgba(127, 255, 0, ${0.4 + Math.sin(this.pulse) * 0.2})`; ctx.shadowColor = NEON_LIME; letter = '+'; } else if (this.type === 'extraLife') { ctx.strokeStyle = NEON_PINK; ctx.fillStyle = `rgba(255, 0, 255, ${0.4 + Math.sin(this.pulse) * 0.2})`; ctx.shadowColor = NEON_PINK; letter = '▲'; } ctx.lineWidth = 2; ctx.shadowBlur = 15; ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = ctx.strokeStyle; ctx.font = `bold ${this.type === 'extraLife' ? '20px' : '14px'} 'Orbitron', sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(letter, this.x, this.y + (this.type === 'extraLife' ? 1 : 0)); ctx.restore(); }
    update(deltaTime) { this.life -= deltaTime; }
}

export function createAsteroidBelt() {
    const settings = DIFFICULTY_SETTINGS[gameState.currentDifficulty];
    const asteroidCountScale = Math.pow(1.25, gameState.level - 1);
    const speedScale = Math.pow(1.05, gameState.level - 1);
    let currentAsteroidCount = Math.round(settings.asteroidNum * asteroidCountScale);
    for (let i = 0; i < currentAsteroidCount; i++) {
        let x, y, newAsteroid;
        do {
            x = Math.random() * canvas.width;
            y = Math.random() * canvas.height;
        } while (gameState.players.some(p => p.lives > 0 && distBetweenPoints(p.x, p.y, x, y) < settings.asteroidSize * 2 + p.r));
        newAsteroid = new Asteroid(x, y, undefined, speedScale);
        gameState.asteroids.push(newAsteroid);
        eventBus.dispatch('asteroid_spawned', { r: newAsteroid.r });
    }
}

export function createMenuAsteroidBelt() { gameState.menuAsteroids = []; for (let i = 0; i < 15; i++) { gameState.menuAsteroids.push(new Asteroid()); } }

export function destroyAsteroid(index, destroyedByMissile = false, playerId = -1) {
    const a = gameState.asteroids[index];
    if (!a) return;

    // Dispatch event with all necessary data for sound, FX, and scoring.
    eventBus.dispatch('asteroid_destroyed', {
        x: a.x,
        y: a.y,
        r: a.r,
        destroyedByMissile: destroyedByMissile,
        playerId: playerId
    });

    if (a.r > ASTEROID_MIN_SIZE_FOR_PICKUP) {
        const speedScale = Math.pow(1.05, gameState.level - 1);
        const ast1 = new Asteroid(a.x, a.y, a.r / 2, speedScale);
        const ast2 = new Asteroid(a.x, a.y, a.r / 2, speedScale);
        gameState.asteroids.push(ast1, ast2);
        eventBus.dispatch('asteroid_spawned', { r: ast1.r });
        eventBus.dispatch('asteroid_spawned', { r: ast2.r });
    } else {
        if (Math.random() < EXTRA_LIFE_DROP_CHANCE) { 
            gameState.powerUps.push(new PowerUp(a.x, a.y, 'extraLife')); 
            eventBus.dispatch('pickup_spawned', { type: 'Extra Life' });
        }
        else if (Math.random() < MISSILE_PICKUP_CHANCE) { 
            gameState.missilePickups.push(new MissilePickup(a.x, a.y)); 
            eventBus.dispatch('pickup_spawned', { type: 'Missile' });
        }
        else if (Math.random() < POWERUP_DROP_CHANCE) { 
            const newPowerUp = new PowerUp(a.x, a.y);
            gameState.powerUps.push(newPowerUp);
            eventBus.dispatch('pickup_spawned', { type: newPowerUp.type });
        }
    }
    gameState.asteroids.splice(index, 1);
}

export function handleLevelEnd() {
    if (gameState.asteroids.length === 0 && gameState.enemies.length === 0 && gameState.status === 'playing') {
        const livingPlayers = gameState.players.filter(p => p.lives > 0);
        if (livingPlayers.length > 0) {
            const levelBonus = 1000 * livingPlayers.length;
            const scorePerPlayer = Math.round(levelBonus / livingPlayers.length);
            livingPlayers.forEach(p => p.score += scorePerPlayer);
        }

        gameState.level++;

        if (gameState.level === GUARANTEED_LIFE_LEVEL && !gameState.level8LifeAwarded) {
            gameState.powerUps.push(new PowerUp(canvas.width / 2, canvas.height / 2, 'extraLife'));
            gameState.level8LifeAwarded = true;
            eventBus.dispatch('pickup_spawned', { type: 'Guaranteed Extra Life' });
        }

        playNextGameTrack();
        createAsteroidBelt();
        gameState.players.forEach(p => {
            if (p.lives > 0) p.invincibilityFrames = 180;
        });
        updateGameUI();
    }
}