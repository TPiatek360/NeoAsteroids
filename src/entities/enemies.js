// src/entities/enemies.js
// Defines all enemy classes and related logic.

import { gameState } from '../state.js';
import { ctx, canvas } from '../ui/ui.js';
import { createExplosion, triggerRumble, triggerScreenShake } from '../fx/effects.js';
import { createShockwave } from '../fx/shockwave.js';
import { playEnemyShootSound, playMissileLaunchSound, playRocketLaunchSound, playSoundGeneric, playWarpInSound, playChargeLevelUpSound } from '../audio/audio.js';
import { normalizeAngle, distBetweenPoints, degToRad } from '../utils.js';
import { eventBus } from '../systems/EventBus.js';
import { PowerUp } from './environment.js';
import { EnemyBullet, EnemyMissile, Rocket } from './weapons.js';
import {
    DIFFICULTY_SETTINGS, FRICTION, NEON_ORANGE, NEON_CYAN, NEON_BLUE, CORVETTE_TURN_SPEED, MINE_LIFETIME, MINE_PROXIMITY_RADIUS,
    MINE_FUSE_TIME, NEON_RED, MINELAYER_HEALTH, MINELAYER_SPEED, MINELAYER_AVOID_RADIUS, MINELAYER_MINE_COOLDOWN, POWERUP_DROP_CHANCE,
    ACE_HEALTH, ACE_SHIELD_ENERGY, ACE_TURN_SPEED, ACE_THRUST, ACE_AVOID_RADIUS, ACE_SHOOT_COOLDOWN, ACE_MISSILE_CHARGE_TIME, ACE_MISSILE_COOLDOWN, NEON_PINK
} from '../constants.js';

