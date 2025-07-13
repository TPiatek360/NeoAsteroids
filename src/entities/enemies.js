// src/entities/enemies.js
// Defines all enemy classes and related logic.

import { gameState } from '../state.js';
import { ctx, canvas, updateGameUI } from '../ui/ui.js';
import { createExplosion, triggerRumble, triggerScreenShake } from '../fx/effects.js';
import { createShockwave } from '../fx/shockwave.js';
import { playEnemyShootSound, playExplosionSound, playMissileLaunchSound, playRocketLaunchSound, playSoundGeneric, playWarpInSound, startChargeSound, stopChargeSound, playChargeLevelUpSound } from '../audio/audio.js';
import { normalizeAngle, distBetweenPoints, degToRad } from '../utils.js';
import { PowerUp } from './environment.js';
import { EnemyBullet, EnemyMissile, Rocket } from './weapons.js';
import {
    DIFFICULTY_SETTINGS,
    FRICTION,
    NEON_ORANGE,
    NEON_CYAN,
    NEON_BLUE,
    CORVETTE_TURN_SPEED,
    MINE_LIFETIME,
    MINE_PROXIMITY_RADIUS,
    MINE_FUSE_TIME,
    NEON_RED,
    MINELAYER_HEALTH,
    MINELAYER_SPEED,
    MINELAYER_AVOID_RADIUS,
    MINELAYER_MINE_COOLDOWN,
    POWERUP_DROP_CHANCE,
    ACE_HEALTH,
    ACE_SHIELD_ENERGY,
    ACE_TURN_SPEED,
    ACE_THRUST,
    ACE_AVOID_RADIUS,
    ACE_SHOOT_COOLDOWN,
    ACE_MISSILE_CHARGE_TIME,
    ACE_MISSILE_COOLDOWN
} from '../constants.js';

function awardScoreToPlayer(amount, playerId) {
    const scoringPlayer = gameState.players.find(p => p.id === playerId);
    if (scoringPlayer) {
        scoringPlayer.score += amount;
    } else { // If no specific player, split score in co-op
        if (gameState.gameMode !== 'twoPlayer' || gameState.twoPlayerMode === 'coop') {
            const livingPlayers = gameState.players.filter(p => p.lives > 0);
            if (livingPlayers.length > 0) {
                const scorePerPlayer = Math.round(amount / livingPlayers.length);
                livingPlayers.forEach(p => p.score += scorePerPlayer);
            }
        }
    }
    updateGameUI();
}

