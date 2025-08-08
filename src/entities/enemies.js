// src/entities/enemies.js
// Defines all enemy classes and related logic.

import { gameState } from '../state.js';
import { ctx, canvas } from '../ui/ui.js';
import { createExplosion, triggerRumble, triggerScreenShake, createCapitalExplosion, createDamageSmoke, createSparks } from '../fx/effects.js';
import { createShockwave } from '../fx/shockwave.js';
import { playEnemyShootSound, playExplosionSound, playMissileLaunchSound, playRocketLaunchSound, playSoundGeneric, playWarpInSound, startChargeSound, stopChargeSound, playChargeLevelUpSound, playShieldZapSound } from '../audio/audio.js';
import { normalizeAngle, distBetweenPoints, degToRad, getDynamicColor } from '../utils.js';
import { PowerUp } from './environment.js';
import { EnemyBullet, EnemyMissile, Rocket } from './weapons.js';
import {
    DIFFICULTY_SETTINGS,
    FRICTION,
    NEON_ORANGE,
    NEON_CYAN,
    NEON_BLUE,
    NEON_PINK,
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
    ACE_MISSILE_COOLDOWN,
    MISSILE_SPREAD_ANGLE_INCREMENT,
    NEON_ENEMY_BODY,
    NEON_ALLY_BODY,
    NEON_ENEMY_ACCENT,
    NEON_ALLY_ACCENT
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
}

export class EnemyShip {
    constructor(faction = 'enemy') {
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
        this.target = null;
        this.faction = faction; // 'enemy' or 'ally'
		this.opacity = 1; // For rendering
        this.canStealth = gameState.mutators?.enemiesCanStealth || false;

        // --- FSM & Squadron Properties ---
        this.state = 'SEEKING'; // Default state
        this.stateTimer = 0;
        this.squadId = null;
        this.isLeader = false;
        this.leader = null;
        this.formationOffset = null; // { x, y } relative to leader
    }
    draw() {
        const bodyColor = this.faction === 'ally' ? NEON_ALLY_BODY : NEON_ENEMY_BODY;
        const dynamicColor = getDynamicColor(bodyColor);
		ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.strokeStyle = dynamicColor;
        ctx.lineWidth = 2;
        ctx.shadowColor = dynamicColor;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(this.x + this.r * Math.cos(this.a), this.y + this.r * Math.sin(this.a));
        ctx.lineTo(this.x - this.r * (Math.cos(this.a) + Math.sin(this.a)), this.y - this.r * (Math.sin(this.a) - Math.cos(this.a)));
        ctx.lineTo(this.x - this.r * (Math.cos(this.a) - Math.sin(this.a)), this.y - this.r * (Math.sin(this.a) + Math.cos(this.a)));
        ctx.closePath();
        ctx.stroke();
        if (this.isThrusting) {
            ctx.fillStyle = dynamicColor;
            ctx.beginPath();
            ctx.moveTo(this.x - this.r * (Math.cos(this.a) * 1.2), this.y - this.r * (Math.sin(this.a) * 1.2));
            ctx.lineTo(this.x - this.r * (Math.cos(this.a) - Math.sin(this.a) * 0.5), this.y - this.r * (Math.sin(this.a) + Math.cos(this.a) * 0.5));
            ctx.lineTo(this.x - this.r * (Math.cos(this.a) + Math.sin(this.a) * -0.5), this.y - this.r * (Math.sin(this.a) - Math.cos(this.a) * -0.5));
            ctx.closePath();
            ctx.fill();
        }
        ctx.shadowBlur = 0;
		ctx.restore();
    }
    update(deltaTime) {
        this.runFSM(deltaTime);
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
        if (this.stateTimer > 0) this.stateTimer -= deltaTime;
    }
    
    runFSM(deltaTime) {
        if (!this.target || this.target.isDead || (this.target.lives !== undefined && this.target.lives <= 0)) {
            this.acquireTarget();
        }
		// START OF CHANGE: Handle stealth state transitions
        if (this.canStealth) {
            if (this.state === 'STEALTHED') {
                this.opacity = Math.max(0, this.opacity - 0.01); // Fade out
            } else {
                this.opacity = Math.min(1, this.opacity + 0.05); // Fade in
            }
        }
        // END OF CHANGE
        
		// State-independent checks for squadron logic
        if (!this.isLeader && (!this.leader || this.leader.isDead)) {
            // My leader is dead, I am now a free agent
            this.leader = null;
            this.squadId = null;
            this.formationOffset = null;
            // If I was in formation, switch to seeking a target
            if (this.state === 'FORMATION') {
                this.state = 'SEEKING';
            }
        }
        
        // Evading threats takes priority over all other states (except for wingmen in formation)
        const evasionAngle = this.checkForEvasion();
        if (evasionAngle !== null && this.state !== 'EVADING' && this.state !== 'FORMATION') {
            this.state = 'EVADING';
            this.stateTimer = 1000; // Evade for 1 second
            this.evasionTargetAngle = evasionAngle;
        }

        switch(this.state) {
            case 'SEEKING': this.handleSeekingState(); break;
            case 'ATTACKING': this.handleAttackingState(); break;
            case 'EVADING': this.handleEvadingState(); break;
            case 'FORMATION': this.handleFormationState(); break;
            // START OF CHANGE: Add new FSM state
            case 'STEALTHED': this.handleStealthedState(); break;
            // END OF CHANGE
        }
    }