export class EnemyShip {
    constructor() {
        const settings = DIFFICULTY_SETTINGS[gameState.currentDifficulty];
        this.r = 10;
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
        this.shootCooldown = settings.enemyShootCooldown / 2 + Math.random() * 500;
        this.missileCooldown = settings.enemyMissileCooldown + Math.random() * 2000;
        this.isDead = false;
        this.isBoss = false;
        this.targetPlayer = null;

        // State machine
        this.state = 'ATTACKING';
        this.evasionTarget = null;
    }
    draw() {
        ctx.strokeStyle = NEON_ORANGE; ctx.lineWidth = 2; ctx.shadowColor = NEON_ORANGE; ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(this.x + this.r * Math.cos(this.a), this.y + this.r * Math.sin(this.a));
        ctx.lineTo(this.x - this.r * (Math.cos(this.a) + Math.sin(this.a)), this.y - this.r * (Math.sin(this.a) - Math.cos(this.a)));
        ctx.lineTo(this.x - this.r * (Math.cos(this.a) - Math.sin(this.a)), this.y - this.r * (Math.sin(this.a) + Math.cos(this.a)));
        ctx.closePath(); ctx.stroke();
        if (this.isThrusting) {
            ctx.fillStyle = NEON_ORANGE; ctx.beginPath();
            ctx.moveTo(this.x - this.r * (Math.cos(this.a) * 1.2), this.y - this.r * (Math.sin(this.a) * 1.2));
            ctx.lineTo(this.x - this.r * (Math.cos(this.a) - Math.sin(this.a) * 0.5), this.y - this.r * (Math.sin(this.a) + Math.cos(this.a) * 0.5));
            ctx.lineTo(this.x - this.r * (Math.cos(this.a) + Math.sin(this.a) * -0.5), this.y - this.r * (Math.sin(this.a) - Math.cos(this.a) * -0.5));
            ctx.closePath(); ctx.fill();
        }
        ctx.shadowBlur = 0;
    }
    update(deltaTime) {
        if (!this.targetPlayer || this.targetPlayer.lives <= 0) { this.acquireTarget(); }

        this.updateStateTransitions();
        this.executeCurrentState(deltaTime);

        // Physics and cooldowns
        this.a += this.rot;
        if (this.isThrusting) {
            const settings = DIFFICULTY_SETTINGS[gameState.currentDifficulty];
            this.thrust.x += settings.enemyThrust * Math.cos(this.a);
            this.thrust.y += settings.enemyThrust * Math.sin(this.a);
        }
        this.thrust.x *= FRICTION; this.thrust.y *= FRICTION;
        this.x += this.thrust.x; this.y += this.thrust.y;
        this.handleScreenWrap();
        if (this.shootCooldown > 0) this.shootCooldown -= deltaTime;
        if (this.missileCooldown > 0) this.missileCooldown -= deltaTime;
    }
    updateStateTransitions() {
        this.evasionTarget = null;
        for (const ast of gameState.asteroids) {
            const d = distBetweenPoints(this.x, this.y, ast.x, ast.y);
            if (d < 120) {
                this.state = 'EVADING';
                this.evasionTarget = ast;
                return; // Evasion takes priority
            }
        }
        // If no evasion is needed, go back to attacking
        this.state = 'ATTACKING';
    }
    executeCurrentState(deltaTime) {
        switch (this.state) {
            case 'EVADING':
                this.executeEvadingState(deltaTime);
                break;
            case 'ATTACKING':
                this.executeAttackingState(deltaTime);
                break;
        }
    }
    executeEvadingState(deltaTime) {
        if (!this.evasionTarget) return; // Should not happen if transitions are correct
        const evasionTargetAngle = Math.atan2(this.y - this.evasionTarget.y, this.x - this.evasionTarget.x);
        this.turnTowards(evasionTargetAngle);
        this.isThrusting = true;
    }
    executeAttackingState(deltaTime) {
        if (!this.targetPlayer) {
            this.isThrusting = false;
            return;
        }
        const player = this.targetPlayer;
        const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
        this.turnTowards(angleToPlayer);

        const distToPlayer = distBetweenPoints(this.x, this.y, player.x, player.y);
        this.isThrusting = distToPlayer > 200;

        const angleDifference = Math.abs(normalizeAngle(this.a - angleToPlayer));
        const settings = DIFFICULTY_SETTINGS[gameState.currentDifficulty];
        if (this.missileCooldown <= 0 && angleDifference < degToRad(10) && distToPlayer < canvas.height * 0.75) {
            gameState.enemyMissiles.push(new EnemyMissile(this));
            playMissileLaunchSound();
            this.missileCooldown = settings.enemyMissileCooldown + Math.random() * 2000;
        } else if (this.shootCooldown <= 0 && angleDifference < degToRad(15) && distToPlayer < canvas.height / 2) {
            gameState.enemyBullets.push(new EnemyBullet(this));
            playEnemyShootSound();
            this.shootCooldown = settings.enemyShootCooldown + Math.random() * 500;
        }
    }
    acquireTarget() {
        let closestPlayer = null; let minDist = Infinity;
        for (const p of gameState.players) {
            if (p.lives > 0) { const d = distBetweenPoints(this.x, this.y, p.x, p.y); if (d < minDist) { minDist = d; closestPlayer = p; } }
        }
        this.targetPlayer = closestPlayer;
    }
    turnTowards(targetAngle) {
        const settings = DIFFICULTY_SETTINGS[gameState.currentDifficulty];
        const angleDifference = normalizeAngle(targetAngle - this.a);
        if (Math.abs(angleDifference) > settings.enemyTurnSpeed) { this.rot = Math.sign(angleDifference) * settings.enemyTurnSpeed; }
        else { this.rot = 0; this.a = targetAngle; }
    }
    handleScreenWrap() { if (this.x < 0 - this.r) this.x = canvas.width + this.r; if (this.x > canvas.width + this.r) this.x = 0 - this.r; if (this.y < 0 - this.r) this.y = canvas.height + this.r; if (this.y > canvas.height + this.r) this.y = 0 - this.r; }
    takeDamage(amount, hitX, hitY, isBomb = false, playerId = -1) {
        if (distBetweenPoints(this.x, this.y, hitX, hitY) > this.r && !isBomb) return false;
        eventBus.dispatch('enemy_destroyed', { enemy: this, playerId: playerId, x: this.x, y: this.y });
        if (Math.random() < POWERUP_DROP_CHANCE) { gameState.powerUps.push(new PowerUp(this.x, this.y)); }
        this.isDead = true;
        return true;
    }
    checkCollision(targetX, targetY, targetR) { return distBetweenPoints(this.x, this.y, targetX, targetY) < this.r + targetR; }
}