export class EnemyShip {
    constructor() {
        const settings = DIFFICULTY_SETTINGS[gameState.currentDifficulty];
        this.r = 20 / 2;
        if (Math.random() < 0.5) {
            this.x = Math.random() < 0.5 ? 0 - this.r : canvas.width + this.r;
            this.y = Math.random() * canvas.height;
        } else {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() < 0.5 ? 0 - this.r : canvas.height + this.r;
        }
        this.a = Math.random() * Math.PI * 2;
        this.rot = 0;
        this.isThrusting = false;
        this.thrust = { x: 0, y: 0 };
        this.shootCooldown = settings.enemyShootCooldown / 2;
        this.missileCooldown = settings.enemyMissileCooldown;
        this.isDead = false;
        this.isBoss = false;
        this.targetPlayer = null;
    }
    draw() {
        ctx.strokeStyle = NEON_ORANGE;
        ctx.lineWidth = 2;
        ctx.shadowColor = NEON_ORANGE;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(this.x + this.r * Math.cos(this.a), this.y + this.r * Math.sin(this.a));
        ctx.lineTo(this.x - this.r * (Math.cos(this.a) + Math.sin(this.a)), this.y - this.r * (Math.sin(this.a) - Math.cos(this.a)));
        ctx.lineTo(this.x - this.r * (Math.cos(this.a) - Math.sin(this.a)), this.y - this.r * (Math.sin(this.a) + Math.cos(this.a)));
        ctx.closePath();
        ctx.stroke();
        if (this.isThrusting) {
            ctx.fillStyle = NEON_ORANGE;
            ctx.beginPath();
            ctx.moveTo(this.x - this.r * (Math.cos(this.a) * 1.2), this.y - this.r * (Math.sin(this.a) * 1.2));
            ctx.lineTo(this.x - this.r * (Math.cos(this.a) - Math.sin(this.a) * 0.5), this.y - this.r * (Math.sin(this.a) + Math.cos(this.a) * 0.5));
            ctx.lineTo(this.x - this.r * (Math.cos(this.a) + Math.sin(this.a) * -0.5), this.y - this.r * (Math.sin(this.a) - Math.cos(this.a) * -0.5));
            ctx.closePath();
            ctx.fill();
        }
        ctx.shadowBlur = 0;
    }
    update(deltaTime) {
        this.aiLogic();
        const settings = DIFFICULTY_SETTINGS[gameState.currentDifficulty];
        this.a += this.rot;
        if (this.isThrusting) {
            this.thrust.x += settings.enemyThrust * Math.cos(this.a);
            this.thrust.y += settings.enemyThrust * Math.sin(this.a);
        }
        this.thrust.x *= FRICTION;
        this.thrust.y *= FRICTION;
        this.x += this.thrust.x;
        this.y += this.thrust.y;
        this.handleScreenWrap();
        if (this.shootCooldown > 0) this.shootCooldown -= deltaTime;
        if (this.missileCooldown > 0) this.missileCooldown -= deltaTime;
    }
    acquireTarget() {
        let closestPlayer = null;
        let minDist = Infinity;
        for (const p of gameState.players) {
            if (p.lives > 0) {
                const d = distBetweenPoints(this.x, this.y, p.x, p.y);
                if (d < minDist) {
                    minDist = d;
                    closestPlayer = p;
                }
            }
        }
        this.targetPlayer = closestPlayer;
    }
    aiLogic() {
        if (!this.targetPlayer || this.targetPlayer.lives <= 0) {
            this.acquireTarget();
        }
        if (!this.targetPlayer) return;

        const player = this.targetPlayer;
        let closestAsteroidDist = Infinity;
        let evasionTargetAngle = 0;
        let isEvading = false;
        for (const ast of gameState.asteroids) {
            const d = distBetweenPoints(this.x, this.y, ast.x, ast.y);
            if (d < 120 && d < closestAsteroidDist) {
                closestAsteroidDist = d;
                evasionTargetAngle = Math.atan2(this.y - ast.y, this.x - ast.x);
                isEvading = true;
            }
        }
        if (isEvading) {
            this.turnTowards(evasionTargetAngle);
            this.isThrusting = true;
            return;
        }
        const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
        this.turnTowards(angleToPlayer);
        const distToPlayer = distBetweenPoints(this.x, this.y, player.x, player.y);
        this.isThrusting = distToPlayer > 200;
        const angleDifference = Math.abs(normalizeAngle(this.a - angleToPlayer));
        const settings = DIFFICULTY_SETTINGS[gameState.currentDifficulty];
        if (this.missileCooldown <= 0 && angleDifference < degToRad(10) && distToPlayer < canvas.height * 0.75) {
            gameState.enemyMissiles.push(new EnemyMissile(this));
            playMissileLaunchSound();
            this.missileCooldown = settings.enemyMissileCooldown;
        } else if (this.shootCooldown <= 0 && angleDifference < degToRad(15) && distToPlayer < canvas.height / 2) {
            gameState.enemyBullets.push(new EnemyBullet(this));
            playEnemyShootSound();
            this.shootCooldown = settings.enemyShootCooldown;
        }
    }
    turnTowards(targetAngle) {
        const settings = DIFFICULTY_SETTINGS[gameState.currentDifficulty];
        const angleDifference = normalizeAngle(targetAngle - this.a);
        if (Math.abs(angleDifference) > settings.enemyTurnSpeed) {
            this.rot = Math.sign(angleDifference) * settings.enemyTurnSpeed;
        } else {
            this.rot = 0;
            this.a = targetAngle;
        }
    }
    handleScreenWrap() {
        if (this.x < 0 - this.r) this.x = canvas.width + this.r;
        if (this.x > canvas.width + this.r) this.x = 0 - this.r;
        if (this.y < 0 - this.r) this.y = canvas.height + this.r;
        if (this.y > canvas.height + this.r) this.y = 0 - this.r;
    }

    takeDamage(amount, hitX, hitY, isBomb = false, playerId = -1) {
        awardScoreToPlayer(250, playerId);
        if (Math.random() < POWERUP_DROP_CHANCE) {
            gameState.powerUps.push(new PowerUp(this.x, this.y));
        }
        createExplosion(this.x, this.y, NEON_ORANGE, 30, 3.5);
        playExplosionSound(0.6, 0.5);
        triggerRumble(0.6, 0.3, 200);
        this.isDead = true;
    }
}

