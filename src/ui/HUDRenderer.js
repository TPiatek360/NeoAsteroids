// src/ui/HUDRenderer.js
// Renders the game's HUD directly onto the canvas.

import { gameState } from '../state.js';
import { ctx } from './ui.js';
import { getDynamicColor } from '../utils.js';
import { MAX_CHARGE_LEVEL, SHIELD_MAX_ENERGY, NEON_ORANGE, NEON_BLUE } from '../constants.js';

// --- Helper Functions ---

function drawText(text, x, y, { color = '#00ffff', size = '1.2em', align = 'left', shadow = true }) {
    const dynamicColor = getDynamicColor(color);
    ctx.save();
    ctx.font = `500 ${size} 'Orbitron', sans-serif`;
    ctx.textAlign = align;
    ctx.fillStyle = dynamicColor;
    if (shadow) {
        ctx.shadowColor = dynamicColor;
        ctx.shadowBlur = 8;
    }
    ctx.fillText(text, x, y);
    ctx.restore();
}

function drawBar(x, y, width, height, fillPercent, barColor, borderColor) {
    const dynamicBarColor = getDynamicColor(barColor);
    const fillWidth = width * (fillPercent / 100);

    ctx.save();

    if (gameState.colorMode === 'color') {
        // --- Original Color Mode Rendering ---
        const dynamicBorderColor = getDynamicColor(borderColor);

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.strokeStyle = dynamicBorderColor;
        ctx.lineWidth = 1;
        ctx.fillRect(x, y, width, height);
        ctx.strokeRect(x, y, width, height);

        // Fill
        ctx.fillStyle = dynamicBarColor;
        ctx.shadowColor = dynamicBarColor;
        ctx.shadowBlur = 10;
        if (fillWidth > 0) {
            ctx.fillRect(x, y, fillWidth, height);
        }

    } else {
        // --- FIX: High-Contrast Monochrome Mode Rendering ---
        
        // 1. Draw the outer border
        ctx.strokeStyle = dynamicBarColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);

        // 2. Draw the solid fill portion
        if (fillWidth > 0) {
            ctx.fillStyle = dynamicBarColor;
            ctx.shadowColor = dynamicBarColor;
            ctx.shadowBlur = 10;
            ctx.fillRect(x, y, fillWidth, height);
        }

        // 3. Draw a pattern in the unfilled portion for contrast
        const unfilledX = x + fillWidth;
        const unfilledWidth = width - fillWidth;
        if (unfilledWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(unfilledX, y, unfilledWidth, height);
            ctx.clip(); // Only draw pattern within the unfilled area

            ctx.strokeStyle = dynamicBarColor;
            ctx.globalAlpha = 0.3; // Make the pattern faint but visible
            ctx.lineWidth = 1;
            ctx.shadowBlur = 0; // No shadow for the pattern lines

            // Draw diagonal lines across the clipped area
            for (let i = -height; i < unfilledWidth; i += 4) {
                ctx.beginPath();
                ctx.moveTo(unfilledX + i, y);
                ctx.lineTo(unfilledX + i + height, y + height);
                ctx.stroke();
            }
            ctx.restore();
        }
    }
    
    ctx.restore();
}

function drawChargeSegments(x, y, width, height) {
    ctx.save();
    for (let i = 1; i < MAX_CHARGE_LEVEL; i++) {
        const segmentX = x + (i / MAX_CHARGE_LEVEL) * width;
        ctx.fillStyle = getDynamicColor('rgba(255, 170, 0, 0.5)');
        ctx.fillRect(segmentX, y, 1, height);
    }
    ctx.restore();
}