export class Corvette {
    constructor() {
        const settings = DIFFICULTY_SETTINGS[gameState.currentDifficulty];
        this.w = 80; this.h = 40; this.r = Math.max(this.w, this.h) / 2; this.health = settings.corvetteHealth;
        this.turretAngle = 0; this.turretShootCooldown = settings.corvetteTurretShootCooldown / 2;
        this.rocketCooldown = 7500; this.hitFlashTimer = 0;
        this.speed = 0.5; this.isDead = false; this.isBoss = true; this.targetPlayer = null;
        const edge = Math.floor(Math.random() * 4);
        switch (edge) {
            case 0: this.x = -this.r; this.y = Math.random() * canvas.height; this.a = 0; break;
            case 1: this.x = canvas.width + this.r; this.y = Math.random() * canvas.height; this.a = Math.PI; break;
            case 2: this.x = Math.random() * canvas.width; this.y = -this.r; this.a = Math.PI / 2; break;
            case 3: this.x = Math.random() * canvas.width; this.y = canvas.height + this.r; this.a = -Math.PI / 2; break;
        }
        this.targetAngle = this.a; this.xv = 0; this.yv = 0;
        
        // State machine
        this.state = 'SPAWNING';
        this.spawnTimer = 0; this.scale = 0.1;
        this.turnTimer = Math.random() * 5000 + 5000; this.isTurning = false;
        
        playWarpInSound();
    }
    draw() {
        const settings = DIFFICULTY_SETTINGS[gameState.currentDifficulty];
        ctx.save(); ctx.translate(this.x, this.y); ctx.scale(this.scale, this.scale); ctx.rotate(this.a);
        if (this.hitFlashTimer > 0) { ctx.globalCompositeOperation = 'lighter'; }
        ctx.strokeStyle = NEON_ORANGE; ctx.fillStyle = "rgba(100, 50, 0, 0.3)"; ctx.lineWidth = 3; ctx.shadowColor = NEON_ORANGE; ctx.shadowBlur = 20;
        ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h); ctx.strokeRect(-this.w / 2, -this.h / 2, this.w, this.h);
        ctx.save(); ctx.rotate(this.turretAngle - this.a);
        ctx.strokeStyle = NEON_CYAN; ctx.fillStyle = "rgba(0, 50, 100, 0.5)"; ctx.lineWidth = 2; ctx.shadowColor = NEON_CYAN; ctx.shadowBlur = 15;
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(20, 0); ctx.stroke(); ctx.restore(); ctx.restore();
        ctx.globalCompositeOperation = 'source-over';
        if (this.health < settings.corvetteHealth) {
            const barW = this.w * this.scale; const barH = 5 * this.scale; const barX = this.x - barW / 2; const barY = this.y + (this.h / 2 + 10) * this.scale;
            ctx.fillStyle = "rgba(255, 0, 0, 0.5)"; ctx.fillRect(barX, barY, barW, barH);
            ctx.fillStyle = "rgba(0, 255, 0, 0.7)"; ctx.fillRect(barX, barY, barW * (this.health / settings.corvetteHealth), barH);
        }
    }
    update(deltaTime) {
        if (!this.targetPlayer || this.targetPlayer.lives <= 0) { this.acquireTarget(); }
        
        this.updateStateTransitions(deltaTime);
        this.executeCurrentState(deltaTime);

        // Physics and general updates
        this.xv = this.speed * Math.cos(this.a); this.yv = this.speed * Math.sin(this.a);
        this.x += this.xv; this.y += this.yv;
        if (this.hitFlashTimer > 0) this.hitFlashTimer--;
        this.handleScreenWrap();
    }
    updateStateTransitions(deltaTime) {
        if (this.state === 'SPAWNING' && this.scale >= 1) {
            this.state = 'PATROLLING';
        }
    }
    executeCurrentState(deltaTime) {
        switch (this.state) {
            case 'SPAWNING':
                this.executeSpawningState(deltaTime);
                break;
            case 'PATROLLING':
                this.executePatrollingState(deltaTime);
                break;
        }
    }
    executeSpawningState(deltaTime) {
        this.spawnTimer += deltaTime;
        this.scale = Math.min(1, this.spawnTimer / 1000);
    }
    executePatrollingState(deltaTime) {
        if (this.turretShootCooldown > 0) this.turretShootCooldown -= deltaTime;
        if (this.rocketCooldown > 0) this.rocketCooldown -= deltaTime;
        
        // AI logic for movement and combat
        if (!this.targetPlayer) return;

        const player = this.targetPlayer;
        const settings = DIFFICULTY_SETTINGS[gameState.currentDifficulty];
        this.turnTimer -= deltaTime;
        if (this.turnTimer <= 0 && !this.isTurning) {
            this.isTurning = true;
            this.targetAngle = this.a + (Math.random() - 0.5) * (Math.PI / 2);
            this.turnTimer = Math.random() * 7000 + 8000;
        }
        if (this.isTurning) {
            const angleDifference = normalizeAngle(this.targetAngle - this.a);
            if (Math.abs(angleDifference) > CORVETTE_TURN_SPEED) { this.a += Math.sign(angleDifference) * CORVETTE_TURN_SPEED; }
            else { this.a = this.targetAngle; this.isTurning = false; }
            this.a = normalizeAngle(this.a);
        }

        const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
        const angleDifferenceTurret = normalizeAngle(angleToPlayer - this.turretAngle);
        if (Math.abs(angleDifferenceTurret) > settings.corvetteTurretTurnSpeed) { this.turretAngle += Math.sign(angleDifferenceTurret) * settings.corvetteTurretTurnSpeed; }
        else { this.turretAngle = angleToPlayer; }
        this.turretAngle = normalizeAngle(this.turretAngle);
        
        if (this.turretShootCooldown <= 0 && Math.abs(angleDifferenceTurret) < degToRad(5)) {
            gameState.enemyBullets.push(new EnemyBullet({ x: this.x, y: this.y, r: 15 }, this.turretAngle));
            playEnemyShootSound();
            this.turretShootCooldown = settings.corvetteTurretShootCooldown;
        }
        if (this.rocketCooldown <= 0) {
            const totalSpread = (5 - 1) * degToRad(8); const startAngleOffset = -totalSpread / 2;
            for (let i = 0; i < 5; i++) {
                const angleOffset = startAngleOffset + i * degToRad(8);
                gameState.enemyRockets.push(new Rocket(this.x, this.y, this.a + angleOffset));
            }
            playRocketLaunchSound();
            this.rocketCooldown = 7500;
        }
    }
    acquireTarget() {
        let closestPlayer = null; let minDist = Infinity;
        for (const p of gameState.players) { if (p.lives > 0) { const d = distBetweenPoints(this.x, this.y, p.x, p.y); if (d < minDist) { minDist = d; closestPlayer = p; } } }
        this.targetPlayer = closestPlayer;
    }
    takeDamage(amount, hitX, hitY, isBomb = false, playerId = -1) {
        if (distBetweenPoints(this.x, this.y, hitX, hitY) > this.r && !isBomb) return false;
        this.health -= amount; this.hitFlashTimer = 5;
        if (this.health <= 0) {
            eventBus.dispatch('enemy_destroyed', { enemy: this, playerId: playerId, x: this.x, y: this.y });
            triggerScreenShake(20, 60); createShockwave(this.x, this.y, 400, NEON_ORANGE, 12, 5);
            gameState.powerUps.push(new PowerUp(this.x, this.y));
            this.isDead = true;
        } else {
            triggerScreenShake(amount * 1.5, 10);
        }
        return true;
    }
    handleScreenWrap() { const margin = this.r; if (this.x < 0 - margin) this.x = canvas.width + margin; if (this.x > canvas.width + margin) this.x = 0 - margin; if (this.y < 0 - margin) this.y = canvas.height + margin; if (this.y > canvas.height + margin) this.y = 0 - margin; }
    checkCollision(targetX, targetY, targetR) { return distBetweenPoints(this.x, this.y, targetX, targetY) < this.r + targetR; }
}

