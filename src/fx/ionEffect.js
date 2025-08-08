// src/fx/ionEffect.js
// Defines the class and logic for the ion cannon / electrical damage effect.

import { ctx } from '../ui/ui.js';
import { getDynamicColor } from '../utils.js';

const ION_LIFETIME = 800; // ms
const SEGMENT_LENGTH = 15;
const JAGGEDNESS = 0.4;

export class IonEffect {
    constructor(targetShip) {
        this.parent = targetShip;
        this.life = ION_LIFETIME;
        this.initialLife = this.life;
        this.bolts = []; // An array to hold multiple lightning bolts

        // Create a few bolts for a more dramatic effect
        for (let i = 0; i < 3; i++) {
            this.createBolt();
        }
    }
    
    /**
     * Generates a single lightning bolt originating from the parent ship's center.
     */
    createBolt() {
        const segments = [];
        const startAngle = Math.random() * Math.PI * 2;
        const endRadius = this.parent.r * (Math.random() * 1.5 + 1.5);
        
        let currentPoint = { x: 0, y: 0 };
        let currentAngle = startAngle;
        let totalLength = 0;

        segments.push(currentPoint);

        while (totalLength < endRadius) {
            const segmentLen = Math.random() * SEGMENT_LENGTH + (SEGMENT_LENGTH / 2);
            currentAngle += (Math.random() - 0.5) * JAGGEDNESS * 2;

            const nextPoint = {
                x: currentPoint.x + Math.cos(currentAngle) * segmentLen,
                y: currentPoint.y + Math.sin(currentAngle) * segmentLen
            };

            segments.push(nextPoint);
            currentPoint = nextPoint;
            totalLength += segmentLen;
        }
        
        this.bolts.push(segments);
    }
    
    update(deltaTime) {
        this.life -= deltaTime;

        // Occasionally regenerate the bolts to make the effect dynamic
        if (Math.random() < 0.2) {
            this.bolts = [];
            for (let i = 0; i < 3; i++) {
                this.createBolt();
            }
        }
    }

    draw() {
        if (this.life <= 0 || this.parent.isDead) return;

        const lifeRatio = this.life / this.initialLife;

        ctx.save();
        ctx.translate(this.parent.x, this.parent.y);
        ctx.globalAlpha = lifeRatio;

        this.bolts.forEach(segments => {
            // 1. Draw the halo/glow
            ctx.strokeStyle = getDynamicColor('rgba(100, 100, 255, 0.4)'); // Purplish-blue glow
            ctx.lineWidth = 8;
            ctx.shadowColor = getDynamicColor('rgba(0, 100, 255, 0.8)');
            ctx.shadowBlur = 20;

            ctx.beginPath();
            ctx.moveTo(segments[0].x, segments[0].y);
            for (let i = 1; i < segments.length; i++) {
                ctx.lineTo(segments[i].x, segments[i].y);
            }
            ctx.stroke();

            // 2. Draw the bright white core
            ctx.strokeStyle = getDynamicColor('rgba(255, 255, 255, 0.9)');
            ctx.lineWidth = 2;
            ctx.shadowColor = getDynamicColor('white');
            ctx.shadowBlur = 10;
            
            ctx.beginPath();
            ctx.moveTo(segments[0].x, segments[0].y);
            for (let i = 1; i < segments.length; i++) {
                ctx.lineTo(segments[i].x, segments[i].y);
            }
            ctx.stroke();
        });

        ctx.restore();
    }
}