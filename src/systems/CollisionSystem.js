// src/systems/CollisionSystem.js
// Handles all collision detection and resolution logic for the game.

import { gameState } from '../state.js';
import { handlePlayerDeath, detonateMine } from '../main.js';
import { destroyAsteroid } from '../entities/environment.js';
import { PowerUp } from '../entities/environment.js';
import { createExplosion } from '../fx/effects.js';
import { createShockwave } from '../fx/shockwave.js';
import { triggerRumble } from '../fx/effects.js';
import { playExplosionSound, playMissilePickupSound, playPowerupPickupSound, playShieldHitSound } from '../audio/audio.js';
import { updateGameUI } from '../ui/ui.js';
import { distBetweenPoints } from '../utils.js';
import {
    MAX_MISSILES_CARRIED, POWERUP_DURATION, SHIELD_MAX_ENERGY, NEON_PINK,
    SHIELD_HIT_ENERGY_DRAIN, SHIELD_KNOCKBACK_BULLET, SHIELD_KNOCKBACK_MISSILE,
    SHIELD_KNOCKBACK_ASTEROID, SHIELD_KNOCKBACK_ENEMY_SHIP, SHIELD_KNOCKBACK_EXPLOSION,
    MAX_LIVES
} from '../constants.js';

function handleShieldHit(player, knockback, damageSource) {
    player.shieldEnergy -= SHIELD_HIT_ENERGY_DRAIN;
    player.triggerShieldHitEffect();
    playShieldHitSound();
    
    let angle;
    // For explosions, knockback is from the center of the blast
    if (damageSource.blastRadius) { 
        angle = Math.atan2(player.y - damageSource.y, player.x - damageSource.x);
    } 
    // For projectiles/ships, knockback is in the direction they were moving
    else {
        const vx = damageSource.xv || (damageSource.thrust ? damageSource.thrust.x : 0) || 0;
        const vy = damageSource.yv || (damageSource.thrust ? damageSource.thrust.y : 0) || 0;
        angle = Math.atan2(vy, vx);
    }
    
    player.thrust.x += knockback * Math.cos(angle);
    player.thrust.y += knockback * Math.sin(angle);
}

