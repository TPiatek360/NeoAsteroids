// src/fx/particles.js
// Defines classes for particles used in explosions and smoke trails.

import { ctx } from '../ui/ui.js';
import { MISSILE_SMOKE_LIFETIME } from '../constants.js';

export class Particle {
    constructor(x, y, color, maxSpeed = 2) {
        this.x = x;
        this.y = y;
        this.r = Math.random() * 2 + 1;
        this.color = color;
        this.life = Math.random() * 500 + 500;
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
        ctx.save();
        ctx.globalAlpha = lifeRatio;
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
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
        ctx.fillStyle = `rgba(128, 128, 128, ${opacity})`;
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