    checkForEvasion() {
        for (const ast of gameState.asteroids) {
            if (distBetweenPoints(this.x, this.y, ast.x, ast.y) < this.r + ast.r + 80) {
                return Math.atan2(this.y - ast.y, this.x - ast.x);
            }
        }
        return null;
    }

    handleSeekingState() {
        if (!this.target) {
            this.isThrusting = false;
            return;
        }
        const dist = distBetweenPoints(this.x, this.y, this.target.x, this.target.y);
		if (this.canStealth && dist > 400 && this.opacity === 1) {
            this.state = 'STEALTHED';
            return;
        }
        if (dist < 300) {
            this.state = 'ATTACKING';
            this.stateTimer = Math.random() * 2000 + 3000; // Attack for 3-5 seconds
        }
        const angleToTarget = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        this.turnTowards(angleToTarget);
        this.isThrusting = true;
    }

    handleAttackingState() {
        if (!this.target || this.stateTimer <= 0) {
			if (this.canStealth) {
                this.state = 'STEALTHED';
            } else {
                this.state = 'SEEKING';
            }
            return;
        }
        const angleToTarget = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        this.turnTowards(angleToTarget);
        this.isThrusting = false; // Hold position to fire

        const angleDifference = Math.abs(normalizeAngle(this.a - angleToTarget));
        const settings = DIFFICULTY_SETTINGS[gameState.currentDifficulty];
        if (this.shootCooldown <= 0 && angleDifference < degToRad(15)) {
            gameState.enemyBullets.push(new EnemyBullet(this));
            playEnemyShootSound();
            this.shootCooldown = settings.enemyShootCooldown;
        }
    }

    handleEvadingState() {
        if (this.stateTimer <= 0) {
            this.state = 'SEEKING';
            return;
        }
        this.turnTowards(this.evasionTargetAngle);
        this.isThrusting = true;
    }

    handleFormationState() {
        if (!this.leader) { // Leader died
            this.state = 'SEEKING';
            return;
        }

        // Calculate world position of my formation spot
        const leader = this.leader;
        const offset = this.formationOffset;
        const cosA = Math.cos(leader.a);
        const sinA = Math.sin(leader.a);
        const targetX = leader.x + (offset.x * cosA - offset.y * sinA);
        const targetY = leader.y + (offset.x * sinA + offset.y * cosA);

        const distToSpot = distBetweenPoints(this.x, this.y, targetX, targetY);
        // If I'm far from my spot, thrust to catch up
        this.isThrusting = distToSpot > 20;

        // Aim towards my spot to get there
        const angleToSpot = Math.atan2(targetY - this.y, targetX - this.y);
        this.turnTowards(angleToSpot);
        
        // Also try to match my leader's orientation
        const angleDifference = normalizeAngle(leader.a - this.a);
        const turnSpeed = DIFFICULTY_SETTINGS[gameState.currentDifficulty].enemyTurnSpeed;
        if (Math.abs(angleDifference) > turnSpeed) {
            this.rot = Math.sign(angleDifference) * turnSpeed;
        } else {
            this.rot = 0;
            this.a = leader.a;
        }
    }

	handleStealthedState() {
        if (!this.target) {
            this.state = 'SEEKING';
            return;
        }
        // Continue moving towards the target while stealthed
        const dist = distBetweenPoints(this.x, this.y, this.target.x, this.target.y);
        const angleToTarget = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        this.turnTowards(angleToTarget);
        this.isThrusting = true;

        // If we get close enough, unstealth and prepare to attack
        if (dist < 350) {
            this.state = 'SEEKING'; // Transition to seeking, which will quickly become attacking
        }
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
        for (const t of potentialTargets) {
            const d = distBetweenPoints(this.x, this.y, t.x, t.y);
            if (d < minDist) {
                minDist = d;
                closestTarget = t;
            }
        }
        this.target = closestTarget;
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
        if (this.faction === 'enemy') {
            awardScoreToPlayer(250, playerId);
            if (Math.random() < POWERUP_DROP_CHANCE) {
                gameState.powerUps.push(new PowerUp(this.x, this.y));
            }
        }
        createExplosion(this.x, this.y, NEON_ORANGE, 30, 3.5);
        playExplosionSound(0.6, 0.5);
        triggerRumble(0.6, 0.3, 200);
        this.isDead = true;
    }
}