export class Corvette {
    constructor() {
        const settings = DIFFICULTY_SETTINGS[gameState.currentDifficulty];
        this.w = 80; this.h = 40; this.r = Math.max(this.w, this.h) / 2;
        this.health = settings.corvetteHealth;
        this.turretAngle = 0;
        this.turretShootCooldown = settings.corvetteTurretShootCooldown / 2;
        this.rocketCooldown = 7500;
        this.hitFlashTimer = 0;
        this.scale = 0.1;
        this.spawnTimer = 0;
        this.speed = 0.5;
        this.turnTimer = Math.random() * 5000 + 5000;
        this.isTurning = false;
        this.targetAngle = 0;
        this.isDead = false;
        this.isBoss = true;
        this.targetPlayer = null;

        const edge = Math.floor(Math.random() * 4);
        switch (edge) {
            case 0: this.x = -this.r; this.y = Math.random() * canvas.height; this.a = 0; break;
            case 1: this.x = canvas.width + this.r; this.y = Math.random() * canvas.height; this.a = Math.PI; break;
            case 2: this.x = Math.random() * canvas.width; this.y = -this.r; this.a = Math.PI / 2; break;
            case 3: this.x = Math.random() * canvas.width; this.y = canvas.height + this.r; this.a = -Math.PI / 2; break;
        }
        this.targetAngle = this.a;
        this.xv = 0; this.yv = 0;
        playWarpInSound();
    }
    draw() {
        const settings = DIFFICULTY_SETTINGS[gameState.currentDifficulty];
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.scale, this.scale);
        ctx.rotate(this.a);
        if (this.hitFlashTimer > 0) { ctx.globalCompositeOperation = 'lighter'; }
        ctx.strokeStyle = NEON_ORANGE; ctx.fillStyle = "rgba(100, 50, 0, 0.3)";
        ctx.lineWidth = 3; ctx.shadowColor = NEON_ORANGE; ctx.shadowBlur = 20;
        ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h); ctx.strokeRect(-this.w / 2, -this.h / 2, this.w, this.h);
        ctx.save();
        ctx.rotate(this.turretAngle - this.a);
        ctx.strokeStyle = NEON_CYAN; ctx.fillStyle = "rgba(0, 50, 100, 0.5)";
        ctx.lineWidth = 2; ctx.shadowColor = NEON_CYAN; ctx.shadowBlur = 15;
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(20, 0); ctx.stroke();
        ctx.restore(); ctx.restore(); ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over';
        if (this.health < settings.corvetteHealth) {
            const barW = this.w * this.scale; const barH = 5 * this.scale;
            const barX = this.x - barW / 2; const barY = this.y + (this.h / 2 + 10) * this.scale;
            ctx.fillStyle = "rgba(255, 0, 0, 0.5)"; ctx.fillRect(barX, barY, barW, barH);
            ctx.fillStyle = "rgba(0, 255, 0, 0.7)"; ctx.fillRect(barX, barY, barW * (this.health / settings.corvetteHealth), barH);
        }
    }
    update(deltaTime) {
        if (this.scale < 1) { this.spawnTimer += deltaTime; this.scale = Math.min(1, this.spawnTimer / 1000); }
        this.xv = this.speed * Math.cos(this.a); this.yv = this.speed * Math.sin(this.a);
        this.x += this.xv; this.y += this.yv;
        if (this.scale >= 1) { this.aiLogic(deltaTime); if (this.turretShootCooldown > 0) this.turretShootCooldown -= deltaTime; if (this.rocketCooldown > 0) this.rocketCooldown -= deltaTime; }
        if (this.hitFlashTimer > 0) this.hitFlashTimer--;
        this.handleScreenWrap();
    }
    acquireTarget() {
        let closestPlayer = null; let minDist = Infinity;
        for (const p of gameState.players) { if (p.lives > 0) { const d = distBetweenPoints(this.x, this.y, p.x, p.y); if (d < minDist) { minDist = d; closestPlayer = p; } } }
        this.targetPlayer = closestPlayer;
    }
    aiLogic(deltaTime) {
        if (!this.targetPlayer || this.targetPlayer.lives <= 0) { this.acquireTarget(); }
        if (!this.targetPlayer) return;
        const player = this.targetPlayer;

        const settings = DIFFICULTY_SETTINGS[gameState.currentDifficulty];
        this.turnTimer -= deltaTime;
        if (this.turnTimer <= 0 && !this.isTurning) { this.isTurning = true; this.targetAngle = this.a + (Math.random() - 0.5) * (Math.PI / 2); this.turnTimer = Math.random() * 7000 + 8000; }
        if (this.isTurning) {
            const angleDifference = normalizeAngle(this.targetAngle - this.a);
            if (Math.abs(angleDifference) > CORVETTE_TURN_SPEED) { this.a += Math.sign(angleDifference) * CORVETTE_TURN_SPEED; } else { this.a = this.targetAngle; this.isTurning = false; }
            this.a = normalizeAngle(this.a);
        }
        const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
        const angleDifferenceTurret = normalizeAngle(angleToPlayer - this.turretAngle);
        if (Math.abs(angleDifferenceTurret) > settings.corvetteTurretTurnSpeed) { this.turretAngle += Math.sign(angleDifferenceTurret) * settings.corvetteTurretTurnSpeed; } else { this.turretAngle = angleToPlayer; }
        this.turretAngle = normalizeAngle(this.turretAngle);
        if (this.turretShootCooldown <= 0 && Math.abs(angleDifferenceTurret) < degToRad(5)) {
            gameState.enemyBullets.push(new EnemyBullet({ x: this.x, y: this.y, r: 15 }, this.turretAngle));
            playEnemyShootSound(); this.turretShootCooldown = settings.corvetteTurretShootCooldown;
        }
        if (this.rocketCooldown <= 0) {
            const totalSpread = (5 - 1) * degToRad(8); const startAngleOffset = -totalSpread / 2;
            for (let i = 0; i < 5; i++) { const angleOffset = startAngleOffset + i * degToRad(8); gameState.enemyRockets.push(new Rocket(this.x, this.y, this.a + angleOffset)); }
            playRocketLaunchSound(); this.rocketCooldown = 7500;
        }
    }
    takeDamage(amount, hitX, hitY, isBomb = false, playerId = -1) {
        this.health -= amount;
        this.hitFlashTimer = 5;
        if (this.health <= 0) {
            awardScoreToPlayer(1000, playerId);
            triggerScreenShake(20, 60); triggerRumble(1.0, 1.0, 500);
            playExplosionSound(1.0, 1.2, 3000, 50);
            createExplosion(this.x, this.y, NEON_ORANGE, 150, 7);
            createShockwave(this.x, this.y, 400, NEON_ORANGE, 12, 5);
            gameState.powerUps.push(new PowerUp(this.x, this.y));
            this.isDead = true;
        } else {
            triggerScreenShake(amount * 1.5, 10);
        }
    }
    handleScreenWrap() { const margin = this.r; if (this.x < 0 - margin) this.x = canvas.width + margin; if (this.x > canvas.width + margin) this.x = 0 - margin; if (this.y < 0 - margin) this.y = canvas.height + margin; if (this.y > canvas.height + margin) this.y = 0 - margin; }
}

