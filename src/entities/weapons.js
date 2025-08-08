// src/entities/weapons.js
// Defines all weapon-related classes (Bullet, Missile, Bomb) and firing logic.

import { gameState } from '../state.js';
import { ctx, canvas } from '../ui/ui.js';
import { SmokeParticle } from '../fx/particles.js';
import { playShootSound, playMissileLaunchSound } from '../audio/audio.js';
import { normalizeAngle, degToRad, distBetweenPoints, getDynamicColor } from '../utils.js';
import {
    BULLET_SPEED,
    NEON_LIME,
    NEON_ORANGE,
    PLAYER_GUN_COOLDOWN,
    PLAYER_SIZE,
    MISSILE_SPEED,
    MISSILE_LIFETIME,
    MISSILE_ACQUISITION_DELAY,
    MISSILE_ACQUISITION_CONE,
    MISSILE_TURN_SPEED,
    MISSILE_SMOKE_INTERVAL,
    MAX_CHARGE_LEVEL,
    MISSILE_SPREAD_ANGLE_INCREMENT,
    NEON_ENEMY_MISSILE,
    NEON_ALLY_MISSILE,
    NEON_ENEMY_ROCKET,
    NEON_ALLY_BODY,
    NEON_ENEMY_BODY,
    ROCKET_SPEED
} from '../constants.js';

class Bullet {
    constructor(player, angle = player.a) {
        this.ownerId = player.id;
        this.x = player.x + player.r * Math.cos(angle);
        this.y = player.y + player.r * Math.sin(angle);
        this.xv = BULLET_SPEED * Math.cos(angle) + player.thrust.x;
        this.yv = BULLET_SPEED * Math.sin(angle) + player.thrust.y;
        this.r = 3;
        this.color = player.color;
    }
    draw() {
        const dynamicColor = getDynamicColor(this.color);
        ctx.fillStyle = dynamicColor;
        ctx.shadowColor = dynamicColor;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2, false);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
    update() {
        this.x += this.xv;
        this.y += this.yv;
    }
}

export class EnemyBullet {
    constructor(ship, angle = ship.a) {
        this.faction = ship.faction;
        this.ownerId = ship.faction; // 'enemy' or 'ally'
        this.x = ship.x + (ship.r || 15) * Math.cos(angle);
        this.y = ship.y + (ship.r || 15) * Math.sin(angle);
        this.xv = BULLET_SPEED * Math.cos(angle);
        this.yv = BULLET_SPEED * Math.sin(angle);
        this.r = 3;
    }
    draw() {
        const color = this.faction === 'ally' ? NEON_ALLY_BODY : NEON_ENEMY_BODY;
        const dynamicColor = getDynamicColor(color);
        ctx.fillStyle = dynamicColor;
        ctx.shadowColor = dynamicColor;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2, false);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
    update() {
        this.x += this.xv;
        this.y += this.yv;
    }
}

export class Rocket {
    constructor(ship, angle) {
        this.faction = ship.faction;
        this.ownerId = ship.faction;
        this.x = ship.x;
        this.y = ship.y;
        this.angle = angle;
        this.xv = ROCKET_SPEED * Math.cos(angle);
        this.yv = ROCKET_SPEED * Math.sin(angle);
        this.w = 12;
        this.h = 4;
        this.r = this.w / 2; // Add radius for collision system
    }
    draw() {
        const color = this.faction === 'ally' ? NEON_ALLY_BODY : NEON_ENEMY_ROCKET;
        const dynamicColor = getDynamicColor(color);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = dynamicColor;
        ctx.shadowColor = dynamicColor;
        ctx.shadowBlur = 10;
        ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
        ctx.restore();
        ctx.shadowBlur = 0;
    }
    update() {
        this.x += this.xv;
        this.y += this.yv;
    }
}