export class Corvette {
    constructor(faction = 'enemy') {
        const settings = DIFFICULTY_SETTINGS[gameState.currentDifficulty];
        this.w = 80; this.h = 40; this.r = Math.max(this.w, this.h) / 2;
        this.maxHealth = settings.corvetteHealth;
        this.health = this.maxHealth;
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
        this.target = null;
        this.faction = faction;
        this.thrust = { x: 0, y: 0 }; // Needed for smoke parenting

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
        const bodyColor = this.faction === 'ally' ? NEON_ALLY_BODY : NEON_ENEMY_BODY;
        const turretColor = this.faction === 'ally' ? NEON_ALLY_ACCENT : NEON_ENEMY_ACCENT;
        const dynamicBodyColor = getDynamicColor(bodyColor);
        const dynamicTurretColor = getDynamicColor(turretColor);

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.scale, this.scale);
        ctx.rotate(this.a);
        if (this.hitFlashTimer > 0) { ctx.globalCompositeOperation = 'lighter'; }
        
        // --- BODY ---
        ctx.strokeStyle = dynamicBodyColor;
        ctx.lineWidth = 3;
        ctx.shadowColor = dynamicBodyColor;
        ctx.shadowBlur = 20;

        ctx.beginPath();
        ctx.rect(-this.w / 2, -this.h / 2, this.w, this.h);
        
        if (gameState.colorMode !== 'color') {
            ctx.fillStyle = '#0d021a'; // Game background color
        } else {
            const rgb = this.faction === 'ally' ? '0, 100, 50' : '100, 50, 0';
            ctx.fillStyle = getDynamicColor(`rgba(${rgb}, 0.3)`);
        }
        ctx.fill();
        ctx.stroke();

        // --- TURRET ---
        ctx.save();
        ctx.rotate(this.turretAngle - this.a);
        ctx.strokeStyle = dynamicTurretColor;
        ctx.lineWidth = 2;
        ctx.shadowColor = dynamicTurretColor;
        ctx.shadowBlur = 15;
        
        // Turret Base
        ctx.beginPath(); 
        ctx.arc(0, 0, 12, 0, Math.PI * 2); 
        
        if (gameState.colorMode !== 'color') {
            ctx.fillStyle = '#0d021a';
        } else {
            const rgb = this.faction === 'ally' ? '0, 100, 100' : '0, 50, 100';
            ctx.fillStyle = getDynamicColor(`rgba(${rgb}, 0.5)`);
        }
        ctx.fill(); 
        ctx.stroke();
        
        // Turret Barrel
        ctx.beginPath(); 
        ctx.moveTo(0, 0); 
        ctx.lineTo(20, 0); 
        ctx.stroke();
        
        ctx.restore(); 
        ctx.restore(); 
        
        ctx.shadowBlur = 0; 
        ctx.globalCompositeOperation = 'source-over';
        
