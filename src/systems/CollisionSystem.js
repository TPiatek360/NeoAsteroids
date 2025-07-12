// src/systems/CollisionSystem.js
// Handles all collision detection and resolution logic for the game.

import { gameState } from '../state.js';
import { handlePlayerDeath, detonateMine } from '../main.js';
import { destroyAsteroid } from '../entities/environment.js';
import { createExplosion } from '../fx/effects.js';
import { createShockwave } from '../fx/shockwave.js';
import { triggerRumble } from '../fx/effects.js';
import { playExplosionSound, playMissilePickupSound, playPowerupPickupSound, playShieldImpactSound } from '../audio/audio.js';
import { updateGameUI } from '../ui/hud.js';
import { distBetweenPoints } from '../utils.js';
import { eventBus } from './EventBus.js';
import {
    MAX_MISSILES_CARRIED, POWERUP_DURATION, SHIELD_MAX_ENERGY,
    SHIELD_DRAIN_BULLET, SHIELD_DRAIN_MISSILE, SHIELD_DRAIN_ASTEROID,
    SHIELD_DRAIN_SHIP_COLLISION, SHIELD_DRAIN_EXPLOSION,
    SHIELD_KNOCKBACK_BULLET, SHIELD_KNOCKBACK_MISSILE,
    SHIELD_KNOCKBACK_ASTEROID, SHIELD_KNOCKBACK_ENEMY_SHIP, SHIELD_KNOCKBACK_EXPLOSION,
    MAX_LIVES
} from '../constants.js';

function handleShieldHit(player, knockback, damageSource, drainAmount) {
    if (player.shieldEnergy <= 0 || player.isInvulnerable) return;

    player.shieldEnergy -= drainAmount;
    player.triggerShieldHitEffect();
    playShieldImpactSound();

    // Visuals: shockwave and gradient angle
    const impactAngle = Math.atan2(damageSource.y - player.y, damageSource.x - player.x);
    player.lastShieldHitAngle = impactAngle;

    const shieldRadius = player.r * 1.5;
    const impactX = player.x + shieldRadius * Math.cos(impactAngle);
    const impactY = player.y + shieldRadius * Math.sin(impactAngle);
    createShockwave(impactX, impactY, 40, '#FFFFFF', 6, 2);

    // Physics: knockback
    let knockbackAngle;
    if (damageSource.blastRadius) { // For explosions
        knockbackAngle = Math.atan2(player.y - damageSource.y, player.x - damageSource.x);
    } else { // For projectiles/ships, knockback is in their direction of movement
        const vx = damageSource.xv || (damageSource.thrust ? damageSource.thrust.x : 0) || 0;
        const vy = damageSource.yv || (damageSource.thrust ? damageSource.thrust.y : 0) || 0;
        knockbackAngle = Math.atan2(vy, vx);
    }

    player.thrust.x += knockback * Math.cos(knockbackAngle);
    player.thrust.y += knockback * Math.sin(knockbackAngle);
}