class CruiserSection {
    constructor(parent, offsetX, offsetY) {
        this.parent = parent; this.offsetX = offsetX; this.offsetY = offsetY;
        this.x = 0; this.y = 0; const settings = DIFFICULTY_SETTINGS[gameState.currentDifficulty];
        this.w = 60; this.h = 50; this.r = Math.max(this.w, this.h) / 2;
        this.maxHealth = settings.cruiserHealth; this.health = this.maxHealth;
        this.isDestroyed = false; this.turretAngle = 0;
        this.turretShootCooldown = settings.corvetteTurretShootCooldown * 1.2;
        this.hitFlashTimer = 0;
    }
    update(deltaTime) {
        const cosA = Math.cos(this.parent.a); const sinA = Math.sin(this.parent.a);
        this.x = this.parent.x + (this.offsetX * cosA - this.offsetY * sinA); this.y = this.parent.y + (this.offsetX * sinA + this.offsetY * cosA);
        if (this.isDestroyed || !this.parent.targetPlayer) return;
        if (this.hitFlashTimer > 0) this.hitFlashTimer--; if (this.turretShootCooldown > 0) this.turretShootCooldown -= deltaTime;
        const settings = DIFFICULTY_SETTINGS[gameState.currentDifficulty];
        const angleToPlayer = Math.atan2(this.parent.targetPlayer.y - this.y, this.parent.targetPlayer.x - this.x);
        const angleDifference = normalizeAngle(angleToPlayer - this.turretAngle);
        if (Math.abs(angleDifference) > settings.corvetteTurretTurnSpeed) { this.turretAngle += Math.sign(angleDifference) * settings.corvetteTurretTurnSpeed; } else { this.turretAngle = angleToPlayer; }
        this.turretAngle = normalizeAngle(this.turretAngle);
        if (this.turretShootCooldown <= 0 && Math.abs(angleDifference) < degToRad(10)) {
            gameState.enemyBullets.push(new EnemyBullet({ x: this.x, y: this.y, r: 15 }, this.turretAngle));
            playEnemyShootSound(); this.turretShootCooldown = settings.corvetteTurretShootCooldown * 1.2 + (Math.random() * 500);
        }
    }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.parent.a);
        if (this.hitFlashTimer > 0) ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = this.isDestroyed ? '#444' : NEON_ORANGE; ctx.fillStyle = this.isDestroyed ? "rgba(20, 10, 0, 0.5)" : "rgba(100, 50, 0, 0.3)";
        ctx.lineWidth = 3; ctx.shadowColor = NEON_ORANGE; ctx.shadowBlur = 20;
        ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h); ctx.strokeRect(-this.w / 2, -this.h / 2, this.w, this.h);
        if (!this.isDestroyed) {
            ctx.save(); ctx.rotate(this.turretAngle - this.parent.a);
            ctx.strokeStyle = NEON_CYAN; ctx.fillStyle = "rgba(0, 50, 100, 0.5)"; ctx.lineWidth = 2;
            ctx.shadowColor = NEON_CYAN; ctx.shadowBlur = 15; ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(18, 0); ctx.stroke(); ctx.restore();
        }
        ctx.restore(); ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over';
        if (!this.isDestroyed) {
            const barW = this.w; const barH = 5; const barX = this.x - barW / 2; const barY = this.y + this.h / 2 + 10;
            ctx.fillStyle = "rgba(255, 0, 0, 0.5)"; ctx.fillRect(barX, barY, barW, barH);
            ctx.fillStyle = "rgba(0, 255, 0, 0.7)"; ctx.fillRect(barX, barY, barW * (this.health / this.maxHealth), barH);
        }
    }
    takeDamage(amount, playerId) {
        if (this.isDestroyed) return;
        this.health -= amount; this.hitFlashTimer = 5;
        if (this.health <= 0) {
            this.health = 0; this.isDestroyed = true;
            this.parent.onSectionDestroyed(this.x, this.y, playerId);
        } else {
            triggerScreenShake(amount, 10); triggerRumble(0.1 * amount, 0.1 * amount, 100);
        }
    }
}