        if (this.health < this.maxHealth) {
            const barW = this.w * this.scale; const barH = 5 * this.scale;
            const barX = this.x - barW / 2; const barY = this.y + (this.h / 2 + 10) * this.scale;
            ctx.fillStyle = getDynamicColor("rgba(255, 0, 0, 0.5)"); ctx.fillRect(barX, barY, barW, barH);
            ctx.fillStyle = getDynamicColor("rgba(0, 255, 0, 0.7)"); ctx.fillRect(barX, barY, barW * (this.health / this.maxHealth), barH);
        }
    }
    update(deltaTime) {
        if (this.scale < 1) { this.spawnTimer += deltaTime; this.scale = Math.min(1, this.spawnTimer / 1000); }
        this.xv = this.speed * Math.cos(this.a); this.yv = this.speed * Math.sin(this.a);
        this.thrust.x = this.xv; this.thrust.y = this.yv; // Sync thrust for smoke
        this.x += this.xv; this.y += this.yv;
        if (this.scale >= 1) { this.aiLogic(deltaTime); if (this.turretShootCooldown > 0) this.turretShootCooldown -= deltaTime; if (this.rocketCooldown > 0) this.rocketCooldown -= deltaTime; }
        if (this.hitFlashTimer > 0) this.hitFlashTimer--;
        
        // NEW: Damage smoke logic
        if (this.health < this.maxHealth / 2 && Math.random() < 0.1) {
            createDamageSmoke(this);
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
        for (const t of potentialTargets) {
            const d = distBetweenPoints(this.x, this.y, t.x, t.y);
            if (d < minDist) {
                minDist = d;
                closestTarget = t;
            }
        }
        this.target = closestTarget;
    }
    aiLogic(deltaTime) {
        if (!this.target || (this.target.isDead || (this.target.lives !== undefined && this.target.lives <= 0))) {
            this.acquireTarget();
        }
        if (!this.target) return;
        
        const settings = DIFFICULTY_SETTINGS[gameState.currentDifficulty];
        this.turnTimer -= deltaTime;
        if (this.turnTimer <= 0 && !this.isTurning) { this.isTurning = true; this.targetAngle = this.a + (Math.random() - 0.5) * (Math.PI / 2); this.turnTimer = Math.random() * 7000 + 8000; }
        if (this.isTurning) {
            const angleDifference = normalizeAngle(this.targetAngle - this.a);
            if (Math.abs(angleDifference) > CORVETTE_TURN_SPEED) { this.a += Math.sign(angleDifference) * CORVETTE_TURN_SPEED; } else { this.a = this.targetAngle; this.isTurning = false; }
            this.a = normalizeAngle(this.a);
        }
        const angleToTarget = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        const angleDifferenceTurret = normalizeAngle(angleToTarget - this.turretAngle);
        if (Math.abs(angleDifferenceTurret) > settings.corvetteTurretTurnSpeed) { this.turretAngle += Math.sign(angleDifferenceTurret) * settings.corvetteTurretTurnSpeed; } else { this.turretAngle = angleToTarget; }
        this.turretAngle = normalizeAngle(this.turretAngle);
        if (this.turretShootCooldown <= 0 && Math.abs(angleDifferenceTurret) < degToRad(5)) {
            gameState.enemyBullets.push(new EnemyBullet(this, this.turretAngle));
            playEnemyShootSound(); this.turretShootCooldown = settings.corvetteTurretShootCooldown;
        }
        if (this.rocketCooldown <= 0) {
            const totalSpread = (5 - 1) * degToRad(8); const startAngleOffset = -totalSpread / 2;
            for (let i = 0; i < 5; i++) { 
                const angleOffset = startAngleOffset + i * degToRad(8);
                gameState.enemyRockets.push(new Rocket(this, this.a + angleOffset)); 
            }
            playRocketLaunchSound(); this.rocketCooldown = 7500;
        }
    }
    takeDamage(amount, hitX, hitY, isBomb = false, playerId = -1) {
        this.health -= amount;
        this.hitFlashTimer = 5;
        createSparks(hitX, hitY, 5); // NEW: Create sparks on hit

        if (this.health <= 0) {
            if (this.faction === 'enemy') {
                awardScoreToPlayer(1000, playerId);
                gameState.powerUps.push(new PowerUp(this.x, this.y));
            }
            triggerScreenShake(20, 60); triggerRumble(1.0, 1.0, 500);
            playExplosionSound(1.0, 1.2, 3000, 50);
            createCapitalExplosion(this.x, this.y, this.r * 2.5); // NEW: Use capital explosion
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
        this.faction = parent.faction;
    }
    update(deltaTime) {
        const cosA = Math.cos(this.parent.a); const sinA = Math.sin(this.parent.a);
        this.x = this.parent.x + (this.offsetX * cosA - this.offsetY * sinA); this.y = this.parent.y + (this.offsetX * sinA + this.offsetY * cosA);
        if (this.isDestroyed || !this.parent.target) return;
        if (this.hitFlashTimer > 0) this.hitFlashTimer--; if (this.turretShootCooldown > 0) this.turretShootCooldown -= deltaTime;
        
        // NEW: Damage smoke
        if (this.health < this.maxHealth / 2 && Math.random() < 0.05) {
             createDamageSmoke({ ...this, r: this.r * 0.8, thrust: this.parent.thrust });
        }

        const settings = DIFFICULTY_SETTINGS[gameState.currentDifficulty];
        const angleToTarget = Math.atan2(this.parent.target.y - this.y, this.parent.target.x - this.x);
        const angleDifference = normalizeAngle(angleToTarget - this.turretAngle);
        if (Math.abs(angleDifference) > settings.corvetteTurretTurnSpeed) { this.turretAngle += Math.sign(angleDifference) * settings.corvetteTurretTurnSpeed; } else { this.turretAngle = angleToTarget; }
        this.turretAngle = normalizeAngle(this.turretAngle);
        if (this.turretShootCooldown <= 0 && Math.abs(angleDifference) < degToRad(10)) {
            gameState.enemyBullets.push(new EnemyBullet(this, this.turretAngle));
            playEnemyShootSound(); this.turretShootCooldown = settings.corvetteTurretShootCooldown * 1.2 + (Math.random() * 500);
        }
    }
    draw() {
        const bodyColor = this.faction === 'ally' ? NEON_ALLY_BODY : NEON_ENEMY_BODY;
        const turretColor = this.faction === 'ally' ? NEON_ALLY_ACCENT : NEON_ENEMY_ACCENT;
        const dynamicBodyColor = getDynamicColor(bodyColor);
        const dynamicTurretColor = getDynamicColor(turretColor);

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.parent.a);
        if (this.hitFlashTimer > 0) ctx.globalCompositeOperation = 'lighter';
        
        // --- BODY ---
        ctx.strokeStyle = this.isDestroyed ? getDynamicColor('#444') : dynamicBodyColor;
        ctx.lineWidth = 3;
        ctx.shadowColor = dynamicBodyColor;
        ctx.shadowBlur = 20;

        ctx.beginPath();
        ctx.rect(-this.w / 2, -this.h / 2, this.w, this.h);
        
        if (gameState.colorMode !== 'color') {
            ctx.fillStyle = this.isDestroyed ? 'rgba(20, 10, 0, 0.5)' : '#0d021a';
        } else {
            const rgb = this.faction === 'ally' ? '20, 20, 50' : '20, 10, 0';
            ctx.fillStyle = this.isDestroyed ? getDynamicColor(`rgba(${rgb}, 0.5)`) : getDynamicColor(`rgba(${rgb}, 0.8)`);
        }
        ctx.fill();
        ctx.stroke();

        // --- TURRET ---
        if (!this.isDestroyed) {
            ctx.save();
            ctx.rotate(this.turretAngle - this.parent.a);
            ctx.strokeStyle = dynamicTurretColor;
            ctx.lineWidth = 2;
            ctx.shadowColor = dynamicTurretColor;
            ctx.shadowBlur = 15;
            
            // Turret Base
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            if (gameState.colorMode !== 'color') {
                ctx.fillStyle = '#0d021a';
            } else {
                const rgb = this.faction === 'ally' ? '0, 100, 100' : '0, 50, 100';
                ctx.fillStyle = getDynamicColor(`rgba(${rgb}, 0.5)`);
            }
            ctx.fill();
            ctx.stroke();

            // Turret Barrel
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(18, 0);
            ctx.stroke();
            
            ctx.restore();
        }
        ctx.restore();
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'source-over';
        
        if (!this.isDestroyed) {
            const barW = this.w; const barH = 5;
            const barX = this.x - barW / 2; const barY = this.y + this.h / 2 + 10;
            ctx.fillStyle = getDynamicColor("rgba(255, 0, 0, 0.5)"); ctx.fillRect(barX, barY, barW, barH);
            ctx.fillStyle = getDynamicColor("rgba(0, 255, 0, 0.7)"); ctx.fillRect(barX, barY, barW * (this.health / this.maxHealth), barH);
        }
    }
    takeDamage(amount, playerId) {
        if (this.isDestroyed) return;
        this.health -= amount; this.hitFlashTimer = 5;
        createSparks(this.x, this.y, 3); // NEW: Sparks on section hit
        if (this.health <= 0) {
            this.health = 0; this.isDestroyed = true;
            this.parent.onSectionDestroyed(this.x, this.y, playerId);
        } else {
            triggerScreenShake(amount, 10); triggerRumble(0.1 * amount, 0.1 * amount, 100);
        }
    }
}

