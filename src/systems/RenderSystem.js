// src/systems/RenderSystem.js
// Handles all drawing operations for the game.

import { renderHUD } from '../ui/HUDRenderer.js';

// Create a single, reusable off-screen canvas for the flashlight mask.
let maskCanvas = null;
let maskCtx = null;

/**
 * Renders the background, clearing the canvas with a trail effect based on the persistence setting.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 * @param {object} state - The game state object.
 */
function renderBackground(ctx, state) {
    ctx.save();
    // The alpha value is the inverse of the persistence amount.
    const alpha = 1.0 - state.shaders.persistence;
    ctx.fillStyle = `rgba(13, 2, 26, ${alpha})`;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
}

/**
 * Renders the parallax starfield.
 * @param {object} state - The game state object.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 */
function renderStarfield(state, ctx) {
    if (!state.shaders.starfield) return;

    ctx.save();
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 4;
    for (const star of state.starfield) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 225, 255, ${star.opacity})`;
        ctx.fill();
    }
    ctx.restore();
}

/**
 * Draws all entities for the main game.
 * @param {object} state - The game state object.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 */
function renderGame(state, ctx) {
    renderBackground(ctx, state);
    renderStarfield(state, ctx); // Draw stars first

    ctx.save();

    // Apply screen shake if active
    if (state.shakeDuration > 0) {
        const dx = (Math.random() - 0.5) * state.shakeMagnitude;
        const dy = (Math.random() - 0.5) * state.shakeMagnitude;
        ctx.translate(dx, dy);
        state.shakeDuration--;
    }

    // Define the draw order
    const drawOrder = [
        ...state.planetoids,
        ...state.asteroids,
        ...state.smokeParticles,
        ...state.particles,
        ...state.mines,
        ...state.enemies,
        ...state.allies, // NEW: Draw allied ships
        ...state.players,
        ...state.missiles,
        ...state.enemyMissiles,
        ...state.enemyRockets,
        ...state.bombs,
        ...state.bullets,
        ...state.enemyBullets,
        ...state.powerUps,
        ...state.missilePickups,
        ...state.shockwaves,
    ];

    // Draw all entities
    drawOrder.forEach(item => {
        if (item && item.draw) {
            item.draw();
        }
    });

    ctx.restore();

    // Loop through active mutators and run their drawing functions, if they have them.
    if (state.mutators?.active?.length > 0) {
        state.mutators.active.forEach(mutator => {
            if (mutator.drawOverlay) {
                mutator.drawOverlay(ctx, state);
            }
        });
    }

    // Render the HUD on top of everything else
    renderHUD(state, ctx);
}

/**
 * Renders the entities for the main menu background.
 * @param {object} state - The game state object.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 */
function renderMenu(state, ctx) {
    renderBackground(ctx, state);
    renderStarfield(state, ctx); // Draw stars first

    // Update and draw the background asteroids
    state.menuAsteroids.forEach(a => {
        if (a) {
            a.update();
            a.draw(true);
        }
    });
}

// Export all functions in a single block for robust module resolution
export {
    renderBackground,
    renderStarfield,
    renderGame,
    renderMenu
};