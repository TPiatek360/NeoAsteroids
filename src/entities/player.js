// src/entities/Player.js
// Defines the Player class.

import { canvas, ctx } from '../ui/ui.js';
import { gameState } from '../state.js';
import { degToRad } from '../utils.js';
import {
    PLAYER_SIZE,
    NEON_CYAN,
    NEON_PINK,
    NEON_BLUE,
    SHIELD_MAX_ENERGY,
    SHIELD_DRAIN_RATE,
    SHIELD_RECHARGE_DELAY,
    SHIELD_RECHARGE_RATE,
    PLAYER_THRUST,
    FRICTION,
    PLAYER_RESPAWN_INVINCIBILITY
} from '../constants.js';

export class Player {
    constructor(id, inputConfig, playerNum, color = NEON_CYAN) {
        this.id = id; // 0 for P1, 1 for P2, etc.
        this.inputConfig = inputConfig; // e.g., { type: 'keyboard1' } or { type: 'gamepad', index: 0 }
        this.playerNum = playerNum; // 1 or 2 for display
        this.color = color;
        
        // Position players differently in multiplayer
        this.x = canvas.width / (gameState.gameMode === 'twoPlayer' ? 3 : 2) * playerNum;
        this.y = canvas.height / 2;
        
        this.r = PLAYER_SIZE / 2;
        this.a = degToRad(270);
        this.rot = 0;
        this.isThrusting = false;
        this.thrust = { x: 0, y: 0 };
        this.gunCooldown = 0;
        this.hitFlashTimer = 0;
        this.invincibilityFrames = PLAYER_RESPAWN_INVINCIBILITY;
        this.inputCooldown = 150; // ms, to prevent menu input from bleeding into the game

        // Player-specific stats, moved from global state
        this.score = 0;
        this.lives = 3;
        this.missileCount = 3;
        this.isChargingMissile = false;
        this.missileChargeLevel = 0;
        this.missileChargeProgress = 0;
        this.gamepadButtonsPressed = {}; // Initialize here for clarity

        // Shield state
        this.shieldInput = false;
        this.shieldActive = false;
        this.shieldWasActive = false;
        this.shieldEnergy = SHIELD_MAX_ENERGY;
        this.shieldRechargeTimer = 0;
        this.shieldHitTimer = 0; // For visual effect
        
        this.powerupTimers = { rapidFire: 0, spreadShot: 0 };
    }

    triggerShieldHitEffect() {
        this.shieldHitTimer = 10; // Effect lasts for 10 frames
    }

    draw() {
        if (this.lives <= 0) return; // Do not draw dead players

        ctx.save();
        if (this.hitFlashTimer > 0) {
            ctx.globalCompositeOperation = 'lighter';
        }
        const playerColor = this.invincibilityFrames > 0 && Math.floor(this.invincibilityFrames / 10) % 2 === 0 ? 'grey' : this.color;
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
            let shieldRadius = this.r * 1.5;
            let shieldOpacity = 0.2 + (Math.sin(Date.now() / 100) * 0.1); // Gentle continuous pulse
            let shieldLineWidth = 1;

            if (this.shieldHitTimer > 0) {
                const hitProgress = this.shieldHitTimer / 10; // From 1 down to 0
                shieldRadius = this.r * (1.5 + 0.3 * hitProgress); // Pulse wider on hit
                shieldOpacity = 0.2 + 0.5 * hitProgress; // Pulse brighter on hit
                shieldLineWidth = 1 + 1.5 * hitProgress; // Pulse thicker on hit
            }

            ctx.fillStyle = `rgba(0, 170, 255, ${shieldOpacity})`;
            ctx.strokeStyle = NEON_BLUE;
            ctx.lineWidth = shieldLineWidth;
            ctx.shadowColor = NEON_BLUE;
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.arc(this.x, this.y, shieldRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
        if (this.isThrusting && this.invincibilityFrames <= 0) {
            ctx.fillStyle = NEON_PINK;
            ctx.strokeStyle = '#ff80df';
            ctx.shadowColor = NEON_PINK;
            ctx.shadowBlur = 15;
            ctx.lineWidth = 1;
            const backLeftX = this.x + this.r * Math.cos(this.a + Math.PI * 0.8);
            const backLeftY = this.y + this.r * Math.sin(this.a + Math.PI * 0.8);
            const backRightX = this.x + this.r * Math.cos(this.a - Math.PI * 0.8);
            const backRightY = this.y + this.r * Math.sin(this.a - Math.PI * 0.8);
            const rearMidX = (backLeftX + backRightX) / 2;
            const rearMidY = (backLeftY + backRightY) / 2;
            const flameLength = this.r * 1.5 + Math.random() * this.r;
            const flameTipX = rearMidX - flameLength * Math.cos(this.a);
            const flameTipY = rearMidY - flameLength * Math.sin(this.a);
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
        if (this.lives <= 0) return; // Don't update dead players

        // This must be done *before* input is processed.
        if (this.inputCooldown > 0) this.inputCooldown -= deltaTime;

        this.shieldActive = this.shieldInput && this.shieldEnergy > 0;
        if (this.shieldActive) {
            this.shieldEnergy -= SHIELD_DRAIN_RATE * (deltaTime / 1000);
            this.shieldRechargeTimer = SHIELD_RECHARGE_DELAY;
        } else if (gameState.shieldMode === 'regenerate') { // Shield only recharges in this mode
            if (this.shieldRechargeTimer > 0) {
                this.shieldRechargeTimer -= deltaTime;
            } else if (this.shieldEnergy < SHIELD_MAX_ENERGY) {
                this.shieldEnergy += SHIELD_RECHARGE_RATE * (deltaTime / 1000);
            }
        }
        this.shieldEnergy = Math.max(0, Math.min(SHIELD_MAX_ENERGY, this.shieldEnergy));
        this.a += this.rot;
        if (this.isThrusting) {
            this.thrust.x += PLAYER_THRUST * Math.cos(this.a);
            this.thrust.y += PLAYER_THRUST * Math.sin(this.a);
        }
        this.thrust.x *= FRICTION;
        this.thrust.y *= FRICTION;
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