export class Cruiser {
    constructor() {
        this.r = 120; this.speed = 0.3; this.scale = 0.1; this.spawnTimer = 0;
        this.targetAngle = 0; this.isDead = false; this.isBoss = true;
        this.targetPlayer = null;
        
        const edge = Math.floor(Math.random() * 4);
        switch (edge) {
            case 0: this.x = -this.r; this.y = Math.random() * canvas.height; this.a = 0; break;
            case 1: this.x = canvas.width + this.r; this.y = Math.random() * canvas.height; this.a = Math.PI; break;
            case 2: this.x = Math.random() * canvas.width; this.y = -this.r; this.a = Math.PI / 2; break;
            case 3: this.x = Math.random() * canvas.width; this.y = canvas.height + this.r; this.a = -Math.PI / 2; break;
        }
        this.targetAngle = this.a;
        this.sections = [ new CruiserSection(this, 0, 0), new CruiserSection(this, -80, 50), new CruiserSection(this, -80, -50), ];
        this.sectionsRemaining = this.sections.length;
        playWarpInSound();
    }
    update(deltaTime) {
        if (this.scale < 1) { this.spawnTimer += deltaTime; this.scale = Math.min(1, this.spawnTimer / 2000); }
        this.aiLogic(); this.x += this.speed * Math.cos(this.a); this.y += this.speed * Math.sin(this.a);
        this.sections.forEach(s => s.update(deltaTime));
    }
    acquireTarget() {
        let closestPlayer = null; let minDist = Infinity;
        for (const p of gameState.players) { if (p.lives > 0) { const d = distBetweenPoints(this.x, this.y, p.x, p.y); if (d < minDist) { minDist = d; closestPlayer = p; } } }
        this.targetPlayer = closestPlayer;
    }
    aiLogic() {
        if (!this.targetPlayer || this.targetPlayer.lives <= 0) { this.acquireTarget(); }
        if (!this.targetPlayer) return;
        const player = this.targetPlayer;

        const margin = 150; const idealDist = 400; const tooCloseDist = 250;
        let isOutOfBounds = this.x < margin || this.x > canvas.width - margin || this.y < margin || this.y > canvas.height - margin;
        if (isOutOfBounds) { const angleToCenter = Math.atan2(canvas.height / 2 - this.y, canvas.width / 2 - this.x); this.targetAngle = angleToCenter; } 
        else {
            const distToPlayer = distBetweenPoints(this.x, this.y, player.x, player.y);
            const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
            if (distToPlayer < tooCloseDist) this.targetAngle = angleToPlayer + Math.PI;
            else if (distToPlayer > idealDist) this.targetAngle = angleToPlayer;
            else this.targetAngle = angleToPlayer + Math.PI / 2;
        }
        const angleDifference = normalizeAngle(this.targetAngle - this.a); const turnSpeed = CORVETTE_TURN_SPEED * 0.4;
        if (Math.abs(angleDifference) > turnSpeed) this.a += Math.sign(angleDifference) * turnSpeed;
        else this.a = this.targetAngle;
        this.a = normalizeAngle(this.a);
    }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y); ctx.scale(this.scale, this.scale);
        ctx.strokeStyle = '#666'; ctx.lineWidth = 10; ctx.shadowColor = NEON_ORANGE; ctx.shadowBlur = 15;
        ctx.beginPath();
        const center = this.sections[0]; const wing1 = this.sections[1]; const wing2 = this.sections[2];
        const cosA = Math.cos(this.a); const sinA = Math.sin(this.a);
        ctx.moveTo((center.offsetX * cosA - center.offsetY * sinA), (center.offsetX * sinA + center.offsetY * cosA));
        ctx.lineTo((wing1.offsetX * cosA - wing1.offsetY * sinA), (wing1.offsetX * sinA + wing1.offsetY * cosA));
        ctx.moveTo((center.offsetX * cosA - center.offsetY * sinA), (center.offsetX * sinA + center.offsetY * cosA));
        ctx.lineTo((wing2.offsetX * cosA - wing2.offsetY * sinA), (wing2.offsetX * sinA + wing2.offsetY * cosA));
        ctx.stroke(); ctx.restore();
        this.sections.forEach(s => s.draw());
    }
    takeDamage(amount, hitX, hitY, isBomb = false, playerId = -1) {
        let closestSection = null; let minDistance = Infinity;
        for(const section of this.sections) {
            if (!section.isDestroyed) { const d = distBetweenPoints(hitX, hitY, section.x, section.y); if (d < minDistance) { minDistance = d; closestSection = section; } }
        }
        if (closestSection && (isBomb || minDistance < closestSection.r)) { closestSection.takeDamage(amount, playerId); return true; }
        return false;
    }
    checkCollision(targetX, targetY, targetR) {
        for(const section of this.sections) {
            if (!section.isDestroyed) { if (distBetweenPoints(targetX, targetY, section.x, section.y) < targetR + section.r) { return true; } }
        }
        return false;
    }
    onSectionDestroyed(x, y, playerId) {
        this.sectionsRemaining--;
        awardScoreToPlayer(500, playerId);
        triggerRumble(0.8, 0.8, 250); playExplosionSound(0.8, 0.6, 2000, 150);
        createExplosion(x, y, NEON_ORANGE, 50, 4); createShockwave(x, y, 150, NEON_ORANGE, 5, 2);
        if (this.sectionsRemaining <= 0) { this.handleFinalDeath(playerId); }
    }
    handleFinalDeath(playerId) {
        awardScoreToPlayer(5000, playerId);
        triggerScreenShake(40, 120); triggerRumble(1.0, 1.0, 1500);
        playExplosionSound(1.0, 2.0, 4000, 50);
        createExplosion(this.x, this.y, NEON_ORANGE, 250, 8);
        createShockwave(this.x, this.y, 600, NEON_ORANGE, 15, 8);
        gameState.powerUps.push(new PowerUp(this.x, this.y));
        gameState.powerUps.push(new PowerUp(this.x + 40, this.y + 40));
        gameState.powerUps.push(new PowerUp(this.x - 40, this.y - 40));
        this.isDead = true;
    }
}

