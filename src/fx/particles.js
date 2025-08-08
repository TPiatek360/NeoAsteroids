// src/fx/particles.js
// Defines classes for particles used in explosions and smoke trails.

import { ctx } from '../ui/ui.js';
import { getDynamicColor } from '../utils.js';
import { MISSILE_SMOKE_LIFETIME } from '../constants.js';
import { NEON_ALLY_BODY, NEON_ENEMY_BODY } from '../constants.js';

export class Particle {
    constructor(x, y, color, maxSpeed = 2, lifetime = null) {
        this.x = x;
        this.y = y;
        this.r = Math.random() * 2 + 1;
        this.color = color;
        this.life = lifetime !== null ? lifetime : Math.random() * 500 + 500;
        this.initialLife = this.life;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * maxSpeed;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.friction = 0.98;
    }

    draw() {
        const lifeRatio = this.life / this.initialLife;
        if (lifeRatio <= 0) return;
        const dynamicColor = getDynamicColor(this.color);
        ctx.save();
        ctx.globalAlpha = lifeRatio;
        ctx.fillStyle = dynamicColor;
        ctx.shadowColor = dynamicColor;
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    update(deltaTime) {
        this.life -= deltaTime;
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.x += this.vx;
        this.y += this.vy;
    }
}

export class SmokeParticle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.r = Math.random() * 3 + 2;
        this.life = MISSILE_SMOKE_LIFETIME;
        this.initialLife = MISSILE_SMOKE_LIFETIME;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = (Math.random() - 0.5) * 0.3;
    }

    draw() {
        const lifeRatio = this.life / this.initialLife;
        if (lifeRatio <= 0) {
            return;
        }
        const opacity = lifeRatio * 0.5;
        const currentRadius = this.r * lifeRatio;
        ctx.fillStyle = getDynamicColor(`rgba(128, 128, 128, ${opacity})`);
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    update(deltaTime) {
        this.life -= deltaTime;
        this.x += this.vx;
        this.y += this.vy;
    }
}

// --- NEW: Damage Smoke Particle ---
export class DamageSmoke {
    constructor(parentShip) {
        this.parent = parentShip;
        this.faction = parentShip.faction;
        this.offsetX = (Math.random() - 0.5) * parentShip.r * 0.8;
        this.offsetY = (Math.random() - 0.5) * parentShip.r * 0.8;
        this.x = parentShip.x + this.offsetX;
        this.y = parentShip.y + this.offsetY;
        this.r = Math.random() * 4 + 3;
        this.life = Math.random() * 1500 + 1000;
        this.initialLife = this.life;
        this.color = this.faction === 'ally' ? NEON_ALLY_BODY : NEON_ENEMY_BODY;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
    }

    update(deltaTime) {
        this.life -= deltaTime;
        if (this.life <= 0 || this.parent.isDead) {
            return;
        }
        this.x += this.vx + this.parent.thrust.x;
        this.y += this.vy + this.parent.thrust.y;
    }

    draw() {
        if (this.life <= 0) return;
        const lifeRatio = this.life / this.initialLife;
        const opacity = lifeRatio * 0.4;
        const radius = this.r * (1 + (1 - lifeRatio) * 2); // Expands as it fades

        const dynamicColor = getDynamicColor(this.color);
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.fillStyle = dynamicColor;
        ctx.shadowColor = dynamicColor;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// --- NEW: Spark Particle ---
export class Spark {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.life = Math.random() * 250 + 100; // Lives for a very short time
        this.initialLife = this.life;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.r = Math.random() * 2 + 1;
    }

    update(deltaTime) {
        this.life -= deltaTime;
        this.x += this.vx;
        this.y += this.vy;
    }

    draw() {
        if (this.life <= 0) return;
        const lifeRatio = this.life / this.initialLife;
        let color;

        // Color transition: White -> Yellow -> Orange -> Red
        if (lifeRatio > 0.75) {
            color = `rgb(255, 255, 255)`; // White
        } else if (lifeRatio > 0.5) {
            color = `rgb(255, 255, 0)`;   // Yellow
        } else if (lifeRatio > 0.25) {
            color = `rgb(255, 165, 0)`;   // Orange
        } else {
            color = `rgb(255, 0, 0)`;     // Red
        }

        const dynamicColor = getDynamicColor(color);
        ctx.save();
        ctx.globalAlpha = lifeRatio;
        ctx.fillStyle = dynamicColor;
        ctx.shadowColor = dynamicColor;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}