export class Cruiser {
    constructor(faction = 'enemy') {
        this.r = 120; this.speed = 0.3; this.scale = 0.1; this.spawnTimer = 0;
        this.targetAngle = 0; this.isDead = false; this.isBoss = true;
        this.target = null;
        this.faction = faction;
        this.thrust = { x: 0, y: 0 }; // Needed for smoke parenting
        
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
        this.aiLogic(); 
        this.thrust.x = this.speed * Math.cos(this.a);
        this.thrust.y = this.speed * Math.sin(this.a);
        this.x += this.thrust.x; 
        this.y += this.thrust.y;
        this.sections.forEach(s => s.update(deltaTime));
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
        for (const t of potentialTargets) {
            const d = distBetweenPoints(this.x, this.y, t.x, t.y);
            if (d < minDist) {
                minDist = d;
                closestTarget = t;
            }
        }
        this.target = closestTarget;
    }
    aiLogic() {
        if (!this.target || (this.target.isDead || (this.target.lives !== undefined && this.target.lives <= 0))) {
            this.acquireTarget();
        }
        if (!this.target) return;
        
        const margin = 150; const idealDist = 400; const tooCloseDist = 250;
        let isOutOfBounds = this.x < margin || this.x > canvas.width - margin || this.y < margin || this.y > canvas.height - margin;
        if (isOutOfBounds) { const angleToCenter = Math.atan2(canvas.height / 2 - this.y, canvas.width / 2 - this.x); this.targetAngle = angleToCenter; } 
        else {
            const distToTarget = distBetweenPoints(this.x, this.y, this.target.x, this.target.y);
            const angleToTarget = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            if (distToTarget < tooCloseDist) this.targetAngle = angleToTarget + Math.PI;
            else if (distToTarget > idealDist) this.targetAngle = angleToTarget;
            else this.targetAngle = angleToTarget + Math.PI / 2;
        }
        const angleDifference = normalizeAngle(this.targetAngle - this.a); const turnSpeed = CORVETTE_TURN_SPEED * 0.4;
        if (Math.abs(angleDifference) > turnSpeed) this.a += Math.sign(angleDifference) * turnSpeed;
        else this.a = this.targetAngle;
        this.a = normalizeAngle(this.a);
    }
    draw() {
        const dynamicColor = getDynamicColor(this.faction === 'ally' ? NEON_ALLY_BODY : NEON_ENEMY_BODY);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.scale, this.scale);
        ctx.strokeStyle = getDynamicColor('#666');
        ctx.lineWidth = 10;
        ctx.shadowColor = dynamicColor;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        const center = this.sections[0]; const wing1 = this.sections[1]; const wing2 = this.sections[2];
        const cosA = Math.cos(this.a); const sinA = Math.sin(this.a);
        ctx.moveTo((center.offsetX * cosA - center.offsetY * sinA), (center.offsetX * sinA + center.offsetY * cosA));
        ctx.lineTo((wing1.offsetX * cosA - wing1.offsetY * sinA), (wing1.offsetX * sinA + wing1.offsetY * cosA));
        ctx.moveTo((center.offsetX * cosA - center.offsetY * sinA), (center.offsetX * sinA + center.offsetY * cosA));
        ctx.lineTo((wing2.offsetX * cosA - wing2.offsetY * sinA), (wing2.offsetX * sinA + wing2.offsetY * cosA));
        ctx.stroke();
        ctx.restore();
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
        if (this.faction === 'enemy') {
            awardScoreToPlayer(500, playerId);
        }
        triggerRumble(0.8, 0.8, 250); playExplosionSound(0.8, 0.6, 2000, 150);
        createExplosion(x, y, NEON_ORANGE, 50, 4); createShockwave(x, y, 150, NEON_ORANGE, 5, 2);
        if (this.sectionsRemaining <= 0) { this.handleFinalDeath(playerId); }
    }
    handleFinalDeath(playerId) {
        if (this.faction === 'enemy') {
            awardScoreToPlayer(5000, playerId);
            gameState.powerUps.push(new PowerUp(this.x, this.y));
            gameState.powerUps.push(new PowerUp(this.x + 40, this.y + 40));
            gameState.powerUps.push(new PowerUp(this.x - 40, this.y - 40));
        }
        triggerScreenShake(40, 120); triggerRumble(1.0, 1.0, 1500);
        playExplosionSound(1.0, 2.0, 4000, 50);
        createCapitalExplosion(this.x, this.y, this.r * 1.5); // NEW: Use capital explosion
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
            // Mines are only triggered by players for now.
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
        const dynamicColor = getDynamicColor(NEON_RED);
        ctx.save();
        ctx.strokeStyle = dynamicColor;
        ctx.fillStyle = getDynamicColor(`rgba(255, 0, 0, 0.2)`);
        ctx.shadowColor = dynamicColor;
        ctx.shadowBlur = 15;
        ctx.lineWidth = 1.5;
        let r = this.r;
        if (this.isTriggered) {
            const flash = Math.sin(this.fuseTimer * 0.02) > 0;
            if (flash) {
                r *= 1.5;
                ctx.shadowBlur = 25;
            }
        }
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + this.pulse * 0.2;
            const radius = i % 2 === 0 ? r : r * 0.6;
            ctx.lineTo(this.x + Math.cos(angle) * radius, this.y + Math.sin(angle) * radius);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
        ctx.restore();
    }
}