export class Mine {
    constructor(x, y, ownerId = -1) { // Mines can be owned by players
        this.x = x; this.y = y; this.r = 8;
        this.life = MINE_LIFETIME; this.isTriggered = false;
        this.fuseTimer = MINE_FUSE_TIME; this.pulse = Math.random() * Math.PI * 2;
        this.ownerId = ownerId;
    }
    update(deltaTime) {
        this.life -= deltaTime;
        if (!this.isTriggered) {
            for (const player of gameState.players) {
                if (player.lives > 0 && distBetweenPoints(this.x, this.y, player.x, player.y) < MINE_PROXIMITY_RADIUS) {
                    this.isTriggered = true; playSoundGeneric('sine', 440, 880, 0.2, 0.2);
                    break;
                }
            }
        }
        if (this.isTriggered) { this.fuseTimer -= deltaTime; }
        this.pulse += 0.1;
    }
    draw() {
        ctx.save(); ctx.strokeStyle = NEON_RED; ctx.fillStyle = `rgba(255, 0, 0, 0.2)`;
        ctx.shadowColor = NEON_RED; ctx.shadowBlur = 15; ctx.lineWidth = 1.5;
        let r = this.r; if (this.isTriggered) { const flash = Math.sin(this.fuseTimer * 0.02) > 0; if (flash) { r *= 1.5; ctx.shadowBlur = 25; } }
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + this.pulse * 0.2;
            const radius = i % 2 === 0 ? r : r * 0.6;
            ctx.lineTo(this.x + Math.cos(angle) * radius, this.y + Math.sin(angle) * radius);
        }
        ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
    }
}