class CruiserSection {
    constructor(parent, offsetX, offsetY) {
        this.parent = parent; this.offsetX = offsetX; this.offsetY = offsetY; this.x = 0; this.y = 0;
        const settings = DIFFICULTY_SETTINGS[gameState.currentDifficulty];
        this.w = 60; this.h = 50; this.r = Math.max(this.w, this.h) / 2;
        this.maxHealth = settings.cruiserHealth; this.health = this.maxHealth;
        this.isDestroyed = false; this.turretAngle = 0; this.turretShootCooldown = settings.corvetteTurretShootCooldown * 1.2; this.hitFlashTimer = 0;
    }
    update(deltaTime) {
        const cosA = Math.cos(this.parent.a); const sinA = Math.sin(this.parent.a);
        this.x = this.parent.x + (this.offsetX * cosA - this.offsetY * sinA); this.y = this.parent.y + (this.offsetX * sinA + this.offsetY * cosA);
        if (this.isDestroyed || !this.parent.targetPlayer || this.parent.scale < 1) return;
        if (this.hitFlashTimer > 0) this.hitFlashTimer--; if (this.turretShootCooldown > 0) this.turretShootCooldown -= deltaTime;
        const settings = DIFFICULTY_SETTINGS[gameState.currentDifficulty];
        const angleToPlayer = Math.atan2(this.parent.targetPlayer.y - this.y, this.parent.targetPlayer.x - this.x);
        const angleDifference = normalizeAngle(angleToPlayer - this.turretAngle);
        if (Math.abs(angleDifference) > settings.corvetteTurretTurnSpeed) { this.turretAngle += Math.sign(angleDifference) * settings.corvetteTurretTurnSpeed; } else { this.turretAngle = angleToPlayer; }
        this.turretAngle = normalizeAngle(this.turretAngle);
        if (this.turretShootCooldown <= 0 && Math.abs(angleDifference) < degToRad(10)) {
            gameState.enemyBullets.push(new EnemyBullet({ x: this.x, y: this.y, r: 15 }, this.turretAngle)); playEnemyShootSound(); this.turretShootCooldown = settings.corvetteTurretShootCooldown * 1.2 + (Math.random() * 500);
        }
    }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.parent.a); ctx.scale(this.parent.scale, this.parent.scale);
        if (this.hitFlashTimer > 0) ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = this.isDestroyed ? '#444' : NEON_ORANGE; ctx.fillStyle = this.isDestroyed ? "rgba(20, 10, 0, 0.5)" : "rgba(100, 50, 0, 0.3)";
        ctx.lineWidth = 3; ctx.shadowColor = NEON_ORANGE; ctx.shadowBlur = 20;
        ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h); ctx.strokeRect(-this.w / 2, -this.h / 2, this.w, this.h);
        if (!this.isDestroyed) {
            ctx.save(); ctx.rotate(this.turretAngle - this.parent.a);
            ctx.strokeStyle = NEON_CYAN; ctx.fillStyle = "rgba(0, 50, 100, 0.5)"; ctx.lineWidth = 2; ctx.shadowColor = NEON_CYAN; ctx.shadowBlur = 15;
            ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(18, 0); ctx.stroke(); ctx.restore();
        }
        ctx.restore(); ctx.globalCompositeOperation = 'source-over';
        if (!this.isDestroyed && this.parent.scale >= 1) {
            const barW = this.w * this.parent.scale; const barH = 5 * this.parent.scale; const barX = this.x - barW / 2; const barY = this.y + (this.h / 2 + 10) * this.parent.scale;
            ctx.fillStyle = "rgba(255, 0, 0, 0.5)"; ctx.fillRect(barX, barY, barW, barH);
            ctx.fillStyle = "rgba(0, 255, 0, 0.7)"; ctx.fillRect(barX, barY, barW * (this.health / this.maxHealth), barH);
        }
    }
    takeDamage(amount, playerId) {
        if (this.isDestroyed) return;
        this.health -= amount; this.hitFlashTimer = 5;
        if (this.health <= 0) { this.health = 0; this.isDestroyed = true; this.parent.onSectionDestroyed(this.x, this.y, playerId); }
        else { triggerScreenShake(amount, 10); triggerRumble(0.1 * amount, 0.1 * amount, 100); }
    }
}