export class Minelayer {
    constructor(faction = 'enemy') {
        this.r = 25; this.health = MINELAYER_HEALTH; this.speed = MINELAYER_SPEED;
        this.mineCooldown = MINELAYER_MINE_COOLDOWN / 2;
        this.hitFlashTimer = 0; this.isDead = false; this.isBoss = false;
        this.faction = faction;
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
        // AI simplified to flee from the nearest threat of the OPPOSITE faction
        const threats = this.faction === 'enemy' 
            ? [...gameState.players.filter(p => p.lives > 0), ...gameState.allies.filter(a => !a.isDead)]
            : [...gameState.enemies.filter(e => !e.isDead)];

        let closestThreat = null; let minDist = Infinity;
        for (const t of threats) { 
            const d = distBetweenPoints(this.x, this.y, t.x, t.y); 
            if (d < minDist) { 
                minDist = d; 
                closestThreat = t; 
            } 
        }

        if (closestThreat && distBetweenPoints(this.x, this.y, closestThreat.x, closestThreat.y) < MINELAYER_AVOID_RADIUS) {
            const angleFromThreat = Math.atan2(this.y - closestThreat.y, this.x - closestThreat.x);
            this.a = normalizeAngle(angleFromThreat * 0.05 + this.a * 0.95);
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
        const bodyColor = this.faction === 'ally' ? NEON_ALLY_BODY : NEON_ENEMY_BODY;
        const dynamicColor = getDynamicColor(bodyColor);

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.a);
        if (this.hitFlashTimer > 0) { ctx.globalCompositeOperation = 'lighter'; }
        
        ctx.strokeStyle = dynamicColor;
        ctx.lineWidth = 2;
        ctx.shadowColor = dynamicColor;
        ctx.shadowBlur = 15;
        
        ctx.beginPath();
        ctx.moveTo(this.r, 0);
        ctx.lineTo(0, -this.r * 0.6);
        ctx.lineTo(-this.r * 0.8, 0);
        ctx.lineTo(0, this.r * 0.6);
        ctx.closePath();
        
        if (gameState.colorMode !== 'color') {
            ctx.fillStyle = '#0d021a'; // Game background color
        } else {
            const rgb = this.faction === 'ally' ? '0, 100, 50' : '100, 50, 0';
            ctx.fillStyle = getDynamicColor(`rgba(${rgb}, 0.5)`);
        }
        ctx.fill();
        ctx.stroke();
        
        ctx.restore();
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'source-over';
    }
    takeDamage(amount, hitX, hitY, isBomb = false, playerId = -1) {
        this.health -= amount; this.hitFlashTimer = 5;
        if (this.health <= 0) {
            if (this.faction === 'enemy') {
                awardScoreToPlayer(400, playerId);
                if (Math.random() < 0.5) gameState.powerUps.push(new PowerUp(this.x, this.y));
            }
            triggerRumble(0.5, 0.5, 200); playExplosionSound(0.7, 0.5);
            createExplosion(this.x, this.y, NEON_ORANGE, 40, 3);
            this.isDead = true;
        } else {
            triggerRumble(0.2 * amount, 0.1 * amount, 100);
        }
    }
}

