// scripts/build-mutators.cjs
const fs = require('fs');
const path = require('path');

// This new method is more robust and works in any terminal environment.
// It resolves paths relative to the current working directory where the script is run.
const projectRoot = process.cwd();
const mutatorsDir = path.join(projectRoot, 'src', 'mutators');
const manifestPath = path.join(mutatorsDir, 'index.js');

console.log('Scanning for mutators...');

// Get all .js files in the directory, excluding index.js itself
const mutatorFiles = fs.readdirSync(mutatorsDir)
    .filter(file => file.endsWith('.js') && file !== 'index.js');

if (mutatorFiles.length === 0) {
    console.log('No mutator files found. Manifest will be empty.');
} else {
    console.log('Found mutators:', mutatorFiles.join(', '));
}

// --- Build the content for the new index.js ---

// 1. Start with the header comment
let manifestContent = `// src/mutators/index.js
// THIS IS AN AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.
// To add a new mutator, create a .js file in this directory and then run \`npm run build-mutators\`.

`;

// 2. Create an import statement for each mutator file
const imports = mutatorFiles.map(file => {
    const mutatorName = path.parse(file).name.replace(/-/g, '_'); // e.g., 'reverse-gravity' -> 'reverse_gravity'
    return `import { ${mutatorName} } from './${file}';`;
}).join('\n');

manifestContent += imports + '\n\n';

// 3. Create the exported MUTATORS object
manifestContent += 'export const MUTATORS = {\n';

// START OF FIX: Renamed 'exports' to 'exportStrings' to avoid conflict
const exportStrings = mutatorFiles.map(file => {
    const mutatorName = path.parse(file).name.replace(/-/g, '_');
    // We derive the key from the object itself (e.g., flashlight.key which is 'FLASHLIGHT_MODE')
    return `    [${mutatorName}.key]: ${mutatorName},`;
}).join('\n');

manifestContent += exportStrings + '\n};\n'; // Use the new variable name here too
// END OF FIX

// 4. Write the new content to index.js
fs.writeFileSync(manifestPath, manifestContent, 'utf8');

console.log(`✅ Successfully built mutator manifest at ${manifestPath}`);