export class Cruiser {
    constructor() {
        this.r = 120; this.speed = 0.3;
        this.targetAngle = 0; this.isDead = false; this.isBoss = true; this.targetPlayer = null;
        const edge = Math.floor(Math.random() * 4);
        switch (edge) {
            case 0: this.x = -this.r; this.y = Math.random() * canvas.height; this.a = 0; break;
            case 1: this.x = canvas.width + this.r; this.y = Math.random() * canvas.height; this.a = Math.PI; break;
            case 2: this.x = Math.random() * canvas.width; this.y = -this.r; this.a = Math.PI / 2; break;
            case 3: this.x = Math.random() * canvas.width; this.y = canvas.height + this.r; this.a = -Math.PI / 2; break;
        }
        this.targetAngle = this.a;
        this.sections = [new CruiserSection(this, 0, 0), new CruiserSection(this, -80, 50), new CruiserSection(this, -80, -50),];
        this.sectionsRemaining = this.sections.length;

        // State machine
        this.state = 'SPAWNING';
        this.spawnTimer = 0; this.scale = 0.1;
        
        playWarpInSound();
    }
    update(deltaTime) {
        if (!this.targetPlayer || this.targetPlayer.lives <= 0) { this.acquireTarget(); }

        this.updateStateTransitions(deltaTime);
        this.executeCurrentState(deltaTime);

        // Physics
        this.x += this.speed * Math.cos(this.a);
        this.y += this.speed * Math.sin(this.a);
        this.sections.forEach(s => s.update(deltaTime));
    }
    updateStateTransitions(deltaTime) {
        if (this.state === 'SPAWNING') {
            if (this.scale >= 1) this.state = 'ENGAGING';
            return;
        }

        const margin = 150;
        const isOutOfBounds = this.x < margin || this.x > canvas.width - margin || this.y < margin || this.y > canvas.height - margin;
        if (isOutOfBounds) {
            this.state = 'REPOSITIONING';
        } else {
            this.state = 'ENGAGING';
        }
    }
    executeCurrentState(deltaTime) {
        switch (this.state) {
            case 'SPAWNING':
                this.executeSpawningState(deltaTime);
                break;
            case 'REPOSITIONING':
                this.executeRepositioningState(deltaTime);
                break;
            case 'ENGAGING':
                this.executeEngagingState(deltaTime);
                break;
        }
    }
    executeSpawningState(deltaTime) {
        this.spawnTimer += deltaTime;
        this.scale = Math.min(1, this.spawnTimer / 2000);
    }
    executeRepositioningState(deltaTime) {
        const angleToCenter = Math.atan2(canvas.height / 2 - this.y, canvas.width / 2 - this.x);
        this.targetAngle = angleToCenter;
        this.turnTowardsTarget();
    }
    executeEngagingState(deltaTime) {
        if (!this.targetPlayer) return;
        const player = this.targetPlayer;
        const idealDist = 400; const tooCloseDist = 250;
        const distToPlayer = distBetweenPoints(this.x, this.y, player.x, player.y);
        const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
        
        if (distToPlayer < tooCloseDist) this.targetAngle = angleToPlayer + Math.PI; // Flee
        else if (distToPlayer > idealDist) this.targetAngle = angleToPlayer; // Pursue
        else this.targetAngle = angleToPlayer + Math.PI / 2; // Strafe
        
        this.turnTowardsTarget();
    }
    turnTowardsTarget() {
        const angleDifference = normalizeAngle(this.targetAngle - this.a); const turnSpeed = CORVETTE_TURN_SPEED * 0.4;
        if (Math.abs(angleDifference) > turnSpeed) this.a += Math.sign(angleDifference) * turnSpeed;
        else this.a = this.targetAngle;
        this.a = normalizeAngle(this.a);
    }
    acquireTarget() {
        let closestPlayer = null; let minDist = Infinity;
        for (const p of gameState.players) { if (p.lives > 0) { const d = distBetweenPoints(this.x, this.y, p.x, p.y); if (d < minDist) { minDist = d; closestPlayer = p; } } }
        this.targetPlayer = closestPlayer;
    }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y);
        // Draw connecting structure only if scale is full
        if (this.scale >= 1) {
            ctx.strokeStyle = '#666'; ctx.lineWidth = 10 * this.scale; ctx.shadowColor = NEON_ORANGE; ctx.shadowBlur = 15;
            ctx.beginPath();
            const center = this.sections[0]; const wing1 = this.sections[1]; const wing2 = this.sections[2];
            ctx.moveTo(center.x, center.y); ctx.lineTo(wing1.x, wing1.y);
            ctx.moveTo(center.x, center.y); ctx.lineTo(wing2.x, wing2.y);
            ctx.stroke();
        }
        ctx.restore();
        this.sections.forEach(s => s.draw());
    }
    takeDamage(amount, hitX, hitY, isBomb = false, playerId = -1) {
        let closestSection = null; let minDistance = Infinity;
        for (const section of this.sections) {
            if (!section.isDestroyed) { const d = distBetweenPoints(hitX, hitY, section.x, section.y); if (d < minDistance) { minDistance = d; closestSection = section; } }
        }
        if (closestSection && (isBomb || minDistance < closestSection.r * this.scale)) { closestSection.takeDamage(amount, playerId); return true; }
        return false;
    }
    checkCollision(targetX, targetY, targetR) {
        for (const section of this.sections) {
            if (!section.isDestroyed) { if (distBetweenPoints(targetX, targetY, section.x, section.y) < targetR + section.r * this.scale) { return true; } }
        }
        return false;
    }
    onSectionDestroyed(x, y, playerId) {
        this.sectionsRemaining--;
        eventBus.dispatch('cruiser_section_destroyed', { playerId: playerId });
        triggerRumble(0.8, 0.8, 250); playExplosionSound(0.8, 0.6, 2000, 150);
        createExplosion(x, y, NEON_ORANGE, 50, 4); createShockwave(x, y, 150, NEON_ORANGE, 5, 2);
        if (this.sectionsRemaining <= 0) { this.handleFinalDeath(playerId); }
    }
    handleFinalDeath(playerId) {
        eventBus.dispatch('cruiser_final_death', { playerId: playerId });
        triggerScreenShake(40, 120); triggerRumble(1.0, 1.0, 1500); playExplosionSound(1.0, 2.0, 4000, 50);
        createExplosion(this.x, this.y, NEON_ORANGE, 250, 8); createShockwave(this.x, this.y, 600, NEON_ORANGE, 15, 8);
        gameState.powerUps.push(new PowerUp(this.x, this.y)); gameState.powerUps.push(new PowerUp(this.x + 40, this.y + 40)); gameState.powerUps.push(new PowerUp(this.x - 40, this.y - 40));
        this.isDead = true;
    }
}