export class Minelayer {
    constructor() {
        this.r = 25; this.health = MINELAYER_HEALTH; this.speed = MINELAYER_SPEED;
        this.mineCooldown = MINELAYER_MINE_COOLDOWN / 2;
        this.hitFlashTimer = 0; this.isDead = false; this.isBoss = false;
        const edge = Math.floor(Math.random() * 4); const margin = 50;
        switch (edge) {
            case 0: this.x = -this.r; this.y = Math.random() * canvas.height; this.targetX = canvas.width + margin; this.targetY = Math.random() * canvas.height; break;
            case 1: this.x = canvas.width + this.r; this.y = Math.random() * canvas.height; this.targetX = -margin; this.targetY = Math.random() * canvas.height; break;
            case 2: this.x = Math.random() * canvas.width; this.y = -this.r; this.targetX = Math.random() * canvas.width; this.targetY = canvas.height + margin; break;
            case 3: this.x = Math.random() * canvas.width; this.y = canvas.height + this.r; this.targetX = Math.random() * canvas.width; this.targetY = -margin; break;
        }
        this.a = Math.atan2(this.targetY - this.y, this.targetX - this.x);
    }
    update(deltaTime) {
        // AI simplified to not target a specific player, just flees from the nearest
        let closestPlayer = null; let minDist = Infinity;
        for (const p of gameState.players) { if (p.lives > 0) { const d = distBetweenPoints(this.x, this.y, p.x, p.y); if (d < minDist) { minDist = d; closestPlayer = p; } } }
        if (closestPlayer && distBetweenPoints(this.x, this.y, closestPlayer.x, closestPlayer.y) < MINELAYER_AVOID_RADIUS) {
            const angleFromPlayer = Math.atan2(this.y - closestPlayer.y, this.x - closestPlayer.x);
            this.a = normalizeAngle(angleFromPlayer * 0.05 + this.a * 0.95);
        } else {
            const angleToTarget = Math.atan2(this.targetY - this.y, this.targetX - this.x);
            const angleDiff = normalizeAngle(angleToTarget - this.a); this.a += angleDiff * 0.02;
        }
        this.x += this.speed * Math.cos(this.a); this.y += this.speed * Math.sin(this.a);
        this.mineCooldown -= deltaTime;
        if (this.mineCooldown <= 0) { gameState.mines.push(new Mine(this.x, this.y)); playSoundGeneric('square', 200, 150, 0.1, 0.3); this.mineCooldown = MINELAYER_MINE_COOLDOWN + Math.random() * 1000; }
        if (this.hitFlashTimer > 0) this.hitFlashTimer--;
        const offscreenMargin = 100;
        if (this.x < -offscreenMargin || this.x > canvas.width + offscreenMargin || this.y < -offscreenMargin || this.y > canvas.height + offscreenMargin) { this.isDead = true; }
    }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.a);
        if (this.hitFlashTimer > 0) { ctx.globalCompositeOperation = 'lighter'; }
        ctx.strokeStyle = NEON_ORANGE; ctx.fillStyle = "rgba(100, 50, 0, 0.5)";
        ctx.lineWidth = 2; ctx.shadowColor = NEON_ORANGE; ctx.shadowBlur = 15;
        ctx.beginPath(); ctx.moveTo(this.r, 0); ctx.lineTo(0, -this.r * 0.6);
        ctx.lineTo(-this.r * 0.8, 0); ctx.lineTo(0, this.r * 0.6); ctx.closePath();
        ctx.fill(); ctx.stroke(); ctx.restore(); ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'source-over';
    }
    takeDamage(amount, hitX, hitY, isBomb = false, playerId = -1) {
        this.health -= amount; this.hitFlashTimer = 5;
        if (this.health <= 0) {
            awardScoreToPlayer(400, playerId);
            triggerRumble(0.5, 0.5, 200); playExplosionSound(0.7, 0.5);
            createExplosion(this.x, this.y, NEON_ORANGE, 40, 3);
            if (Math.random() < 0.5) gameState.powerUps.push(new PowerUp(this.x, this.y));
            this.isDead = true;
        } else {
            triggerRumble(0.2 * amount, 0.1 * amount, 100);
        }
    }
}

