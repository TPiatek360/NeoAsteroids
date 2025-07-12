// src/systems/RenderSystem.js
// Handles all drawing operations for the game.

/**
 * Renders the background, which is just a clearing of the canvas with a trail effect.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 */
function renderBackground(ctx) {
    ctx.save();
    ctx.fillStyle = "rgba(13, 2, 26, 0.3)";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
}

/**
 * Draws all entities for the main game.
 * @param {object} state - The game state object.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 */
export function renderGame(state, ctx) {
    renderBackground(ctx);

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
        ...state.asteroids,
        ...state.smokeParticles,
        ...state.particles,
        ...state.mines,
        ...state.enemies,
        ...state.players, // Add players to the draw order
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
}

/**
 * Renders the entities for the main menu background.
 * @param {object} state - The game state object.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 */
export function renderMenu(state, ctx) {
    renderBackground(ctx);

    // Update and draw the background asteroids
    state.menuAsteroids.forEach(a => {
        if (a) {
            a.update();
            a.draw(true);
        }
    });
}