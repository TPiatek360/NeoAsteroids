# Neon Asteroids

## Synopsis

Neon Asteroids is a dynamic, retro-futuristic, top-down arcade space shooter built with vanilla JavaScript and rendered on HTML5 Canvas. The game expands upon the classic Asteroids formula by introducing a modern, feature-rich experience. Players can engage in a classic arcade mode or a structured campaign, fighting a variety of enemy ships, navigating environmental hazards, and upgrading their ship. The project is notable for its highly customizable retro visual aesthetic, simulating CRT monitor effects like scanlines, bloom, and screen curvature.

The development follows a detailed strategic plan to systematically build a robust, roguelite campaign mode by layering systems intelligently, starting with a core loop and progressively adding content, variety, and advanced AI.

---

## Key Features

### Gameplay Modes
*   **Arcade Mode:** A classic, score-attack experience where the primary goal is to survive waves of asteroids and enemies to achieve a high score. Difficulty scales with player score and level progression.
*   **Campaign Mode:** A roguelite-style campaign where players progress through levels, earn currency, and purchase upgrades.
    *   **Persistent Progress:** Campaign progress is saved across three separate slots using browser `localStorage`.
    *   **Hangar & Upgrades:** Between levels, players visit a hangar to spend currency on consumable repairs and missile restocks, or permanent upgrades to their ship's hull and missile capacity.
    *   **Mission Variety:** The campaign features a mix of procedurally generated and hand-crafted missions, including:
        *   **Clear Zone:** Standard asteroid-clearing levels.
        *   **Skirmish:** Defeat a pre-defined squadron of enemies.
        *   **Assault / Boss Fights:** Hunt down and destroy a specific capital ship, such as a Corvette or a multi-section Cruiser.
        *   **Battle:** A large-scale engagement alongside allied ships against a significant enemy force.

### Core Mechanics
*   **Flight Models:** Players can choose between two distinct flight models in the options menu:
    *   **Arcade:** A classic model with friction, where the ship slows down when not thrusting.
    *   **Newtonian:** An inertia-based model where the ship maintains momentum, requiring counter-thrust to slow down or change direction.
*   **Diverse Enemies:** Face off against a varied roster of opponents, each with unique behaviors driven by a Finite State Machine (FSM):
    *   **Enemy Fighters:** Standard enemy ships that hunt the player.
    *   **Ace:** An elite fighter with shields, advanced maneuverability, and missile-charging capabilities.
    *   **Corvette:** A durable, medium-sized warship with a rotating turret and forward-firing rockets.
    *   **Cruiser:** A large, multi-section capital ship that must be destroyed piece by piece.
    *   **Minelayer:** A specialized ship that flees from threats while deploying proximity mines.
*   **Advanced AI:**
    *   **Finite State Machine (FSM):** Enemy AI is structured using states like `SEEKING`, `ATTACKING`, and `EVADING`, allowing for more complex and readable behavior patterns.
    *   **Squadron System:** Enemies can spawn in squads with a designated `Leader` and `Wingmen`. Wingmen will attempt to hold formation with their leader, enabling coordinated attacks.
*   **Player Abilities & Power-ups:**
    *   **Weapons:** Standard cannon, chargeable multi-missile volleys, and defensive bombs.
    *   **Shields:** A regenerating energy shield that drains when active and can be damaged by hits.
    *   **Power-ups:** Collect temporary boosts like Rapid Fire, Spread Shot, Shield Boost, and permanent Extra Lives.

### Visuals & Audio
*   **Retro CRT Aesthetic:** The game features a highly customizable visual engine designed to emulate the look and feel of a vintage vector-scan arcade monitor.
*   **Customizable Shaders & Effects:** Players can toggle and adjust:
    *   CRT Scanlines & Intensity
    *   Bloom & Phosphor Decay
    *   Screen Curvature & Jitter
    *   Film Grain / Noise Overlay
    *   Parallax Starfield Background
*   **Color Modes:** Play in full color or switch to monochrome modes like "Green Phosphor," "Amber Phosphor," or standard "Black & White."
*   **Dynamic Audio:** The game utilizes the Web Audio API for sound effects and features a dynamic music system that switches tracks between levels.

### Controls
*   **Multi-Platform Input:** Full support for both keyboard and gamepad controls.
*   **Configurable Schemes:** Includes multiple gamepad control schemes, such as separating aiming and movement to different sticks or combining them.
*   **Co-op & Versus:** Supports two-player local multiplayer in either cooperative or versus modes.

---

## How to Play

### Controls

#### Player 1 (Keyboard)
*   **Rotate:** `←` / `→` Arrow Keys
*   **Thrust:** `↑` Arrow Key
*   **Shoot:** `Space`
*   **Charge/Fire Missiles:** `M` (Hold to charge, release to fire)
*   **Drop Bomb:** `B`
*   **Activate Shield:** `Right Shift`

