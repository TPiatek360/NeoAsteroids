// src/constants.js
// Contains all the static game configuration values (colors, physics, stats).

export const NEON_CYAN = '#00ffff';
export const NEON_PINK = '#ff00ff';
export const NEON_LIME = '#7fff00';
export const NEON_ORANGE = '#ffaa00';
export const NEON_BLUE = '#00aaff';
export const NEON_RED = '#ff0000'; // For mines

// --- NEW: Faction Color Scheme ---
export const NEON_ALLY_BODY = NEON_CYAN;
export const NEON_ALLY_ACCENT = NEON_LIME;
export const NEON_ENEMY_BODY = NEON_ORANGE;
export const NEON_ENEMY_ACCENT = NEON_CYAN; // Keep the cyan turret for contrast

// Projectile colors
export const NEON_ENEMY_MISSILE = NEON_PINK;
export const NEON_ENEMY_ROCKET = NEON_PINK;
export const NEON_ALLY_MISSILE = NEON_LIME;


// --- Gameplay Constants (Not affected by difficulty) ---
export const GRAVITATIONAL_CONSTANT = 0.01; // --- NEW GRAVITY CONSTANT ---
export const PLAYER_SIZE = 20;
export const PLAYER_THRUST = 0.1;
export const PLAYER_TURN_SPEED = 0.1;
export const FRICTION = 0.99;
export const PLAYER_GUN_COOLDOWN = 10;
export const PLAYER_RESPAWN_INVINCIBILITY = 180;
export const BULLET_SPEED = 7;
export const ASTEROID_MIN_SIZE_FOR_PICKUP = 33;
export const ASTEROID_VERTICES = 12;
export const ASTEROID_JAG = 0.4;
// --- REVISED MISSILE & LIFE CONSTANTS ---
export const PLAYER_BASE_MAX_LIVES = 3;
export const PLAYER_BASE_MAX_MISSILES = 5; // The default maximum a player can hold.
export const GAME_HARD_CAP_LIVES = 8; // The absolute maximum lives achievable with upgrades.
export const GAME_HARD_CAP_MISSILES = 10; // The absolute maximum missiles achievable with upgrades.
// Fallback for old references if any were missed, though they should be updated.
export const MAX_LIVES = GAME_HARD_CAP_LIVES;
export const MAX_MISSILES_CARRIED = GAME_HARD_CAP_MISSILES;
// ---
export const MISSILE_SPEED = 4;
export const MISSILE_TURN_SPEED = 0.04;
export const MISSILE_ACQUISITION_DELAY = 500;
export const MISSILE_ACQUISITION_CONE = Math.PI / 4;
export const MISSILE_LIFETIME = 7500;
export const MISSILE_SMOKE_INTERVAL = 50;
export const MISSILE_SMOKE_LIFETIME = 800;
export const MAX_CHARGE_LEVEL = 3;
export const MISSILE_CHARGE_TIME_PER_LEVEL = 1000;
export const MISSILE_SPREAD_ANGLE_INCREMENT = degToRad(10);
export const MISSILE_PICKUP_CHANCE = 0.35;
export const MISSILE_PICKUP_SIZE = 15;
export const MISSILE_PICKUP_DURATION = 600;
export const ROCKET_SPEED = 4.5;
export const SHIELD_MAX_ENERGY = 100;
export const SHIELD_DRAIN_RATE = 40;
export const SHIELD_RECHARGE_RATE = 10;
export const SHIELD_RECHARGE_DELAY = 2000; // ms
export const POWERUP_DROP_CHANCE = 0.15;
export const POWERUP_DURATION = 10000; // ms
export const CORVETTE_TURN_SPEED = 0.005;

// --- Shield Buffet Constants ---
export const SHIELD_HIT_ENERGY_DRAIN = 5;
export const SHIELD_KNOCKBACK_BULLET = 0.4;
export const SHIELD_KNOCKBACK_MISSILE = 1.0;
export const SHIELD_KNOCKBACK_ASTEROID = 2.5; // Increased from 2.0 to match enemy ship impact
export const SHIELD_KNOCKBACK_ENEMY_SHIP = 2.5;
export const SHIELD_KNOCKBACK_EXPLOSION = 4.0;