export function checkCollisions() {
    const { players, bullets, asteroids, missilePickups, missiles, powerUps, bombs, mines, enemies, enemyBullets, enemyMissiles, enemyRockets } = gameState;

    if (players.length === 0) return;

    // --- Loop through each player for their individual collisions ---
    for (const player of players) {
        if (player.lives <= 0) continue;

        // 1. Player vs. Pickups
        for (let i = missilePickups.length - 1; i >= 0; i--) {
            if (distBetweenPoints(player.x, player.y, missilePickups[i].x, missilePickups[i].y) < player.r + missilePickups[i].r) {
                if (player.missileCount < MAX_MISSILES_CARRIED) player.missileCount++;
                playMissilePickupSound();
                missilePickups.splice(i, 1);
                break;
            }
        }
        for (let i = powerUps.length - 1; i >= 0; i--) {
            if (distBetweenPoints(player.x, player.y, powerUps[i].x, powerUps[i].y) < player.r + powerUps[i].r) {
                const pu = powerUps[i];
                if (pu.type === 'rapidFire') player.powerupTimers.rapidFire = POWERUP_DURATION;
                else if (pu.type === 'spreadShot') player.powerupTimers.spreadShot = POWERUP_DURATION;
                else if (pu.type === 'shieldBoost') player.shieldEnergy = SHIELD_MAX_ENERGY;
                else if (pu.type === 'extraLife' && player.lives < MAX_LIVES) player.lives++;
                playPowerupPickupSound();
                powerUps.splice(i, 1);
                break;
            }
        }

        // 2. Player vs. Dangers (Asteroids, Enemy Ships, Enemy Projectiles)
        for (let i = asteroids.length - 1; i >= 0; i--) {
            const a = asteroids[i];
            if (distBetweenPoints(player.x, player.y, a.x, a.y) < player.r + a.r) {
                if (player.shieldActive) { 
                    handleShieldHit(player, SHIELD_KNOCKBACK_ASTEROID, a); 
                    destroyAsteroid(i, false, player.id); 
                } 
                else if (player.invincibilityFrames <= 0) { 
                    handlePlayerDeath(player); 
                    destroyAsteroid(i, false, player.id); 
                }
                if (player.lives <= 0) break;
            }
        }
        if (player.lives <= 0) continue;

        for (const enemy of enemies) {
            const collided = enemy.checkCollision ? enemy.checkCollision(player.x, player.y, player.r) : distBetweenPoints(player.x, player.y, enemy.x, enemy.y) < player.r + (enemy.r || 0);
            if (collided) {
                if (player.shieldActive) { 
                    handleShieldHit(player, SHIELD_KNOCKBACK_ENEMY_SHIP, enemy); 
                } 
                else if (player.invincibilityFrames <= 0) { 
                    handlePlayerDeath(player); 
                }
                if (player.lives <= 0) break;
            }
        }
        if (player.lives <= 0) continue;

        const allEnemyProjectiles = [
            { list: enemyBullets, knockback: SHIELD_KNOCKBACK_BULLET }, 
            { list: enemyMissiles, knockback: SHIELD_KNOCKBACK_MISSILE }, 
            { list: enemyRockets, knockback: SHIELD_KNOCKBACK_MISSILE }
        ];
        for (const projType of allEnemyProjectiles) {
            for (let i = projType.list.length - 1; i >= 0; i--) {
                const p = projType.list[i];
                if (distBetweenPoints(player.x, player.y, p.x, p.y) < player.r + (p.r || p.w / 2)) {
                    if (player.shieldActive) { 
                        handleShieldHit(player, projType.knockback, p); 
                        projType.list.splice(i, 1); 
                    } 
                    else if (player.invincibilityFrames <= 0) { 
                        handlePlayerDeath(player); 
                        projType.list.splice(i, 1); 
                    }
                    if (player.lives <= 0) break;
                }
            }
            if (player.lives <= 0) break;
        }
        if (player.lives <= 0) continue;

        // Player vs Mines (Proximity Trigger)
        for (let i = mines.length - 1; i >= 0; i--) {
            if (distBetweenPoints(player.x, player.y, mines[i].x, mines[i].y) < player.r + mines[i].r) {
                 if (player.shieldActive) { 
                     handleShieldHit(player, SHIELD_KNOCKBACK_EXPLOSION, mines[i]); 
                     detonateMine(i); 
                 } 
                 else { 
                     detonateMine(i); // Detonation handles player death check
                 }
                break;
            }
        }
    }

    // 3. Player vs Player (VS Mode Only)
    if (gameState.gameMode === 'twoPlayer' && gameState.twoPlayerMode === 'vs' && players.length > 1) {
        const p1 = players[0];
        const p2 = players[1];

        if (p1 && p2) {
             // Check ship-to-ship collision
            if (p1.lives > 0 && p2.lives > 0 && distBetweenPoints(p1.x, p1.y, p2.x, p2.y) < p1.r + p2.r) {
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                if (p1.shieldActive) { handleShieldHit(p1, SHIELD_KNOCKBACK_ENEMY_SHIP, {xv: Math.cos(angle), yv: Math.sin(angle) }); }
                else if (p1.invincibilityFrames <= 0) { handlePlayerDeath(p1); }
                
                if (p2.shieldActive) { handleShieldHit(p2, SHIELD_KNOCKBACK_ENEMY_SHIP, {xv: -Math.cos(angle), yv: -Math.sin(angle) }); }
                else if (p2.invincibilityFrames <= 0) { handlePlayerDeath(p2); }
            }

            // Check player projectiles against other players
            for (let i = bullets.length - 1; i >= 0; i--) {
                const b = bullets[i];
                const targetPlayer = b.ownerId === p1.id ? p2 : (b.ownerId === p2.id ? p1 : null);
                if (targetPlayer && targetPlayer.lives > 0 && distBetweenPoints(targetPlayer.x, targetPlayer.y, b.x, b.y) < targetPlayer.r + b.r) {
                    if (targetPlayer.shieldActive) { handleShieldHit(targetPlayer, SHIELD_KNOCKBACK_BULLET, b); } 
                    else if (targetPlayer.invincibilityFrames <= 0) { handlePlayerDeath(targetPlayer); }
                    bullets.splice(i, 1);
                }
            }
            for (let i = missiles.length - 1; i >= 0; i--) {
                const m = missiles[i];
                const targetPlayer = m.ownerId === p1.id ? p2 : (m.ownerId === p2.id ? p1 : null);
                if (targetPlayer && targetPlayer.lives > 0 && distBetweenPoints(targetPlayer.x, targetPlayer.y, m.x, m.y) < targetPlayer.r + m.r) {
                    if (targetPlayer.shieldActive) { handleShieldHit(targetPlayer, SHIELD_KNOCKBACK_MISSILE, m); } 
                    else if (targetPlayer.invincibilityFrames <= 0) { handlePlayerDeath(targetPlayer); }
                    missiles.splice(i, 1);
                }
            }
        }
    }

    // 4. Player Projectiles vs. Targets (Asteroids, Enemies)
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        let hit = false;
        for (let j = asteroids.length - 1; j >= 0; j--) {
            if (distBetweenPoints(asteroids[j].x, asteroids[j].y, b.x, b.y) < asteroids[j].r) {
                destroyAsteroid(j, false, b.ownerId);
                hit = true;
                break;
            }
        }
        if (hit) { bullets.splice(i, 1); continue; }
        
        for (const enemy of enemies) {
            if (enemy.checkCollision ? enemy.checkCollision(b.x, b.y, 1) : distBetweenPoints(enemy.x, enemy.y, b.x, b.y) < (enemy.r || 0)) {
                enemy.takeDamage(1, b.x, b.y, false, b.ownerId);
                hit = true;
                break;
            }
        }
        if (hit) { bullets.splice(i, 1); }
    }

    for (let i = missiles.length - 1; i >= 0; i--) {
        const m = missiles[i];
        let hit = false;
        for (let j = asteroids.length - 1; j >= 0; j--) {
            if (distBetweenPoints(asteroids[j].x, asteroids[j].y, m.x, m.y) < asteroids[j].r) {
                destroyAsteroid(j, true, m.ownerId);
                hit = true;
                break;
            }
        }
        if (hit) { missiles.splice(i, 1); continue; }
        
        for (const enemy of enemies) {
            if (enemy.checkCollision ? enemy.checkCollision(m.x, m.y, 1) : distBetweenPoints(enemy.x, enemy.y, m.x, m.y) < (enemy.r || 0)) {
                enemy.takeDamage(5, m.x, m.y, false, m.ownerId);
                hit = true;
                break;
            }
        }
        if (hit) { missiles.splice(i, 1); }
    }

    // 5. Bombs
    for (let i = bombs.length - 1; i >= 0; i--) {
        const b = bombs[i];
        if (b.life > 0) continue;
        
        triggerRumble(0.9, 0.9, 400); playExplosionSound(0.9, 0.8, 2500, 80);
        createExplosion(b.x, b.y, b.color, 60, 5);
        createShockwave(b.x, b.y, b.blastRadius * 2, b.color, 10, 4);

        for (const player of players) {
            if (player.lives > 0 && distBetweenPoints(player.x, player.y, b.x, b.y) < player.r + b.blastRadius) {
                if (gameState.gameMode === 'twoPlayer' && gameState.twoPlayerMode === 'vs' && player.id !== b.ownerId) {
                    if (player.shieldActive) { handleShieldHit(player, SHIELD_KNOCKBACK_EXPLOSION, b); } 
                    else if (player.invincibilityFrames <= 0) { handlePlayerDeath(player); }
                }
            }
        }
        for (let j = asteroids.length - 1; j >= 0; j--) { if (distBetweenPoints(b.x, b.y, asteroids[j].x, asteroids[j].y) < b.blastRadius + asteroids[j].r) destroyAsteroid(j, true, b.ownerId); }
        for(const enemy of enemies) { if (enemy.takeDamage) enemy.takeDamage(15, b.x, b.y, true, b.ownerId); }
        bombs.splice(i, 1);
    }
    
    for (let i = mines.length - 1; i >= 0; i--) { if (mines[i].life <= 0 || mines[i].fuseTimer <= 0) { detonateMine(i); } }
}