function drawMutatorList() {
    if (!gameState.mutators || gameState.mutators.displayTimer <= 0 || !gameState.mutators.descriptions) {
        return;
    }

    const lifeRatio = gameState.mutators.displayTimer / 10000; // 0 to 1
    const alpha = Math.min(1, lifeRatio * 4); // Fade in and out

    ctx.save();
    ctx.globalAlpha = alpha;
    
    const xPos = ctx.canvas.width / 2;
    let yPos = ctx.canvas.height * 0.25;

    drawText("DAILY CHALLENGE", xPos, yPos, {
        color: '#ffaa00',
        size: '1.5em',
        align: 'center'
    });
    
    yPos += 40;

    gameState.mutators.descriptions.forEach(desc => {
        drawText(`- ${desc}`, xPos, yPos, {
            color: '#00ffff',
            size: '1.1em',
            align: 'center'
        });
        yPos += 25;
    });

    ctx.restore();
}


// --- Core Player HUD ---

function drawPlayerHUD(player, align) {
    const isLeft = align === 'left';
    const xPos = isLeft ? 20 : ctx.canvas.width - 20;
    let yPos = 30;

    const hudColor = player.color;
    const shadowStyle = { color: hudColor, shadow: true };

    // Score
    drawText(`SCORE: ${player.score}`, xPos, yPos, { ...shadowStyle, align });
    yPos += 25;

    // Lives
    let livesString = '';
    if (player.isInvincible) {
        livesString = 'GOD';
    } else {
        for (let i = 0; i < player.lives; i++) livesString += '▲ ';
    }
    drawText(`LIVES: ${livesString}`, xPos, yPos, { ...shadowStyle, align });
    yPos += 25;

    // Missiles - FIX: Display current / max
    drawText(`MISSILES: ${player.missileCount} / ${player.getMaxMissiles()}`, xPos, yPos, { ...shadowStyle, align });
    yPos += 25;

    // Charge Bar
    const barWidth = 150;
    const barHeight = 15;
    const barX = isLeft ? xPos : xPos - barWidth;
    let chargeFill = 0;
    if (player.isChargingMissile && player.missileCount > 0) {
        const totalProgress = player.missileChargeLevel + player.missileChargeProgress;
        chargeFill = (totalProgress / MAX_CHARGE_LEVEL) * 100;
    }
    drawBar(barX, yPos, barWidth, barHeight, chargeFill, NEON_ORANGE, NEON_ORANGE);
    drawChargeSegments(barX, yPos, barWidth, barHeight);
    yPos += 25;

    // Shield Bar
    const shieldFill = (player.shieldEnergy / SHIELD_MAX_ENERGY) * 100;
    drawBar(barX, yPos, barWidth, barHeight, shieldFill, NEON_BLUE, NEON_BLUE);
    yPos += 25;

    // Powerup Status
    let powerupText = '';
    if (player.powerupTimers.rapidFire > 0) powerupText += `RAPID FIRE: ${Math.ceil(player.powerupTimers.rapidFire / 1000)}s `;
    if (player.powerupTimers.spreadShot > 0) powerupText += `SPREAD SHOT: ${Math.ceil(player.powerupTimers.spreadShot / 1000)}s`;
    
    if (powerupText) {
        drawText(powerupText, xPos, yPos, { color: '#7fff00', size: '0.8em', align, shadow: true });
    }
}


// --- Main Exported Function ---

export function renderHUD() {
    // Center Level Display
    drawText(`LEVEL: ${gameState.level}`, ctx.canvas.width / 2, 30, { 
        color: '#7fff00', 
        size: '1.2em', 
        align: 'center', 
        shadow: true 
    });

    // Draw HUD for each player
    gameState.players.forEach(player => {
        if (player.playerNum === 1) {
            // P1 on the left
            if (player.lives <= 0) ctx.globalAlpha = 0.4;
            drawPlayerHUD(player, 'left');
            ctx.globalAlpha = 1.0;
        } else if (player.playerNum === 2) {
            // P2 on the right
            if (player.lives <= 0) ctx.globalAlpha = 0.4;
            drawPlayerHUD(player, 'right');
            ctx.globalAlpha = 1.0;
        }
    });

    drawMutatorList();
}