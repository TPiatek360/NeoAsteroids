// src/fx/capitalExplosion.js
// Defines the class for the large, multi-stage capital ship explosion effect.

import { ctx } from '../ui/ui.js';
import { getDynamicColor } from '../utils.js';

const EXPLOSION_DURATION = 1500; // ms

export class CapitalExplosion {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.maxRadius = radius;
        this.life = EXPLOSION_DURATION;
        this.initialLife = this.life;

        // Properties for the occluding circle
        this.occlusionOffsetX = (Math.random() - 0.5) * radius * 0.2;
        this.occlusionOffsetY = (Math.random() - 0.5) * radius * 0.2;
    }

    update(deltaTime) {
        this.life -= deltaTime;
    }

    draw() {
        if (this.life <= 0) return;

        const lifeRatio = this.life / this.initialLife;
        const progress = 1.0 - lifeRatio; // Progress from 0 to 1

        ctx.save();

        // 1. The main fireball (expanding and fading)
        const fireballRadius = this.maxRadius * Math.min(progress * 4, 1);
        const fireballAlpha = lifeRatio * 1.5; // Starts bright and fades
        
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, fireballRadius);
        gradient.addColorStop(0, getDynamicColor(`rgba(255, 255, 255, ${fireballAlpha})`));
        gradient.addColorStop(0.5, getDynamicColor(`rgba(255, 255, 180, ${fireballAlpha * 0.8})`));
        gradient.addColorStop(1, getDynamicColor(`rgba(255, 180, 0, ${fireballAlpha * 0.3})`));
        
        ctx.globalAlpha = Math.min(1, fireballAlpha);
        ctx.fillStyle = gradient;
        ctx.shadowColor = getDynamicColor('white');
        ctx.shadowBlur = 40;

        ctx.beginPath();
        ctx.arc(this.x, this.y, fireballRadius, 0, Math.PI * 2);
        ctx.fill();


        // 2. The occluding circle (starts later and expands faster)
        if (progress > 0.1) {
            const occlusionProgress = (progress - 0.1) / 0.9;
            const occlusionRadius = this.maxRadius * 1.2 * occlusionProgress;
            
            // Use destination-out to "cut out" from the fireball
            ctx.globalCompositeOperation = 'destination-out';
            
            ctx.fillStyle = 'black'; // Color doesn't matter, only alpha
            ctx.shadowBlur = 0;

            ctx.beginPath();
            ctx.arc(this.x + this.occlusionOffsetX, this.y + this.occlusionOffsetY, occlusionRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}