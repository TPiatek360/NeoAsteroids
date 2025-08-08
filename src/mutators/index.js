// src/mutators/index.js
// THIS IS AN AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.
// To add a new mutator, create a .js file in this directory and then run `npm run build-mutators`.

import { enemy_override } from './enemy-override.js';
import { flashlight } from './flashlight.js';
import { glass_cannon } from './glass-cannon.js';
import { reverse_controls } from './reverse-controls.js';
import { reverse_gravity } from './reverse_gravity.js';
import { stealth_enemies } from './stealth-enemies.js';

export const MUTATORS = {
    [enemy_override.key]: enemy_override,
    [flashlight.key]: flashlight,
    [glass_cannon.key]: glass_cannon,
    [reverse_controls.key]: reverse_controls,
    [reverse_gravity.key]: reverse_gravity,
    [stealth_enemies.key]: stealth_enemies,
};