class Missile {
    constructor(player, angleOffset = 0) {
        this.ownerId = player.id;
        this.x = player.x + player.r * Math.cos(player.a);
        this.y = player.y + player.r * Math.sin(player.a);
        this.a = normalizeAngle(player.a + angleOffset);
        this.speed = MISSILE_SPEED;
        this.r = 6;
        this.life = MISSILE_LIFETIME;
        this.acquisitionTimer = MISSILE_ACQUISITION_DELAY;
        this.target = null;
        this.smokeTimer = 0;
        this.serpentinePhase = Math.random() * Math.PI * 2;
        this.serpentineStrength = 0.3;
        this.color = player.color;
    }
    draw() {
        const dynamicColor = getDynamicColor(this.color);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.a);
        ctx.fillStyle = dynamicColor;
        ctx.shadowColor = dynamicColor;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(this.r * 1.5, 0);
        ctx.lineTo(-this.r * 0.75, this.r * 0.75);
        ctx.lineTo(-this.r * 0.75, -this.r * 0.75);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.shadowBlur = 0;
    }
    update(deltaTime) {
        this.life -= deltaTime;
        if (this.acquisitionTimer > 0) {
            this.acquisitionTimer -= deltaTime;
            this.x += this.speed * Math.cos(this.a);
            this.y += this.speed * Math.sin(this.a);
        } else {
            let targetIsInvalid = false;
            if (!this.target) {
                targetIsInvalid = true;
            } else {
                // A target is invalid if it has been destroyed.
                // This logic handles all potential target types cleanly.
                if (this.target.isDead) { // Covers all enemy types.
                    targetIsInvalid = true;
                } else if (this.target.constructor.name === 'Asteroid' && !gameState.asteroids.includes(this.target)) {
                    // Asteroids are simply removed from the array when destroyed.
                    targetIsInvalid = true;
                } else if (this.target.constructor.name === 'Player' && this.target.lives <= 0) {
                    // Players are invalid if they have no lives left (for VS mode).
                    targetIsInvalid = true;
                }
            }

            if (targetIsInvalid) {
                this.acquireTarget();
            }

            if (this.target) {
                const angleToTarget = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                let angleDifference = normalizeAngle(angleToTarget - this.a);
                this.serpentinePhase += 0.15;
                const serpentineOffset = Math.sin(this.serpentinePhase) * this.serpentineStrength;
                angleDifference = normalizeAngle(angleDifference + serpentineOffset);
                if (Math.abs(angleDifference) > MISSILE_TURN_SPEED) {
                    this.a += Math.sign(angleDifference) * MISSILE_TURN_SPEED;
                } else {
                    this.a = normalizeAngle(angleToTarget + serpentineOffset);
                }
                this.a = normalizeAngle(this.a);
            }
            this.x += this.speed * Math.cos(this.a);
            this.y += this.speed * Math.sin(this.a);
        }
        this.smokeTimer -= deltaTime;
        if (this.smokeTimer <= 0) {
            gameState.smokeParticles.push(new SmokeParticle(this.x, this.y));
            this.smokeTimer = MISSILE_SMOKE_INTERVAL;
        }
        this.handleScreenWrap();
    }
    acquireTarget() {
        let closestTarget = null;
        let minTargetDist = Infinity;
        
        const potentialTargets = [...gameState.enemies, ...gameState.asteroids];
        if (gameState.gameMode === 'twoPlayer' && gameState.twoPlayerMode === 'vs') {
            gameState.players.forEach(p => {
                if (p.id !== this.ownerId && p.lives > 0) potentialTargets.push(p);
            });
        }

        potentialTargets.forEach(target => {
            if (target.lives !== undefined && target.lives <= 0) return; // Skip dead players
            if (target.isDead) return; // Skip dead enemies

            const d = distBetweenPoints(this.x, this.y, target.x, target.y);
            const angleToTarget = Math.atan2(target.y - this.y, target.x - this.x);
            const angleDifference = Math.abs(normalizeAngle(angleToTarget - this.a));
            if (angleDifference <= MISSILE_ACQUISITION_CONE / 2 && d < minTargetDist) {
                minTargetDist = d;
                closestTarget = target;
            }
        });
        
        this.target = closestTarget;
    }
    handleScreenWrap() {
        const margin = this.r + 20;
        if (this.x < 0 - margin) this.x = canvas.width + margin;
        if (this.x > canvas.width + margin) this.x = 0 - margin;
        if (this.y < 0 - margin) this.y = canvas.height + margin;
        if (this.y > canvas.height + margin) this.y = 0 - margin;
    }
}