function handleMissileImpact(missile) {
    // Create a smaller, quicker explosion and shockwave for missiles.
    createExplosion(missile.x, missile.y, missile.color, 15, 2);
    createShockwave(missile.x, missile.y, 70, missile.color, 4, 2);
    playExplosionSound(0.25, 0.2, 1500, 500); // Higher pitch, shorter "pop"
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
                updateGameUI();
                break;
            }
        }
        for (let i = powerUps.length - 1; i >= 0; i--) {
            if (distBetweenPoints(player.x, player.y, powerUps[i].x, powerUps[i].y) < player.r + powerUps[i].r) {
                const pu = powerUps[i];
                const maxDuration = POWERUP_DURATION * 3; // Cap stacking duration

                if (pu.type === 'rapidFire') player.powerupTimers.rapidFire = Math.min(maxDuration, player.powerupTimers.rapidFire + POWERUP_DURATION);
                else if (pu.type === 'spreadShot') player.powerupTimers.spreadShot = Math.min(maxDuration, player.powerupTimers.spreadShot + POWERUP_DURATION);
                else if (pu.type === 'shieldBoost') player.shieldEnergy = SHIELD_MAX_ENERGY;
                else if (pu.type === 'extraLife' && player.lives < MAX_LIVES) player.lives++;

                playPowerupPickupSound();
                powerUps.splice(i, 1);
                updateGameUI();
                break;
            }
        }

        // 2. Player vs. Dangers (Asteroids, Enemy Ships, Enemy Projectiles)
        if (player.isInvulnerable) continue; // Skip all damage checks if in god mode

        for (let i = asteroids.length - 1; i >= 0; i--) {
            const a = asteroids[i];
            if (distBetweenPoints(player.x, player.y, a.x, a.y) < player.r + a.r) {
                if (player.shieldActive) {
                    handleShieldHit(player, SHIELD_KNOCKBACK_ASTEROID, a, SHIELD_DRAIN_ASTEROID);
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
                    handleShieldHit(player, SHIELD_KNOCKBACK_ENEMY_SHIP, enemy, SHIELD_DRAIN_SHIP_COLLISION);
                }
                else if (player.invincibilityFrames <= 0) {
                    handlePlayerDeath(player);
                }
                if (player.lives <= 0) break;
            }
        }
        if (player.lives <= 0) continue;

        const allEnemyProjectiles = [
            { list: enemyBullets, knockback: SHIELD_KNOCKBACK_BULLET, drain: SHIELD_DRAIN_BULLET },
            { list: enemyMissiles, knockback: SHIELD_KNOCKBACK_MISSILE, drain: SHIELD_DRAIN_MISSILE },
            { list: enemyRockets, knockback: SHIELD_KNOCKBACK_MISSILE, drain: SHIELD_DRAIN_MISSILE }
        ];
        for (const projType of allEnemyProjectiles) {
            for (let i = projType.list.length - 1; i >= 0; i--) {
                const p = projType.list[i];
                if (distBetweenPoints(player.x, player.y, p.x, p.y) < player.r + (p.r || p.w / 2)) {
                    if (player.shieldActive) {
                        handleShieldHit(player, projType.knockback, p, projType.drain);
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
                    handleShieldHit(player, SHIELD_KNOCKBACK_EXPLOSION, mines[i], SHIELD_DRAIN_EXPLOSION);
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
                if (p1.shieldActive && !p1.isInvulnerable) { handleShieldHit(p1, SHIELD_KNOCKBACK_ENEMY_SHIP, p2, SHIELD_DRAIN_SHIP_COLLISION); }
                else if (p1.invincibilityFrames <= 0 && !p1.isInvulnerable) { handlePlayerDeath(p1); }

                if (p2.shieldActive && !p2.isInvulnerable) { handleShieldHit(p2, SHIELD_KNOCKBACK_ENEMY_SHIP, p1, SHIELD_DRAIN_SHIP_COLLISION); }
                else if (p2.invincibilityFrames <= 0 && !p2.isInvulnerable) { handlePlayerDeath(p2); }
            }

            // Check player projectiles against other players
            for (let i = bullets.length - 1; i >= 0; i--) {
                const b = bullets[i];
                const targetPlayer = b.ownerId === p1.id ? p2 : (b.ownerId === p2.id ? p1 : null);
                if (targetPlayer && targetPlayer.lives > 0 && distBetweenPoints(targetPlayer.x, targetPlayer.y, b.x, b.y) < targetPlayer.r + b.r) {
                    if (targetPlayer.shieldActive && !targetPlayer.isInvulnerable) { handleShieldHit(targetPlayer, SHIELD_KNOCKBACK_BULLET, b, SHIELD_DRAIN_BULLET); }
                    else if (targetPlayer.invincibilityFrames <= 0 && !targetPlayer.isInvulnerable) { handlePlayerDeath(targetPlayer); }
                    bullets.splice(i, 1);
                }
            }
            for (let i = missiles.length - 1; i >= 0; i--) {
                const m = missiles[i];
                const targetPlayer = m.ownerId === p1.id ? p2 : (m.ownerId === p2.id ? p1 : null);
                if (targetPlayer && targetPlayer.lives > 0 && distBetweenPoints(targetPlayer.x, targetPlayer.y, m.x, m.y) < targetPlayer.r + m.r) {
                    if (targetPlayer.shieldActive && !targetPlayer.isInvulnerable) { handleShieldHit(targetPlayer, SHIELD_KNOCKBACK_MISSILE, m, SHIELD_DRAIN_MISSILE); }
                    else if (targetPlayer.invincibilityFrames <= 0 && !targetPlayer.isInvulnerable) { handlePlayerDeath(targetPlayer); }
                    handleMissileImpact(m);
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
            if (enemy.takeDamage(1, b.x, b.y, false, b.ownerId)) {
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
                handleMissileImpact(m);
                destroyAsteroid(j, true, m.ownerId);
                hit = true;
                break;
            }
        }
        if (hit) { missiles.splice(i, 1); continue; }

        for (const enemy of enemies) {
            if (enemy.takeDamage(5, m.x, m.y, false, m.ownerId)) {
                handleMissileImpact(m);
                hit = true;
                break;
            }
        }
        if (hit) { missiles.splice(i, 1); }
    }
    
    // 5. Enemy Projectiles vs Asteroids
    const enemyProjectiles = [
        { list: enemyBullets, isMissile: false },
        { list: enemyMissiles, isMissile: true },
        { list: enemyRockets, isMissile: false }
    ];

    for (const projType of enemyProjectiles) {
        for (let i = projType.list.length - 1; i >= 0; i--) {
            const p = projType.list[i];
            let hit = false;
            for (let j = asteroids.length - 1; j >= 0; j--) {
                if (distBetweenPoints(asteroids[j].x, asteroids[j].y, p.x, p.y) < asteroids[j].r) {
                    // If the setting is enabled, destroy the asteroid
                    if (gameState.enemyFireDestroysAsteroids) {
                        if (projType.isMissile) handleMissileImpact(p);
                        destroyAsteroid(j, projType.isMissile, -1); // No score for player
                    }
                    // The projectile is always destroyed on hit, regardless of the setting
                    hit = true;
                    break;
                }
            }
            if (hit) {
                projType.list.splice(i, 1);
            }
        }
    }

    // 6. Bombs
    for (let i = bombs.length - 1; i >= 0; i--) {
        const b = bombs[i];
        if (b.life > 0) continue;

        triggerRumble(0.9, 0.9, 400); playExplosionSound(0.9, 0.8, 2500, 80);
        createExplosion(b.x, b.y, b.color, 60, 5);
        createShockwave(b.x, b.y, b.blastRadius * 2, b.color, 10, 4);

        for (const player of players) {
            if (player.lives > 0 && !player.isInvulnerable && distBetweenPoints(player.x, player.y, b.x, b.y) < player.r + b.blastRadius) {
                if (gameState.gameMode === 'twoPlayer' && gameState.twoPlayerMode === 'vs' && player.id !== b.ownerId) {
                    if (player.shieldActive) { handleShieldHit(player, SHIELD_KNOCKBACK_EXPLOSION, b, SHIELD_DRAIN_EXPLOSION); }
                    else if (player.invincibilityFrames <= 0) { handlePlayerDeath(player); }
                }
            }
        }
        for (let j = asteroids.length - 1; j >= 0; j--) { if (distBetweenPoints(b.x, b.y, asteroids[j].x, asteroids[j].y) < b.blastRadius + asteroids[j].r) destroyAsteroid(j, true, b.ownerId); }
        for (const enemy of enemies) { if (enemy.takeDamage) enemy.takeDamage(15, b.x, b.y, true, b.ownerId); }
        bombs.splice(i, 1);
    }

    for (let i = mines.length - 1; i >= 0; i--) { if (mines[i].life <= 0 || mines[i].fuseTimer <= 0) { detonateMine(i); } }

    // 7. Enemy vs Asteroid Collisions
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        
        for (let j = asteroids.length - 1; j >= 0; j--) {
            const asteroid = asteroids[j];
            const collided = enemy.checkCollision ?
                            enemy.checkCollision(asteroid.x, asteroid.y, asteroid.r) :
                            distBetweenPoints(enemy.x, enemy.y, asteroid.x, asteroid.y) < (enemy.r || 0) + asteroid.r;
            
            if (collided) {
                if (enemy.isBoss) {
                    // Bosses take damage from asteroids but are not instantly destroyed
                    enemy.takeDamage(SHIELD_DRAIN_SHIP_COLLISION, asteroid.x, asteroid.y, true, -1);
                    destroyAsteroid(j, false, -1);
                } else {
                    // Non-boss enemies are destroyed on impact
                    eventBus.dispatch('enemy_destroyed', { enemy: enemy, playerId: -1, x: enemy.x, y: enemy.y });
                    enemy.isDead = true;
                    destroyAsteroid(j, false, -1);
                    break; // Since the non-boss enemy is destroyed, break from the inner asteroid loop
                }
            }
        }
    }
}