export class Ace extends EnemyShip {
    constructor() {
        super();
        this.r = 12; this.health = ACE_HEALTH;
        this.shieldEnergy = ACE_SHIELD_ENERGY; this.shieldActive = false;
        this.shootCooldown = ACE_SHOOT_COOLDOWN; this.missileCooldown = ACE_MISSILE_COOLDOWN;
        this.isChargingMissile = false; this.missileChargeProgress = 0; this.hitFlashTimer = 0;
    }
    draw() {
        if (this.isChargingMissile) { const glowSize = this.r * (1 + this.missileChargeProgress * 1.5); ctx.fillStyle = `rgba(255, 0, 255, ${0.1 + this.missileChargeProgress * 0.3})`; ctx.shadowColor = NEON_PINK; ctx.shadowBlur = 20; ctx.beginPath(); ctx.arc(this.x, this.y, glowSize, 0, Math.PI * 2); ctx.fill(); }
        ctx.save(); if (this.hitFlashTimer > 0) ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = NEON_ORANGE; ctx.lineWidth = 2; ctx.shadowColor = NEON_ORANGE; ctx.shadowBlur = 15;
        ctx.beginPath(); ctx.moveTo(this.x + this.r * 1.5 * Math.cos(this.a), this.y + this.r * 1.5 * Math.sin(this.a));
        ctx.lineTo(this.x + this.r * Math.cos(this.a + Math.PI * 0.75), this.y + this.r * Math.sin(this.a + Math.PI * 0.75));
        ctx.lineTo(this.x + this.r * 0.5 * Math.cos(this.a + Math.PI), this.y + this.r * 0.5 * Math.sin(this.a + Math.PI));
        ctx.lineTo(this.x + this.r * Math.cos(this.a - Math.PI * 0.75), this.y + this.r * Math.sin(this.a - Math.PI * 0.75));
        ctx.closePath(); ctx.stroke();
        ctx.strokeStyle = NEON_CYAN; ctx.lineWidth = 1; ctx.beginPath();
        ctx.moveTo(this.x + this.r * 0.8 * Math.cos(this.a), this.y + this.r * 0.8 * Math.sin(this.a));
        ctx.lineTo(this.x + this.r * 0.5 * Math.cos(this.a + Math.PI), this.y + this.r * 0.5 * Math.sin(this.a + Math.PI));
        ctx.stroke(); ctx.restore();
        if (this.shieldActive) { ctx.fillStyle = `rgba(0, 170, 255, 0.2)`; ctx.strokeStyle = NEON_BLUE; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 1.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    }
    update(deltaTime) {
        this.aiLogic(deltaTime); this.a += this.rot;
        if (this.isThrusting) { this.thrust.x += ACE_THRUST * Math.cos(this.a); this.thrust.y += ACE_THRUST * Math.sin(this.a); }
        this.thrust.x *= FRICTION; this.thrust.y *= FRICTION;
        this.x += this.thrust.x; this.y += this.thrust.y;
        this.handleScreenWrap();
        if (this.shootCooldown > 0) this.shootCooldown -= deltaTime;
        if (this.missileCooldown > 0) this.missileCooldown -= deltaTime;
        if (this.hitFlashTimer > 0) this.hitFlashTimer--;
        if (this.isChargingMissile) {
            this.missileChargeProgress += deltaTime / ACE_MISSILE_CHARGE_TIME;
            if (this.missileChargeProgress >= 1.0) { this.fireMissileSpread(); this.isChargingMissile = false; this.missileChargeProgress = 0; this.missileCooldown = ACE_MISSILE_COOLDOWN; }
        }
    }
    aiLogic() {
        if (!this.targetPlayer || this.targetPlayer.lives <= 0) { this.acquireTarget(); }
        if (!this.targetPlayer) return;
        const player = this.targetPlayer;

        const shouldHaveShieldsUp = (this.health / ACE_HEALTH < 0.5) || gameState.missiles.some(m => distBetweenPoints(this.x, this.y, m.x, m.y) < 100);
        this.shieldActive = shouldHaveShieldsUp && this.shieldEnergy > 0;
        let isEvading = false;
        for (const ast of gameState.asteroids) {
            if (distBetweenPoints(this.x, this.y, ast.x, ast.y) < ACE_AVOID_RADIUS) {
                const evasionTargetAngle = Math.atan2(this.y - ast.y, this.x - ast.x);
                this.turnTowards(evasionTargetAngle, ACE_TURN_SPEED * 1.5); this.isThrusting = true; isEvading = true; break;
            }
        }
        if (isEvading) { if (this.isChargingMissile) this.isChargingMissile = false; return; }
        const distToPlayer = distBetweenPoints(this.x, this.y, player.x, player.y);
        const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
        const angleDifference = Math.abs(normalizeAngle(this.a - angleToPlayer));
        if (!this.isChargingMissile && this.missileCooldown <= 0 && distToPlayer > 250 && distToPlayer < 600 && angleDifference < degToRad(15)) { this.isChargingMissile = true; this.missileChargeProgress = 0; }
        if (!this.isChargingMissile && this.shootCooldown <= 0 && angleDifference < degToRad(10) && distToPlayer < 400) { gameState.enemyBullets.push(new EnemyBullet(this)); playEnemyShootSound(); this.shootCooldown = ACE_SHOOT_COOLDOWN; }
        if (this.isChargingMissile) { this.turnTowards(angleToPlayer, ACE_TURN_SPEED * 0.5); this.isThrusting = false; } 
        else { const targetAngle = angleToPlayer + Math.PI / 2; this.turnTowards(targetAngle, ACE_TURN_SPEED); this.isThrusting = distToPlayer > 300; }
    }
    fireMissileSpread() {
        playChargeLevelUpSound(); const numToFire = 2; const totalSpread = (numToFire - 1) * degToRad(15);
        const startAngleOffset = -totalSpread / 2;
        for (let i = 0; i < numToFire; i++) {
            const angleOffset = startAngleOffset + i * degToRad(15);
            const missile = new EnemyMissile(this);
            missile.a = normalizeAngle(this.a + angleOffset);
            gameState.enemyMissiles.push(missile);
        }
    }
    turnTowards(targetAngle, speed = ACE_TURN_SPEED) {
        const angleDifference = normalizeAngle(targetAngle - this.a);
        if (Math.abs(angleDifference) > speed) { this.rot = Math.sign(angleDifference) * speed; } else { this.rot = 0; this.a = targetAngle; }
    }
    takeDamage(amount, hitX, hitY, isBomb = false, playerId = -1) {
        this.hitFlashTimer = 5;
        if (this.shieldActive) { this.shieldEnergy -= amount; if (this.shieldEnergy < 0) this.shieldActive = false; return; }
        this.health -= amount;
        if (this.health <= 0) {
            awardScoreToPlayer(500, playerId);
            createExplosion(this.x, this.y, NEON_ORANGE, 40, 4); playExplosionSound(0.7, 0.6);
            triggerRumble(0.7, 0.4, 250); this.isDead = true;
        }
    }
}