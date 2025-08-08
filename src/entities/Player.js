// src/entities/Player.js
// Defines the Player class.

import { canvas, ctx } from '../ui/ui.js';
import { gameState } from '../state.js';
import { degToRad, getDynamicColor, normalizeAngle } from '../utils.js';
import {
    PLAYER_SIZE,
    NEON_CYAN,
    NEON_PINK,
    NEON_BLUE,
    SHIELD_MAX_ENERGY,
    SHIELD_DRAIN_RATE,
    SHIELD_RECHARGE_DELAY,
    SHIELD_RECHARGE_RATE,
    PLAYER_RESPAWN_INVINCIBILITY,
    PLAYER_THRUST,
    FRICTION,
    PLAYER_BASE_MAX_LIVES,
    PLAYER_BASE_MAX_MISSILES,
    GAME_HARD_CAP_LIVES,
    GAME_HARD_CAP_MISSILES
} from '../constants.js';

export class Player {
    constructor(id, inputConfig, playerNum, color = NEON_CYAN) {
        this.id = id; 
        this.inputConfig = inputConfig; 
        this.playerNum = playerNum; 
        this.color = color;
        
        this.x = canvas.width / (gameState.playerCount > 1 ? 3 : 2) * (this.playerNum);
        this.y = canvas.height / 2;
        
        this.r = PLAYER_SIZE / 2;
        this.a = degToRad(270);
        this.rot = 0;
        this.isThrusting = false;
        this.isBraking = false; // NEW for Newtonian mode
        this.thrust = { x: 0, y: 0 };
        this.gunCooldown = 0;
        this.hitFlashTimer = 0;
        this.invincibilityFrames = PLAYER_RESPAWN_INVINCIBILITY;
        this.inputCooldown = 150; 
        this.isInvincible = false;

        this.score = 0;
        this.lives = 3;
        this.missileCount = 3;
        this.isChargingMissile = false;
        this.missileChargeLevel = 0;
        this.missileChargeProgress = 0;
        this.gamepadButtonsPressed = {};
        
        this.currency = 0;
        this.upgrades = { maxLives: 0, maxMissiles: 0 }; 

        this.shieldInput = false;
        this.shieldActive = false;
        this.shieldWasActive = false;
        this.shieldEnergy = SHIELD_MAX_ENERGY;
        this.shieldRechargeTimer = 0;
        this.shieldHitTimer = 0; 
        this.shieldFlash = { active: false, x: 0, y: 0, progress: 0 };
        
        this.powerupTimers = { rapidFire: 0, spreadShot: 0 };
    }

    getMaxLives() {
        const upgradedMax = PLAYER_BASE_MAX_LIVES + (this.upgrades.maxLives || 0);
        return Math.min(upgradedMax, GAME_HARD_CAP_LIVES);
    }

    getMaxMissiles() {
        const upgradedMax = PLAYER_BASE_MAX_MISSILES + (this.upgrades.maxMissiles || 0);
        return Math.min(upgradedMax, GAME_HARD_CAP_MISSILES);
    }

    triggerShieldHitEffect() {
        this.shieldHitTimer = 10; 
    }

    triggerShieldFlash(hitX, hitY) {
        this.shieldFlash.active = true;
        this.shieldFlash.progress = 0;
        this.shieldFlash.x = hitX;
        this.shieldFlash.y = hitY;
    }