export class Mine {
    constructor(x, y, ownerId = -1) {
        this.x = x; this.y = y; this.r = 8; this.life = MINE_LIFETIME;
        this.isTriggered = false; this.fuseTimer = MINE_FUSE_TIME; this.pulse = Math.random() * Math.PI * 2;
        this.ownerId = ownerId;
    }
    update(deltaTime) {
        this.life -= deltaTime;
        if (!this.isTriggered) {
            for (const player of gameState.players) {
                if (player.lives > 0 && distBetweenPoints(this.x, this.y, player.x, player.y) < MINE_PROXIMITY_RADIUS) {
                    this.isTriggered = true; playSoundGeneric('sine', 440, 880, 0.2, 0.2); break;
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
        this.mineCooldown = MINELAYER_MINE_COOLDOWN / 2; this.hitFlashTimer = 0;
        this.isDead = false; this.isBoss = false;
        const edge = Math.floor(Math.random() * 4); const margin = 50;
        switch (edge) {
            case 0: this.x = -this.r; this.y = Math.random() * canvas.height; this.targetX = canvas.width + margin; this.targetY = Math.random() * canvas.height; break;
            case 1: this.x = canvas.width + this.r; this.y = Math.random() * canvas.height; this.targetX = -margin; this.targetY = Math.random() * canvas.height; break;
            case 2: this.x = Math.random() * canvas.width; this.y = -this.r; this.targetX = Math.random() * canvas.width; this.targetY = canvas.height + margin; break;
            case 3: this.x = Math.random() * canvas.width; this.y = canvas.height + this.r; this.targetX = Math.random() * canvas.width; this.targetY = -margin; break;
        }
        this.a = Math.atan2(this.targetY - this.y, this.targetX - this.x);

        // State machine
        this.state = 'TRAVERSING';
        this.targetPlayer = null;
    }
    update(deltaTime) {
        if (!this.targetPlayer || this.targetPlayer.lives <= 0) this.acquireTarget();
        
        this.updateStateTransitions(deltaTime);
        this.executeCurrentState(deltaTime);

        // Physics & general updates
        this.x += this.speed * Math.cos(this.a); this.y += this.speed * Math.sin(this.a);
        if (this.hitFlashTimer > 0) this.hitFlashTimer--;
        const offscreenMargin = 100;
        if (this.x < -offscreenMargin || this.x > canvas.width + offscreenMargin || this.y < -offscreenMargin || this.y > canvas.height + offscreenMargin) { this.isDead = true; }
    }
    updateStateTransitions(deltaTime) {
        if (this.targetPlayer && distBetweenPoints(this.x, this.y, this.targetPlayer.x, this.targetPlayer.y) < MINELAYER_AVOID_RADIUS) {
            this.state = 'EVADING';
        } else {
            this.state = 'TRAVERSING';
        }
    }
    executeCurrentState(deltaTime) {
        // Shared logic for both states
        this.mineCooldown -= deltaTime;
        if (this.mineCooldown <= 0) {
            gameState.mines.push(new Mine(this.x, this.y));
            playSoundGeneric('square', 200, 150, 0.1, 0.3);
            this.mineCooldown = MINELAYER_MINE_COOLDOWN + Math.random() * 1000;
        }

        // State-specific logic
        switch (this.state) {
            case 'TRAVERSING':
                this.executeTraversingState(deltaTime);
                break;
            case 'EVADING':
                this.executeEvadingState(deltaTime);
                break;
        }
    }
    executeTraversingState(deltaTime) {
        const angleToTarget = Math.atan2(this.targetY - this.y, this.targetX - this.x);
        this.a += normalizeAngle(angleToTarget - this.a) * 0.02;
    }
    executeEvadingState(deltaTime) {
        if (!this.targetPlayer) return; // Should not happen
        const angleFromPlayer = Math.atan2(this.y - this.targetPlayer.y, this.x - this.targetPlayer.x);
        this.a = normalizeAngle(angleFromPlayer * 0.05 + this.a * 0.95);
    }
    acquireTarget() {
        let closestPlayer = null; let minDist = Infinity;
        for (const p of gameState.players) { if (p.lives > 0) { const d = distBetweenPoints(this.x, this.y, p.x, p.y); if (d < minDist) { minDist = d; closestPlayer = p; } } }
        this.targetPlayer = closestPlayer;
    }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.a);
        if (this.hitFlashTimer > 0) { ctx.globalCompositeOperation = 'lighter'; }
        ctx.strokeStyle = NEON_ORANGE; ctx.fillStyle = "rgba(100, 50, 0, 0.5)"; ctx.lineWidth = 2; ctx.shadowColor = NEON_ORANGE; ctx.shadowBlur = 15;
        ctx.beginPath(); ctx.moveTo(this.r, 0); ctx.lineTo(0, -this.r * 0.6);
        ctx.lineTo(-this.r * 0.8, 0); ctx.lineTo(0, this.r * 0.6); ctx.closePath();
        ctx.fill(); ctx.stroke(); ctx.restore(); ctx.globalCompositeOperation = 'source-over';
    }
    takeDamage(amount, hitX, hitY, isBomb = false, playerId = -1) {
        if (distBetweenPoints(this.x, this.y, hitX, hitY) > this.r * 1.2 && !isBomb) return false;
        this.health -= amount; this.hitFlashTimer = 5;
        if (this.health <= 0) {
            eventBus.dispatch('enemy_destroyed', { enemy: this, playerId: playerId, x: this.x, y: this.y });
            if (Math.random() < 0.5) gameState.powerUps.push(new PowerUp(this.x, this.y));
            this.isDead = true;
        } else {
            triggerRumble(0.2 * amount, 0.1 * amount, 100);
        }
        return true;
    }
    checkCollision(targetX, targetY, targetR) { return distBetweenPoints(this.x, this.y, targetX, targetY) < this.r + targetR; }
}

export class Ace extends EnemyShip {
    constructor() {
        super();
        this.r = 12; this.health = ACE_HEALTH;
        this.shieldEnergy = ACE_SHIELD_ENERGY; this.shieldActive = false;
        this.shootCooldown = ACE_SHOOT_COOLDOWN; this.missileCooldown = ACE_MISSILE_COOLDOWN;
        this.missileChargeProgress = 0; this.hitFlashTimer = 0;

        // State machine (already existed, now formalized with pattern)
        this.state = 'HUNTING';
        this.evasionTarget = null;
    }
    draw() {
        if (this.state === 'CHARGING') { const glowSize = this.r * (1 + this.missileChargeProgress * 1.5); ctx.fillStyle = `rgba(255, 0, 255, ${0.1 + this.missileChargeProgress * 0.3})`; ctx.shadowColor = NEON_PINK; ctx.shadowBlur = 20; ctx.beginPath(); ctx.arc(this.x, this.y, glowSize, 0, Math.PI * 2); ctx.fill(); }
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
        if (!this.targetPlayer || this.targetPlayer.lives <= 0) { this.acquireTarget(); }
        
        this.updateStateTransitions();
        this.executeCurrentState(deltaTime);

        // Physics and general updates
        this.a += this.rot;
        if (this.isThrusting) { this.thrust.x += ACE_THRUST * Math.cos(this.a); this.thrust.y += ACE_THRUST * Math.sin(this.a); }
        this.thrust.x *= FRICTION; this.thrust.y *= FRICTION;
        this.x += this.thrust.x; this.y += this.thrust.y;
        this.handleScreenWrap();
        if (this.shootCooldown > 0) this.shootCooldown -= deltaTime;
        if (this.missileCooldown > 0) this.missileCooldown -= deltaTime;
        if (this.hitFlashTimer > 0) this.hitFlashTimer--;
    }
    updateStateTransitions() {
        if (!this.targetPlayer) { this.state = 'HUNTING'; return; }
        
        // Shield logic is independent of state but affects behavior
        const shouldHaveShieldsUp = (this.health / ACE_HEALTH < 0.5) || gameState.missiles.some(m => distBetweenPoints(this.x, this.y, m.x, m.y) < 150);
        this.shieldActive = shouldHaveShieldsUp && this.shieldEnergy > 0;

        // Evasion is highest priority
        for (const ast of gameState.asteroids) {
            if (distBetweenPoints(this.x, this.y, ast.x, ast.y) < ACE_AVOID_RADIUS) {
                this.state = 'EVADING';
                this.evasionTarget = ast;
                return;
            }
        }
        if (this.state === 'EVADING') {
            this.state = 'HUNTING';
            this.evasionTarget = null;
        }

        // Check for charging missile
        if (this.state !== 'CHARGING' && this.missileCooldown <= 0) {
            const distToPlayer = distBetweenPoints(this.x, this.y, this.targetPlayer.x, this.targetPlayer.y);
            const angleToPlayer = Math.atan2(this.targetPlayer.y - this.y, this.targetPlayer.x - this.x);
            const angleDifference = Math.abs(normalizeAngle(this.a - angleToPlayer));
            if (distToPlayer > 250 && distToPlayer < 600 && angleDifference < degToRad(20)) {
                this.state = 'CHARGING';
                this.missileChargeProgress = 0;
                return;
            }
        }
    }
    executeCurrentState(deltaTime) {
        switch (this.state) {
            case 'HUNTING': this.executeHuntingState(deltaTime); break;
            case 'EVADING': this.executeEvadingState(deltaTime); break;
            case 'CHARGING': this.executeChargingState(deltaTime); break;
        }
    }
    executeHuntingState(deltaTime) {
        if (!this.targetPlayer) { this.isThrusting = false; return; }
        const player = this.targetPlayer;
        const distToPlayer = distBetweenPoints(this.x, this.y, player.x, player.y);
        const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
        const targetAngle = angleToPlayer + Math.PI / 2; // Strafe
        this.turnTowards(targetAngle, ACE_TURN_SPEED);
        this.isThrusting = distToPlayer > 300;
        const angleDifference = Math.abs(normalizeAngle(this.a - angleToPlayer));
        if (this.shootCooldown <= 0 && angleDifference < degToRad(10) && distToPlayer < 400) {
            gameState.enemyBullets.push(new EnemyBullet(this));
            playEnemyShootSound();
            this.shootCooldown = ACE_SHOOT_COOLDOWN;
        }
    }
    executeEvadingState(deltaTime) {
        if (!this.evasionTarget) { this.state = 'HUNTING'; return; }
        const evasionAngle = Math.atan2(this.y - this.evasionTarget.y, this.x - this.evasionTarget.x);
        this.turnTowards(evasionAngle, ACE_TURN_SPEED * 1.5);
        this.isThrusting = true;
    }
    executeChargingState(deltaTime) {
        this.isThrusting = false;
        if (this.targetPlayer) { const angleToPlayer = Math.atan2(this.targetPlayer.y - this.y, this.targetPlayer.x - this.x); this.turnTowards(angleToPlayer, ACE_TURN_SPEED * 0.5); }
        this.missileChargeProgress += deltaTime / ACE_MISSILE_CHARGE_TIME;
        if (this.missileChargeProgress >= 1.0) {
            this.fireMissileSpread();
            this.missileCooldown = ACE_MISSILE_COOLDOWN;
            this.state = 'HUNTING';
        }
    }
    fireMissileSpread() {
        playChargeLevelUpSound(); const numToFire = 2; const totalSpread = (numToFire - 1) * degToRad(15);
        const startAngleOffset = -totalSpread / 2;
        for (let i = 0; i < numToFire; i++) {
            const angleOffset = startAngleOffset + i * degToRad(15); const missile = new EnemyMissile(this);
            missile.a = normalizeAngle(this.a + angleOffset); gameState.enemyMissiles.push(missile);
        }
    }
    turnTowards(targetAngle, speed = ACE_TURN_SPEED) {
        const angleDifference = normalizeAngle(targetAngle - this.a);
        if (Math.abs(angleDifference) > speed) { this.rot = Math.sign(angleDifference) * speed; } else { this.rot = 0; this.a = targetAngle; }
    }
    takeDamage(amount, hitX, hitY, isBomb = false, playerId = -1) {
        if (distBetweenPoints(this.x, this.y, hitX, hitY) > this.r * 1.5 && !isBomb) return false;
        this.hitFlashTimer = 5;
        if (this.shieldActive) { this.shieldEnergy -= amount; if (this.shieldEnergy < 0) this.shieldActive = false; return true; }
        this.health -= amount;
        if (this.health <= 0) {
            eventBus.dispatch('enemy_destroyed', { enemy: this, playerId: playerId, x: this.x, y: this.y });
            this.isDead = true;
        }
        return true;
    }
}