// --- Extra Life Constants ---
export const EXTRA_LIFE_DROP_CHANCE = 0.01; // 1%
export const GUARANTEED_LIFE_LEVEL = 8;

// --- Ace Enemy Constants ---
export const ACE_SPAWN_LEVEL = 4;
export const ACE_HEALTH = 5;
export const ACE_SHIELD_ENERGY = 10; // Can take 2 missile hits or 10 bullet hits
export const ACE_TURN_SPEED = 0.12;
export const ACE_THRUST = 0.085;
export const ACE_AVOID_RADIUS = 150;
export const ACE_SHOOT_COOLDOWN = 1800;
export const ACE_MISSILE_CHARGE_TIME = 2500; // ms to charge a volley
export const ACE_MISSILE_COOLDOWN = 8000; // Cooldown between volleys

// --- Minelayer and Mine Constants ---
export const MINE_LIFETIME = 20000; // 20 seconds
export const MINE_PROXIMITY_RADIUS = 100;
export const MINE_BLAST_RADIUS = 120;
export const MINE_DAMAGE = 10; // For area damage to big ships
export const MINE_FUSE_TIME = 1500; // 1.5 seconds once triggered
export const MINELAYER_HEALTH = 12;
export const MINELAYER_SPEED = 1.5;
export const MINELAYER_AVOID_RADIUS = 150;
export const MINELAYER_MINE_COOLDOWN = 2000;

// Re-add degToRad here as it's used within this file.
// It will also be in utils.js for other files to use.
function degToRad(d) {
    return d * Math.PI / 180;
}

// --- Difficulty Settings Object ---
export const DIFFICULTY_SETTINGS = {
    easy: {
        label: "Easy",
        asteroidNum: 4,
        asteroidSize: 90,
        asteroidSpeed: 0.8,
        enemySpawnTimeInitial: 15000,
        enemySpawnTimeInterval: 25000,
        enemyTurnSpeed: 0.06,
        enemyThrust: 0.07,
        enemyShootCooldown: 2500,
        enemyMissileCooldown: 15000,
        aceSpawnInterval: 25000,
        corvetteSpawnInterval: 8000,
        corvetteHealth: 15,
        corvetteTurretTurnSpeed: 0.015,
        corvetteTurretShootCooldown: 2000,
        cruiserSpawnInterval: null,
        cruiserHealth: 0,
        minelayerSpawnInterval: null, // No minelayers on easy
    },
    normal: {
        label: "Normal",
        asteroidNum: 5,
        asteroidSize: 100,
        asteroidSpeed: 1,
        enemySpawnTimeInitial: 10000,
        enemySpawnTimeInterval: 20000,
        enemyTurnSpeed: 0.08,
        enemyThrust: 0.08,
        enemyShootCooldown: 2000,
        enemyMissileCooldown: 10000,
        aceSpawnInterval: 18000,
        corvetteSpawnInterval: 5000,
        corvetteHealth: 20,
        corvetteTurretTurnSpeed: 0.02,
        corvetteTurretShootCooldown: 1500,
        cruiserSpawnInterval: 12000,
        cruiserHealth: 25,
        minelayerSpawnInterval: 7000,
    },
    hard: {
        label: "Hard",
        asteroidNum: 6,
        asteroidSize: 110,
        asteroidSpeed: 1.2,
        enemySpawnTimeInitial: 7000,
        enemySpawnTimeInterval: 15000,
        enemyTurnSpeed: 0.1,
        enemyThrust: 0.09,
        enemyShootCooldown: 1300,
        enemyMissileCooldown: 7000,
        aceSpawnInterval: 13000,
        corvetteSpawnInterval: 4000,
        corvetteHealth: 30,
        corvetteTurretTurnSpeed: 0.03,
        corvetteTurretShootCooldown: 1000,
        cruiserSpawnInterval: 9000,
        cruiserHealth: 35,
        minelayerSpawnInterval: 5500,
    }
};