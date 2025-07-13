// src/fx/shockwave.js
// Defines the class and creation logic for the shockwave/ripple visual effect.

import { gameState } from '../state.js';
import { ctx } from '../ui/ui.js';

export class Shockwave {
    /**
     * @param {number} x The starting X coordinate.
     * @param {number} y The starting Y coordinate.
     * @param {number} maxRadius The maximum radius the wave will expand to.
     * @param {string} color The color of the wave.
     * @param {number} speed The speed at which the radius expands.
     * @param {number} initialLineWidth The starting width of the wave's line.
     */
    constructor(x, y, maxRadius, color, speed, initialLineWidth) {
        this.x = x;
        this.y = y;
        this.maxRadius = maxRadius;
        this.color = color;
        this.speed = speed;
        this.initialLineWidth = initialLineWidth;

        this.radius = 0;
        this.life = 1.0; // Represents the life from 1 (full) to 0 (dead)
    }

    update(deltaTime) {
        // Expand the radius based on speed and deltaTime
        this.radius += this.speed * (deltaTime / 16.67); // Normalize speed to 60fps

        // The wave dies when it reaches its maximum radius
        if (this.radius >= this.maxRadius) {
            this.life = 0;
        } else {
            // Life is the inverse of the radius progress
            this.life = 1.0 - (this.radius / this.maxRadius);
        }
    }

    draw() {
        if (this.life <= 0) return;

        ctx.save();
        // The alpha and line width fade out as the wave expands (life decreases)
        ctx.globalAlpha = this.life * 0.8;
        ctx.lineWidth = this.life * this.initialLineWidth;
        ctx.strokeStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }
}

/**
 * Creates a shockwave and adds it to the game state.
 */
export function createShockwave(x, y, maxRadius, color, speed, lineWidth) {
    gameState.shockwaves.push(new Shockwave(x, y, maxRadius, color, speed, lineWidth));
}