// src/mutators/flashlight.js
// This is a self-contained module for the Flashlight Mode mutator.

// This function used to be in RenderSystem.js. Now it lives with the mutator it belongs to.
function renderFlashlightOverlay(ctx, state) {
    const player = state.players[0];
    if (!player || player.lives <= 0) return;

    // We need to create a temporary canvas for the mask
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = ctx.canvas.width;
    maskCanvas.height = ctx.canvas.height;
    const maskCtx = maskCanvas.getContext('2d');

    const circleRadius = 220;
    const coneLength = 450;
    const coneAngle = Math.PI / 7;

    maskCtx.fillStyle = 'rgba(13, 2, 26, 0.97)';
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    maskCtx.globalCompositeOperation = 'destination-out';

    const gradient = maskCtx.createRadialGradient(player.x, player.y, 0, player.x, player.y, circleRadius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    maskCtx.fillStyle = gradient;
    maskCtx.beginPath();
    maskCtx.arc(player.x, player.y, circleRadius, 0, Math.PI * 2);
    maskCtx.fill();

    const p1x = player.x + coneLength * Math.cos(player.a - coneAngle);
    const p1y = player.y + coneLength * Math.sin(player.a - coneAngle);
    const p2x = player.x + coneLength * Math.cos(player.a + coneAngle);
    const p2y = player.y + coneLength * Math.sin(player.a + coneAngle);
    
    maskCtx.fillStyle = 'white';
    maskCtx.beginPath();
    maskCtx.moveTo(player.x, player.y);
    maskCtx.lineTo(p1x, p1y);
    maskCtx.lineTo(p2x, p2y);
    maskCtx.closePath();
    maskCtx.fill();

    ctx.drawImage(maskCanvas, 0, 0);
}

// Export the complete mutator object
export const flashlight = {
    key: 'FLASHLIGHT_MODE',
    description: "The battlefield is dark except for a cone of light from your ship.",
    conflictsWith: [],
    run: (state) => {
        // This mutator's effect is purely visual, so it doesn't need to change gameState flags.
        // The presence of its `drawOverlay` function is enough.
    },
    // The RenderSystem will look for and call this function every frame if the mutator is active.
    drawOverlay: (ctx, state) => {
        renderFlashlightOverlay(ctx, state);
    }
};