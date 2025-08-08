// src/systems/CollisionSystem.js
// Handles all collision detection and resolution logic for the game.

import { gameState } from '../state.js';
import { canvas } from '../ui/ui.js';
import { destroyAsteroid } from '../entities/environment.js';
import { PowerUp } from '../entities/environment.js';
import { createExplosion } from '../fx/effects.js';
import { createShockwave } from '../fx/shockwave.js';
import { triggerRumble } from '../fx/effects.js';
import { playExplosionSound, playMissilePickupSound, playPowerupPickupSound, playShieldZapSound } from '../audio/audio.js';
import { distBetweenPoints } from '../utils.js';
import {
    POWERUP_DURATION, SHIELD_MAX_ENERGY, NEON_PINK,
    SHIELD_HIT_ENERGY_DRAIN, SHIELD_KNOCKBACK_BULLET, SHIELD_KNOCKBACK_MISSILE,
    SHIELD_KNOCKBACK_ASTEROID, SHIELD_KNOCKBACK_ENEMY_SHIP, SHIELD_KNOCKBACK_EXPLOSION,
    NEON_ORANGE, NEON_CYAN, NEON_ENEMY_MISSILE
} from '../constants.js';

const MAX_LEVELS = 8; // Maximum number of times a quad can be subdivided

/**
 * QuadTree implementation for efficient collision detection.
 */
class QuadTree {
    constructor(x, y, width, height, capacity, level = 0) {
        this.boundary = { x, y, width, height };
        this.capacity = capacity; // Max entities before subdivision
        this.entities = [];
        this.divided = false;
        this.level = level; // Store the current depth level
    }

    // Subdivide this node into 4 children
    subdivide() {
        const { x, y, width, height } = this.boundary;
        const hw = width / 2;
        const hh = height / 2;
        const nextLevel = this.level + 1;

        this.northeast = new QuadTree(x + hw, y, hw, hh, this.capacity, nextLevel);
        this.northwest = new QuadTree(x, y, hw, hh, this.capacity, nextLevel);
        this.southeast = new QuadTree(x + hw, y + hh, hw, hh, this.capacity, nextLevel);
        this.southwest = new QuadTree(x, y + hh, hw, hh, this.capacity, nextLevel);

        this.divided = true;

        // Move existing entities to children
        for (const entity of this.entities) {
            this.northeast.insert(entity);
            this.northwest.insert(entity);
            this.southeast.insert(entity);
            this.southwest.insert(entity);
        }
        this.entities = [];
    }
    
    // Check if a circular entity's bounding box is within this quad's boundary
    contains(entity) {
        const r = entity.r || (entity.w / 2) || 5; // Use radius or estimate
        const { x, y, width, height } = this.boundary;
        return (entity.x - r < x + width &&
                entity.x + r > x &&
                entity.y - r < y + height &&
                entity.y + r > y);
    }

    // Insert an entity into the tree
    insert(entity) {
        if (!this.contains(entity)) {
            return false;
        }

        if (!this.divided) {
            if (this.entities.length < this.capacity || this.level >= MAX_LEVELS) {
                this.entities.push(entity);
                return true;
            }
            this.subdivide();
        }

        return (this.northeast.insert(entity) ||
                this.northwest.insert(entity) ||
                this.southeast.insert(entity) ||
                this.southwest.insert(entity));
    }

    // Query for entities within a given rectangular range
    queryRange(range, found = []) {
        // Check if range intersects with this quad's boundary
        const { x, y, width, height } = this.boundary;
        if (range.x > x + width || range.x + range.width < x ||
            range.y > y + height || range.y + range.height < y) {
            return found;
        }

        if (this.divided) {
            this.northwest.queryRange(range, found);
            this.northeast.queryRange(range, found);
            this.southwest.queryRange(range, found);
            this.southeast.queryRange(range, found);
        } else {
            for (const entity of this.entities) {
                 if (range.x < entity.x + entity.r && range.x + range.width > entity.x - entity.r &&
                     range.y < entity.y + entity.r && range.y + range.height > entity.y - entity.r) {
                    found.push(entity);
                }
            }
        }
        return found;
    }
}