export class EnemyMissile {
    constructor(ship) {
        this.faction = ship.faction;
        this.ownerId = ship.faction;
        this.x = ship.x + (ship.r || 15) * Math.cos(ship.a);
        this.y = ship.y + (ship.r || 15) * Math.sin(ship.a);
        this.a = ship.a;
        this.speed = MISSILE_SPEED * 0.9;
        this.r = 6;
        this.life = MISSILE_LIFETIME;
        this.acquisitionTimer = MISSILE_ACQUISITION_DELAY;
        this.target = null;
        this.smokeTimer = 0;
        this.color = this.faction === 'ally' ? NEON_ALLY_MISSILE : NEON_ENEMY_MISSILE;
    }
    draw() {
        const dynamicColor = getDynamicColor(this.color);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.a);
        ctx.fillStyle = dynamicColor;
        ctx.shadowColor = dynamicColor;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(this.r * 1.5, 0);
        ctx.lineTo(-this.r * 0.75, this.r * 0.75);
        ctx.lineTo(-this.r * 0.75, -this.r * 0.75);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.shadowBlur = 0;
    }
    update(deltaTime) {
        this.life -= deltaTime;
        if (this.acquisitionTimer > 0) {
            this.acquisitionTimer -= deltaTime;
            this.x += this.speed * Math.cos(this.a);
            this.y += this.speed * Math.sin(this.a);
        } else {
            if (!this.target || (this.target.isDead || (this.target.lives !== undefined && this.target.lives <= 0))) {
                this.acquireTarget();
            }
            if (this.target) {
                const angleToTarget = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                const angleDifference = normalizeAngle(angleToTarget - this.a);
                if (Math.abs(angleDifference) > MISSILE_TURN_SPEED) {
                    this.a += Math.sign(angleDifference) * MISSILE_TURN_SPEED;
                } else { this.a = angleToTarget; }
                this.a = normalizeAngle(this.a);
            }
            this.x += this.speed * Math.cos(this.a);
            this.y += this.speed * Math.sin(this.a);
        }
        this.smokeTimer -= deltaTime;
        if (this.smokeTimer <= 0) {
            gameState.smokeParticles.push(new SmokeParticle(this.x, this.y));
            this.smokeTimer = MISSILE_SMOKE_INTERVAL;
        }
        this.handleScreenWrap();
    }
    acquireTarget() {
        const potentialTargets = [];
        if (this.faction === 'enemy') {
            potentialTargets.push(...gameState.players.filter(p => p.lives > 0));
            potentialTargets.push(...gameState.allies.filter(a => !a.isDead));
        } else { // faction is 'ally'
            potentialTargets.push(...gameState.enemies.filter(e => !e.isDead));
        }

        let closestTarget = null;
        let minDist = Infinity;
        for (const p of potentialTargets) {
            const d = distBetweenPoints(this.x, this.y, p.x, p.y);
            if (d < minDist) {
                minDist = d;
                closestTarget = p;
            }
        }
        this.target = closestTarget;
    }
    handleScreenWrap() {
        const margin = this.r + 20;
        if (this.x < 0 - margin) this.x = canvas.width + margin;
        if (this.x > canvas.width + margin) this.x = 0 - margin;
        if (this.y < 0 - margin) this.y = canvas.height + margin;
        if (this.y > canvas.height + margin) this.y = 0 - margin;
    }
}

export class Bomb {
    constructor(x, y, ownerId) {
        this.x = x;
        this.y = y;
        this.r = 8;
        this.life = 5000;
        this.blastRadius = 100;
        this.color = NEON_ORANGE;
        this.ownerId = ownerId;
    }
    draw() {
        const dynamicColor = getDynamicColor(this.color);
        let r = this.r;
        let alpha = 0.8;
        if (this.life < 1500) {
            const pulseIntensity = 1 - (this.life / 1500);
            const pulseRate = 5 + pulseIntensity * 15;
            r = this.r + Math.sin(Date.now() / 1000 * pulseRate) * (this.r * 0.5 * pulseIntensity);
            alpha = 0.6 + Math.abs(Math.sin(Date.now() / 1000 * pulseRate)) * 0.4;
        }
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = dynamicColor;
        ctx.fillStyle = getDynamicColor(`rgba(255, 170, 0, ${0.3 * alpha})`);
        ctx.lineWidth = 2;
        ctx.shadowColor = dynamicColor;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
    update(deltaTime) {
        if (this.life > 0) this.life -= deltaTime;
    }
}

export function fireBullet(player) {
    if (player.gunCooldown > 0 || player.shieldActive) return;

    const cooldown = player.powerupTimers.rapidFire > 0 ? PLAYER_GUN_COOLDOWN * 5 : PLAYER_GUN_COOLDOWN * 10;

    if (player.powerupTimers.spreadShot > 0) {
        gameState.bullets.push(new Bullet(player, player.a - degToRad(10)));
        gameState.bullets.push(new Bullet(player));
        gameState.bullets.push(new Bullet(player, player.a + degToRad(10)));
    } else {
        gameState.bullets.push(new Bullet(player));
    }
    playShootSound();
    player.gunCooldown = cooldown;
}

export function fireMissileSpread(player, numToFire) {
    if (player.missileCount < numToFire || numToFire <= 0) return;
    player.missileCount -= numToFire;

    let PanningInterval = 2 / (numToFire + 1);
    let currentPan = -1 + PanningInterval;

    if (numToFire === 1) {
        gameState.missiles.push(new Missile(player));
        playMissileLaunchSound();
    } else {
        const totalSpread = (numToFire - 1) * MISSILE_SPREAD_ANGLE_INCREMENT;
        const startAngleOffset = -totalSpread / 2;
        for (let i = 0; i < numToFire; i++) {
            const angleOffset = startAngleOffset + i * MISSILE_SPREAD_ANGLE_INCREMENT;
            gameState.missiles.push(new Missile(player, angleOffset));
            playMissileLaunchSound(currentPan);
            currentPan += PanningInterval;
        }
    }
}