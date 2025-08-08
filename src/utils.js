// src/utils.js
// General-purpose helper functions.
import { gameState } from './state.js';

export function setCanvasSize(canvas) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

export function degToRad(d) {
    return d * Math.PI / 180;
}

export function distBetweenPoints(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

export function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
}

/**
 * Returns a color string appropriate for the current color mode.
 * @param {string} baseColor The default hex or color string.
 * @returns {string} The color string for the current mode.
 */
export function getDynamicColor(baseColor) {
    const { colorMode } = gameState;

    if (colorMode === 'bw') {
        return '#FFFFFF'; // Return white for all colors in B&W mode.
    }
    if (colorMode === 'green') {
        return '#7fff00'; // Return a consistent green for all colors in green phosphor mode.
    }
    if (colorMode === 'amber') {
        return '#ffb000'; // Return a consistent amber for all colors in amber phosphor mode.
    }

    return baseColor; // Return the original color if in 'color' mode.
}