export class Ace extends EnemyShip {
    constructor(faction = 'enemy') {
        super(faction);
        this.r = 12; this.health = ACE_HEALTH;
        this.shieldEnergy = ACE_SHIELD_ENERGY; this.shieldActive = false;
        this.shootCooldown = ACE_SHOOT_COOLDOWN / 1.8; 
        this.missileCooldown = ACE_MISSILE_COOLDOWN;
        this.isChargingMissile = false; this.missileChargeProgress = 0; this.hitFlashTimer = 0;
        
        // --- FSM Properties ---
        this.state = 'IDLE';
        this.stateTimer = 0;
        this.evasionTargetAngle = 0;
    }

    draw() {
        if (this.state === 'CHARGING_MISSILE') { 
            const dynamicColor = getDynamicColor(NEON_PINK);
            const glowSize = this.r * (1 + this.missileChargeProgress * 1.5); 
            ctx.fillStyle = getDynamicColor(`rgba(255, 0, 255, ${0.1 + this.missileChargeProgress * 0.3})`); 
            ctx.shadowColor = dynamicColor;
            ctx.shadowBlur = 20; 
            ctx.beginPath(); 
            ctx.arc(this.x, this.y, glowSize, 0, Math.PI * 2); 
            ctx.fill(); 
        }
        ctx.save();
        if (this.hitFlashTimer > 0) ctx.globalCompositeOperation = 'lighter';
        
        const bodyColor = this.faction === 'ally' ? NEON_ALLY_BODY : NEON_ENEMY_BODY;
        const accentColor = this.faction === 'ally' ? NEON_LIME : NEON_ENEMY_ACCENT;
        const dynamicBodyColor = getDynamicColor(bodyColor);
        const dynamicAccentColor = getDynamicColor(accentColor);
        const dynamicShieldColor = getDynamicColor(NEON_BLUE);
        
        // --- BODY ---
        ctx.strokeStyle = dynamicBodyColor;
        ctx.lineWidth = 2;
        ctx.shadowColor = dynamicBodyColor;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(this.x + this.r * 1.5 * Math.cos(this.a), this.y + this.r * 1.5 * Math.sin(this.a));
        ctx.lineTo(this.x + this.r * Math.cos(this.a + Math.PI * 0.75), this.y + this.r * Math.sin(this.a + Math.PI * 0.75));
        ctx.lineTo(this.x + this.r * 0.5 * Math.cos(this.a + Math.PI), this.y + this.r * 0.5 * Math.sin(this.a + Math.PI));
        ctx.lineTo(this.x + this.r * Math.cos(this.a - Math.PI * 0.75), this.y + this.r * Math.sin(this.a - Math.PI * 0.75));
        ctx.closePath();
        
        if (gameState.colorMode !== 'color') {
            ctx.fillStyle = '#0d021a'; // Game background color
            ctx.fill();
        }
        ctx.stroke();
        
        // --- ACCENTS ---
        ctx.strokeStyle = dynamicAccentColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.x + this.r * 0.8 * Math.cos(this.a), this.y + this.r * 0.8 * Math.sin(this.a));
        ctx.lineTo(this.x + this.r * 0.5 * Math.cos(this.a + Math.PI), this.y + this.r * 0.5 * Math.sin(this.a + Math.PI));
        ctx.stroke();
        ctx.restore();
        
        // --- SHIELD ---
        if (this.shieldActive) {
            ctx.fillStyle = getDynamicColor(`rgba(0, 170, 255, 0.2)`);
            ctx.strokeStyle = dynamicShieldColor;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r * 1.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
    }

    update(deltaTime) {
        this.runFSM(deltaTime); 

        this.a += this.rot;
        if (this.isThrusting) { this.thrust.x += ACE_THRUST * Math.cos(this.a); this.thrust.y += ACE_THRUST * Math.sin(this.a); }
        this.thrust.x *= FRICTION;
        this.thrust.y *= FRICTION;
        this.x += this.thrust.x;
        this.y += this.thrust.y;
        this.handleScreenWrap();

        if (this.shootCooldown > 0) this.shootCooldown -= deltaTime;
        if (this.missileCooldown > 0) this.missileCooldown -= deltaTime;
        if (this.hitFlashTimer > 0) this.hitFlashTimer--;
        if (this.stateTimer > 0) this.stateTimer -= deltaTime;
    }