#### Player 2 (Keyboard)
*   **Rotate:** `A` / `D`
*   **Thrust:** `W`
*   **Shoot:** `Tab`
*   **Charge/Fire Missiles:** `G` (Hold to charge, release to fire)
*   **Drop Bomb:** `F`
*   **Activate Shield:** `Left Shift`

#### Gamepad (Default Scheme)
*   **Aim/Rotate:** Left Stick
*   **Thrust:** Right Trigger or Top Face Button (`△` / `Y`)
*   **Shoot:** Right Face Button (`□` / `X`)
*   **Charge/Fire Missiles:** Bottom Face Button (`X` / `A`)
*   **Drop Bomb:** Left Face Button (`○` / `B`)
*   **Activate Shield:** Left Trigger
*   **Pause:** Start Button

---

## Technical Overview & Project Structure

The project is written in vanilla JavaScript (ES6 Modules) with a clear separation of concerns, making it modular and extensible.

*   `/`
    *   `index.html`: The main menu entry point.
    *   `game.html`: The main game page.
    *   `A Strategic Plan for Neon Asteroids.txt`: The design and implementation document outlining the project's vision and phases.
    *   `main.css`: Contains all styling, including complex animations for the retro visual effects.
*   `src/`
    *   `main.js`: The core game engine, containing the main game loop, state management, and launch sequence.
    *   `menu.js`: Logic for the main menu, settings, and navigation.
    *   `state/`: Manages the global `gameState` object and provides functions for resetting it.
    *   `constants.js`: A central file for all static game configuration values (colors, physics, entity stats, difficulty settings).
    *   `entities/`: Contains class definitions for all game objects (`Player.js`, `enemies.js`, `environment.js`, `weapons.js`).
    *   `systems/`: Manages the core logic systems that operate on entities, such as `CollisionSystem.js` (using a QuadTree for efficiency), `RenderSystem.js`, `SpawnSystem.js`, and the `DevConsole.js`.
    *   `campaign/`: Handles the logic for the campaign mode, including state management (`campaignState.js`), saving/loading (`campaignManager.js`), and mission control (`MissionManager.js`).
    *   `ui/`: Manages all DOM interactions, input handling (`input.js`), and HUD rendering (`HUDRenderer.js`).
    *   `fx/`: Contains classes for visual effects like particles, shockwaves, and capital ship explosions.
    """*   `audio/`: Manages all Web Audio API logic for sound effects and music playback.

---

## Gameplay Modes (Advanced)

### Mutator Mode

Mutators are special gameplay modifiers that can be activated to dramatically change the rules of a run. They can be enabled via the developer console for testing or unique gameplay experiences.

*   **Reverse Gravity:** Gravitational bodies now push objects away.
*   **Flashlight Mode:** The battlefield is dark except for a cone of light from your ship.
*   **Reverse Controls:** Your directional controls are inverted.
*   **Stealth Enemies:** Standard enemy fighters can turn invisible until they attack.
*   **All Aces:** All standard enemy spawns are replaced with Aces.
*   **Glass Cannon:** Players have only one life but deal double damage.
*   **Newtonian Only:** Flight model is locked to Newtonian (inertia).

### Daily Challenge Mode

The Daily Challenge mode provides a unique, seeded run each day by combining a random set of the above mutators. This ensures that every day offers a new and unpredictable challenge for players to overcome.

---

## Developer Console Commands

The developer console can be accessed in-game and provides a variety of commands for debugging, testing, and customized gameplay.

*   `help`: Displays a list of all available commands.
*   `god`: Toggles invincibility for all players.
*   `clear <target>`: Clears specified entities from the game.
    *   `target`: `all`, `enemies`, `allies`, `asteroids`, `projectiles`
*   `level <number>`: Sets the current game level.
*   `spawn <type> [count] [options...]`: Spawns a specified number of entities with optional parameters.
    *   `<type>`: `asteroid`, `enemyship`, `corvette`, `cruiser`, `minelayer`, `ace`
    *   `[count]`: The number of entities to spawn (default: 1).
    *   `[options]`: Key-value pairs for customization.
        *   `faction=ally|enemy` (default: enemy)
        *   `pos=x%,y%` (e.g., `pos=50,50` for center screen)
        *   `heading=degrees` (e.g., `heading=90` for down)
        *   `vel=speed` (e.g., `vel=5`)
*   `mutator <sub-command> [MUTATOR_KEY]`: Manages gameplay mutators.
    *   `<sub-command>`:
        *   `list`: Shows all available and active mutators.
        *   `activate <MUTATOR_KEY>`: Activates a specific mutator.
        *   `deactivate <MUTATOR_KEY>`: Deactivates an active mutator.
        *   `clear`: Deactivates all active mutators.""