function handleShieldHit(player, knockback, damageSource) {
    if (player.isInvincible) return;

    player.shieldEnergy -= SHIELD_HIT_ENERGY_DRAIN;
    player.triggerShieldHitEffect();
    
    const pan = (damageSource.x - canvas.width / 2) / (canvas.width / 2);
    playShieldZapSound(pan);
    
    const impactX = damageSource.x;
    const impactY = damageSource.y;

    createExplosion(impactX, impactY, NEON_CYAN, 12, 3, 250);
    player.triggerShieldFlash(impactX, impactY);
    
    let angle;
    if (damageSource.blastRadius) { 
        angle = Math.atan2(player.y - damageSource.y, player.x - damageSource.x);
    } 
    else {
        const vx = damageSource.xv || (damageSource.thrust ? damageSource.thrust.x : 0) || 0;
        const vy = damageSource.yv || (damageSource.thrust ? damageSource.thrust.y : 0) || 0;
        angle = Math.atan2(vy, vx);
    }
    
    player.thrust.x += knockback * Math.cos(angle);
    player.thrust.y += knockback * Math.sin(angle);
}

export function checkCollisions({ handlePlayerDeath, detonateMine }) {
    const { players, bullets, asteroids, missilePickups, missiles, powerUps, bombs, mines, enemies, allies, enemyBullets, enemyMissiles, enemyRockets, planetoids } = gameState;

    if (players.length === 0) return;
    
    // --- 1. SETUP QUADTREE ---
    const quadTree = new QuadTree(0, 0, canvas.width, canvas.height, 8);
    let allEntities = [
        ...players, ...asteroids, ...missilePickups, ...missiles, ...powerUps, 
        ...bombs, ...mines, ...enemyBullets, ...enemyMissiles, ...enemyRockets, 
        ...bullets, ...planetoids
    ];
    
    // *** BUG FIX STARTS HERE ***
    // Add ships to the collision check, being careful to only add physical parts.
    [...enemies, ...allies].forEach(ship => {
        if (ship.sections) {
            // For ships with sections (like the Cruiser), ONLY add the physical sections.
            allEntities.push(...ship.sections.filter(s => !s.isDestroyed));
        } else {
            // For single-body ships (like Corvette, Ace, EnemyShip), add the main object.
            allEntities.push(ship);
        }
    });
    // *** BUG FIX ENDS HERE ***

    for (const entity of allEntities) {
        // Ensure every entity has a radius for quadtree insertion
        if (entity.r === undefined) {
             entity.r = Math.max(entity.w || 10, entity.h || 10) / 2;
        }
        quadTree.insert(entity);
    }

    // --- 2. PERFORM COLLISION CHECKS USING THE QUADTREE ---

    // -- Player vs World --
    for (const player of players) {
        if (player.lives <= 0) continue;

        const queryBox = { x: player.x - player.r, y: player.y - player.r, width: player.r * 2, height: player.r * 2 };
        const candidates = quadTree.queryRange(queryBox);
        
        for (const other of candidates) {
            if (player === other) continue;

            const dist = distBetweenPoints(player.x, player.y, other.x, other.y);

            // vs Pickups
            if ((other.constructor.name === 'MissilePickup' || other.constructor.name === 'PowerUp') && dist < player.r + other.r) {
                if(other.constructor.name === 'MissilePickup') {
                     if (player.missileCount < player.getMaxMissiles()) player.missileCount++;
                     playMissilePickupSound();
                     missilePickups.splice(missilePickups.indexOf(other), 1);
                } else {
                     if (other.type === 'rapidFire') player.powerupTimers.rapidFire = POWERUP_DURATION;
                     else if (other.type === 'spreadShot') player.powerupTimers.spreadShot = POWERUP_DURATION;
                     else if (other.type === 'shieldBoost') player.shieldEnergy = SHIELD_MAX_ENERGY;
                     else if (other.type === 'extraLife' && player.lives < player.getMaxLives()) player.lives++;
                     playPowerupPickupSound();
                     powerUps.splice(powerUps.indexOf(other), 1);
                }
            }

            if (player.isInvincible) continue;

            // vs Asteroids, Enemies, Enemy Projectiles
            if (dist < player.r + other.r) {
                 if (other.constructor.name === 'Asteroid') {
                     if (player.shieldActive) { handleShieldHit(player, SHIELD_KNOCKBACK_ASTEROID, other); }
                     else if (player.invincibilityFrames <= 0) { handlePlayerDeath(player); }
                     const astIndex = asteroids.indexOf(other);
                     if (astIndex > -1) destroyAsteroid(astIndex, false, player.id);
                 }
                 else if (other.faction === 'enemy') { // Simplified check for any enemy entity
                     if (player.shieldActive) { handleShieldHit(player, SHIELD_KNOCKBACK_ENEMY_SHIP, other); }
                     else if (player.invincibilityFrames <= 0) { handlePlayerDeath(player); }
                     // Remove projectiles on hit
                     [enemyBullets, enemyMissiles, enemyRockets].forEach(arr => {
                         const projIndex = arr.indexOf(other);
                         if (projIndex > -1) arr.splice(projIndex, 1);
                     });
                 }
                 else if (other.constructor.name === 'Mine') {
                     const mineIndex = mines.indexOf(other);
                     if (mineIndex > -1) detonateMine(mineIndex);
                 }
            }
        }
    }

    // -- Player Projectiles vs World --
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        if (!b) continue;
        const queryBox = { x: b.x - b.r, y: b.y - b.r, width: b.r * 2, height: b.r * 2 };
        const candidates = quadTree.queryRange(queryBox);
        let hit = false;
        
        for (const other of candidates) {
            // Player bullets damage asteroids and enemy ships
            if ((other.faction === 'enemy') || other.constructor.name === 'Asteroid') {
                const dist = distBetweenPoints(b.x, b.y, other.x, other.y);
                if (dist < b.r + other.r) {
                    const ownerPlayer = gameState.players.find(p => p.id === b.ownerId);
                    const damageMultiplier = ownerPlayer?.damageMultiplier || 1;
                    const damage = 1 * damageMultiplier;
					if (other.constructor.name === 'Asteroid') {
                        const astIndex = asteroids.indexOf(other);
                        if (astIndex > -1) destroyAsteroid(astIndex, false, b.ownerId);
                    } else if (other.takeDamage) {
                        other.takeDamage(damage, b.x, b.y, false, b.ownerId); // Use new damage variable
                    }
                    hit = true;
                    break;
                }
            }
        }
        if (hit) { bullets.splice(i, 1); }
    }

    for (let i = missiles.length - 1; i >= 0; i--) {
        const m = missiles[i];
        if (!m) continue;
        const queryBox = { x: m.x - m.r, y: m.y - m.r, width: m.r * 2, height: m.r * 2 };
        const candidates = quadTree.queryRange(queryBox);
        let hit = false;
        
        for (const other of candidates) {
            if ((other.faction === 'enemy') || other.constructor.name === 'Asteroid') {
                const dist = distBetweenPoints(m.x, m.y, other.x, other.y);
                if (dist < m.r + other.r) {
                     const ownerPlayer = gameState.players.find(p => p.id === m.ownerId);
                     const damageMultiplier = ownerPlayer?.damageMultiplier || 1;
                     const damage = 5 * damageMultiplier;
					 if (other.constructor.name === 'Asteroid') {
                        const astIndex = asteroids.indexOf(other);
                        if (astIndex > -1) destroyAsteroid(astIndex, true, m.ownerId);
                    } else if (other.takeDamage) {
                        other.takeDamage(5, m.x, m.y, false, m.ownerId); // Use new damage variable
                    }
                    hit = true;
                    break;
                }
            }
        }
         if (hit) { missiles.splice(i, 1); }
    }

    // --- Faction-based Projectile Collisions ---
    const allProjectiles = [...enemyBullets, ...enemyMissiles, ...enemyRockets];
    for (let i = allProjectiles.length - 1; i >= 0; i--) {
        const p = allProjectiles[i];
        if (!p) continue;

        const queryBox = { x: p.x - p.r, y: p.y - p.r, width: p.r * 2, height: p.r * 2 };
        const candidates = quadTree.queryRange(queryBox);
        let hit = false;

        for (const other of candidates) {
            // Skip collision with self or non-damageable entities
            if (p === other || other.takeDamage === undefined) continue;

            // Check for friendly fire (e.g., enemy projectile hitting another enemy ship)
            if (p.faction === other.faction) continue;
            
            // AI projectiles should not hit the player directly in this loop, that's handled in Player vs World
            if (other.constructor.name === 'Player') continue;

            const dist = distBetweenPoints(p.x, p.y, other.x, other.y);
            if (dist < p.r + other.r) {
                const damage = p.constructor.name === 'EnemyMissile' ? 5 : 1;
                other.takeDamage(damage, p.x, p.y, false, -1);
                hit = true;
                break;
            }
        }

        if (hit) {
            // Remove the projectile from its original array
            [enemyBullets, enemyMissiles, enemyRockets].forEach(arr => {
                const projIndex = arr.indexOf(p);
                if (projIndex > -1) arr.splice(projIndex, 1);
            });
        }
    }


    // --- Ship vs Asteroid Logic ---
    if (gameState.enemyFireEffect !== 'passes') {
        const allShips = [...enemies, ...allies];
        for (let i = allShips.length - 1; i >= 0; i--) {
            const ship = allShips[i];
            if (!ship) continue;

            // This logic is for single-body ships. Multi-part ships handle this via their sections.
            if (ship.sections) continue;

            const queryRadius = (ship.r || 20) + 120; // Search radius
            const queryBox = { x: ship.x - queryRadius, y: ship.y - queryRadius, width: queryRadius * 2, height: queryRadius * 2 };
            const candidates = quadTree.queryRange(queryBox);
            
            for (const other of candidates) {
                if (other.constructor.name === 'Asteroid') {
                     const collided = distBetweenPoints(ship.x, ship.y, other.x, other.y) < (ship.r || 0) + other.r;
                    
                    if (collided) {
                        if (gameState.enemyFireEffect === 'blocked') {
                            if (ship.isBoss && ship.takeDamage) ship.takeDamage(10, other.x, other.y, false, -1); 
                            else if (!ship.isBoss) ship.isDead = true;
                        } else { // 'destroys' mode
                            const astIndex = asteroids.indexOf(other);
                            if (astIndex > -1) destroyAsteroid(astIndex, false, -1);
                            if (ship.isBoss && ship.takeDamage) ship.takeDamage(10, other.x, other.y, false, -1);
                            else if (!ship.isBoss) ship.isDead = true;
                        }

                        if(ship.isDead && !ship.isBoss) {
                             createExplosion(ship.x, ship.y, NEON_ORANGE, 30, 3.5);
                             playExplosionSound(0.6, 0.5);
                             break;
                        }
                    }
                }
            }
        }
    }
    
    // -- Bombs and Mines --
    for (let i = bombs.length - 1; i >= 0; i--) {
        const b = bombs[i];
        if (!b || b.life > 0) continue;
        
        triggerRumble(0.9, 0.9, 400); playExplosionSound(0.9, 0.8, 2500, 80);
        createExplosion(b.x, b.y, b.color, 60, 5);
        createShockwave(b.x, b.y, b.blastRadius * 2, b.color, 10, 4);

        const queryBox = { x: b.x - b.blastRadius, y: b.y - b.blastRadius, width: b.blastRadius * 2, height: b.blastRadius * 2 };
        const candidates = quadTree.queryRange(queryBox);

        for(const other of candidates) {
             if (distBetweenPoints(b.x, b.y, other.x, other.y) < b.blastRadius + other.r) {
                  if (other.constructor.name === 'Asteroid') {
                      const astIndex = asteroids.indexOf(other);
                      if (astIndex > -1) destroyAsteroid(astIndex, true, b.ownerId);
                  } else if (other.takeDamage && other.constructor.name !== 'Player') { // Bombs don't hurt players
                      other.takeDamage(15, b.x, b.y, true, b.ownerId);
                  }
             }
        }
        bombs.splice(i, 1);
    }
    
    for (let i = mines.length - 1; i >= 0; i--) { if (mines[i] && (mines[i].life <= 0 || mines[i].fuseTimer <= 0)) { detonateMine(i); } }
}