    // --- FSM Main Method ---
    runFSM(deltaTime) {
        if (!this.target || (this.target.isDead || (this.target.lives !== undefined && this.target.lives <= 0))) {
            this.acquireTarget();
            if (!this.target) {
                this.state = 'IDLE';
            }
        }

        const immediateThreat = this.checkForImmediateThreats();
        if (immediateThreat && this.state !== 'EVADING') {
            this.state = 'EVADING';
            this.stateTimer = 1500; 
            this.evasionTargetAngle = immediateThreat.evasionAngle;
            return; 
        }

        switch (this.state) {
            case 'IDLE': this.handleIdleState(); break;
            case 'ENGAGING': this.handleEngagingState(); break;
            case 'EVADING': this.handleEvadingState(); break;
            case 'CHARGING_MISSILE': this.handleChargingMissileState(deltaTime); break;
        }
    }

    // --- State Handlers ---
    handleIdleState() {
        this.isThrusting = false;
        this.rot = ACE_TURN_SPEED * 0.2; 
        if (this.target) {
            this.state = 'ENGAGING';
        }
    }

    handleEngagingState() {
        if (!this.target) { this.state = 'IDLE'; return; }

        const distToTarget = distBetweenPoints(this.x, this.y, this.target.x, this.target.y);
        const angleToTarget = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        const angleDifference = Math.abs(normalizeAngle(this.a - angleToTarget));

        this.turnTowards(angleToTarget, ACE_TURN_SPEED);
        this.isThrusting = distToTarget > 250;

        if (this.missileCooldown <= 0 && distToTarget > 200 && angleDifference < degToRad(20)) {
            this.state = 'CHARGING_MISSILE';
            this.missileChargeProgress = 0;
        } 
        else if (this.shootCooldown <= 0 && angleDifference < degToRad(15)) {
            gameState.enemyBullets.push(new EnemyBullet(this));
            playEnemyShootSound();
            this.shootCooldown = ACE_SHOOT_COOLDOWN;
        }
    }
    
    handleEvadingState() {
        this.turnTowards(this.evasionTargetAngle, ACE_TURN_SPEED * 2);
        this.isThrusting = true;
        if (this.stateTimer <= 0) {
            this.state = 'ENGAGING';
        }
    }

    handleChargingMissileState(deltaTime) {
        this.isThrusting = false; 
        this.rot = 0; 
        this.missileChargeProgress += deltaTime / ACE_MISSILE_CHARGE_TIME;
        if (this.missileChargeProgress >= 1.0) { 
            this.fireMissileVolley(); 
            this.missileCooldown = ACE_MISSILE_COOLDOWN; 
            this.state = 'ENGAGING';
        }
    }
    
    // --- AI Helper Methods ---
    checkForImmediateThreats() {
        for (const ast of gameState.asteroids) {
            if (distBetweenPoints(this.x, this.y, ast.x, ast.y) < ACE_AVOID_RADIUS) {
                return { evasionAngle: Math.atan2(this.y - ast.y, this.x - ast.x) };
            }
        }
        const threatMissiles = this.faction === 'enemy' 
            ? gameState.missiles 
            : gameState.enemyMissiles;

        for (const m of threatMissiles) {
            if (distBetweenPoints(this.x, this.y, m.x, m.y) < ACE_AVOID_RADIUS + 50) {
                return { evasionAngle: Math.atan2(this.y - m.y, this.x - m.x) };
            }
        }
        return null;
    }

    fireMissileVolley() {
        playChargeLevelUpSound(); 
        const numToFire = 2; 
        const totalSpread = (numToFire - 1) * MISSILE_SPREAD_ANGLE_INCREMENT;
        const startAngleOffset = -totalSpread / 2;
        for (let i = 0; i < numToFire; i++) {
            const angleOffset = startAngleOffset + i * MISSILE_SPREAD_ANGLE_INCREMENT;
            const missile = new EnemyMissile(this);
            missile.a = normalizeAngle(this.a + angleOffset);
            gameState.enemyMissiles.push(missile);
        }
    }
    turnTowards(targetAngle, speed = ACE_TURN_SPEED) {
        const angleDifference = normalizeAngle(targetAngle - this.a);
        if (Math.abs(angleDifference) > speed) {
            this.rot = Math.sign(angleDifference) * speed;
        } else {
            this.rot = 0;
            this.a = targetAngle;
        }
    }

    takeDamage(amount, hitX, hitY, isBomb = false, playerId = -1) {
        this.hitFlashTimer = 5;
        if (this.shieldActive) {
            this.shieldEnergy -= amount;
            if (this.shieldEnergy < 0) this.shieldActive = false;
            const pan = (hitX - canvas.width / 2) / (canvas.width / 2);
            playShieldZapSound(pan);
            return;
        }
        this.health -= amount;
        if (this.health <= 0) {
            if (this.faction === 'enemy') {
                awardScoreToPlayer(500, playerId);
            }
            createExplosion(this.x, this.y, NEON_ORANGE, 40, 4);
            playExplosionSound(0.7, 0.6);
            triggerRumble(0.7, 0.4, 250);
            this.isDead = true;
        }
    }
}