    draw() {
        if (this.lives <= 0) return; 

        ctx.save();
        if (this.hitFlashTimer > 0) {
            ctx.globalCompositeOperation = 'lighter';
        }
        
        const dynamicPlayerColor = getDynamicColor(this.color);
        const playerColor = this.invincibilityFrames > 0 && Math.floor(this.invincibilityFrames / 10) % 2 === 0 
            ? getDynamicColor('grey') 
            : dynamicPlayerColor;

        ctx.strokeStyle = playerColor;
        ctx.lineWidth = 2;
        ctx.shadowColor = playerColor;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        const noseMultiplier = 1.25;
        ctx.moveTo(this.x + this.r * noseMultiplier * Math.cos(this.a), this.y + this.r * noseMultiplier * Math.sin(this.a));
        ctx.lineTo(this.x + this.r * Math.cos(this.a + Math.PI * 0.8), this.y + this.r * Math.sin(this.a + Math.PI * 0.8));
        ctx.lineTo(this.x + this.r * Math.cos(this.a - Math.PI * 0.8), this.y + this.r * Math.sin(this.a - Math.PI * 0.8));
        ctx.closePath();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();

        if (this.shieldActive) {
            const dynamicShieldColor = getDynamicColor(NEON_BLUE);
            if (this.shieldFlash.active) {
                ctx.save();
                
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.r * 1.5, 0, Math.PI * 2);
                ctx.clip();
                
                const waveProgress = this.shieldFlash.progress;
                const waveRadius = (this.r * 3) * waveProgress; 
                const waveOpacity = 1 - waveProgress;
                
                ctx.beginPath();
                ctx.arc(this.shieldFlash.x, this.shieldFlash.y, waveRadius, 0, Math.PI * 2);
                ctx.strokeStyle = getDynamicColor(`rgba(200, 255, 255, ${waveOpacity * 0.9})`);
                ctx.lineWidth = 5 * waveOpacity;
                ctx.stroke();
                
                ctx.restore(); 
            }

            let shieldRadius = this.r * 1.5;
            let shieldOpacity = 0.2 + (Math.sin(Date.now() / 100) * 0.1); 
            let shieldLineWidth = 1;

            if (this.shieldHitTimer > 0) {
                const hitProgress = this.shieldHitTimer / 10;
                shieldRadius = this.r * (1.5 + 0.3 * hitProgress); 
                shieldOpacity = 0.2 + 0.5 * hitProgress;
                shieldLineWidth = 1 + 1.5 * hitProgress;
            }
            
            ctx.fillStyle = getDynamicColor(`rgba(0, 170, 255, ${shieldOpacity})`);
            ctx.strokeStyle = dynamicShieldColor;
            ctx.lineWidth = shieldLineWidth;
            ctx.shadowColor = dynamicShieldColor;
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.arc(this.x, this.y, shieldRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // --- REVISED: Draw thrust flame for both thrusting and braking ---
        if ((this.isThrusting || this.isBraking) && this.invincibilityFrames <= 0) {
            const dynamicThrustColor = getDynamicColor(NEON_PINK);
            ctx.fillStyle = dynamicThrustColor;
            ctx.strokeStyle = getDynamicColor('#ff80df');
            ctx.shadowColor = dynamicThrustColor;
            ctx.shadowBlur = 15;
            ctx.lineWidth = 1;
            
            // Determine flame direction based on action
            const flameAngle = this.isBraking ? this.a + Math.PI : this.a;

            const backLeftX = this.x + this.r * Math.cos(flameAngle + Math.PI * 0.8);
            const backLeftY = this.y + this.r * Math.sin(flameAngle + Math.PI * 0.8);
            const backRightX = this.x + this.r * Math.cos(flameAngle - Math.PI * 0.8);
            const backRightY = this.y + this.r * Math.sin(flameAngle - Math.PI * 0.8);
            const rearMidX = (backLeftX + backRightX) / 2;
            const rearMidY = (backLeftY + backRightY) / 2;
            const flameLength = this.r * 1.5 + Math.random() * this.r;
            // Point the flame away from the direction of thrust/braking
            const flameTipX = rearMidX - flameLength * Math.cos(flameAngle);
            const flameTipY = rearMidY - flameLength * Math.sin(flameAngle);

            ctx.beginPath();
            ctx.moveTo(backLeftX, backLeftY);
            ctx.lineTo(flameTipX + (Math.random() * 6 - 3), flameTipY + (Math.random() * 6 - 3));
            ctx.lineTo(backRightX, backRightY);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }

    update(deltaTime) {
        if (this.lives <= 0) return; 

        if (this.inputCooldown > 0) this.inputCooldown -= deltaTime;

        if (this.shieldFlash.active) {
            this.shieldFlash.progress += deltaTime / 200; 
            if (this.shieldFlash.progress >= 1) {
                this.shieldFlash.active = false;
            }
        }

        this.shieldActive = this.shieldInput && this.shieldEnergy > 0;
        if (this.shieldActive) {
            this.shieldEnergy -= SHIELD_DRAIN_RATE * (deltaTime / 1000);
            this.shieldRechargeTimer = SHIELD_RECHARGE_DELAY;
        } else if (gameState.shieldMode === 'regenerate') { 
            if (this.shieldRechargeTimer > 0) {
                this.shieldRechargeTimer -= deltaTime;
            } else if (this.shieldEnergy < SHIELD_MAX_ENERGY) {
                this.shieldEnergy += SHIELD_RECHARGE_RATE * (deltaTime / 1000);
            }
        }
        this.shieldEnergy = Math.max(0, Math.min(SHIELD_MAX_ENERGY, this.shieldEnergy));
        
        // --- REVISED: Physics and Controls based on Flight Model ---
        this.a += this.rot;
        
        const velocityMagnitude = Math.sqrt(this.thrust.x * this.thrust.x + this.thrust.y * this.thrust.y);
        this.isBraking = false; // Reset braking state each frame

        if (this.isThrusting) {
            this.thrust.x += PLAYER_THRUST * Math.cos(this.a);
            this.thrust.y += PLAYER_THRUST * Math.sin(this.a);

            if (gameState.flightModel === 'newtonian' && velocityMagnitude > 0.1) {
                const angleOfVelocity = Math.atan2(this.thrust.y, this.thrust.x);
                const angleDifference = Math.abs(normalizeAngle(this.a - angleOfVelocity));
                // If thrusting roughly opposite to velocity, it's considered braking
                if (angleDifference > Math.PI * 0.75) { 
                    this.isBraking = true;
                }
            }
        }

        // Apply friction only in Arcade mode
        if (gameState.flightModel === 'arcade') {
            this.thrust.x *= FRICTION;
            this.thrust.y *= FRICTION;
        }
        
        this.x += this.thrust.x;
        this.y += this.thrust.y;
        this.handleScreenWrap();
        
        if (this.invincibilityFrames > 0) this.invincibilityFrames--;
        if (this.gunCooldown > 0) this.gunCooldown -= deltaTime;
        if (this.hitFlashTimer > 0) this.hitFlashTimer--;
        if (this.shieldHitTimer > 0) this.shieldHitTimer--;
        for (let key in this.powerupTimers) {
            if (this.powerupTimers[key] > 0) this.powerupTimers[key] -= deltaTime;
        }
    }
    handleScreenWrap() {
        if (this.x < 0 - this.r) this.x = canvas.width + this.r;
        if (this.x > canvas.width + this.r) this.x = 0 - this.r;
        if (this.y < 0 - this.r) this.y = canvas.height + this.r;
        if (this.y > canvas.height + this.r) this.y = 0 - this.r;
    }
}